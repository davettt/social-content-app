import { useState, useRef, useEffect } from "react";
import { Button } from "../common/Button";
import {
  AlignmentPicker,
  getPositionCoordinates,
} from "../common/AlignmentPicker";
import type { Media, BrandKit, TextPosition } from "../../types";
import { SAFE_ZONE_MARGIN } from "../../types/post";

interface TextOverlay {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  color: string;
  position: TextPosition;
  shadow: boolean;
}

interface SlotAdjustment {
  scale: number; // 1.0 = 100%, range 1.0 - 3.0
  panX: number; // Offset in pixels (at full canvas size)
  panY: number; // Offset in pixels (at full canvas size)
}

interface CollageBuilderProps {
  availableMedia: Media[];
  brandKit?: BrandKit;
  onSave: (collageDataUrl: string) => void;
  onClose: () => void;
}

type LayoutType = "2x1" | "1x2" | "2x2" | "3x1" | "1+2" | "2+1";

const LAYOUTS: { type: LayoutType; label: string; slots: number }[] = [
  { type: "2x1", label: "2 Horizontal", slots: 2 },
  { type: "1x2", label: "2 Vertical", slots: 2 },
  { type: "2x2", label: "2x2 Grid", slots: 4 },
  { type: "3x1", label: "3 Horizontal", slots: 3 },
  { type: "1+2", label: "1 + 2", slots: 3 },
  { type: "2+1", label: "2 + 1", slots: 3 },
];

const FONTS = [
  "Inter",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Helvetica",
  "Impact",
];

const CANVAS_SIZE = 1080;

export function CollageBuilder({
  availableMedia,
  brandKit,
  onSave,
  onClose,
}: CollageBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const [selectedLayout, setSelectedLayout] = useState<LayoutType>("2x2");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [spacing, setSpacing] = useState(8);
  const [borderRadius, setBorderRadius] = useState(8);
  const [backgroundColor, setBackgroundColor] = useState(
    brandKit?.primaryColor || "#ffffff",
  );
  const [isRendering, setIsRendering] = useState(false);
  const [textOverlay, setTextOverlay] = useState<TextOverlay>({
    text: "",
    fontSize: 48,
    fontFamily: brandKit?.fonts?.heading || "Inter",
    fontWeight: "bold",
    color: "#ffffff",
    position: "bottom-center",
    shadow: false,
  });

  // Pan/zoom state for each slot
  const [slotAdjustments, setSlotAdjustments] = useState<
    Record<number, SlotAdjustment>
  >({});
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [layoutPositions, setLayoutPositions] = useState<
    { x: number; y: number; width: number; height: number }[]
  >([]);

  const currentLayout = LAYOUTS.find((l) => l.type === selectedLayout)!;
  const slotsNeeded = currentLayout.slots;

  // Calculate preview scale based on container size
  useEffect(() => {
    const updateScale = () => {
      if (previewRef.current) {
        const containerWidth = previewRef.current.offsetWidth;
        setPreviewScale(containerWidth / CANVAS_SIZE);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Get brand colors for quick selection (same pattern as ImageEditor)
  const getBrandColors = () => {
    const colors: { label: string; color: string }[] = [];
    if (brandKit?.primaryColor)
      colors.push({ label: "Primary", color: brandKit.primaryColor });
    if (brandKit?.secondaryColor)
      colors.push({ label: "Secondary", color: brandKit.secondaryColor });
    if (brandKit?.accentColor)
      colors.push({ label: "Accent", color: brandKit.accentColor });
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

  const handleImageSelect = (mediaId: string) => {
    if (selectedImages.includes(mediaId)) {
      setSelectedImages(selectedImages.filter((id) => id !== mediaId));
    } else if (selectedImages.length < slotsNeeded) {
      setSelectedImages([...selectedImages, mediaId]);
    }
  };

  // Calculate positions for each layout type
  const getLayoutPositions = (size: number, gap: number) => {
    const positions: { x: number; y: number; width: number; height: number }[] =
      [];
    const halfSize = (size - gap * 3) / 2;
    const thirdSize = (size - gap * 4) / 3;

    switch (selectedLayout) {
      case "2x1":
        positions.push({
          x: gap,
          y: gap,
          width: halfSize,
          height: size - gap * 2,
        });
        positions.push({
          x: gap * 2 + halfSize,
          y: gap,
          width: halfSize,
          height: size - gap * 2,
        });
        break;
      case "1x2":
        positions.push({
          x: gap,
          y: gap,
          width: size - gap * 2,
          height: halfSize,
        });
        positions.push({
          x: gap,
          y: gap * 2 + halfSize,
          width: size - gap * 2,
          height: halfSize,
        });
        break;
      case "2x2":
        positions.push({ x: gap, y: gap, width: halfSize, height: halfSize });
        positions.push({
          x: gap * 2 + halfSize,
          y: gap,
          width: halfSize,
          height: halfSize,
        });
        positions.push({
          x: gap,
          y: gap * 2 + halfSize,
          width: halfSize,
          height: halfSize,
        });
        positions.push({
          x: gap * 2 + halfSize,
          y: gap * 2 + halfSize,
          width: halfSize,
          height: halfSize,
        });
        break;
      case "3x1":
        positions.push({
          x: gap,
          y: gap,
          width: thirdSize,
          height: size - gap * 2,
        });
        positions.push({
          x: gap * 2 + thirdSize,
          y: gap,
          width: thirdSize,
          height: size - gap * 2,
        });
        positions.push({
          x: gap * 3 + thirdSize * 2,
          y: gap,
          width: thirdSize,
          height: size - gap * 2,
        });
        break;
      case "1+2":
        positions.push({
          x: gap,
          y: gap,
          width: halfSize,
          height: size - gap * 2,
        });
        positions.push({
          x: gap * 2 + halfSize,
          y: gap,
          width: halfSize,
          height: halfSize,
        });
        positions.push({
          x: gap * 2 + halfSize,
          y: gap * 2 + halfSize,
          width: halfSize,
          height: halfSize,
        });
        break;
      case "2+1":
        positions.push({ x: gap, y: gap, width: halfSize, height: halfSize });
        positions.push({
          x: gap * 2 + halfSize,
          y: gap,
          width: halfSize,
          height: halfSize,
        });
        positions.push({
          x: gap,
          y: gap * 2 + halfSize,
          width: size - gap * 2,
          height: halfSize,
        });
        break;
    }

    return positions;
  };

  // Render to canvas (used for both preview and export)
  const renderToCanvas = async (
    canvas: HTMLCanvasElement,
    size: number,
  ): Promise<void> => {
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    // Calculate scaled values
    const scaledSpacing = (spacing / CANVAS_SIZE) * size * 10;
    const scaledRadius = (borderRadius / CANVAS_SIZE) * size * 10;
    const positions = getLayoutPositions(size, scaledSpacing);

    // Helper function for rounded rectangles
    const roundedRect = (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    // Load and draw images
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    for (let i = 0; i < selectedImages.length; i++) {
      const mediaId = selectedImages[i];
      const media = availableMedia.find((m) => m.id === mediaId);
      const pos = positions[i];
      if (!media || !pos) continue;

      // Get slot adjustment (default: no zoom, centered)
      const adjustment = slotAdjustments[i] || { scale: 1, panX: 0, panY: 0 };
      const scaleFactor = size / CANVAS_SIZE; // Scale pan values for preview vs export

      try {
        const img = await loadImage(`/media/${media.originalPath}`);

        ctx.save();
        roundedRect(pos.x, pos.y, pos.width, pos.height, scaledRadius);
        ctx.clip();

        // Draw image to cover the area with zoom and pan applied
        const imgRatio = img.width / img.height;
        const boxRatio = pos.width / pos.height;
        let baseWidth, baseHeight, baseX, baseY;

        if (imgRatio > boxRatio) {
          baseHeight = pos.height;
          baseWidth = baseHeight * imgRatio;
          baseX = pos.x - (baseWidth - pos.width) / 2;
          baseY = pos.y;
        } else {
          baseWidth = pos.width;
          baseHeight = baseWidth / imgRatio;
          baseX = pos.x;
          baseY = pos.y - (baseHeight - pos.height) / 2;
        }

        // Apply zoom (scale from center of slot)
        const zoomedWidth = baseWidth * adjustment.scale;
        const zoomedHeight = baseHeight * adjustment.scale;
        const zoomOffsetX = (zoomedWidth - baseWidth) / 2;
        const zoomOffsetY = (zoomedHeight - baseHeight) / 2;

        // Apply pan (scaled for canvas size)
        const drawX = baseX - zoomOffsetX + adjustment.panX * scaleFactor;
        const drawY = baseY - zoomOffsetY + adjustment.panY * scaleFactor;

        ctx.drawImage(img, drawX, drawY, zoomedWidth, zoomedHeight);
        ctx.restore();
      } catch (e) {
        console.warn("Failed to load image:", e);
      }
    }

    // Draw text overlay if present
    if (textOverlay.text.trim()) {
      const scaledFontSize = (textOverlay.fontSize / CANVAS_SIZE) * size;
      ctx.font = `${textOverlay.fontWeight} ${scaledFontSize}px "${textOverlay.fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = textOverlay.color;

      // Get position coordinates using the 3x3 grid helper
      const {
        x: posX,
        y: posY,
        textAlign,
      } = getPositionCoordinates(
        textOverlay.position,
        size,
        size,
        SAFE_ZONE_MARGIN,
      );

      ctx.textAlign = textAlign;

      // Apply shadow if enabled
      if (textOverlay.shadow) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Set text baseline based on vertical position
      const isTop = textOverlay.position.startsWith("top");
      const isBottom = textOverlay.position.startsWith("bottom");
      if (isTop) {
        ctx.textBaseline = "top";
      } else if (isBottom) {
        ctx.textBaseline = "bottom";
      } else {
        ctx.textBaseline = "middle";
      }

      // Word wrap for long text
      const maxWidth = size * (1 - SAFE_ZONE_MARGIN * 2);
      const words = textOverlay.text.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Adjust Y for multi-line text
      const lineHeight = scaledFontSize * 1.2;
      let startY = posY;
      if (!isTop && !isBottom) {
        // Center - adjust to center all lines
        startY = posY - ((lines.length - 1) * lineHeight) / 2;
      } else if (isBottom) {
        // Bottom - move up for additional lines
        startY = posY - (lines.length - 1) * lineHeight;
      }

      // Draw each line
      lines.forEach((line, i) => {
        ctx.fillText(line, posX, startY + i * lineHeight);
      });

      // Reset shadow
      if (textOverlay.shadow) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }
  };

  // Update preview canvas whenever settings change
  useEffect(() => {
    if (!canvasRef.current || selectedImages.length === 0) return;
    const previewSize = Math.round(CANVAS_SIZE * previewScale);
    renderToCanvas(canvasRef.current, previewSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderToCanvas reads current state when called
  }, [
    selectedLayout,
    selectedImages,
    spacing,
    borderRadius,
    backgroundColor,
    textOverlay,
    previewScale,
    slotAdjustments,
  ]);

  // Update layout positions for hit testing (at preview scale)
  useEffect(() => {
    const scaledSpacing =
      (spacing / CANVAS_SIZE) * CANVAS_SIZE * previewScale * 10;
    const positions = getLayoutPositions(
      CANVAS_SIZE * previewScale,
      scaledSpacing,
    );
    setLayoutPositions(positions);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getLayoutPositions only depends on selectedLayout which is listed
  }, [selectedLayout, spacing, previewScale]);

  // Find which slot a point is in
  const getSlotAtPoint = (clientX: number, clientY: number): number | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = 0; i < layoutPositions.length; i++) {
      const pos = layoutPositions[i];
      if (
        pos &&
        x >= pos.x &&
        x <= pos.x + pos.width &&
        y >= pos.y &&
        y <= pos.y + pos.height
      ) {
        return i;
      }
    }
    return null;
  };

  // Mouse wheel handler for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const slotIndex = getSlotAtPoint(e.clientX, e.clientY);
    if (slotIndex === null || slotIndex >= selectedImages.length) return;

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const current = slotAdjustments[slotIndex] || {
      scale: 1,
      panX: 0,
      panY: 0,
    };
    const newScale = Math.max(1, Math.min(3, current.scale + delta));

    setSlotAdjustments({
      ...slotAdjustments,
      [slotIndex]: { ...current, scale: newScale },
    });
    setSelectedSlot(slotIndex);
  };

  // Mouse down handler for pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    const slotIndex = getSlotAtPoint(e.clientX, e.clientY);
    if (slotIndex === null || slotIndex >= selectedImages.length) return;

    setSelectedSlot(slotIndex);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Mouse move handler for pan
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || selectedSlot === null) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    const current = slotAdjustments[selectedSlot] || {
      scale: 1,
      panX: 0,
      panY: 0,
    };

    // Scale delta to canvas coordinates
    const scaledDeltaX = deltaX / previewScale;
    const scaledDeltaY = deltaY / previewScale;

    setSlotAdjustments({
      ...slotAdjustments,
      [selectedSlot]: {
        ...current,
        panX: current.panX + scaledDeltaX,
        panY: current.panY + scaledDeltaY,
      },
    });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Mouse up handler for pan end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset slot adjustment
  const resetSlotAdjustment = (slotIndex: number) => {
    const newAdjustments = { ...slotAdjustments };
    delete newAdjustments[slotIndex];
    setSlotAdjustments(newAdjustments);
  };

  const handleSave = async () => {
    setIsRendering(true);

    try {
      // Create a full-size canvas for export
      const exportCanvas = document.createElement("canvas");
      await renderToCanvas(exportCanvas, CANVAS_SIZE);
      const dataUrl = exportCanvas.toDataURL("image/png");
      onSave(dataUrl);
    } catch (error) {
      console.error("Failed to render collage:", error);
    } finally {
      setIsRendering(false);
    }
  };

  // Color swatch component for consistency (matches ImageEditor pattern)
  const ColorSwatches = ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (color: string) => void;
    label: string;
  }) => {
    const brandColors = getBrandColors();

    return (
      <div>
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
        {/* Brand Colors */}
        {brandColors.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {brandColors.slice(0, 8).map((c) => (
              <button
                key={c.color}
                onClick={() => onChange(c.color)}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  value.toLowerCase() === c.color.toLowerCase()
                    ? "border-white scale-110"
                    : "border-gray-600 hover:border-gray-400"
                }`}
                style={{ backgroundColor: c.color }}
                title={c.label}
              />
            ))}
          </div>
        )}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 rounded-lg cursor-pointer"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Create Collage</h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedImages.length < slotsNeeded || isRendering}
            isLoading={isRendering}
          >
            {isRendering ? "Creating..." : "Create Collage"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Preview */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-950">
          <div ref={previewRef} className="w-full max-w-md aspect-square">
            {selectedImages.length > 0 ? (
              <canvas
                ref={canvasRef}
                className="w-full h-full rounded-lg shadow-2xl"
                style={{
                  imageRendering: "auto",
                  cursor: isDragging ? "grabbing" : "grab",
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            ) : (
              <div
                className="w-full h-full rounded-lg flex items-center justify-center"
                style={{ backgroundColor }}
              >
                <p className="text-gray-400">Select images to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          {/* Layout Selection */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Layout</h3>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.type}
                  onClick={() => {
                    setSelectedLayout(layout.type);
                    setSelectedImages(selectedImages.slice(0, layout.slots));
                  }}
                  className={`p-3 rounded-lg text-center ${
                    selectedLayout === layout.type
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <div className="text-xs">{layout.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style Options */}
          <div className="p-4 border-b border-gray-700 space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Style</h3>

            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Spacing</span>
                <span>{spacing}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Border Radius</span>
                <span>{borderRadius}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                value={borderRadius}
                onChange={(e) => setBorderRadius(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <ColorSwatches
              label="Background Color"
              value={backgroundColor}
              onChange={setBackgroundColor}
            />
          </div>

          {/* Text Overlay */}
          <div className="p-4 border-b border-gray-700 space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Text Overlay</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Text</label>
              <textarea
                value={textOverlay.text}
                onChange={(e) =>
                  setTextOverlay({ ...textOverlay, text: e.target.value })
                }
                placeholder="Add text to your collage..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm resize-none"
                rows={2}
              />
            </div>

            {textOverlay.text && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Font
                  </label>
                  <select
                    value={textOverlay.fontFamily}
                    onChange={(e) =>
                      setTextOverlay({
                        ...textOverlay,
                        fontFamily: e.target.value,
                      })
                    }
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600"
                  >
                    {/* Brand fonts first if available */}
                    {brandKit?.fonts?.heading &&
                      !FONTS.includes(brandKit.fonts.heading) && (
                        <option value={brandKit.fonts.heading}>
                          {brandKit.fonts.heading} (Brand)
                        </option>
                      )}
                    {brandKit?.fonts?.body &&
                      !FONTS.includes(brandKit.fonts.body) &&
                      brandKit.fonts.body !== brandKit.fonts.heading && (
                        <option value={brandKit.fonts.body}>
                          {brandKit.fonts.body} (Brand)
                        </option>
                      )}
                    {FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Size</span>
                    <span>{textOverlay.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="24"
                    max="120"
                    value={textOverlay.fontSize}
                    onChange={(e) =>
                      setTextOverlay({
                        ...textOverlay,
                        fontSize: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Position
                  </label>
                  <AlignmentPicker
                    value={textOverlay.position}
                    onChange={(position) =>
                      setTextOverlay({ ...textOverlay, position })
                    }
                    size="sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Weight
                  </label>
                  <div className="flex gap-2">
                    {(["normal", "bold"] as const).map((weight) => (
                      <button
                        key={weight}
                        onClick={() =>
                          setTextOverlay({ ...textOverlay, fontWeight: weight })
                        }
                        className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                          textOverlay.fontWeight === weight
                            ? "bg-primary-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                        style={{ fontWeight: weight }}
                      >
                        {weight}
                      </button>
                    ))}
                  </div>
                </div>

                <ColorSwatches
                  label="Text Color"
                  value={textOverlay.color}
                  onChange={(color) =>
                    setTextOverlay({ ...textOverlay, color })
                  }
                />

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={textOverlay.shadow}
                      onChange={(e) =>
                        setTextOverlay({
                          ...textOverlay,
                          shadow: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-300">Drop Shadow</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Image Positioning */}
          {selectedImages.length > 0 && (
            <div className="p-4 border-b border-gray-700 space-y-4">
              <h3 className="text-sm font-medium text-gray-300">
                Image Positioning
              </h3>
              <p className="text-xs text-gray-400">
                Scroll to zoom, drag to pan. Click an image in the preview to
                select it.
              </p>

              {selectedSlot !== null && selectedSlot < selectedImages.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">
                      Slot {selectedSlot + 1} selected
                    </span>
                    <button
                      onClick={() => resetSlotAdjustment(selectedSlot)}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      Reset
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Zoom</span>
                      <span>
                        {(
                          (slotAdjustments[selectedSlot]?.scale || 1) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="300"
                      value={(slotAdjustments[selectedSlot]?.scale || 1) * 100}
                      onChange={(e) => {
                        const newScale = Number(e.target.value) / 100;
                        const current = slotAdjustments[selectedSlot] || {
                          scale: 1,
                          panX: 0,
                          panY: 0,
                        };
                        setSlotAdjustments({
                          ...slotAdjustments,
                          [selectedSlot]: { ...current, scale: newScale },
                        });
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Click on an image in the preview to adjust its position
                </p>
              )}
            </div>
          )}

          {/* Image Selection */}
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-300">
                Select Images
              </h3>
              <span className="text-xs text-gray-400">
                {selectedImages.length} / {slotsNeeded}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {availableMedia
                .filter((m) => m.type === "image")
                .map((media) => {
                  const isSelected = selectedImages.includes(media.id);
                  const position = selectedImages.indexOf(media.id);

                  return (
                    <button
                      key={media.id}
                      onClick={() => handleImageSelect(media.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                        isSelected ? "border-primary-500" : "border-transparent"
                      }`}
                      disabled={
                        !isSelected && selectedImages.length >= slotsNeeded
                      }
                    >
                      <img
                        src={`/media/${media.thumbnailPath}`}
                        alt=""
                        className={`w-full h-full object-cover object-center ${
                          !isSelected && selectedImages.length >= slotsNeeded
                            ? "opacity-50"
                            : ""
                        }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `/media/${media.originalPath}`;
                        }}
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {position + 1}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>

            {availableMedia.filter((m) => m.type === "image").length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                No images in library. Upload some images first.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
