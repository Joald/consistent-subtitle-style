# Prime Video Subtitle Support — Research

## Overview

Amazon Prime Video uses a custom web player called **atvwebplayersdk** (Amazon TV Web Player SDK). Unlike YouTube (which has a well-documented player API) or Vimeo (used by Dropout/Nebula with localStorage-based settings), Prime Video uses a proprietary rendering pipeline.

## Subtitle Rendering

### DOM Structure

Prime Video renders subtitles as **regular DOM elements** (not Shadow DOM, not `<track>`/`::cue`). The subtitle overlay sits within the player's overlay container:

```
div.atvwebplayersdk-overlays-container
  └── div.atvwebplayersdk-captions-overlay
        └── div.atvwebplayersdk-captions-region
              └── span.atvwebplayersdk-captions-text
                    └── (text content)
```

**Key selectors:**

- Container: `.atvwebplayersdk-captions-overlay`
- Region/positioning: `.atvwebplayersdk-captions-region`
- Text span: `.atvwebplayersdk-captions-text`
- Background: The region div acts as the background container

### Important notes:

1. **Class names are stable** — they've been consistent across multiple versions and are used by several extensions
2. **No Shadow DOM** — direct CSS injection works, unlike some Netflix regions
3. **Inline styles** — Prime Video applies inline styles for caption rendering, so `!important` is needed to override
4. **TTML-based** — Prime Video uses TTML (Timed Text Markup Language) format internally, but renders to DOM elements (not a canvas)
5. **Dynamic rendering** — subtitle elements are created/destroyed as captions change, requiring a MutationObserver approach

### Subtitle format

- Web player renders TTML/DFXP format internally
- Elements appear and disappear with each subtitle cue
- Each cue creates a fresh set of DOM elements

## How Existing Extensions Work

### Prime Video SubStyler (nefaieamogpbokobidmgceonnjbakgof)

- **Approach:** Content script + MutationObserver
- **Settings:** chrome.storage.sync (same pattern as ours)
- **Styling:** Applies CSS via `!important` overrides on the caption text spans
- **Supports:** Text color, size, font family, text outline, background color/opacity
- **Architecture:** Simple content script → MutationObserver on player container → apply inline styles when new caption elements appear

### Prime Video Dual Subtitles (cabhpipjdhilidbmghclbffddaddicfh)

- **Approach:** Intercepts subtitle track data + renders second subtitle line
- **More complex:** Has to parse TTML data and render additional subtitle elements
- **Uses:** MutationObserver + subtitle track interception

### Shadowing Master

- **Approach:** Dual subtitle display for language learning
- **Intercepts:** Subtitle data stream to extract text for translation
- **Custom rendering:** Creates additional DOM elements alongside native ones

## Integration Plan

### Platform config for Prime Video:

```typescript
// src/platforms/primevideo.ts
import type { PlatformConfig, StorageSettings } from '../types/index.js';

export const primevideo: PlatformConfig = {
  name: 'Prime Video',
  css: {
    subtitleContainerSelector: '.atvwebplayersdk-captions-overlay',
    selectors: {
      subtitle: '.atvwebplayersdk-captions-text',
      background: '.atvwebplayersdk-captions-region',
      window: '.atvwebplayersdk-captions-overlay',
    },
  },
  detectNativeCapabilities(): boolean {
    // Prime Video has built-in caption customization in account settings,
    // but NOT accessible from the web player UI at runtime.
    // Our CSS override approach is the only way to change styles live.
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
```

### Manifest changes needed:

```json
{
  "content_scripts": [
    {
      "matches": [
        // ... existing ...
        "*://*.primevideo.com/*",
        "*://*.amazon.com/gp/video/*",
        "*://*.amazon.co.uk/gp/video/*",
        "*://*.amazon.de/gp/video/*"
        // Note: Prime Video URLs vary by region
      ]
    }
  ],
  "web_accessible_resources": [
    {
      "matches": [
        // ... existing ...
        "*://*.primevideo.com/*",
        "*://*.amazon.com/*",
        "*://*.amazon.co.uk/*",
        "*://*.amazon.de/*"
      ]
    }
  ]
}
```

### Platform detection:

```typescript
// In detectPlatform():
if (
  hostname.includes('primevideo.com') ||
  (hostname.includes('amazon.') && window.location.pathname.startsWith('/gp/video'))
) {
  return 'primevideo';
}
```

## Challenges & Risks

1. **Dynamic elements** — Caption DOM elements are ephemeral. Our existing MutationObserver pattern (used for Nebula) handles this, but may need tuning for Prime Video's specific timing.

2. **Inline styles** — Prime Video sets inline styles on caption elements. CSS `!important` overrides should work (same approach as Nebula/Dropout), but some properties might need extra specificity.

3. **Regional URL patterns** — Prime Video uses country-specific domains (amazon.com, amazon.co.uk, amazon.de, etc.) plus primevideo.com. Need to handle all of them.

4. **Login wall** — Prime Video requires login for any video content, making automated E2E testing harder. Options:
   - Test with a free trial account
   - Test DOM structure separately by injecting mock caption elements
   - Focus unit tests on CSS generation, integration tests on real site

5. **Account-level settings** — Prime Video has subtitle customization in account settings that persists across devices. Our extension overrides would take precedence (CSS `!important`) but the user might be confused if their account settings don't seem to apply.

## Effort Estimate

**Low-medium effort** — Prime Video is structurally similar to Nebula (CSS-only approach, no native API):

- [ ] Create `src/platforms/primevideo.ts` (~50 lines)
- [ ] Update `src/platforms/index.ts` to register
- [ ] Update `manifest.json` with URL patterns
- [ ] Update `detectPlatform()` for Prime Video URLs
- [ ] Add E2E tests (mock approach or real account)
- [ ] Test edge cases: different regions, subtitle languages, player states

**Estimated:** 2-3 hours for basic support, +2 hours for thorough E2E testing.

## References

- [Prime Video SubStyler](https://chromewebstore.google.com/detail/nefaieamogpbokobidmgceonnjbakgof) — Existing extension that styles PV subtitles
- [Amazon Subtitle Settings](https://www.amazon.com/gp/help/customer/display.html?nodeId=G202188370) — Account-level subtitle customization
- [TTML/DFXP Spec](https://www.w3.org/TR/ttml1/) — Format used internally by Prime Video
