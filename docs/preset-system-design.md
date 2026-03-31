# Preset System — Design Document

## Overview

Add a preset system that allows one-click application of complete subtitle style configurations. Ships with a recommended default and dev presets for testing.

## Data Model

### Preset Schema

```typescript
interface Preset {
  /** Unique identifier (slug) */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** Brief description */
  description?: string;
  /** Whether this is the recommended default */
  isRecommended?: boolean;
  /** Whether this is a dev-only preset (hidden in production builds) */
  devOnly?: boolean;
  /** The settings this preset applies */
  settings: StorageSettings;
}
```

### Storage

Presets are stored in two tiers:

1. **Built-in presets** — hardcoded in `src/presets.ts`, ship with the extension. Cannot be deleted by the user.
2. **Custom presets** — stored in `chrome.storage.sync` under key `customPresets: Preset[]`. Users can create/edit/delete these.

The active preset ID (if any) is stored in `chrome.storage.sync` under key `activePreset: string | null`. When `activePreset` is set, the popup shows which preset is active. When the user manually changes any setting, `activePreset` is cleared (indicating custom/manual mode).

```typescript
// Storage shape
interface PresetStorage {
  activePreset: string | null;
  customPresets: Preset[];
  // ... existing StorageSettings fields remain at top level
}
```

### JSON representation

```json
{
  "id": "recommended",
  "name": "Recommended",
  "description": "Drop shadow, transparent background — clean and readable",
  "isRecommended": true,
  "settings": {
    "characterEdgeStyle": "dropshadow",
    "backgroundOpacity": "0",
    "windowOpacity": "0",
    "fontColor": "auto",
    "fontOpacity": "auto",
    "backgroundColor": "auto",
    "windowColor": "auto",
    "fontFamily": "auto",
    "fontSize": "auto"
  }
}
```

## Built-in Presets

### Production presets

| ID | Name | Description | Key settings |
|---|---|---|---|
| `recommended` | Recommended | Drop shadow, transparent BG | `edgeStyle: dropshadow, bgOpacity: 0, winOpacity: 0, rest: auto` |
| `classic` | Classic | Traditional white-on-black | `fontColor: white, bgColor: black, bgOpacity: 75, edgeStyle: none` |
| `minimal` | Minimal | No decoration, site defaults | All `auto` (effectively a reset) |

### Dev-only presets (included only in dev builds via `process.env.NODE_ENV`)

| ID | Name | Purpose |
|---|---|---|
| `dev-high-contrast` | High Contrast | Yellow text on black BG, 100% opacity — tests color/opacity pipeline |
| `dev-monospace` | Monospace Serif | Monospaced serif font, outline edge — tests font-family + edge style |
| `dev-colorful` | Colorful | Cyan text, magenta BG, green window — tests all color channels |
| `dev-large` | Large Text | 300% font size, drop shadow — tests size scaling |
| `dev-transparent` | Fully Transparent | All opacities at 0% — tests transparency |
| `dev-everything` | Everything On | Non-auto value for every setting — max visual change, tests full pipeline |

```typescript
// src/presets.ts

const DEV_PRESETS: Preset[] = [
  {
    id: 'dev-high-contrast',
    name: 'High Contrast',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'outline',
      backgroundOpacity: '100',
      windowOpacity: '75',
      fontColor: 'yellow',
      fontOpacity: '100',
      backgroundColor: 'black',
      windowColor: 'black',
      fontFamily: 'auto',
      fontSize: '150%',
    },
  },
  {
    id: 'dev-monospace',
    name: 'Monospace Serif',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'outline',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'auto',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'monospaced-serif',
      fontSize: 'auto',
    },
  },
  {
    id: 'dev-colorful',
    name: 'Colorful',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '75',
      windowOpacity: '50',
      fontColor: 'cyan',
      fontOpacity: '100',
      backgroundColor: 'magenta',
      windowColor: 'green',
      fontFamily: 'casual',
      fontSize: '150%',
    },
  },
  {
    id: 'dev-large',
    name: 'Large Text',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '0',
      windowOpacity: '0',
      fontColor: 'white',
      fontOpacity: '100',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: '300%',
    },
  },
  {
    id: 'dev-transparent',
    name: 'Fully Transparent',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'none',
      backgroundOpacity: '0',
      windowOpacity: '0',
      fontColor: 'auto',
      fontOpacity: '25',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    },
  },
  {
    id: 'dev-everything',
    name: 'Everything On',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'raised',
      backgroundOpacity: '100',
      windowOpacity: '100',
      fontColor: 'yellow',
      fontOpacity: '100',
      backgroundColor: 'blue',
      windowColor: 'red',
      fontFamily: 'cursive',
      fontSize: '200%',
    },
  },
];
```

## Integration with Current Architecture

### How settings flow today

```
Popup (UI) → chrome.storage.sync → content script (loadSettings) → applyStyles
```

### How presets integrate

```
Popup (UI)
  ├── Preset selector → loads preset.settings → writes ALL to chrome.storage.sync
  │                    → also writes activePreset: preset.id
  └── Individual dropdowns → writes single key to chrome.storage.sync
                           → clears activePreset (custom mode)

chrome.storage.sync → content script (loadSettings) → applyStyles
                                                        (unchanged — presets just set the same keys)
```

**Key insight:** Presets don't add a new settings path. They're a convenience layer that bulk-writes existing `StorageSettings` keys. The content script doesn't need to know about presets at all.

### Changes needed

1. **`src/presets.ts`** (new) — Preset definitions, `getAvailablePresets()`, `getPresetById()`
2. **`src/storage.ts`** — Add `activePreset` to storage operations, add `applyPreset()` and `clearActivePreset()` helpers
3. **`src/ui/popup.ts`** — Add preset selector UI above individual settings
4. **`src/types/index.ts`** — Add `Preset` and `PresetStorage` types

### What stays the same
- Content script (`injection.ts`, `main.ts`) — unchanged
- Platform configs — unchanged
- CSS generation — unchanged
- Bridge — unchanged

## UI Design

### Popup layout

```
┌──────────────────────────────┐
│  Consistent Subtitle Style   │
│                              │
│  Preset: [▼ Recommended    ] │  ← dropdown, shows ★ on recommended
│                              │
│  ── Individual Settings ──   │
│                              │
│  Edge Style:    [▼ auto    ] │
│  Background:    [▼ auto    ] │
│  Window:        [▼ auto    ] │
│  Font Color:    [▼ auto    ] │
│  Font Family:   [▼ auto    ] │
│  Font Size:     [▼ auto    ] │
│  ...                         │
│                              │
│  [Reset to Defaults]         │
└──────────────────────────────┘
```

### Preset dropdown options:
- `Custom` — shown when no preset is active (any manual change)
- `★ Recommended` — the recommended preset (star icon)
- `Classic`
- `Minimal`
- Separator (in dev builds)
- Dev presets (in dev builds only)

### Behavior:
1. **Selecting a preset** → applies all settings from preset, updates all dropdowns, saves to storage
2. **Changing any individual setting** → clears active preset (shows "Custom"), but doesn't change other settings
3. **"Reset to Defaults"** → sets everything to `auto`, clears active preset

## Implementation Plan

### Phase 1: Core (1-2 hours)
- [ ] Create `src/presets.ts` with built-in presets
- [ ] Add `Preset` types to `src/types/index.ts`
- [ ] Add `applyPreset()` / `clearActivePreset()` to `src/storage.ts`

### Phase 2: UI (1-2 hours)
- [ ] Add preset dropdown to popup
- [ ] Wire up preset selection → bulk settings write
- [ ] Wire up individual setting change → clear active preset
- [ ] Dev build flag for dev-only presets

### Phase 3: Testing (1-2 hours)
- [ ] Unit tests for preset application
- [ ] E2E tests: select preset → verify all settings applied
- [ ] E2E tests: change individual setting → verify preset cleared
- [ ] E2E tests: dev presets visible in dev build, hidden in production

### Phase 4: Custom presets (future, low priority)
- [ ] "Save current settings as preset" button
- [ ] Custom preset management (rename, delete)
- [ ] Import/export presets as JSON

## Notes

- **No migration needed** — presets are purely additive. Existing users' settings are unaffected.
- **Sync-friendly** — presets use the same `chrome.storage.sync` keys, so settings sync across devices.
- **Per-site presets** — future per-site settings could allow different presets per platform (e.g., "Recommended" on YouTube, "Classic" on Dropout). This is a separate feature that builds on both presets and per-site settings.
