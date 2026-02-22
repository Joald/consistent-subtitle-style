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
│   └── youtube.ts   # YouTube-specific per-setting configuration
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

**Source files:** `images/logo-16.html`, `images/logo-48.html`, `images/logo-128.html`

**Generated files:** `dist/images/logo-16.png`, `dist/images/logo-48.png`, `dist/images/logo-128.png`

**Sizes:**

- **16x16**: Three letters "C", "S", "S" arranged in a staggered layout (C mid-left, S center-low, S top-right), each with different text-shadow styles
- **48x48**: Same staggered layout as 16x16, scaled up
- **128x128**: Full text "Consistent Subtitle Style" with three lines, each styled differently

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

**Note:** Provide a `css` configuration for platforms that need CSS manipulation via injected `<style>` tags. Use `nativeSettings` when APIs are available (like YouTube).

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
- **Graceful Degradation**: Typed fallback mechanisms
- **Memory Safety**: Proper null/undefined handling

**CRITICAL: Always run `npm run build` AND `npm run typecheck` after every edit.**
**CRITICAL: At the end of each major change, update this AGENTS.md with ACTUALLY NECESSARY info**
