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
  customLocation?: string; // User-editable location name (overrides auto-detected)
}

export interface Media {
  id: string;
  projectId: string;
  type: MediaType;
  filename: string;
  originalPath: string;
  thumbnailPath: string;
  processedPath?: string; // Path to processed/edited version
  hasEdits?: boolean; // Whether the media has been edited
  source?: "upload" | "generated";
  generationPrompt?: string;
  generationProvider?: string;
  generationModel?: string;
  metadata: MediaMetadata;
  userMetadata: UserMediaMetadata;
  uploadedAt: string;
}

export interface MediaUploadResult {
  media: Media;
  success: boolean;
  error?: string;
}

export interface ImageGenModel {
  id: string;
  name: string;
  description: string;
}

export interface ImageGenProvider {
  id: string;
  name: string;
  requiresKey: string;
  models: ImageGenModel[];
}
