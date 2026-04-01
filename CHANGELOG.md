# Changelog

## 1.1.0 - Multi-Platform Expansion (Unreleased)

### New Platforms

- **Prime Video**: CSS-only subtitle support for `primevideo.com` + 11 regional Amazon domains (`/gp/video/*` paths). 16 unit tests.
- **Max (HBO Max)**: CSS-only subtitle support using `CaptionWindow`/`TextCue`/`CueBoxContainer` selectors. Supports `max.com` + legacy `hbomax.com`. 15 unit tests.
- **Crunchyroll**: CSS-only subtitle support via Bitmovin player (`bmpui-ui-subtitle-label`/`bmpui-ui-subtitle-overlay`) selectors. 15 unit tests.
- **Disney+**: CSS injection + Shadow DOM support via `disney-web-player` custom element. Dual subtitle renderers (`dss-subtitle-renderer-cue`, `hive-subtitle-renderer-cue`). 22 unit tests.

### New Features

- **Per-site settings**: Scope toggle UI in popup — apply styles globally ("All Sites") or per-platform. Per-platform overrides stored in `chrome.storage.sync`. 17 unit tests.
- **Preset system**: 3 production presets (Recommended, Classic, Minimal) + 6 dev presets. Popup dropdown for quick selection, auto-detection of active preset. 17 unit tests.
- **Dropout live update**: `broadcastChanges()` + `applyCaptionInlineStyles()` for instant subtitle style updates without page reload.

### Improvements

- **Nebula extraction**: Nebula platform extracted to its own module (`src/platforms/nebula.ts`) with 14 dedicated unit tests.
- **Platform detection tests**: Comprehensive detection tests for all 6 platforms including edge cases (regional domains, legacy domains, subdomain variants). 25 new tests.
- **E2E stability**: Fixed Nebula font-family E2E flake — popup tab was closing before async save completed. Now waits for "Saved!" confirmation.

### Chrome Web Store Prep

- `store/DESCRIPTION.md` — detailed store listing description
- `store/PRIVACY_POLICY.md` — privacy policy (no data collection)
- `store/CHECKLIST.md` — submission checklist
- `store/SCREENSHOTS.md` — screenshot requirements

### CI/CD

- GitHub Actions CI workflow prepared (`store/ci-workflow.yml`) — runs lint, typecheck, unit tests, and production build on push/PR. Pending push (PAT lacks `workflow` scope — Jacek needs to commit from his machine or update PAT).

### Stats

- **254 unit tests** across 16 test files (up from 62 E2E tests at v1.0)
- **7 supported platforms**: YouTube, Nebula, Dropout, Prime Video, Max, Crunchyroll, Disney+
- **Zero network requests** — all processing is local

## 1.0.1 - Style Refinements & Bug Fixes

- **Improved Visibility**: Enhanced drop shadow with a more robust, multi-layer shadow to ensure readability on light backgrounds on Nebula.
- **Color Fix**: Fixed an issue where selecting "Site Default" font color would incorrectly default to black when opacity was adjusted; it now correctly preserves the platform's native color. Added a warning to the popup when using incompatible settings.
- **Developer Experience**: Added automated CI checks via commit hooks.

## 1.0 - Initial Release

Per-platform settings including font family, size, color, opacity, edge style, and background colors. Features YouTube native integration and dynamic style injection via injected CSS on Nebula.
