<p align="center">
  <img src="images/logo-512.png" alt="Consistent Subtitle Style Logo" width="512">
</p>

## Overview

This Chrome extension provides persistent subtitle styling across streaming platforms with TypeScript-based architecture. Features hybrid styling approach using native YouTube API with CSS fallback for platforms that don't offer native support. Supports YouTube, Nebula, and Dropout.

## Quick Start

### Installation

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```
2. Load extension in Chrome:
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder (not the source directory)

### Usage

1. Navigate to any supported streaming service
2. Click the extension icon to open settings
3. Customize your subtitle styles
4. Styles persist across all videos and platforms

### Quick Test

Navigate to any streaming video with subtitles enabled and verify your custom styles are applied automatically.

## Supported Platforms

| Platform | Status | Support Type |
| -------- | ------ | ------------ |
| YouTube  | ✅     | Native API   |
| Nebula   | ✅     | CSS Only     |
| Dropout  | ✅     | Hybrid (Vimeo Player + Inline Styles + localStorage) |

### Dropout / VHX

Dropout uses a Vimeo OTT player embedded in a cross-origin iframe (`embed.vhx.tv`). Because `chrome.storage.onChanged` doesn't fire inside cross-origin iframes, the extension uses a multi-layered approach to apply and persist subtitle styles:

1. **Inline styles** — The primary mechanism for live visual updates. The extension directly sets inline CSS on the Vimeo caption DOM elements (`.vp-captions` container, `CaptionsRenderer_module_captionsLine` spans, and `CaptionsRenderer_module_captionsWindow`), mirroring how the Vimeo player's own Customize UI works internally.

2. **localStorage sync** — Writes style values to all known Vimeo settings keys (`vimeo-ott-player-settings`, `vimeo-video-settings`, etc.) in snake_case format so they persist across reloads.

3. **Vimeo Player API** — When available, calls `setCaptionStyle()` on the Vimeo player instance. The extension uses an aggressive discovery strategy (global scans, React Fiber traversal, Video.js wrappers) to locate the player object, with a `postMessage` fallback if the API isn't directly accessible.

4. **`broadcastChanges`** — Since the parent page (`dropout.tv`) receives `chrome.storage.onChanged` events but the Vimeo iframe does not, the extension's injection script on the parent page forwards setting changes into the iframe via `postMessage`.

**Supported style properties:** font color, font opacity, background color/opacity, window color/opacity, character edge style (shadow, raised, depressed, outline), font family (7 variants), and font size (50%–400%).

**Caveats:**
- Caption style classes use CSS Modules (hashed names), so selectors match on stable prefixes like `[class*="CaptionsRenderer_module_captionsLine"]` rather than exact class names.
- Font size scaling is relative to the Vimeo player's base font size (~49px at 1080p), which may differ at other resolutions.
- The first style application may use a `postMessage` fallback adapter if the player hasn't fully initialized; a retry fires after 1.5s to use the real API once available.
