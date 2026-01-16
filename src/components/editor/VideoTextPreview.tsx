import type { VideoTextOverlay, VideoTextTiming } from "../../types";
import { TEXT_POSITIONS } from "../../types/post";

interface VideoTextPreviewProps {
  overlays: VideoTextOverlay[];
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  selectedTextId?: string | null;
  onSelectText?: (id: string | null) => void;
  /** If true, always show all text overlays (dim those outside timing window) */
  showAllForEditing?: boolean;
}

// Timing preset labels for display
// eslint-disable-next-line react-refresh/only-export-components -- timing options are tightly coupled to VideoTextPreview
export const TIMING_OPTIONS: { value: VideoTextTiming; label: string }[] = [
  { value: "full", label: "Full video" },
  { value: "first-3s", label: "First 3 seconds" },
  { value: "last-3s", label: "Last 3 seconds" },
  { value: "first-5s", label: "First 5 seconds" },
  { value: "last-5s", label: "Last 5 seconds" },
];

/**
 * Check if text should be visible based on timing preset
 */
function isTextVisible(
  timing: VideoTextTiming,
  currentTime: number,
  trimStart: number,
  trimEnd: number,
): boolean {
  const duration = trimEnd - trimStart;
  const relativeTime = currentTime - trimStart;

  switch (timing) {
    case "full":
      return true;
    case "first-3s":
      return relativeTime >= 0 && relativeTime <= 3;
    case "last-3s":
      return relativeTime >= duration - 3 && relativeTime <= duration;
    case "first-5s":
      return relativeTime >= 0 && relativeTime <= 5;
    case "last-5s":
      return relativeTime >= duration - 5 && relativeTime <= duration;
    default:
      return true;
  }
}

/**
 * Get CSS position styles for a text overlay based on its position preset
 * Uses percentage-based positioning for responsive layout
 */
function getPositionStyles(overlay: VideoTextOverlay): React.CSSProperties {
  const margin = "5%"; // 5% safe zone margin

  const config = TEXT_POSITIONS.find((p) => p.position === overlay.position);

  if (!config) {
    // Default to center if no position set
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      textAlign: "center" as const,
    };
  }

  const styles: React.CSSProperties = {};

  // Horizontal positioning
  switch (config.horizontalAlign) {
    case "left":
      styles.left = margin;
      styles.textAlign = "left";
      break;
    case "right":
      styles.right = margin;
      styles.textAlign = "right";
      break;
    case "center":
      styles.left = "50%";
      styles.transform = "translateX(-50%)";
      styles.textAlign = "center";
      break;
  }

  // Vertical positioning
  switch (config.verticalAlign) {
    case "top":
      styles.top = margin;
      break;
    case "bottom":
      styles.bottom = margin;
      break;
    case "middle":
      if (styles.transform) {
        styles.top = "50%";
        styles.transform = "translate(-50%, -50%)";
      } else {
        styles.top = "50%";
        styles.transform = "translateY(-50%)";
      }
      break;
  }

  return styles;
}

export function VideoTextPreview({
  overlays,
  currentTime,
  trimStart,
  trimEnd,
  selectedTextId,
  onSelectText,
  showAllForEditing = false,
}: VideoTextPreviewProps) {
  if (overlays.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {overlays.map((overlay) => {
        const isInTimingWindow = isTextVisible(
          overlay.timing,
          currentTime,
          trimStart,
          trimEnd,
        );

        // In editing mode, always show text (dimmed if outside timing window)
        // In playback mode, only show text when in timing window
        if (!showAllForEditing && !isInTimingWindow) return null;

        const positionStyles = getPositionStyles(overlay);
        const isSelected = selectedTextId === overlay.id;

        // Reduce opacity for text outside timing window (when editing)
        const effectiveOpacity =
          showAllForEditing && !isInTimingWindow
            ? (overlay.opacity || 1) * 0.4
            : overlay.opacity;

        return (
          <div
            key={overlay.id}
            className={`absolute transition-opacity duration-200 ${
              onSelectText ? "pointer-events-auto cursor-pointer" : ""
            } ${isSelected ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-transparent" : ""}`}
            style={
              {
                ...positionStyles,
                fontSize: overlay.fontSize,
                fontFamily: overlay.fontFamily,
                color: overlay.color,
                opacity: effectiveOpacity,
                textShadow: overlay.shadow
                  ? "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)"
                  : undefined,
                backgroundColor: overlay.backgroundColor || undefined,
                padding: overlay.backgroundColor ? "4px 8px" : undefined,
                borderRadius: overlay.backgroundColor ? "4px" : undefined,
                maxWidth: "90%",
                wordWrap: "break-word",
                whiteSpace: "pre-wrap",
                WebkitTextStroke: (overlay as VideoTextOverlay).strokeWidth
                  ? `${(overlay as VideoTextOverlay).strokeWidth}px ${(overlay as VideoTextOverlay).strokeColor || "#000000"}`
                  : undefined,
              } as React.CSSProperties
            }
            onClick={() => onSelectText?.(overlay.id)}
          >
            {overlay.text || "Enter text..."}
          </div>
        );
      })}
    </div>
  );
}
