import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import ExifParser from "exif-parser";
import sharp from "sharp";

const execAsync = promisify(exec);

/**
 * Reverse geocode coordinates to a place name using OpenStreetMap Nominatim
 * Falls back gracefully if the service is unavailable
 */
async function reverseGeocode(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "SocialContentApp/1.0 (local development)",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      console.warn("Reverse geocoding failed:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.warn("Reverse geocoding error:", data.error);
      return null;
    }

    // Build a readable place name from the address components
    const addr = data.address || {};
    const parts = [];

    // Try to get the most specific useful name
    const specificPlace =
      addr.tourism ||
      addr.amenity ||
      addr.building ||
      addr.historic ||
      addr.leisure ||
      addr.shop;
    if (specificPlace) {
      parts.push(specificPlace);
    }

    // Add neighborhood/suburb or village/town
    const locality =
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city_district;
    if (locality) {
      parts.push(locality);
    }

    // Add city
    if (addr.city || addr.municipality) {
      parts.push(addr.city || addr.municipality);
    }

    // Add state/region for context (especially useful internationally)
    if (addr.state || addr.region) {
      parts.push(addr.state || addr.region);
    }

    // Add country
    if (addr.country) {
      parts.push(addr.country);
    }

    // If we got parts, join them; otherwise use display_name
    if (parts.length > 0) {
      // Limit to 3-4 most relevant parts to keep it concise
      return parts.slice(0, 4).join(", ");
    }

    // Fallback to the full display name (truncated if too long)
    if (data.display_name) {
      const displayParts = data.display_name.split(", ");
      return displayParts.slice(0, 4).join(", ");
    }

    return null;
  } catch (error) {
    console.warn("Reverse geocoding error:", error.message);
    return null;
  }
}

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
            const latitude = exifData.tags.GPSLatitude;
            const longitude = exifData.tags.GPSLongitude;

            console.log(
              `[Metadata] Found GPS coordinates: ${latitude}, ${longitude}`,
            );

            // Try to get a place name via reverse geocoding
            const placeName = await reverseGeocode(latitude, longitude);
            console.log(`[Metadata] Reverse geocoded place name: ${placeName}`);

            metadata.location = {
              latitude,
              longitude,
              placeName,
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
