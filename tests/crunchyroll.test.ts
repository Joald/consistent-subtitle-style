import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { crunchyroll } from '../src/platforms/crunchyroll.js';

describe('crunchyroll platform', () => {
  describe('platform detection', () => {
    it('detects www.crunchyroll.com', () => {
      vi.stubGlobal('location', { hostname: 'www.crunchyroll.com', pathname: '/' });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    it('detects crunchyroll.com without subdomain', () => {
      vi.stubGlobal('location', { hostname: 'crunchyroll.com', pathname: '/' });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    it('detects beta.crunchyroll.com', () => {
      vi.stubGlobal('location', { hostname: 'beta.crunchyroll.com', pathname: '/' });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    it('detects crunchyroll.com on watch page', () => {
      vi.stubGlobal('location', {
        hostname: 'www.crunchyroll.com',
        pathname: '/watch/G5PH0VQ1K/episode-title',
      });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    it('does NOT detect unrelated domains containing "crunchyroll"', () => {
      vi.stubGlobal('location', { hostname: 'crunchyroll.fakesite.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('crunchyroll');
    });
  });

  describe('platform config', () => {
    it('returns correct config for crunchyroll', () => {
      const config = getPlatformConfig('crunchyroll');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Crunchyroll');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('crunchyroll');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toBe('.bmpui-ui-subtitle-overlay');
      expect(config?.css?.selectors.subtitle).toBe('.bmpui-ui-subtitle-label');
      expect(config?.css?.selectors.background).toBe('.bmpui-ui-subtitle-label');
      expect(config?.css?.selectors.window).toBe('.bmpui-ui-subtitle-overlay');
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(crunchyroll.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(crunchyroll.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(crunchyroll.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS-only styling approach', () => {
    it('targets Bitmovin player subtitle label for text styling', () => {
      expect(crunchyroll.css?.selectors.subtitle).toContain('bmpui');
      expect(crunchyroll.css?.selectors.subtitle).toContain('subtitle-label');
    });

    it('uses same element for subtitle and background (Bitmovin labels combine both)', () => {
      expect(crunchyroll.css?.selectors.subtitle).toBe(crunchyroll.css?.selectors.background);
    });

    it('targets Bitmovin subtitle overlay for window styling', () => {
      expect(crunchyroll.css?.selectors.window).toContain('subtitle-overlay');
    });

    it('subtitle container selector targets the overlay', () => {
      expect(crunchyroll.css?.subtitleContainerSelector).toContain('subtitle-overlay');
    });

    it('does not define baseline CSS (no extra base styles needed)', () => {
      expect(crunchyroll.baselineCss).toBeUndefined();
    });
  });
});
