# E2E Tests

End-to-end tests for Consistent Subtitle Style. These tests load the
**real extension** into a **real Chrome browser**, navigate to **real
websites**, and verify that subtitle styles are applied and updated
correctly.

## Quick Start

```bash
# Full suite (all platforms)
bun run test:e2e

# Individual platform
DISPLAY=:99 bun run e2e/dropout.e2e.js
DISPLAY=:99 bun run e2e/nebula.e2e.js
DISPLAY=:99 bun run e2e/youtube.e2e.js
```

The runner script (`e2e/run.sh`) handles Xvfb startup, extension builds,
and sequential execution automatically.

## Architecture — Real vs Mocked

### What is real

| Component     | Details                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser**   | Actual Chromium, launched by Puppeteer with `--load-extension`                                                                                                                                                                        |
| **Extension** | Built from `dist/` — full production build, all content scripts, popup, service worker                                                                                                                                                |
| **Websites**  | Live pages: `embed.vhx.tv` (Dropout), `nebula.tv`, `youtube.com`                                                                                                                                                                      |
| **Settings**  | Changed via the popup page (`chrome-extension://{id}/index.html`) — clicks the real custom-select dropdowns, which triggers `handleSave()` → `chrome.storage.sync.set()` → `chrome.tabs.sendMessage()`, exactly as a human user would |
| **Subtitles** | Real captions rendered by each platform's native player                                                                                                                                                                               |

### What is simulated

| Component            | Details                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display**          | Xvfb (X Virtual Framebuffer) — a headless X11 server. Chrome renders in a real window, but there is no physical monitor. Screenshots can be captured for debugging. |
| **User interaction** | Puppeteer drives clicks and navigation. No actual mouse/keyboard.                                                                                                   |

### Nothing is mocked

There are no mock objects, fake DOMs, or stubbed APIs. The extension runs
in the same environment as a user's browser. If a test passes, the
feature works on that platform.

## How Settings Are Changed

MV3 service workers go to sleep after ~30 seconds. Directly evaluating
`chrome.storage.sync.set()` in the SW context is unreliable in automated
tests.

Instead, the tests open the extension's **popup page** in a new tab:

```
chrome-extension://{extensionId}/index.html
```

Then they click the appropriate `[data-value]` option inside each
`.custom-select[data-id]` dropdown. This triggers the popup's
`handleSave()` function, which:

1. Saves to `chrome.storage.sync`
2. Sends `chrome.tabs.sendMessage()` to all content scripts

This approach is immune to SW sleep issues and exactly mirrors user
behaviour.

## Extension ID Discovery

Finding the extension ID is non-trivial in Puppeteer. The helper
`getExtensionId()` uses three strategies in order:

1. **Service worker target** — scan `browser.targets()` for targets of
   type `service_worker` with a `chrome-extension://` URL
2. **Extension page target** — scan for any `chrome-extension://` URL,
   validate the ID matches the 32-char lowercase hex pattern (avoids
   picking up unrelated service workers, e.g. YouTube's own SW)
3. **`chrome://extensions` scrape** — navigate to the extensions page and
   read the extension ID from the shadow DOM of
   `extensions-manager > extensions-item-list > extensions-item`

## Per-Platform Details

### Dropout (`dropout.e2e.js`)

- **URL:** Direct `embed.vhx.tv` embed — no login required
- **What it tests:**
  - Extension init (bridge, platform detection, `applyStyles()`)
  - Live inline style changes on `.vp-captions` (color, font family,
    font size, edge style)
  - Background colour persisted to Vimeo localStorage
  - Combined settings and reset
  - Popup UI (dropdowns, reset button, preview)
- **Style mechanism:** `applyCaptionInlineStyles()` sets styles directly
  on the `.vp-captions` container, same as Vimeo's built-in Customize UI

### Nebula (`nebula.e2e.js`)

- **URL:** Free "first one is on us" video (no account needed)
- **What it tests:**
  - Extension init and Nebula platform detection
  - Clicking "Play this video" to start the free preview
  - Subtitle visibility and baseline styles
  - Live CSS-based style changes (color, font family, font size,
    background, edge style)
  - Combined settings and reset
  - Popup UI
- **Style mechanism:** CSS rules injected via a `<style>` element
  targeting `[data-subtitles-container]`

### YouTube (`youtube.e2e.js`)

- **URL:** Rick Astley — `dQw4w9WgXcQ` embed (reliably loads without
  CAPTCHA)
- **What it tests:**
  - Extension init and YouTube platform detection
  - Player element, video element, CC button
  - `applyStyles()` re-fires on each storage change (color, font, size,
    edge, combined, reset)
- **Limitations:** YouTube's bot detection means visual subtitle style
  verification is unreliable. Tests verify that `applyStyles()` fires
  (via console log assertions) rather than checking computed CSS values.
  If bot detection triggers, the entire YouTube suite is gracefully
  skipped.

## Style Assertion Strategy

Visual style checks use `waitForStyle()` — a polling helper that
repeatedly reads `getComputedStyle()` until a predicate passes or a
timeout (10 s) expires. This avoids flakiness from timing differences
between platforms and sequential test runs.

```js
const color = await waitForStyle(
  page,
  '#subtitle-selector',
  'color',
  (v) => v === 'rgb(255, 255, 0)', // predicate
);
assert(color === 'rgb(255, 255, 0)', 'Font color is yellow');
```

## File Structure

```
e2e/
├── README.md           ← this file
├── helpers.js          ← browser launch, extension ID discovery,
│                         popup-based storage manipulation, waitForStyle,
│                         test runner utilities
├── dropout.e2e.js      ← Dropout/VHX embed tests (22 assertions)
├── nebula.e2e.js       ← Nebula free-video tests (25 assertions)
├── youtube.e2e.js      ← YouTube embed tests (14 assertions)
└── run.sh              ← Xvfb + build + sequential runner
```

## Known Limitations

- **YouTube bot detection** — Google may serve a "confirm you're not a
  bot" page instead of the video. When detected, all YouTube tests are
  skipped (exit 0). This is expected in some CI/headless environments.
- **Nebula free video availability** — relies on Nebula's "first one is
  on us" feature. If Nebula changes its free-access policy or the
  specific video is removed, tests will need a new URL.
- **No login-gated tests** — Dropout (beyond embeds) and Nebula
  (subscription content) require accounts we don't have. Tests use
  publicly accessible content only.
- **Network dependent** — tests hit live websites. Network issues or site
  changes can cause transient failures.
