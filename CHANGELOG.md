# Changelog

## Unreleased - Dropout.tv Support

- **New Platform**: Added Dropout.tv support via the Video.js `textTrackSettings` native API (`embed.vhx.tv` iframe). All settings (font color, opacity, background color/opacity, window color/opacity, edge style, font family, font size) are applied through the player's own subtitle engine, consistent with how YouTube integration works.

## 1.0.1 - Style Refinements & Bug Fixes

- **Improved Visibility**: Enhanced drop shadow with a more robust, multi-layer shadow to ensure readability on light backgrounds on Nebula.
- **Color Fix**: Fixed an issue where selecting "Site Default" font color would incorrectly default to black when opacity was adjusted; it now correctly preserves the platform's native color. Added a warning to the popup when using incompatible settings.
- **Developer Experience**: Added automated CI checks via commit hooks.

## 1.0 - Initial Release

Per-platform settings including font family, size, color, opacity, edge style, and background colors. Features YouTube native integration and dynamic style injection via injected CSS on Nebula.
