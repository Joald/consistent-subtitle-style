# Changelog

## 1.1.0 - Multi-Platform Expansion

### New Platforms

- **Dropout**
- **Prime Video** (including 11 regional Amazon domains)
- **Max** (HBO Max)
- **Crunchyroll**
- **Disney+**
- **Netflix**
- **Vimeo** (including embedded player)

### New Features

- **Per-site settings**: Each setting can be configured globally or per-platform, so you can have different styles on Netflix vs YouTube.
- **Preset system**: 3 built-in presets (Do Nothing, High Contrast, Recommended) plus custom presets you can save and share.
- **Settings import/export**: Copy your settings as JSON and paste them on another device or browser.
- **Live settings updates on Dropout**: Changes apply instantly without reloading the page.
- **Platform support indicator**: Shows which platform is detected and whether it's supported.
- **Per-platform documentation**: In-extension technical details for each platform — supported settings, known limitations.
- **Platform logos**: Brand icons throughout the popup for quick visual identification.
- **Keyboard navigation**: Full keyboard support for all custom dropdowns.

### Improvements

- **Override badges**: Visual indicators when a platform has per-site overrides that differ from global settings.
- **Effective values display**: The popup always shows what's actually applied — per-site override if one exists, otherwise global.

### CI/CD

- GitHub Actions CI workflow for automated testing on push/PR.
- Firefox build pipeline and release packaging.

### Stats

- **943 tests** across 25 test files (up from 62 at v1.0)
- **9 supported platforms**: YouTube, Nebula, Dropout, Prime Video, Max, Crunchyroll, Disney+, Netflix, Vimeo
- **Zero network requests** — all processing is local


## 1.0.1 - Style Refinements & Bug Fixes

- **Improved Visibility**: Enhanced drop shadow with a more robust, multi-layer shadow to ensure readability on light backgrounds on Nebula.
- **Color Fix**: Fixed an issue where selecting "Site Default" font color would incorrectly default to black when opacity was adjusted; it now correctly preserves the platform's native color. Added a warning to the popup when using incompatible settings.
- **Developer Experience**: Added automated CI checks via commit hooks.

## 1.0 - Initial Release

Per-platform settings including font family, size, color, opacity, edge style, and background colors. Features YouTube native integration and dynamic style injection via injected CSS on Nebula.
