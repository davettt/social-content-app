import express from "express";
import path from "path";
import fs from "fs/promises";
import archiver from "archiver";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import { Jimp } from "jimp";
import { getProjectDir, readJsonFile, PROJECTS_DIR } from "../utils/storage.js";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.js";

const router = express.Router();

// Store for pending exports (in-memory for simplicity)
const pendingExports = new Map();

// Platform names for folder structure
const PLATFORM_NAMES = {
  instagram: "Instagram",
  threads: "Threads",
  twitter: "Twitter",
  linkedin: "LinkedIn",
};

// Default aspect ratios (used if not provided by frontend)
const DEFAULT_PLATFORM_ASPECTS = {
  instagram: { width: 4, height: 5 },
  threads: { width: 4, height: 5 },
  twitter: { width: 16, height: 9 },
  linkedin: { width: 1.91, height: 1 },
};

// Base size for exports (longest dimension)
const EXPORT_BASE_SIZE = 1080;

// Calculate pixel dimensions from aspect ratio
function getExportDimensions(aspectRatio) {
  const { width, height } = aspectRatio;
  const ratio = width / height;

  if (ratio >= 1) {
    // Landscape or square
    return {
      width: EXPORT_BASE_SIZE,
      height: Math.round(EXPORT_BASE_SIZE / ratio),
    };
  } else {
    // Portrait
    return {
      width: Math.round(EXPORT_BASE_SIZE * ratio),
      height: EXPORT_BASE_SIZE,
    };
  }
}

// Helper function to get image buffer from edited data URL or original file
async function getImageBuffer(media, editedImages) {
  const editedDataUrl = editedImages?.[media.id];

  if (editedDataUrl && editedDataUrl.startsWith("data:")) {
    // Parse data URL: data:image/png;base64,<base64data>
    const matches = editedDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return Buffer.from(matches[2], "base64");
    }
  }

  // Read original file
  const sourcePath = path.join(PROJECTS_DIR, media.originalPath);
  return await fs.readFile(sourcePath);
}

// Helper function to resize image to specific dimensions
async function resizeImage(inputBuffer, dimensions) {
  if (!dimensions) return inputBuffer;

  try {
    return await sharp(inputBuffer)
      .resize(dimensions.width, dimensions.height, {
        fit: "cover",
        position: "center",
        kernel: "lanczos3",
      })
      .png({
        compressionLevel: 1, // Minimal compression, maximum quality
        effort: 1,
      })
      .toBuffer();
  } catch (e) {
    console.warn(`Could not resize image:`, e.message);
    return inputBuffer;
  }
}

// Helper function to load video edits from disk
async function loadVideoEdits(projectDir, mediaId) {
  try {
    const editsPath = path.join(
      projectDir,
      "media",
      "edits",
      `video-${mediaId}.json`,
    );
    const data = await fs.readFile(editsPath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    // No saved edits
    return null;
  }
}

// Escape text for FFmpeg drawtext filter
function escapeFFmpegText(text) {
  return text
    .replace(/\\/g, "\\\\\\\\") // Escape backslashes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/:/g, "\\:") // Escape colons
    .replace(/\[/g, "\\[") // Escape brackets
    .replace(/\]/g, "\\]");
}

// Wrap text into multiple lines based on max width
function wrapText(text, maxCharsPerLine) {
  if (!text || maxCharsPerLine <= 0) return [text || ""];

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

// Get FFmpeg position expressions for text position presets
function getFFmpegPositionExpression(position, textAlign) {
  const margin = 0.05; // 5% margin

  // X position based on horizontal alignment
  let x;
  switch (textAlign || "center") {
    case "left":
      x = `w*${margin}`;
      break;
    case "right":
      x = `w*${1 - margin}-tw`;
      break;
    case "center":
    default:
      x = "(w-tw)/2";
      break;
  }

  // Y position based on position preset
  let y;
  if (!position || position.includes("middle")) {
    y = "(h-th)/2";
  } else if (position.includes("top")) {
    y = `h*${margin}`;
  } else if (position.includes("bottom")) {
    y = `h*${1 - margin}-th`;
  } else {
    y = "(h-th)/2";
  }

  // Adjust X based on position horizontal component
  if (position) {
    if (position.includes("left")) {
      x = `w*${margin}`;
    } else if (position.includes("right")) {
      x = `w*${1 - margin}-tw`;
    } else if (position.includes("center")) {
      x = "(w-tw)/2";
    }
  }

  return { x, y };
}

// Editor preview base size - font sizes are defined relative to this
const EDITOR_PREVIEW_BASE_SIZE = 400;

// Get video dimensions using ffprobe
async function getVideoDimensions(sourcePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      sourcePath,
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          const stream = info.streams?.[0];
          if (stream && stream.width && stream.height) {
            resolve({ width: stream.width, height: stream.height });
          } else {
            resolve(null);
          }
        } catch (e) {
          console.warn("Failed to parse ffprobe output:", e.message);
          resolve(null);
        }
      } else {
        console.warn("ffprobe failed:", stderr);
        resolve(null);
      }
    });

    ffprobe.on("error", (err) => {
      console.warn("ffprobe spawn error:", err.message);
      resolve(null);
    });
  });
}

// Detect if text contains emoji characters
function containsEmoji(text) {
  // Unicode emoji pattern
  const emojiRegex = /[\p{Emoji}]/u;
  return emojiRegex.test(text);
}

// Render text to image file using SVG + Sharp (supports emoji rendering)
// Returns path to the temporary PNG file
async function renderTextToImage(overlay, fontScaleFactor) {
  try {
    const scaledFontSize = Math.round(
      (overlay.fontSize || 48) * fontScaleFactor,
    );

    // Calculate dimensions for the text image
    // Width estimate based on text length and font size
    const charWidthEstimate = scaledFontSize * 0.6;
    const textWidth = Math.min(
      3000,
      Math.max(200, Math.round(overlay.text.length * charWidthEstimate * 1.2)),
    );
    const textHeight = Math.round(scaledFontSize * 1.5);
    const padding = Math.round(scaledFontSize * 0.3);
    const svgWidth = textWidth + padding * 2;
    const svgHeight = textHeight + padding * 2;

    // Build SVG with text
    let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<defs><style>text { font-family: ${overlay.fontFamily || "Arial"}, sans-serif; }</style></defs>`;

    // Add background if specified
    if (overlay.backgroundColor) {
      svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="${overlay.backgroundColor}" opacity="0.8"/>`;
    }

    // Escape SVG special characters
    const escapedText = overlay.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    // Add text with stroke support
    let textElement = `<text x="${padding}" y="${padding + scaledFontSize}" font-size="${scaledFontSize}" fill="${overlay.color || "white"}"`;

    if (overlay.strokeWidth && overlay.strokeWidth > 0) {
      const scaledStrokeWidth = Math.round(
        overlay.strokeWidth * fontScaleFactor,
      );
      textElement += ` stroke="${overlay.strokeColor || "black"}" stroke-width="${scaledStrokeWidth}"`;
    }

    if (overlay.shadow) {
      textElement += ` filter="url(#shadow)"`;
    }

    textElement += `>${escapedText}</text>`;

    // Add shadow filter if needed
    if (overlay.shadow) {
      svgContent += `<defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.7"/>
      </filter></defs>`;
    }

    svgContent += textElement;
    svgContent += "</svg>";

    // Create temp directory
    const tempDir = path.join(PROJECTS_DIR, ".temp");
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `text-overlay-${uuidv4()}.png`);

    // Render SVG to PNG using Sharp
    await sharp(Buffer.from(svgContent)).png().toFile(tempFile);

    console.log(
      `Rendered emoji text to image: "${overlay.text}" → ${tempFile}`,
    );
    return tempFile;
  } catch (error) {
    console.warn("Failed to render text to image:", error.message);
    return null; // Fallback to drawtext
  }
}

// Build FFmpeg drawtext filters for a text overlay (returns array for multi-line)
function buildDrawtextFilters(
  overlay,
  trimDuration,
  fontScaleFactor = 1,
  aspectRatio = null,
) {
  // Log if text contains emoji for debugging
  if (containsEmoji(overlay.text || "")) {
    console.log(
      `Text overlay contains emoji: "${overlay.text}" - rendering with system font support`,
    );
  }

  const { x, y } = getFFmpegPositionExpression(
    overlay.position,
    overlay.textAlign,
  );

  // Calculate enable expression based on timing preset
  let enable;
  switch (overlay.timing) {
    case "full":
      enable = "1";
      break;
    case "first-3s":
      enable = "between(t,0,3)";
      break;
    case "last-3s":
      enable = `between(t,${Math.max(0, trimDuration - 3)},${trimDuration})`;
      break;
    case "first-5s":
      enable = "between(t,0,5)";
      break;
    case "last-5s":
      enable = `between(t,${Math.max(0, trimDuration - 5)},${trimDuration})`;
      break;
    default:
      enable = "1";
  }

  // Scale font size based on actual video dimensions vs editor preview size
  const baseFontSize = overlay.fontSize || 48;
  const scaledFontSize = Math.round(baseFontSize * fontScaleFactor);

  // Calculate max characters per line based on PREVIEW dimensions (not export dimensions)
  // This ensures consistent wrapping between editor preview and export
  // The editor preview uses a base size of 400px, adjusted for aspect ratio
  const ar = aspectRatio ? aspectRatio.width / aspectRatio.height : 1;
  const previewWidth =
    ar >= 1 ? EDITOR_PREVIEW_BASE_SIZE : EDITOR_PREVIEW_BASE_SIZE * ar;

  // Calculate wrapping based on preview dimensions with the base font size
  // Use 0.6 as char width estimate (more conservative)
  const charWidthInPreview = baseFontSize * 0.6;
  const maxTextWidthInPreview = previewWidth * 0.9; // 90% of preview width
  const maxCharsPerLine = Math.max(
    8,
    Math.floor(maxTextWidthInPreview / charWidthInPreview),
  );

  // Wrap text into lines
  const lines = wrapText(overlay.text || "", maxCharsPerLine);
  const lineHeight = scaledFontSize * 1.3; // 130% line height

  // Calculate total text block height for vertical positioning
  const totalHeight = lines.length * lineHeight;

  // Build shadow options string
  let shadowOpts = "";
  if (overlay.shadow) {
    const shadowOffset = Math.max(1, Math.round(2 * fontScaleFactor));
    shadowOpts = `:shadowcolor=black@0.7:shadowx=${shadowOffset}:shadowy=${shadowOffset}`;
  }

  // Generate a filter for each line
  const filters = [];
  for (let i = 0; i < lines.length; i++) {
    const escapedText = escapeFFmpegText(lines[i]);
    const lineOffset = i * lineHeight;

    // Adjust y position for each line based on vertical alignment
    let yExpr;
    if (overlay.position && overlay.position.includes("top")) {
      // Top: first line at margin, subsequent lines below
      yExpr = `h*0.05+${lineOffset}`;
    } else if (overlay.position && overlay.position.includes("bottom")) {
      // Bottom: last line at margin, stack upward
      const bottomOffset = (lines.length - 1 - i) * lineHeight;
      yExpr = `h*0.95-th-${bottomOffset}`;
    } else {
      // Middle: center the block, offset each line
      const blockStartOffset = -totalHeight / 2 + lineHeight / 2;
      yExpr = `(h-th)/2+${blockStartOffset + lineOffset}`;
    }

    let filter = `drawtext=text='${escapedText}'`;
    filter += `:fontsize=${scaledFontSize}`;
    filter += `:fontcolor=${overlay.color || "white"}`;
    filter += `:x=${x}`;
    filter += `:y=${yExpr}`;
    filter += `:enable='${enable}'`;
    filter += shadowOpts;

    // Add text stroke/outline support
    if (overlay.strokeWidth && overlay.strokeWidth > 0) {
      const scaledStrokeWidth = Math.round(
        overlay.strokeWidth * fontScaleFactor,
      );
      filter += `:borderw=${scaledStrokeWidth}`;
      filter += `:bordercolor=${overlay.strokeColor || "black"}`;
    }

    // Add background color support
    if (overlay.backgroundColor) {
      filter += `:box=1:boxcolor=${overlay.backgroundColor}@0.8`;
      filter += `:boxborderw=5`; // Padding around text
    }

    filters.push(filter);
  }

  return filters;
}

// Helper function to process video with FFmpeg
async function processVideoWithFFmpeg(sourcePath, destPath, edits) {
  // Get video dimensions to calculate font scale factor
  let fontScaleFactor = 1;
  const videoDims = await getVideoDimensions(sourcePath);
  if (videoDims) {
    // Calculate the effective height after aspect ratio crop
    let effectiveHeight = videoDims.height;
    if (
      edits.aspectRatio &&
      edits.aspectRatio.width &&
      edits.aspectRatio.height
    ) {
      const targetAR = edits.aspectRatio.width / edits.aspectRatio.height;
      const videoAR = videoDims.width / videoDims.height;

      if (videoAR > targetAR) {
        // Video is wider than target - height stays the same after crop
        effectiveHeight = videoDims.height;
      } else {
        // Video is taller than target - width stays, height is cropped
        effectiveHeight = Math.round(videoDims.width / targetAR);
      }
    }

    // Scale font based on video height relative to editor preview size
    fontScaleFactor = effectiveHeight / EDITOR_PREVIEW_BASE_SIZE;
    console.log(
      `Font scale factor: ${fontScaleFactor} (video height: ${effectiveHeight}, preview base: ${EDITOR_PREVIEW_BASE_SIZE})`,
    );
  }

  return new Promise(async (resolve, reject) => {
    const args = [];

    // Trim: seek to start position
    if (edits.trimStart > 0) {
      args.push("-ss", edits.trimStart.toString());
    }

    // Input file
    args.push("-i", sourcePath);

    // Calculate trim duration
    const trimDuration =
      edits.trimEnd > edits.trimStart
        ? edits.trimEnd - edits.trimStart
        : Infinity;

    // Trim: duration (trimEnd - trimStart)
    if (edits.trimEnd > edits.trimStart) {
      args.push("-t", trimDuration.toString());
    }

    // Build video filter for crop, speed change and text overlays
    const videoFilters = [];
    const audioFilters = [];

    // Add aspect ratio crop filter FIRST (before text overlays)
    // Text overlays are positioned relative to the cropped video
    if (
      edits.aspectRatio &&
      edits.aspectRatio.width &&
      edits.aspectRatio.height
    ) {
      const ar = edits.aspectRatio.width / edits.aspectRatio.height;
      // Center crop to target aspect ratio
      // crop=out_w:out_h:x:y
      // If video is wider than target: crop width, keep height
      // If video is taller than target: keep width, crop height
      const cropFilter = `crop='if(gt(iw/ih,${ar}),ih*${ar},iw)':'if(gt(iw/ih,${ar}),ih,iw/${ar})'`;
      videoFilters.push(cropFilter);
    }

    if (edits.speed && edits.speed !== 1) {
      // Video speed: setpts=PTS/speed (inverse relationship)
      videoFilters.push(`setpts=PTS/${edits.speed}`);
      // Audio speed: atempo only supports 0.5 to 2.0, chain if needed
      if (edits.speed >= 0.5 && edits.speed <= 2.0) {
        audioFilters.push(`atempo=${edits.speed}`);
      } else if (edits.speed > 2.0) {
        // Chain atempo filters for > 2x speed
        audioFilters.push("atempo=2.0");
        audioFilters.push(`atempo=${edits.speed / 2.0}`);
      } else if (edits.speed < 0.5) {
        // Chain atempo filters for < 0.5x speed
        audioFilters.push("atempo=0.5");
        audioFilters.push(`atempo=${edits.speed / 0.5}`);
      }
    }

    // Add text overlay filters (after crop, so text is positioned on cropped video)
    const tempImageFiles = [];
    if (edits.textOverlays && edits.textOverlays.length > 0) {
      // Adjust duration for speed changes
      const adjustedDuration =
        edits.speed && edits.speed !== 1
          ? trimDuration / edits.speed
          : trimDuration;

      // Try to use SVG image overlay for emoji text if available
      let hasImageOverlays = false;
      let lastInputIndex = 1;

      for (const overlay of edits.textOverlays) {
        if (
          overlay.text &&
          overlay.text.trim() &&
          containsEmoji(overlay.text)
        ) {
          try {
            // Try to render emoji text to image
            const imagePath = await renderTextToImage(
              overlay,
              fontScaleFactor,
            );
            if (imagePath) {
              tempImageFiles.push(imagePath);
              args.push("-i", imagePath);
              lastInputIndex++;
              hasImageOverlays = true;
            }
          } catch (err) {
            console.warn("Failed to render emoji overlay, falling back to drawtext:", err.message);
          }
        }
      }

      // If we used image overlays, we need filter_complex; otherwise just use regular drawtext
      if (hasImageOverlays) {
        console.log("Using filter_complex for emoji text overlays");
        // For now, fall back to drawtext even if we tried to use images
        // This ensures text always shows up
        for (const overlay of edits.textOverlays) {
          if (overlay.text && overlay.text.trim()) {
            const drawtextFilters = buildDrawtextFilters(
              overlay,
              adjustedDuration,
              fontScaleFactor,
              edits.aspectRatio,
            );
            videoFilters.push(...drawtextFilters);
          }
        }
      } else {
        // No image overlays, just use regular drawtext
        for (const overlay of edits.textOverlays) {
          if (overlay.text && overlay.text.trim()) {
            const drawtextFilters = buildDrawtextFilters(
              overlay,
              adjustedDuration,
              fontScaleFactor,
              edits.aspectRatio,
            );
            videoFilters.push(...drawtextFilters);
          }
        }
      }
    }

    // Apply video filters
    if (videoFilters.length > 0) {
      args.push("-vf", videoFilters.join(","));
    }

    // Handle audio: mute, volume, or speed
    if (edits.muted) {
      args.push("-an"); // No audio
    } else {
      // Apply volume and speed filters
      if (edits.volume !== undefined && edits.volume !== 1) {
        audioFilters.push(`volume=${edits.volume}`);
      }
      if (audioFilters.length > 0) {
        args.push("-af", audioFilters.join(","));
      }
    }

    // Output settings
    args.push("-c:v", "libx264"); // H.264 codec
    args.push("-preset", "fast"); // Encoding speed
    args.push("-crf", "23"); // Quality (lower = better, 18-28 is reasonable)
    if (!edits.muted) {
      args.push("-c:a", "aac"); // AAC audio codec
      args.push("-b:a", "128k"); // Audio bitrate
    }
    args.push("-y"); // Overwrite output
    args.push(destPath);

    console.log(`FFmpeg processing: ffmpeg ${args.join(" ")}`);

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", async (code) => {
      try {
        // Clean up temporary image files
        for (const imagePath of tempImageFiles) {
          try {
            await fs.unlink(imagePath);
            console.log(`Cleaned up temp image: ${imagePath}`);
          } catch (cleanupErr) {
            console.warn(
              `Failed to delete temp image ${imagePath}:`,
              cleanupErr.message,
            );
          }
        }

        if (code === 0) {
          console.log(`FFmpeg processed video successfully: ${destPath}`);
          resolve();
        } else {
          console.error(`FFmpeg failed with code ${code}:`, stderr);
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      } catch (err) {
        reject(err);
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("FFmpeg spawn error:", err);
      reject(err);
    });
  });
}

// POST /api/export/prepare - Prepare export package
router.post("/prepare", async (req, res, next) => {
  try {
    const {
      projectId,
      platforms,
      platformAspects,
      caption,
      mediaIds,
      editedImages,
      collages,
    } = req.body;

    if (!projectId) {
      throw new ValidationError("Project ID is required");
    }

    const exportId = uuidv4();
    const projectDir = await getProjectDir(projectId);
    const exportsDir = path.join(projectDir, "exports", exportId);
    await fs.mkdir(exportsDir, { recursive: true });

    const selectedPlatforms = platforms || [
      "instagram",
      "threads",
      "twitter",
      "linkedin",
    ];

    // Get media info if mediaIds provided
    let mediaFiles = [];
    if (mediaIds && mediaIds.length > 0) {
      try {
        const mediaIndex = await readJsonFile(
          path.join(projectDir, "media", "index.json"),
        );
        mediaFiles = (mediaIndex.media || []).filter((m) =>
          mediaIds.includes(m.id),
        );
      } catch (e) {
        console.warn("Could not read media/index.json:", e.message);
      }
    }

    // Create platform-specific folders and process images
    for (const platform of selectedPlatforms) {
      const platformName = PLATFORM_NAMES[platform];
      if (!platformName) continue;

      // Get aspect ratio from request or use default
      const aspectRatio =
        platformAspects?.[platform] || DEFAULT_PLATFORM_ASPECTS[platform];
      const dimensions = getExportDimensions(aspectRatio);

      const platformDir = path.join(exportsDir, platformName);
      await fs.mkdir(platformDir, { recursive: true });

      // Process each media file for this platform
      for (let i = 0; i < mediaFiles.length; i++) {
        const media = mediaFiles[i];

        // Handle videos with FFmpeg
        if (media.type === "video") {
          try {
            const sourcePath = path.join(PROJECTS_DIR, media.originalPath);
            const destPath = path.join(platformDir, media.filename);

            // Check for saved video edits
            const savedEdits = await loadVideoEdits(projectDir, media.id);

            // Always use platform-specific aspect ratio for export
            // Override any saved aspect ratio with the platform's aspect ratio
            const videoEdits = {
              trimStart: savedEdits?.trimStart ?? 0,
              trimEnd: savedEdits?.trimEnd ?? 0,
              speed: savedEdits?.speed ?? 1,
              muted: savedEdits?.muted ?? false,
              volume: savedEdits?.volume ?? 1,
              textOverlays: savedEdits?.textOverlays ?? [],
              aspectRatio: aspectRatio, // Use platform-specific aspect ratio
            };

            // Check if we need to process (has edits or needs aspect ratio crop)
            const needsProcessing =
              videoEdits.trimStart > 0 ||
              videoEdits.trimEnd > 0 ||
              videoEdits.speed !== 1 ||
              videoEdits.muted ||
              videoEdits.volume !== 1 ||
              videoEdits.textOverlays.length > 0 ||
              aspectRatio;

            if (needsProcessing) {
              // Process video with FFmpeg to apply edits and platform aspect ratio
              console.log(
                `Processing video ${media.filename} for ${platformName} with aspect ratio ${aspectRatio.width}:${aspectRatio.height}`,
              );
              await processVideoWithFFmpeg(sourcePath, destPath, videoEdits);
            } else {
              // No edits needed - just copy as-is
              await fs.copyFile(sourcePath, destPath);
              console.log(`Copied video ${media.filename} to ${platformName}`);
            }
          } catch (e) {
            console.warn(
              `Could not process video ${media.filename}:`,
              e.message,
            );
            // Fallback: try to copy original
            try {
              const sourcePath = path.join(PROJECTS_DIR, media.originalPath);
              const destPath = path.join(platformDir, media.filename);
              await fs.copyFile(sourcePath, destPath);
              console.log(
                `Fallback: copied original video ${media.filename} to ${platformName}`,
              );
            } catch (copyErr) {
              console.warn(`Fallback copy also failed:`, copyErr.message);
            }
          }
          continue;
        }

        try {
          // Get the source image buffer (edited or original)
          const inputBuffer = await getImageBuffer(media, editedImages);

          // Resize to the selected aspect ratio dimensions
          const resizedBuffer = await resizeImage(inputBuffer, dimensions);

          // Save with platform-specific filename
          const baseName = media.filename.replace(/\.[^.]+$/, "");
          const destFilename = `${baseName}_${i + 1}.png`;
          const destPath = path.join(platformDir, destFilename);

          await fs.writeFile(destPath, resizedBuffer);
          console.log(
            `Saved ${destFilename} (${dimensions.width}x${dimensions.height}) to ${platformName}`,
          );
        } catch (e) {
          console.warn(
            `Could not process ${media.filename} for ${platform}:`,
            e.message,
          );
        }
      }

      // Process collages for this platform
      if (collages && collages.length > 0) {
        for (let i = 0; i < collages.length; i++) {
          const collageDataUrl = collages[i];
          try {
            // Parse data URL: data:image/png;base64,<base64data>
            const matches = collageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const base64Data = matches[2];
              const inputBuffer = Buffer.from(base64Data, "base64");

              // Resize to the selected aspect ratio dimensions
              const resizedBuffer = await resizeImage(inputBuffer, dimensions);

              // Save with collage filename
              const destFilename = `collage_${i + 1}.png`;
              const destPath = path.join(platformDir, destFilename);

              await fs.writeFile(destPath, resizedBuffer);
              console.log(
                `Saved ${destFilename} (${dimensions.width}x${dimensions.height}) to ${platformName}`,
              );
            }
          } catch (e) {
            console.warn(
              `Could not process collage ${i + 1} for ${platform}:`,
              e.message,
            );
          }
        }
      }

      // Save caption to each platform folder
      if (caption) {
        await fs.writeFile(
          path.join(platformDir, "caption.txt"),
          caption,
          "utf-8",
        );
      }
    }

    // Store export info
    pendingExports.set(exportId, {
      id: exportId,
      projectId,
      platforms: selectedPlatforms,
      caption,
      mediaFiles,
      status: "ready",
      createdAt: new Date().toISOString(),
      exportsDir,
    });

    const exportInfo = {
      id: exportId,
      status: "ready",
      platforms: selectedPlatforms,
    };

    res.json(exportInfo);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/:id/download - Download export as ZIP
router.get("/:id/download", async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportInfo = pendingExports.get(id);

    if (!exportInfo) {
      throw new NotFoundError(`Export not found: ${id}`);
    }

    const exportsDir = exportInfo.exportsDir;

    // Create ZIP file
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=social-export-${Date.now()}.zip`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Add all platform folders and their contents
    try {
      const entries = await fs.readdir(exportsDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(exportsDir, entry.name);
        if (entry.isDirectory()) {
          // Add the entire platform folder
          archive.directory(entryPath, entry.name);
        } else if (entry.isFile()) {
          // Add any root-level files
          archive.file(entryPath, { name: entry.name });
        }
      }
    } catch (e) {
      console.warn("Could not read exports dir:", e.message);
    }

    // Build platform info for README
    const platformDetails = exportInfo.platforms
      .map((p) => {
        const name = PLATFORM_NAMES[p];
        return name ? `  - ${name}/` : `  - ${p}/`;
      })
      .join("\n");

    // Add a README with instructions
    const mediaCount = exportInfo.mediaFiles?.length || 0;
    archive.append(
      `Social Content Export
=====================
Export ID: ${id}
Created: ${exportInfo.createdAt}
Media Files: ${mediaCount}

Folder Structure:
${platformDetails}

Each platform folder contains:
- Images sized to your selected aspect ratio for that platform
- caption.txt with your caption and hashtags

How to post:
1. Open the folder for your target platform
2. AirDrop the images and caption.txt to your phone
3. Open the social media app
4. Create a new post and select the images
5. Copy the caption from caption.txt
6. Post!

Tip: Each platform folder has correctly sized images - use the right folder for best results!
`,
      { name: "README.txt" },
    );

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

// GET /api/export/:id/status - Get export status
router.get("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportInfo = pendingExports.get(id);

    if (!exportInfo) {
      throw new NotFoundError(`Export not found: ${id}`);
    }

    res.json({
      id: exportInfo.id,
      status: exportInfo.status,
      platforms: exportInfo.platforms,
      createdAt: exportInfo.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
