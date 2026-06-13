# Changelog

## 1.1.0 - Multi-Platform Expansion

### New Platforms

- **Prime Video**: CSS-only subtitle support for `primevideo.com` + 11 regional Amazon domains (`/gp/video/*` paths).
- **Max (HBO Max)**: CSS-only subtitle support using `CaptionWindow`/`TextCue`/`CueBoxContainer` selectors. Supports `max.com` + legacy `hbomax.com`.
- **Crunchyroll**: CSS-only subtitle support via Bitmovin player (`bmpui-ui-subtitle-label`/`bmpui-ui-subtitle-overlay`) selectors.
- **Disney+**: CSS injection + Shadow DOM support via `disney-web-player` custom element. Dual subtitle renderers (`dss-subtitle-renderer-cue`, `hive-subtitle-renderer-cue`).
- **Netflix**: CSS injection targeting Cadmium player `.player-timedtext` containers and `.player-timedtext-text-container span` for text styling.
- **Vimeo**: CSS injection targeting `.vp-captions` container and inner `<span>` for background. Supports `vimeo.com` and `player.vimeo.com` (embedded player).

### New Features

- **Per-site settings**: Per-setting scope chips — each setting row has a globe/platform toggle to control whether it applies globally or per-site. Per-platform overrides stored in `chrome.storage.sync`.
- **Preset system**: 3 production presets (Do Nothing, High Contrast, Recommended) with auto-detection of active preset. Custom presets — save/delete named presets via 💾 button.
- **Settings import/export**: Clipboard-based copy/paste with minified JSON. Import field with instant validation.
- **Dropout live update**: `broadcastChanges()` + `applyCaptionInlineStyles()` for instant subtitle style updates without page reload. MutationObserver re-applies inline styles when Dropout creates new caption DOM elements.
- **Platform support indicator**: Neutral banner showing detected platform name and icon on supported sites, amber warning on unsupported sites. Technical details panel toggles via ℹ️/✕ button.
- **Per-platform documentation**: In-extension technical details panel for each of the 9 platforms showing approach, supported settings, known limitations. Empty sections auto-hidden.
- **Platform logos**: Inline SVG brand icons (16×16) throughout the popup — site indicators, scope toggles, platform banner.
- **Keyboard navigation**: Arrow keys, Enter/Space, Escape for custom dropdowns. Full ARIA attributes (combobox/listbox/option).

### Bug Fixes

- **Per-site value persistence**: Toggling a setting's scope site→global→site no longer loses the stored per-site value. Override is preserved with `enabled: false` instead of being deleted.
- **Font-opacity warning scoped to affected platforms**: Help icon now only appears on CSS-injection platforms (Nebula, Crunchyroll, Disney+, Max, Netflix, Prime Video, Vimeo) where `color-mix()` requires a custom font color. YouTube and Dropout handle opacity natively — no warning shown.
- **Dropout opacity bug**: Opacity percentages (0–100) now converted to CSS alpha (0–1). Color+opacity always applied together.
- **Dropout inline styles lost on caption change**: MutationObserver on `.vp-captions` detects new caption DOM elements and re-applies styles.
- **Netflix font-size broken**: Replaced `font-size: X%` with `transform: scale(X/100)` — a true visual multiplier. Affects all CSS-only platforms.
- **Yellow dot badge not clearing**: Save now updates local caches before re-running badge/indicator logic.
- **YouTube embed crash on Google Search**: Embedded YouTube previews lack full caption API. Fixed with embedded context detection + per-player try/catch.
- **Backward-compatible import**: v1.0 flat storage dumps are auto-detected and wrapped in v1 schema on import.

### Improvements

- **Nebula extraction**: Platform extracted to its own module with dedicated unit tests.
- **Override badges**: Amber dot badges on dropdown triggers when current site has per-site overrides differing from global. Platform abbreviation badges inside open dropdowns showing other platforms' per-site values.
- **Effective values display**: Form always shows what's actually applied (per-site override if exists, otherwise global).

### Chrome Web Store Prep

- `store/DESCRIPTION.md` — detailed store listing description
- `store/PRIVACY_POLICY.md` — privacy policy (no data collection)
- `store/CHECKLIST.md` — submission checklist
- `store/SCREENSHOTS.md` — screenshot requirements

### CI/CD

- GitHub Actions CI workflow (`.github/workflows/ci.yml`) — format check, lint, typecheck, unit tests, and production build on push/PR.
- **Firefox build pipeline**: `npm run build:firefox` + `npm run release:firefox`. Manifest transformer removes Chrome `key`, adds `browser_specific_settings.gecko`.

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
