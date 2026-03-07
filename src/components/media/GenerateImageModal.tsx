import { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { useImageGenProviders, useGenerateImage } from "../../hooks/useMedia";
import type { ImageGenProvider } from "../../types";

interface GenerateImageModalProps {
  projectId: string;
  onClose: () => void;
  onGenerated: () => void;
}

export function GenerateImageModal({
  projectId,
  onClose,
  onGenerated,
}: GenerateImageModalProps) {
  const { data: providerData, isLoading: loadingProviders } =
    useImageGenProviders();
  const generateImage = useGenerateImage();

  const [prompt, setPrompt] = useState("");
  const [selectedProvider, setSelectedProvider] =
    useState<ImageGenProvider | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");

  // Set defaults once providers load
  useEffect(() => {
    if (providerData?.providers?.length && !selectedProvider) {
      const first = providerData.providers[0] ?? null;
      setSelectedProvider(first);
      setSelectedModelId(first?.models[0]?.id ?? "");
    }
  }, [providerData, selectedProvider]);

  const handleProviderChange = (providerId: string) => {
    const provider =
      providerData?.providers.find((p) => p.id === providerId) ?? null;
    setSelectedProvider(provider);
    setSelectedModelId(provider?.models[0]?.id ?? "");
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedProvider || !selectedModelId) return;

    try {
      await generateImage.mutateAsync({
        projectId,
        provider: selectedProvider.id,
        modelId: selectedModelId,
        prompt: prompt.trim(),
        aspectRatio: selectedAspectRatio,
      });
      onGenerated();
      onClose();
    } catch {
      // error displayed inline
    }
  };

  const noProviders =
    !loadingProviders &&
    (!providerData?.providers || providerData.providers.length === 0);

  return (
    <Modal isOpen onClose={onClose} title="Generate Image with AI" size="lg">
      <div className="p-6 space-y-5">
        {loadingProviders ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : noProviders ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">
              No image generation providers configured
            </p>
            <p>
              Add{" "}
              <code className="bg-amber-100 px-1 rounded">HF_TOKEN</code> (free
              — huggingface.co) or{" "}
              <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code>{" "}
              to your <code className="bg-amber-100 px-1 rounded">.env</code>{" "}
              and restart the server.
            </p>
          </div>
        ) : (
          <>
            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A sun-drenched café terrace in Paris with people enjoying coffee, warm afternoon light, photorealistic..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
              />
              <p className="mt-1 text-xs text-gray-400">
                Cmd+Enter to generate
              </p>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aspect Ratio
              </label>
              <div className="flex gap-2 flex-wrap">
                {providerData?.aspectRatios.map((ar) => (
                  <button
                    key={ar.id}
                    onClick={() => setSelectedAspectRatio(ar.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedAspectRatio === ar.id
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider + Model */}
            <div className="grid grid-cols-2 gap-4">
              {providerData && providerData.providers.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={selectedProvider?.id ?? ""}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    {providerData.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div
                className={
                  providerData && providerData.providers.length > 1
                    ? ""
                    : "col-span-2"
                }
              >
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  {selectedProvider?.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {selectedProvider?.models.find((m) => m.id === selectedModelId)
                  ?.description && (
                  <p className="mt-1 text-xs text-gray-400">
                    {
                      selectedProvider.models.find(
                        (m) => m.id === selectedModelId,
                      )?.description
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Error */}
            {generateImage.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {generateImage.error instanceof Error
                  ? generateImage.error.message
                  : "Generation failed. Please try again."}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={generateImage.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={
                  !prompt.trim() || !selectedModelId || generateImage.isPending
                }
              >
                {generateImage.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Generating...
                  </span>
                ) : (
                  "Generate Image"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
