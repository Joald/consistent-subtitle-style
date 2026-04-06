/**
 * Platform icons using Google's favicon CDN for accurate, up-to-date logos.
 *
 * Each platform maps to its favicon URL. The icons are loaded as <img> tags
 * in the popup, giving us the real platform logos rather than hand-drawn SVGs.
 */

import type { Platform } from './platforms/index.js';

/* ------------------------------------------------------------------ */
/*  Favicon CDN URLs (Google S2)                                      */
/* ------------------------------------------------------------------ */

/** Domain mapping for Google's favicon service. */
const PLATFORM_DOMAINS: Record<Platform, string> = {
  youtube: 'youtube.com',
  netflix: 'netflix.com',
  nebula: 'nebula.tv',
  dropout: 'dropout.tv',
  primevideo: 'primevideo.com',
  max: 'max.com',
  crunchyroll: 'crunchyroll.com',
  disneyplus: 'disneyplus.com',
  vimeo: 'vimeo.com',
};

/**
 * Build a Google Favicon CDN URL for a given platform.
 *
 * @param platform - Target platform
 * @param size - Icon size in px (16, 32, 64 etc). Default 16.
 */
export function faviconUrl(platform: Platform, size = 16): string {
  const domain = PLATFORM_DOMAINS[platform];
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${String(size)}`;
}

/**
 * Legacy inline SVG markup record. Now empty — `platformIconHtml()` uses
 * Google favicon CDN instead. Kept so that any code referencing the export
 * still compiles.
 */
export const PLATFORM_ICONS: Record<Platform, string> = {
  youtube: '',
  netflix: '',
  nebula: '',
  dropout: '',
  primevideo: '',
  max: '',
  crunchyroll: '',
  disneyplus: '',
  vimeo: '',
};

/**
 * Return an `<img>` tag for a given platform's favicon, wrapped in a sized
 * container element. The returned HTML string can be injected via `.innerHTML`.
 *
 * @param platform - Target platform
 * @param size - CSS size in px (applied to width & height). Default 14.
 */
export function platformIconHtml(platform: Platform, size = 14): string {
  const url = faviconUrl(platform, size <= 16 ? 16 : 32);
  return `<span class="platform-icon" style="width:${String(size)}px;height:${String(size)}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0" aria-hidden="true"><img src="${url}" width="${String(size)}" height="${String(size)}" style="border-radius:2px" alt=""></span>`;
}
