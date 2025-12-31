import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../common/Button";
import { TEMPLATES } from "./templateData";
import type { Template, TemplateCategory } from "../../types";

const CATEGORIES: { value: TemplateCategory | "all"; label: string }[] = [
  { value: "all", label: "All Templates" },
  { value: "story", label: "Stories" },
  { value: "quote", label: "Quotes" },
  { value: "tips", label: "Tips" },
  { value: "product", label: "Products" },
  { value: "testimonial", label: "Testimonials" },
  { value: "behind-the-scenes", label: "Behind the Scenes" },
];

// Visual preview component for templates
function TemplatePreviewCard({ template }: { template: Template }) {
  const { style } = template;

  // Get background style
  const getBgStyle = () => {
    if (style.backgroundColor) {
      // Check if it's a gradient
      if (style.backgroundColor.includes("gradient")) {
        return { background: style.backgroundColor };
      }
      return { backgroundColor: style.backgroundColor };
    }
    // Fallback gradient based on category
    const gradients: Record<string, string> = {
      quote: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      story: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      tips: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      product: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      testimonial: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
      "behind-the-scenes": "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    };
    return { background: gradients[template.category] || gradients.quote };
  };

  return (
    <div
      className="aspect-square rounded-lg overflow-hidden relative"
      style={getBgStyle()}
    >
      {/* Content preview based on template type */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center p-4"
        style={{ color: style.textColor }}
      >
        {template.category === "quote" && (
          <>
            <div className="text-4xl mb-2" style={{ opacity: 0.3 }}>
              "
            </div>
            <p
              className="text-center text-sm px-2 leading-relaxed"
              style={{
                fontFamily: style.font,
                textShadow: style.textShadow
                  ? "1px 1px 2px rgba(0,0,0,0.3)"
                  : "none",
              }}
            >
              Your inspiring quote goes here...
            </p>
            <div className="text-4xl mt-2" style={{ opacity: 0.3 }}>
              "
            </div>
          </>
        )}

        {template.category === "tips" && (
          <>
            <div className="text-5xl font-bold mb-2" style={{ opacity: 0.2 }}>
              01
            </div>
            <p className="text-sm text-center">Your tip here</p>
          </>
        )}

        {template.category === "story" && (
          <>
            <div className="w-16 h-16 bg-white/20 rounded-lg mb-2 flex items-center justify-center">
              <span className="text-2xl">📸</span>
            </div>
            <p className="text-xs opacity-70">Your story</p>
          </>
        )}

        {template.category === "product" && (
          <>
            <div className="w-20 h-20 bg-white/30 rounded-lg mb-2 flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
            <p className="text-xs font-medium">Product Name</p>
          </>
        )}

        {template.category === "testimonial" && (
          <>
            <div className="text-lg mb-1">★★★★★</div>
            <p className="text-xs text-center italic px-2">
              "Amazing product!"
            </p>
            <div className="w-8 h-8 bg-white/30 rounded-full mt-2" />
          </>
        )}

        {template.category === "behind-the-scenes" && (
          <>
            <div className="text-2xl mb-1">🎬</div>
            <p className="text-xs opacity-70">Behind the scenes</p>
          </>
        )}
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | "all"
  >("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );

  const filteredTemplates =
    selectedCategory === "all"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === selectedCategory);

  const handleUseTemplate = (template: Template) => {
    // Navigate to composer with template ID
    navigate(`/projects/${projectId}/compose?template=${template.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <p className="text-gray-600 mt-1">
          Start with a viral template and customize it for your brand
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.value
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="card group cursor-pointer overflow-hidden hover:shadow-lg transition-shadow"
            onClick={() => setSelectedTemplate(template)}
          >
            {/* Template Preview */}
            <TemplatePreviewCard template={template} />

            {/* Template Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {template.description}
              </p>

              <div className="flex items-center gap-2 mt-3">
                {template.platforms.map((platform) => (
                  <span
                    key={platform}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* Preview */}
            <div className="p-6 bg-gray-100">
              <div className="max-w-xs mx-auto">
                <TemplatePreviewCard template={selectedTemplate} />
              </div>
            </div>

            {/* Info */}
            <div className="p-6 overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedTemplate.name}
              </h2>
              <p className="text-gray-600 mt-2">
                {selectedTemplate.description}
              </p>

              {/* Layout info */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">Format: </span>
                  {selectedTemplate.layout.type === "carousel"
                    ? `${selectedTemplate.layout.slides.length}-slide carousel`
                    : "Single image"}
                  {" • "}
                  {selectedTemplate.layout.slides[0]?.aspectRatio} aspect ratio
                </p>
              </div>

              {/* Caption prompts preview */}
              {selectedTemplate.captionPrompts &&
                selectedTemplate.captionPrompts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Content you'll add:
                    </p>
                    <div className="space-y-2">
                      {selectedTemplate.captionPrompts.map((prompt, i) => (
                        <div key={i} className="text-sm">
                          <span className="text-gray-500">
                            {prompt.placeholder}
                          </span>
                          <p className="text-gray-400 italic text-xs mt-0.5">
                            e.g., "{prompt.example}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Suggested hashtags */}
              {selectedTemplate.suggestedHashtags && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Suggested hashtags:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.suggestedHashtags.map((tag) => (
                      <span key={tag} className="text-xs text-primary-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-gray-500">Works on:</span>
                {selectedTemplate.platforms.map((platform) => (
                  <span
                    key={platform}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded capitalize"
                  >
                    {platform}
                  </span>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedTemplate(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleUseTemplate(selectedTemplate)}
                  className="flex-1"
                >
                  Use This Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
