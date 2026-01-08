import express from "express";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import {
  getProjectDir,
  readJsonFile,
  writeJsonFile,
  PROJECTS_DIR,
} from "../utils/storage.js";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.js";

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
    const { dataUrl, adjustments, textOverlays } = req.body;

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
        editedAt: metadata.editedAt,
      });
    } catch (e) {
      // Processed image doesn't exist, return just metadata
      res.json({
        hasEdits: true,
        adjustments: metadata.adjustments,
        textOverlays: metadata.textOverlays,
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
      trimEnd: trimEnd ?? null,
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
      res.json({ hasEdits: false });
      return;
    }

    res.json({
      hasEdits: true,
      ...metadata,
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
      type: "collage",
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

export default router;
