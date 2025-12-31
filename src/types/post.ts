import type { Platform } from "./project";

export interface PostMedia {
  mediaId: string;
  order: number;
  edits?: MediaEdits;
}

export interface MediaEdits {
  crop?: CropData;
  adjustments?: ImageAdjustments;
  filter?: string;
  textOverlays?: TextOverlay[];
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: string;
}

export interface ImageAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  opacity: number;
  rotation: number;
  textAlign: "left" | "center" | "right";
  shadow?: boolean;
}

export interface CaptionSuggestion {
  text: string;
  length: "short" | "medium" | "long";
  style: string;
}

export interface ViralityScore {
  score: number; // 0-100
  reasoning: string;
  tips: string[];
}

export interface PlatformContent {
  platform: Platform;
  caption: string;
  hashtags: string[];
  characterCount: number;
  characterLimit: number;
  isValid: boolean;
}

export interface Post {
  id: string;
  projectId: string;
  title: string;
  media: PostMedia[];
  caption: string;
  hashtags: string[];
  platforms: Platform[];
  platformContent: PlatformContent[];
  viralityScore?: ViralityScore;
  templateId?: string;
  status: "draft" | "ready" | "exported";
  createdAt: string;
  updatedAt: string;
}

export type CreatePostInput = Pick<Post, "projectId" | "title"> & {
  media?: PostMedia[];
  caption?: string;
  platforms?: Platform[];
};
