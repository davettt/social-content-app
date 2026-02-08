import express from "express";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import {
  getProjectDir,
  readJsonFile,
  writeJsonFile,
  PROJECTS_DIR,
} from "../utils/storage.js";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.js";
import { getVideoThumbnail } from "../services/metadataExtractor.js";

const router = express.Router();

// Helper to ensure edits directory exists
async function ensureEditsDir(projectId) {
  const projectDir = await getProjectDir(projectId);
  const editsDir = path.join(projectDir, "media", "edits");
  await fs.mkdir(editsDir, { recursive: true });
  return editsDir;
}

// Helper to get media index
async function getMediaIndex(projectId) {
  const projectDir = await getProjectDir(projectId);
  const indexPath = path.join(projectDir, "media", "index.json");
  return (await readJsonFile(indexPath)) || { media: [] };
}

// Helper to write media index
async function writeMediaIndex(projectId, data) {
  const projectDir = await getProjectDir(projectId);
  const indexPath = path.join(projectDir, "media", "index.json");
  await writeJsonFile(indexPath, data);
}

// ============================================
// IMAGE EDIT ENDPOINTS
// ============================================

// POST /api/edits/:projectId/image/:mediaId - Save edited image
router.post("/:projectId/image/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const { dataUrl, adjustments, textOverlays, graphicOverlays } = req.body;

    if (!dataUrl) {
      throw new ValidationError("dataUrl is required");
    }

    const projectDir = await getProjectDir(projectId);
    const editsDir = await ensureEditsDir(projectId);
    const processedDir = path.join(projectDir, "media", "processed");
    await fs.mkdir(processedDir, { recursive: true });

    // Parse and save the image data URL as PNG
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new ValidationError("Invalid dataUrl format");
    }

    const imageBuffer = Buffer.from(matches[2], "base64");
    const processedPath = path.join(processedDir, `${mediaId}.png`);

    // Save the processed image
    await fs.writeFile(processedPath, imageBuffer);
    console.log(`Saved processed image: ${processedPath}`);

    // Save edit metadata
    const editMetadata = {
      mediaId,
      adjustments: adjustments || {},
      textOverlays: textOverlays || [],
      graphicOverlays: graphicOverlays || [],
      processedPath: `${projectId}/media/processed/${mediaId}.png`,
      editedAt: new Date().toISOString(),
    };

    const metadataPath = path.join(editsDir, `${mediaId}.json`);
    await writeJsonFile(metadataPath, editMetadata);
    console.log(`Saved edit metadata: ${metadataPath}`);

    // Update media index with hasEdits flag
    const index = await getMediaIndex(projectId);
    const mediaIndex = index.media.findIndex((m) => m.id === mediaId);
    if (mediaIndex !== -1) {
      index.media[mediaIndex].hasEdits = true;
      index.media[mediaIndex].processedPath = editMetadata.processedPath;
      await writeMediaIndex(projectId, index);
    }

    res.json({
      success: true,
      mediaId,
      processedPath: editMetadata.processedPath,
      editedAt: editMetadata.editedAt,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/edits/:projectId/image/:mediaId - Load edited image data
router.get("/:projectId/image/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const editsDir = await ensureEditsDir(projectId);
    const metadataPath = path.join(editsDir, `${mediaId}.json`);

    const metadata = await readJsonFile(metadataPath);
    if (!metadata) {
      // No edits exist for this media
      res.json({ hasEdits: false });
      return;
    }

    // Read the processed image and convert to data URL
    const projectDir = await getProjectDir(projectId);
    const processedPath = path.join(
      projectDir,
      "media",
      "processed",
      `${mediaId}.png`,
    );

    try {
      const imageBuffer = await fs.readFile(processedPath);
      const dataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

      res.json({
        hasEdits: true,
        dataUrl,
        adjustments: metadata.adjustments,
        textOverlays: metadata.textOverlays,
        graphicOverlays: metadata.graphicOverlays || [],
        editedAt: metadata.editedAt,
      });
    } catch (e) {
      // Processed image doesn't exist, return just metadata
      res.json({
        hasEdits: true,
        adjustments: metadata.adjustments,
        textOverlays: metadata.textOverlays,
        graphicOverlays: metadata.graphicOverlays || [],
        editedAt: metadata.editedAt,
      });
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/edits/:projectId/image/:mediaId - Remove image edits
router.delete("/:projectId/image/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const projectDir = await getProjectDir(projectId);
    const editsDir = path.join(projectDir, "media", "edits");
    const processedDir = path.join(projectDir, "media", "processed");

    // Delete metadata file
    try {
      await fs.unlink(path.join(editsDir, `${mediaId}.json`));
    } catch (e) {
      // Ignore if doesn't exist
    }

    // Delete processed image
    try {
      await fs.unlink(path.join(processedDir, `${mediaId}.png`));
    } catch (e) {
      // Ignore if doesn't exist
    }

    // Update media index
    const index = await getMediaIndex(projectId);
    const mediaIndex = index.media.findIndex((m) => m.id === mediaId);
    if (mediaIndex !== -1) {
      delete index.media[mediaIndex].hasEdits;
      delete index.media[mediaIndex].processedPath;
      await writeMediaIndex(projectId, index);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================
// VIDEO EDIT ENDPOINTS
// ============================================

// POST /api/edits/:projectId/video/:mediaId - Save video edit settings
router.post("/:projectId/video/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const {
      trimStart,
      trimEnd,
      speed,
      muted,
      volume,
      textOverlays,
      aspectRatio,
    } = req.body;

    const editsDir = await ensureEditsDir(projectId);

    const videoEdits = {
      mediaId,
      trimStart: trimStart ?? 0,
      trimEnd: trimEnd ?? 0,
      speed: speed ?? 1,
      muted: muted ?? false,
      volume: volume ?? 1,
      textOverlays: textOverlays ?? [],
      aspectRatio: aspectRatio ?? null,
      editedAt: new Date().toISOString(),
    };

    const metadataPath = path.join(editsDir, `video-${mediaId}.json`);
    await writeJsonFile(metadataPath, videoEdits);
    console.log(`Saved video edit settings: ${metadataPath}`);
    console.log(`Saved edits:`, {
      trimStart: videoEdits.trimStart,
      trimEnd: videoEdits.trimEnd,
      textOverlays: videoEdits.textOverlays?.length || 0,
      aspectRatio: videoEdits.aspectRatio,
    });

    // Update media index with hasEdits flag
    const index = await getMediaIndex(projectId);
    const mediaIndex = index.media.findIndex((m) => m.id === mediaId);
    if (mediaIndex !== -1) {
      index.media[mediaIndex].hasVideoEdits = true;
      await writeMediaIndex(projectId, index);
    }

    res.json({
      success: true,
      mediaId,
      ...videoEdits,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/edits/:projectId/video/:mediaId - Load video edit settings
router.get("/:projectId/video/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const editsDir = await ensureEditsDir(projectId);
    const metadataPath = path.join(editsDir, `video-${mediaId}.json`);

    const metadata = await readJsonFile(metadataPath);
    if (!metadata) {
      console.log(`No video edits found for ${mediaId}`);
      res.json({ hasEdits: false });
      return;
    }

    console.log(`Loaded video edits for ${mediaId}:`, {
      trimStart: metadata.trimStart,
      trimEnd: metadata.trimEnd,
      textOverlays: metadata.textOverlays?.length || 0,
      aspectRatio: metadata.aspectRatio,
    });

    res.json({
      hasEdits: true,
      mediaId: metadata.mediaId,
      trimStart: metadata.trimStart ?? 0,
      trimEnd: metadata.trimEnd ?? 0,
      speed: metadata.speed ?? 1,
      muted: metadata.muted ?? false,
      volume: metadata.volume ?? 1,
      textOverlays: metadata.textOverlays ?? [],
      aspectRatio: metadata.aspectRatio ?? null,
      editedAt: metadata.editedAt,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/edits/:projectId/video/:mediaId - Remove video edits
router.delete("/:projectId/video/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const projectDir = await getProjectDir(projectId);
    const editsDir = path.join(projectDir, "media", "edits");

    try {
      await fs.unlink(path.join(editsDir, `video-${mediaId}.json`));
    } catch (e) {
      // Ignore if doesn't exist
    }

    // Update media index
    const index = await getMediaIndex(projectId);
    const mediaIndex = index.media.findIndex((m) => m.id === mediaId);
    if (mediaIndex !== -1) {
      delete index.media[mediaIndex].hasVideoEdits;
      await writeMediaIndex(projectId, index);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================
// COLLAGE ENDPOINTS
// ============================================

// POST /api/edits/:projectId/collage - Save collage as new media item
router.post("/:projectId/collage", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { dataUrl, layout, config } = req.body;

    if (!dataUrl) {
      throw new ValidationError("dataUrl is required");
    }

    const projectDir = await getProjectDir(projectId);
    const originalsDir = path.join(projectDir, "media", "originals");
    const thumbnailsDir = path.join(projectDir, "media", "thumbnails");
    await fs.mkdir(originalsDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Generate new media ID
    const mediaId = uuidv4();

    // Parse and save the collage image
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new ValidationError("Invalid dataUrl format");
    }

    const imageBuffer = Buffer.from(matches[2], "base64");
    const filename = `${mediaId}.png`;
    const originalPath = path.join(originalsDir, filename);

    // Save the original collage
    await fs.writeFile(originalPath, imageBuffer);
    console.log(`Saved collage: ${originalPath}`);

    // Generate thumbnail
    const thumbnailFilename = `${mediaId}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    await sharp(imageBuffer)
      .resize(400, 400, { fit: "cover", position: "center" })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    console.log(`Generated thumbnail: ${thumbnailPath}`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();

    // Create media item
    const mediaItem = {
      id: mediaId,
      projectId,
      type: "image",
      filename: `Collage ${new Date().toLocaleDateString()}`,
      originalPath: `${projectId}/media/originals/${filename}`,
      thumbnailPath: `${projectId}/media/thumbnails/${thumbnailFilename}`,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        layout: layout || "unknown",
      },
      collageConfig: config || {},
      userMetadata: {
        showDate: false,
        showTime: false,
        showLocation: false,
        customCaption: "",
      },
      uploadedAt: new Date().toISOString(),
    };

    // Add to media index
    const index = await getMediaIndex(projectId);
    index.media.push(mediaItem);
    await writeMediaIndex(projectId, index);

    res.status(201).json({
      success: true,
      media: mediaItem,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// VIDEO STITCH ENDPOINTS
// ============================================

// Helper to get video duration using ffprobe
async function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      filePath,
    ]);

    let stdout = "";
    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        resolve(parseFloat(stdout.trim()) || 0);
      } else {
        resolve(0);
      }
    });

    ffprobe.on("error", () => {
      resolve(0);
    });
  });
}

// Check if a video file has an audio stream
async function hasAudioStream(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      filePath,
    ]);

    let stdout = "";
    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.on("close", () => {
      // If there's any output, there's an audio stream
      resolve(stdout.trim().length > 0);
    });

    ffprobe.on("error", () => {
      resolve(false);
    });
  });
}

// Stitch multiple video clips together using FFmpeg filter_complex
async function stitchVideosWithFFmpeg(
  clips,
  destPath,
  transition,
  transitionDuration,
) {
  // First, check which clips have audio
  for (const clip of clips) {
    clip.hasAudio = await hasAudioStream(clip.sourcePath);
    console.log(`Clip ${clip.mediaId}: hasAudio=${clip.hasAudio}`);
  }

  return new Promise((resolve, reject) => {
    const inputArgs = [];
    const filterParts = [];

    // Build input arguments for each clip
    clips.forEach((clip) => {
      inputArgs.push("-i", clip.sourcePath);
    });

    // Target dimensions for output (1080x1920 portrait for social media)
    const targetWidth = 1080;
    const targetHeight = 1920;

    // Build filter for each clip
    clips.forEach((clip, i) => {
      // Calculate duration for this clip
      const duration = clip.trimEnd - clip.trimStart;

      // Video filter with trim, scale to fit, and pad to exact target dimensions
      // This ensures all clips have identical dimensions for concat or xfade
      // fps=30 and settb=AVTB ensure consistent frame rate and timebase for xfade compatibility
      filterParts.push(
        `[${i}:v]trim=start=${clip.trimStart}:duration=${duration},setpts=PTS-STARTPTS,scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(${targetWidth}-iw)/2:(${targetHeight}-ih)/2:black,setsar=1,fps=30,settb=AVTB[v${i}]`,
      );

      // Audio filter - use actual audio if present, otherwise generate silence
      // This ensures all audio streams have consistent format for concat
      if (clip.hasAudio) {
        filterParts.push(
          `[${i}:a]atrim=start=${clip.trimStart}:duration=${duration},asetpts=PTS-STARTPTS[a${i}]`,
        );
      } else {
        // Generate silent audio for clips without audio streams
        filterParts.push(
          `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${duration}[a${i}]`,
        );
      }
    });

    // Apply transitions to video, keep audio simple with concat
    if (transition && clips.length > 1) {
      // Use xfade transitions for video
      const effectiveTransitionDuration = Math.min(
        transitionDuration || 1,
        clips.reduce((min, clip) => Math.min(min, clip.duration), Infinity) -
          0.5,
      );

      console.log(
        `Applying transition: ${transition}, duration: ${effectiveTransitionDuration}s`,
      );

      // Chain xfade filters for video
      let currentLabel = `v0`;
      let currentOffset = clips[0].duration - effectiveTransitionDuration;

      for (let i = 1; i < clips.length; i++) {
        const nextLabel = `v${i}`;
        const outputLabel = i === clips.length - 1 ? "outv" : `xf${i}`;
        const offset = Math.max(0, currentOffset);

        filterParts.push(
          `[${currentLabel}][${nextLabel}]xfade=transition=${transition}:duration=${effectiveTransitionDuration.toFixed(2)}:offset=${offset.toFixed(2)}[${outputLabel}]`,
        );

        currentLabel = outputLabel;
        if (i < clips.length - 1) {
          currentOffset =
            currentOffset + clips[i].duration - effectiveTransitionDuration;
        }
      }

      // Concat audio separately (no transitions)
      // v=0 specifies no video streams, a=1 specifies one audio stream
      const audioInputs = clips.map((_, i) => `[a${i}]`).join("");
      filterParts.push(`${audioInputs}concat=n=${clips.length}:v=0:a=1[outa]`);
    } else {
      // No transitions - use simple concat for both video and audio
      const concatInputs = clips.map((_, i) => `[v${i}][a${i}]`).join("");
      filterParts.push(
        `${concatInputs}concat=n=${clips.length}:v=1:a=1[outv][outa]`,
      );
    }

    const args = [
      ...inputArgs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-y",
      destPath,
    ];

    console.log(`FFmpeg stitch command: ffmpeg ${args.join(" ")}`);

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(`FFmpeg stitched videos successfully: ${destPath}`);
        resolve();
      } else {
        console.error(`FFmpeg stitch failed with code ${code}:`, stderr);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("FFmpeg spawn error:", err);
      reject(err);
    });
  });
}

// POST /api/edits/:projectId/stitch - Stitch multiple video clips together
router.post("/:projectId/stitch", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { clips, transition, transitionDuration } = req.body;

    if (!clips || !Array.isArray(clips) || clips.length < 2) {
      throw new ValidationError("At least 2 clips are required for stitching");
    }

    const projectDir = await getProjectDir(projectId);
    const originalsDir = path.join(projectDir, "media", "originals");
    const thumbnailsDir = path.join(projectDir, "media", "thumbnails");
    await fs.mkdir(originalsDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Get media index to resolve media IDs to file paths
    const index = await getMediaIndex(projectId);

    // Build clip info with source paths and durations
    const clipInfos = [];
    let totalDuration = 0;

    for (const clip of clips) {
      const media = index.media.find((m) => m.id === clip.mediaId);
      if (!media) {
        throw new ValidationError(`Media not found: ${clip.mediaId}`);
      }
      if (media.type !== "video") {
        throw new ValidationError(`Media ${clip.mediaId} is not a video`);
      }

      const sourcePath = path.join(PROJECTS_DIR, media.originalPath);

      // Get video duration if not provided
      let videoDuration = media.metadata?.duration || 0;
      if (!videoDuration) {
        videoDuration = await getVideoDuration(sourcePath);
      }

      // Default trimEnd to video duration if not specified
      const trimStart = clip.trimStart || 0;
      const trimEnd = clip.trimEnd || videoDuration;
      const clipDuration = trimEnd - trimStart;

      clipInfos.push({
        mediaId: clip.mediaId,
        sourcePath,
        trimStart,
        trimEnd,
        duration: clipDuration,
      });

      totalDuration += clipDuration;
    }

    // Generate new media ID and output path
    const mediaId = uuidv4();
    const filename = `stitched-${mediaId}.mp4`;
    const outputPath = path.join(originalsDir, filename);

    // Stitch the videos
    console.log(
      `Stitching ${clipInfos.length} clips into ${filename} (total duration: ${totalDuration}s)`,
    );
    await stitchVideosWithFFmpeg(
      clipInfos,
      outputPath,
      transition,
      transitionDuration,
    );

    // Generate thumbnail from the stitched video
    const thumbnailFilename = `${mediaId}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    await getVideoThumbnail(outputPath, thumbnailPath, 1);

    // Create media item
    const mediaItem = {
      id: mediaId,
      projectId,
      type: "video",
      filename,
      originalPath: `${projectId}/media/originals/${filename}`,
      thumbnailPath: `${projectId}/media/thumbnails/${thumbnailFilename}`,
      metadata: {
        width: 1080,
        height: 1920, // Will be adjusted based on source aspect ratios
        duration: totalDuration,
        isStitched: true,
        sourceClips: clipInfos.map((c) => ({
          mediaId: c.mediaId,
          trimStart: c.trimStart,
          trimEnd: c.trimEnd,
        })),
      },
      userMetadata: {
        showDate: false,
        showTime: false,
        showLocation: false,
        customCaption: "",
      },
      uploadedAt: new Date().toISOString(),
    };

    // Add to media index
    index.media.push(mediaItem);
    await writeMediaIndex(projectId, index);

    console.log(`Created stitched video: ${mediaId}`);

    res.status(201).json({
      success: true,
      media: mediaItem,
    });
  } catch (error) {
    next(error);
  }
});

// Create slideshow video from photos using FFmpeg xfade transitions
async function createSlideshowWithFFmpeg(
  photos,
  transition,
  transitionDuration,
  destPath,
  aspectRatio = { width: 9, height: 16 },
) {
  return new Promise((resolve, reject) => {
    // Build FFmpeg command for slideshow with transitions
    // Using xfade filter for transitions between photos

    const inputArgs = [];
    const filterParts = [];

    // Ensure transition doesn't exceed photo duration (minimum 0.5s visible time per photo)
    const minPhotoDuration = Math.min(...photos.map((p) => p.duration));
    const effectiveTransitionDuration = Math.min(
      transitionDuration,
      minPhotoDuration - 0.5,
    );

    // Calculate the total expected video duration using effective transition
    // Total = sum of all durations - (number of transitions * transition duration)
    const totalDuration =
      photos.reduce((sum, p) => sum + p.duration, 0) -
      (photos.length - 1) * effectiveTransitionDuration;

    // Add each photo as input with loop
    // Each input needs to last long enough for the entire video
    // Using total duration for all inputs ensures FFmpeg has frames throughout
    photos.forEach((photo) => {
      inputArgs.push(
        "-loop",
        "1",
        "-t",
        totalDuration.toFixed(2),
        "-i",
        photo.sourcePath,
      );
    });

    // Build filter_complex for transitions
    // Calculate output dimensions based on aspect ratio
    // Use 1080 as base width for portrait, 1920 for landscape
    let width, height;
    if (aspectRatio.height > aspectRatio.width) {
      // Portrait (e.g., 9:16, 4:5)
      width = 1080;
      height = Math.round((1080 * aspectRatio.height) / aspectRatio.width);
    } else if (aspectRatio.width > aspectRatio.height) {
      // Landscape (e.g., 16:9, 1.91:1)
      height = 1080;
      width = Math.round((1080 * aspectRatio.width) / aspectRatio.height);
    } else {
      // Square (1:1)
      width = 1080;
      height = 1080;
    }
    console.log(
      `Slideshow dimensions: ${width}x${height} (aspect ${aspectRatio.width}:${aspectRatio.height})`,
    );

    photos.forEach((_, i) => {
      // Scale to cover entire frame and crop to exact dimensions (no black bars)
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=30[v${i}]`,
      );
    });

    if (photos.length === 2) {
      // Simple case: just one transition
      const offset = Math.max(
        0,
        photos[0].duration - effectiveTransitionDuration,
      );
      filterParts.push(
        `[v0][v1]xfade=transition=${transition}:duration=${effectiveTransitionDuration.toFixed(2)}:offset=${offset.toFixed(2)}[outv]`,
      );
    } else {
      // Multiple photos: chain xfade transitions
      let currentLabel = "v0";
      let currentOffset = Math.max(
        0,
        photos[0].duration - effectiveTransitionDuration,
      );

      for (let i = 1; i < photos.length; i++) {
        const nextLabel = `v${i}`;
        const outputLabel = i === photos.length - 1 ? "outv" : `xf${i}`;

        filterParts.push(
          `[${currentLabel}][${nextLabel}]xfade=transition=${transition}:duration=${effectiveTransitionDuration.toFixed(2)}:offset=${currentOffset.toFixed(2)}[${outputLabel}]`,
        );

        currentLabel = outputLabel;
        if (i < photos.length - 1) {
          // Accumulate offset: previous offset + next clip duration - transition overlap
          currentOffset =
            currentOffset + photos[i].duration - effectiveTransitionDuration;
        }
      }
    }

    console.log(
      `Slideshow params: effectiveTransition=${effectiveTransitionDuration.toFixed(2)}s, totalDuration=${totalDuration.toFixed(2)}s`,
    );

    const filterComplex = filterParts.join(";");

    const args = [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-t",
      totalDuration.toFixed(2), // Limit output duration to prevent extended last slide
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-y",
      destPath,
    ];

    console.log(`FFmpeg slideshow command: ffmpeg ${args.join(" ")}`);

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(`FFmpeg created slideshow successfully: ${destPath}`);
        resolve({ width, height });
      } else {
        console.error(`FFmpeg slideshow failed with code ${code}:`, stderr);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("FFmpeg spawn error:", err);
      reject(err);
    });
  });
}

// POST /api/edits/:projectId/slideshow - Create slideshow video from photos
router.post("/:projectId/slideshow", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { photos, transition, transitionDuration, aspectRatio } = req.body;

    if (!photos || !Array.isArray(photos) || photos.length < 2) {
      throw new ValidationError(
        "At least 2 photos are required for a slideshow",
      );
    }

    const projectDir = await getProjectDir(projectId);
    const originalsDir = path.join(projectDir, "media", "originals");
    const thumbnailsDir = path.join(projectDir, "media", "thumbnails");

    // Ensure directories exist
    await fs.mkdir(originalsDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Load media index
    const index = await getMediaIndex(projectId);

    // Prepare photo info
    const photoInfos = [];
    let totalDuration = 0;

    for (const photo of photos) {
      const mediaItem = index.media.find((m) => m.id === photo.mediaId);
      if (!mediaItem) {
        throw new ValidationError(`Media not found: ${photo.mediaId}`);
      }
      if (mediaItem.type !== "image") {
        throw new ValidationError(`Media ${photo.mediaId} is not an image`);
      }

      // Use original path if useOriginal is true, otherwise use processed if available
      // Note: paths in index already include projectId prefix, so use PROJECTS_DIR as base
      let imagePath;
      if (photo.useOriginal) {
        imagePath = mediaItem.originalPath;
      } else {
        imagePath = mediaItem.processedPath || mediaItem.originalPath;
      }
      const sourcePath = path.join(PROJECTS_DIR, imagePath);

      photoInfos.push({
        mediaId: photo.mediaId,
        sourcePath,
        duration: photo.duration || 4,
      });

      totalDuration += photo.duration || 4;
    }

    // Subtract overlapping transition time from total
    totalDuration -= (photos.length - 1) * (transitionDuration || 1);

    // Generate new media ID and output path
    const mediaId = uuidv4();
    const filename = `slideshow-${mediaId}.mp4`;
    const outputPath = path.join(originalsDir, filename);

    // Create the slideshow with aspect ratio
    const outputAspect = aspectRatio || { width: 9, height: 16 };
    console.log(
      `Creating slideshow with ${photoInfos.length} photos (transition: ${transition}, duration: ${totalDuration}s, aspect: ${outputAspect.width}:${outputAspect.height})`,
    );
    const { width, height } = await createSlideshowWithFFmpeg(
      photoInfos,
      transition || "fade",
      transitionDuration || 1,
      outputPath,
      outputAspect,
    );

    // Generate thumbnail from the slideshow video
    const thumbnailFilename = `${mediaId}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    await getVideoThumbnail(outputPath, thumbnailPath, 1);

    // Create media item
    const mediaItem = {
      id: mediaId,
      projectId,
      type: "video",
      filename: `slideshow-${new Date().toISOString().slice(0, 10)}.mp4`,
      originalPath: `${projectId}/media/originals/${filename}`,
      thumbnailPath: `${projectId}/media/thumbnails/${thumbnailFilename}`,
      metadata: {
        width,
        height,
        duration: totalDuration,
        slideshow: {
          photoCount: photos.length,
          transition,
          transitionDuration,
        },
      },
      userMetadata: {
        showDate: false,
        showTime: false,
        showLocation: false,
        customCaption: "",
      },
      uploadedAt: new Date().toISOString(),
    };

    // Add to media index
    index.media.push(mediaItem);
    await writeMediaIndex(projectId, index);

    console.log(`Created slideshow video: ${mediaId}`);

    res.status(201).json({
      success: true,
      media: mediaItem,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
