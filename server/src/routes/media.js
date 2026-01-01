import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import {
  getProjectDir,
  readJsonFile,
  writeJsonFile,
} from "../utils/storage.js";
import {
  extractMetadata,
  getVideoThumbnail,
} from "../services/metadataExtractor.js";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { projectId } = req.params;
    const projectDir = await getProjectDir(projectId);
    const uploadDir = path.join(projectDir, "media", "originals");
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Helper to get media index file path
async function getMediaIndexPath(projectId) {
  const projectDir = await getProjectDir(projectId);
  return path.join(projectDir, "media", "index.json");
}

// Helper to read media index
async function readMediaIndex(projectId) {
  const indexPath = await getMediaIndexPath(projectId);
  const data = await readJsonFile(indexPath);
  return data || { media: [] };
}

// Helper to write media index
async function writeMediaIndex(projectId, data) {
  const indexPath = await getMediaIndexPath(projectId);
  await writeJsonFile(indexPath, data);
}

// Generate thumbnail for image
async function generateThumbnail(sourcePath, destPath) {
  await sharp(sourcePath)
    .resize(400, 400, { fit: "cover", position: "center" })
    .jpeg({ quality: 80 })
    .toFile(destPath);
}

// GET /api/media/:projectId - List all media for a project
router.get("/:projectId", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { type, search } = req.query;

    const index = await readMediaIndex(projectId);
    let media = index.media || [];

    // Filter by type if specified
    if (type && (type === "image" || type === "video")) {
      media = media.filter((m) => m.type === type);
    }

    // Search by filename or custom caption
    if (search) {
      const searchLower = search.toLowerCase();
      media = media.filter(
        (m) =>
          m.filename.toLowerCase().includes(searchLower) ||
          m.userMetadata?.customCaption?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by uploadedAt descending
    media.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    res.json(media);
  } catch (error) {
    next(error);
  }
});

// POST /api/media/:projectId - Upload media files
router.post(
  "/:projectId",
  upload.array("files", 20),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const files = req.files;

      if (!files || files.length === 0) {
        throw new ValidationError("No files uploaded");
      }

      const projectDir = await getProjectDir(projectId);
      const index = await readMediaIndex(projectId);
      const results = [];

      for (const file of files) {
        const id = path.basename(file.filename, path.extname(file.filename));
        const isVideo = file.mimetype.startsWith("video/");
        const type = isVideo ? "video" : "image";

        // Extract metadata
        const metadata = await extractMetadata(file.path, type);

        // Generate thumbnail
        const thumbnailFilename = `${id}.jpg`;
        const thumbnailPath = path.join(
          projectDir,
          "media",
          "thumbnails",
          thumbnailFilename,
        );

        if (isVideo) {
          // Generate video thumbnail using ffmpeg
          await getVideoThumbnail(file.path, thumbnailPath);
        } else {
          await generateThumbnail(file.path, thumbnailPath, type);
        }

        const mediaItem = {
          id,
          projectId,
          type,
          filename: file.originalname,
          originalPath: `${projectId}/media/originals/${file.filename}`,
          thumbnailPath: `${projectId}/media/thumbnails/${thumbnailFilename}`,
          metadata,
          userMetadata: {
            showDate: true,
            showTime: true,
            showLocation: false,
            customCaption: "",
          },
          uploadedAt: new Date().toISOString(),
        };

        index.media.push(mediaItem);
        results.push({ media: mediaItem, success: true });
      }

      await writeMediaIndex(projectId, index);

      res.status(201).json(results);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/media/:projectId/:mediaId - Get a specific media item
router.get("/:projectId/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const index = await readMediaIndex(projectId);
    const media = index.media.find((m) => m.id === mediaId);

    if (!media) {
      throw new NotFoundError(`Media not found: ${mediaId}`);
    }

    res.json(media);
  } catch (error) {
    next(error);
  }
});

// PUT /api/media/:projectId/:mediaId - Update media metadata
router.put("/:projectId/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const { userMetadata } = req.body;

    const index = await readMediaIndex(projectId);
    const mediaIndex = index.media.findIndex((m) => m.id === mediaId);

    if (mediaIndex === -1) {
      throw new NotFoundError(`Media not found: ${mediaId}`);
    }

    index.media[mediaIndex] = {
      ...index.media[mediaIndex],
      userMetadata: {
        ...index.media[mediaIndex].userMetadata,
        ...userMetadata,
      },
    };

    await writeMediaIndex(projectId, index);

    res.json(index.media[mediaIndex]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/media/:projectId/:mediaId - Delete a media item
router.delete("/:projectId/:mediaId", async (req, res, next) => {
  try {
    const { projectId, mediaId } = req.params;
    const projectDir = await getProjectDir(projectId);
    const index = await readMediaIndex(projectId);
    const mediaItem = index.media.find((m) => m.id === mediaId);

    if (!mediaItem) {
      throw new NotFoundError(`Media not found: ${mediaId}`);
    }

    // Delete files
    const originalPath = path.join(
      projectDir,
      "..",
      "..",
      "local_data",
      "projects",
      mediaItem.originalPath,
    );
    const thumbnailPath = path.join(
      projectDir,
      "..",
      "..",
      "local_data",
      "projects",
      mediaItem.thumbnailPath,
    );

    try {
      await fs.unlink(
        path.join(
          projectDir,
          "media",
          "originals",
          path.basename(mediaItem.originalPath),
        ),
      );
    } catch (e) {
      console.warn("Could not delete original file:", e.message);
    }

    try {
      await fs.unlink(
        path.join(
          projectDir,
          "media",
          "thumbnails",
          path.basename(mediaItem.thumbnailPath),
        ),
      );
    } catch (e) {
      console.warn("Could not delete thumbnail:", e.message);
    }

    // Update index
    index.media = index.media.filter((m) => m.id !== mediaId);
    await writeMediaIndex(projectId, index);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
