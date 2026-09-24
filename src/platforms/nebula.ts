import type { PlatformConfig, StorageSettings } from '../types/index.js';

export const nebula: PlatformConfig = {
  name: 'Nebula',
  baselineCss: {
    subtitle: 'font-weight: bold !important;',
  },
  css: {
    subtitleContainerSelector: '#video-player [data-subtitles-container]',
    selectors: {
      // Nebula renders subtitles as custom React DOM (react-vtt, data-show-native-cues=false)
      // with Emotion-hashed classes, so selectors must stay structural.
      // 2026-09-24: Nebula added a wrapper div — the text pill is now FOUR levels
      // below [data-subtitles-container] (was three). bg color/opacity broke because
      // background-color doesn't inherit, while color/font-weight kept working.
      subtitle: '#video-player [data-subtitles-container] > div > div > div > div',
      background: '#video-player [data-subtitles-container] > div > div > div > div',
      window: '#video-player [data-subtitles-container] > div > div > div',
    },
  },
  detectNativeCapabilities(): boolean {
    return false;
  },
  getCurrentNativeSettings(): Partial<StorageSettings> | null {
    return null;
  },
};
