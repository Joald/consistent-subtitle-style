import type { PlatformConfig, StorageSettings } from '../types/index.js';

/**
 * Netflix platform configuration.
 *
 * Netflix's Cadmium player renders text-based subtitles inside a
 * `.player-timedtext` container. Individual subtitle lines are wrapped
 * in `.player-timedtext-text-container` divs, each containing `<span>`
 * elements with the actual text and inline styles.
 *
 * Image-based subtitles (e.g. Japanese, Chinese) are rendered as SVG images
 * inside `.image-based-subtitles` — those are bitmap and cannot be restyled
 * with CSS.
 *
 * Netflix applies heavy inline styles to subtitle elements, but our CSS rules
 * use `!important` to override them.
 */
export const netflix: PlatformConfig = {
  name: 'Netflix',
  css: {
    subtitleContainerSelector: '.player-timedtext',
    selectors: {
      subtitle: '.player-timedtext-text-container span',
      background: '.player-timedtext-text-container',
      window: '.player-timedtext',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
