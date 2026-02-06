# Subtitle Extension - TypeScript Build System

This Chrome extension has been migrated to TypeScript with an esbuild-based build pipeline.

## Development Commands

```bash
# Install dependencies
npm install

# Development build (with source maps)
npm run build:dev

# Production build (minified)
npm run build:prod

# Watch mode (automatically rebuilds on changes)
npm run watch

# Type checking only
npm run typecheck

# Clean build directory
npm run clean
```

## Project Structure

```
src/
├── main.ts              # Core extension logic
├── storage.ts           # Chrome storage management
├── platforms/
│   ├── index.ts         # Platform registry and detection
│   └── youtube.ts       # YouTube native API implementation
├── ui/
│   ├── popup.ts         # popup interface logic
│   ├── index.html       # popup UI (copied to dist/)
│   └── styles.css       # popup styles (copied to dist/)
├── types/
│   └── index.ts         # TypeScript type definitions
dist/                    # Build output (load this in Chrome)
├── platforms.js         # Built platform configurations
├── storage.js           # Built storage management
├── main.js              # Built main extension logic
├── popup.js             # Built popup script
├── index.html           # Popup UI
├── styles.css           # Popup styles
├── manifest.json        # Chrome manifest (updated for dist/)
└── images/              # Extension icons
```

## Loading the Extension in Chrome

1. Run `npm run build` or `npm run watch` for development
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory
6. Test on YouTube, Netflix, Disney+, etc.

## TypeScript Configuration

- **Target**: ES2020 (compatible with modern browsers)
- **Module**: ESNext with IIFE output for extension compatibility
- **Strict**: Enabled for better type safety
- **Chrome Types**: @types/chrome for API definitions

## Build Process

1. **TypeScript Compilation**: All .ts files are transpiled to JavaScript
2. **Bundling**: esbuild creates separate bundles for content scripts and popup
3. **Asset Copying**: HTML, CSS, and images are copied to dist/
4. **Manifest Update**: Paths are updated to point to built files
5. **Source Maps**: Generated for development builds

## Type Safety Features

- Strongly typed storage settings
- Platform configuration interfaces
- Chrome API type definitions
- Error handling with proper types
- Method tracking with typed logs

## Debugging

Use the browser console to debug:
- Content script logs show platform detection and style application
- Popup logs show settings operations
- Use `subtitleStylerDebug()` for current state information

## Production Deployment

For production releases:
```bash
npm run build:prod
```
This creates minified files without source maps for the Chrome Web Store.