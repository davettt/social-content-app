import { useEffect, useRef, useState, useCallback } from "react";
import {
  Canvas,
  FabricImage,
  IText,
  Textbox,
  FabricObject,
  Path,
  Group,
  Rect,
  Circle,
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
  GraphicOverlay,
  ImageAdjustments,
  BrandKit,
  TextPosition,
  GraphicType,
} from "../../types";
import { SAFE_ZONE_MARGIN } from "../../types/post";
import { editsApi } from "../../services/api";

interface ImageEditorProps {
  media: Media;
  projectId: string;
  brandKit?: BrandKit;
  /** URL to load from (use for previously edited images) */
  editedImageUrl?: string;
  /** Initial adjustments to restore from previous edit session */
  initialAdjustments?: ImageAdjustments;
  /** Initial text overlays to restore from previous edit session */
  initialTextOverlays?: TextOverlay[];
  /** Initial graphic overlays to restore from previous edit session */
  initialGraphicOverlays?: GraphicOverlay[];
  /** Aspect ratio for the canvas (width/height). Defaults to 1 (square) */
  aspectRatio?: { width: number; height: number };
  onSave: (
    dataUrl: string,
    edits: {
      adjustments: ImageAdjustments;
      textOverlays: TextOverlay[];
      graphicOverlays: GraphicOverlay[];
    },
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

// SVG icon paths (24x24 viewbox)
const ICON_PATHS: Record<string, string> = {
  "quote-open": "M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z",
  "quote-close": "M18 7h-3l-2 4v6h6v-6h-3zm-8 0H7l-2 4v6h6v-6H8z",
  camera:
    "M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM12 10a2 2 0 110 4 2 2 0 010-4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zM4 6h3.17L9 4h6l1.83 2H20v12H4V6zm15 1a1 1 0 110 2 1 1 0 010-2z",
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  sparkle:
    "M12 1l1.8 5.4L19.2 8l-5.4 1.6L12 15l-1.8-5.4L4.8 8l5.4-1.6zM19 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM5 2l.7 2.1L7.8 4.8l-2.1.7L5 7.6l-.7-2.1L2.2 4.8l2.1-.7z",
  film: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
  arrow: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  checkmark:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
};

const ICON_LABELS: Record<string, string> = {
  "quote-open": "Quote Open",
  "quote-close": "Quote Close",
  camera: "Camera",
  heart: "Heart",
  sparkle: "Sparkles",
  film: "Film",
  arrow: "Arrow",
  checkmark: "Checkmark",
};

// Star path for a single star (scaled to ~20x20)
const STAR_PATH =
  "M10 0l3.09 6.26L20 7.27l-5 4.87L16.18 20 10 16.27 3.82 20 5 12.14 0 7.27l6.91-1.01z";

// Frame shape path generators (used with fillRule: evenodd for transparent centers)

function generatePolaroidPath(w: number, h: number): string {
  const side = w * 0.08;
  const top = h * 0.06;
  const bottom = h * 0.25;
  // Outer rectangle + inner cutout (evenodd makes the inner area transparent)
  return (
    `M 0 0 H ${w} V ${h} H 0 Z ` +
    `M ${side} ${top} H ${w - side} V ${h - bottom} H ${side} Z`
  );
}

function generateBumpyFramePath(
  w: number,
  h: number,
  bumpRadius: number,
  frameWidth: number,
): string {
  const r = bumpRadius;

  let outer = "M 0 0";

  // Top edge (left to right) — outward bumps (sweep=0)
  const topCount = Math.max(3, Math.round(w / (r * 3)));
  const topStep = w / topCount;
  for (let i = 0; i < topCount; i++) {
    const cx = (i + 0.5) * topStep;
    outer += ` L ${cx - r} 0 A ${r} ${r} 0 0 0 ${cx + r} 0`;
  }
  outer += ` L ${w} 0`;

  // Right edge (top to bottom)
  const rightCount = Math.max(3, Math.round(h / (r * 3)));
  const rightStep = h / rightCount;
  for (let i = 0; i < rightCount; i++) {
    const cy = (i + 0.5) * rightStep;
    outer += ` L ${w} ${cy - r} A ${r} ${r} 0 0 0 ${w} ${cy + r}`;
  }
  outer += ` L ${w} ${h}`;

  // Bottom edge (right to left)
  for (let i = topCount - 1; i >= 0; i--) {
    const cx = (i + 0.5) * topStep;
    outer += ` L ${cx + r} ${h} A ${r} ${r} 0 0 0 ${cx - r} ${h}`;
  }
  outer += ` L 0 ${h}`;

  // Left edge (bottom to top)
  for (let i = rightCount - 1; i >= 0; i--) {
    const cy = (i + 0.5) * rightStep;
    outer += ` L 0 ${cy + r} A ${r} ${r} 0 0 0 0 ${cy - r}`;
  }
  outer += " Z";

  // Inner rectangular cutout
  const inner = `M ${frameWidth} ${frameWidth} H ${w - frameWidth} V ${h - frameWidth} H ${frameWidth} Z`;

  return `${outer} ${inner}`;
}

function generateStampPath(w: number, h: number): string {
  const r = Math.min(w, h) * 0.025;
  const frame = Math.min(w, h) * 0.12;
  return generateBumpyFramePath(w, h, r, frame);
}

function generateScallopedPath(w: number, h: number): string {
  const r = Math.min(w, h) * 0.055;
  const frame = Math.min(w, h) * 0.1;
  return generateBumpyFramePath(w, h, r, frame);
}

// Base canvas size (longest dimension)
const CANVAS_BASE_SIZE = 600;

export function ImageEditor({
  media,
  projectId,
  brandKit,
  editedImageUrl,
  initialAdjustments,
  initialTextOverlays,
  initialGraphicOverlays,
  aspectRatio = { width: 1, height: 1 },
  onSave,
  onClose,
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const imageRef = useRef<FabricImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  // Calculate canvas dimensions based on aspect ratio
  const ratio = aspectRatio.width / aspectRatio.height;
  const canvasWidth =
    ratio >= 1 ? CANVAS_BASE_SIZE : Math.round(CANVAS_BASE_SIZE * ratio);
  const canvasHeight =
    ratio >= 1 ? Math.round(CANVAS_BASE_SIZE / ratio) : CANVAS_BASE_SIZE;

  const [activeTab, setActiveTab] = useState<
    "crop" | "adjust" | "filter" | "text" | "graphics"
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
  const [graphicOverlays, setGraphicOverlays] = useState<GraphicOverlay[]>(
    editedImageUrl ? [] : initialGraphicOverlays || [],
  );
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(
    null,
  );
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

      // With center origin, left/top is the center of the image
      // Image edges: left edge = left - imgWidth/2, right edge = left + imgWidth/2

      // Constrain horizontal (image should cover canvas)
      if (imgWidth >= canvasWidth) {
        // Left edge should not go past 0
        if (left - imgWidth / 2 > 0) left = imgWidth / 2;
        // Right edge should not be before canvas width
        if (left + imgWidth / 2 < canvasWidth)
          left = canvasWidth - imgWidth / 2;
      } else {
        // Image smaller than canvas - center it
        left = canvasWidth / 2;
      }

      // Constrain vertical
      if (imgHeight >= canvasHeight) {
        // Top edge should not go past 0
        if (top - imgHeight / 2 > 0) top = imgHeight / 2;
        // Bottom edge should not be before canvas height
        if (top + imgHeight / 2 < canvasHeight)
          top = canvasHeight - imgHeight / 2;
      } else {
        // Image smaller than canvas - center it
        top = canvasHeight / 2;
      }

      img.set({ left, top });
    },
    [],
  );

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#f3f4f6",
      preserveObjectStacking: true,
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
        // Use center origin for consistent rotation behavior
        originX: "center",
        originY: "center",
        left: canvas.width! / 2,
        top: canvas.height! / 2,
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

      // Only restore overlays if editing original image (no editedImageUrl)
      // If editedImageUrl exists, content is already baked into the flattened image
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
            backgroundColor: overlay.backgroundColor,
            stroke: overlay.strokeColor,
            strokeWidth: overlay.strokeWidth || 0,
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

      // Restore graphic overlays
      if (
        !editedImageUrl &&
        initialGraphicOverlays &&
        initialGraphicOverlays.length > 0
      ) {
        initialGraphicOverlays.forEach((overlay) => {
          const fabricObj = createGraphicFabricObject(overlay);
          if (fabricObj) {
            canvas.add(fabricObj);
          }
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
    const handleSelection = (obj: FabricObject | undefined) => {
      if (obj === imageRef.current) {
        setIsImageSelected(true);
        setSelectedTextId(null);
        setSelectedGraphicId(null);
      } else {
        setIsImageSelected(false);
        const typedObj = obj as
          | { data?: { id: string; elementType?: string } }
          | undefined;
        if (typedObj?.data?.elementType === "graphic") {
          setSelectedGraphicId(typedObj.data.id);
          setSelectedTextId(null);
        } else if (typedObj?.data?.id) {
          setSelectedTextId(typedObj.data.id);
          setSelectedGraphicId(null);
        }
      }
    };

    canvas.on("selection:created", (e) => {
      handleSelection(e.selected?.[0]);
    });

    canvas.on("selection:updated", (e) => {
      handleSelection(e.selected?.[0]);
    });

    canvas.on("selection:cleared", () => {
      setSelectedTextId(null);
      setSelectedGraphicId(null);
      setIsImageSelected(false);
    });

    return () => {
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialTextOverlays only needed on mount
  }, [
    media.originalPath,
    editedImageUrl,
    constrainImagePosition,
    canvasWidth,
    canvasHeight,
  ]);

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
      stroke: undefined,
      strokeWidth: 0,
      backgroundColor: undefined,
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
      backgroundColor: undefined,
      opacity: 1,
      rotation: 0,
      textAlign,
      shadow: true,
      shadowColor: "#000000",
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.5,
      position,
      strokeColor: undefined,
      strokeWidth: 0,
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
        case "shadowColor":
        case "shadowBlur":
        case "shadowOffsetX":
        case "shadowOffsetY":
        case "shadowOpacity":
          if (property === "shadow" && !value) {
            activeObject.set("shadow", null);
          } else if (selectedText?.shadow || property !== "shadow") {
            const color = selectedText?.shadowColor || "#000000";
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            const opacity = selectedText?.shadowOpacity ?? 0.5;

            activeObject.set(
              "shadow",
              new Shadow({
                color: `rgba(${r}, ${g}, ${b}, ${opacity})`,
                blur: selectedText?.shadowBlur ?? 4,
                offsetX: selectedText?.shadowOffsetX ?? 2,
                offsetY: selectedText?.shadowOffsetY ?? 2,
              }),
            );
          }
          break;
        case "backgroundColor":
          // Empty string means clear the background
          activeObject.set(
            "backgroundColor",
            value ? (value as string) : undefined,
          );
          break;
        case "strokeColor":
          // Empty string means clear the stroke
          activeObject.set("stroke", value ? (value as string) : undefined);
          break;
        case "strokeWidth":
          activeObject.set("strokeWidth", value as number);
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

  // ============ GRAPHIC OVERLAY FUNCTIONS ============

  // Create a Fabric.js object from a GraphicOverlay definition
  const createGraphicFabricObject = (
    overlay: GraphicOverlay,
  ): FabricObject | null => {
    let fabricObj: FabricObject | null = null;

    if (overlay.type === "stars") {
      const count = overlay.starCount || 5;
      const style = overlay.starStyle || "filled";
      const starSize = 20;
      const gap = 4;
      const stars: FabricObject[] = [];

      for (let i = 0; i < 5; i++) {
        const isFilled = i < count;
        const star = new Path(STAR_PATH, {
          left: i * (starSize + gap),
          top: 0,
          fill: isFilled
            ? style === "filled"
              ? overlay.color
              : "transparent"
            : "transparent",
          stroke: overlay.color,
          strokeWidth: style === "outline" || !isFilled ? 1.5 : 0,
          scaleX: starSize / 20,
          scaleY: starSize / 20,
        });
        stars.push(star);
      }

      fabricObj = new Group(stars, {
        left: overlay.x,
        top: overlay.y,
        originX: "center",
        originY: "center",
        angle: overlay.rotation || 0,
        opacity: overlay.opacity,
      });
    } else if (overlay.type === "icon") {
      const pathData = ICON_PATHS[overlay.iconName || "heart"];
      if (pathData) {
        fabricObj = new Path(pathData, {
          left: overlay.x,
          top: overlay.y,
          originX: "center",
          originY: "center",
          fill: overlay.color,
          stroke: undefined,
          scaleX: overlay.width / 24,
          scaleY: overlay.height / 24,
          angle: overlay.rotation || 0,
          opacity: overlay.opacity,
        });
      }
    } else if (overlay.type === "shape") {
      const shapeName = overlay.shapeName || "rounded-rect";
      if (shapeName === "circle") {
        fabricObj = new Circle({
          left: overlay.x,
          top: overlay.y,
          originX: "center",
          originY: "center",
          radius: overlay.width / 2,
          fill: overlay.fill || "transparent",
          stroke: overlay.stroke || overlay.color,
          strokeWidth: overlay.strokeWidth || 2,
          angle: overlay.rotation || 0,
          opacity: overlay.opacity,
        });
      } else if (shapeName === "rounded-rect" || shapeName === "banner") {
        fabricObj = new Rect({
          left: overlay.x,
          top: overlay.y,
          originX: "center",
          originY: "center",
          width: overlay.width,
          height: overlay.height,
          fill: overlay.fill || "transparent",
          stroke: overlay.stroke || overlay.color,
          strokeWidth: overlay.strokeWidth || 2,
          rx: overlay.cornerRadius ?? 8,
          ry: overlay.cornerRadius ?? 8,
          angle: overlay.rotation || 0,
          opacity: overlay.opacity,
        });
      } else if (
        shapeName === "polaroid" ||
        shapeName === "stamp" ||
        shapeName === "scalloped"
      ) {
        let pathData: string;
        if (shapeName === "polaroid") {
          pathData = generatePolaroidPath(overlay.width, overlay.height);
        } else if (shapeName === "stamp") {
          pathData = generateStampPath(overlay.width, overlay.height);
        } else {
          pathData = generateScallopedPath(overlay.width, overlay.height);
        }
        fabricObj = new Path(pathData, {
          left: overlay.x,
          top: overlay.y,
          originX: "center",
          originY: "center",
          fill: overlay.fill || "#ffffff",
          fillRule: "evenodd",
          stroke: overlay.stroke || overlay.color,
          strokeWidth: overlay.strokeWidth ?? 0,
          angle: overlay.rotation || 0,
          opacity: overlay.opacity,
        });
      }
    }

    if (fabricObj) {
      (
        fabricObj as unknown as {
          data: { id: string; elementType: string };
        }
      ).data = { id: overlay.id, elementType: "graphic" };
    }

    return fabricObj;
  };

  // Add a graphic overlay to the canvas
  const addGraphicOverlay = (
    type: GraphicType,
    options: Partial<GraphicOverlay> = {},
  ) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const id = uuidv4();
    const defaultColor = brandKit?.primaryColor || "#ffffff";

    const overlay: GraphicOverlay = {
      id,
      type,
      x: canvas.width! / 2,
      y: canvas.height! / 2,
      width: type === "stars" ? 140 : 60,
      height: 60,
      color: defaultColor,
      opacity: 1,
      rotation: 0,
      ...(type === "stars" && {
        starCount: options.starCount ?? 5,
        starStyle: options.starStyle ?? "filled",
      }),
      ...(type === "icon" && {
        iconName: options.iconName ?? "heart",
      }),
      ...(type === "shape" && {
        shapeName: options.shapeName ?? "rounded-rect",
        fill: options.fill ?? "transparent",
        stroke: options.stroke ?? defaultColor,
        strokeWidth: options.strokeWidth ?? 2,
        cornerRadius: options.cornerRadius ?? 8,
      }),
      ...options,
    };

    const fabricObj = createGraphicFabricObject(overlay);
    if (!fabricObj) return;

    canvas.add(fabricObj);
    canvas.setActiveObject(fabricObj);
    canvas.renderAll();

    setGraphicOverlays((prev) => [...prev, overlay]);
    setSelectedGraphicId(id);
    setSelectedTextId(null);
  };

  // Update a property on the selected graphic overlay
  const updateGraphicProperty = (
    property: keyof GraphicOverlay,
    value: string | number | boolean,
  ) => {
    if (!selectedGraphicId) return;

    // Update state
    setGraphicOverlays((prev) =>
      prev.map((g) =>
        g.id === selectedGraphicId ? { ...g, [property]: value } : g,
      ),
    );

    // Rebuild the fabric object on canvas
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const updatedOverlay = graphicOverlays.find(
      (g) => g.id === selectedGraphicId,
    );
    if (!updatedOverlay) return;

    const newOverlayData = { ...updatedOverlay, [property]: value };

    // Remove old object
    const objects = canvas.getObjects();
    const oldObj = objects.find(
      (o) =>
        (o as unknown as { data?: { id: string } }).data?.id ===
        selectedGraphicId,
    );
    if (oldObj) {
      // Preserve position from canvas object (user may have dragged it)
      newOverlayData.x = oldObj.left ?? newOverlayData.x;
      newOverlayData.y = oldObj.top ?? newOverlayData.y;
      newOverlayData.rotation = oldObj.angle ?? newOverlayData.rotation;
      canvas.remove(oldObj);
    }

    // Create new object with updated properties
    const newObj = createGraphicFabricObject(newOverlayData);
    if (newObj) {
      canvas.add(newObj);
      canvas.setActiveObject(newObj);
      canvas.renderAll();
    }

    // Update position in state too
    setGraphicOverlays((prev) =>
      prev.map((g) => (g.id === selectedGraphicId ? { ...newOverlayData } : g)),
    );
  };

  // Delete selected graphic
  const deleteSelectedGraphic = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (activeObject && selectedGraphicId) {
      canvas?.remove(activeObject);
      canvas?.renderAll();
      setGraphicOverlays((prev) =>
        prev.filter((g) => g.id !== selectedGraphicId),
      );
      setSelectedGraphicId(null);
    }
  };

  const selectedGraphic = graphicOverlays.find(
    (g) => g.id === selectedGraphicId,
  );

  // Generate canvas data URL
  const getCanvasDataUrl = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return null;

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

    return dataUrl;
  }, []);

  // Reset to original image
  const handleReset = () => {
    const canvas = fabricCanvasRef.current;

    // Remove all text and graphic objects from canvas
    if (canvas) {
      const objects = canvas.getObjects();
      const overlayObjects = objects.filter(
        (obj) =>
          obj instanceof IText ||
          obj instanceof Textbox ||
          (obj as unknown as { data?: { elementType?: string } }).data
            ?.elementType === "graphic",
      );
      overlayObjects.forEach((obj) => canvas.remove(obj));
      canvas.renderAll();
    }

    setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      rotation: 0,
      fineRotation: 0,
    });
    setTextOverlays([]);
    setSelectedTextId(null);
    setGraphicOverlays([]);
    setSelectedGraphicId(null);
  };

  // Save to disk and close
  const handleSaveAndClose = async () => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) return;

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // Map textOverlays to include fontWeight for API compatibility
      const apiTextOverlays = textOverlays.map((overlay) => ({
        id: overlay.id,
        text: overlay.text,
        x: overlay.x,
        y: overlay.y,
        fontSize: overlay.fontSize,
        fontFamily: overlay.fontFamily,
        fontWeight: "normal", // Default since internal type doesn't have this
        color: overlay.color,
        textAlign: overlay.textAlign,
        shadow: overlay.shadow ?? false,
        opacity: overlay.opacity,
        position: overlay.position ?? "middle-center",
      }));

      await editsApi.saveImageEdit(projectId, media.id, {
        dataUrl,
        adjustments,
        textOverlays: apiTextOverlays,
        graphicOverlays,
      });

      // Also update memory store
      onSave(dataUrl, { adjustments, textOverlays, graphicOverlays });

      setSaveStatus("saved");
      // Brief delay to show success, then close
      setTimeout(() => onClose(), 500);
    } catch (error) {
      console.error("Failed to save edits:", error);
      setSaveStatus("error");
      setIsSaving(false);
    }
  };

  const selectedText = textOverlays.find((t) => t.id === selectedTextId);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-white">Edit Image</h2>
          {saveStatus === "saved" && (
            <p className="text-xs text-green-400">Edits saved to disk</p>
          )}
          {saveStatus === "error" && (
            <p className="text-xs text-red-400">Failed to save edits</p>
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
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <canvas ref={canvasRef} className="rounded-lg shadow-2xl" />
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {(["adjust", "filter", "text", "graphics"] as const).map((tab) => (
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
                        const snappedValue = Math.abs(value) < 0.5 ? 0 : value;
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
                      <label className="text-sm text-gray-300 block mb-2">
                        Background Color
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          onClick={() =>
                            updateTextProperty("backgroundColor", "")
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
                        {getBrandColors()
                          .slice(0, 7)
                          .map((c) => (
                            <button
                              key={c.color}
                              onClick={() =>
                                updateTextProperty("backgroundColor", c.color)
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
                      {selectedText.backgroundColor && (
                        <input
                          type="color"
                          value={selectedText.backgroundColor}
                          onChange={(e) =>
                            updateTextProperty(
                              "backgroundColor",
                              e.target.value,
                            )
                          }
                          className="w-full h-10 rounded-lg cursor-pointer"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-sm text-gray-300 block mb-2">
                        Text Outline Color
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          onClick={() => {
                            updateTextProperty("strokeColor", "");
                            updateTextProperty("strokeWidth", 0);
                          }}
                          className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                            !selectedText.strokeColor ||
                            !selectedText.strokeWidth
                              ? "border-white scale-110"
                              : "border-gray-600 hover:border-gray-400"
                          }`}
                          style={{
                            background:
                              "linear-gradient(135deg, #374151 45%, transparent 45%, transparent 55%, #374151 55%), linear-gradient(45deg, #ef4444 50%, transparent 50%)",
                          }}
                          title="None"
                        />
                        {getBrandColors()
                          .slice(0, 7)
                          .map((c) => (
                            <button
                              key={c.color}
                              onClick={() =>
                                updateTextProperty("strokeColor", c.color)
                              }
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                selectedText.strokeColor?.toLowerCase() ===
                                  c.color.toLowerCase() &&
                                selectedText.strokeWidth
                                  ? "border-white scale-110"
                                  : "border-gray-600 hover:border-gray-400"
                              }`}
                              style={{ backgroundColor: c.color }}
                              title={c.label}
                            />
                          ))}
                      </div>
                      {selectedText.strokeColor && selectedText.strokeWidth ? (
                        <input
                          type="color"
                          value={selectedText.strokeColor}
                          onChange={(e) =>
                            updateTextProperty("strokeColor", e.target.value)
                          }
                          className="w-full h-10 rounded-lg cursor-pointer"
                        />
                      ) : null}
                    </div>

                    <div>
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Outline Width</span>
                        <span>{selectedText.strokeWidth || 0}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={selectedText.strokeWidth || 0}
                        onChange={(e) =>
                          updateTextProperty(
                            "strokeWidth",
                            Number(e.target.value),
                          )
                        }
                        className="w-full"
                      />
                    </div>

                    <div className="border-t border-gray-700 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer mb-3">
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

                      {selectedText.shadow && (
                        <>
                          <div className="mb-3">
                            <label className="text-sm text-gray-300 block mb-2">
                              Shadow Color
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {getBrandColors()
                                .slice(0, 7)
                                .map((c) => (
                                  <button
                                    key={c.color}
                                    onClick={() =>
                                      updateTextProperty("shadowColor", c.color)
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
                                updateTextProperty(
                                  "shadowColor",
                                  e.target.value,
                                )
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
                                updateTextProperty(
                                  "shadowOpacity",
                                  Number(e.target.value),
                                )
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
                                updateTextProperty(
                                  "shadowOffsetX",
                                  Number(e.target.value),
                                )
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
                                updateTextProperty(
                                  "shadowOffsetY",
                                  Number(e.target.value),
                                )
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
                                updateTextProperty(
                                  "shadowBlur",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full"
                            />
                          </div>
                        </>
                      )}
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

            {activeTab === "graphics" && (
              <div className="space-y-4">
                {/* Graphic property panel when a graphic is selected */}
                {selectedGraphic ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      Editing:{" "}
                      {selectedGraphic.type === "stars"
                        ? "Star Rating"
                        : selectedGraphic.type === "icon"
                          ? ICON_LABELS[selectedGraphic.iconName || "heart"]
                          : selectedGraphic.shapeName === "circle"
                            ? "Circle"
                            : selectedGraphic.shapeName === "polaroid"
                              ? "Polaroid"
                              : selectedGraphic.shapeName === "stamp"
                                ? "Stamp"
                                : selectedGraphic.shapeName === "scalloped"
                                  ? "Scallop"
                                  : "Rectangle"}
                    </p>

                    {/* Color */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Color
                      </label>
                      {getBrandColors().length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {getBrandColors()
                            .slice(0, 8)
                            .map((c) => (
                              <button
                                key={c.color}
                                onClick={() =>
                                  updateGraphicProperty("color", c.color)
                                }
                                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                  selectedGraphic.color.toLowerCase() ===
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
                        value={selectedGraphic.color}
                        onChange={(e) =>
                          updateGraphicProperty("color", e.target.value)
                        }
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Opacity */}
                    <div>
                      <div className="flex justify-between text-sm text-gray-300 mb-1">
                        <span>Opacity</span>
                        <span>
                          {Math.round(selectedGraphic.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selectedGraphic.opacity}
                        onChange={(e) =>
                          updateGraphicProperty(
                            "opacity",
                            Number(e.target.value),
                          )
                        }
                        className="w-full"
                      />
                    </div>

                    {/* Star-specific controls */}
                    {selectedGraphic.type === "stars" && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Star Count
                          </label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                onClick={() =>
                                  updateGraphicProperty("starCount", n)
                                }
                                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                                  (selectedGraphic.starCount || 5) === n
                                    ? "bg-primary-600 text-white"
                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">
                            Style
                          </label>
                          <div className="flex gap-2">
                            {(["filled", "outline"] as const).map((style) => (
                              <button
                                key={style}
                                onClick={() =>
                                  updateGraphicProperty("starStyle", style)
                                }
                                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${
                                  (selectedGraphic.starStyle || "filled") ===
                                  style
                                    ? "bg-primary-600 text-white"
                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                }`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Shape-specific controls */}
                    {selectedGraphic.type === "shape" && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-300 mb-1">
                            Fill Color
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button
                              onClick={() =>
                                updateGraphicProperty("fill", "transparent")
                              }
                              className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                                selectedGraphic.fill === "transparent" ||
                                !selectedGraphic.fill
                                  ? "border-white scale-110"
                                  : "border-gray-600 hover:border-gray-400"
                              }`}
                              style={{
                                background:
                                  "linear-gradient(135deg, #374151 45%, transparent 45%, transparent 55%, #374151 55%), linear-gradient(45deg, #ef4444 50%, transparent 50%)",
                              }}
                              title="None"
                            />
                            {getBrandColors()
                              .slice(0, 7)
                              .map((c) => (
                                <button
                                  key={c.color}
                                  onClick={() =>
                                    updateGraphicProperty("fill", c.color)
                                  }
                                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                    selectedGraphic.fill?.toLowerCase() ===
                                    c.color.toLowerCase()
                                      ? "border-white scale-110"
                                      : "border-gray-600 hover:border-gray-400"
                                  }`}
                                  style={{ backgroundColor: c.color }}
                                  title={c.label}
                                />
                              ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-1">
                            Stroke Color
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {getBrandColors()
                              .slice(0, 8)
                              .map((c) => (
                                <button
                                  key={c.color}
                                  onClick={() =>
                                    updateGraphicProperty("stroke", c.color)
                                  }
                                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                    selectedGraphic.stroke?.toLowerCase() ===
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
                            value={
                              selectedGraphic.stroke || selectedGraphic.color
                            }
                            onChange={(e) =>
                              updateGraphicProperty("stroke", e.target.value)
                            }
                            className="w-full h-10 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-gray-300 mb-1">
                            <span>Stroke Width</span>
                            <span>{selectedGraphic.strokeWidth || 2}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={selectedGraphic.strokeWidth || 2}
                            onChange={(e) =>
                              updateGraphicProperty(
                                "strokeWidth",
                                Number(e.target.value),
                              )
                            }
                            className="w-full"
                          />
                        </div>
                        {selectedGraphic.shapeName === "rounded-rect" && (
                          <div>
                            <div className="flex justify-between text-sm text-gray-300 mb-1">
                              <span>Corner Radius</span>
                              <span>{selectedGraphic.cornerRadius ?? 8}px</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              value={selectedGraphic.cornerRadius ?? 8}
                              onChange={(e) =>
                                updateGraphicProperty(
                                  "cornerRadius",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full"
                            />
                          </div>
                        )}
                      </>
                    )}

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={deleteSelectedGraphic}
                      className="w-full"
                    >
                      Delete Graphic
                    </Button>
                  </div>
                ) : (
                  /* Graphics library when nothing selected */
                  <div className="space-y-5">
                    {/* Star Ratings */}
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">
                        Star Ratings
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((count) => (
                          <button
                            key={count}
                            onClick={() =>
                              addGraphicOverlay("stars", { starCount: count })
                            }
                            className="flex items-center gap-0.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            title={`${count} star${count > 1 ? "s" : ""}`}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <svg
                                key={i}
                                className="w-4 h-4"
                                viewBox="0 0 20 20"
                                fill={
                                  i < count ? "currentColor" : "transparent"
                                }
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path d={STAR_PATH} />
                              </svg>
                            ))}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Icons */}
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">
                        Icons
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(ICON_PATHS).map(([name, pathData]) => (
                          <button
                            key={name}
                            onClick={() =>
                              addGraphicOverlay("icon", { iconName: name })
                            }
                            className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            title={ICON_LABELS[name]}
                          >
                            <svg
                              className="w-6 h-6 text-gray-200"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d={pathData} />
                            </svg>
                            <span className="text-[10px] text-gray-400 truncate w-full text-center">
                              {ICON_LABELS[name]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Shapes */}
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">
                        Shapes
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            addGraphicOverlay("shape", {
                              shapeName: "rounded-rect",
                              width: 120,
                              height: 60,
                            })
                          }
                          className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="w-12 h-8 border-2 border-gray-300 rounded-lg" />
                          <span className="text-xs text-gray-400">
                            Rectangle
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            addGraphicOverlay("shape", {
                              shapeName: "circle",
                              width: 60,
                              height: 60,
                            })
                          }
                          className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="w-8 h-8 border-2 border-gray-300 rounded-full" />
                          <span className="text-xs text-gray-400">Circle</span>
                        </button>
                      </div>
                    </div>

                    {/* Frames */}
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">
                        Frames
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() =>
                            addGraphicOverlay("shape", {
                              shapeName: "polaroid",
                              width: 160,
                              height: 200,
                              fill: "#ffffff",
                              stroke: "transparent",
                              strokeWidth: 0,
                            })
                          }
                          className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="w-8 h-10 bg-gray-300 rounded-sm flex flex-col p-0.5">
                            <div className="flex-1 bg-gray-600 rounded-sm" />
                            <div className="h-2" />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            Polaroid
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            addGraphicOverlay("shape", {
                              shapeName: "stamp",
                              width: 150,
                              height: 150,
                              fill: "#ffffff",
                              stroke: "transparent",
                              strokeWidth: 0,
                            })
                          }
                          className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <svg
                            className="w-9 h-9"
                            viewBox="0 0 36 36"
                            fill="none"
                          >
                            <path
                              d="M4 2 L8 2 A2 2 0 0 0 12 2 L16 2 A2 2 0 0 0 20 2 L24 2 A2 2 0 0 0 28 2 L32 2 L32 6 A2 2 0 0 0 32 10 L32 14 A2 2 0 0 0 32 18 L32 22 A2 2 0 0 0 32 26 L32 30 A2 2 0 0 0 32 34 L28 34 A2 2 0 0 0 24 34 L20 34 A2 2 0 0 0 16 34 L12 34 A2 2 0 0 0 8 34 L4 34 L4 30 A2 2 0 0 0 4 26 L4 22 A2 2 0 0 0 4 18 L4 14 A2 2 0 0 0 4 10 L4 6 A2 2 0 0 0 4 2 Z"
                              fill="#d1d5db"
                              stroke="none"
                            />
                            <rect
                              x="9"
                              y="9"
                              width="18"
                              height="18"
                              fill="#4b5563"
                              rx="1"
                            />
                          </svg>
                          <span className="text-[10px] text-gray-400">
                            Stamp
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            addGraphicOverlay("shape", {
                              shapeName: "scalloped",
                              width: 150,
                              height: 150,
                              fill: "#ffffff",
                              stroke: "transparent",
                              strokeWidth: 0,
                            })
                          }
                          className="flex flex-col items-center gap-1 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <svg
                            className="w-9 h-9"
                            viewBox="0 0 36 36"
                            fill="none"
                          >
                            <path
                              d="M4 2 L9 2 A4 4 0 0 0 17 2 L22 2 A4 4 0 0 0 30 2 L34 4 L34 9 A4 4 0 0 0 34 17 L34 22 A4 4 0 0 0 34 30 L32 34 L27 34 A4 4 0 0 0 19 34 L14 34 A4 4 0 0 0 6 34 L2 32 L2 27 A4 4 0 0 0 2 19 L2 14 A4 4 0 0 0 2 6 Z"
                              fill="#d1d5db"
                              stroke="none"
                            />
                            <rect
                              x="8"
                              y="8"
                              width="20"
                              height="20"
                              fill="#4b5563"
                              rx="1"
                            />
                          </svg>
                          <span className="text-[10px] text-gray-400">
                            Scallop
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Graphic layers list */}
                {graphicOverlays.length > 0 && (
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">
                      Graphic Layers ({graphicOverlays.length})
                    </p>
                    {graphicOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className={`p-2 rounded-lg mb-1 cursor-pointer ${
                          overlay.id === selectedGraphicId
                            ? "bg-gray-600"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                        onClick={() => {
                          const canvas = fabricCanvasRef.current;
                          const objects = canvas?.getObjects();
                          const graphicObj = objects?.find(
                            (o) =>
                              (o as unknown as { data?: { id: string } }).data
                                ?.id === overlay.id,
                          );
                          if (graphicObj) {
                            canvas?.setActiveObject(graphicObj);
                            canvas?.renderAll();
                          }
                        }}
                      >
                        <p className="text-sm text-white truncate">
                          {overlay.type === "stars"
                            ? `${overlay.starCount || 5} Stars`
                            : overlay.type === "icon"
                              ? ICON_LABELS[overlay.iconName || "heart"]
                              : overlay.shapeName === "circle"
                                ? "Circle"
                                : overlay.shapeName === "polaroid"
                                  ? "Polaroid"
                                  : overlay.shapeName === "stamp"
                                    ? "Stamp"
                                    : overlay.shapeName === "scalloped"
                                      ? "Scallop"
                                      : "Rectangle"}
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
