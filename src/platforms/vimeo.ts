import type { PlatformConfig, StorageSettings } from '../types/index.js';

/**
 * Vimeo platform configuration.
 *
 * Vimeo's player renders captions inside a `.vp-captions` container div.
 * The container carries inline styles for font-size, font-family, color, and
 * text-shadow. Inside it, a `<span>` element (the "captions window") holds
 * the background-color and the actual caption text.
 *
 * Vimeo also stores user caption-style preferences in cookies (color,
 * fontSize, fontFamily, fontOpacity, bgOpacity, windowColor, windowOpacity,
 * bgColor, edgeStyle), but this extension overrides them with CSS injection
 * for a consistent cross-platform experience.
 *
 * Domains: vimeo.com (main site) and player.vimeo.com (embed player).
 */
export const vimeo: PlatformConfig = {
  name: 'Vimeo',
  css: {
    subtitleContainerSelector: '.vp-captions',
    selectors: {
      subtitle: '.vp-captions',
      background: '.vp-captions > span',
      window: '.vp-captions',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
