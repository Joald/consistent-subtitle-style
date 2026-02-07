# Universal Subtitle Style Extension - AGENTS.md

Chrome extension that provides persistent subtitle styling across streaming platforms (YouTube, Netflix, Disney+, Twitch, etc.).

## Quick Architecture

```
src/
├── main.ts          # Orchestration: platform detection, setting application, observers
├── platforms/
│   ├── index.ts     # Platform registry, detection, and CSS helpers
│   └── youtube.ts   # YouTube-specific per-setting configuration
├── storage.ts       # Type-safe Chrome storage with StorageSettings interface
├── ui/
│   ├── popup.ts     # Popup interface with form management & presets
│   ├── index.html   # Popup HTML structure
│   └── styles.css   # Popup styling
├── types/index.ts   # TypeScript type definitions including PlatformSettingConfig
dist/                # Build output (load this folder in Chrome)
```

## Core Features
- **Per-Platform Per-Setting Strategy**: Each setting on each platform chooses optimal method (native vs CSS)
- **Type Safety**: Full TypeScript with strict interfaces
- **Auto Observer**: Watches for new subtitle elements
- **Persistent Settings**: Chrome storage with validation
- **4 Presets**: High Contrast, Cinema, Minimal, Accessibility

## Development Commands

### Build System
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

### Loading Extension
```bash
# Build extension first
npm run build

# Load in Chrome: Extensions > Load unpacked > select dist/ folder
```

### Development Mode
```bash
# For development with auto-rebuild:
npm run watch

# Then reload extension in Chrome after changes
```

### Testing
```bash
# Type checking
npm run typecheck

# Manual testing required on streaming platforms:
# - YouTube (verify native + CSS fallback)
# - Netflix, Disney+ (CSS only)
# - Popup interface functionality
```

### Debugging
```bash
# Console debugging available:
subtitleStylerDebug()  # Shows typed current state and stats

# TypeScript compilation errors:
npm run typecheck
```

## Key Architecture Decisions

### Why TypeScript Build System?
1. **Type Safety**: Compile-time error detection and better IDE support
2. **Modern Development**: ES modules, async/await, and modern JavaScript features
3. **Better Maintainability**: Interfaces make code structure clearer
4. **Build Process**: Automated bundling, minification, and asset management
5. **Development Experience**: Fast rebuilds, source maps, and watch mode

### Migration Benefits
- **Error Prevention**: Catch bugs before runtime
- **Refactoring Safety**: IDE-assisted code changes
- **Documentation**: Types serve as living documentation
- **Team Development**: Shared understanding of data structures
- **Future-Proof**: Easier to add new features safely

## Agent Development Guidelines

### When Working With This TypeScript Codebase

#### Core Development Tasks
- **Feature Implementation**: Add functionality to TypeScript files in src/
- **Platform Support**: Extend PLATFORMS object in src/platforms/index.ts with proper typing
- **UI Changes**: Modify src/ui/ files with type safety
- **Settings Management**: Update StorageSettings interface in src/types/index.ts
- **Type Definitions**: Add new interfaces for complex data structures

#### Code Quality Standards
- **TypeScript**: Use strict mode and proper type annotations
- **ES6+ Features**: Modern JavaScript with type safety
- **Error Handling**: Typed Chrome API calls with proper error boundaries
- **Console Logging**: Include typed debug information
- **Interface Design**: Define clear interfaces for all major data structures

#### Adding New Platform Support
```typescript
// In src/platforms/index.ts PLATFORMS object:
newplatform: {
  selector: '.subtitle-selector',
  name: 'New Platform',
  settings: {
    characterEdgeStyle: {
      method: 'css',
      applyCSSSetting: (element, value) => { /* CSS implementation */ }
    },
    backgroundOpacity: {
      method: 'css',
      applyCSSSetting: (element, value) => { /* CSS implementation */ }
    },
    windowOpacity: {
      method: 'css',
      applyCSSSetting: (element, value) => { /* CSS implementation */ }
    }
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  }
}
```

#### Testing New Features
1. Run `npm run typecheck` to verify type safety
2. Run `npm run build` to ensure compilation works
3. **ALWAYS run `npm run build` after EVERY edit to confirm project builds**
4. Load dist/ folder in Chrome developer mode
5. Test on target streaming platforms
6. Use `subtitleStylerDebug()` for typed state verification
7. Check console for typed debug information

#### Type Safety Checklist
- [ ] All functions have proper return type annotations
- [ ] Chrome API calls are typed correctly
- [ ] Storage operations use StorageSettings interface
- [ ] Platform configurations implement PlatformConfig interface
- [ ] Error handling includes proper type information
- [ ] No `any` types (except where unavoidable)

### Current Extension Capabilities (TypeScript Enhanced)
- **Automatic Platform Detection**: Typed platform identification
- **Per-Platform Per-Setting Strategy**: Each setting chooses optimal method (native vs CSS)
- **Persistent Settings**: Type-safe Chrome storage with validation
- **Real-time Updates**: Live preview in typed popup interface
- **Style Presets**: Typed preset configurations
- **Comprehensive Logging**: Typed debug information and method tracking

### Security & Performance (TypeScript Verified)
- **Local Processing**: All logic runs locally with type safety
- **Minimal Permissions**: Type-checked Chrome API usage
- **Efficient DOM Queries**: Typed DOM operations
- **Graceful Degradation**: Typed fallback mechanisms
- **Memory Safety**: Proper null/undefined handling

This TypeScript architecture prioritizes type safety, maintainability, and developer experience while preserving comprehensive functionality across streaming platforms. Agents should focus on maintaining type safety and leveraging the build system for optimal development workflow.

**CRITICAL: Always run `npm run build` AND `npm run typecheck` after every single edit to verify the project compiles successfully.**