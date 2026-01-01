import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import ExifParser from "exif-parser";
import sharp from "sharp";

const execAsync = promisify(exec);

export async function extractMetadata(filePath, type) {
  const metadata = {
    width: 0,
    height: 0,
    dateTaken: null,
    location: null,
    camera: null,
    duration: null,
  };

  try {
    if (type === "image") {
      // Get basic image dimensions
      const sharpMeta = await sharp(filePath).metadata();
      metadata.width = sharpMeta.width || 0;
      metadata.height = sharpMeta.height || 0;

      // Try to extract EXIF data
      try {
        const buffer = await fs.readFile(filePath);
        const parser = ExifParser.create(buffer);
        const exifData = parser.parse();

        if (exifData.tags) {
          // Date taken
          if (exifData.tags.DateTimeOriginal) {
            metadata.dateTaken = new Date(
              exifData.tags.DateTimeOriginal * 1000,
            ).toISOString();
          } else if (exifData.tags.CreateDate) {
            metadata.dateTaken = new Date(
              exifData.tags.CreateDate * 1000,
            ).toISOString();
          }

          // Location
          if (exifData.tags.GPSLatitude && exifData.tags.GPSLongitude) {
            metadata.location = {
              latitude: exifData.tags.GPSLatitude,
              longitude: exifData.tags.GPSLongitude,
              placeName: null, // Would need geocoding service
            };
          }

          // Camera info
          const make = exifData.tags.Make || "";
          const model = exifData.tags.Model || "";
          if (make || model) {
            metadata.camera = `${make} ${model}`.trim();
          }
        }
      } catch (exifError) {
        console.warn("Could not extract EXIF data:", exifError.message);
      }
    } else if (type === "video") {
      // Extract video metadata using ffprobe
      try {
        const { stdout } = await execAsync(
          `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        );
        const probeData = JSON.parse(stdout);

        // Find video stream
        const videoStream = probeData.streams?.find(
          (s) => s.codec_type === "video",
        );
        if (videoStream) {
          metadata.width = videoStream.width || 0;
          metadata.height = videoStream.height || 0;
        }

        // Get duration from format
        if (probeData.format?.duration) {
          metadata.duration = parseFloat(probeData.format.duration);
        }
      } catch (ffprobeError) {
        console.warn("Could not extract video metadata:", ffprobeError.message);
        // Fallback defaults
        metadata.width = 1920;
        metadata.height = 1080;
        metadata.duration = 0;
      }
    }
  } catch (error) {
    console.error("Error extracting metadata:", error);
  }

  return metadata;
}

export async function getVideoDuration(filePath) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
    );
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    console.warn("Could not get video duration:", error.message);
    return 0;
  }
}

export async function getVideoThumbnail(inputPath, outputPath, timestamp = 1) {
  try {
    // Extract a frame at the specified timestamp (or 1 second by default)
    // Use -vf scale to ensure reasonable thumbnail size
    await execAsync(
      `ffmpeg -y -ss ${timestamp} -i "${inputPath}" -vframes 1 -vf "scale=400:400:force_original_aspect_ratio=increase,crop=400:400" -q:v 2 "${outputPath}"`,
    );
    return outputPath;
  } catch (error) {
    console.warn("Could not generate video thumbnail:", error.message);
    return null;
  }
}
