# Changelog

## 1.1.0 - Multi-Platform Expansion (Unreleased)

### New Platforms

- **Prime Video**: CSS-only subtitle support for `primevideo.com` + 11 regional Amazon domains (`/gp/video/*` paths). 16 unit tests.
- **Max (HBO Max)**: CSS-only subtitle support using `CaptionWindow`/`TextCue`/`CueBoxContainer` selectors. Supports `max.com` + legacy `hbomax.com`. 15 unit tests.
- **Crunchyroll**: CSS-only subtitle support via Bitmovin player (`bmpui-ui-subtitle-label`/`bmpui-ui-subtitle-overlay`) selectors. 15 unit tests.
- **Disney+**: CSS injection + Shadow DOM support via `disney-web-player` custom element. Dual subtitle renderers (`dss-subtitle-renderer-cue`, `hive-subtitle-renderer-cue`). 22 unit tests.
- **Netflix**: CSS injection targeting Cadmium player `.player-timedtext` containers and `.player-timedtext-text-container span` for text styling. 18 unit tests.
- **Vimeo**: CSS injection targeting `.vp-captions` container and inner `<span>` for background. Supports `vimeo.com` and `player.vimeo.com` (embedded player). 20 unit tests.

### New Features

- **Per-site settings**: Per-setting scope chips — each setting row has a globe/platform toggle to control whether it applies globally or per-site. Per-platform overrides stored in `chrome.storage.sync`.
- **Preset system**: 3 production presets (Do Nothing, High Contrast, Recommended) with auto-detection of active preset. Custom presets — save/delete named presets via 💾 button.
- **Settings import/export**: JSON backup/restore with schema versioning (v1). Export/Import toolbar buttons, file picker, confirmation dialog, automatic UI refresh after import.
- **Dropout live update**: `broadcastChanges()` + `applyCaptionInlineStyles()` for instant subtitle style updates without page reload. MutationObserver re-applies inline styles when Dropout creates new caption DOM elements.
- **Platform support indicator**: Green "✅ Supported" banner on supported sites, amber "⚠️ Not supported" on others.
- **Per-platform documentation**: In-extension ℹ️ info pages for each of the 9 platforms showing approach, supported settings, known limitations.
- **Platform logos**: Inline SVG brand icons (16×16) throughout the popup — site indicators, scope toggles, platform banner.
- **Keyboard navigation**: Arrow keys, Enter/Space, Escape for custom dropdowns. Full ARIA attributes (combobox/listbox/option).

### Bug Fixes

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
- **Deterministic line coverage**: Istanbul provider via vitest — 85% lines, 83% stmts, 69% branches, 91% funcs.
- **Feature coverage analysis**: `docs/FEATURE-COVERAGE.md` — 297 features, 236 tested, 91% coverage of feasible features.
- **Implementation matrix**: `docs/IMPLEMENTATION-MATRIX.md` — per-site per-feature strategy documentation.

### E2E Test Coverage

Comprehensive E2E tests for all 9 platforms covering: style application, presets, per-site overrides, bgOpacity, windowColor, windowOpacity, textOpacity, and live update. 318+ E2E assertions.

### Chrome Web Store Prep

- `store/DESCRIPTION.md` — detailed store listing description
- `store/PRIVACY_POLICY.md` — privacy policy (no data collection)
- `store/CHECKLIST.md` — submission checklist
- `store/SCREENSHOTS.md` — screenshot requirements
- Release zip: `releases/v1.1.0.zip` (269K, 26 files)

### CI/CD

- GitHub Actions CI workflow prepared (`.github/workflows/ci.yml`) — runs format check, lint, typecheck, unit tests, and production build on push/PR. Node.js 18 on ubuntu-latest.
- **Firefox build pipeline**: `npm run build:firefox` (prod build + manifest transform), `npm run release:firefox` (end-to-end Firefox release zip for AMO). Manifest transformer removes Chrome `key`, adds `browser_specific_settings.gecko` with strict_min_version 128.0. 15 unit tests.

### Stats

- **913 tests** across 25 test files (up from 62 at v1.0)
- **9 supported platforms**: YouTube, Nebula, Dropout, Prime Video, Max, Crunchyroll, Disney+, Netflix, Vimeo
- **Zero network requests** — all processing is local

## 1.0.1 - Style Refinements & Bug Fixes

- **Improved Visibility**: Enhanced drop shadow with a more robust, multi-layer shadow to ensure readability on light backgrounds on Nebula.
- **Color Fix**: Fixed an issue where selecting "Site Default" font color would incorrectly default to black when opacity was adjusted; it now correctly preserves the platform's native color. Added a warning to the popup when using incompatible settings.
- **Developer Experience**: Added automated CI checks via commit hooks.

## 1.0 - Initial Release

Per-platform settings including font family, size, color, opacity, edge style, and background colors. Features YouTube native integration and dynamic style injection via injected CSS on Nebula.
