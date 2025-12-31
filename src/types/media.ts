export type MediaType = "image" | "video";

export interface MediaLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface MediaMetadata {
  width: number;
  height: number;
  dateTaken?: string;
  location?: MediaLocation;
  camera?: string;
  duration?: number; // For videos, in seconds
}

export interface UserMediaMetadata {
  showDate: boolean;
  showTime: boolean;
  showLocation: boolean;
  customCaption: string;
}

export interface Media {
  id: string;
  projectId: string;
  type: MediaType;
  filename: string;
  originalPath: string;
  thumbnailPath: string;
  metadata: MediaMetadata;
  userMetadata: UserMediaMetadata;
  uploadedAt: string;
}

export interface MediaUploadResult {
  media: Media;
  success: boolean;
  error?: string;
}
