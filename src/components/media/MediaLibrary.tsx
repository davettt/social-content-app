import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  useMedia,
  useUploadMedia,
  useDeleteMedia,
  useUpdateMedia,
} from "../../hooks/useMedia";
import { useProject } from "../../hooks/useProjects";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { PageLoader } from "../common/LoadingSpinner";
import { CollageBuilder } from "../editor/CollageBuilder";
import { useComposerStore } from "../../stores/composerStore";
import type { Media } from "../../types";

export function MediaLibrary() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: media, isLoading } = useMedia(projectId);
  const uploadMedia = useUploadMedia();
  const deleteMedia = useDeleteMedia();
  const updateMedia = useUpdateMedia();
  const { addGeneratedImage } = useComposerStore();

  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showCollageBuilder, setShowCollageBuilder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [collageResult, setCollageResult] = useState<string | null>(null);

  const onDrop = useCallback(
    async (
      acceptedFiles: File[],
      fileRejections: {
        file: File;
        errors: readonly { code: string; message: string }[];
      }[],
    ) => {
      if (!projectId) return;

      // Log rejected files
      if (fileRejections.length > 0) {
        console.error("Rejected files:", fileRejections);
        alert(
          `${fileRejections.length} file(s) rejected:\n${fileRejections
            .map(
              (r) =>
                `${r.file.name}: ${r.errors.map((e) => e.message).join(", ")}`,
            )
            .join("\n")}`,
        );
      }

      if (acceptedFiles.length === 0) {
        console.log("No accepted files");
        return;
      }

      console.log(
        "Uploading files:",
        acceptedFiles.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      );
      setIsUploading(true);
      try {
        await uploadMedia.mutateAsync({ projectId, files: acceptedFiles });
        console.log("Upload successful");
      } catch (error) {
        console.error("Upload failed:", error);
        alert(
          `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, uploadMedia],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"],
      "video/*": [".mp4", ".mov", ".webm"],
    },
  });

  if (isLoading) return <PageLoader />;

  const filteredMedia =
    filter === "all" ? media : media?.filter((m) => m.type === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="text-gray-600">
            {media?.length || 0} items in {project?.name}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => setShowCollageBuilder(true)}
            disabled={
              !media || media.filter((m) => m.type === "image").length < 2
            }
          >
            Create Collage
          </Button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(["all", "image", "video"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  filter === f
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {f === "all" ? "All" : f === "image" ? "Photos" : "Videos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`mb-8 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
            <span className="text-gray-600">Uploading...</span>
          </div>
        ) : isDragActive ? (
          <p className="text-primary-600">Drop files here...</p>
        ) : (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-gray-600">
              Drag and drop photos or videos, or{" "}
              <span className="text-primary-600 font-medium">browse</span>
            </p>
            <p className="mt-1 text-sm text-gray-400">
              JPG, PNG, GIF, WEBP, HEIC, MP4, MOV up to 100MB
            </p>
          </div>
        )}
      </div>

      {/* Media Grid */}
      {filteredMedia && filteredMedia.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              onClick={() => setSelectedMedia(item)}
              onDelete={() => {
                if (projectId && confirm("Delete this media?")) {
                  deleteMedia.mutate({ projectId, mediaId: item.id });
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No media yet. Upload some photos or videos to get started.
        </div>
      )}

      {/* Media Detail Modal */}
      <Modal
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        title="Media Details"
        size="lg"
      >
        {selectedMedia && projectId && (
          <MediaDetail
            media={selectedMedia}
            projectId={projectId}
            onUpdateMedia={async (mediaId, data) => {
              const updatedMedia = await updateMedia.mutateAsync({
                projectId,
                mediaId,
                data,
              });
              // Update selectedMedia with the returned data to refresh the UI
              setSelectedMedia(updatedMedia);
            }}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </Modal>

      {/* Collage Builder */}
      {showCollageBuilder && media && projectId && (
        <CollageBuilder
          availableMedia={media}
          projectId={projectId}
          brandKit={project?.brandKit}
          onSave={(collageDataUrl) => {
            setCollageResult(collageDataUrl);
            setShowCollageBuilder(false);
          }}
          onClose={() => setShowCollageBuilder(false)}
        />
      )}

      {/* Collage Result Modal */}
      <Modal
        isOpen={!!collageResult}
        onClose={() => setCollageResult(null)}
        title="Collage Created"
        size="lg"
      >
        {collageResult && (
          <div className="p-6">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-6 max-w-md mx-auto">
              <img
                src={collageResult}
                alt="Collage"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  // Download the collage
                  const link = document.createElement("a");
                  link.href = collageResult;
                  link.download = `collage-${Date.now()}.png`;
                  link.click();
                }}
                className="w-full"
              >
                Download Collage
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  // Add collage to composer store and navigate
                  addGeneratedImage(collageResult, "collage");
                  setCollageResult(null);
                  navigate(`/projects/${projectId}/compose`);
                }}
                className="w-full"
              >
                Use in Post Composer
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCollageResult(null)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MediaCard({
  media,
  onClick,
  onDelete,
}: {
  media: Media;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100">
      <img
        src={`/media/${media.thumbnailPath}`}
        alt={media.filename}
        className="w-full h-full object-cover object-center cursor-pointer"
        onClick={onClick}
        onError={(e) => {
          // Fallback for missing thumbnails
          (e.target as HTMLImageElement).src = `/media/${media.originalPath}`;
        }}
      />

      {media.type === "video" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {media.metadata.dateTaken && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
          {new Date(media.metadata.dateTaken).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function MediaDetail({
  media,
  onUpdateMedia,
  onClose,
}: {
  media: Media;
  projectId: string;
  onUpdateMedia: (
    mediaId: string,
    data: { userMetadata: Partial<Media["userMetadata"]> },
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customLocation, setCustomLocation] = useState(
    media.userMetadata.customLocation || "",
  );

  // Sync customLocation when media prop changes (after update)
  const mediaCustomLocation = media.userMetadata.customLocation || "";
  if (!isEditingLocation && customLocation !== mediaCustomLocation) {
    setCustomLocation(mediaCustomLocation);
  }

  const handleSaveLocation = async () => {
    setIsSaving(true);
    try {
      await onUpdateMedia(media.id, {
        userMetadata: { customLocation: customLocation.trim() || undefined },
      });
      setIsEditingLocation(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Get the display location (custom > auto-detected > coordinates)
  const getDisplayLocation = () => {
    if (media.userMetadata.customLocation) {
      return media.userMetadata.customLocation;
    }
    if (media.metadata.location?.placeName) {
      return media.metadata.location.placeName;
    }
    if (media.metadata.location) {
      return `${media.metadata.location.latitude.toFixed(4)}, ${media.metadata.location.longitude.toFixed(4)}`;
    }
    return null;
  };

  return (
    <div className="p-6">
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6">
        {media.type === "image" ? (
          <img
            src={`/media/${media.originalPath}`}
            alt={media.filename}
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            src={`/media/${media.originalPath}`}
            controls
            className="w-full h-full object-contain"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Filename:</span>
          <p className="font-medium">{media.filename}</p>
        </div>
        <div>
          <span className="text-gray-500">Type:</span>
          <p className="font-medium capitalize">{media.type}</p>
        </div>
        <div>
          <span className="text-gray-500">Dimensions:</span>
          <p className="font-medium">
            {media.metadata.width} x {media.metadata.height}
          </p>
        </div>
        {media.metadata.dateTaken && (
          <div>
            <span className="text-gray-500">Date Taken:</span>
            <p className="font-medium">
              {new Date(media.metadata.dateTaken).toLocaleString()}
            </p>
          </div>
        )}
        {media.metadata.camera && (
          <div>
            <span className="text-gray-500">Camera:</span>
            <p className="font-medium">{media.metadata.camera}</p>
          </div>
        )}
        <div className="col-span-2">
          <span className="text-gray-500">Location:</span>
          {isEditingLocation ? (
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder={
                  media.metadata.location?.placeName || "Enter location name"
                }
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveLocation();
                  if (e.key === "Escape") setIsEditingLocation(false);
                }}
              />
              <Button
                size="sm"
                onClick={handleSaveLocation}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCustomLocation(media.userMetadata.customLocation || "");
                  setIsEditingLocation(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : getDisplayLocation() ? (
            <div className="flex items-center gap-2 mt-1">
              <p className="font-medium">{getDisplayLocation()}</p>
              <button
                onClick={() => setIsEditingLocation(true)}
                className="text-primary-600 hover:text-primary-700 text-xs"
                title="Edit location"
              >
                (edit)
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-400 italic">No location data</p>
              <button
                onClick={() => setIsEditingLocation(true)}
                className="text-primary-600 hover:text-primary-700 text-xs"
                title="Add location"
              >
                (add)
              </button>
            </div>
          )}
          {media.userMetadata.customLocation &&
            media.metadata.location?.placeName && (
              <p className="text-xs text-gray-400 mt-1">
                Auto-detected: {media.metadata.location.placeName}
              </p>
            )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
