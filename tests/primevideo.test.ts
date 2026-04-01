import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { primevideo } from '../src/platforms/primevideo.js';

describe('primevideo platform', () => {
  describe('platform detection', () => {
    it('detects primevideo.com', () => {
      vi.stubGlobal('location', { hostname: 'www.primevideo.com', pathname: '/' });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects primevideo.com without www', () => {
      vi.stubGlobal('location', { hostname: 'primevideo.com', pathname: '/' });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.com/gp/video', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.com',
        pathname: '/gp/video/detail/B08H7ZF8Y6',
      });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.co.uk/gp/video', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.co.uk',
        pathname: '/gp/video/detail/B08H7ZF8Y6',
      });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.de/gp/video', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.de',
        pathname: '/gp/video/offers',
      });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.co.jp/gp/video', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.co.jp',
        pathname: '/gp/video/detail/B09ABC123',
      });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('does NOT detect amazon.com without /gp/video path', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.com',
        pathname: '/dp/B08H7ZF8Y6',
      });
      expect(detectPlatform()).toBe('unknown');
    });

    it('does NOT detect amazon.com shopping pages', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.com',
        pathname: '/s?k=headphones',
      });
      expect(detectPlatform()).toBe('unknown');
    });
  });

  describe('platform config', () => {
    it('returns correct config for primevideo', () => {
      const config = getPlatformConfig('primevideo');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Prime Video');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('primevideo');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toBe('.atvwebplayersdk-captions-overlay');
      expect(config?.css?.selectors.subtitle).toBe('.atvwebplayersdk-captions-text');
      expect(config?.css?.selectors.background).toBe('.atvwebplayersdk-captions-region');
      expect(config?.css?.selectors.window).toBe('.atvwebplayersdk-captions-overlay');
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(primevideo.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(primevideo.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(primevideo.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS-only styling approach', () => {
    it('uses CSS selectors matching Prime Video player DOM structure', () => {
      // The atvwebplayersdk classes are stable and used by the Prime Video web player
      expect(primevideo.css?.selectors.subtitle).toContain('atvwebplayersdk-captions-text');
      expect(primevideo.css?.selectors.background).toContain('atvwebplayersdk-captions-region');
      expect(primevideo.css?.selectors.window).toContain('atvwebplayersdk-captions-overlay');
    });

    it('subtitle container selector targets the captions overlay', () => {
      expect(primevideo.css?.subtitleContainerSelector).toContain(
        'atvwebplayersdk-captions-overlay',
      );
    });

    it('does not define baseline CSS (no extra base styles needed)', () => {
      expect(primevideo.baselineCss).toBeUndefined();
    });
  });
});
