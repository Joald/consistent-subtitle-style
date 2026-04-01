import type { PlatformConfig, StorageSettings } from '../types/index.js';

/**
 * Disney+ platform configuration.
 *
 * Disney+ uses two subtitle renderer variants:
 * - `.dss-subtitle-renderer-cue` — the primary Disney Streaming Services renderer
 * - `.hive-subtitle-renderer-cue` — an alternative renderer (some regions / older builds)
 *
 * The player may use a `<disney-web-player>` custom element with Shadow DOM,
 * so styles must also be injected into the shadow root when present.
 * The shadow DOM injection is handled by the app's `injectCssRules` when the
 * `shadowHost` property is set on the CSS config.
 */
export const disneyplus: PlatformConfig = {
  name: 'Disney+',
  css: {
    subtitleContainerSelector: '.dss-subtitle-renderer-cue, .hive-subtitle-renderer-cue',
    selectors: {
      subtitle: '.dss-subtitle-renderer-cue > span, .hive-subtitle-renderer-cue > span',
      background: '.dss-subtitle-renderer-cue > span, .hive-subtitle-renderer-cue > span',
      window: '.dss-subtitle-renderer-cue, .hive-subtitle-renderer-cue',
    },
    shadowHost: 'disney-web-player',
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
