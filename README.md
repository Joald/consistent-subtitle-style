# Universal Subtitle Style Extension

## Overview

This Chrome extension provides persistent subtitle styling across streaming platforms with TypeScript-based architecture. Features hybrid styling approach using native YouTube API with CSS fallback for all other platforms. Supports YouTube, Netflix, Disney+, and more with type-safe configuration.

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
1. Navigate to any streaming service with subtitles (YouTube, Netflix, etc.)
2. Click the extension icon to open settings
3. Customize your subtitle styles:
   - Character edge style (drop shadow, outline, etc.)
   - Background opacity and window opacity
   - Font family, size, and color
   - Style presets (High Contrast, Cinema, Minimal, Accessibility)
4. Click "Save" to apply changes
5. Styles persist across all videos and platforms

### Quick Test
Navigate to any streaming video with subtitles enabled and verify your custom styles are applied automatically.

## Supported Platforms

| Platform | Status | Subtitle Selector | Support Type |
|----------|--------|-------------------|--------------|
| YouTube | ✅ | `.ytp-caption-segment` | Native API + CSS |
| Netflix | ✅ | `.player-timedtext` | CSS Only |
| Disney+ | ✅ | `.dss-subtitle-renderer` | CSS Only |

## Features

### ✅ Core Functionality
- **Persistent Settings**: Type-safe Chrome storage with validation
- **Universal Application**: Same styles work on all supported platforms
- **Real-time Preview**: See changes instantly in the settings popup
- **Style Presets**: High Contrast, Cinema, Minimal, Accessibility presets
- **Hybrid Styling**: Native YouTube API with CSS fallback for other platforms

### ✅ Style Options
- **Character Edge Style**: Drop shadow, outline, raised, depressed effects
- **Background**: Background and window opacity controls
- **Typography**: Font family and size controls
- **Native Integration**: Direct YouTube API settings when available
- **CSS Fallback**: Robust styling for non-native platforms

### ✅ Development Tools
- **TypeScript Build**: esbuild-based development and production builds
- **Type Safety**: Full TypeScript with strict interfaces
- **Debug Console**: `subtitleStylerDebug()` function for state inspection
- **Auto Observer**: Watches for new subtitle elements automatically

## Development & Testing

### Build Commands
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

### Testing
```bash
# Type checking (verifies TypeScript correctness)
npm run typecheck

# Build verification (ensure project compiles)
npm run build

# Manual testing required on streaming platforms:
# - YouTube (verify native + CSS fallback)
# - Netflix, Disney+ (CSS only)
# - Popup interface functionality
```

### Chrome DevTools Integration
```javascript
// Available in browser console after extension loads
subtitleStylerDebug()  // Shows typed current state and stats
```

### Development Workflow
1. Run `npm run watch` for development mode
2. Make changes to TypeScript source files
3. Extension automatically rebuilds
4. Reload extension in Chrome to test changes
5. Use `npm run typecheck` to verify type safety

## Troubleshooting

### Common Issues & Solutions

1. **Extension Not Loading**
    ```
    ❌ Extension not found in chrome://extensions/
    ```
    - Check for manifest syntax errors
    - Ensure Developer mode is enabled
    - Reload extension after changes

2. **Styles Not Applying**
    ```
    ❌ No custom styles on subtitle elements
    ```
    - Enable subtitles on the video player
    - Check platform detection in console logs
    - Verify settings are saved
    - Try different selector for custom platforms

3. **Settings Not Persisting**
    ```
    ❌ Styles reset after browser restart
    ```
    - Check storage permissions in manifest
    - Verify chrome.storage API is available
    - Check for quota exceeded errors

4. **Platform Not Supported**
    ```
    ❌ No handler for this streaming service
    ```
    - Use custom selector feature in settings
    - Request platform support in issues

## Performance

The extension is optimized to:
- Apply styles within 100ms of subtitle detection
- Use minimal memory footprint
- Avoid layout thrashing with batch operations
- Cache platform handlers for reuse

## Security & Privacy

The extension:
- Runs locally with no external servers
- Does not collect or transmit user data
- Only accesses subtitle elements on streaming platforms
- Uses standard Chrome extension APIs (storage, scripting)
- Stores settings in browser's local storage

## Contributing

When adding new features:
1. Add platform handler to `scripts/[platform].js`
2. Register selector in `scripts/universal.js`
3. Test on multiple videos across the platform
4. Update documentation with platform details
5. Add tests for the new platform

## Support

For testing issues:
1. Check browser console for JavaScript errors
2. Verify extension loaded in `chrome://extensions/`
3. Check TESTING.md for detailed troubleshooting

---

**This extension provides persistent subtitle style customization across all major streaming services with a focus on accessibility and user experience.**