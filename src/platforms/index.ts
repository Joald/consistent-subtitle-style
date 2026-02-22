import type { PlatformConfig, StorageSettings } from '../types/index.js';
import { youtube } from './youtube.js';

export const PLATFORMS: Record<string, PlatformConfig> = {
  youtube,
  nebula: {
    name: 'Nebula',
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
  },
};

export type Platform = 'youtube' | 'nebula';

export function detectPlatform(): Platform | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('nebula.tv')) return 'nebula';

  return 'unknown';
}

export function getPlatformConfig(platform: Platform | 'unknown'): PlatformConfig | null {
  if (platform === 'unknown') return null;
  return PLATFORMS[platform] ?? null;
}
