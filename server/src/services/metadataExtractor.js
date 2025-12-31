import fs from 'fs/promises';
import ExifParser from 'exif-parser';
import sharp from 'sharp';

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
    if (type === 'image') {
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
              exifData.tags.DateTimeOriginal * 1000
            ).toISOString();
          } else if (exifData.tags.CreateDate) {
            metadata.dateTaken = new Date(
              exifData.tags.CreateDate * 1000
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
          const make = exifData.tags.Make || '';
          const model = exifData.tags.Model || '';
          if (make || model) {
            metadata.camera = `${make} ${model}`.trim();
          }
        }
      } catch (exifError) {
        console.warn('Could not extract EXIF data:', exifError.message);
      }
    } else if (type === 'video') {
      // Video metadata extraction would use FFprobe
      // For now, we'll set basic defaults
      metadata.width = 1920;
      metadata.height = 1080;
      metadata.duration = 0;
    }
  } catch (error) {
    console.error('Error extracting metadata:', error);
  }

  return metadata;
}

export async function getVideoDuration(filePath) {
  // This would use FFprobe in a full implementation
  // For now, return 0
  return 0;
}

export async function getVideoThumbnail(inputPath, outputPath, timestamp = 1) {
  // This would use FFmpeg to extract a frame
  // Will be implemented in Phase 5
  return null;
}
