import type { PlatformConfig, StorageSettings } from '../types/index.js';

export const primevideo: PlatformConfig = {
  name: 'Prime Video',
  css: {
    subtitleContainerSelector: '.atvwebplayersdk-captions-overlay',
    selectors: {
      subtitle: '.atvwebplayersdk-captions-text',
      background: '.atvwebplayersdk-captions-region',
      window: '.atvwebplayersdk-captions-overlay',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
