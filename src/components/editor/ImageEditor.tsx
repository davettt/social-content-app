import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricImage, IText, filters, Shadow } from 'fabric';
import { Button } from '../common/Button';
import { v4 as uuidv4 } from 'uuid';
import type { Media, TextOverlay, ImageAdjustments, BrandKit } from '../../types';

interface ImageEditorProps {
  media: Media;
  brandKit?: BrandKit;
  onSave: (dataUrl: string, edits: { adjustments: ImageAdjustments; textOverlays: TextOverlay[] }) => void;
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
  { name: 'Original', filter: null },
  { name: 'Vibrant', filter: { saturation: 0.3, brightness: 0.05 } },
  { name: 'Moody', filter: { saturation: -0.2, brightness: -0.1, contrast: 0.1 } },
  { name: 'Clean', filter: { brightness: 0.1, contrast: 0.05 } },
  { name: 'Warm', filter: { saturation: 0.1, brightness: 0.05 } },
  { name: 'Cool', filter: { saturation: -0.1, brightness: 0.05 } },
  { name: 'B&W', filter: { saturation: -1 } },
];

const FONTS = [
  'Inter',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',
];

export function ImageEditor({ media, brandKit, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const imageRef = useRef<FabricImage | null>(null);

  const [activeTab, setActiveTab] = useState<'crop' | 'adjust' | 'filter' | 'text'>('adjust');
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
  });
  const [selectedFilter, setSelectedFilter] = useState('Original');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 600,
      height: 600,
      backgroundColor: '#f3f4f6',
    });

    fabricCanvasRef.current = canvas;

    // Load image
    FabricImage.fromURL(`/media/${media.originalPath}`).then((img) => {
      if (!img) return;

      imageRef.current = img;

      // Scale to fit canvas
      const scale = Math.min(
        canvas.width! / img.width!,
        canvas.height! / img.height!
      );

      img.scale(scale);
      img.set({
        left: (canvas.width! - img.width! * scale) / 2,
        top: (canvas.height! - img.height! * scale) / 2,
        selectable: false,
        evented: false,
      });

      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();
    });

    // Handle selection
    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0] as { data?: { id: string } } | undefined;
      if (obj?.data?.id) {
        setSelectedTextId(obj.data.id);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedTextId(null);
    });

    return () => {
      canvas.dispose();
    };
  }, [media.originalPath]);

  // Apply adjustments
  const applyAdjustments = useCallback((adj: ImageAdjustments) => {
    const img = imageRef.current;
    if (!img) return;

    const filtersList: filters.BaseFilter<string, object>[] = [];

    if (adj.brightness !== 0) {
      filtersList.push(new filters.Brightness({ brightness: adj.brightness / 100 }));
    }
    if (adj.contrast !== 0) {
      filtersList.push(new filters.Contrast({ contrast: adj.contrast / 100 }));
    }
    if (adj.saturation !== 0) {
      filtersList.push(new filters.Saturation({ saturation: adj.saturation / 100 }));
    }

    img.filters = filtersList;
    img.applyFilters();
    fabricCanvasRef.current?.renderAll();
  }, []);

  useEffect(() => {
    applyAdjustments(adjustments);
  }, [adjustments, applyAdjustments]);

  // Apply filter preset
  const applyFilterPreset = (filterName: string) => {
    setSelectedFilter(filterName);
    const preset = FILTERS.find((f) => f.name === filterName);

    if (!preset || !preset.filter) {
      setAdjustments({ brightness: 0, contrast: 0, saturation: 0 });
    } else {
      setAdjustments({
        brightness: (preset.filter.brightness || 0) * 100,
        contrast: (preset.filter.contrast || 0) * 100,
        saturation: (preset.filter.saturation || 0) * 100,
      });
    }
  };

  // Add text overlay
  const addTextOverlay = (initialText: string = 'Your text here') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const id = uuidv4();
    const text = new IText(initialText, {
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: brandKit?.fonts?.heading || 'Inter',
      fontSize: 32,
      fill: brandKit?.primaryColor || '#ffffff',
      textAlign: 'center',
    });
    // Store custom data on the object
    (text as unknown as { data: { id: string } }).data = { id };

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    const overlay: TextOverlay = {
      id,
      text: initialText,
      x: canvas.width! / 2,
      y: canvas.height! / 2,
      fontSize: 32,
      fontFamily: brandKit?.fonts?.heading || 'Inter',
      color: brandKit?.primaryColor || '#ffffff',
      opacity: 1,
      rotation: 0,
      textAlign: 'center',
      shadow: true,
    };

    setTextOverlays((prev) => [...prev, overlay]);
    setSelectedTextId(id);
  };

  // Format date for display (preserving the original date without timezone shift)
  const formatDate = (dateString: string) => {
    // Parse as UTC to avoid timezone shifting the date
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  // Get brand colors array for quick selection
  const getBrandColors = () => {
    const colors: { label: string; color: string }[] = [];
    if (brandKit?.primaryColor) colors.push({ label: 'Primary', color: brandKit.primaryColor });
    if (brandKit?.secondaryColor) colors.push({ label: 'Secondary', color: brandKit.secondaryColor });
    if (brandKit?.accentColor) colors.push({ label: 'Accent', color: brandKit.accentColor });
    // Add colors from palette that aren't already included
    if (brandKit?.colorPalette) {
      brandKit.colorPalette.forEach((c, i) => {
        if (!colors.some(existing => existing.color.toLowerCase() === c.toLowerCase())) {
          colors.push({ label: `Color ${i + 1}`, color: c });
        }
      });
    }
    return colors;
  };

  // Update text properties
  const updateTextProperty = (property: string, value: string | number | boolean) => {
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas?.getActiveObject();

    if (activeObject && activeObject instanceof IText) {
      switch (property) {
        case 'fontFamily':
          activeObject.set('fontFamily', value as string);
          break;
        case 'fontSize':
          activeObject.set('fontSize', value as number);
          break;
        case 'fill':
          activeObject.set('fill', value as string);
          break;
        case 'shadow':
          if (value) {
            activeObject.set('shadow', new Shadow({
              color: 'rgba(0, 0, 0, 0.5)',
              blur: 4,
              offsetX: 2,
              offsetY: 2,
            }));
          } else {
            activeObject.set('shadow', null);
          }
          break;
      }
      canvas?.renderAll();

      // Update state
      setTextOverlays((prev) =>
        prev.map((t) =>
          t.id === selectedTextId ? { ...t, [property]: value } : t
        )
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
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });

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

      <div className="flex-1 flex">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <canvas ref={canvasRef} className="rounded-lg shadow-2xl" />
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {(['adjust', 'filter', 'text'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-primary-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'adjust' && (
              <div className="space-y-6">
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
                      setAdjustments({ ...adjustments, brightness: Number(e.target.value) })
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
                      setAdjustments({ ...adjustments, contrast: Number(e.target.value) })
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
                      setAdjustments({ ...adjustments, saturation: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdjustments({ brightness: 0, contrast: 0, saturation: 0 })}
                  className="w-full"
                >
                  Reset Adjustments
                </Button>
              </div>
            )}

            {activeTab === 'filter' && (
              <div className="grid grid-cols-3 gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.name}
                    onClick={() => applyFilterPreset(filter.name)}
                    className={`p-2 rounded-lg text-center ${
                      selectedFilter === filter.name
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="w-full aspect-square bg-gray-600 rounded mb-1" />
                    <span className="text-xs">{filter.name}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-4">
                <Button onClick={() => addTextOverlay()} className="w-full">
                  + Add Text
                </Button>

                {/* Media Metadata Section */}
                {(media.metadata.dateTaken || media.metadata.location || media.metadata.camera) && (
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Photo Info (click to add as text)</p>
                    <div className="space-y-2">
                      {media.metadata.dateTaken && (
                        <button
                          onClick={() => addTextOverlay(formatDate(media.metadata.dateTaken!))}
                          className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                        >
                          <span className="text-gray-400">Date: </span>
                          <span className="text-white">{formatDate(media.metadata.dateTaken)}</span>
                        </button>
                      )}
                      {media.metadata.location && (
                        <button
                          onClick={() => addTextOverlay(media.metadata.location?.placeName || `${media.metadata.location?.latitude.toFixed(4)}, ${media.metadata.location?.longitude.toFixed(4)}`)}
                          className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                        >
                          <span className="text-gray-400">Location: </span>
                          <span className="text-white">
                            {media.metadata.location.placeName || `${media.metadata.location.latitude.toFixed(4)}, ${media.metadata.location.longitude.toFixed(4)}`}
                          </span>
                        </button>
                      )}
                      {media.metadata.camera && (
                        <button
                          onClick={() => addTextOverlay(media.metadata.camera!)}
                          className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                        >
                          <span className="text-gray-400">Camera: </span>
                          <span className="text-white">{media.metadata.camera}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedText && (
                  <div className="space-y-4 pt-4 border-t border-gray-700">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Font</label>
                      <select
                        value={selectedText.fontFamily}
                        onChange={(e) => updateTextProperty('fontFamily', e.target.value)}
                        className="w-full bg-gray-700 text-white rounded-lg px-3 py-2"
                      >
                        {/* Brand fonts first if available */}
                        {brandKit?.fonts?.heading && !FONTS.includes(brandKit.fonts.heading) && (
                          <option value={brandKit.fonts.heading}>
                            {brandKit.fonts.heading} (Brand Heading)
                          </option>
                        )}
                        {brandKit?.fonts?.body && !FONTS.includes(brandKit.fonts.body) && brandKit.fonts.body !== brandKit.fonts.heading && (
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
                      <label className="block text-sm text-gray-300 mb-1">Size</label>
                      <input
                        type="range"
                        min="12"
                        max="120"
                        value={selectedText.fontSize}
                        onChange={(e) => updateTextProperty('fontSize', Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Color</label>
                      {/* Brand Colors Quick Select */}
                      {getBrandColors().length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {getBrandColors().slice(0, 8).map((c) => (
                            <button
                              key={c.color}
                              onClick={() => updateTextProperty('fill', c.color)}
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                selectedText.color.toLowerCase() === c.color.toLowerCase()
                                  ? 'border-white scale-110'
                                  : 'border-gray-600 hover:border-gray-400'
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
                        onChange={(e) => updateTextProperty('fill', e.target.value)}
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedText.shadow || false}
                          onChange={(e) => updateTextProperty('shadow', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-300">Drop Shadow</span>
                      </label>
                    </div>

                    <Button variant="danger" size="sm" onClick={deleteSelectedText} className="w-full">
                      Delete Text
                    </Button>
                  </div>
                )}

                {textOverlays.length > 0 && (
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Text Layers ({textOverlays.length})</p>
                    {textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className={`p-2 rounded-lg mb-1 cursor-pointer ${
                          overlay.id === selectedTextId ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                        onClick={() => {
                          const canvas = fabricCanvasRef.current;
                          const objects = canvas?.getObjects();
                          const textObj = objects?.find((o) => (o as unknown as { data?: { id: string } }).data?.id === overlay.id);
                          if (textObj) {
                            canvas?.setActiveObject(textObj);
                            canvas?.renderAll();
                          }
                        }}
                      >
                        <p className="text-sm text-white truncate">{overlay.text}</p>
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
