# Backlog

## High Priority

- [ ] Dropout live update — manual verification needed (waiting for Jacek's test)
- [ ] Merge fix/dropout-live-settings → main (blocked on manual test)

## Medium Priority

- [ ] Nebula font-family E2E flake — timing issue, monitoring
- [x] Preset system — implemented with 3 production presets (Recommended, Classic, Minimal) + 6 dev presets. Popup dropdown, auto-detection, activePreset tracking. 17 unit tests.
- [x] Per-site settings — implemented with scope toggle UI (All Sites / platform), CRUD for per-platform overrides, 17 unit tests, content script integration

## Low Priority

- [x] Add Prime Video subtitle support — CSS-only approach with 11 regional Amazon domains, 16 unit tests
- [ ] Add HBO Max subtitle support
- [x] Update README with Dropout support details
- [ ] Chrome Web Store submission

## Done

- [x] Prime Video subtitle support (CSS-only, atvwebplayersdk selectors, 11 regional domains, 16 unit tests, 159 total tests green)
- [x] Per-site settings (scope toggle UI, per-platform overrides in chrome.storage.sync, 17 unit tests, 143 total tests green)
- [x] Preset system (Recommended, Classic, Minimal + 6 dev presets, popup dropdown, 17 unit tests)
- [x] Font-family snake_case fix (camelCase → snake_case for Vimeo localStorage)
- [x] Dropout live update implementation (broadcastChanges + applyCaptionInlineStyles)
- [x] E2E test suite — 62 tests across 3 platforms
- [x] registerContentScripts regression fix
