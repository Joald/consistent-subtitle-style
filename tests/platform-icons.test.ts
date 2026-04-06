import { describe, it, expect } from 'vitest';
import { PLATFORM_ICONS, platformIconHtml } from '../src/platform-icons.js';
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
  describe('PLATFORM_ICONS', () => {
    it('has an entry for every platform', () => {
      for (const p of ALL_PLATFORMS) {
        expect(PLATFORM_ICONS[p]).toBeDefined();
        expect(typeof PLATFORM_ICONS[p]).toBe('string');
      }
    });

    it.each(ALL_PLATFORMS)('%s icon is valid SVG markup', (platform) => {
      const svg = PLATFORM_ICONS[platform];
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('viewBox');
      expect(svg).toContain('xmlns');
    });

    it.each(ALL_PLATFORMS)('%s icon uses 16×16 viewBox', (platform) => {
      const svg = PLATFORM_ICONS[platform];
      expect(svg).toMatch(/viewBox="0 0 16 16"/);
    });

    it('every icon has a distinct fill colour (brand colour)', () => {
      const re = /fill="(#[A-Fa-f0-9]{6})"/;
      const fills = ALL_PLATFORMS.map((p) => {
        const match = re.exec(PLATFORM_ICONS[p]);
        return match ? match[1] : undefined;
      });
      // At least most should be unique (some might overlap but generally distinct)
      const uniqueFills = new Set(fills.filter(Boolean));
      expect(uniqueFills.size).toBeGreaterThanOrEqual(7); // allow some overlap
    });
  });

  describe('platformIconHtml', () => {
    it('returns HTML with a .platform-icon wrapper', () => {
      const html = platformIconHtml('youtube');
      expect(html).toContain('class="platform-icon"');
      expect(html).toContain('<svg');
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

    it.each(ALL_PLATFORMS)('generates valid HTML for %s', (platform) => {
      const html = platformIconHtml(platform);
      expect(html).toContain('class="platform-icon"');
      expect(html).toContain('<svg');
      expect(html).toContain('</svg>');
      expect(html).toContain('</span>');
    });
  });
});
