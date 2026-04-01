import type { PlatformConfig } from '../types/index.js';
import { youtube } from './youtube.js';
import { nebula } from './nebula.js';
import { dropout } from './dropout.js';
import { primevideo } from './primevideo.js';
import { max } from './max.js';
import { crunchyroll } from './crunchyroll.js';

export const PLATFORMS: Record<string, PlatformConfig> = {
  youtube,
  nebula,
  dropout,
  primevideo,
  max,
  crunchyroll,
};

export type Platform = 'youtube' | 'nebula' | 'dropout' | 'primevideo' | 'max' | 'crunchyroll';

export function detectPlatform(): Platform | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('nebula.tv')) return 'nebula';
  if (hostname.includes('vhx.tv') || hostname.includes('dropout.tv')) return 'dropout';
  if (
    hostname.includes('primevideo.com') ||
    (hostname.includes('amazon.') && window.location.pathname.startsWith('/gp/video'))
  )
    return 'primevideo';
  if (hostname === 'max.com' || hostname.endsWith('.max.com') || hostname.includes('hbomax.com'))
    return 'max';
  if (hostname.includes('crunchyroll.com')) return 'crunchyroll';

  return 'unknown';
}

export function getPlatformConfig(platform: Platform | 'unknown'): PlatformConfig | null {
  if (platform === 'unknown') return null;
  return PLATFORMS[platform] ?? null;
}
