# Backlog

## High Priority

- [x] **Dropout opacity bug** — fixed: opacity percentages (0–100) now converted to CSS alpha (0–1). Color+opacity always applied together so changing color preserves opacity. 17 new tests, 626 total. Commit: `6061e01`
- [ ] Dropout live update — manual verification needed (waiting for Jacek's test)
- [ ] Merge fix/dropout-live-settings → main (blocked on manual test)

## Popup UX Improvements (Unblocked — do one per worker run)

- [ ] **Rename presets** — "Minimal" → "Do Nothing", "Classic" → "High Contrast". Update presets.ts, tests, and any references.
- [ ] **Remove Reset button** — redundant with "Do Nothing" preset. Remove from popup.ts and styles.css. Update tests.
- [ ] **Recommended preset: add proportional sans-serif** — set `fontFamily: "proportionalSansSerif"` in Recommended preset settings. Update tests.
- [ ] **Dropdowns show effective per-site values** — Form always shows what's actually applied on current page (per-site override if exists, otherwise global). Scope toggle only changes what happens on save, not displayed values. Load site override on init and populate form with effective settings.
- [ ] **Per-site override badge on dropdown triggers** — When current site has a per-site override that differs from global for a setting, show a small indicator icon/badge on that dropdown's trigger (closed state). Helps user see at a glance which settings are overridden.
- [ ] **Per-site indicator icons inside dropdown options** — When dropdown is open, show small platform icons next to options that have a per-site override DIFFERENT from global. E.g. if global font color is "auto" but YouTube has "red", show YT icon next to "red". Load all site overrides on popup init.
- [ ] **Custom presets** — "Save as Preset" button saves current settings as named custom preset in chrome.storage.sync under `customPresets` key. Custom presets appear in dropdown alongside built-in ones. User can delete custom presets (not built-in). Simple name input dialog.

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
- [x] E2E tests for Prime Video — 20 assertions, DOM-mock with atvwebplayersdk captions structure on amazon.com, CSS-based style testing
- [x] E2E tests for Max/HBO — 17 assertions, mock subtitle injection on hbomax.com free trailers, CSS-based style testing
- [x] E2E tests for Crunchyroll — 19 assertions, DOM-mock with Bitmovin bmpui-ui-subtitle elements on crunchyroll.com, CSS-based style testing
- [x] E2E tests for Disney+ — 24 assertions, DOM-mock with Shadow DOM injection via <disney-web-player> custom element, CSS verified in shadow root
- [x] E2E tests for Netflix — 22 assertions, DOM-mock with injected .player-timedtext structure, CSS-based style testing
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
- [x] E2E test suite — 141 assertions across 7 platforms/features (YouTube 14, Dropout 22, Nebula 25, Vimeo 22, Max 17, Presets 24, Per-Site 17)
- [x] registerContentScripts regression fix

## E2E Coverage Gaps (Unblocked)

- [x] E2E tests for preset system — 24 assertions on Vimeo: dropdown UI, Classic/Recommended/Minimal presets, CSS verification, manual-change-to-Custom detection, reset.
- [x] E2E tests for per-site settings — 17 assertions on Vimeo: per-site override priority over global, fallback after clearing, multi-platform isolation, CSS verification.
- [x] E2E tests for Max/HBO — free trailers at hbomax.com/collections/watch-free, no login required. 17 assertions, mock subtitle injection.

## Coverage Metrics (Unblocked)

- [x] Deterministic line coverage counter — Istanbul provider via vitest --coverage. 85% lines, 83% stmts, 69% branches, 91% funcs. 14/21 files at 100%. JSON report at coverage/coverage-summary.json. Commits: a15dbd9, 9b3866a
- [x] LLM-powered logical feature coverage — docs/FEATURE-COVERAGE.md: 297 features across 9 platforms, 236 tested, 36 blocked, 91% coverage of feasible features. Includes quick-win recommendations. Commit: b955ed0

## Documentation (Unblocked)

- [x] Implementation strategy matrix — docs/IMPLEMENTATION-MATRIX.md documenting per-site per-feature implementation strategies for all 9 platforms. Includes CSS selectors, architecture notes, coverage summary, and complexity ranking. Commit: 89e7195
