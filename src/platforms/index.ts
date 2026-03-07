import type { PlatformConfig, StorageSettings } from '../types/index.js';
import { youtube } from './youtube.js';
import { dropout } from './dropout.js';

export const PLATFORMS: Record<string, PlatformConfig> = {
  youtube,
  dropout,
  nebula: {
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
  },
};

export type Platform = 'youtube' | 'nebula' | 'dropout';

export function detectPlatform(): Platform | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('nebula.tv')) return 'nebula';
  if (hostname.includes('vhx.tv') || hostname.includes('dropout.tv')) return 'dropout';

  return 'unknown';
}

export function getPlatformConfig(platform: Platform | 'unknown'): PlatformConfig | null {
  if (platform === 'unknown') return null;
  return PLATFORMS[platform] ?? null;
}
