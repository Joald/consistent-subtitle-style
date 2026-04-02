# Backlog

## High Priority

- [ ] Dropout live update — manual verification needed (waiting for Jacek's test)
- [ ] Merge fix/dropout-live-settings → main (blocked on manual test)

## Medium Priority

- [x] Nebula font-family E2E flake — fixed: popup tab was closing before async save completed
- [x] Preset system — implemented with 3 production presets (Recommended, Classic, Minimal) + 6 dev presets. Popup dropdown, auto-detection, activePreset tracking. 17 unit tests.
- [x] Per-site settings — implemented with scope toggle UI (All Sites / platform), CRUD for per-platform overrides, 17 unit tests, content script integration

## Pending (Blocked on PAT Scope)

- [ ] GitHub Actions CI workflow — file ready at `store/ci-workflow.yml`, needs PAT with `workflow` scope or manual push from Jacek. Copy to `.github/workflows/ci.yml`.

## Low Priority

- [x] Add Prime Video subtitle support — CSS-only approach with 11 regional Amazon domains, 16 unit tests
- [x] Add HBO Max subtitle support — CSS-only approach with CaptionWindow/TextCue/CueBoxContainer selectors, max.com + hbomax.com domains, 15 unit tests
- [x] Add Crunchyroll subtitle support — CSS-only approach with Bitmovin player selectors, 15 unit tests
- [x] Add Disney+ subtitle support — CSS injection + Shadow DOM via disney-web-player custom element, dual renderers, 22 unit tests
- [x] Add Netflix subtitle support — CSS injection targeting Cadmium player-timedtext containers, 18 unit tests
- [x] Add Vimeo subtitle support — CSS injection targeting vp-captions container, vimeo.com + player.vimeo.com, 20 unit tests
- [x] Add comprehensive YouTube unit tests (71 tests: detection, config, applySetting, native settings, getCurrentValue)
- [x] Update README with all platform support
- [x] Nebula unit tests + extract to own module (14 tests, consistent with other platforms)
- [ ] Chrome Web Store submission

## Done

- [x] Crunchyroll subtitle support (CSS-only, Bitmovin player bmpui-ui-subtitle-label/overlay selectors, 15 unit tests, 203 total tests green)
- [x] Disney+ subtitle support (CSS injection + Shadow DOM, disney-web-player custom element, dss-subtitle-renderer-cue + hive-subtitle-renderer-cue, 22 unit tests, 254 total tests green)
- [x] Netflix subtitle support (CSS injection, Cadmium player-timedtext-text-container + player-timedtext selectors, 18 unit tests, 274 total tests green)
- [x] Max (HBO Max) subtitle support (CSS-only, CaptionWindow/TextCue/CueBoxContainer selectors, max.com + hbomax.com, 15 unit tests, 174 total tests green)
- [x] Prime Video subtitle support (CSS-only, atvwebplayersdk selectors, 11 regional domains, 16 unit tests, 159 total tests green)
- [x] Per-site settings (scope toggle UI, per-platform overrides in chrome.storage.sync, 17 unit tests, 143 total tests green)
- [x] Preset system (Recommended, Classic, Minimal + 6 dev presets, popup dropdown, 17 unit tests)
- [x] Font-family snake_case fix (camelCase → snake_case for Vimeo localStorage)
- [x] Dropout live update implementation (broadcastChanges + applyCaptionInlineStyles)
- [x] E2E test suite — 62 tests across 3 platforms
- [x] registerContentScripts regression fix
