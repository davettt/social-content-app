import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../hooks/useProjects';
import { useMedia } from '../../hooks/useMedia';
import { useGenerateCaption, useSuggestHashtags, useCalculateViralityScore } from '../../hooks/useAI';
import { useComposerStore } from '../../stores/composerStore';
import { Button } from '../common/Button';
import { Textarea } from '../common/Input';
import { Modal } from '../common/Modal';
import { PageLoader } from '../common/LoadingSpinner';
import { ImageEditor } from '../editor/ImageEditor';
import type { Platform, Media } from '../../types';

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

const CAPTION_STYLES = [
  { id: 'auto', label: 'Auto', description: 'Let AI decide the best style' },
  { id: 'quote', label: 'Quote', description: 'Inspirational or thought-provoking quote' },
  { id: 'personal', label: 'Personal', description: 'Authentic personal thought or reflection' },
  { id: 'story', label: 'Story', description: 'Behind-the-scenes or storytelling' },
  { id: 'question', label: 'Question', description: 'Engage audience with a question' },
  { id: 'announcement', label: 'Announce', description: 'News or announcement style' },
] as const;

export function PostComposer() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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
    collages,
    setCaption,
    addHashtag,
    removeHashtag,
    togglePlatform,
    addMedia,
    removeMedia,
    setCaptionSuggestions,
    setViralityScore,
    setEditedImage,
    removeCollage,
  } = useComposerStore();

  const generateCaption = useGenerateCaption();
  const suggestHashtags = useSuggestHashtags();
  const calculateViralityScore = useCalculateViralityScore();

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingMedia, setEditingMedia] = useState<Media | null>(null);
  const [captionStyle, setCaptionStyle] = useState<string>('auto');
  const [imageContext, setImageContext] = useState('');

  if (projectLoading || mediaLoading) return <PageLoader />;

  const selectedMedia = allMedia?.filter((m) => selectedMediaIds.includes(m.id)) || [];

  const handleGenerateCaption = async () => {
    if (!project) return;

    const result = await generateCaption.mutateAsync({
      mediaDescription: imageContext || 'Photo to share on social media',
      businessContext: {
        industry: project.businessInfo.industry,
        targetAudience: project.businessInfo.targetAudience,
        tone: project.businessInfo.tone,
      },
      platform: platforms[0] || 'instagram',
      captionStyle: captionStyle,
    });

    setCaptionSuggestions(result.captions);
  };

  const handleSuggestHashtags = async () => {
    if (!caption) return;

    const result = await suggestHashtags.mutateAsync({
      caption,
      industry: project?.businessInfo.industry,
      platform: platforms[0] || 'instagram',
    });

    result.hashtags.forEach((tag) => addHashtag(tag));
  };

  const handleCalculateScore = async () => {
    if (!caption) return;

    const result = await calculateViralityScore.mutateAsync({
      caption,
      hashtags,
      mediaType: selectedMedia[0]?.type || 'image',
      platform: platforms[0] || 'instagram',
      businessContext: { industry: project?.businessInfo.industry },
    });

    setViralityScore(result);
  };

  const handleAddHashtag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (hashtagInput.trim()) {
        addHashtag(hashtagInput);
        setHashtagInput('');
      }
    }
  };

  const captionWithHashtags = `${caption}${hashtags.length > 0 ? '\n\n' + hashtags.map((h) => `#${h}`).join(' ') : ''}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Post</h1>
        <Button
          onClick={() => navigate(`/projects/${projectId}/export`)}
          disabled={!caption || (selectedMedia.length === 0 && collages.length === 0)}
        >
          Export
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Editor */}
        <div className="space-y-6">
          {/* Media Selection */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Media</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowMediaPicker(true)}>
                {selectedMedia.length > 0 || collages.length > 0 ? 'Add More' : 'Add Media'}
              </Button>
            </div>

            {selectedMedia.length > 0 || collages.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {/* Show collages first */}
                {collages.map((collageUrl, index) => (
                  <div key={`collage-${index}`} className="relative flex-shrink-0">
                    <img
                      src={collageUrl}
                      alt={`Collage ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="absolute top-0 left-0 bg-primary-500 text-white text-[10px] px-1 rounded-tl-lg rounded-br">
                      Collage
                    </div>
                    <button
                      onClick={() => removeCollage(index)}
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
                      src={editedImages[media.id] || `/media/${media.thumbnailPath}`}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `/media/${media.originalPath}`;
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
              <p className="text-sm font-medium text-gray-700 mb-3">AI Caption Assistant</p>

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
                <label className="block text-xs text-gray-500 mb-1">Caption style</label>
                <div className="flex flex-wrap gap-2">
                  {CAPTION_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setCaptionStyle(style.id)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        captionStyle === style.id
                          ? 'bg-primary-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
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
                <p className="text-sm text-gray-500">AI Suggestions (click to use):</p>
                {captionSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setCaption(suggestion.text)}
                    className="block w-full text-left p-3 text-sm bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-transparent hover:border-primary-200"
                  >
                    <span className="text-xs text-primary-500 font-medium uppercase">{suggestion.length}</span>
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
              {(['instagram', 'threads', 'twitter', 'linkedin'] as Platform[]).map((platform) => {
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
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {PLATFORM_ICONS[platform]}
                    <span className="capitalize">{platform}</span>
                    {isSelected && (
                      <span className={`text-xs ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
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

                <p className="text-sm text-gray-600 mb-4">{viralityScore.reasoning}</p>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Tips to improve:</p>
                  <ul className="space-y-1">
                    {viralityScore.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
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

          {/* Preview */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Preview</h2>

            <div className="bg-gray-100 rounded-lg p-4">
              {(() => {
                // Combine collages and selected media into preview items
                const previewItems = [
                  ...collages.map((url, i) => ({ type: 'collage' as const, url, index: i })),
                  ...selectedMedia.map((m) => ({ type: 'media' as const, media: m })),
                ];
                const totalItems = previewItems.length;
                const currentItem = previewItems[currentImageIndex];

                if (totalItems === 0) {
                  return (
                    <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                      <p className="text-gray-400">No media selected</p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Main Image Display */}
                    <div className="relative aspect-square bg-white rounded-lg overflow-hidden mb-4 group">
                      {currentItem && (
                        <>
                          <img
                            src={
                              currentItem.type === 'collage'
                                ? currentItem.url
                                : editedImages[currentItem.media.id] || `/media/${currentItem.media.originalPath}`
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />

                          {/* Edit Button Overlay - only for media, not collages */}
                          {currentItem.type === 'media' && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingMedia(currentItem.media)}
                                className="bg-white/90 hover:bg-white"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Image
                              </Button>
                            </div>
                          )}

                          {/* Collage badge */}
                          {currentItem.type === 'collage' && (
                            <div className="absolute top-2 left-2 bg-primary-500 text-white text-xs px-2 py-1 rounded">
                              Collage
                            </div>
                          )}

                          {/* Navigation Arrows (if multiple items) */}
                          {totalItems > 1 && (
                            <>
                              <button
                                onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? totalItems - 1 : prev - 1))}
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setCurrentImageIndex((prev) => (prev === totalItems - 1 ? 0 : prev + 1))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
                            key={item.type === 'collage' ? `collage-${item.index}` : item.media.id}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                              index === currentImageIndex ? 'border-primary-500' : 'border-transparent'
                            }`}
                          >
                            <img
                              src={
                                item.type === 'collage'
                                  ? item.url
                                  : editedImages[item.media.id] || `/media/${item.media.thumbnailPath}`
                              }
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                if (item.type === 'media') {
                                  (e.target as HTMLImageElement).src = `/media/${item.media.originalPath}`;
                                }
                              }}
                            />
                            {item.type === 'collage' && (
                              <div className="absolute top-0 left-0 bg-primary-500 text-white text-[8px] px-1 rounded-br">C</div>
                            )}
                            {item.type === 'media' && editedImages[item.media.id] && (
                              <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full" title="Edited" />
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
                  <span className="text-gray-400">Your caption will appear here...</span>
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
                    isSelected ? 'border-primary-500' : 'border-transparent'
                  }`}
                >
                  <img
                    src={`/media/${media.thumbnailPath}`}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `/media/${media.originalPath}`;
                    }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                      <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

      {/* Image Editor Modal */}
      {editingMedia && (
        <ImageEditor
          media={editingMedia}
          brandKit={project?.brandKit}
          onSave={(dataUrl, _edits) => {
            setEditedImage(editingMedia.id, dataUrl);
            setEditingMedia(null);
          }}
          onClose={() => setEditingMedia(null)}
        />
      )}
    </div>
  );
}
