# Max/HBO Native Subtitle API Research

**Date:** 2026-04-20  
**Task:** Investigate whether Max/HBO exposes a native subtitle API that could replace or augment the current CSS-only approach  
**Conclusion:** ❌ No viable native API exists. CSS injection remains the best approach.

---

## Current Implementation

Max/HBO uses CSS-only injection targeting three key React-rendered elements:

```typescript
subtitleContainerSelector: '[class^="CaptionWindow"]'
selectors: {
  subtitle: '[class^="TextCue"]',
  background: '[data-testid="CueBoxContainer"]',
  window: '[class^="CaptionWindow"]',
}
```

This supports: font color, font opacity, font family, font size (via `transform: scale()`), background color/opacity, window color/opacity, and character edge style.

## Research Findings

### 1. No Public JavaScript API

Unlike YouTube, which deliberately exposes `player.getSubtitlesUserSettings()` and `player.updateSubtitlesUserSettings()` on the `.html5-video-player` DOM element, Max/HBO does **not** expose any player API on DOM elements. There are no methods on the `<video>` element or any parent container for reading or writing caption display settings.

YouTube's API is exceptional — it was intentionally designed for external tools and embedded player integration. No other major streaming service provides equivalent public APIs.

### 2. Server-Side Settings Storage

Max/HBO stores caption preferences server-side, per user profile. The built-in caption customization (accessible via Settings > Subtitle Style on hbomax.com) sends API calls to Max's backend. These settings are:

- **Per-profile, per-account** — not stored in localStorage or cookies
- **Applied during rendering** — the player reads preferences from the authenticated session
- **Not accessible from content scripts** — would require authenticated API calls with the user's session token

### 3. React Internal State Architecture

Max's web player is built with React. Caption rendering uses React components that produce the CaptionWindow/TextCue/CueBoxContainer DOM elements. Possible "native" approaches and why they fail:

| Approach | Feasibility | Risk |
|----------|------------|------|
| Hook into React fiber tree | Technically possible via `__REACT_FIBER$` | Extremely fragile; breaks on every build/deploy |
| Intercept network responses | Could modify caption preference API responses | Requires understanding undocumented API; auth tokens; breaks on API changes |
| Modify React component props | Would need to find and patch component definitions | Obfuscated code; impossible to maintain |
| Override `window.fetch`/`XMLHttpRequest` | Could intercept caption data delivery | Caption format (TTML/IMSC) is complex; would need a full TTML parser |

All of these approaches share the same fatal flaw: **they depend on undocumented, obfuscated internals that change with every deployment**. Max deploys frequently, with minified/hashed class names and bundled code.

### 4. Caption Format: TTML/IMSC

Max delivers captions in TTML (Timed Text Markup Language) / IMSC format, the industry standard for streaming. The player:

1. Fetches TTML/IMSC caption files from CDN
2. Parses them internally
3. Renders styled DOM elements (CaptionWindow, TextCue, etc.)
4. Applies user preferences from server-side settings

The TTML files themselves contain inline styling. Even if we intercepted them, modifying TTML pre-render would require:
- A full TTML/IMSC parser
- Understanding Max's specific TTML profile and extensions
- Handling timing, positioning, and style inheritance
- All for marginal benefit over CSS injection

### 5. Existing Extension Landscape

All known subtitle customization extensions for Max/HBO use CSS injection:

- **HBO Max SubStyler** (Chrome Web Store, 798 users) — CSS injection for text size, outline, background color
- **Substital** — adds external subtitles via CSS overlay
- **No known extension** uses a native API approach for Max

This is a strong signal that no reverse-engineered API path has proven viable.

### 6. Comparison with YouTube (The Exception)

YouTube is the only platform in our 9-platform roster where native API integration works:

| Feature | YouTube | Max/HBO |
|---------|---------|---------|
| Public player API | ✅ `.getSubtitlesUserSettings()` | ❌ None |
| DOM-accessible settings | ✅ On player element | ❌ React internal state |
| Settings storage | Client-side (per player instance) | Server-side (per profile) |
| API stability | Stable (part of IFrame API contract) | N/A |
| Documentation | Google IFrame API docs | None |

Even Dropout (which uses the Vimeo-based player) only has a CSS + inline-style approach, not a native API.

## Recommendation

**Keep the CSS-only approach for Max/HBO.** It is:

1. **Reliable** — CSS selectors using `[class^="CaptionWindow"]` and `[data-testid="CueBoxContainer"]` are stable (data-testid attributes are intentional and rarely removed)
2. **Complete** — all 9 supported styling settings work via CSS
3. **Maintainable** — no dependency on obfuscated internals
4. **Proven** — 913 tests pass, E2E coverage confirmed

### Potential Minor Improvements (CSS-Based)

Rather than a native API pivot, consider these CSS-based improvements:

- **Font positioning** — CSS `transform: translate()` on CaptionWindow for subtitle position adjustment
- **Custom fonts** — `@font-face` injection for web fonts beyond the standard 7 families
- **Animation** — CSS transitions for subtitle fade-in/fade-out

These stay within the reliable CSS injection paradigm and don't introduce fragile dependencies.

## Summary

| Question | Answer |
|----------|--------|
| Does Max have a native subtitle API? | No — no public API, no DOM-accessible methods |
| Could we reverse-engineer one? | Theoretically, but impractical (React internals, server-side auth, frequent deploys) |
| Do other extensions use a native API? | No — all use CSS injection |
| Is the CSS approach limiting? | Minimally — all 9 settings work; only positioning is somewhat constrained |
| Recommendation | Keep CSS-only; close this backlog item as "won't do" |
