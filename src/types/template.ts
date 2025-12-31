import type { Platform } from './project';

export type TemplateCategory =
  | 'story'
  | 'quote'
  | 'carousel'
  | 'product'
  | 'testimonial'
  | 'behind-the-scenes'
  | 'tips';

export interface TemplateElement {
  type: 'image' | 'text' | 'shape';
  position: string; // e.g., 'full', 'top-left', 'bottom', 'center'
  content?: string; // For text elements, can include placeholders like {time}, {caption}
  style?: Record<string, string | number>;
}

export interface TemplateSlide {
  aspectRatio: string; // e.g., '1:1', '4:5', '9:16'
  elements: TemplateElement[];
}

export interface TemplateLayout {
  type: 'single' | 'carousel' | 'collage';
  slides: TemplateSlide[];
}

export interface TemplateStyle {
  font: string;
  textColor: string;
  backgroundColor?: string;
  textShadow: boolean;
  borderRadius?: number;
}

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  platforms: Platform[];
  layout: TemplateLayout;
  style: TemplateStyle;
  thumbnail?: string;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface TemplatePreview {
  id: string;
  name: string;
  category: TemplateCategory;
  thumbnail: string;
  platforms: Platform[];
}
