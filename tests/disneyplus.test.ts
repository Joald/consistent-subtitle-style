import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { disneyplus } from '../src/platforms/disneyplus.js';

describe('disneyplus platform', () => {
  describe('platform detection', () => {
    it('detects www.disneyplus.com', () => {
      vi.stubGlobal('location', { hostname: 'www.disneyplus.com', pathname: '/' });
      expect(detectPlatform()).toBe('disneyplus');
    });

    it('detects disneyplus.com without subdomain', () => {
      vi.stubGlobal('location', { hostname: 'disneyplus.com', pathname: '/' });
      expect(detectPlatform()).toBe('disneyplus');
    });

    it('detects disneyplus.com on video page', () => {
      vi.stubGlobal('location', {
        hostname: 'www.disneyplus.com',
        pathname: '/video/some-movie-id',
      });
      expect(detectPlatform()).toBe('disneyplus');
    });

    it('detects regional subdomain (e.g. en-gb.disneyplus.com)', () => {
      vi.stubGlobal('location', { hostname: 'en-gb.disneyplus.com', pathname: '/' });
      expect(detectPlatform()).toBe('disneyplus');
    });

    it('does NOT detect unrelated domains containing "disneyplus"', () => {
      vi.stubGlobal('location', { hostname: 'disneyplus.fakesite.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('disneyplus');
    });

    it('does NOT detect disney.com (not the streaming service)', () => {
      vi.stubGlobal('location', { hostname: 'www.disney.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('disneyplus');
    });
  });

  describe('platform config', () => {
    it('returns correct config for disneyplus', () => {
      const config = getPlatformConfig('disneyplus');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Disney+');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('disneyplus');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toContain('dss-subtitle-renderer-cue');
      expect(config?.css?.subtitleContainerSelector).toContain('hive-subtitle-renderer-cue');
    });

    it('has shadow host defined for disney-web-player', () => {
      const config = getPlatformConfig('disneyplus');
      expect(config?.css?.shadowHost).toBe('disney-web-player');
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(disneyplus.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(disneyplus.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(disneyplus.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS selectors', () => {
    it('targets DSS subtitle renderer cue children for text styling', () => {
      expect(disneyplus.css?.selectors.subtitle).toContain('.dss-subtitle-renderer-cue > span');
    });

    it('targets Hive subtitle renderer cue children for text styling', () => {
      expect(disneyplus.css?.selectors.subtitle).toContain('.hive-subtitle-renderer-cue > span');
    });

    it('uses same selector for subtitle and background (spans contain both text and bg)', () => {
      expect(disneyplus.css?.selectors.subtitle).toBe(disneyplus.css?.selectors.background);
    });

    it('targets cue containers for window styling', () => {
      expect(disneyplus.css?.selectors.window).toContain('.dss-subtitle-renderer-cue');
      expect(disneyplus.css?.selectors.window).toContain('.hive-subtitle-renderer-cue');
    });

    it('window selector targets the cue element, not its children', () => {
      // Window = the overall container, not the per-line spans
      expect(disneyplus.css?.selectors.window).not.toContain('> span');
    });

    it('subtitle container selector matches both renderer variants', () => {
      const container = disneyplus.css?.subtitleContainerSelector ?? '';
      expect(container).toContain('.dss-subtitle-renderer-cue');
      expect(container).toContain('.hive-subtitle-renderer-cue');
    });
  });

  describe('shadow DOM support', () => {
    it('defines shadowHost as disney-web-player custom element', () => {
      expect(disneyplus.css?.shadowHost).toBe('disney-web-player');
    });

    it('shadowHost is a valid custom element tag name', () => {
      // Custom elements must contain a hyphen
      expect(disneyplus.css?.shadowHost).toContain('-');
    });

    it('is the only platform with shadow DOM support currently', () => {
      // Verify other platforms don't accidentally have shadowHost set
      const otherPlatforms = ['youtube', 'nebula', 'dropout', 'primevideo', 'max', 'crunchyroll'];
      for (const platform of otherPlatforms) {
        const config = getPlatformConfig(platform as Parameters<typeof getPlatformConfig>[0]);
        expect(config?.css?.shadowHost).toBeUndefined();
      }
    });
  });

  describe('registered in platform registry', () => {
    it('is present in PLATFORMS map', () => {
      const config = getPlatformConfig('disneyplus');
      expect(config).toBeDefined();
      expect(config).toBe(disneyplus);
    });
  });
});
