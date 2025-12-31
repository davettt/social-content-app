import { useState, useRef, useEffect } from "react";
import { Button } from "../common/Button";
import type { Media } from "../../types";

interface VideoEditorProps {
  media: Media;
  onSave: (edits: VideoEdits) => void;
  onClose: () => void;
}

interface VideoEdits {
  trimStart: number;
  trimEnd: number;
  speed: number;
  muted: boolean;
  volume: number;
}

const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
];

export function VideoEditor({ media, onSave, onClose }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [edits, setEdits] = useState<VideoEdits>({
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    muted: false,
    volume: 1,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setEdits((prev) => ({ ...prev, trimEnd: video.duration }));
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

  const handleSave = () => {
    onSave(edits);
  };

  const trimDuration = edits.trimEnd - edits.trimStart;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Edit Video</h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Video Preview */}
        <div className="flex-1 flex items-center justify-center p-8 bg-black">
          <video
            ref={videoRef}
            src={`/media/${media.originalPath}`}
            className="max-h-full max-w-full rounded-lg"
            onClick={togglePlay}
          />
        </div>

        {/* Controls */}
        <div className="bg-gray-800 border-t border-gray-700 p-6">
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

          {/* Speed & Audio */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Speed</label>
              <div className="flex gap-2">
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEdits({ ...edits, speed: opt.value })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
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
          </div>
        </div>
      </div>
    </div>
  );
}
