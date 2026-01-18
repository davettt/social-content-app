import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProject } from "../../hooks/useProjects";
import { useMedia } from "../../hooks/useMedia";
import {
  useGenerateCaption,
  useSuggestHashtags,
  useCalculateViralityScore,
  useSuggestGraphicsEmoji,
} from "../../hooks/useAI";
import { useComposerStore } from "../../stores/composerStore";
import { Button } from "../common/Button";
import { Textarea } from "../common/Input";
import { Modal } from "../common/Modal";
import { PageLoader } from "../common/LoadingSpinner";
import { ImageEditor } from "../editor/ImageEditor";
import { VideoEditor } from "../editor/VideoEditor";
import { VideoTextPreview } from "../editor/VideoTextPreview";
import { TEMPLATES } from "../templates/templateData";
import { TemplateRenderer } from "../templates/TemplateRenderer";
import { editsApi } from "../../services/api";
import type {
  Platform,
  Media,
  Template,
  VideoTextOverlay,
  GraphicsEmojiRecommendations,
} from "../../types";

const PLATFORM_LIMITS: Record<Platform, number> = {
  instagram: 2200,
  threads: 500,
  twitter: 280,
  linkedin: 3000,
};

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  instagram: <span className="text-pink-500">IG</span>,
  threads: <span className="text-gray-900">@</span>,
  twitter: <span className="text-blue-400">X</span>,
  linkedin: <span className="text-blue-700">in</span>,
};

// Aspect ratio options per platform (based on 2025/2026 platform guidelines)
type AspectRatio = { width: number; height: number; label: string };

const PLATFORM_ASPECT_OPTIONS: Record<Platform, AspectRatio[]> = {
  instagram: [
    { width: 4, height: 5, label: "4:5 Portrait" },
    { width: 1, height: 1, label: "1:1 Square" },
    { width: 9, height: 16, label: "9:16 Story/Reels" },
  ],
  threads: [
    { width: 4, height: 5, label: "4:5 Portrait" },
    { width: 1, height: 1, label: "1:1 Square" },
    { width: 9, height: 16, label: "9:16 Story" },
  ],
  twitter: [
    { width: 16, height: 9, label: "16:9 Landscape" },
    { width: 2, height: 1, label: "2:1 Wide" },
    { width: 1, height: 1, label: "1:1 Square" },
    { width: 3, height: 4, label: "3:4 Portrait" },
  ],
  linkedin: [
    { width: 1.91, height: 1, label: "1.91:1 Landscape" },
    { width: 1, height: 1, label: "1:1 Square" },
    { width: 4, height: 5, label: "4:5 Portrait" },
  ],
};

// Default aspect ratio index for each platform (first option)
const PLATFORM_DEFAULT_ASPECT: Record<Platform, number> = {
  instagram: 0, // 4:5 Portrait
  threads: 0, // 4:5 Portrait
  twitter: 0, // 16:9 Landscape
  linkedin: 0, // 1.91:1 Landscape
};

// Helper to get current dimensions for a platform
const getPlatformDimensions = (
  platform: Platform,
  aspectIndex: number,
): AspectRatio => {
  const options = PLATFORM_ASPECT_OPTIONS[platform];
  const selected = options[aspectIndex];
  if (selected) return selected;
  return options[0] as AspectRatio;
};

// Slideshow transition options
type SlideshowTransition = "fade" | "wipeleft" | "slideright" | "circlecrop";

const SLIDESHOW_TRANSITIONS: { value: SlideshowTransition; label: string }[] = [
  { value: "fade", label: "Fade" },
  { value: "wipeleft", label: "Wipe" },
  { value: "slideright", label: "Slide" },
  { value: "circlecrop", label: "Circle" },
];

const CAPTION_STYLES = [
  { id: "auto", label: "Auto", description: "Let AI decide the best style" },
  {
    id: "quote",
    label: "Quote",
    description: "Inspirational or thought-provoking quote",
  },
  {
    id: "personal",
    label: "Personal",
    description: "Authentic personal thought or reflection",
  },
  {
    id: "story",
    label: "Story",
    description: "Behind-the-scenes or storytelling",
  },
  {
    id: "question",
    label: "Question",
    description: "Engage audience with a question",
  },
  {
    id: "announcement",
    label: "Announce",
    description: "News or announcement style",
  },
] as const;

const POST_TYPES = [
  {
    id: "business",
    label: "Business",
    description: "Business/brand focused post",
    icon: "💼",
  },
  {
    id: "travel",
    label: "Travel",
    description: "Travel and adventure content",
    icon: "✈️",
  },
  {
    id: "food",
    label: "Food",
    description: "Food and dining experiences",
    icon: "🍽️",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    description: "Personal lifestyle content",
    icon: "🌟",
  },
  {
    id: "event",
    label: "Event",
    description: "Event or occasion coverage",
    icon: "🎉",
  },
] as const;

type PostType = (typeof POST_TYPES)[number]["id"];

export function PostComposer() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: allMedia, isLoading: mediaLoading } = useMedia(projectId);

  const {
    selectedMediaIds,
    caption,
    hashtags,
    platforms,
    captionSuggestions,
    viralityScore,
    editedImages,
    generatedImages,
    setCaption,
    addHashtag,
    removeHashtag,
    togglePlatform,
    addMedia,
    removeMedia,
    setCaptionSuggestions,
    setViralityScore,
    setEditedImage,
    removeEditedImage,
    removeGeneratedImage,
    addGeneratedImage,
    setHashtags,
    setPlatformAspect,
  } = useComposerStore();

  const generateCaption = useGenerateCaption();
  const suggestHashtags = useSuggestHashtags();
  const calculateViralityScore = useCalculateViralityScore();
  const suggestGraphicsEmoji = useSuggestGraphicsEmoji();

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [recommendations, setRecommendations] =
    useState<GraphicsEmojiRecommendations | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingMedia, setEditingMedia] = useState<Media | null>(null);
  const [captionStyle, setCaptionStyle] = useState<string>("auto");
  const [postType, setPostType] = useState<PostType>("business");
  const [imageContext, setImageContext] = useState("");
  const [previewPlatform, setPreviewPlatform] = useState<Platform>(
    platforms[0] || "instagram",
  );
  // Track selected aspect ratio index per platform
  const [platformAspects, setPlatformAspects] = useState<
    Record<Platform, number>
  >(() => ({ ...PLATFORM_DEFAULT_ASPECT }));
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [templatePromptValues, setTemplatePromptValues] = useState<
    Record<number, string>
  >({});
  // Track loaded video edits for preview (mediaId -> textOverlays)
  const [videoEdits, setVideoEdits] = useState<
    Record<string, { textOverlays: VideoTextOverlay[] }>
  >({});
  const [showTemplateRenderer, setShowTemplateRenderer] = useState(false);
  // Slideshow creation state
  const [showSlideshowSettings, setShowSlideshowSettings] = useState(false);
  const [slideshowTransition, setSlideshowTransition] =
    useState<SlideshowTransition>("fade");
  const [slideshowTransitionDuration, setSlideshowTransitionDuration] =
    useState(1);
  const [slideshowPhotoDuration, setSlideshowPhotoDuration] = useState(4);
  const [isCreatingSlideshow, setIsCreatingSlideshow] = useState(false);
  const [slideshowError, setSlideshowError] = useState<string | null>(null);
  const [slideshowSuccess, setSlideshowSuccess] = useState(false);

  // Update a template prompt value
  const updatePromptValue = (index: number, value: string) => {
    setTemplatePromptValues((prev) => ({ ...prev, [index]: value }));
  };

  // Generate caption from filled template prompts
  const generateCaptionFromTemplate = () => {
    if (!activeTemplate?.captionPrompts) return;

    const filledPrompts = activeTemplate.captionPrompts
      .map((_, i) => templatePromptValues[i] || "")
      .filter((v) => v.trim() !== "");

    if (filledPrompts.length === 0) return;

    // Build caption based on template type
    let generatedCaption = "";

    if (activeTemplate.category === "quote") {
      // Quote format: "Quote text" — Author
      generatedCaption = `"${filledPrompts[0]}"`;
      if (filledPrompts[1]) {
        generatedCaption += `\n\n— ${filledPrompts[1]}`;
      }
    } else if (
      activeTemplate.category === "tips" ||
      activeTemplate.category === "carousel"
    ) {
      // Tips/carousel: Title + numbered points
      if (filledPrompts[0]) {
        generatedCaption = `${filledPrompts[0]}\n\n`;
      }
      filledPrompts.slice(1).forEach((tip, i) => {
        generatedCaption += `${i + 1}. ${tip}\n`;
      });
    } else if (activeTemplate.category === "testimonial") {
      // Testimonial: Review + name
      generatedCaption = `"${filledPrompts[0]}"`;
      if (filledPrompts[1]) {
        generatedCaption += `\n\n— ${filledPrompts[1]}`;
      }
    } else {
      // Default: join with line breaks
      generatedCaption = filledPrompts.join("\n\n");
    }

    setCaption(generatedCaption.trim());
  };

  // Handle generated template image
  const handleTemplateImageGenerated = (imageDataUrl: string) => {
    addGeneratedImage(imageDataUrl, "template");
    setShowTemplateRenderer(false);
    // Also apply the caption
    generateCaptionFromTemplate();
  };

  // Load template from URL query param
  useEffect(() => {
    const templateId = searchParams.get("template");
    if (templateId && !templateApplied) {
      const template = TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        setActiveTemplate(template);

        // Apply template settings
        if (template.suggestedHashtags) {
          setHashtags(template.suggestedHashtags);
        }

        // Set platforms from template
        const currentPlatforms = useComposerStore.getState().platforms;
        template.platforms.forEach((platform) => {
          if (!currentPlatforms.includes(platform)) {
            togglePlatform(platform);
          }
        });

        // Set caption style based on template category
        if (template.category === "quote") {
          setCaptionStyle("quote");
        } else if (
          template.category === "story" ||
          template.category === "behind-the-scenes"
        ) {
          setCaptionStyle("story");
        } else if (
          template.category === "tips" ||
          template.category === "carousel"
        ) {
          setCaptionStyle("personal");
        }

        setTemplateApplied(true);
      }
    }
  }, [searchParams, templateApplied, setHashtags, togglePlatform]);

  // Load saved edits from disk for all media (runs once when media loads)
  useEffect(() => {
    if (!projectId || !allMedia || allMedia.length === 0) return;

    const loadSavedEdits = async () => {
      const currentEdits = useComposerStore.getState().editedImages;

      for (const media of allMedia) {
        // Skip if we already have edits in memory for this media
        if (currentEdits[media.id]) continue;

        // Skip videos for now
        if (media.type === "video") continue;

        try {
          const savedEdits = await editsApi.loadImageEdit(projectId, media.id);
          if (savedEdits.hasEdits && savedEdits.dataUrl) {
            // Map API response to internal types with proper defaults
            const adjustments = savedEdits.adjustments
              ? {
                  brightness: savedEdits.adjustments.brightness ?? 0,
                  contrast: savedEdits.adjustments.contrast ?? 0,
                  saturation: savedEdits.adjustments.saturation ?? 0,
                  rotation: savedEdits.adjustments.rotation,
                  fineRotation: savedEdits.adjustments.fineRotation,
                }
              : undefined;

            const textOverlays = savedEdits.textOverlays?.map((overlay) => ({
              id: overlay.id,
              text: overlay.text,
              x: overlay.x,
              y: overlay.y,
              fontSize: overlay.fontSize,
              fontFamily: overlay.fontFamily,
              color: overlay.color,
              backgroundColor: overlay.backgroundColor,
              opacity: overlay.opacity,
              rotation: 0, // Default rotation
              textAlign: overlay.textAlign as "left" | "center" | "right",
              shadow: overlay.shadow,
              strokeColor: overlay.strokeColor,
              strokeWidth: overlay.strokeWidth,
              position: overlay.position as
                | "top-left"
                | "top-center"
                | "top-right"
                | "middle-left"
                | "middle-center"
                | "middle-right"
                | "bottom-left"
                | "bottom-center"
                | "bottom-right"
                | undefined,
            }));

            setEditedImage(media.id, {
              dataUrl: savedEdits.dataUrl,
              adjustments,
              textOverlays,
            });
          }
        } catch {
          // Silently ignore errors - no saved edits for this media
        }
      }
    };

    loadSavedEdits();
  }, [projectId, allMedia, setEditedImage]);

  // Load saved video edits for text overlay preview
  useEffect(() => {
    if (!projectId || !allMedia || allMedia.length === 0) return;

    const loadVideoEdits = async () => {
      const videos = allMedia.filter((m) => m.type === "video");
      const loadedEdits: Record<string, { textOverlays: VideoTextOverlay[] }> =
        {};

      for (const video of videos) {
        try {
          const savedEdits = await editsApi.loadVideoEdit(projectId, video.id);
          if (
            savedEdits.hasEdits &&
            savedEdits.textOverlays &&
            savedEdits.textOverlays.length > 0
          ) {
            loadedEdits[video.id] = {
              textOverlays: savedEdits.textOverlays,
            };
          }
        } catch {
          // Silently ignore errors - no saved edits for this video
        }
      }

      if (Object.keys(loadedEdits).length > 0) {
        setVideoEdits(loadedEdits);
      }
    };

    loadVideoEdits();
  }, [projectId, allMedia]);

  // Clear template when navigating away
  const handleClearTemplate = () => {
    setActiveTemplate(null);
    setSearchParams({});
  };

  if (projectLoading || mediaLoading) return <PageLoader />;

  const selectedMedia =
    allMedia?.filter((m) => selectedMediaIds.includes(m.id)) || [];

  const handleGenerateCaption = async () => {
    if (!project) return;

    // Extract location from selected media (use first media with location)
    const mediaWithLocation = selectedMedia.find((m) => m.metadata?.location);
    const location = mediaWithLocation?.metadata?.location
      ? {
          placeName:
            mediaWithLocation.userMetadata?.customLocation ||
            mediaWithLocation.metadata.location.placeName ||
            null,
          latitude: mediaWithLocation.metadata.location.latitude,
          longitude: mediaWithLocation.metadata.location.longitude,
        }
      : null;

    const result = await generateCaption.mutateAsync({
      mediaDescription: imageContext || "Photo to share on social media",
      businessContext:
        postType === "business"
          ? {
              industry: project.businessInfo.industry,
              targetAudience: project.businessInfo.targetAudience,
              tone: project.businessInfo.tone,
            }
          : null, // Don't pass business context for personal posts
      platform: platforms[0] || "instagram",
      captionStyle: captionStyle,
      postType: postType,
      location: location,
    });

    setCaptionSuggestions(result.captions);
  };

  const handleSuggestHashtags = async () => {
    if (!caption) return;

    const result = await suggestHashtags.mutateAsync({
      caption,
      industry: project?.businessInfo.industry,
      platform: platforms[0] || "instagram",
    });

    result.hashtags.forEach((tag) => addHashtag(tag));
  };

  const handleCalculateScore = async () => {
    if (!caption) return;

    const result = await calculateViralityScore.mutateAsync({
      caption,
      hashtags,
      mediaType: selectedMedia[0]?.type || "image",
      platform: platforms[0] || "instagram",
      businessContext: { industry: project?.businessInfo.industry },
    });

    setViralityScore(result);
  };

  const handleGetRecommendations = async () => {
    if (!caption || !platforms[0]) return;

    const result = await suggestGraphicsEmoji.mutateAsync({
      caption,
      hashtags,
      platform: platforms[0],
      industry: project?.businessInfo?.industry,
      postType,
    });
    setRecommendations(result);
  };

  const handleAddHashtag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (hashtagInput.trim()) {
        addHashtag(hashtagInput);
        setHashtagInput("");
      }
    }
  };

  const captionWithHashtags = `${caption}${hashtags.length > 0 ? "\n\n" + hashtags.map((h) => `#${h}`).join(" ") : ""}`;

  // Get images only from selected media (for slideshow)
  const selectedImages = selectedMedia.filter((m) => m.type === "image");

  // Create slideshow from selected images
  const handleCreateSlideshow = async () => {
    if (!projectId || selectedImages.length < 2) return;

    setIsCreatingSlideshow(true);
    setSlideshowError(null);
    setSlideshowSuccess(false);

    try {
      // Build photos array - each photo uses the same duration
      // useOriginal is true if there are NO edits in the composer for this image
      const photos = selectedImages.map((media) => ({
        mediaId: media.id,
        duration: slideshowPhotoDuration,
        useOriginal: !editedImages[media.id]?.dataUrl,
      }));

      // Get current aspect ratio from platform settings
      const currentAspect = getPlatformDimensions(
        previewPlatform,
        platformAspects[previewPlatform],
      );

      const result = await editsApi.createSlideshow(projectId, {
        photos,
        transition: slideshowTransition,
        transitionDuration: slideshowTransitionDuration,
        aspectRatio: {
          width: currentAspect.width,
          height: currentAspect.height,
        },
      });

      // Remove the individual images that were used
      selectedImages.forEach((img) => removeMedia(img.id));

      // Invalidate media query so it refetches with the new slideshow
      await queryClient.invalidateQueries({ queryKey: ["media", projectId] });

      // Add the slideshow video to composer's selected media (after refetch)
      addMedia(result.media.id);

      // Show success and close settings
      setSlideshowSuccess(true);
      setShowSlideshowSettings(false);

      // Clear success after 3 seconds
      setTimeout(() => setSlideshowSuccess(false), 3000);
    } catch (err) {
      setSlideshowError(
        err instanceof Error ? err.message : "Failed to create slideshow",
      );
    } finally {
      setIsCreatingSlideshow(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Post</h1>
        <Button
          onClick={() => navigate(`/projects/${projectId}/export`)}
          disabled={
            !caption ||
            (selectedMedia.length === 0 && generatedImages.length === 0)
          }
        >
          Export
        </Button>
      </div>

      {/* Slideshow Success Banner */}
      {slideshowSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-green-800">
              Slideshow created successfully!
            </p>
            <p className="text-sm text-green-600">
              Your slideshow video has been added to the media below.
            </p>
          </div>
        </div>
      )}

      {/* Template Banner */}
      {activeTemplate && (
        <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase text-primary-600 bg-primary-100 px-2 py-0.5 rounded">
                Template
              </span>
              <h3 className="font-semibold text-gray-900">
                {activeTemplate.name}
              </h3>
            </div>
            <button
              onClick={handleClearTemplate}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Remove template"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Caption prompts input fields */}
          {activeTemplate.captionPrompts &&
            activeTemplate.captionPrompts.length > 0 && (
              <div className="space-y-3">
                {activeTemplate.captionPrompts.map((prompt, i) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {prompt.placeholder}
                    </label>
                    <input
                      type="text"
                      value={templatePromptValues[i] || ""}
                      onChange={(e) => updatePromptValue(i, e.target.value)}
                      placeholder={prompt.example}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                ))}

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={generateCaptionFromTemplate}
                    disabled={Object.values(templatePromptValues).every(
                      (v) => !v?.trim(),
                    )}
                    className="flex-1"
                  >
                    Caption Only
                  </Button>
                  <Button
                    onClick={() => setShowTemplateRenderer(true)}
                    disabled={Object.values(templatePromptValues).every(
                      (v) => !v?.trim(),
                    )}
                    className="flex-1"
                  >
                    Generate Image
                  </Button>
                </div>
              </div>
            )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Editor */}
        <div className="space-y-6">
          {/* Media Selection */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Media</h2>
              <div className="flex items-center gap-2">
                {/* Create Slideshow button - shown when 2+ images selected */}
                {selectedImages.length >= 2 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSlideshowSettings(true)}
                  >
                    Create Slideshow
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMediaPicker(true)}
                >
                  {selectedMedia.length > 0 || generatedImages.length > 0
                    ? "Add More"
                    : "Add Media"}
                </Button>
              </div>
            </div>

            {selectedMedia.length > 0 || generatedImages.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {/* Show generated images first */}
                {generatedImages.map((genImage, index) => (
                  <div
                    key={`generated-${index}`}
                    className="relative flex-shrink-0"
                  >
                    <img
                      src={genImage.dataUrl}
                      alt={`${genImage.type === "template" ? "Template" : "Collage"} ${index + 1}`}
                      className="w-20 h-20 object-cover object-center rounded-lg"
                    />
                    <div
                      className={`absolute top-0 left-0 text-white text-[10px] px-1 rounded-tl-lg rounded-br ${
                        genImage.type === "template"
                          ? "bg-purple-500"
                          : "bg-primary-500"
                      }`}
                    >
                      {genImage.type === "template" ? "Template" : "Collage"}
                    </div>
                    <button
                      onClick={() => removeGeneratedImage(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {/* Show selected media */}
                {selectedMedia.map((media) => (
                  <div key={media.id} className="relative flex-shrink-0">
                    <img
                      src={
                        editedImages[media.id]?.dataUrl ||
                        `/media/${media.thumbnailPath}`
                      }
                      alt=""
                      className="w-20 h-20 object-cover object-center rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `/media/${media.originalPath}`;
                      }}
                    />
                    <button
                      onClick={() => removeMedia(media.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                onClick={() => setShowMediaPicker(true)}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
              >
                <p className="text-gray-500">Click to select media</p>
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Caption</h2>

            {/* AI Assist Section */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                AI Caption Assistant
              </p>

              {/* Post Type */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">
                  What type of post is this?
                </label>
                <div className="flex flex-wrap gap-2">
                  {POST_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setPostType(type.id)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
                        postType === type.id
                          ? "bg-primary-500 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}
                      title={type.description}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
                {postType !== "business" && (
                  <p className="text-xs text-gray-400 mt-1">
                    Personal post - business context will be minimized
                  </p>
                )}
              </div>

              {/* Image Context */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">
                  What's in the image? (optional - helps AI understand context)
                </label>
                <input
                  type="text"
                  value={imageContext}
                  onChange={(e) => setImageContext(e.target.value)}
                  placeholder="e.g., Sunset at the beach, Team meeting, New product launch..."
                  className="input text-sm"
                />
              </div>

              {/* Caption Style */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">
                  Caption style
                </label>
                <div className="flex flex-wrap gap-2">
                  {CAPTION_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setCaptionStyle(style.id)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        captionStyle === style.id
                          ? "bg-primary-500 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}
                      title={style.description}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateCaption}
                isLoading={generateCaption.isPending}
                className="w-full"
              >
                Generate Caption Ideas
              </Button>
            </div>

            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption or use AI to generate ideas..."
              rows={5}
            />

            {captionSuggestions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-500">
                  AI Suggestions (click to use):
                </p>
                {captionSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setCaption(suggestion.text)}
                    className="block w-full text-left p-3 text-sm bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-transparent hover:border-primary-200"
                  >
                    <span className="text-xs text-primary-500 font-medium uppercase">
                      {suggestion.length}
                    </span>
                    <p className="mt-1">{suggestion.text}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hashtags */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Hashtags</h2>
              <div className="relative group">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggestHashtags}
                  disabled={!caption}
                  isLoading={suggestHashtags.isPending}
                >
                  AI Suggest
                </Button>
                {!caption && (
                  <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Write a caption first
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                >
                  #{tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    className="hover:text-primary-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={handleAddHashtag}
              placeholder="Add hashtag (press Enter)"
              className="input"
            />
          </div>

          {/* Platforms */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Platforms</h2>
            <div className="flex flex-wrap gap-2">
              {(
                ["instagram", "threads", "twitter", "linkedin"] as Platform[]
              ).map((platform) => {
                const isSelected = platforms.includes(platform);
                const charCount = captionWithHashtags.length;
                const limit = PLATFORM_LIMITS[platform];
                const isOver = charCount > limit;

                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {PLATFORM_ICONS[platform]}
                    <span className="capitalize">{platform}</span>
                    {isSelected && (
                      <span
                        className={`text-xs ${isOver ? "text-red-500" : "text-gray-400"}`}
                      >
                        {charCount}/{limit}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Preview & Score */}
        <div className="space-y-6">
          {/* Virality Score */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Virality Score</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCalculateScore}
                disabled={!caption}
                isLoading={calculateViralityScore.isPending}
              >
                Calculate
              </Button>
            </div>

            {viralityScore ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl font-bold text-primary-600">
                    {viralityScore.score}
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full transition-all"
                        style={{ width: `${viralityScore.score}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {viralityScore.reasoning}
                </p>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Tips to improve:
                  </p>
                  <ul className="space-y-1">
                    {viralityScore.tips.map((tip, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-600 flex items-start gap-2"
                      >
                        <span className="text-primary-500">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Write a caption and click Calculate to get your virality score.
              </p>
            )}
          </div>

          {/* Graphics & Emoji Recommendations */}
          <details className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <summary className="cursor-pointer font-medium text-gray-900 flex items-center justify-between">
              <span>💡 Graphics & Emoji Suggestions</span>
              <span className="text-sm text-gray-500">AI-powered</span>
            </summary>

            <div className="mt-4 space-y-3">
              <Button
                onClick={handleGetRecommendations}
                disabled={!caption || !platforms[0]}
                isLoading={suggestGraphicsEmoji.isPending}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                {suggestGraphicsEmoji.isPending
                  ? "Analyzing..."
                  : "Get Recommendations"}
              </Button>

              {suggestGraphicsEmoji.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">
                    {suggestGraphicsEmoji.error instanceof Error
                      ? suggestGraphicsEmoji.error.message
                      : "Failed to get recommendations"}
                  </p>
                </div>
              )}

              {recommendations && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 text-sm whitespace-pre-wrap font-mono text-xs text-gray-700">
                  {recommendations}
                </div>
              )}
            </div>
          </details>

          {/* Preview */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Preview</h2>
              {/* Platform Preview Tabs */}
              {platforms.length > 0 && (
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {platforms.map((platform) => {
                    const dims = getPlatformDimensions(
                      platform,
                      platformAspects[platform],
                    );
                    return (
                      <button
                        key={platform}
                        onClick={() => setPreviewPlatform(platform)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          previewPlatform === platform
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                        title={dims.label}
                      >
                        {PLATFORM_ICONS[platform]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aspect ratio selector */}
            {platforms.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Aspect:</span>
                <select
                  value={platformAspects[previewPlatform]}
                  onChange={(e) => {
                    const newIndex = parseInt(e.target.value, 10);
                    const selectedOption =
                      PLATFORM_ASPECT_OPTIONS[previewPlatform][newIndex];
                    // Update local state for dropdown
                    setPlatformAspects((prev) => ({
                      ...prev,
                      [previewPlatform]: newIndex,
                    }));
                    // Sync to store for export
                    if (selectedOption) {
                      setPlatformAspect(previewPlatform, {
                        width: selectedOption.width,
                        height: selectedOption.height,
                      });
                    }
                  }}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {PLATFORM_ASPECT_OPTIONS[previewPlatform].map(
                    (option, idx) => (
                      <option key={idx} value={idx}>
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="bg-gray-100 rounded-lg p-4">
              {(() => {
                // Combine generated images and selected media into preview items
                const previewItems = [
                  ...generatedImages.map((genImg, i) => ({
                    type: "generated" as const,
                    genType: genImg.type,
                    url: genImg.dataUrl,
                    index: i,
                  })),
                  ...selectedMedia.map((m) => ({
                    type: "media" as const,
                    media: m,
                  })),
                ];
                const totalItems = previewItems.length;
                const currentItem = previewItems[currentImageIndex];
                const dims = getPlatformDimensions(
                  previewPlatform,
                  platformAspects[previewPlatform],
                );

                if (totalItems === 0) {
                  return (
                    <div
                      className="bg-gray-200 rounded-lg flex items-center justify-center mb-4"
                      style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
                    >
                      <p className="text-gray-400">No media selected</p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Main Image Display */}
                    <div
                      className="relative bg-white rounded-lg overflow-hidden mb-4 group"
                      style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
                    >
                      {currentItem && (
                        <>
                          {currentItem.type === "media" &&
                          currentItem.media.type === "video" ? (
                            <div className="relative w-full h-full">
                              <video
                                src={`/media/${currentItem.media.originalPath}`}
                                className="w-full h-full object-contain"
                                controls
                                muted
                              />
                              {/* Video text overlay preview */}
                              {videoEdits[currentItem.media.id]?.textOverlays &&
                                videoEdits[currentItem.media.id]!.textOverlays
                                  .length > 0 && (
                                  <VideoTextPreview
                                    overlays={
                                      videoEdits[currentItem.media.id]!
                                        .textOverlays
                                    }
                                    currentTime={0}
                                    trimStart={0}
                                    trimEnd={999}
                                    showAllForEditing={true}
                                  />
                                )}
                            </div>
                          ) : (
                            <img
                              src={
                                currentItem.type === "generated"
                                  ? currentItem.url
                                  : editedImages[currentItem.media.id]
                                      ?.dataUrl ||
                                    `/media/${currentItem.media.originalPath}`
                              }
                              alt=""
                              className="w-full h-full object-cover object-center"
                            />
                          )}

                          {/* Edit Button Overlay - only for media, not generated images */}
                          {currentItem.type === "media" && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setEditingMedia(currentItem.media)
                                }
                                className="bg-white/90 hover:bg-white"
                              >
                                <svg
                                  className="w-4 h-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit{" "}
                                {currentItem.media.type === "video"
                                  ? "Video"
                                  : "Image"}
                              </Button>
                              {editedImages[currentItem.media.id]?.dataUrl && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    removeEditedImage(currentItem.media.id)
                                  }
                                  className="bg-white/90 hover:bg-white text-red-600 hover:text-red-700"
                                >
                                  <svg
                                    className="w-4 h-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  Reset
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Generated image badge */}
                          {currentItem.type === "generated" && (
                            <div
                              className={`absolute top-2 left-2 text-white text-xs px-2 py-1 rounded ${
                                currentItem.genType === "template"
                                  ? "bg-purple-500"
                                  : "bg-primary-500"
                              }`}
                            >
                              {currentItem.genType === "template"
                                ? "Template"
                                : "Collage"}
                            </div>
                          )}

                          {/* Navigation Arrows (if multiple items) */}
                          {totalItems > 1 && (
                            <>
                              <button
                                onClick={() =>
                                  setCurrentImageIndex((prev) =>
                                    prev === 0 ? totalItems - 1 : prev - 1,
                                  )
                                }
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                              >
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
                                    d="M15 19l-7-7 7-7"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() =>
                                  setCurrentImageIndex((prev) =>
                                    prev === totalItems - 1 ? 0 : prev + 1,
                                  )
                                }
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                              >
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
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>

                              {/* Image Counter */}
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                                {currentImageIndex + 1} / {totalItems}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* Thumbnail Strip (if multiple items) */}
                    {totalItems > 1 && (
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        {previewItems.map((item, index) => (
                          <button
                            key={
                              item.type === "generated"
                                ? `generated-${item.index}`
                                : item.media.id
                            }
                            onClick={() => setCurrentImageIndex(index)}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                              index === currentImageIndex
                                ? "border-primary-500"
                                : "border-transparent"
                            }`}
                          >
                            <img
                              src={
                                item.type === "generated"
                                  ? item.url
                                  : editedImages[item.media.id]?.dataUrl ||
                                    `/media/${item.media.thumbnailPath}`
                              }
                              alt=""
                              className="w-full h-full object-cover object-center"
                              onError={(e) => {
                                if (item.type === "media") {
                                  (e.target as HTMLImageElement).src =
                                    `/media/${item.media.originalPath}`;
                                }
                              }}
                            />
                            {item.type === "generated" && (
                              <div
                                className={`absolute top-0 left-0 text-white text-[8px] px-1 rounded-br ${
                                  item.genType === "template"
                                    ? "bg-purple-500"
                                    : "bg-primary-500"
                                }`}
                              >
                                {item.genType === "template" ? "T" : "C"}
                              </div>
                            )}
                            {item.type === "media" &&
                              editedImages[item.media.id]?.dataUrl && (
                                <div
                                  className="absolute top-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full"
                                  title="Edited"
                                />
                              )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="text-sm whitespace-pre-wrap">
                {captionWithHashtags || (
                  <span className="text-gray-400">
                    Your caption will appear here...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      <Modal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        title="Select Media"
        size="xl"
      >
        <div className="p-6">
          <div className="grid grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
            {allMedia?.map((media) => {
              const isSelected = selectedMediaIds.includes(media.id);
              return (
                <button
                  key={media.id}
                  onClick={() => {
                    if (isSelected) {
                      removeMedia(media.id);
                    } else {
                      addMedia(media.id);
                    }
                  }}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    isSelected ? "border-primary-500" : "border-transparent"
                  }`}
                >
                  <img
                    src={`/media/${media.thumbnailPath}`}
                    alt=""
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `/media/${media.originalPath}`;
                    }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                      <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowMediaPicker(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Image/Video Editor Modal */}
      {editingMedia &&
        (editingMedia.type === "video" ? (
          <VideoEditor
            media={editingMedia}
            projectId={projectId!}
            brandKit={project?.brandKit}
            aspectRatio={getPlatformDimensions(
              previewPlatform,
              platformAspects[previewPlatform],
            )}
            onSave={(edits) => {
              // Update videoEdits state with new text overlays for preview
              if (edits.textOverlays && edits.textOverlays.length > 0) {
                setVideoEdits((prev) => ({
                  ...prev,
                  [editingMedia.id]: { textOverlays: edits.textOverlays! },
                }));
              } else {
                // Remove from videoEdits if no text overlays
                setVideoEdits((prev) => {
                  const updated = { ...prev };
                  delete updated[editingMedia.id];
                  return updated;
                });
              }
            }}
            onClose={() => setEditingMedia(null)}
          />
        ) : (
          <ImageEditor
            media={editingMedia}
            projectId={projectId!}
            brandKit={project?.brandKit}
            editedImageUrl={editedImages[editingMedia.id]?.dataUrl}
            initialAdjustments={editedImages[editingMedia.id]?.adjustments}
            initialTextOverlays={editedImages[editingMedia.id]?.textOverlays}
            aspectRatio={getPlatformDimensions(
              previewPlatform,
              platformAspects[previewPlatform],
            )}
            onSave={(dataUrl, edits) => {
              setEditedImage(editingMedia.id, {
                dataUrl,
                adjustments: edits.adjustments,
                textOverlays: edits.textOverlays,
              });
              setEditingMedia(null);
            }}
            onClose={() => setEditingMedia(null)}
          />
        ))}

      {/* Template Renderer Modal */}
      {showTemplateRenderer && activeTemplate && (
        <TemplateRenderer
          template={activeTemplate}
          promptValues={templatePromptValues}
          availableMedia={(allMedia || []).map((m) => ({
            id: m.id,
            url: editedImages[m.id]?.dataUrl || `/media/${m.originalPath}`,
            thumbnailUrl:
              editedImages[m.id]?.dataUrl || `/media/${m.thumbnailPath}`,
          }))}
          brandKit={project?.brandKit}
          onGenerate={handleTemplateImageGenerated}
          onClose={() => setShowTemplateRenderer(false)}
        />
      )}

      {/* Slideshow Settings Modal */}
      <Modal
        isOpen={showSlideshowSettings}
        onClose={() => setShowSlideshowSettings(false)}
        title="Create Slideshow"
        size="md"
      >
        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Create a video slideshow from your {selectedImages.length}{" "}
              selected images. The slideshow will use your current edits and the
              selected aspect ratio (
              {
                getPlatformDimensions(
                  previewPlatform,
                  platformAspects[previewPlatform],
                ).label
              }
              ).
            </p>
          </div>

          {/* Selected Images Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images ({selectedImages.length})
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {selectedImages.map((media, index) => (
                <div key={media.id} className="relative flex-shrink-0">
                  <img
                    src={
                      editedImages[media.id]?.dataUrl ||
                      `/media/${media.thumbnailPath}`
                    }
                    alt={`Photo ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="absolute top-0 left-0 bg-black/60 text-white text-xs px-1.5 rounded-tl-lg rounded-br">
                    {index + 1}
                  </div>
                  {editedImages[media.id]?.dataUrl && (
                    <div
                      className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full"
                      title="Edited"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Transition Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transition Effect
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SLIDESHOW_TRANSITIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSlideshowTransition(t.value)}
                  className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                    slideshowTransition === t.value
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo Duration: {slideshowPhotoDuration}s
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={slideshowPhotoDuration}
              onChange={(e) =>
                setSlideshowPhotoDuration(parseFloat(e.target.value))
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1s</span>
              <span>10s</span>
            </div>
          </div>

          {/* Transition Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transition Duration: {slideshowTransitionDuration}s
            </label>
            <input
              type="range"
              min="0.5"
              max={Math.min(3, slideshowPhotoDuration - 0.5)}
              step="0.5"
              value={slideshowTransitionDuration}
              onChange={(e) =>
                setSlideshowTransitionDuration(parseFloat(e.target.value))
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5s</span>
              <span>{Math.min(3, slideshowPhotoDuration - 0.5)}s</span>
            </div>
          </div>

          {/* Duration Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Photos:</span>
                <span className="ml-2 font-medium">
                  {selectedImages.length}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Transitions:</span>
                <span className="ml-2 font-medium">
                  {selectedImages.length - 1}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Total Duration:</span>
                <span className="ml-2 font-medium">
                  {(
                    selectedImages.length * slideshowPhotoDuration -
                    (selectedImages.length - 1) * slideshowTransitionDuration
                  ).toFixed(1)}
                  s
                </span>
              </div>
            </div>
          </div>

          {/* Error */}
          {slideshowError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{slideshowError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowSlideshowSettings(false)}
              className="flex-1"
              disabled={isCreatingSlideshow}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSlideshow}
              className="flex-1"
              isLoading={isCreatingSlideshow}
              disabled={isCreatingSlideshow}
            >
              {isCreatingSlideshow ? "Creating..." : "Create Slideshow"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
