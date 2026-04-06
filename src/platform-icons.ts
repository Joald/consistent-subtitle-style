/**
 * Inline SVG icons for each supported streaming platform.
 *
 * Each icon is a self-contained 16×16 SVG string using the platform's brand
 * colour(s). The SVGs are designed to be recognisable even at very small sizes
 * (14–16 px) in the extension popup.
 *
 * Usage: set `element.innerHTML = PLATFORM_ICONS[platform]` or create an
 * `<img>` via the data-URI helper.
 */

import type { Platform } from './platforms/index.js';

/* ------------------------------------------------------------------ */
/*  Brand-colour SVG icons (16 × 16)                                  */
/* ------------------------------------------------------------------ */

/** Inline SVG markup keyed by platform identifier. */
export const PLATFORM_ICONS: Record<Platform, string> = {
  /* YouTube — red rounded rect with white play triangle */
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="12" x="0" y="2" rx="3" fill="#FF0000"/>
  <polygon points="6,4.5 6,11.5 12,8" fill="#fff"/>
</svg>`,

  /* Netflix — red "N" with shadow stripe */
  netflix: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="2" fill="#E50914"/>
  <path d="M4.5 2.5h2.2l3 8.5V2.5h2.2v11h-2.2l-3-8.5v8.5H4.5z" fill="#fff"/>
</svg>`,

  /* Nebula — purple circle with stylised "N" */
  nebula: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <circle cx="8" cy="8" r="7.5" fill="#6366F1"/>
  <path d="M5 11V5h1.5l3 4.2V5H11v6H9.5L6.5 6.8V11z" fill="#fff"/>
</svg>`,

  /* Dropout — teal rounded rect with "D" */
  dropout: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="3" fill="#1DB8A0"/>
  <path d="M5 3.5h3a4.5 4.5 0 0 1 0 9H5zm2 2v5h1a2.5 2.5 0 0 0 0-5z" fill="#fff"/>
</svg>`,

  /* Prime Video — dark blue rect with blue smile arc */
  primevideo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="2" fill="#00A8E1"/>
  <path d="M3 6.5 A5 5 0 0 0 13 6.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M10 5l3 2-3 2" fill="#fff"/>
</svg>`,

  /* Max (HBO) — purple with "M" */
  max: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="2" fill="#6E3FF3"/>
  <path d="M3 12V4h2l3 5 3-5h2v8h-1.8V7.2L9 11H7L4.8 7.2V12z" fill="#fff"/>
</svg>`,

  /* Crunchyroll — orange with stylised leaf/eye */
  crunchyroll: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="2" fill="#F47521"/>
  <circle cx="8" cy="8" r="5" fill="#fff"/>
  <circle cx="8" cy="8" r="3" fill="#F47521"/>
  <circle cx="9.5" cy="6.5" r="1.5" fill="#fff"/>
</svg>`,

  /* Disney+ — blue with castle-like "D+" */
  disneyplus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="2" fill="#113CCF"/>
  <text x="8" y="12" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#fff">D+</text>
</svg>`,

  /* Vimeo — teal/cyan with play triangle */
  vimeo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect width="16" height="16" rx="2" fill="#1AB7EA"/>
  <polygon points="6,4 6,12 13,8" fill="#fff"/>
</svg>`,
};

/**
 * Return the SVG for a given platform wrapped in a sized container element.
 * The returned HTML string can be injected via `.innerHTML`.
 *
 * @param platform - Target platform
 * @param size - CSS size in px (applied to width & height). Default 14.
 */
export function platformIconHtml(platform: Platform, size = 14): string {
  const svg = PLATFORM_ICONS[platform];
  return `<span class="platform-icon" style="width:${String(size)}px;height:${String(size)}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0" aria-hidden="true">${svg}</span>`;
}
