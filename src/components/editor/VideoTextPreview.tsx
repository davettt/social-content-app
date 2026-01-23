import { useState, useRef, useCallback } from "react";
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
  /** Callback when text is dragged to a new position */
  onDragText?: (id: string, offsetX: number, offsetY: number) => void;
}

/**
 * Convert hex color to rgba string
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

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
 * Applies offsetX/offsetY pixel offsets from drag positioning
 */
function getPositionStyles(overlay: VideoTextOverlay): React.CSSProperties {
  const margin = "5%"; // 5% safe zone margin
  const offsetX = overlay.offsetX || 0;
  const offsetY = overlay.offsetY || 0;

  const config = TEXT_POSITIONS.find((p) => p.position === overlay.position);

  if (!config) {
    // Default to center if no position set
    return {
      left: `calc(50% + ${offsetX}px)`,
      top: `calc(50% + ${offsetY}px)`,
      transform: "translate(-50%, -50%)",
      textAlign: "center" as const,
    };
  }

  const styles: React.CSSProperties = {};

  // Horizontal positioning with offset
  switch (config.horizontalAlign) {
    case "left":
      styles.left = offsetX !== 0 ? `calc(${margin} + ${offsetX}px)` : margin;
      styles.textAlign = "left";
      break;
    case "right":
      styles.right = offsetX !== 0 ? `calc(${margin} - ${offsetX}px)` : margin;
      styles.textAlign = "right";
      break;
    case "center":
      styles.left = offsetX !== 0 ? `calc(50% + ${offsetX}px)` : "50%";
      styles.transform = "translateX(-50%)";
      styles.textAlign = "center";
      break;
  }

  // Vertical positioning with offset
  switch (config.verticalAlign) {
    case "top":
      styles.top = offsetY !== 0 ? `calc(${margin} + ${offsetY}px)` : margin;
      break;
    case "bottom":
      styles.bottom = offsetY !== 0 ? `calc(${margin} - ${offsetY}px)` : margin;
      break;
    case "middle":
      if (styles.transform) {
        styles.top = offsetY !== 0 ? `calc(50% + ${offsetY}px)` : "50%";
        styles.transform = "translate(-50%, -50%)";
      } else {
        styles.top = offsetY !== 0 ? `calc(50% + ${offsetY}px)` : "50%";
        styles.transform = "translateY(-50%)";
      }
      break;
  }

  return styles;
}

/**
 * Get CSS animation styles for a text overlay
 */
function getAnimationStyles(overlay: VideoTextOverlay): React.CSSProperties {
  const animation = overlay.animation || "none";
  const animDuration = (overlay.animationDuration || 1) * 1000; // Convert to ms

  if (animation === "none") {
    return {};
  }

  const styles: React.CSSProperties = {};

  switch (animation) {
    case "fade":
      styles.animation = `textFadeIn ${animDuration}ms ease-out forwards`;
      break;

    case "bounce":
      styles.animation = `textBounce ${animDuration}ms ease-out forwards`;
      break;

    case "slide-up":
      styles.animation = `textSlideUp ${animDuration}ms ease-out forwards`;
      break;

    case "slide-down":
      styles.animation = `textSlideDown ${animDuration}ms ease-out forwards`;
      break;

    case "slide-left":
      styles.animation = `textSlideLeft ${animDuration}ms ease-out forwards`;
      break;

    case "slide-right":
      styles.animation = `textSlideRight ${animDuration}ms ease-out forwards`;
      break;

    case "typewriter":
      // Typewriter is handled differently - see render function
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
  onDragText,
}: VideoTextPreviewProps) {
  // Track drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverlayId, setDragOverlayId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, overlay: VideoTextOverlay) => {
      if (!onDragText || selectedTextId !== overlay.id) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      setDragOverlayId(overlay.id);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: overlay.offsetX || 0,
        offsetY: overlay.offsetY || 0,
      };
    },
    [onDragText, selectedTextId],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !dragOverlayId || !onDragText)
        return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const newOffsetX = dragStartRef.current.offsetX + deltaX;
      const newOffsetY = dragStartRef.current.offsetY + deltaY;

      onDragText(dragOverlayId, newOffsetX, newOffsetY);
    },
    [isDragging, dragOverlayId, onDragText],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragOverlayId(null);
    dragStartRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleMouseUp();
    }
  }, [isDragging, handleMouseUp]);

  if (overlays.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ pointerEvents: isDragging ? "auto" : undefined }}
    >
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
        const animationStyles = getAnimationStyles(overlay);
        const isSelected = selectedTextId === overlay.id;
        const animation = overlay.animation || "none";
        const animDuration = overlay.animationDuration || 1;
        const canDrag = onDragText && isSelected;

        // Reduce opacity for text outside timing window (when editing)
        const effectiveOpacity =
          showAllForEditing && !isInTimingWindow
            ? (overlay.opacity || 1) * 0.4
            : overlay.opacity;

        // Handle typewriter animation specially
        const renderContent = () => {
          if (animation === "typewriter") {
            const relativeTime = currentTime - trimStart;
            const text = overlay.text || "Enter text...";
            const charsToShow = Math.max(
              0,
              Math.min(
                text.length,
                Math.floor((relativeTime / animDuration) * text.length),
              ),
            );
            return text.substring(0, charsToShow);
          }
          return overlay.text || "Enter text...";
        };

        return (
          <div
            key={overlay.id}
            className={`absolute transition-opacity duration-200 ${
              onSelectText ? "pointer-events-auto" : ""
            } ${canDrag ? "cursor-move" : onSelectText ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-transparent" : ""}`}
            style={positionStyles}
            onMouseDown={(e) => handleMouseDown(e, overlay)}
            onClick={(e) => {
              if (!isDragging) {
                e.stopPropagation();
                onSelectText?.(overlay.id);
              }
            }}
          >
            <div
              style={
                {
                  ...animationStyles,
                  fontSize: overlay.fontSize,
                  fontFamily: overlay.fontFamily,
                  color: overlay.color,
                  opacity: effectiveOpacity,
                  textShadow: overlay.shadow
                    ? `${overlay.shadowOffsetX ?? 2}px ${overlay.shadowOffsetY ?? 2}px ${overlay.shadowBlur ?? 4}px ${hexToRgba(overlay.shadowColor || "#000000", overlay.shadowOpacity ?? 0.5)}`
                    : undefined,
                  backgroundColor: overlay.backgroundColor || undefined,
                  padding: overlay.backgroundColor ? "4px 8px" : undefined,
                  borderRadius: overlay.backgroundColor ? "4px" : undefined,
                  whiteSpace: "nowrap",
                  WebkitTextStroke: (overlay as VideoTextOverlay).strokeWidth
                    ? `${(overlay as VideoTextOverlay).strokeWidth}px ${(overlay as VideoTextOverlay).strokeColor || "#000000"}`
                    : undefined,
                  userSelect: "none",
                } as React.CSSProperties
              }
            >
              {renderContent()}
            </div>
            {/* Drag indicator for selected text */}
            {canDrag && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-white bg-black/50 px-2 py-0.5 rounded whitespace-nowrap">
                Drag to move
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Add CSS keyframes for animations (will be injected into the document)
const style = document.createElement("style");
style.textContent = `
  @keyframes textFadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes textBounce {
    0% { transform: translateY(-100px); }
    60% { transform: translateY(20px); }
    80% { transform: translateY(-10px); }
    100% { transform: translateY(0); }
  }

  @keyframes textSlideUp {
    0% { transform: translateY(100%); }
    100% { transform: translateY(0); }
  }

  @keyframes textSlideDown {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(0); }
  }

  @keyframes textSlideLeft {
    0% { transform: translateX(100%); }
    100% { transform: translateX(0); }
  }

  @keyframes textSlideRight {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(0); }
  }
`;
document.head.appendChild(style);
