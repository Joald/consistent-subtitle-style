# Chrome Web Store Submission Checklist

## Pre-Submission

- [ ] Merge `fix/dropout-live-settings` → `main`
- [ ] Verify all 898 unit tests pass on `main`
- [ ] Verify E2E tests pass on `main`
- [ ] Run `npm run release` to generate production zip
- [ ] Test the release zip via "Load unpacked" on a fresh Chrome profile

## Store Listing

- [ ] Upload extension zip (`releases/v1.1.0.zip`)
- [ ] Set store listing language: English
- [ ] Set category: **Accessibility**
- [ ] Copy detailed description from `store/DESCRIPTION.md`
- [ ] Upload screenshots (see `store/SCREENSHOTS.md` for list)
- [ ] Upload promo tile (440×280 — optional but recommended)
- [ ] Set privacy policy URL (host `store/PRIVACY_POLICY.md` as a GitHub Pages or raw gist)

## Privacy & Permissions Justification

The extension requests these permissions:

- **storage**: Required to persist subtitle style settings across sessions via `chrome.storage.sync`. Also used for custom presets, per-site overrides, and import/export data.
- **activeTab**: Required to detect which streaming platform is active for per-site settings and platform detection banner.

No remote code execution. No data collection. No analytics. No network requests.

## Features Included in v1.1.0

- 9 streaming platforms (YouTube, Netflix, Disney+, Prime Video, Max, Crunchyroll, Vimeo, Nebula, Dropout)
- 9 customizable subtitle properties
- 3 built-in presets + custom preset system
- Per-site settings with per-setting scope control
- Import/Export settings (JSON backup/restore with schema versioning)
- SVG platform logos and visual indicators
- In-extension per-platform documentation
- Keyboard navigation with ARIA accessibility
- Platform support detection banner
- Live preview and instant updates
- MutationObserver for Dropout caption re-application
- YouTube embedded player crash protection
- 898 automated tests (24 test files)

## Post-Submission

- [ ] Monitor review status (typically 1-3 business days)
- [ ] Update README with Chrome Web Store badge/link once published
- [ ] Add CWS link to GitHub repo description
- [ ] Set up GitHub Actions CI (file ready at `store/ci-workflow.yml`)
