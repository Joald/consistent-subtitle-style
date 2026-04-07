# Chrome Web Store Submission Checklist

## Pre-Submission

- [ ] Merge `fix/dropout-live-settings` → `main`
- [ ] Verify all 851 unit tests pass on `main`
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

- **storage**: Required to persist subtitle style settings across sessions via `chrome.storage.sync`
- **activeTab**: Required to detect which streaming platform is active for per-site settings

No remote code execution. No data collection. No analytics. No network requests.

## Post-Submission

- [ ] Monitor review status (typically 1-3 business days)
- [ ] Update README with Chrome Web Store badge/link once published
- [ ] Add CWS link to GitHub repo description
