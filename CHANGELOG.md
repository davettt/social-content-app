# Changelog

## [1.4.0] - 2026-01-19

### Removed
- **Template system** - Removed templates feature due to fundamental architecture issues (preview cards disconnected from renderer). Will be replaced with decorative graphic elements in a future release (TC-95)
  - Deleted TemplateRenderer, TemplatesPage, and templateData components
  - Removed templates navigation and routes
  - Simplified GeneratedImage type to collage-only

## [1.3.1] - 2026-01-16

### Added
- **Text stroke/outline** - Add outline effect to text overlays with customizable stroke color and width (0-10px)

### Fixed
- **Background color export** - Background color boxes now properly render in exported videos (property was in UI but not passed to FFmpeg)

### Changed
- Deferred emoji rendering and graphics features to dedicated recommendations system (TC-89) - users will receive AI-assisted suggestions to apply emoji/graphics using native platform tools for guaranteed quality

## [1.3.0] - 2026-01-09

### Added
- **Video stitcher** - Combine multiple video clips into a single video with automatic aspect ratio normalization (1080x1920 portrait output with letterboxing/pillarboxing)
- **Video text overlay** - Add text overlays to videos with timing presets (full video, first/last 3s, first/last 5s), position options, and styling (font, color, shadow, background)
- **Coolors.co palette import** - Import color palettes directly from Coolors.co URLs in brand kit settings
- **Help guidance for video text** - Collapsible help section explaining when to add text in-app vs Instagram (in-app for brand fonts, multi-platform; Instagram for interactive elements, animations)

### Changed
- Video edits (trim, speed, text overlays) now fully persist and apply to exports via FFmpeg processing
- Improved preview UX for video trimming with clickable start/end buttons
- **Redesigned video editor UI** - Text controls moved to right sidebar panel (matching ImageEditor layout), brand fonts and colors now available for video text overlays

### Known Limitations
- Safe zone margins (5%) may not be sufficient for Reels/Stories where Instagram overlays UI at top (song name, username) and bottom (captions, buttons). Top-aligned text may need manual adjustment for these formats.

### Fixed
- FFmpeg concat now handles mixed aspect ratios by normalizing all clips to consistent dimensions
- Videos without audio tracks no longer cause stitching failures (silent audio auto-generated)

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
