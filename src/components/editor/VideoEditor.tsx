import { useState, useRef, useEffect } from "react";
import { Button } from "../common/Button";
import { AlignmentPicker } from "../common/AlignmentPicker";
import { editsApi } from "../../services/api";
import type {
  Media,
  VideoTextOverlay,
  TextPosition,
  BrandKit,
} from "../../types";
import { VideoTextPreview } from "./VideoTextPreview";
import { TIMING_OPTIONS, ANIMATION_OPTIONS } from "./textAnimationOptions";
import type { VideoTextTiming, TextAnimation } from "../../types";

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

// Default font options
const DEFAULT_FONTS = [
  "Inter",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
];

// Default color presets (used when no brand colors)
const DEFAULT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
];

interface VideoEditorProps {
  media: Media;
  projectId: string;
  brandKit?: BrandKit;
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
  brandKit,
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

  // Sidebar tab state
  const [activeTab, setActiveTab] = useState<"video" | "text">("video");

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

  // Get brand colors array for quick selection
  const getBrandColors = () => {
    const colors: { label: string; color: string }[] = [];
    if (brandKit?.primaryColor)
      colors.push({ label: "Primary", color: brandKit.primaryColor });
    if (brandKit?.secondaryColor)
      colors.push({ label: "Secondary", color: brandKit.secondaryColor });
    if (brandKit?.accentColor)
      colors.push({ label: "Accent", color: brandKit.accentColor });
    // Add colors from palette that aren't already included
    if (brandKit?.colorPalette) {
      brandKit.colorPalette.forEach((c, i) => {
        if (
          !colors.some(
            (existing) => existing.color.toLowerCase() === c.toLowerCase(),
          )
        ) {
          colors.push({ label: `Color ${i + 1}`, color: c });
        }
      });
    }
    return colors;
  };

  // Get font options with brand fonts first
  const getFontOptions = () => {
    const fonts: { label: string; value: string }[] = [];

    // Add brand fonts first
    if (
      brandKit?.fonts?.heading &&
      !DEFAULT_FONTS.includes(brandKit.fonts.heading)
    ) {
      fonts.push({
        label: `${brandKit.fonts.heading} (Brand)`,
        value: brandKit.fonts.heading,
      });
    }
    if (
      brandKit?.fonts?.body &&
      !DEFAULT_FONTS.includes(brandKit.fonts.body) &&
      brandKit.fonts.body !== brandKit.fonts.heading
    ) {
      fonts.push({
        label: `${brandKit.fonts.body} (Brand)`,
        value: brandKit.fonts.body,
      });
    }

    // Add default fonts
    DEFAULT_FONTS.forEach((font) => {
      fonts.push({ label: font, value: font });
    });

    return fonts;
  };

  // Add a new text overlay
  const addTextOverlay = (initialText: string = "Text") => {
    const newOverlay: VideoTextOverlay = {
      id: crypto.randomUUID(),
      text: initialText,
      x: 0,
      y: 0,
      fontSize: 48,
      fontFamily: brandKit?.fonts?.heading || "Inter",
      color: brandKit?.primaryColor || "#FFFFFF",
      opacity: 1,
      rotation: 0,
      textAlign: "center",
      shadow: true,
      shadowColor: "#000000",
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.5,
      position: "middle-center",
      timing: "full",
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setSelectedTextId(newOverlay.id);
    setActiveTab("text"); // Switch to text tab when adding
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
  const brandColors = getBrandColors();
  const fontOptions = getFontOptions();

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

      <div className="flex-1 flex min-h-0">
        {/* Main Content - Video Preview and Controls */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Video Preview */}
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
                  onDragText={(id, offsetX, offsetY) => {
                    updateTextOverlay(id, { offsetX, offsetY });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Video Controls - Bottom Section */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={togglePlay}
                className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white hover:bg-primary-700"
              >
                {isPlaying ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <span className="text-white font-mono text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Timeline */}
            <div className="mb-4">
              <div className="relative h-8 bg-gray-700 rounded-lg overflow-hidden">
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
            </div>

            {/* Trim, Speed, Audio - Compact Row */}
            <div className="grid grid-cols-4 gap-4">
              {/* Trim Start */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Trim Start: {formatTime(edits.trimStart)}
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
              </div>

              {/* Trim End */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Trim End: {formatTime(edits.trimEnd)}
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
              </div>

              {/* Speed */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Speed
                </label>
                <div className="flex gap-1">
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEdits({ ...edits, speed: opt.value })}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium ${
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
                <label className="block text-xs text-gray-400 mb-1">
                  Audio
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEdits({ ...edits, muted: !edits.muted })}
                    className={`p-1.5 rounded ${
                      edits.muted
                        ? "bg-red-600 text-white"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {edits.muted ? (
                      <svg
                        className="w-4 h-4"
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
                        className="w-4 h-4"
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
            </div>

            <p className="text-center text-xs text-gray-500 mt-2">
              Duration: {formatTime(trimDuration)}
            </p>
          </div>
        </div>

        {/* Right Sidebar - Text Controls */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {(["video", "text"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? "text-white border-b-2 border-primary-500"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === "video" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Use the controls below the video to adjust trim points,
                  playback speed, and audio.
                </p>

                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">
                    Current Settings
                  </h4>
                  <div className="space-y-1 text-xs text-gray-300">
                    <p>
                      Trim: {formatTime(edits.trimStart)} -{" "}
                      {formatTime(edits.trimEnd)}
                    </p>
                    <p>Duration: {formatTime(trimDuration)}</p>
                    <p>Speed: {edits.speed}x</p>
                    <p>
                      Audio:{" "}
                      {edits.muted
                        ? "Muted"
                        : `${Math.round(edits.volume * 100)}%`}
                    </p>
                  </div>
                </div>

                {textOverlays.length > 0 && (
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-2">
                      Text Overlays
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">
                      {textOverlays.length} text layer
                      {textOverlays.length !== 1 ? "s" : ""} added
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab("text")}
                      className="w-full"
                    >
                      Edit Text
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "text" && (
              <div className="space-y-4">
                <Button onClick={() => addTextOverlay()} className="w-full">
                  + Add Text
                </Button>

                {/* Help tips */}
                <div className="space-y-2">
                  {/* Reels/Stories safe zone warning */}
                  {aspectRatio.width / aspectRatio.height < 1 && (
                    <div className="p-2 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                      <p className="text-xs text-amber-200">
                        <strong>Tip:</strong> For Reels/Stories, avoid placing
                        text at the very top or bottom — Instagram overlays UI
                        elements there (song name, captions, buttons).
                      </p>
                    </div>
                  )}

                  {/* When to use this vs Instagram */}
                  <details className="text-xs text-gray-400">
                    <summary className="cursor-pointer hover:text-gray-300">
                      When to add text here vs Instagram?
                    </summary>
                    <div className="mt-2 p-2 bg-gray-700/50 rounded space-y-2">
                      <p>
                        <strong className="text-gray-300">
                          Use this app for:
                        </strong>{" "}
                        Brand fonts/colors, multi-platform export, batch
                        content, client deliverables
                      </p>
                      <p>
                        <strong className="text-gray-300">
                          Use Instagram for:
                        </strong>{" "}
                        Interactive elements (polls, links), animated effects,
                        music-synced text, quick Stories
                      </p>
                      <p className="text-gray-500 italic">
                        Text added here is baked into the video file. Instagram
                        text is a platform overlay.
                      </p>
                    </div>
                  </details>
                </div>

                {/* Text Layers List */}
                {textOverlays.length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Text Layers ({textOverlays.length})
                    </label>
                    <div className="space-y-2">
                      {textOverlays.map((overlay) => (
                        <button
                          key={overlay.id}
                          onClick={() => setSelectedTextId(overlay.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                            selectedTextId === overlay.id
                              ? "bg-primary-600 text-white"
                              : "bg-gray-700 text-white hover:bg-gray-600"
                          }`}
                        >
                          <span className="truncate">
                            {overlay.text || "Empty"}
                          </span>
                          <span className="text-xs opacity-70 ml-2 shrink-0">
                            {TIMING_OPTIONS.find(
                              (t) => t.value === overlay.timing,
                            )?.label || overlay.timing}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Text Editor */}
                {selectedText && (
                  <div className="space-y-4 pt-4 border-t border-gray-700">
                    {/* Text Input */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
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
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter text..."
                      />
                    </div>

                    {/* Position */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">
                        Position
                      </label>
                      <AlignmentPicker
                        value={selectedText.position || "middle-center"}
                        onChange={(position: TextPosition) =>
                          // Reset offsets when selecting a new position preset
                          updateTextOverlay(selectedText.id, {
                            position,
                            offsetX: 0,
                            offsetY: 0,
                          })
                        }
                      />
                      {/* Show offset reset hint if text has been dragged */}
                      {(selectedText.offsetX !== 0 ||
                        selectedText.offsetY !== 0) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Position adjusted by drag. Select a preset to reset.
                        </p>
                      )}
                    </div>

                    {/* Timing */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        When to Show
                      </label>
                      <select
                        value={selectedText.timing}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            timing: e.target.value as VideoTextTiming,
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {TIMING_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Animation */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Animation
                      </label>
                      <select
                        value={selectedText.animation || "none"}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            animation: e.target.value as TextAnimation,
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {ANIMATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Animation Duration */}
                    {selectedText.animation &&
                      selectedText.animation !== "none" && (
                        <div>
                          <label className="block text-sm text-gray-300 mb-1">
                            Animation Duration:{" "}
                            {selectedText.animationDuration || 1}s
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.5"
                            value={selectedText.animationDuration || 1}
                            onChange={(e) =>
                              updateTextOverlay(selectedText.id, {
                                animationDuration: parseFloat(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                        </div>
                      )}

                    {/* Font */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Font
                      </label>
                      <select
                        value={selectedText.fontFamily}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            fontFamily: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {fontOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Size */}
                    <div>
                      <div className="flex justify-between text-sm text-gray-300 mb-1">
                        <span>Size</span>
                        <span>{selectedText.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        value={selectedText.fontSize}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            fontSize: Number(e.target.value),
                          })
                        }
                        min={12}
                        max={120}
                        className="w-full"
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Color
                      </label>
                      {/* Brand Colors Quick Select */}
                      {brandColors.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {brandColors.slice(0, 8).map((c) => (
                            <button
                              key={c.color}
                              onClick={() =>
                                updateTextOverlay(selectedText.id, {
                                  color: c.color,
                                })
                              }
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                selectedText.color.toLowerCase() ===
                                c.color.toLowerCase()
                                  ? "border-white scale-110"
                                  : "border-gray-600 hover:border-gray-400"
                              }`}
                              style={{ backgroundColor: c.color }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      )}
                      {/* Default colors if no brand colors */}
                      {brandColors.length === 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {DEFAULT_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() =>
                                updateTextOverlay(selectedText.id, { color })
                              }
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                selectedText.color === color
                                  ? "border-white scale-110"
                                  : "border-gray-600 hover:border-gray-400"
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                      <input
                        type="color"
                        value={selectedText.color}
                        onChange={(e) =>
                          updateTextOverlay(selectedText.id, {
                            color: e.target.value,
                          })
                        }
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Background Color */}
                    <div>
                      <label className="text-sm text-gray-300 block mb-2">
                        Background
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          onClick={() =>
                            updateTextOverlay(selectedText.id, {
                              backgroundColor: undefined,
                            })
                          }
                          className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                            !selectedText.backgroundColor
                              ? "border-white scale-110"
                              : "border-gray-600 hover:border-gray-400"
                          }`}
                          style={{
                            background:
                              "linear-gradient(135deg, #374151 45%, transparent 45%, transparent 55%, #374151 55%), linear-gradient(45deg, #ef4444 50%, transparent 50%)",
                          }}
                          title="None"
                        />
                        {brandColors.slice(0, 7).map((c) => (
                          <button
                            key={c.color}
                            onClick={() =>
                              updateTextOverlay(selectedText.id, {
                                backgroundColor: c.color,
                              })
                            }
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                              selectedText.backgroundColor?.toLowerCase() ===
                              c.color.toLowerCase()
                                ? "border-white scale-110"
                                : "border-gray-600 hover:border-gray-400"
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedText.backgroundColor && (
                          <input
                            type="color"
                            value={selectedText.backgroundColor}
                            onChange={(e) =>
                              updateTextOverlay(selectedText.id, {
                                backgroundColor: e.target.value,
                              })
                            }
                            className="w-10 h-10 rounded-lg cursor-pointer"
                          />
                        )}
                        <button
                          onClick={() =>
                            updateTextOverlay(selectedText.id, {
                              backgroundColor: selectedText.backgroundColor
                                ? undefined
                                : "#000000",
                            })
                          }
                          className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                            selectedText.backgroundColor
                              ? "bg-primary-600 text-white"
                              : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {selectedText.backgroundColor
                            ? "Remove"
                            : "Add Background"}
                        </button>
                      </div>
                    </div>

                    {/* Shadow */}
                    <div className="border-t border-gray-700 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer mb-3">
                        <input
                          type="checkbox"
                          checked={selectedText.shadow ?? true}
                          onChange={(e) =>
                            updateTextOverlay(selectedText.id, {
                              shadow: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-300">
                          Drop Shadow
                        </span>
                      </label>

                      {selectedText.shadow && (
                        <>
                          <div className="mb-3">
                            <label className="text-sm text-gray-300 block mb-2">
                              Shadow Color
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {brandColors.slice(0, 7).map((c) => (
                                <button
                                  key={c.color}
                                  onClick={() =>
                                    updateTextOverlay(selectedText.id, {
                                      shadowColor: c.color,
                                    })
                                  }
                                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                    selectedText.shadowColor?.toLowerCase() ===
                                    c.color.toLowerCase()
                                      ? "border-white scale-110"
                                      : "border-gray-600 hover:border-gray-400"
                                  }`}
                                  style={{ backgroundColor: c.color }}
                                  title={c.label}
                                />
                              ))}
                            </div>
                            <input
                              type="color"
                              value={selectedText.shadowColor || "#000000"}
                              onChange={(e) =>
                                updateTextOverlay(selectedText.id, {
                                  shadowColor: e.target.value,
                                })
                              }
                              className="w-full h-10 rounded-lg cursor-pointer"
                            />
                          </div>

                          <div className="mb-3">
                            <div className="flex justify-between text-sm text-gray-300 mb-1">
                              <span>Opacity</span>
                              <span>
                                {Math.round(
                                  (selectedText.shadowOpacity ?? 0.5) * 100,
                                )}
                                %
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={selectedText.shadowOpacity ?? 0.5}
                              onChange={(e) =>
                                updateTextOverlay(selectedText.id, {
                                  shadowOpacity: Number(e.target.value),
                                })
                              }
                              className="w-full"
                            />
                          </div>

                          <div className="mb-3">
                            <div className="flex justify-between text-sm text-gray-300 mb-1">
                              <span>Offset X</span>
                              <span>{selectedText.shadowOffsetX ?? 2}px</span>
                            </div>
                            <input
                              type="range"
                              min="-10"
                              max="10"
                              step="1"
                              value={selectedText.shadowOffsetX ?? 2}
                              onChange={(e) =>
                                updateTextOverlay(selectedText.id, {
                                  shadowOffsetX: Number(e.target.value),
                                })
                              }
                              className="w-full"
                            />
                          </div>

                          <div className="mb-3">
                            <div className="flex justify-between text-sm text-gray-300 mb-1">
                              <span>Offset Y</span>
                              <span>{selectedText.shadowOffsetY ?? 2}px</span>
                            </div>
                            <input
                              type="range"
                              min="-10"
                              max="10"
                              step="1"
                              value={selectedText.shadowOffsetY ?? 2}
                              onChange={(e) =>
                                updateTextOverlay(selectedText.id, {
                                  shadowOffsetY: Number(e.target.value),
                                })
                              }
                              className="w-full"
                            />
                          </div>

                          <div className="mb-3">
                            <div className="flex justify-between text-sm text-gray-300 mb-1">
                              <span>Blur</span>
                              <span>{selectedText.shadowBlur ?? 4}px</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="1"
                              value={selectedText.shadowBlur ?? 4}
                              onChange={(e) =>
                                updateTextOverlay(selectedText.id, {
                                  shadowBlur: Number(e.target.value),
                                })
                              }
                              className="w-full"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Text Stroke */}
                    {(() => {
                      const vto = selectedText as VideoTextOverlay;
                      const hasStroke =
                        vto.strokeWidth != null && vto.strokeWidth > 0;
                      return (
                        <div>
                          <label className="text-sm text-gray-300 block mb-2">
                            Text Outline
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button
                              onClick={() => {
                                updateTextOverlay(selectedText.id, {
                                  strokeColor: undefined,
                                  strokeWidth: 0,
                                });
                              }}
                              className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                                !hasStroke
                                  ? "border-white scale-110"
                                  : "border-gray-600 hover:border-gray-400"
                              }`}
                              style={{
                                background:
                                  "linear-gradient(135deg, #374151 45%, transparent 45%, transparent 55%, #374151 55%), linear-gradient(45deg, #ef4444 50%, transparent 50%)",
                              }}
                              title="None"
                            />
                            {brandColors.slice(0, 7).map((c) => (
                              <button
                                key={c.color}
                                onClick={() =>
                                  updateTextOverlay(selectedText.id, {
                                    strokeColor: c.color,
                                    strokeWidth: hasStroke
                                      ? vto.strokeWidth
                                      : 2,
                                  })
                                }
                                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                  vto.strokeColor?.toLowerCase() ===
                                    c.color.toLowerCase() && hasStroke
                                    ? "border-white scale-110"
                                    : "border-gray-600 hover:border-gray-400"
                                }`}
                                style={{ backgroundColor: c.color }}
                                title={c.label}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {hasStroke && (
                              <input
                                type="color"
                                value={vto.strokeColor || "#000000"}
                                onChange={(e) =>
                                  updateTextOverlay(selectedText.id, {
                                    strokeColor: e.target.value,
                                  })
                                }
                                className="w-10 h-10 rounded-lg cursor-pointer"
                              />
                            )}
                            <button
                              onClick={() =>
                                updateTextOverlay(selectedText.id, {
                                  strokeWidth: hasStroke ? 0 : 2,
                                })
                              }
                              className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                                hasStroke
                                  ? "bg-primary-600 text-white"
                                  : "bg-gray-700 text-gray-300"
                              }`}
                            >
                              {hasStroke ? "Remove" : "Add Outline"}
                            </button>
                          </div>
                          {hasStroke && (
                            <div className="mt-2">
                              <div className="flex justify-between text-sm text-gray-300 mb-1">
                                <span>Outline Width</span>
                                <span>{vto.strokeWidth}px</span>
                              </div>
                              <input
                                type="range"
                                value={vto.strokeWidth || 0}
                                onChange={(e) =>
                                  updateTextOverlay(selectedText.id, {
                                    strokeWidth: Number(e.target.value),
                                  })
                                }
                                min={0}
                                max={10}
                                step={0.5}
                                className="w-full"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Delete Button */}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteTextOverlay(selectedText.id)}
                      className="w-full"
                    >
                      Delete Text
                    </Button>
                  </div>
                )}

                {textOverlays.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No text overlays yet. Click "Add Text" to get started.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
