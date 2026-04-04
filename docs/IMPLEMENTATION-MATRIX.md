# Implementation Strategy Matrix

How each style property is implemented across all 9 supported platforms.

## Strategy Legend

| Code | Meaning |
|------|---------|
| **Native API** | Uses the platform's built-in player API (e.g. `updateSubtitlesUserSettings()`) |
| **CSS** | CSS injection with `!important` overrides via `<style>` element |
| **CSS+Shadow** | CSS injection into both document and Shadow DOM root |
| **localStorage** | Writes to localStorage keys the player reads on init |
| **Inline** | Directly sets inline styles on caption container elements |
| **postMessage** | Uses `window.postMessage` to communicate with embedded player |
| **Baseline CSS** | Extra CSS rules to normalize platform defaults before applying styles |
| — | Not applicable / not needed for this platform |

## Per-Platform Architecture

### YouTube
- **Strategy**: Native API only (no CSS injection)
- **Mechanism**: Finds `<video>` element → accesses `.getSubtitlesUserSettings()` / `.updateSubtitlesUserSettings()` on the player
- **Value mapping**: Extension values → YouTube's internal numeric/string format (e.g. edge style names → integers 0–4, font families → integers 1–7)
- **Live update**: ✅ Immediate via native API

### Nebula
- **Strategy**: CSS injection + baseline CSS
- **Mechanism**: Injects `<style>` element targeting `#video-player [data-subtitles-container]` selectors
- **Baseline CSS**: Resets container positioning for consistent rendering
- **Live update**: ✅ CSS updates take effect immediately

### Dropout (Vimeo OTT)
- **Strategy**: Native API + CSS + localStorage + inline styles (most complex)
- **Mechanism**: Multi-layer approach:
  1. **localStorage sync**: Writes Vimeo caption preferences (color, fontSize, fontFamily, etc.) for persistence across reloads
  2. **Native player API**: Calls `setCaptionStyle()` on discovered Vimeo/Video.js player instance
  3. **Inline styles**: Directly applies styles to `.vp-captions` container (primary live update mechanism)
  4. **CSS injection**: Fallback for properties inline styles can't handle
- **Player discovery**: Complex 4-phase scan (globals → window scan → DOM/React fiber → React root scan)
- **Live update**: ✅ Via inline styles + player API + CSS
- **Baseline CSS**: Resets caption container defaults

### Prime Video
- **Strategy**: CSS injection only
- **Mechanism**: Targets `.atvwebplayersdk-captions-text` / `.atvwebplayersdk-captions-region` / `.atvwebplayersdk-captions-overlay`
- **Domains**: 11 regional Amazon domains (amazon.com, .co.uk, .de, .co.jp, etc.) + primevideo.com
- **Live update**: ✅ CSS updates take effect immediately

### Max (HBO)
- **Strategy**: CSS injection only
- **Mechanism**: Targets `[class^="TextCue"]` / `[data-testid="CueBoxContainer"]` / `[class^="CaptionWindow"]`
- **Domains**: max.com, *.max.com, hbomax.com
- **Live update**: ✅ CSS updates take effect immediately

### Crunchyroll
- **Strategy**: CSS injection only
- **Mechanism**: Targets Bitmovin player `.bmpui-ui-subtitle-label` / `.bmpui-ui-subtitle-overlay`
- **Live update**: ✅ CSS updates take effect immediately

### Disney+
- **Strategy**: CSS injection + Shadow DOM piercing
- **Mechanism**: Targets `.dss-subtitle-renderer-cue` + `.hive-subtitle-renderer-cue` (dual renderer)
- **Shadow DOM**: `<disney-web-player>` custom element — CSS also injected into shadow root
- **Live update**: ✅ CSS updates take effect in both document and shadow root

### Netflix
- **Strategy**: CSS injection only
- **Mechanism**: Targets `.player-timedtext-text-container span` / `.player-timedtext`
- **Note**: Netflix applies heavy inline styles; our CSS uses `!important` to override. Image-based subtitles (CJK) cannot be restyled.
- **Live update**: ✅ CSS updates take effect immediately

### Vimeo
- **Strategy**: CSS injection only
- **Mechanism**: Targets `.vp-captions` container and `> span` child
- **Note**: Container has inline styles for font-size, font-family, color, text-shadow; our CSS overrides with `!important`
- **Domains**: vimeo.com + player.vimeo.com (embed)
- **Live update**: ✅ CSS updates take effect immediately

## Feature × Platform Matrix

Settings (rows) vs platforms (columns). Each cell shows the implementation strategy.

| Setting | YouTube | Nebula | Dropout | Prime Video | Max | Crunchyroll | Disney+ | Netflix | Vimeo |
|---------|---------|--------|---------|-------------|-----|-------------|---------|---------|-------|
| **Font Color** | Native API (`color`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Font Size** | Native API (`fontSizeIncrement`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Font Family** | Native API (`fontFamily`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Font Opacity** | Native API (`textOpacity`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Background Color** | Native API (`background`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Background Opacity** | Native API (`backgroundOpacity`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Window Color** | Native API (`windowColor`) | CSS | Native + localStorage + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Window Opacity** | Native API (`windowOpacity`) | CSS | Native + localStorage + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |
| **Edge Style** | Native API (`charEdgeStyle`) | CSS | Native + localStorage + Inline + CSS | CSS | CSS | CSS | CSS+Shadow | CSS | CSS |

## CSS Selector Reference

| Platform | Subtitle Selector | Background Selector | Window Selector | Container Selector |
|----------|-------------------|--------------------|-----------------|--------------------|
| Nebula | `#video-player [data-subtitles-container] > div > div > div` | same | `> div > div` | `#video-player [data-subtitles-container]` |
| Dropout | `.vp-captions` | `.vp-captions > span` | `[class*="CaptionsRenderer_module_captionsWindow"]` | `.vp-captions` |
| Prime Video | `.atvwebplayersdk-captions-text` | `.atvwebplayersdk-captions-region` | `.atvwebplayersdk-captions-overlay` | `.atvwebplayersdk-captions-overlay` |
| Max | `[class^="TextCue"]` | `[data-testid="CueBoxContainer"]` | `[class^="CaptionWindow"]` | `[class^="CaptionWindow"]` |
| Crunchyroll | `.bmpui-ui-subtitle-label` | same | `.bmpui-ui-subtitle-overlay` | `.bmpui-ui-subtitle-overlay` |
| Disney+ | `.dss-subtitle-renderer-cue > span, .hive-subtitle-renderer-cue > span` | same | `.dss-subtitle-renderer-cue, .hive-subtitle-renderer-cue` | same |
| Netflix | `.player-timedtext-text-container span` | `.player-timedtext-text-container` | `.player-timedtext` | `.player-timedtext` |
| Vimeo | `.vp-captions` | `.vp-captions > span` | `.vp-captions` | `.vp-captions` |

## Coverage Summary

| Platform | Unit Tests | E2E Tests | Line Coverage |
|----------|-----------|-----------|---------------|
| YouTube | 71 | 14 assertions | 92% |
| Nebula | 14 | 25 assertions | 100% |
| Dropout | 22 | 22 assertions | 60%* |
| Prime Video | 16 | — (needs account) | 100% |
| Max | 15 | 17 assertions | 100% |
| Crunchyroll | 15 | — (needs account) | 100% |
| Disney+ | 22 | — (needs account) | 100% |
| Netflix | 18 | — (needs account) | 100% |
| Vimeo | 20 | 22 assertions | 100% |

\* Dropout's 60% coverage is due to complex runtime-only player discovery code (DOM traversal, React fiber scanning, postMessage bridges) that can only be exercised in a real browser.

## Complexity Ranking

1. **Dropout** — Most complex: 4 implementation strategies, player discovery heuristics, localStorage sync, inline styles, CSS, native API
2. **YouTube** — Moderate: Native API with custom value mappings (numeric enums, color names)
3. **Disney+** — Moderate: Shadow DOM piercing required alongside standard CSS
4. **Netflix** — Simple+: Standard CSS with `!important` to override heavy inline styles
5. **Vimeo** — Simple+: Standard CSS with `!important` to override inline styles
6. **Nebula** — Simple: CSS injection with baseline CSS reset
7. **Prime Video / Max / Crunchyroll** — Simplest: Pure CSS injection with straightforward selectors
