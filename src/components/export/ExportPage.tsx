import { useState } from "react";
import { useParams } from "react-router-dom";
import { useProject } from "../../hooks/useProjects";
import { useComposerStore } from "../../stores/composerStore";
import { Button } from "../common/Button";
import { PageLoader } from "../common/LoadingSpinner";
import { exportApi } from "../../services/api";
import type { Platform } from "../../types";

const PLATFORM_INFO: Record<
  Platform,
  { name: string; icon: string; color: string }
> = {
  instagram: {
    name: "Instagram",
    icon: "IG",
    color: "from-purple-500 to-pink-500",
  },
  threads: { name: "Threads", icon: "@", color: "from-gray-700 to-gray-900" },
  twitter: {
    name: "Twitter / X",
    icon: "X",
    color: "from-blue-400 to-blue-600",
  },
  linkedin: {
    name: "LinkedIn",
    icon: "in",
    color: "from-blue-600 to-blue-800",
  },
};

export function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { isLoading } = useProject(projectId);
  const {
    platforms,
    platformAspects,
    caption,
    hashtags,
    selectedMediaIds,
    editedImages,
    generatedImages,
  } = useComposerStore();

  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    id: string;
    downloadUrl: string;
  } | null>(null);

  if (isLoading) return <PageLoader />;

  const hasContent =
    caption || selectedMediaIds.length > 0 || generatedImages.length > 0;

  const handleExport = async () => {
    if (!projectId) return;
    setIsExporting(true);

    try {
      // Transform editedImages to just dataUrls for the API
      const editedImageUrls: Record<string, string> = {};
      for (const [mediaId, data] of Object.entries(editedImages)) {
        if (data?.dataUrl) {
          editedImageUrls[mediaId] = data.dataUrl;
        }
      }

      // Extract just the dataUrls from generatedImages
      const collageUrls = generatedImages.map((img) => img.dataUrl);

      const result = await exportApi.prepare({
        projectId,
        platforms: platforms,
        platformAspects: platformAspects,
        caption: captionWithHashtags,
        mediaIds: selectedMediaIds,
        editedImages: editedImageUrls,
        collages: collageUrls,
      });

      setExportResult({
        id: result.id,
        downloadUrl: exportApi.getDownloadUrl(result.id),
      });
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const captionWithHashtags = `${caption}${hashtags.length > 0 ? "\n\n" + hashtags.map((h) => `#${h}`).join(" ") : ""}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Export Content</h1>
        <p className="text-gray-600 mt-1">
          Download your content and AirDrop to your phone
        </p>
      </div>

      {!hasContent ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No content to export
          </h3>
          <p className="text-gray-500">
            Create a post first, then come back to export.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Export Options */}
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Selected Platforms
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {platforms.map((platform) => {
                  const info = PLATFORM_INFO[platform];
                  return (
                    <div
                      key={platform}
                      className={`p-3 rounded-xl bg-gradient-to-br ${info.color} text-white`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{info.icon}</span>
                        <span className="font-medium">{info.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleExport}
              isLoading={isExporting}
              className="w-full"
              size="lg"
            >
              Prepare Export
            </Button>
          </div>

          {/* Preview / Result */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              {exportResult ? "Export Ready" : "Preview"}
            </h2>

            {exportResult ? (
              <div className="space-y-6">
                {/* Download Section */}
                <div className="text-center p-6 bg-green-50 rounded-xl">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
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
                  <p className="text-lg font-medium text-gray-900 mb-4">
                    Ready to download!
                  </p>
                  <a
                    href={exportResult.downloadUrl}
                    download
                    className="btn-primary inline-flex items-center gap-2"
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download ZIP
                  </a>
                </div>

                {/* AirDrop Instructions */}
                <div className="border-t pt-6">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                    Transfer to iPhone via AirDrop
                  </h3>
                  <ol className="space-y-3 text-sm text-gray-600">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                        1
                      </span>
                      <span>
                        Open <strong>Finder</strong> and go to your{" "}
                        <strong>Downloads</strong> folder
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                        2
                      </span>
                      <span>
                        Find the downloaded ZIP file and{" "}
                        <strong>double-click</strong> to extract it
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                        3
                      </span>
                      <span>
                        Select the files you want, <strong>right-click</strong>{" "}
                        and choose <strong>Share → AirDrop</strong>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                        4
                      </span>
                      <span>Select your iPhone from the AirDrop panel</span>
                    </li>
                  </ol>
                  <p className="mt-4 text-xs text-gray-500">
                    Tip: Make sure AirDrop is enabled on your iPhone (Settings →
                    General → AirDrop → Everyone or Contacts Only)
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                  {captionWithHashtags || "Your content will appear here..."}
                </div>
                {selectedMediaIds.length > 0 && (
                  <p className="mt-4 text-sm text-gray-500">
                    + {selectedMediaIds.length} media file(s)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
