import { useState, useRef, useEffect } from "react";
import { Button } from "../common/Button";
import { AlignmentPicker } from "../common/AlignmentPicker";
import { editsApi } from "../../services/api";
import type { Media, VideoTextOverlay, TextPosition } from "../../types";
import { VideoTextPreview, TIMING_OPTIONS } from "./VideoTextPreview";
import type { VideoTextTiming } from "../../types";

export interface VideoEdits {
  trimStart: number;
  trimEnd: number;
  speed: number;
  muted: boolean;
  volume: number;
  textOverlays?: VideoTextOverlay[];
  /** Target aspect ratio for cropping (width/height) */
  aspectRatio?: { width: number; height: number };
}

// Font options (subset of ImageEditor fonts)
const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Courier", value: "Courier New, monospace" },
];

// Color presets
const COLOR_PRESETS = [
  "#FFFFFF",
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
];

interface VideoEditorProps {
  media: Media;
  projectId: string;
  initialEdits?: VideoEdits;
  /** Target aspect ratio for the video (e.g., 4:5 for Instagram portrait) */
  aspectRatio?: { width: number; height: number; label?: string };
  onSave?: (edits: VideoEdits) => void;
  onClose: () => void;
}

// Base size for the cropped video preview
const VIDEO_PREVIEW_BASE_SIZE = 400;

const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
];

export function VideoEditor({
  media,
  projectId,
  initialEdits,
  aspectRatio = { width: 1, height: 1 },
  onSave,
  onClose,
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const [editsLoaded, setEditsLoaded] = useState(false);

  // Calculate cropped preview dimensions based on aspect ratio
  const targetRatio = aspectRatio.width / aspectRatio.height;
  const croppedWidth =
    targetRatio >= 1
      ? VIDEO_PREVIEW_BASE_SIZE
      : Math.round(VIDEO_PREVIEW_BASE_SIZE * targetRatio);
  const croppedHeight =
    targetRatio >= 1
      ? Math.round(VIDEO_PREVIEW_BASE_SIZE / targetRatio)
      : VIDEO_PREVIEW_BASE_SIZE;

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<VideoTextOverlay[]>(
    initialEdits?.textOverlays ?? [],
  );
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  const [edits, setEdits] = useState<VideoEdits>({
    trimStart: initialEdits?.trimStart ?? 0,
    trimEnd: initialEdits?.trimEnd ?? 0,
    speed: initialEdits?.speed ?? 1,
    muted: initialEdits?.muted ?? false,
    volume: initialEdits?.volume ?? 1,
  });

  // Load saved edits from disk on mount
  useEffect(() => {
    if (editsLoaded || initialEdits) return;

    const loadSavedEdits = async () => {
      try {
        const savedEdits = await editsApi.loadVideoEdit(projectId, media.id);
        if (savedEdits.hasEdits) {
          setEdits({
            trimStart: savedEdits.trimStart ?? 0,
            trimEnd: savedEdits.trimEnd ?? duration,
            speed: savedEdits.speed ?? 1,
            muted: savedEdits.muted ?? false,
            volume: savedEdits.volume ?? 1,
          });
          // Load text overlays if present
          if (savedEdits.textOverlays && savedEdits.textOverlays.length > 0) {
            setTextOverlays(savedEdits.textOverlays as VideoTextOverlay[]);
          }
        }
      } catch {
        // No saved edits
      }
      setEditsLoaded(true);
    };

    loadSavedEdits();
  }, [projectId, media.id, initialEdits, editsLoaded, duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Only set trimEnd if not already set from saved edits
      if (edits.trimEnd === 0) {
        setEdits((prev) => ({ ...prev, trimEnd: video.duration }));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Loop within trim range
      if (video.currentTime >= edits.trimEnd) {
        video.currentTime = edits.trimStart;
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [edits.trimStart, edits.trimEnd]);

  // Apply speed changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = edits.speed;
    }
  }, [edits.speed]);

  // Apply volume/mute changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = edits.muted;
      video.volume = edits.volume;
    }
  }, [edits.muted, edits.volume]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      if (
        video.currentTime < edits.trimStart ||
        video.currentTime >= edits.trimEnd
      ) {
        video.currentTime = edits.trimStart;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Reset to default values
  const handleReset = () => {
    setEdits({
      trimStart: 0,
      trimEnd: duration,
      speed: 1,
      muted: false,
      volume: 1,
    });
    setTextOverlays([]);
    setSelectedTextId(null);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Add a new text overlay
  const addTextOverlay = (initialText: string = "Text") => {
    const newOverlay: VideoTextOverlay = {
      id: crypto.randomUUID(),
      text: initialText,
      x: 0,
      y: 0,
      fontSize: 48,
      fontFamily: "Inter, sans-serif",
      color: "#FFFFFF",
      opacity: 1,
      rotation: 0,
      textAlign: "center",
      shadow: true,
      position: "middle-center",
      timing: "full",
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setSelectedTextId(newOverlay.id);
  };

  // Update a text overlay property
  const updateTextOverlay = (
    id: string,
    updates: Partial<VideoTextOverlay>,
  ) => {
    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay,
      ),
    );
  };

  // Delete a text overlay
  const deleteTextOverlay = (id: string) => {
    setTextOverlays((overlays) => overlays.filter((o) => o.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };

  // Save to disk and close
  const handleSaveAndClose = async () => {
    setIsSaving(true);
    setSaveStatus("idle");

    // Combine edits with text overlays and aspect ratio
    const fullEdits: VideoEdits = {
      ...edits,
      textOverlays: textOverlays.length > 0 ? textOverlays : undefined,
      aspectRatio: { width: aspectRatio.width, height: aspectRatio.height },
    };

    try {
      await editsApi.saveVideoEdit(projectId, media.id, fullEdits);
      onSave?.(fullEdits);
      setSaveStatus("saved");
      // Brief delay to show success, then close
      setTimeout(() => onClose(), 500);
    } catch (error) {
      console.error("Failed to save video edits:", error);
      setSaveStatus("error");
      setIsSaving(false);
    }
  };

  // Get the selected text overlay
  const selectedText = textOverlays.find((t) => t.id === selectedTextId);

  const trimDuration = edits.trimEnd - edits.trimStart;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-white">Edit Video</h2>
          {saveStatus === "saved" && (
            <p className="text-xs text-green-400">Edits saved to disk</p>
          )}
          {saveStatus === "error" && (
            <p className="text-xs text-red-400">Failed to save edits</p>
          )}
          {saveStatus === "idle" && (
            <p className="text-xs text-gray-400">
              Edits will be applied on export
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleSaveAndClose} isLoading={isSaving}>
            Save & Close
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video Preview - cropped to target aspect ratio */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black min-h-0">
          <div className="flex flex-col items-center">
            {/* Aspect ratio label */}
            <div className="text-xs text-gray-400 mb-2">
              Preview: {aspectRatio.width}:{aspectRatio.height}
              {aspectRatio.label ? ` (${aspectRatio.label})` : ""}
            </div>
            {/* Cropped video container */}
            <div
              ref={videoContainerRef}
              className="relative rounded-lg overflow-hidden cursor-pointer"
              style={{
                width: croppedWidth,
                height: croppedHeight,
              }}
              onClick={togglePlay}
            >
              <video
                ref={videoRef}
                src={`/media/${media.originalPath}`}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover" }}
                preload="metadata"
              />
              {/* Text overlay preview */}
              <VideoTextPreview
                overlays={textOverlays}
                currentTime={currentTime}
                trimStart={edits.trimStart}
                trimEnd={edits.trimEnd}
                selectedTextId={selectedTextId}
                onSelectText={setSelectedTextId}
                showAllForEditing={true}
              />
            </div>
          </div>
        </div>

        {/* Controls - scrollable if needed */}
        <div className="bg-gray-800 border-t border-gray-700 p-6 overflow-y-auto max-h-[350px]">
          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white hover:bg-primary-700"
            >
              {isPlaying ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="text-white font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Timeline */}
          <div className="mb-6">
            <div className="relative h-12 bg-gray-700 rounded-lg overflow-hidden">
              {/* Trim handles */}
              <div
                className="absolute top-0 bottom-0 bg-primary-600/30"
                style={{
                  left: `${(edits.trimStart / duration) * 100}%`,
                  width: `${((edits.trimEnd - edits.trimStart) / duration) * 100}%`,
                }}
              />

              {/* Current position */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />

              {/* Click to seek */}
              <div
                className="absolute inset-0 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const time = (x / rect.width) * duration;
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(
                      edits.trimStart,
                      Math.min(edits.trimEnd, time),
                    );
                  }
                }}
              />
            </div>

            {/* Trim Controls */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">
                  Trim Start
                </label>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={edits.trimStart}
                  onChange={(e) => {
                    const val = Math.min(
                      Number(e.target.value),
                      edits.trimEnd - 0.5,
                    );
                    setEdits({ ...edits, trimStart: val });
                  }}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {formatTime(edits.trimStart)}
                </span>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">
                  Trim End
                </label>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={edits.trimEnd}
                  onChange={(e) => {
                    const val = Math.max(
                      Number(e.target.value),
                      edits.trimStart + 0.5,
                    );
                    setEdits({ ...edits, trimEnd: val });
                  }}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {formatTime(edits.trimEnd)}
                </span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-400 mt-2">
              Duration: {formatTime(trimDuration)}
            </p>
          </div>

          {/* Speed, Audio & Text */}
          <div className="grid grid-cols-3 gap-6">
            {/* Speed */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Speed</label>
              <div className="flex gap-2 flex-wrap">
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEdits({ ...edits, speed: opt.value })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      edits.speed === opt.value
                        ? "bg-primary-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Audio</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setEdits({ ...edits, muted: !edits.muted })}
                  className={`p-2 rounded-lg ${
                    edits.muted
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {edits.muted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={edits.volume}
                  onChange={(e) =>
                    setEdits({ ...edits, volume: Number(e.target.value) })
                  }
                  disabled={edits.muted}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Text Overlay */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Text Overlay
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addTextOverlay()}
                className="w-full"
              >
                + Add Text
              </Button>
            </div>
          </div>

          {/* Text Overlay Editor Panel */}
          {selectedText && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Edit Text</h3>
                <button
                  onClick={() => deleteTextOverlay(selectedText.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>

              <div className="space-y-4">
                {/* Text Input */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Text
                  </label>
                  <input
                    type="text"
                    value={selectedText.text}
                    onChange={(e) =>
                      updateTextOverlay(selectedText.id, {
                        text: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter text..."
                  />
                </div>

                {/* Position & Timing Row */}
                <div className="flex gap-4">
                  {/* Position */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Position
                    </label>
                    <AlignmentPicker
                      value={selectedText.position || "middle-center"}
                      onChange={(position: TextPosition) =>
                        updateTextOverlay(selectedText.id, { position })
                      }
                      size="sm"
                    />
                  </div>

                  {/* Timing */}
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">
                      When to show
                    </label>
                    <select
                      value={selectedText.timing}
                      onChange={(e) =>
                        updateTextOverlay(selectedText.id, {
                          timing: e.target.value as VideoTextTiming,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {TIMING_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Font & Size Row */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">
                      Font
                    </label>
                    <select
                      value={selectedText.fontFamily}
                      onChange={(e) =>
                        updateTextOverlay(selectedText.id, {
                          fontFamily: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {FONT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-400 mb-1">
                      Size
                    </label>
                    <input
                      type="number"
                      value={selectedText.fontSize}
                      onChange={(e) =>
                        updateTextOverlay(selectedText.id, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      min={12}
                      max={120}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* Color & Shadow Row */}
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">
                      Color
                    </label>
                    <div className="flex gap-1 flex-wrap">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            updateTextOverlay(selectedText.id, { color })
                          }
                          className={`w-6 h-6 rounded border-2 ${
                            selectedText.color === color
                              ? "border-primary-500"
                              : "border-gray-600"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedText.color}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            color: e.target.value,
                          })
                        }
                        className="w-6 h-6 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedText.shadow ?? true}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            shadow: e.target.checked,
                          })
                        }
                        className="rounded border-gray-600 bg-gray-800 text-primary-600 focus:ring-primary-500"
                      />
                      Shadow
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Text Layers List */}
          {textOverlays.length > 0 && !selectedText && (
            <div className="mt-6">
              <label className="block text-sm text-gray-400 mb-2">
                Text Layers ({textOverlays.length})
              </label>
              <div className="space-y-2">
                {textOverlays.map((overlay) => (
                  <button
                    key={overlay.id}
                    onClick={() => setSelectedTextId(overlay.id)}
                    className="w-full text-left px-3 py-2 bg-gray-700 rounded-lg text-sm text-white hover:bg-gray-600 flex items-center justify-between"
                  >
                    <span className="truncate">{overlay.text || "Empty"}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {TIMING_OPTIONS.find((t) => t.value === overlay.timing)
                        ?.label || overlay.timing}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
