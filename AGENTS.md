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
- **usesCssStyling Flag**: Platform config flag to enable CSS-based styling (requires MutationObserver)
- **Type Safety**: Full TypeScript with strict interfaces
- **Auto Observer**: Watches for new subtitle elements (only when usesCssStyling is true)
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
subtitleStylerDebug()  # Console: shows typed state and stats
```

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
  usesCssStyling: true, // Set to true if platform requires CSS-based styling ( MutationObserver)
  settings: {
    characterEdgeStyle: {
      getCurrentValue() { return undefined; },
      applySetting: (value) => applyCharacterEdgeStyle(document.querySelectorAll('.subtitle-selector'), value)
    },
    // ... other settings
  },
  detectNativeCapabilities: () => false,
  getCurrentNativeSettings: () => null
}
```

**Note:** Set `usesCssStyling: true` for platforms that need CSS manipulation (requires MutationObserver to watch for dynamic elements). Use native APIs when available (like YouTube) - no observer needed.

#### Testing New Features
1. Run `npm run typecheck` to verify type safety
2. Run `npm run build` to ensure compilation works
3. Load dist/ folder in Chrome developer mode
4. Test on target streaming platforms
5. Use `subtitleStylerDebug()` for typed state verification
6. Check console for typed debug information

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