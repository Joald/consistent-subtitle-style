import { describe, it, expect } from 'vitest';
import { PLATFORM_ICONS, platformIconHtml, faviconUrl } from '../src/platform-icons.js';
import type { Platform } from '../src/platforms/index.js';

const ALL_PLATFORMS: Platform[] = [
  'youtube',
  'netflix',
  'nebula',
  'dropout',
  'primevideo',
  'max',
  'crunchyroll',
  'disneyplus',
  'vimeo',
];

describe('platform-icons', () => {
  describe('PLATFORM_ICONS (legacy)', () => {
    it('has an entry for every platform', () => {
      for (const p of ALL_PLATFORMS) {
        expect(PLATFORM_ICONS[p]).toBeDefined();
        expect(typeof PLATFORM_ICONS[p]).toBe('string');
      }
    });
  });

  describe('faviconUrl', () => {
    it.each(ALL_PLATFORMS)('returns a Google favicon CDN URL for %s', (platform) => {
      const url = faviconUrl(platform);
      expect(url).toMatch(/^https:\/\/www\.google\.com\/s2\/favicons\?domain=/);
      expect(url).toContain('&sz=');
    });

    it('uses default size of 16', () => {
      const url = faviconUrl('youtube');
      expect(url).toContain('sz=16');
    });

    it('respects custom size', () => {
      const url = faviconUrl('youtube', 32);
      expect(url).toContain('sz=32');
    });

    it('maps youtube to youtube.com', () => {
      expect(faviconUrl('youtube')).toContain('domain=youtube.com');
    });

    it('maps dropout to dropout.tv', () => {
      expect(faviconUrl('dropout')).toContain('domain=dropout.tv');
    });

    it('maps nebula to nebula.tv', () => {
      expect(faviconUrl('nebula')).toContain('domain=nebula.tv');
    });

    it('each platform has a distinct domain', () => {
      const domains = ALL_PLATFORMS.map((p) => faviconUrl(p));
      const unique = new Set(domains);
      expect(unique.size).toBe(ALL_PLATFORMS.length);
    });
  });

  describe('platformIconHtml', () => {
    it('returns HTML with a .platform-icon wrapper', () => {
      const html = platformIconHtml('youtube');
      expect(html).toContain('class="platform-icon"');
      expect(html).toContain('<img');
    });

    it('uses default size of 14px', () => {
      const html = platformIconHtml('netflix');
      expect(html).toContain('width:14px');
      expect(html).toContain('height:14px');
    });

    it('respects custom size', () => {
      const html = platformIconHtml('nebula', 20);
      expect(html).toContain('width:20px');
      expect(html).toContain('height:20px');
    });

    it('includes aria-hidden for accessibility', () => {
      const html = platformIconHtml('dropout');
      expect(html).toContain('aria-hidden="true"');
    });

    it.each(ALL_PLATFORMS)('generates valid HTML with <img> for %s', (platform) => {
      const html = platformIconHtml(platform);
      expect(html).toContain('class="platform-icon"');
      expect(html).toContain('<img');
      expect(html).toContain('src="https://www.google.com/s2/favicons');
      expect(html).toContain('</span>');
    });

    it('uses sz=16 for small icons (size <= 16)', () => {
      const html = platformIconHtml('youtube', 12);
      expect(html).toContain('sz=16');
    });

    it('uses sz=32 for larger icons (size > 16)', () => {
      const html = platformIconHtml('youtube', 20);
      expect(html).toContain('sz=32');
    });
  });
});
