import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { vimeo } from '../src/platforms/vimeo.js';

describe('vimeo platform', () => {
  describe('platform detection', () => {
    it('detects www.vimeo.com', () => {
      vi.stubGlobal('location', { hostname: 'www.vimeo.com', pathname: '/' });
      expect(detectPlatform()).toBe('vimeo');
    });

    it('detects vimeo.com without subdomain', () => {
      vi.stubGlobal('location', { hostname: 'vimeo.com', pathname: '/' });
      expect(detectPlatform()).toBe('vimeo');
    });

    it('detects player.vimeo.com (embed player)', () => {
      vi.stubGlobal('location', { hostname: 'player.vimeo.com', pathname: '/video/123456789' });
      expect(detectPlatform()).toBe('vimeo');
    });

    it('detects vimeo.com on video watch page', () => {
      vi.stubGlobal('location', { hostname: 'vimeo.com', pathname: '/824804225' });
      expect(detectPlatform()).toBe('vimeo');
    });

    it('detects vimeo.com on channel page', () => {
      vi.stubGlobal('location', { hostname: 'vimeo.com', pathname: '/channels/staffpicks/123456' });
      expect(detectPlatform()).toBe('vimeo');
    });

    it('does NOT detect unrelated domains containing "vimeo"', () => {
      vi.stubGlobal('location', { hostname: 'vimeo.fakesite.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('vimeo');
    });

    it('does NOT detect vimeocdn.com', () => {
      vi.stubGlobal('location', { hostname: 'f.vimeocdn.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('vimeo');
    });
  });

  describe('platform config', () => {
    it('returns correct config for vimeo', () => {
      const config = getPlatformConfig('vimeo');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Vimeo');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('vimeo');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toBe('.vp-captions');
      expect(config?.css?.selectors.subtitle).toBe('.vp-captions');
      expect(config?.css?.selectors.background).toBe('.vp-captions > span');
      expect(config?.css?.selectors.window).toBe('.vp-captions');
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(vimeo.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(vimeo.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(vimeo.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS-only styling approach', () => {
    it('targets vp-captions container for text styling', () => {
      expect(vimeo.css?.selectors.subtitle).toBe('.vp-captions');
    });

    it('targets inner span for background styling', () => {
      expect(vimeo.css?.selectors.background).toBe('.vp-captions > span');
    });

    it('targets vp-captions container for window styling', () => {
      expect(vimeo.css?.selectors.window).toBe('.vp-captions');
    });

    it('subtitle container selector targets vp-captions', () => {
      expect(vimeo.css?.subtitleContainerSelector).toBe('.vp-captions');
    });

    it('does not use Shadow DOM', () => {
      expect(vimeo.css?.shadowHost).toBeUndefined();
    });

    it('does not define baseline CSS', () => {
      expect(vimeo.baselineCss).toBeUndefined();
    });

    it('subtitle and window selectors match (styling on same container)', () => {
      expect(vimeo.css?.selectors.subtitle).toBe(vimeo.css?.selectors.window);
    });

    it('background selector is distinct from subtitle selector', () => {
      expect(vimeo.css?.selectors.background).not.toBe(vimeo.css?.selectors.subtitle);
    });
  });
});
