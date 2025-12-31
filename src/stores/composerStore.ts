import { create } from 'zustand';
import type { Platform, PostMedia, CaptionSuggestion, ViralityScore } from '../types';

interface ComposerState {
  selectedMediaIds: string[];
  postMedia: PostMedia[];
  caption: string;
  hashtags: string[];
  platforms: Platform[];
  captionSuggestions: CaptionSuggestion[];
  viralityScore: ViralityScore | null;
  editedImages: Record<string, string>; // mediaId -> edited dataUrl
  collages: string[]; // standalone collage data URLs
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
  setEditedImage: (mediaId: string, dataUrl: string) => void;
  removeEditedImage: (mediaId: string) => void;
  addCollage: (dataUrl: string) => void;
  removeCollage: (index: number) => void;
  reset: () => void;
}

const defaultState = {
  selectedMediaIds: [],
  postMedia: [],
  caption: '',
  hashtags: [],
  platforms: ['instagram', 'threads', 'twitter'] as Platform[],
  captionSuggestions: [],
  viralityScore: null,
  editedImages: {} as Record<string, string>,
  collages: [] as string[],
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
    set((state) => ({
      selectedMediaIds: state.selectedMediaIds.filter((id) => id !== mediaId),
      postMedia: state.postMedia
        .filter((m) => m.mediaId !== mediaId)
        .map((m, i) => ({ ...m, order: i })),
      isDirty: true,
    })),

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
      const clean = hashtag.replace(/^#/, '').trim();
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

  setCaptionSuggestions: (suggestions) => set({ captionSuggestions: suggestions }),

  setViralityScore: (score) => set({ viralityScore: score }),

  setEditedImage: (mediaId, dataUrl) =>
    set((state) => ({
      editedImages: { ...state.editedImages, [mediaId]: dataUrl },
      isDirty: true,
    })),

  removeEditedImage: (mediaId) =>
    set((state) => {
      const { [mediaId]: _, ...rest } = state.editedImages;
      return { editedImages: rest, isDirty: true };
    }),

  addCollage: (dataUrl) =>
    set((state) => ({
      collages: [...state.collages, dataUrl],
      isDirty: true,
    })),

  removeCollage: (index) =>
    set((state) => ({
      collages: state.collages.filter((_, i) => i !== index),
      isDirty: true,
    })),

  reset: () => set(defaultState),
}));
