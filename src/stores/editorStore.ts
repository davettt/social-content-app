import { create } from "zustand";
import type { Media, MediaEdits, TextOverlay, GraphicOverlay } from "../types";

interface EditorState {
  selectedMedia: Media | null;
  edits: MediaEdits;
  activeTextOverlay: string | null;
  activeGraphicOverlay: string | null;
  isEditing: boolean;

  setSelectedMedia: (media: Media | null) => void;
  updateEdits: (edits: Partial<MediaEdits>) => void;
  addTextOverlay: (overlay: TextOverlay) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: string) => void;
  setActiveTextOverlay: (id: string | null) => void;
  addGraphicOverlay: (overlay: GraphicOverlay) => void;
  updateGraphicOverlay: (id: string, updates: Partial<GraphicOverlay>) => void;
  removeGraphicOverlay: (id: string) => void;
  setActiveGraphicOverlay: (id: string | null) => void;
  resetEdits: () => void;
  setIsEditing: (isEditing: boolean) => void;
}

const defaultEdits: MediaEdits = {
  adjustments: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  },
  textOverlays: [],
  graphicOverlays: [],
};

export const useEditorStore = create<EditorState>((set) => ({
  selectedMedia: null,
  edits: defaultEdits,
  activeTextOverlay: null,
  activeGraphicOverlay: null,
  isEditing: false,

  setSelectedMedia: (media) =>
    set({ selectedMedia: media, edits: defaultEdits }),

  updateEdits: (updates) =>
    set((state) => ({
      edits: { ...state.edits, ...updates },
    })),

  addTextOverlay: (overlay) =>
    set((state) => ({
      edits: {
        ...state.edits,
        textOverlays: [...(state.edits.textOverlays || []), overlay],
      },
      activeTextOverlay: overlay.id,
    })),

  updateTextOverlay: (id, updates) =>
    set((state) => ({
      edits: {
        ...state.edits,
        textOverlays: (state.edits.textOverlays || []).map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      },
    })),

  removeTextOverlay: (id) =>
    set((state) => ({
      edits: {
        ...state.edits,
        textOverlays: (state.edits.textOverlays || []).filter(
          (t) => t.id !== id,
        ),
      },
      activeTextOverlay:
        state.activeTextOverlay === id ? null : state.activeTextOverlay,
    })),

  setActiveTextOverlay: (id) => set({ activeTextOverlay: id }),

  addGraphicOverlay: (overlay) =>
    set((state) => ({
      edits: {
        ...state.edits,
        graphicOverlays: [...(state.edits.graphicOverlays || []), overlay],
      },
      activeGraphicOverlay: overlay.id,
    })),

  updateGraphicOverlay: (id, updates) =>
    set((state) => ({
      edits: {
        ...state.edits,
        graphicOverlays: (state.edits.graphicOverlays || []).map((g) =>
          g.id === id ? { ...g, ...updates } : g,
        ),
      },
    })),

  removeGraphicOverlay: (id) =>
    set((state) => ({
      edits: {
        ...state.edits,
        graphicOverlays: (state.edits.graphicOverlays || []).filter(
          (g) => g.id !== id,
        ),
      },
      activeGraphicOverlay:
        state.activeGraphicOverlay === id ? null : state.activeGraphicOverlay,
    })),

  setActiveGraphicOverlay: (id) => set({ activeGraphicOverlay: id }),

  resetEdits: () =>
    set({
      edits: defaultEdits,
      activeTextOverlay: null,
      activeGraphicOverlay: null,
    }),

  setIsEditing: (isEditing) => set({ isEditing }),
}));
