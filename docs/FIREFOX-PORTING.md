# Firefox Extension Port — Research & Plan

## Summary

Porting to Firefox should be **low effort** — the extension already uses Manifest V3 and standard WebExtension APIs. Firefox supports the `chrome.*` namespace for Chrome compatibility, so no code changes are needed for core functionality.

## Compatibility Audit

### ✅ APIs Used (All Compatible)

| API | Chrome | Firefox | Notes |
|-----|--------|---------|-------|
| `chrome.storage.sync` | ✅ | ✅ | Firefox syncs via Mozilla account |
| `chrome.storage.onChanged` | ✅ | ✅ | |
| `chrome.runtime.onMessage` | ✅ | ✅ | |
| `chrome.runtime.getURL` | ✅ | ✅ | |
| `chrome.runtime.reload` | ✅ | ✅ | |
| Content scripts | ✅ | ✅ | Same manifest format |
| `web_accessible_resources` | ✅ | ✅ | MV3 format with `matches` |
| Service worker background | ✅ | ✅ | Firefox 128+ (2024-07) |

### Files Using `chrome.*`

1. `src/storage.ts` — `chrome.storage.sync.get/set`
2. `src/injection.ts` — `chrome.storage.sync`, `chrome.storage.onChanged`, `chrome.runtime.onMessage`, `chrome.runtime.getURL`
3. `src/bridge.ts` — Mocks `chrome.storage` for page context
4. `src/background.ts` — `chrome.runtime.onMessage`, `chrome.runtime.reload`
5. `src/custom-presets.ts` — `chrome.storage.sync`
6. `src/settings-io.ts` — `chrome.storage.sync`
7. `src/site-settings.ts` — `chrome.storage.sync`
8. `src/ui/popup.ts` — `chrome.storage`, `chrome.tabs`
9. `src/ui/mock-chrome.ts` — Test mocks

**All of these use standard WebExtension APIs that Firefox fully supports via the `chrome.*` compat namespace.**

## Required Changes

### 1. Manifest Differences

**Chrome-specific fields to handle:**
- `key` — Chrome extension key for stable ID. Firefox ignores this. Remove in Firefox manifest.

**Firefox-specific fields to add:**
```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "consistent-subtitle-style@joald",
      "strict_min_version": "128.0"
    }
  }
}
```
- `gecko.id` — Required for AMO submission (use email or `name@author` format)
- `strict_min_version` — 128.0 is minimum for MV3 service worker support

### 2. Build System

Add a build target that generates a Firefox-specific manifest:
- Remove `key` field
- Add `browser_specific_settings.gecko`
- Keep everything else identical

**Option A: Conditional manifest in build script**
```js
// vite.config.ts or build script
const firefoxManifest = {
  ...chromeManifest,
  browser_specific_settings: {
    gecko: { id: "consistent-subtitle-style@joald", strict_min_version: "128.0" }
  }
};
delete firefoxManifest.key;
```

**Option B: Two manifest files** (`manifest.chrome.json`, `manifest.firefox.json`)
- Simpler but more maintenance burden

Recommendation: **Option A** — single source of truth.

### 3. Firefox Add-ons (AMO) Submission

- Submit at https://addons.mozilla.org/developers/
- Needs source code upload (for review of bundled JS)
- Listed as "self-distributed" or "listed on AMO"
- Review typically takes 1-5 business days (longer than CWS)
- AMO requires a privacy policy if extension uses storage (we have one)
- Category: same as CWS — **Accessibility** or **Tab/Search Utilities**

### 4. Testing on Firefox

- Install via `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on"
- Select the `manifest.json` from the built extension directory
- All 9 platforms should work identically (CSS injection + storage are standard)

## Potential Issues

### Low Risk
- **YouTube API access**: The extension uses YouTube's player API (`getSubtitlesUserSettings`, etc.) via page context injection. This should work identically in Firefox since it's DOM/JS manipulation, not a browser API.
- **Shadow DOM (Disney+)**: `attachShadow`/`shadowRoot` access works the same in both browsers.
- **MutationObserver (Dropout)**: Standard DOM API, no browser differences.

### Medium Risk
- **`chrome.storage.sync` quota**: Firefox has slightly different quota limits than Chrome. Chrome: 8,192 bytes/item, 102,400 total. Firefox: similar but verify. Our settings are small, shouldn't be an issue.
- **Content script timing**: `run_at: "document_idle"` may fire at slightly different times. Test on all 9 platforms.

### No Risk
- CSS injection — standard `document.createElement('style')` / `textContent`
- `chrome.runtime.getURL` for web_accessible_resources — works in both

## Effort Estimate

| Task | Effort |
|------|--------|
| Build system changes (conditional manifest) | 1-2 hours |
| Manual testing on all 9 platforms | 2-3 hours |
| AMO submission materials | 30 min (reuse CWS materials) |
| Fix any platform-specific quirks | 0-2 hours |
| **Total** | **~4-8 hours** |

## Recommended Approach

1. Add `npm run build:firefox` script that builds with Firefox manifest
2. Test extension in Firefox via `about:debugging`
3. Verify all 9 platforms work
4. Reuse CWS description and privacy policy for AMO
5. Submit to AMO
6. Add Firefox badge to README alongside Chrome badge

## Build Script Changes

Add to `package.json`:
```json
{
  "scripts": {
    "build:firefox": "vite build && node scripts/firefox-manifest.js",
    "release:firefox": "npm run build:firefox && cd dist && zip -r ../releases/v1.1.0-firefox.zip ."
  }
}
```

Create `scripts/firefox-manifest.js`:
```js
import { readFileSync, writeFileSync } from 'fs';

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
delete manifest.key;
manifest.browser_specific_settings = {
  gecko: {
    id: 'consistent-subtitle-style@joald',
    strict_min_version: '128.0'
  }
};
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Firefox manifest generated');
```

## Edge / Other Chromium Browsers

The Chrome version should work on Edge, Brave, Opera, and other Chromium browsers without changes. Edge Add-ons store is a separate submission but uses the same CWS-format zip.
