# Changelog

## [1.2.0] - 2025-12-31

### Added
- **Template customization controls** - Text color, accent color (for icons), font family, and text size adjustable from brand kit with fallbacks
- **Brand kit integration in templates** - Templates now use project brand colors, fonts, and accent colors
- **Accent color picker** - Separate color control for decorative elements (stars, numbers, quote marks)

### Changed
- Renamed `collages` to `generatedImages` in composer store with type differentiation (collage vs template)
- Template images now show correct "Template" badge instead of "Collage"
- Moved TEMPLATES constant to separate data file for better code organization

### Removed
- Carousel templates (Day in Life, Tips Carousel, How-To Guide) - temporarily removed pending multi-slide generation support (see TC-50)

### Fixed
- Template background images no longer duplicate in exports
- Lint errors in MediaLibrary and TemplatesPage
- Edited images now clear when media is removed (prevents stale edits persisting)
- Added "Reset" button to clear image edits and restore original
- Drop shadow now applies immediately when adding text (checkbox was checked but shadow not rendered)
- Re-editing an image no longer duplicates text layers (text is baked into flattened image)

## [1.1.0] - 2025-12-31

### Added
- **Platform preview in PostComposer** - Tab switcher to preview content at different aspect ratios (Instagram 1:1, Threads 4:5, Twitter 16:9, LinkedIn 1.91:1)
- **Pan/zoom controls in CollageBuilder** - Scroll to zoom, drag to pan images within collage slots
- **Pan/zoom controls in ImageEditor** - Scroll to zoom, drag to reposition the main image
- **Text overlay in CollageBuilder** - Add text with brand colors, font selection, and positioning
- **Drop shadow option** - Toggle drop shadow for text in both ImageEditor and CollageBuilder

### Changed
- All image displays now use center-cropping for consistent appearance across platforms
- Improved brand color integration in editors

### Fixed
- Text font size consistency between preview and export in CollageBuilder

## [1.0.0] - 2025-12-31

### Added
- Initial release
- Project management with multi-brand support
- AI-powered website analysis for brand setup
- Business questionnaire flow
- Media library with drag-and-drop upload
- EXIF metadata extraction
- Thumbnail generation
- Image editor with Fabric.js
  - Brightness, contrast, saturation adjustments
  - Filter presets (Vibrant, Moody, Clean, etc.)
  - Text overlay with font selection
- Video editor
  - Trim functionality
  - Speed adjustment (0.5x-2x)
  - Audio controls (mute, volume)
- Collage builder with multiple layouts
- Post composer
  - AI caption generation
  - Hashtag suggestions
  - Platform selection
- Virality scoring with improvement tips
- Template library with viral formats
- Export system
  - Platform-specific image sizing
  - ZIP download
- Support for Instagram, Threads, Twitter/X, LinkedIn
