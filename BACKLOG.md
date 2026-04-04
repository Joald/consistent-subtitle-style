# Backlog

## High Priority

- [x] **Dropout opacity bug** — fixed: opacity percentages (0–100) now converted to CSS alpha (0–1). Color+opacity always applied together so changing color preserves opacity. 17 new tests, 626 total. Commit: `6061e01`
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
- [ ] E2E tests for Prime Video (currently unit tests only — requires login)
- [x] E2E tests for Max/HBO — 17 assertions, mock subtitle injection on hbomax.com free trailers, CSS-based style testing
- [ ] E2E tests for Crunchyroll (currently unit tests only — may work with free episodes)
- [ ] E2E tests for Disney+ (currently unit tests only — requires login)
- [ ] E2E tests for Netflix (currently unit tests only — requires login)
- [x] E2E tests for Vimeo — 22 assertions, player.vimeo.com embed with free public video, CSS-based style testing
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
- [x] E2E test suite — 125 tests across 6 platforms/features (YouTube 14, Dropout 22, Nebula 25, Vimeo 22, Max 17, Presets 24)
- [x] registerContentScripts regression fix

## E2E Coverage Gaps (Unblocked)

- [x] E2E tests for preset system — 24 assertions on Vimeo: dropdown UI, Classic/Recommended/Minimal presets, CSS verification, manual-change-to-Custom detection, reset.
- [ ] E2E tests for per-site settings — set YouTube-specific styles, verify YouTube uses per-site, verify other platform uses global. No subscription needed.
- [x] E2E tests for Max/HBO — free trailers at hbomax.com/collections/watch-free, no login required. 17 assertions, mock subtitle injection.

## Coverage Metrics (Unblocked)

- [ ] Deterministic line coverage counter — integrate vitest coverage (istanbul/v8) to track actual % of lines/branches/functions covered per file. Display in Space dashboard.
- [ ] LLM-powered logical feature coverage — enumerate logical features per platform (e.g. "font color change", "opacity slider", "live update", "preset apply", "per-site override") and map each to test assertions. Show which features have tests vs which are untested. Update Space dashboard with feature coverage matrix.

## Documentation (Unblocked)

- [ ] Implementation strategy matrix — document per-site per-feature how each style property is implemented. E.g. YouTube uses native player API for font color, Dropout uses inline styles on .vp-captions, Netflix uses CSS injection, Disney+ uses Shadow DOM piercing. Columns: platform. Rows: feature (font size, font color, font family, background color, background opacity, window color, window opacity, text opacity, live update). Cells: strategy (native API, CSS injection, inline styles, localStorage, Shadow DOM, N/A). Display in Space dashboard.
