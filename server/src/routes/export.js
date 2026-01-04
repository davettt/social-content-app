import express from "express";
import path from "path";
import fs from "fs/promises";
import archiver from "archiver";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
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

        // Skip videos for now (Sharp doesn't handle video)
        if (media.type === "video") {
          // Just copy video files as-is
          try {
            const sourcePath = path.join(PROJECTS_DIR, media.originalPath);
            const destPath = path.join(platformDir, media.filename);
            await fs.copyFile(sourcePath, destPath);
            console.log(`Copied video ${media.filename} to ${platformName}`);
          } catch (e) {
            console.warn(`Could not copy video ${media.filename}:`, e.message);
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
