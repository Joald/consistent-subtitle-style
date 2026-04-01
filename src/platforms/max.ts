import type { PlatformConfig, StorageSettings } from '../types/index.js';

export const max: PlatformConfig = {
  name: 'Max',
  css: {
    subtitleContainerSelector: '[class^="CaptionWindow"]',
    selectors: {
      subtitle: '[class^="TextCue"]',
      background: '[data-testid="CueBoxContainer"]',
      window: '[class^="CaptionWindow"]',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
