import { create } from "zustand";
import type {
  Platform,
  PostMedia,
  CaptionSuggestion,
  ViralityScore,
  ImageAdjustments,
  TextOverlay,
} from "../types";

export interface EditedImageData {
  dataUrl: string;
  adjustments?: ImageAdjustments;
  textOverlays?: TextOverlay[];
}

export interface GeneratedImage {
  dataUrl: string;
  type: "collage" | "template";
}

interface ComposerState {
  selectedMediaIds: string[];
  postMedia: PostMedia[];
  caption: string;
  hashtags: string[];
  platforms: Platform[];
  captionSuggestions: CaptionSuggestion[];
  viralityScore: ViralityScore | null;
  editedImages: Record<string, EditedImageData>; // mediaId -> edited image data
  generatedImages: GeneratedImage[]; // collages and template images
  isDirty: boolean;

  addMedia: (mediaId: string) => void;
  removeMedia: (mediaId: string) => void;
  reorderMedia: (fromIndex: number, toIndex: number) => void;
  setCaption: (caption: string) => void;
  setHashtags: (hashtags: string[]) => void;
  addHashtag: (hashtag: string) => void;
  removeHashtag: (hashtag: string) => void;
  togglePlatform: (platform: Platform) => void;
  setCaptionSuggestions: (suggestions: CaptionSuggestion[]) => void;
  setViralityScore: (score: ViralityScore | null) => void;
  setEditedImage: (mediaId: string, data: EditedImageData) => void;
  removeEditedImage: (mediaId: string) => void;
  getEditedImage: (mediaId: string) => EditedImageData | undefined;
  addGeneratedImage: (dataUrl: string, type: "collage" | "template") => void;
  removeGeneratedImage: (index: number) => void;
  reset: () => void;
}

const defaultState = {
  selectedMediaIds: [],
  postMedia: [],
  caption: "",
  hashtags: [],
  platforms: ["instagram", "threads", "twitter"] as Platform[],
  captionSuggestions: [],
  viralityScore: null,
  editedImages: {} as Record<string, EditedImageData>,
  generatedImages: [] as GeneratedImage[],
  isDirty: false,
};

export const useComposerStore = create<ComposerState>((set) => ({
  ...defaultState,

  addMedia: (mediaId) =>
    set((state) => {
      if (state.selectedMediaIds.includes(mediaId)) return state;
      const newMediaIds = [...state.selectedMediaIds, mediaId];
      const newPostMedia = [
        ...state.postMedia,
        { mediaId, order: state.postMedia.length },
      ];
      return {
        selectedMediaIds: newMediaIds,
        postMedia: newPostMedia,
        isDirty: true,
      };
    }),

  removeMedia: (mediaId) =>
    set((state) => {
      // Also clear any edits for this media
      const { [mediaId]: _removed, ...remainingEdits } = state.editedImages;
      void _removed;
      return {
        selectedMediaIds: state.selectedMediaIds.filter((id) => id !== mediaId),
        postMedia: state.postMedia
          .filter((m) => m.mediaId !== mediaId)
          .map((m, i) => ({ ...m, order: i })),
        editedImages: remainingEdits,
        isDirty: true,
      };
    }),

  reorderMedia: (fromIndex, toIndex) =>
    set((state) => {
      const newMedia = [...state.postMedia];
      const [moved] = newMedia.splice(fromIndex, 1);
      if (moved) {
        newMedia.splice(toIndex, 0, moved);
      }
      return {
        postMedia: newMedia.map((m, i) => ({ ...m, order: i })),
        selectedMediaIds: newMedia.map((m) => m.mediaId),
        isDirty: true,
      };
    }),

  setCaption: (caption) => set({ caption, isDirty: true }),

  setHashtags: (hashtags) => set({ hashtags, isDirty: true }),

  addHashtag: (hashtag) =>
    set((state) => {
      const clean = hashtag.replace(/^#/, "").trim();
      if (!clean || state.hashtags.includes(clean)) return state;
      return { hashtags: [...state.hashtags, clean], isDirty: true };
    }),

  removeHashtag: (hashtag) =>
    set((state) => ({
      hashtags: state.hashtags.filter((h) => h !== hashtag),
      isDirty: true,
    })),

  togglePlatform: (platform) =>
    set((state) => ({
      platforms: state.platforms.includes(platform)
        ? state.platforms.filter((p) => p !== platform)
        : [...state.platforms, platform],
      isDirty: true,
    })),

  setCaptionSuggestions: (suggestions) =>
    set({ captionSuggestions: suggestions }),

  setViralityScore: (score) => set({ viralityScore: score }),

  setEditedImage: (mediaId, data) =>
    set((state) => ({
      editedImages: { ...state.editedImages, [mediaId]: data },
      isDirty: true,
    })),

  getEditedImage: (mediaId): EditedImageData | undefined => {
    return useComposerStore.getState().editedImages[mediaId];
  },

  removeEditedImage: (mediaId) =>
    set((state) => {
      const { [mediaId]: _removed, ...rest } = state.editedImages;
      void _removed; // Explicitly mark as intentionally unused
      return { editedImages: rest, isDirty: true };
    }),

  addGeneratedImage: (dataUrl, type) =>
    set((state) => ({
      generatedImages: [...state.generatedImages, { dataUrl, type }],
      isDirty: true,
    })),

  removeGeneratedImage: (index) =>
    set((state) => ({
      generatedImages: state.generatedImages.filter((_, i) => i !== index),
      isDirty: true,
    })),

  reset: () => set(defaultState),
}));
