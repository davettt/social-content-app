import { useState, useRef, useEffect } from "react";
import { Button } from "../common/Button";
import { editsApi } from "../../services/api";
import type { Media } from "../../types";

type VideoTransition = "fade" | "wipeleft" | "slideright" | "circlecrop";

const VIDEO_TRANSITIONS: {
  value: VideoTransition | undefined;
  label: string;
}[] = [
  { value: undefined, label: "None" },
  { value: "fade", label: "Fade" },
  { value: "wipeleft", label: "Wipe" },
  { value: "slideright", label: "Slide" },
  { value: "circlecrop", label: "Circle" },
];

interface StitchedClip {
  mediaId: string;
  media: Media;
  trimStart: number;
  trimEnd: number;
  duration: number;
}

interface VideoStitcherProps {
  availableMedia: Media[];
  projectId: string;
  onSave: (savedMedia: Media) => void;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoStitcher({
  availableMedia,
  projectId,
  onSave,
  onClose,
}: VideoStitcherProps) {
  const [selectedClips, setSelectedClips] = useState<StitchedClip[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewClipIndex, setPreviewClipIndex] = useState<number | null>(null);
  const [transition, setTransition] = useState<VideoTransition | undefined>(
    undefined,
  );
  const [transitionDuration, setTransitionDuration] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoMedia = availableMedia.filter((m) => m.type === "video");

  const totalDuration = selectedClips.reduce(
    (sum, clip) => sum + (clip.trimEnd - clip.trimStart),
    0,
  );

  const handleVideoSelect = (media: Media) => {
    const isSelected = selectedClips.some((c) => c.mediaId === media.id);

    if (isSelected) {
      setSelectedClips(selectedClips.filter((c) => c.mediaId !== media.id));
    } else {
      const duration = media.metadata?.duration || 0;
      setSelectedClips([
        ...selectedClips,
        {
          mediaId: media.id,
          media,
          trimStart: 0,
          trimEnd: duration,
          duration,
        },
      ]);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setSelectedClips((clips) => {
      const newClips = [...clips];
      const prev = newClips[index - 1];
      const curr = newClips[index];
      if (prev && curr) {
        newClips[index - 1] = curr;
        newClips[index] = prev;
      }
      return newClips;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedClips.length - 1) return;
    setSelectedClips((clips) => {
      const newClips = [...clips];
      const curr = newClips[index];
      const next = newClips[index + 1];
      if (curr && next) {
        newClips[index] = next;
        newClips[index + 1] = curr;
      }
      return newClips;
    });
  };

  const handleRemoveClip = (index: number) => {
    setSelectedClips(selectedClips.filter((_, i) => i !== index));
    if (previewClipIndex === index) {
      setPreviewClipIndex(null);
    }
  };

  const handleTrimChange = (
    index: number,
    field: "trimStart" | "trimEnd",
    value: number,
  ) => {
    setSelectedClips((clips) =>
      clips.map((clip, i) =>
        i === index ? { ...clip, [field]: value } : clip,
      ),
    );

    // If we're editing the currently previewed clip, seek to the new position
    if (previewClipIndex === index && videoRef.current) {
      if (field === "trimStart") {
        videoRef.current.currentTime = value;
      }
    }
  };

  const handlePreviewClip = (index: number) => {
    setPreviewClipIndex(index);
  };

  // Seek to trim start position
  const handleSeekToStart = (index: number) => {
    setPreviewClipIndex(index);
    const clip = selectedClips[index];
    if (clip && videoRef.current) {
      videoRef.current.currentTime = clip.trimStart;
      videoRef.current.play();
    }
  };

  // Seek to trim end position
  const handleSeekToEnd = (index: number) => {
    setPreviewClipIndex(index);
    const clip = selectedClips[index];
    if (clip && videoRef.current) {
      videoRef.current.currentTime = Math.max(0, clip.trimEnd - 1);
      videoRef.current.play();
    }
  };

  // Update video element when preview clip changes
  useEffect(() => {
    if (previewClipIndex !== null && videoRef.current) {
      const clip = selectedClips[previewClipIndex];
      if (clip) {
        videoRef.current.currentTime = clip.trimStart;
      }
    }
  }, [previewClipIndex, selectedClips]);

  // Pause video at trim end
  useEffect(() => {
    const video = videoRef.current;
    if (!video || previewClipIndex === null) return;

    const clip = selectedClips[previewClipIndex];
    if (!clip) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= clip.trimEnd) {
        video.pause();
        video.currentTime = clip.trimEnd;
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [previewClipIndex, selectedClips]);

  const handleStitch = async () => {
    if (selectedClips.length < 2) {
      setError("Please select at least 2 video clips");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const clips = selectedClips.map((clip) => ({
        mediaId: clip.mediaId,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      }));

      const result = await editsApi.stitchVideos(
        projectId,
        clips,
        transition,
        transitionDuration,
      );

      if (result.success && result.media) {
        onSave(result.media);
      } else {
        setError("Failed to stitch videos");
      }
    } catch (err) {
      console.error("Stitch error:", err);
      setError(err instanceof Error ? err.message : "Failed to stitch videos");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Stitch Videos</h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleStitch}
            disabled={selectedClips.length < 2 || isProcessing}
            isLoading={isProcessing}
          >
            {isProcessing ? "Stitching..." : "Create Stitched Video"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-900/50 border-b border-red-700 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-950">
          {previewClipIndex !== null && selectedClips[previewClipIndex] ? (
            <div className="w-full max-w-lg">
              <video
                ref={videoRef}
                src={`/media/${selectedClips[previewClipIndex].media.originalPath}`}
                className="w-full rounded-lg shadow-2xl"
                controls
                autoPlay
                muted
              />
              <p className="text-gray-400 text-sm text-center mt-3">
                Previewing clip {previewClipIndex + 1}:{" "}
                {selectedClips[previewClipIndex].media.filename}
              </p>
            </div>
          ) : selectedClips.length > 0 ? (
            <div className="text-center">
              {/* Show thumbnails of selected clips in order */}
              <div className="flex gap-2 mb-6 flex-wrap justify-center">
                {selectedClips.map((clip, index) => (
                  <div key={clip.mediaId} className="relative">
                    <img
                      src={`/media/${clip.media.thumbnailPath}`}
                      alt={clip.media.filename}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `/media/${clip.media.originalPath}`;
                      }}
                    />
                    <div className="absolute top-1 left-1 w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-gray-300 text-lg mb-2">
                {selectedClips.length} clips selected
              </p>
              <p className="text-gray-400 text-sm">
                Total duration: {formatDuration(totalDuration)}
              </p>
              <p className="text-gray-500 text-xs mt-4">
                Click a clip on the right to preview it
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-400">
                Select 2 or more videos to stitch together
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          {/* Transition Settings */}
          {selectedClips.length >= 2 && (
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Transition Effect
              </h3>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {VIDEO_TRANSITIONS.map((t) => (
                  <button
                    key={t.value || "none"}
                    onClick={() => setTransition(t.value)}
                    className={`px-3 py-2 text-xs rounded-lg border-2 transition-colors ${
                      transition === t.value
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-gray-600 hover:border-gray-500 text-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {transition && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Transition Duration: {transitionDuration}s
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.5"
                    value={transitionDuration}
                    onChange={(e) =>
                      setTransitionDuration(parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Selected Clips Order */}
          {selectedClips.length > 0 && (
            <div className="p-4 border-b border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-gray-300">
                  Clip Order
                </h3>
                <span className="text-xs text-gray-400">
                  Total: {formatDuration(totalDuration)}
                </span>
              </div>

              <div className="space-y-2">
                {selectedClips.map((clip, index) => (
                  <div
                    key={clip.mediaId}
                    className={`bg-gray-700 rounded-lg p-3 ${
                      previewClipIndex === index
                        ? "ring-2 ring-primary-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <button
                        onClick={() => handlePreviewClip(index)}
                        className="relative w-16 h-12 rounded overflow-hidden flex-shrink-0"
                      >
                        <img
                          src={`/media/${clip.media.thumbnailPath}`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              `/media/${clip.media.originalPath}`;
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {index + 1}. {clip.media.filename}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDuration(clip.trimStart)} -{" "}
                          {formatDuration(clip.trimEnd)}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                          title="Move up"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === selectedClips.length - 1}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                          title="Move down"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveClip(index)}
                        className="p-1 text-gray-400 hover:text-red-400"
                        title="Remove clip"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Trim controls */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSeekToStart(index)}
                          className="text-xs text-primary-400 hover:text-primary-300 w-12"
                          title="Preview start point"
                        >
                          Start:
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={clip.duration}
                          step={0.1}
                          value={clip.trimStart}
                          onChange={(e) =>
                            handleTrimChange(
                              index,
                              "trimStart",
                              Math.min(
                                Number(e.target.value),
                                clip.trimEnd - 0.5,
                              ),
                            )
                          }
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {formatDuration(clip.trimStart)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSeekToEnd(index)}
                          className="text-xs text-primary-400 hover:text-primary-300 w-12"
                          title="Preview end point"
                        >
                          End:
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={clip.duration}
                          step={0.1}
                          value={clip.trimEnd}
                          onChange={(e) =>
                            handleTrimChange(
                              index,
                              "trimEnd",
                              Math.max(
                                Number(e.target.value),
                                clip.trimStart + 0.5,
                              ),
                            )
                          }
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {formatDuration(clip.trimEnd)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Selection */}
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-300">
                Select Videos
              </h3>
              <span className="text-xs text-gray-400">
                {selectedClips.length} selected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {videoMedia.map((media) => {
                const clipIndex = selectedClips.findIndex(
                  (c) => c.mediaId === media.id,
                );
                const isSelected = clipIndex !== -1;

                return (
                  <button
                    key={media.id}
                    onClick={() => handleVideoSelect(media)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 ${
                      isSelected ? "border-primary-500" : "border-transparent"
                    }`}
                  >
                    <img
                      src={`/media/${media.thumbnailPath}`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `/media/${media.originalPath}`;
                      }}
                    />
                    {/* Video duration badge */}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
                      {formatDuration(media.metadata?.duration || 0)}
                    </div>
                    {/* Selection order badge */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {clipIndex + 1}
                      </div>
                    )}
                    {/* Video play icon */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg
                        className="w-8 h-8 text-white/80"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>

            {videoMedia.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                No videos in library. Upload some videos first.
              </p>
            )}

            {videoMedia.length === 1 && (
              <p className="text-gray-400 text-sm text-center py-4">
                Upload at least one more video to stitch clips together.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
