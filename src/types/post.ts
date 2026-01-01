import type { Platform } from "./project";

// 3x3 alignment grid positions
export type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// Safe zone margin as percentage (5% from edges)
export const SAFE_ZONE_MARGIN = 0.05;

// Position configuration for alignment grid
export const TEXT_POSITIONS: {
  position: TextPosition;
  label: string;
  horizontalAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
}[] = [
  {
    position: "top-left",
    label: "Top Left",
    horizontalAlign: "left",
    verticalAlign: "top",
  },
  {
    position: "top-center",
    label: "Top Center",
    horizontalAlign: "center",
    verticalAlign: "top",
  },
  {
    position: "top-right",
    label: "Top Right",
    horizontalAlign: "right",
    verticalAlign: "top",
  },
  {
    position: "middle-left",
    label: "Middle Left",
    horizontalAlign: "left",
    verticalAlign: "middle",
  },
  {
    position: "middle-center",
    label: "Center",
    horizontalAlign: "center",
    verticalAlign: "middle",
  },
  {
    position: "middle-right",
    label: "Middle Right",
    horizontalAlign: "right",
    verticalAlign: "middle",
  },
  {
    position: "bottom-left",
    label: "Bottom Left",
    horizontalAlign: "left",
    verticalAlign: "bottom",
  },
  {
    position: "bottom-center",
    label: "Bottom Center",
    horizontalAlign: "center",
    verticalAlign: "bottom",
  },
  {
    position: "bottom-right",
    label: "Bottom Right",
    horizontalAlign: "right",
    verticalAlign: "bottom",
  },
];

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
  /** Preset position from 3x3 grid (if set, x/y are calculated from this) */
  position?: TextPosition;
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
