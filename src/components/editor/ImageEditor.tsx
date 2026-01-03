import { useEffect, useRef, useState, useCallback } from "react";
import {
  Canvas,
  FabricImage,
  IText,
  Textbox,
  filters,
  Shadow,
  Line,
} from "fabric";
import { Button } from "../common/Button";
import {
  AlignmentPicker,
  getPositionCoordinates,
} from "../common/AlignmentPicker";
import { v4 as uuidv4 } from "uuid";
import type {
  Media,
  TextOverlay,
  ImageAdjustments,
  BrandKit,
  TextPosition,
} from "../../types";
import { SAFE_ZONE_MARGIN } from "../../types/post";

interface ImageEditorProps {
  media: Media;
  brandKit?: BrandKit;
  /** URL to load from (use for previously edited images) */
  editedImageUrl?: string;
  /** Initial adjustments to restore from previous edit session */
  initialAdjustments?: ImageAdjustments;
  /** Initial text overlays to restore from previous edit session */
  initialTextOverlays?: TextOverlay[];
  onSave: (
    dataUrl: string,
    edits: { adjustments: ImageAdjustments; textOverlays: TextOverlay[] },
  ) => void;
  onClose: () => void;
}

// Aspect ratios for future crop feature
// const ASPECT_RATIOS = [
//   { label: '1:1', value: 1 },
//   { label: '4:5', value: 4 / 5 },
//   { label: '9:16', value: 9 / 16 },
//   { label: '16:9', value: 16 / 9 },
//   { label: 'Free', value: null },
// ];

const FILTERS = [
  { name: "Original", filter: null },
  { name: "Vibrant", filter: { saturation: 0.3, brightness: 0.05 } },
  {
    name: "Moody",
    filter: { saturation: -0.2, brightness: -0.1, contrast: 0.1 },
  },
  { name: "Clean", filter: { brightness: 0.1, contrast: 0.05 } },
  { name: "Warm", filter: { saturation: 0.1, brightness: 0.05 } },
  { name: "Cool", filter: { saturation: -0.1, brightness: 0.05 } },
  { name: "B&W", filter: { saturation: -1 } },
];

const FONTS = [
  "Inter",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
];

export function ImageEditor({
  media,
  brandKit,
  editedImageUrl,
  initialAdjustments,
  initialTextOverlays,
  onSave,
  onClose,
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const imageRef = useRef<FabricImage | null>(null);

  const [activeTab, setActiveTab] = useState<
    "crop" | "adjust" | "filter" | "text"
  >("adjust");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(
    initialAdjustments || {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      rotation: 0,
      fineRotation: 0,
    },
  );
  const [selectedFilter, setSelectedFilter] = useState("Original");
  // Don't restore text overlays if editing a flattened image (text is baked in)
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>(
    editedImageUrl ? [] : initialTextOverlays || [],
  );
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const safeZoneLinesRef = useRef<Line[]>([]);

  // Image positioning state
  const [imageZoom, setImageZoom] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [isImageSelected, setIsImageSelected] = useState(false);

  // Constrain image position to keep it covering the canvas
  const constrainImagePosition = useCallback(
    (img: FabricImage, canvas: Canvas) => {
      const canvasWidth = canvas.width!;
      const canvasHeight = canvas.height!;
      const imgWidth = img.width! * img.scaleX!;
      const imgHeight = img.height! * img.scaleY!;

      let left = img.left!;
      let top = img.top!;

      // Image should not show background on any side
      // Constrain horizontal
      if (imgWidth >= canvasWidth) {
        if (left > 0) left = 0;
        if (left + imgWidth < canvasWidth) left = canvasWidth - imgWidth;
      } else {
        left = (canvasWidth - imgWidth) / 2;
      }

      // Constrain vertical
      if (imgHeight >= canvasHeight) {
        if (top > 0) top = 0;
        if (top + imgHeight < canvasHeight) top = canvasHeight - imgHeight;
      } else {
        top = (canvasHeight - imgHeight) / 2;
      }

      img.set({ left, top });
    },
    [],
  );

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 600,
      height: 600,
      backgroundColor: "#f3f4f6",
    });

    fabricCanvasRef.current = canvas;

    // Load image - use edited version if available, otherwise original
    const imageUrl = editedImageUrl || `/media/${media.originalPath}`;
    FabricImage.fromURL(imageUrl).then((img) => {
      if (!img) return;

      imageRef.current = img;

      // Scale to fit canvas
      const scale = Math.min(
        canvas.width! / img.width!,
        canvas.height! / img.height!,
      );

      setBaseScale(scale);
      img.scale(scale);
      img.set({
        left: (canvas.width! - img.width! * scale) / 2,
        top: (canvas.height! - img.height! * scale) / 2,
        // Make image selectable and draggable for pan/zoom
        selectable: true,
        evented: true,
        hasControls: false, // Hide resize/rotate handles
        hasBorders: true, // Show selection border
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      });

      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();

      // Constrain image movement to keep it covering the canvas
      img.on("moving", () => {
        constrainImagePosition(img, canvas);
      });

      // Only restore text overlays if editing original image (no editedImageUrl)
      // If editedImageUrl exists, text is already baked into the flattened image
      if (
        !editedImageUrl &&
        initialTextOverlays &&
        initialTextOverlays.length > 0
      ) {
        // Calculate max width for text wrapping
        const maxTextWidth = canvas.width! * (1 - 2 * SAFE_ZONE_MARGIN);

        initialTextOverlays.forEach((overlay) => {
          const text = new Textbox(overlay.text, {
            left: overlay.x,
            top: overlay.y,
            originX: "center",
            originY: "center",
            fontFamily: overlay.fontFamily,
            fontSize: overlay.fontSize,
            fill: overlay.color,
            textAlign: overlay.textAlign || "center",
            angle: overlay.rotation || 0,
            opacity: overlay.opacity || 1,
            width: maxTextWidth,
            splitByGrapheme: false,
          });
          // Store custom data on the object
          (text as unknown as { data: { id: string } }).data = {
            id: overlay.id,
          };

          // Apply shadow if enabled
          if (overlay.shadow) {
            text.set(
              "shadow",
              new Shadow({
                color: "rgba(0, 0, 0, 0.5)",
                blur: 4,
                offsetX: 2,
                offsetY: 2,
              }),
            );
          }

          canvas.add(text);
        });
        canvas.renderAll();
      }
    });

    // Handle wheel for zoom on image
    canvas.on("mouse:wheel", (opt) => {
      const img = imageRef.current;
      if (!img) return;

      opt.e.preventDefault();
      opt.e.stopPropagation();

      const delta = opt.e.deltaY > 0 ? -0.05 : 0.05;
      setImageZoom((prevZoom) => {
        const newZoom = Math.max(1, Math.min(3, prevZoom + delta));
        return newZoom;
      });
    });

    // Handle selection
    canvas.on("selection:created", (e) => {
      const obj = e.selected?.[0];
      if (obj === imageRef.current) {
        setIsImageSelected(true);
        setSelectedTextId(null);
      } else {
        setIsImageSelected(false);
        const typedObj = obj as { data?: { id: string } } | undefined;
        if (typedObj?.data?.id) {
          setSelectedTextId(typedObj.data.id);
        }
      }
    });

    canvas.on("selection:updated", (e) => {
      const obj = e.selected?.[0];
      if (obj === imageRef.current) {
        setIsImageSelected(true);
        setSelectedTextId(null);
      } else {
        setIsImageSelected(false);
        const typedObj = obj as { data?: { id: string } } | undefined;
        if (typedObj?.data?.id) {
          setSelectedTextId(typedObj.data.id);
        }
      }
    });

    canvas.on("selection:cleared", () => {
      setSelectedTextId(null);
      setIsImageSelected(false);
    });

    return () => {
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialTextOverlays only needed on mount
  }, [media.originalPath, editedImageUrl, constrainImagePosition]);

  // Apply zoom when imageZoom changes
  useEffect(() => {
    const img = imageRef.current;
    const canvas = fabricCanvasRef.current;
    if (!img || !canvas || baseScale === 0) return;

    const newScale = baseScale * imageZoom;
    const oldScale = img.scaleX!;

    // Get center of canvas for zoom centering
    const canvasCenter = { x: canvas.width! / 2, y: canvas.height! / 2 };

    // Calculate new position to zoom towards center
    const oldLeft = img.left!;
    const oldTop = img.top!;

    // Distance from image origin to canvas center before scaling
    const dx = canvasCenter.x - oldLeft;
    const dy = canvasCenter.y - oldTop;

    // Adjust position to keep the same point under the center
    const scaleFactor = newScale / oldScale;
    const newLeft = canvasCenter.x - dx * scaleFactor;
    const newTop = canvasCenter.y - dy * scaleFactor;

    img.set({
      scaleX: newScale,
      scaleY: newScale,
      left: newLeft,
      top: newTop,
    });

    // Constrain to keep image covering canvas
    constrainImagePosition(img, canvas);
    canvas.renderAll();
  }, [imageZoom, baseScale, constrainImagePosition]);

  // Draw/update safe zone guides
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing safe zone lines
    safeZoneLinesRef.current.forEach((line) => canvas.remove(line));
    safeZoneLinesRef.current = [];

    if (!showSafeZone) {
      canvas.renderAll();
      return;
    }

    const width = canvas.width!;
    const height = canvas.height!;
    const margin = SAFE_ZONE_MARGIN;
    const left = width * margin;
    const top = height * margin;
    const right = width * (1 - margin);
    const bottom = height * (1 - margin);

    const lineConfig = {
      stroke: "rgba(255, 255, 255, 0.3)",
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    };

    const lines = [
      new Line([left, top, right, top], lineConfig), // top
      new Line([left, bottom, right, bottom], lineConfig), // bottom
      new Line([left, top, left, bottom], lineConfig), // left
      new Line([right, top, right, bottom], lineConfig), // right
    ];

    lines.forEach((line) => canvas.add(line));
    safeZoneLinesRef.current = lines;
    canvas.renderAll();
  }, [showSafeZone]);

  // Reset image position
  const resetImagePosition = useCallback(() => {
    const img = imageRef.current;
    const canvas = fabricCanvasRef.current;
    if (!img || !canvas) return;

    setImageZoom(1);
    img.set({
      scaleX: baseScale,
      scaleY: baseScale,
      left: (canvas.width! - img.width! * baseScale) / 2,
      top: (canvas.height! - img.height! * baseScale) / 2,
    });
    canvas.renderAll();
  }, [baseScale]);

  // Rotate image by 90 degrees
  const rotateImage = useCallback(
    (direction: "left" | "right") => {
      const img = imageRef.current;
      const canvas = fabricCanvasRef.current;
      if (!img || !canvas) return;

      const currentRotation = adjustments.rotation || 0;
      const fineRotation = adjustments.fineRotation || 0;
      const delta = direction === "right" ? 90 : -90;
      let newRotation = (currentRotation + delta) % 360;
      if (newRotation < 0) newRotation += 360;

      // Set the rotation angle (including fine rotation)
      img.set({
        angle: newRotation + fineRotation,
        originX: "center",
        originY: "center",
      });

      // Recalculate scale to fit after rotation
      const isRotated90or270 = newRotation === 90 || newRotation === 270;
      const effectiveWidth = isRotated90or270 ? img.height! : img.width!;
      const effectiveHeight = isRotated90or270 ? img.width! : img.height!;

      const newBaseScale = Math.min(
        canvas.width! / effectiveWidth,
        canvas.height! / effectiveHeight,
      );

      setBaseScale(newBaseScale);
      setImageZoom(1);

      img.set({
        scaleX: newBaseScale,
        scaleY: newBaseScale,
        left: canvas.width! / 2,
        top: canvas.height! / 2,
      });

      canvas.renderAll();

      setAdjustments((prev) => ({
        ...prev,
        rotation: newRotation,
      }));
    },
    [adjustments.rotation, adjustments.fineRotation],
  );

  // Apply adjustments
  const applyAdjustments = useCallback((adj: ImageAdjustments) => {
    const img = imageRef.current;
    if (!img) return;

    const filtersList: filters.BaseFilter<string, object>[] = [];

    if (adj.brightness !== 0) {
      filtersList.push(
        new filters.Brightness({ brightness: adj.brightness / 100 }),
      );
    }
    if (adj.contrast !== 0) {
      filtersList.push(new filters.Contrast({ contrast: adj.contrast / 100 }));
    }
    if (adj.saturation !== 0) {
      filtersList.push(
        new filters.Saturation({ saturation: adj.saturation / 100 }),
      );
    }

    img.filters = filtersList;
    img.applyFilters();
    fabricCanvasRef.current?.renderAll();
  }, []);

  useEffect(() => {
    applyAdjustments(adjustments);
  }, [adjustments, applyAdjustments]);

  // Apply fine rotation when it changes (separate from zoom)
  useEffect(() => {
    const img = imageRef.current;
    const canvas = fabricCanvasRef.current;
    const fineRotation = adjustments.fineRotation || 0;
    const baseRotation = adjustments.rotation || 0;

    if (!img || !canvas) return;

    // Calculate total angle
    const totalAngle = baseRotation + fineRotation;

    // Just set the angle - let the zoom effect handle scaling
    img.set({ angle: totalAngle });
    canvas.renderAll();
  }, [adjustments.fineRotation, adjustments.rotation]);

  // Apply filter preset
  const applyFilterPreset = (filterName: string) => {
    setSelectedFilter(filterName);
    const preset = FILTERS.find((f) => f.name === filterName);

    if (!preset || !preset.filter) {
      setAdjustments((prev) => ({
        ...prev,
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }));
    } else {
      setAdjustments((prev) => ({
        ...prev,
        brightness: (preset.filter.brightness || 0) * 100,
        contrast: (preset.filter.contrast || 0) * 100,
        saturation: (preset.filter.saturation || 0) * 100,
      }));
    }
  };

  // Add text overlay
  const addTextOverlay = (
    initialText: string = "Your text here",
    position: TextPosition = "middle-center",
  ) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const id = uuidv4();
    const { x, y, textAlign } = getPositionCoordinates(
      position,
      canvas.width!,
      canvas.height!,
      SAFE_ZONE_MARGIN,
    );

    // Determine origin based on alignment
    const originX = textAlign;
    const originY = position.startsWith("top")
      ? "top"
      : position.startsWith("bottom")
        ? "bottom"
        : "center";

    // Calculate max width for text wrapping (canvas width minus safe zone margins)
    const maxTextWidth = canvas.width! * (1 - 2 * SAFE_ZONE_MARGIN);

    // Use Textbox for automatic text wrapping
    const text = new Textbox(initialText, {
      left: x,
      top: y,
      originX,
      originY,
      fontFamily: brandKit?.fonts?.heading || "Inter",
      fontSize: 32,
      fill: brandKit?.primaryColor || "#ffffff",
      textAlign,
      width: maxTextWidth,
      splitByGrapheme: false, // Wrap at word boundaries
      shadow: new Shadow({
        color: "rgba(0, 0, 0, 0.5)",
        blur: 4,
        offsetX: 2,
        offsetY: 2,
      }),
    });
    // Store custom data on the object
    (text as unknown as { data: { id: string } }).data = { id };

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    const overlay: TextOverlay = {
      id,
      text: initialText,
      x,
      y,
      fontSize: 32,
      fontFamily: brandKit?.fonts?.heading || "Inter",
      color: brandKit?.primaryColor || "#ffffff",
      opacity: 1,
      rotation: 0,
      textAlign,
      shadow: true,
      position,
    };

    setTextOverlays((prev) => [...prev, overlay]);
    setSelectedTextId(id);
  };

  // Move text to a specific position
  const moveTextToPosition = (position: TextPosition) => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (
      !canvas ||
      !activeObject ||
      (!(activeObject instanceof IText) && !(activeObject instanceof Textbox))
    )
      return;

    const { x, y, textAlign } = getPositionCoordinates(
      position,
      canvas.width!,
      canvas.height!,
      SAFE_ZONE_MARGIN,
    );

    // Determine origin based on alignment
    const originX = textAlign;
    const originY = position.startsWith("top")
      ? "top"
      : position.startsWith("bottom")
        ? "bottom"
        : "center";

    activeObject.set({
      left: x,
      top: y,
      originX,
      originY,
      textAlign,
    });
    canvas.renderAll();

    // Update state
    setTextOverlays((prev) =>
      prev.map((t) =>
        t.id === selectedTextId ? { ...t, x, y, textAlign, position } : t,
      ),
    );
  };

  // Format date for display (preserving the original date without timezone shift)
  const formatDate = (dateString: string) => {
    // Parse as UTC to avoid timezone shifting the date
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
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

  // Update text properties
  const updateTextProperty = (
    property: string,
    value: string | number | boolean,
  ) => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (
      activeObject &&
      (activeObject instanceof IText || activeObject instanceof Textbox)
    ) {
      switch (property) {
        case "fontFamily":
          activeObject.set("fontFamily", value as string);
          break;
        case "fontSize":
          activeObject.set("fontSize", value as number);
          break;
        case "fill":
          activeObject.set("fill", value as string);
          break;
        case "shadow":
          if (value) {
            activeObject.set(
              "shadow",
              new Shadow({
                color: "rgba(0, 0, 0, 0.5)",
                blur: 4,
                offsetX: 2,
                offsetY: 2,
              }),
            );
          } else {
            activeObject.set("shadow", null);
          }
          break;
      }
      canvas?.renderAll();

      // Update state - map Fabric.js property names to TextOverlay property names
      const stateProperty = property === "fill" ? "color" : property;
      setTextOverlays((prev) =>
        prev.map((t) =>
          t.id === selectedTextId ? { ...t, [stateProperty]: value } : t,
        ),
      );
    }
  };

  // Delete selected text
  const deleteSelectedText = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (activeObject && selectedTextId) {
      canvas?.remove(activeObject);
      canvas?.renderAll();
      setTextOverlays((prev) => prev.filter((t) => t.id !== selectedTextId));
      setSelectedTextId(null);
    }
  };

  // Save
  const handleSave = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Deselect all to remove selection handles from export
    canvas.discardActiveObject();

    // Temporarily hide safe zone lines for export
    safeZoneLinesRef.current.forEach((line) => line.set("visible", false));
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });

    // Restore safe zone lines visibility
    safeZoneLinesRef.current.forEach((line) => line.set("visible", true));
    canvas.renderAll();

    onSave(dataUrl, { adjustments, textOverlays });
  };

  const selectedText = textOverlays.find((t) => t.id === selectedTextId);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Edit Image</h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <canvas ref={canvasRef} className="rounded-lg shadow-2xl" />
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {(["adjust", "filter", "text"] as const).map((tab) => (
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
            {activeTab === "adjust" && (
              <div className="space-y-6">
                {/* Rotation Controls */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Rotation
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => rotateImage("left")}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
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
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                      Rotate Left
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => rotateImage("right")}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      Rotate Right
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
                          d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                        />
                      </svg>
                    </Button>
                  </div>
                  {(adjustments.rotation ?? 0) !== 0 && (
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Rotated {adjustments.rotation}°
                    </p>
                  )}

                  {/* Fine Rotation / Straighten */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span>Straighten</span>
                      <span>{adjustments.fineRotation ?? 0}°</span>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="0.5"
                      value={adjustments.fineRotation ?? 0}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        // Snap to 0 when close
                        const snappedValue =
                          Math.abs(value) < 0.5 ? 0 : value;
                        setAdjustments({
                          ...adjustments,
                          fineRotation: snappedValue,
                        });
                      }}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Fine-tune to level horizons
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Brightness</span>
                    <span>{adjustments.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={adjustments.brightness}
                    onChange={(e) =>
                      setAdjustments({
                        ...adjustments,
                        brightness: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Contrast</span>
                    <span>{adjustments.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={adjustments.contrast}
                    onChange={(e) =>
                      setAdjustments({
                        ...adjustments,
                        contrast: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Saturation</span>
                    <span>{adjustments.saturation}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={adjustments.saturation}
                    onChange={(e) =>
                      setAdjustments({
                        ...adjustments,
                        saturation: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Reset all adjustments including rotation
                    setAdjustments({
                      brightness: 0,
                      contrast: 0,
                      saturation: 0,
                      rotation: 0,
                      fineRotation: 0,
                    });
                    // Reset image rotation
                    const img = imageRef.current;
                    const canvas = fabricCanvasRef.current;
                    if (img && canvas) {
                      img.set({ angle: 0 });
                      canvas.renderAll();
                    }
                  }}
                  className="w-full"
                >
                  Reset Adjustments
                </Button>

                {/* Image Positioning */}
                <div className="pt-6 mt-6 border-t border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">
                    Image Position
                  </h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Click image to select, then drag to pan or scroll to zoom.
                  </p>

                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                      <span>Zoom</span>
                      <span>{Math.round(imageZoom * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="300"
                      value={imageZoom * 100}
                      onChange={(e) =>
                        setImageZoom(Number(e.target.value) / 100)
                      }
                      className="w-full"
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resetImagePosition}
                    className="w-full"
                  >
                    Reset Position
                  </Button>

                  {isImageSelected && (
                    <p className="text-xs text-primary-400 mt-2 text-center">
                      Image selected - drag to reposition
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "filter" && (
              <div className="grid grid-cols-3 gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.name}
                    onClick={() => applyFilterPreset(filter.name)}
                    className={`p-2 rounded-lg text-center ${
                      selectedFilter === filter.name
                        ? "bg-primary-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    <div className="w-full aspect-square bg-gray-600 rounded mb-1" />
                    <span className="text-xs">{filter.name}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === "text" && (
              <div className="space-y-4">
                <Button onClick={() => addTextOverlay()} className="w-full">
                  + Add Text
                </Button>

                {/* Safe Zone Toggle */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSafeZone}
                      onChange={(e) => setShowSafeZone(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-300">
                      Show Safe Zone
                    </span>
                  </label>
                  <span className="text-xs text-gray-500">5% margin</span>
                </div>

                {/* Media Metadata Section */}
                {(media.metadata.dateTaken ||
                  media.metadata.location ||
                  media.metadata.camera) && (
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">
                      Photo Info (click to add as text)
                    </p>
                    <div className="space-y-2">
                      {media.metadata.dateTaken && (
                        <button
                          onClick={() =>
                            addTextOverlay(
                              formatDate(media.metadata.dateTaken!),
                            )
                          }
                          className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                        >
                          <span className="text-gray-400">Date: </span>
                          <span className="text-white">
                            {formatDate(media.metadata.dateTaken)}
                          </span>
                        </button>
                      )}
                      {(media.metadata.location ||
                        media.userMetadata.customLocation) && (
                        <button
                          onClick={() =>
                            addTextOverlay(
                              media.userMetadata.customLocation ||
                                media.metadata.location?.placeName ||
                                `${media.metadata.location?.latitude.toFixed(4)}, ${media.metadata.location?.longitude.toFixed(4)}`,
                            )
                          }
                          className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm break-words"
                        >
                          <span className="text-gray-400">Location: </span>
                          <span className="text-white break-words">
                            {media.userMetadata.customLocation ||
                              media.metadata.location?.placeName ||
                              `${media.metadata.location?.latitude.toFixed(4)}, ${media.metadata.location?.longitude.toFixed(4)}`}
                          </span>
                        </button>
                      )}
                      {media.metadata.camera && (
                        <button
                          onClick={() => addTextOverlay(media.metadata.camera!)}
                          className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                        >
                          <span className="text-gray-400">Camera: </span>
                          <span className="text-white">
                            {media.metadata.camera}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedText && (
                  <div className="space-y-4 pt-4 border-t border-gray-700">
                    {/* Position Picker */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">
                        Position
                      </label>
                      <div className="flex items-center gap-3">
                        <AlignmentPicker
                          value={selectedText.position || "middle-center"}
                          onChange={moveTextToPosition}
                        />
                        <p className="text-xs text-gray-500">
                          Or drag text freely on canvas
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Font
                      </label>
                      <select
                        value={selectedText.fontFamily}
                        onChange={(e) =>
                          updateTextProperty("fontFamily", e.target.value)
                        }
                        className="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
                      >
                        {/* Brand fonts first if available */}
                        {brandKit?.fonts?.heading &&
                          !FONTS.includes(brandKit.fonts.heading) && (
                            <option value={brandKit.fonts.heading}>
                              {brandKit.fonts.heading} (Brand Heading)
                            </option>
                          )}
                        {brandKit?.fonts?.body &&
                          !FONTS.includes(brandKit.fonts.body) &&
                          brandKit.fonts.body !== brandKit.fonts.heading && (
                            <option value={brandKit.fonts.body}>
                              {brandKit.fonts.body} (Brand Body)
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
                      <label className="block text-sm text-gray-300 mb-1">
                        Size
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="120"
                        value={selectedText.fontSize}
                        onChange={(e) =>
                          updateTextProperty("fontSize", Number(e.target.value))
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Color
                      </label>
                      {/* Brand Colors Quick Select */}
                      {getBrandColors().length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {getBrandColors()
                            .slice(0, 8)
                            .map((c) => (
                              <button
                                key={c.color}
                                onClick={() =>
                                  updateTextProperty("fill", c.color)
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
                      <input
                        type="color"
                        value={selectedText.color}
                        onChange={(e) =>
                          updateTextProperty("fill", e.target.value)
                        }
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedText.shadow || false}
                          onChange={(e) =>
                            updateTextProperty("shadow", e.target.checked)
                          }
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-300">
                          Drop Shadow
                        </span>
                      </label>
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={deleteSelectedText}
                      className="w-full"
                    >
                      Delete Text
                    </Button>
                  </div>
                )}

                {textOverlays.length > 0 && (
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">
                      Text Layers ({textOverlays.length})
                    </p>
                    {textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className={`p-2 rounded-lg mb-1 cursor-pointer ${
                          overlay.id === selectedTextId
                            ? "bg-gray-600"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                        onClick={() => {
                          const canvas = fabricCanvasRef.current;
                          const objects = canvas?.getObjects();
                          const textObj = objects?.find(
                            (o) =>
                              (o as unknown as { data?: { id: string } }).data
                                ?.id === overlay.id,
                          );
                          if (textObj) {
                            canvas?.setActiveObject(textObj);
                            canvas?.renderAll();
                          }
                        }}
                      >
                        <p className="text-sm text-white truncate">
                          {overlay.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
