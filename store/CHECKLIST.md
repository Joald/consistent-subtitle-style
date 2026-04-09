# Store Submission Checklist

## Chrome Web Store (CWS)

### Pre-Submission

- [ ] Merge `fix/dropout-live-settings` → `main`
- [ ] Verify all 913 unit tests pass on `main` (25 test files)
- [ ] Verify E2E tests pass on `main`
- [ ] Run `npm run release` to generate production zip
- [ ] Test the release zip via "Load unpacked" on a fresh Chrome profile
  - Test on YouTube, Netflix, and at least one other platform
  - Verify popup opens, settings save, presets work
  - Check per-site settings toggle

### Store Listing

- [ ] Upload extension zip (`releases/v1.1.0.zip`, ~198K)
- [ ] Set store listing language: English
- [ ] Set category: **Accessibility**
- [ ] Copy detailed description from `store/DESCRIPTION.md`
- [ ] Upload screenshots (see `store/SCREENSHOTS.md` for list)
- [ ] Upload promo tile (440×280 — optional but recommended)
- [ ] Set privacy policy URL (host `store/PRIVACY_POLICY.md` as a GitHub Pages or raw gist)

### Privacy & Permissions Justification

The extension requests these permissions:

- **storage**: Required to persist subtitle style settings across sessions via `chrome.storage.sync`. Also used for custom presets, per-site overrides, and import/export data.
- **activeTab**: Required to detect which streaming platform is active for per-site settings and platform detection banner.

No remote code execution. No data collection. No analytics. No network requests.

### Post-Submission

- [ ] Monitor review status (typically 1-3 business days)
- [ ] Update README with Chrome Web Store badge/link once published
- [ ] Add CWS link to GitHub repo description
- [ ] Set up GitHub Actions CI (file ready at `store/ci-workflow.yml`)

---

## Firefox Add-ons (AMO)

### Pre-Submission

- [ ] Chrome version must be live on CWS first
- [ ] Run `npm run release:firefox` to generate Firefox zip
- [ ] Firefox zip is at `releases/v1.1.0-firefox.zip` (~202K)
- [ ] Test in Firefox 128+ via `about:debugging` → "Load Temporary Add-on"
  - Pick any file inside the unzipped dist/ (after `npm run build:firefox`)
  - Test on YouTube, Netflix, and at least one other platform
  - Verify popup, settings persistence, presets, per-site settings

### Store Listing (addons.mozilla.org)

- [ ] Create developer account at https://addons.mozilla.org/developers/
- [ ] Submit new add-on → upload `releases/v1.1.0-firefox.zip`
- [ ] AMO asks: "Is the source code publicly available?" → Yes, link to GitHub repo
- [ ] Upload source code zip (required if minified) — run `git archive -o /tmp/source.zip HEAD` from repo root
- [ ] Set listing category: **Accessibility** (under "Other")
- [ ] Copy description from `store/DESCRIPTION.md` (AMO supports markdown in some fields)
- [ ] Upload screenshots (same as CWS, Firefox-specific if possible)
- [ ] Set homepage URL to GitHub repo
- [ ] Set support email or support URL
- [ ] Link privacy policy (same as CWS)

### AMO-Specific Notes

- **Review process**: AMO has both auto-review and manual review. First submission usually gets manual review (can take 1-7 days).
- **Source code**: Since we use esbuild bundling, AMO requires source code upload with build instructions. The README has build steps.
- **gecko.id**: Set to `consistent-subtitle-style@joald` in the manifest.
- **Minimum Firefox**: 128.0 (MV3 service_worker support stable since Firefox 121).
- **All chrome.* APIs**: Fully Firefox-compatible (storage, activeTab, scripting, runtime.onMessage).
- **No polyfills needed**: Firefox 128+ supports everything we use natively.

### Post-Submission

- [ ] Monitor review status at https://addons.mozilla.org/developers/addons
- [ ] Update README with AMO badge/link once published
- [ ] Add AMO link to GitHub repo

---

## Microsoft Edge Add-ons

### Pre-Submission

- [ ] Chrome version must be live on CWS first
- [ ] The Chrome zip (`releases/v1.1.0.zip`) works as-is on Edge — no separate build needed
- [ ] Test in Edge via `edge://extensions` → "Load unpacked"

### Store Listing (partner.microsoft.com)

- [ ] Create developer account at https://partner.microsoft.com/dashboard/microsoftedge/
  - Microsoft account required, one-time $19 registration fee
- [ ] Submit new extension → upload `releases/v1.1.0.zip` (same Chrome zip)
- [ ] Set category: **Accessibility**
- [ ] Copy description from `store/DESCRIPTION.md`
- [ ] Upload screenshots
- [ ] Link privacy policy
- [ ] Set homepage URL to GitHub repo

### Edge-Specific Notes

- **Review process**: Typically 1-7 business days.
- **No manifest changes needed**: Edge supports Chrome MV3 manifest directly.
- **chrome.* namespace**: Works as-is in Edge (no browser.* polyfill needed).

### Post-Submission

- [ ] Monitor review at partner.microsoft.com dashboard
- [ ] Update README with Edge Add-ons badge/link once published

---

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
- Firefox build pipeline (`npm run build:firefox`, `npm run release:firefox`)
- 913 automated tests (25 test files)
