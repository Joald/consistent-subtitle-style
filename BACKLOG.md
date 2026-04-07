# Backlog

## High Priority

- [x] **Dropout opacity bug** — fixed: opacity percentages (0–100) now converted to CSS alpha (0–1). Color+opacity always applied together so changing color preserves opacity. 17 new tests, 626 total. Commit: `6061e01`
- [x] **Dropout: inline styles lost on new caption lines** — Fixed: MutationObserver on `.vp-captions` detects new `captionsLine`/`captionsWindow` DOM elements (created on subtitle cue change) and re-applies inline styles from `currentValues`. Tracks observed container; reconnects if container changes (player re-render). Debounced (50ms). 7 new tests, 762 total. Commit: `98785b1`
- [x] **Yellow dot badge not clearing without popup re-open** — Fixed: `handleSave()` (and `handlePresetChange()`, `handleSaveAsPreset()`) now updates local `globalSettings`/`allSiteOverrides` caches after save, then re-runs `updateOverrideBadges()` + `updateSiteIndicators()`. Regression test added. 708 tests green. Commit: `973d6cd`
- [x] **Netflix font-size broken** — Fixed: CSS `font-size: X%` replaced with `transform: scale(X/100)` on subtitleContainerSelector. This acts as a true visual multiplier regardless of the platform's original font-size. Affects all CSS-only platforms (Netflix, Vimeo, Prime Video, Max, Crunchyroll, Disney+, Nebula). 14 new unit tests, 5 E2E tests updated. 755 total tests. Commit: `f0937df`
- [ ] Dropout live update — manual verification needed (waiting for Jacek's test)
- [ ] Merge fix/dropout-live-settings → main (blocked on manual test)

## Popup UX Improvements (Unblocked — do one per worker run)

- [x] **Rename presets** — "Minimal" → "Do Nothing", "Classic" → "High Contrast". Updated presets.ts, popup test, E2E presets test, docs. Commit: `609e553`
- [x] **Remove Reset button** — removed Reset button, handleReset() function, CSS styles, and 2 related tests. "Do Nothing" preset serves as reset. Commit: `92f5fcf`
- [x] **Recommended preset: add proportional sans-serif** — set `fontFamily: "proportional-sans-serif"` in Recommended preset settings. Updated description, 4 tests. Commit: `1b655ff`
- [x] **Dropdowns show effective per-site values** — Form always shows what's actually applied on current page (per-site override if exists, otherwise global). Scope toggle only changes what happens on save, not displayed values. Load site override on init and populate form with effective settings. Commit: `53b4937`
- [x] **Per-site override badge on dropdown triggers** — When current site has a per-site override that differs from global for a setting, shows a small amber dot badge on that dropdown's trigger (closed state). Badges update dynamically as settings change. Tooltip shows global value. 7 new tests.
- [x] **Per-site indicator icons inside dropdown options** — When dropdown is open, shows small platform abbreviation badges (YT, NF, D+, etc.) next to options that other platforms use as per-site overrides. Excludes current platform. 8 new tests. Commit: `cd776a5`
- [x] **Custom presets** — "Save as Preset" 💾 button saves current settings as named custom preset in chrome.storage.sync under `customPresets` key. Custom presets appear in dropdown under "── My Presets ──" separator alongside built-in ones. Selecting a custom preset applies it. 🗑️ delete button appears when custom preset is active (confirm dialog). 10 unit tests for CRUD, 84 popup tests (including delete button visibility, save/cancel flows). 682 total tests.
- [x] **Per-setting site toggle (scope chips)** — Replaced the single global "Apply to" toggle with per-setting scope chips. Each setting row has a 28×28 button showing globe (global) or platform icon (per-site). Click to toggle scope per-setting. Save splits: global-scoped settings → chrome.storage.sync, site-scoped → per-site override. Auto-clears per-site override when all chips return to global. 7 new tests, 853 total tests. Commit: `52d3384`
- [x] **Use actual platform logos** — Replaced text abbreviation badges with inline SVG platform icons (16×16, brand colours) throughout popup: site indicators (12px), scope toggle (14px + name), platform indicator banner (18px). `src/platform-icons.ts` module with `platformIconHtml()` helper. 33 new tests. 846 total tests. Commit: `12ce286`
- [x] **Keyboard navigation for dropdowns** — Arrow Up/Down to navigate options, Enter/Space to select, Escape to close. ARIA attributes (combobox/listbox/option), focus ring, highlight tracking. 21 new tests. Commit: `c2a0335`
- [x] **Platform support indicator in popup** — Shows "✅ <Platform> — supported" green banner on supported sites, "⚠️ This site is not supported" amber banner on unsupported. 13 new tests. 741 total tests. Commit: `ee6daaa`
- [x] **Per-platform documentation pages** — In-extension docs system accessible via ℹ️ info button on platform indicator banner. For each of 9 platforms: approach (CSS injection, native API, Shadow DOM, etc.), supported settings as badge chips, known limitations, and notes. `platformDocs.ts` with structured data, popup panel with toggle/close, animated CSS. 39 unit tests + 12 popup integration tests. 813 total tests. Commit: `cb05d50`

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

## Coverage Gap Items (Unblocked)

### textOpacity tests

- [x] Test: Nebula textOpacity — E2E fontOpacity test added to nebula.e2e.js (color-mix verification)
- [x] Test: Dropout textOpacity — E2E fontOpacity test added to dropout.e2e.js (color-mix verification)
- [x] Test: Prime Video textOpacity — E2E fontOpacity test already in primevideo.e2e.js
- [x] Test: Max/HBO textOpacity — E2E fontOpacity test added to max.e2e.js (color-mix verification)
- [x] Test: Crunchyroll textOpacity — E2E fontOpacity test already in crunchyroll.e2e.js
- [x] Test: Disney+ textOpacity — E2E fontOpacity test already in disneyplus.e2e.js
- [x] Test: Netflix textOpacity — E2E fontOpacity test already in netflix.e2e.js
- [x] Test: Vimeo textOpacity — E2E fontOpacity test already in vimeo.e2e.js

### liveUpdate tests

- [x] Test: Prime Video liveUpdate — unit tests for live settings update (subtitleStylerChanged → CSS with platform selectors)
- [x] Test: Max/HBO liveUpdate — unit tests for live settings update (subtitleStylerChanged → CSS with platform selectors)
- [x] Test: Crunchyroll liveUpdate — unit tests for live settings update (subtitleStylerChanged → CSS with platform selectors)
- [x] Test: Disney+ liveUpdate — unit tests for live settings update (subtitleStylerChanged → CSS with platform selectors)
- [x] Test: Netflix liveUpdate — unit tests for live settings update (subtitleStylerChanged → CSS with platform selectors)

### E2E upgrades (unit-only → E2E)

#### bgOpacity E2E

- [x] E2E: Nebula bgOpacity — added to nebula.e2e.js (blue bg + 75% opacity verification)
- [x] E2E: Dropout bgOpacity — added to dropout.e2e.js (blue bg + 75% opacity verification)
- [x] E2E: Max/HBO bgOpacity — added to max.e2e.js (blue bg + 75% opacity verification)
- [x] E2E: Crunchyroll bgOpacity — added to crunchyroll.e2e.js (blue bg + 75% opacity verification)
- [x] E2E: Disney+ bgOpacity — added to disneyplus.e2e.js (blue bg + 75% opacity in shadow DOM)

#### windowColor E2E

- [x] E2E: Nebula windowColor — added as part of windowOpacity test (green window color + opacity)
- [x] E2E: Dropout windowColor — added to dropout.e2e.js (green window color)
- [x] E2E: Max/HBO windowColor — added as part of windowOpacity test (green window color + opacity)

#### windowOpacity E2E

- [x] E2E: Nebula windowOpacity — added to nebula.e2e.js (green window + 50% opacity verification)
- [x] E2E: Dropout windowOpacity — added to dropout.e2e.js (green window + 50% opacity verification)
- [x] E2E: Prime Video windowOpacity — added to primevideo.e2e.js (green window + 50% opacity verification)
- [x] E2E: Max/HBO windowOpacity — added to max.e2e.js (green window + 50% opacity verification)
- [x] E2E: Crunchyroll windowOpacity — added to crunchyroll.e2e.js (green window + 50% opacity verification)
- [x] E2E: Disney+ windowOpacity — added to disneyplus.e2e.js (green window + 50% opacity in shadow DOM)
- [x] E2E: Netflix windowOpacity — added to netflix.e2e.js (green window + 50% opacity verification)

#### textOpacity E2E

- [x] E2E: YouTube textOpacity — added to youtube.e2e.js (applyStyles re-fires verification)

#### preset E2E (per-platform)

- [x] E2E: Nebula preset apply
- [x] E2E: Dropout preset apply
- [x] E2E: Prime Video preset apply
- [x] E2E: Max/HBO preset apply
- [x] E2E: Crunchyroll preset apply
- [x] E2E: Disney+ preset apply
- [x] E2E: Netflix preset apply

#### perSite E2E (per-platform)

- [x] E2E: Nebula per-site override
- [x] E2E: Dropout per-site override
- [x] E2E: Prime Video per-site override
- [x] E2E: Max/HBO per-site override
- [x] E2E: Crunchyroll per-site override
- [x] E2E: Disney+ per-site override
- [x] E2E: Netflix per-site override

#### YouTube E2E gaps (unit-only → E2E)

- [ ] E2E: YouTube windowColor — verify window color change via native API
- [ ] E2E: YouTube windowOpacity — verify window opacity change via native API
- [ ] E2E: YouTube textOpacity — verify text opacity change via native API (currently only applyStyles re-fire test)
