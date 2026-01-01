import type { TextPosition } from "../../types";
import { TEXT_POSITIONS } from "../../types/post";

interface AlignmentPickerProps {
  value: TextPosition;
  onChange: (position: TextPosition) => void;
  /** Show labels on hover */
  showLabels?: boolean;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * 3x3 grid alignment picker for text positioning
 *
 * Layout:
 * ┌─────┬─────┬─────┐
 * │ TL  │ TC  │ TR  │  (left-align, center, right-align)
 * ├─────┼─────┼─────┤
 * │ ML  │ MC  │ MR  │
 * ├─────┼─────┼─────┤
 * │ BL  │ BC  │ BR  │
 * └─────┴─────┴─────┘
 */
export function AlignmentPicker({
  value,
  onChange,
  showLabels = true,
  size = "md",
}: AlignmentPickerProps) {
  const cellSize = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const lineSize = size === "sm" ? "w-3" : "w-4";
  const lineHeight = size === "sm" ? "h-0.5" : "h-0.5";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  // Get alignment icon based on position
  const getAlignmentIcon = (pos: TextPosition) => {
    const config = TEXT_POSITIONS.find((p) => p.position === pos);
    if (!config) return null;

    const { horizontalAlign, verticalAlign } = config;

    // Vertical position of lines within the cell (use justify for main axis in flex-col)
    const verticalClass =
      verticalAlign === "top"
        ? "justify-start pt-1.5"
        : verticalAlign === "bottom"
          ? "justify-end pb-1.5"
          : "justify-center";

    // Horizontal alignment of the lines
    const horizontalClass =
      horizontalAlign === "left"
        ? "items-start"
        : horizontalAlign === "right"
          ? "items-end"
          : "items-center";

    return (
      <div className={`flex flex-col ${verticalClass} w-full h-full`}>
        <div className={`flex flex-col gap-0.5 ${horizontalClass}`}>
          <div
            className={`${lineSize} ${lineHeight} bg-current rounded-full`}
          />
          <div
            className={`${lineHeight} bg-current rounded-full opacity-60`}
            style={{ width: horizontalAlign === "center" ? "80%" : "60%" }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`inline-grid grid-cols-3 ${gap} p-1 bg-gray-800 rounded-lg`}
    >
      {TEXT_POSITIONS.map((pos) => {
        const isSelected = value === pos.position;

        return (
          <button
            key={pos.position}
            onClick={() => onChange(pos.position)}
            className={`${cellSize} rounded flex items-center justify-center transition-all ${
              isSelected
                ? "bg-primary-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-300"
            }`}
            title={showLabels ? pos.label : undefined}
          >
            {getAlignmentIcon(pos.position)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Calculate x, y coordinates from a TextPosition
 * @param position - The 3x3 grid position
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param safeZoneMargin - Safe zone margin as percentage (0-1)
 * @returns { x, y, textAlign } coordinates and text alignment
 */
// eslint-disable-next-line react-refresh/only-export-components -- utility function tightly coupled to AlignmentPicker
export function getPositionCoordinates(
  position: TextPosition,
  canvasWidth: number,
  canvasHeight: number,
  safeZoneMargin: number = 0.05,
): { x: number; y: number; textAlign: "left" | "center" | "right" } {
  const config = TEXT_POSITIONS.find((p) => p.position === position);
  if (!config) {
    return { x: canvasWidth / 2, y: canvasHeight / 2, textAlign: "center" };
  }

  const marginX = canvasWidth * safeZoneMargin;
  const marginY = canvasHeight * safeZoneMargin;

  let x: number;
  let y: number;

  // Calculate X based on horizontal alignment
  switch (config.horizontalAlign) {
    case "left":
      x = marginX;
      break;
    case "right":
      x = canvasWidth - marginX;
      break;
    case "center":
    default:
      x = canvasWidth / 2;
      break;
  }

  // Calculate Y based on vertical alignment
  switch (config.verticalAlign) {
    case "top":
      y = marginY;
      break;
    case "bottom":
      y = canvasHeight - marginY;
      break;
    case "middle":
    default:
      y = canvasHeight / 2;
      break;
  }

  return { x, y, textAlign: config.horizontalAlign };
}
