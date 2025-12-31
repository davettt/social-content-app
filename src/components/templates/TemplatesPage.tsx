import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import type { TemplateCategory } from '../../types';

interface TemplatePreview {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  thumbnail: string;
  platforms: string[];
}

// Built-in templates
const TEMPLATES: TemplatePreview[] = [
  {
    id: 'day-in-life',
    name: 'Day in the Life',
    category: 'story',
    description: 'Series of timestamped moments throughout a day',
    thumbnail: 'gradient-1',
    platforms: ['instagram', 'threads'],
  },
  {
    id: 'before-after',
    name: 'Before & After',
    category: 'story',
    description: 'Side-by-side comparison showing transformation',
    thumbnail: 'gradient-2',
    platforms: ['instagram', 'twitter'],
  },
  {
    id: 'quote-minimal',
    name: 'Minimal Quote',
    category: 'quote',
    description: 'Clean quote design with subtle background',
    thumbnail: 'gradient-3',
    platforms: ['instagram', 'linkedin'],
  },
  {
    id: 'quote-bold',
    name: 'Bold Quote',
    category: 'quote',
    description: 'Eye-catching quote with strong typography',
    thumbnail: 'gradient-4',
    platforms: ['instagram', 'twitter'],
  },
  {
    id: 'carousel-tips',
    name: 'Tips Carousel',
    category: 'tips',
    description: 'Multi-slide carousel with numbered tips',
    thumbnail: 'gradient-5',
    platforms: ['instagram', 'linkedin'],
  },
  {
    id: 'carousel-how-to',
    name: 'How-To Guide',
    category: 'carousel',
    description: 'Step-by-step tutorial format',
    thumbnail: 'gradient-6',
    platforms: ['instagram'],
  },
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    category: 'product',
    description: 'Highlight product features elegantly',
    thumbnail: 'gradient-7',
    platforms: ['instagram', 'linkedin'],
  },
  {
    id: 'testimonial',
    name: 'Testimonial Card',
    category: 'testimonial',
    description: 'Customer review with photo and quote',
    thumbnail: 'gradient-8',
    platforms: ['instagram', 'linkedin'],
  },
  {
    id: 'bts-story',
    name: 'Behind the Scenes',
    category: 'behind-the-scenes',
    description: 'Casual, authentic look at your process',
    thumbnail: 'gradient-9',
    platforms: ['instagram', 'threads'],
  },
];

const CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Templates' },
  { value: 'story', label: 'Stories' },
  { value: 'quote', label: 'Quotes' },
  { value: 'carousel', label: 'Carousels' },
  { value: 'tips', label: 'Tips' },
  { value: 'product', label: 'Products' },
  { value: 'testimonial', label: 'Testimonials' },
  { value: 'behind-the-scenes', label: 'Behind the Scenes' },
];

const GRADIENTS: Record<string, string> = {
  'gradient-1': 'from-purple-500 to-pink-500',
  'gradient-2': 'from-blue-500 to-cyan-500',
  'gradient-3': 'from-gray-700 to-gray-900',
  'gradient-4': 'from-orange-500 to-red-500',
  'gradient-5': 'from-green-500 to-teal-500',
  'gradient-6': 'from-indigo-500 to-purple-500',
  'gradient-7': 'from-amber-500 to-orange-500',
  'gradient-8': 'from-rose-500 to-pink-500',
  'gradient-9': 'from-slate-600 to-slate-800',
};

export function TemplatesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreview | null>(null);

  const filteredTemplates =
    selectedCategory === 'all'
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === selectedCategory);

  const handleUseTemplate = (template: TemplatePreview) => {
    // Navigate to composer with template
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
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            className="card group cursor-pointer overflow-hidden"
            onClick={() => setSelectedTemplate(template)}
          >
            {/* Template Preview */}
            <div
              className={`aspect-square bg-gradient-to-br ${GRADIENTS[template.thumbnail]} flex items-center justify-center`}
            >
              <div className="text-white/80 text-center p-8">
                <div className="text-4xl mb-2">
                  {template.category === 'quote' && '"'}
                  {template.category === 'tips' && '1.'}
                  {template.category === 'story' && '📸'}
                  {template.category === 'carousel' && '→'}
                  {template.category === 'product' && '✨'}
                  {template.category === 'testimonial' && '★'}
                  {template.category === 'behind-the-scenes' && '🎬'}
                </div>
                <p className="text-sm opacity-75">Preview</p>
              </div>
            </div>

            {/* Template Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{template.description}</p>

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
          <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden">
            <div
              className={`aspect-video bg-gradient-to-br ${GRADIENTS[selectedTemplate.thumbnail]} flex items-center justify-center`}
            >
              <div className="text-white text-center">
                <p className="text-lg font-medium">{selectedTemplate.name}</p>
              </div>
            </div>

            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h2>
              <p className="text-gray-600 mt-2">{selectedTemplate.description}</p>

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
                <Button variant="secondary" onClick={() => setSelectedTemplate(null)}>
                  Cancel
                </Button>
                <Button onClick={() => handleUseTemplate(selectedTemplate)} className="flex-1">
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
