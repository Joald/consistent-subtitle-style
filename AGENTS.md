# Consistent Subtitle Style - AGENTS.md

Chrome extension that provides persistent subtitle styling across streaming platforms

## Quick Architecture

> **IIFE scripts** (bridge.ts, injection.ts) run in page context via postMessage to polyfill chrome.storage APIs.

```
src/
├── main.ts          # Orchestration: platform detection, setting application, observers
├── debug.ts         # Debug logging utilities (debug.log, debug.error, debug.warn)
├── platforms/
│   ├── index.ts     # Platform registry, detection, and CSS helpers
│   ├── youtube.ts   # YouTube-specific per-setting configuration (native player API)
│   └── dropout.ts   # Dropout.tv-specific per-setting configuration (Video.js API via embed.vhx.tv)
├── storage.ts       # Type-safe Chrome storage with StorageSettings interface
├── ui/              # interface for changing the settings
│   ├── popup.ts
│   ├── index.html
│   └── styles.css
├── types/index.ts   # TypeScript type definitions including PlatformSettingConfig
├── bridge.ts        # IIFE: Polyfills chrome.storage APIs in page context via postMessage
├── injection.ts     # IIFE: Entry point - injects bridge, then loads main scripts sequentially
dist/                # Build output (load this folder in Chrome)
```

## Core Features

- **Per-Platform Per-Setting Strategy**: Each setting on each platform chooses optimal method (native vs CSS)
- **Comprehensive Styling**: Supports font family, size, color, opacity, edge style, background/window color and opacity.
- **YouTube Native Integration**: Uses YouTube's internal player API for seamless, non-intrusive styling.
- **Dropout.tv Native Integration**: Uses Video.js `textTrackSettings` API (`setValues`/`updateDisplay`) via the `embed.vhx.tv` cross-origin iframe. Content scripts must match `embed.vhx.tv` directly — the player does not live on `watch.dropout.tv`.
- **Dynamic Style Injection**: CSS styling is now done via an injected `<style>` tag, avoiding performance issues with layout thrashing from MutationObservers.
- **Type Safety**: Full TypeScript with strict interfaces
- **Persistent Settings**: Chrome storage with validation

## Development Commands

### Build System

```bash
# Install dependencies
npm install

# Default build (development with source maps)
npm run build

# Production build (minified)
npm run build:prod

# Watch mode (automatically rebuilds on changes)
npm run watch

# Type checking only
npm run typecheck

# Clean build directory
npm run clean
```

### Loading Extension

```bash
npm run build
# Load in Chrome: Extensions > Load unpacked > select dist/ folder

# For auto-rebuild on changes:
npm run watch
```

### Testing & Debugging

```bash
npm run typecheck
npm test         # Run unit tests
npm run test:watch  # Run tests in watch mode
subtitleStylerDebug()  # Console: shows typed state and stats
```

### Logo Icons

Extension icons are generated from HTML files using Puppeteer during build.

**Source files:** `images/logo-16.html`, `images/logo-48.html`, `images/logo-128.html`, `images/logo-512.html`

**Generated files:** `dist/images/logo-16.png`, `dist/images/logo-48.png`, `dist/images/logo-128.png`, `dist/images/logo-512.png`

**Sizes:**

- **16x16**: Three letters "C", "S", "S" arranged in a staggered layout (C mid-left, S center-low, S top-right), each with different text-shadow styles
- **48x48**: Same staggered layout as 16x16, scaled up
- **128x128**: Full text "Consistent Subtitle Style" with three lines, each styled differently
- **512x512**: Same as 128x128, used for README header

**Text-shadow styles used (from extension's characterEdgeStyle options):**

- **Raised**: White shadow on all corners (used on first word/letter)
- **Outline**: Black outline around text (used on second word/letter)
- **Drop shadow**: Dark shadow offset (used on third word/letter)

**To modify icons:**

1. Edit the corresponding HTML file in `images/`
2. Run `npm run build` - Puppeteer will regenerate PNGs automatically
3. PNGs are generated fresh each build (not committed to repo)

## Agent Development Guidelines

### When Working With This TypeScript Codebase

#### Code Quality Standards

- **TypeScript**: Use strict mode and proper type annotations
- **ES6+ Features**: Modern JavaScript with type safety
- **Error Handling**: Typed Chrome API calls with proper error boundaries
- **Console Logging**: Use `debug.log()` instead of `console.log()` for all logging. The `debug.log()` function only outputs when DEBUG mode is enabled. Note: IIFE scripts (bridge.ts, injection.ts) cannot import debug and should keep `console.log()` for critical initialization messages.
- **Interface Design**: Define clear interfaces for all major data structures

#### Adding New Platform Support

In `src/platforms/index.ts`, add to PLATFORMS:

```typescript
newplatform: {
  name: 'New Platform',
  css: {
    subtitleContainerSelector: '.video-player',
    selectors: {
      subtitle: '.subtitle-text',
      background: '.subtitle-background',
      window: '.subtitle-window'
    }
  },
  detectNativeCapabilities: () => false,
  getCurrentNativeSettings: () => null
}
```

**Note:** Provide a `css` configuration for platforms that need CSS manipulation via injected `<style>` tags. Use `nativeSettings` when APIs are available (like YouTube or Dropout/Video.js).

**Dropout/VHX specifics:** The player runs inside a cross-origin iframe (`embed.vhx.tv`). The Video.js `textTrackSettings` API is used: `player.textTrackSettings.setValues(values)` then `player.textTrackSettings.updateDisplay()`. Key value format differences vs YouTube: opacity is coarse (0/0.5/1 only), `outline` maps to `'uniform'`, font families use camelCase strings, `fontPercent` is a Number (`null` = 100% default).

#### Testing New Features

1. Run `npm run typecheck` to verify type safety
2. Run `npm test` to run unit tests
3. Run `npm run build` to ensure compilation works
4. Load dist/ folder in Chrome developer mode
5. Test on target streaming platforms
6. Use `subtitleStylerDebug()` for typed state verification
7. Check console for typed debug information

#### Type Safety Checklist

- All functions have proper return type annotations
- Chrome API calls are typed correctly
- Storage operations use StorageSettings interface
- Platform configurations implement PlatformConfig interface
- Error handling includes proper type information
- No `any` types (except where unavoidable)

### Security & Performance

- **Local Processing**: All logic runs locally
- **Minimal Permissions**: Type-checked Chrome API usage
- **Efficient DOM Queries**: Typed DOM operations
- **Graceful Degradation**: Typed fallback mechanisms, including `detectNativeCapabilities` (preferably URL-based) to skip native settings when the platform features are not expected on the current page.
- **Dynamic Player Sensing**: Uses a MutationObserver to detect when player elements (like YouTube's mini-players or previews) are added to the DOM, ensuring styles are applied even without a page navigation.
- **SPA Support**: Listens for platform-specific events (like YouTube's `yt-navigate-finish`) to re-apply styles during SPA navigation.
- **Memory Safety**: Proper null/undefined handling

## Agentic Developer Experience (ADX)

This project is optimized for AI-driven development and testing.

### Stable Extension ID

The `manifest.json` contains a hardcoded `key` that ensures the extension always has the ID `fdhobonfeacceokemphmkngikeeakbok`. This allows for persistent settings across builds and predictable URL-based testing.

### Headless Popup Testing

The popup script (`src/ui/popup.ts`) automatically imports `mock-chrome.ts`. When running outside of an extension context (e.g., as a local file in the browser agent), it injects mocks for `chrome.storage.sync` and `chrome.runtime`.

- **Mock Storage**: Uses `localStorage` (`cs_style_mock_storage`) to simulate sync storage.
- **Interactivity**: The mocks allow the popup UI to be fully functional (dropdowns, save, reset) when opened as `file:///.../dist/index.html`.

### Automated Reload/Test Cycle

The browser agent can automate the entire development cycle using the `/reload-and-test` workflow:

1. Rebuild the project.
2. Open the popup locally in the agent to verify UI changes.
3. Open a live site (e.g., Dropout, YouTube) in the agent.
4. **Refresh the page** to force-load the new content scripts.
5. Verify style application via DOM inspection and screenshots.

**CRITICAL: Always run `npm run ci` after every edit.**
**CRITICAL: At the end of each major change, update this AGENTS.md with ACTUALLY NECESSARY info**
