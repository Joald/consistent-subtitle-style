import type { PlatformConfig, StorageSettings } from '../types/index.js';

export const crunchyroll: PlatformConfig = {
  name: 'Crunchyroll',
  css: {
    subtitleContainerSelector: '.bmpui-ui-subtitle-overlay',
    selectors: {
      subtitle: '.bmpui-ui-subtitle-label',
      background: '.bmpui-ui-subtitle-label',
      window: '.bmpui-ui-subtitle-overlay',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
