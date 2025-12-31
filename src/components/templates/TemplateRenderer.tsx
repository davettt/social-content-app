import { useRef, useEffect, useState, useMemo } from "react";
import { Button } from "../common/Button";
import type { Template, BrandKit } from "../../types";

interface MediaOption {
  id: string;
  url: string;
  thumbnailUrl: string;
}

interface TemplateRendererProps {
  template: Template;
  promptValues: Record<number, string>;
  availableMedia?: MediaOption[];
  brandKit?: BrandKit;
  onGenerate: (imageDataUrl: string) => void;
  onClose: () => void;
}

const CANVAS_SIZE = 1080;

// Fallback fonts when no brand fonts
const FALLBACK_FONTS = [
  { id: "Inter", label: "Inter" },
  { id: "Georgia", label: "Georgia" },
  { id: "Arial", label: "Arial" },
  { id: "Playfair Display", label: "Playfair Display" },
  { id: "Roboto", label: "Roboto" },
  { id: "Montserrat", label: "Montserrat" },
];

// Fallback colors when no brand colors
const FALLBACK_COLORS = [
  { label: "White", color: "#ffffff" },
  { label: "Black", color: "#000000" },
  { label: "Gray", color: "#6b7280" },
  { label: "Blue", color: "#3b82f6" },
  { label: "Green", color: "#10b981" },
  { label: "Purple", color: "#8b5cf6" },
];

export function TemplateRenderer({
  template,
  promptValues,
  availableMedia = [],
  brandKit,
  onGenerate,
  onClose,
}: TemplateRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  // Build color options from brand kit or use fallbacks
  const colorOptions = useMemo(() => {
    const colors: { label: string; color: string }[] = [];
    if (brandKit) {
      if (brandKit.primaryColor) {
        colors.push({ label: "Primary", color: brandKit.primaryColor });
      }
      if (brandKit.secondaryColor) {
        colors.push({ label: "Secondary", color: brandKit.secondaryColor });
      }
      if (brandKit.accentColor) {
        colors.push({ label: "Accent", color: brandKit.accentColor });
      }
      if (brandKit.colorPalette && brandKit.colorPalette.length > 0) {
        brandKit.colorPalette.slice(0, 6).forEach((c, i) => {
          colors.push({ label: `Palette ${i + 1}`, color: c });
        });
      }
    }
    // Add fallbacks if not enough colors
    if (colors.length < 4) {
      FALLBACK_COLORS.forEach((fc) => {
        if (
          !colors.some((c) => c.color.toLowerCase() === fc.color.toLowerCase())
        ) {
          colors.push(fc);
        }
      });
    }
    return colors;
  }, [brandKit]);

  // Build font options from brand kit or use fallbacks
  const fontOptions = useMemo(() => {
    const fonts: { id: string; label: string }[] = [];
    if (brandKit?.fonts) {
      if (brandKit.fonts.heading) {
        fonts.push({
          id: brandKit.fonts.heading,
          label: `${brandKit.fonts.heading} (Heading)`,
        });
      }
      if (
        brandKit.fonts.body &&
        brandKit.fonts.body !== brandKit.fonts.heading
      ) {
        fonts.push({
          id: brandKit.fonts.body,
          label: `${brandKit.fonts.body} (Body)`,
        });
      }
    }
    // Add fallbacks
    FALLBACK_FONTS.forEach((ff) => {
      if (!fonts.some((f) => f.id === ff.id)) {
        fonts.push(ff);
      }
    });
    return fonts;
  }, [brandKit]);

  // Get default text color - prefer white for dark backgrounds, use brand color otherwise
  const defaultTextColor = useMemo(() => {
    if (brandKit?.primaryColor) return brandKit.primaryColor;
    return template.style.textColor || "#ffffff";
  }, [brandKit, template.style.textColor]);

  // Get default accent color for icons
  const defaultAccentColor = useMemo(() => {
    if (brandKit?.accentColor) return brandKit.accentColor;
    if (brandKit?.primaryColor) return brandKit.primaryColor;
    return "#fbbf24"; // Gold fallback
  }, [brandKit]);

  // Customization state
  const [textColor, setTextColor] = useState(defaultTextColor);
  const [accentColor, setAccentColor] = useState(defaultAccentColor);
  const [fontFamily, setFontFamily] = useState(
    brandKit?.fonts?.heading || template.style.font || "Inter",
  );
  const [textSize, setTextSize] = useState(1.0); // 1.0 = 100%
  const [enableShadow, setEnableShadow] = useState(
    template.style.textShadow ?? true,
  );
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);

  // Load selected media image
  useEffect(() => {
    if (!selectedMediaId) {
      setLoadedImage(null);
      return;
    }

    const media = availableMedia.find((m) => m.id === selectedMediaId);
    if (!media) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLoadedImage(img);
    img.onerror = () => setLoadedImage(null);
    img.src = media.url;
  }, [selectedMediaId, availableMedia]);

  // Get the filled prompt values
  const getPromptValue = (index: number): string => {
    return promptValues[index] || "";
  };

  // Parse aspect ratio string to numbers
  const parseAspectRatio = (
    ratio: string,
  ): { width: number; height: number } => {
    const [w, h] = ratio.split(":").map(Number);
    return { width: w || 1, height: h || 1 };
  };

  // Render template to canvas
  const renderTemplate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const slide = template.layout.slides[0];
    const { width: ratioW, height: ratioH } = parseAspectRatio(
      slide?.aspectRatio || "1:1",
    );

    // Calculate canvas dimensions based on aspect ratio
    let canvasWidth = CANVAS_SIZE;
    let canvasHeight = CANVAS_SIZE;
    if (ratioW > ratioH) {
      canvasHeight = Math.round(CANVAS_SIZE * (ratioH / ratioW));
    } else if (ratioH > ratioW) {
      canvasWidth = Math.round(CANVAS_SIZE * (ratioW / ratioH));
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw background - use image if available, otherwise color/gradient
    if (loadedImage) {
      // Draw image covering the canvas (object-fit: cover behavior)
      const imgRatio = loadedImage.width / loadedImage.height;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth, drawHeight, drawX, drawY;
      if (imgRatio > canvasRatio) {
        // Image is wider - fit height, crop sides
        drawHeight = canvasHeight;
        drawWidth = loadedImage.width * (canvasHeight / loadedImage.height);
        drawX = (canvasWidth - drawWidth) / 2;
        drawY = 0;
      } else {
        // Image is taller - fit width, crop top/bottom
        drawWidth = canvasWidth;
        drawHeight = loadedImage.height * (canvasWidth / loadedImage.width);
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
      }

      ctx.drawImage(loadedImage, drawX, drawY, drawWidth, drawHeight);

      // Add a semi-transparent overlay for better text readability
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      const bgColor = template.style.backgroundColor || "#1a1a2e";
      if (bgColor.includes("gradient")) {
        // Parse gradient - simplified linear gradient support
        const gradientMatch = bgColor.match(
          /linear-gradient\((\d+)deg,\s*([^,]+),\s*([^)]+)\)/,
        );
        if (
          gradientMatch &&
          gradientMatch[1] &&
          gradientMatch[2] &&
          gradientMatch[3]
        ) {
          const angle = parseInt(gradientMatch[1]) || 135;
          const color1 = gradientMatch[2].trim().split(" ")[0] || "#1a1a2e";
          const color2 = gradientMatch[3].trim().split(" ")[0] || "#4a4a6e";

          // Convert angle to gradient coordinates
          const angleRad = (angle - 90) * (Math.PI / 180);
          const x1 = canvasWidth / 2 - Math.cos(angleRad) * canvasWidth;
          const y1 = canvasHeight / 2 - Math.sin(angleRad) * canvasHeight;
          const x2 = canvasWidth / 2 + Math.cos(angleRad) * canvasWidth;
          const y2 = canvasHeight / 2 + Math.sin(angleRad) * canvasHeight;

          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, color1);
          gradient.addColorStop(1, color2);
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = "#1a1a2e";
        }
      } else {
        ctx.fillStyle = bgColor;
      }
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Set up text styling - use customization state
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";

    // Apply text shadow if enabled
    if (enableShadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Render based on template category
    if (template.category === "quote") {
      renderQuoteTemplate(ctx, canvasWidth, canvasHeight);
    } else if (template.category === "tips") {
      renderTipsTemplate(ctx, canvasWidth, canvasHeight);
    } else if (template.category === "testimonial") {
      renderTestimonialTemplate(ctx, canvasWidth, canvasHeight);
    } else if (template.category === "product") {
      renderProductTemplate(ctx, canvasWidth, canvasHeight);
    } else {
      // Default text render (also handles any unsupported categories)
      renderDefaultTemplate(ctx, canvasWidth, canvasHeight);
    }
  };

  const renderQuoteTemplate = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const quote = getPromptValue(0);
    const author = getPromptValue(1);
    const font = fontFamily;

    // Large opening quote mark - use accent color
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${height * 0.3 * textSize}px ${font}`;
    ctx.fillText("\u201C", width / 2, height * 0.25);
    ctx.globalAlpha = 1;
    ctx.fillStyle = textColor;

    // Main quote text
    const fontSize = Math.min(height * 0.06, 64) * textSize;
    ctx.font = `${fontSize}px "${font}"`;

    // Word wrap the quote
    const maxWidth = width * 0.8;
    const lines = wrapText(ctx, quote, maxWidth);
    const lineHeight = fontSize * 1.4;
    const startY = height / 2 - (lines.length * lineHeight) / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight);
    });

    // Author attribution
    if (author) {
      ctx.globalAlpha = 0.7;
      ctx.font = `${fontSize * 0.5}px "${font}"`;
      ctx.fillText(`— ${author}`, width / 2, height * 0.85);
      ctx.globalAlpha = 1;
    }
  };

  const renderTipsTemplate = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const title = getPromptValue(0);
    const tips = [
      getPromptValue(1),
      getPromptValue(2),
      getPromptValue(3),
    ].filter(Boolean);
    const font = fontFamily;

    // Title
    ctx.font = `bold ${height * 0.06 * textSize}px "${font}"`;
    ctx.fillText(title, width / 2, height * 0.15);

    // Tips
    const tipFontSize = height * 0.035 * textSize;
    ctx.font = `${tipFontSize}px "${font}"`;

    tips.forEach((tip, i) => {
      const y = height * 0.35 + i * (height * 0.2);

      // Number - use accent color
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = accentColor;
      ctx.font = `bold ${height * 0.15 * textSize}px "${font}"`;
      ctx.fillText(`0${i + 1}`, width / 2, y - height * 0.02);
      ctx.globalAlpha = 1;
      ctx.fillStyle = textColor;

      // Tip text
      ctx.font = `${tipFontSize}px "${font}"`;
      const lines = wrapText(ctx, tip, width * 0.75);
      lines.forEach((line, j) => {
        ctx.fillText(
          line,
          width / 2,
          y + j * tipFontSize * 1.3 + height * 0.05,
        );
      });
    });
  };

  const renderTestimonialTemplate = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const review = getPromptValue(0);
    const name = getPromptValue(1);
    const font = fontFamily;

    // Stars - use accent color from brand/selection
    const starSize = height * 0.06 * textSize;
    ctx.font = `${starSize}px Arial, sans-serif`;
    ctx.fillStyle = accentColor;
    ctx.fillText("★ ★ ★ ★ ★", width / 2, height * 0.18);
    ctx.fillStyle = textColor; // Reset to text color

    // Review text
    const fontSize = height * 0.04 * textSize;
    ctx.font = `italic ${fontSize}px "${font}"`;
    const lines = wrapText(ctx, `"${review}"`, width * 0.8);
    const startY = height * 0.45 - (lines.length * fontSize * 1.4) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * fontSize * 1.4);
    });

    // Customer name
    if (name) {
      ctx.font = `bold ${fontSize * 0.7}px "${font}"`;
      ctx.fillText(`— ${name}`, width / 2, height * 0.85);
    }
  };

  const renderProductTemplate = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const productName = getPromptValue(0);
    const benefit = getPromptValue(1);
    const font = fontFamily;

    // Product placeholder - use accent color
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    const boxSize = width * 0.4;
    ctx.strokeRect((width - boxSize) / 2, height * 0.2, boxSize, boxSize);
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.5;
    ctx.font = `${height * 0.03 * textSize}px "${font}"`;
    ctx.fillText("Add product image", width / 2, height * 0.2 + boxSize / 2);
    ctx.globalAlpha = 1;

    // Product name
    ctx.font = `bold ${height * 0.05 * textSize}px "${font}"`;
    ctx.fillText(productName, width / 2, height * 0.72);

    // Benefit
    if (benefit) {
      ctx.globalAlpha = 0.8;
      ctx.font = `${height * 0.03 * textSize}px "${font}"`;
      const lines = wrapText(ctx, benefit, width * 0.7);
      lines.forEach((line, i) => {
        ctx.fillText(line, width / 2, height * 0.8 + i * height * 0.04);
      });
      ctx.globalAlpha = 1;
    }
  };

  const renderDefaultTemplate = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const text = getPromptValue(0);
    const font = fontFamily;

    const fontSize = height * 0.05 * textSize;
    ctx.font = `${fontSize}px "${font}"`;
    const lines = wrapText(ctx, text, width * 0.8);
    const lineHeight = fontSize * 1.4;
    const startY = height / 2 - (lines.length * lineHeight) / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight);
    });
  };

  // Helper function to wrap text
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] => {
    if (!text) return [];
    const words = text.split(" ");
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
    return lines;
  };

  // Render on mount and when values change
  useEffect(() => {
    renderTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    promptValues,
    template,
    loadedImage,
    textColor,
    accentColor,
    fontFamily,
    textSize,
    enableShadow,
    overlayOpacity,
  ]);

  const handleGenerate = () => {
    setIsRendering(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onGenerate(dataUrl);
    }
    setIsRendering(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Preview: {template.name}
          </h3>
          <p className="text-sm text-gray-500">
            Review your template before adding to post
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Background Image Selection */}
          {availableMedia.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Background Image (Optional)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {/* No image option */}
                <button
                  onClick={() => setSelectedMediaId(null)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-colors flex items-center justify-center bg-gray-100 ${
                    selectedMediaId === null
                      ? "border-primary-500 ring-2 ring-primary-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xs text-gray-500">None</span>
                </button>
                {/* Media options */}
                {availableMedia.map((media) => (
                  <button
                    key={media.id}
                    onClick={() => setSelectedMediaId(media.id)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-colors ${
                      selectedMediaId === media.id
                        ? "border-primary-500 ring-2 ring-primary-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={media.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Customization Controls */}
          <div className="p-4 border-b border-gray-200 space-y-4">
            {/* Text Color */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Text Color
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.color}
                    onClick={() => setTextColor(opt.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      textColor === opt.color
                        ? "border-primary-500 ring-2 ring-primary-200 scale-110"
                        : "border-gray-300 hover:scale-105"
                    }`}
                    style={{ backgroundColor: opt.color }}
                    title={opt.label}
                  />
                ))}
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Accent Color (for icons like stars, numbers) */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Accent Color (Icons)
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                {colorOptions.map((opt) => (
                  <button
                    key={`accent-${opt.color}`}
                    onClick={() => setAccentColor(opt.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      accentColor === opt.color
                        ? "border-primary-500 ring-2 ring-primary-200 scale-110"
                        : "border-gray-300 hover:scale-105"
                    }`}
                    style={{ backgroundColor: opt.color }}
                    title={opt.label}
                  />
                ))}
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer"
                  title="Custom accent color"
                />
              </div>
            </div>

            {/* Font Family */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Font</p>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {fontOptions.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Text Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Text Size</p>
                <span className="text-xs text-gray-500">
                  {Math.round(textSize * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.1"
                value={textSize}
                onChange={(e) => setTextSize(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Shadow Toggle & Overlay Opacity */}
            <div className="flex gap-6 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableShadow}
                  onChange={(e) => setEnableShadow(e.target.checked)}
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Drop Shadow</span>
              </label>

              {loadedImage && (
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                  <span className="text-sm text-gray-700 whitespace-nowrap">
                    Overlay:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.1"
                    value={overlayOpacity}
                    onChange={(e) =>
                      setOverlayOpacity(parseFloat(e.target.value))
                    }
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-500 w-8">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Canvas Preview */}
          <div className="p-6 bg-gray-100 flex justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[400px] rounded-lg shadow-lg"
              style={{ width: "auto", height: "auto" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3 justify-end border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} isLoading={isRendering}>
            Add to Post
          </Button>
        </div>
      </div>
    </div>
  );
}
