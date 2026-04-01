import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { nebula } from '../src/platforms/nebula.js';

describe('nebula platform', () => {
  describe('platform detection', () => {
    it('detects nebula.tv', () => {
      vi.stubGlobal('location', { hostname: 'nebula.tv', pathname: '/' });
      expect(detectPlatform()).toBe('nebula');
    });

    it('detects www.nebula.tv', () => {
      vi.stubGlobal('location', { hostname: 'www.nebula.tv', pathname: '/' });
      expect(detectPlatform()).toBe('nebula');
    });

    it('detects subdomains of nebula.tv', () => {
      vi.stubGlobal('location', { hostname: 'watch.nebula.tv', pathname: '/' });
      expect(detectPlatform()).toBe('nebula');
    });

    it('does NOT detect unrelated domains containing "nebula"', () => {
      vi.stubGlobal('location', { hostname: 'www.nebulasoftware.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('nebula');
    });
  });

  describe('platform config', () => {
    it('returns correct config for nebula', () => {
      const config = getPlatformConfig('nebula');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Nebula');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('nebula');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toBe(
        '#video-player [data-subtitles-container]',
      );
      expect(config?.css?.selectors.subtitle).toBe(
        '#video-player [data-subtitles-container] > div > div > div',
      );
      expect(config?.css?.selectors.window).toBe(
        '#video-player [data-subtitles-container] > div > div',
      );
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(nebula.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(nebula.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(nebula.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS-only styling approach', () => {
    it('uses CSS selectors targeting Nebula video player subtitle DOM', () => {
      expect(nebula.css?.selectors.subtitle).toContain('data-subtitles-container');
      expect(nebula.css?.selectors.background).toContain('data-subtitles-container');
      expect(nebula.css?.selectors.window).toContain('data-subtitles-container');
    });

    it('subtitle and background selectors target the same element', () => {
      // Nebula subtitle text and background are the same DOM element
      expect(nebula.css?.selectors.subtitle).toBe(nebula.css?.selectors.background);
    });

    it('window selector is one level above subtitle/background', () => {
      // Window is the parent div of the subtitle text div
      const subtitleParts = nebula.css?.selectors.subtitle.split(' > ') ?? [];
      const windowParts = nebula.css?.selectors.window.split(' > ') ?? [];
      expect(windowParts.length).toBe(subtitleParts.length - 1);
    });

    it('defines baseline CSS with font-weight bold', () => {
      expect(nebula.baselineCss).toBeDefined();
      expect(nebula.baselineCss?.subtitle).toContain('font-weight: bold');
    });

    it('baseline CSS only applies to subtitle, not background or window', () => {
      expect(nebula.baselineCss?.subtitle).toBeDefined();
      expect(nebula.baselineCss?.background).toBeUndefined();
      expect(nebula.baselineCss?.window).toBeUndefined();
    });
  });
});
