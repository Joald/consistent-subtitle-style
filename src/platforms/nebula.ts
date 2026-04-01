import type { PlatformConfig, StorageSettings } from '../types/index.js';

export const nebula: PlatformConfig = {
  name: 'Nebula',
  baselineCss: {
    subtitle: 'font-weight: bold !important;',
  },
  css: {
    subtitleContainerSelector: '#video-player [data-subtitles-container]',
    selectors: {
      subtitle: '#video-player [data-subtitles-container] > div > div > div',
      background: '#video-player [data-subtitles-container] > div > div > div',
      window: '#video-player [data-subtitles-container] > div > div',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
