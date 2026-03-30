# Backlog

## High Priority

- [ ] Dropout live update — manual verification needed (waiting for Jacek's test)
- [ ] Merge fix/dropout-live-settings → main (blocked on manual test)

## Medium Priority

- [ ] Nebula font-family E2E flake — timing issue, monitoring
- [ ] Preset system — one-click style presets with a recommended default (drop shadow, 0% window/background opacity, rest controlled by site). Dev build should include several test presets for easy manual testing
- [ ] Per-site settings — allow different subtitle styles per platform (e.g. different preset for YouTube vs Dropout)

## Low Priority

- [ ] Add Prime Video subtitle support
- [ ] Add HBO Max subtitle support
- [ ] Update README with Dropout support details
- [ ] Chrome Web Store submission

## Done

- [x] Font-family snake_case fix (camelCase → snake_case for Vimeo localStorage)
- [x] Dropout live update implementation (broadcastChanges + applyCaptionInlineStyles)
- [x] E2E test suite — 62 tests across 3 platforms
- [x] registerContentScripts regression fix
