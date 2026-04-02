import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { netflix } from '../src/platforms/netflix.js';

describe('netflix platform', () => {
  describe('platform detection', () => {
    it('detects www.netflix.com', () => {
      vi.stubGlobal('location', { hostname: 'www.netflix.com', pathname: '/' });
      expect(detectPlatform()).toBe('netflix');
    });

    it('detects netflix.com without subdomain', () => {
      vi.stubGlobal('location', { hostname: 'netflix.com', pathname: '/' });
      expect(detectPlatform()).toBe('netflix');
    });

    it('detects netflix.com on watch page', () => {
      vi.stubGlobal('location', {
        hostname: 'www.netflix.com',
        pathname: '/watch/81508516',
      });
      expect(detectPlatform()).toBe('netflix');
    });

    it('detects netflix.com on browse page', () => {
      vi.stubGlobal('location', {
        hostname: 'www.netflix.com',
        pathname: '/browse',
      });
      expect(detectPlatform()).toBe('netflix');
    });

    it('detects netflix.com on title page', () => {
      vi.stubGlobal('location', {
        hostname: 'www.netflix.com',
        pathname: '/title/80232398',
      });
      expect(detectPlatform()).toBe('netflix');
    });

    it('does NOT detect unrelated domains containing "netflix"', () => {
      vi.stubGlobal('location', { hostname: 'netflix.fakesite.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('netflix');
    });
  });

  describe('platform config', () => {
    it('returns correct config for netflix', () => {
      const config = getPlatformConfig('netflix');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Netflix');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('netflix');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toBe('.player-timedtext');
      expect(config?.css?.selectors.subtitle).toBe('.player-timedtext-text-container span');
      expect(config?.css?.selectors.background).toBe('.player-timedtext-text-container');
      expect(config?.css?.selectors.window).toBe('.player-timedtext');
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(netflix.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(netflix.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(netflix.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS-only styling approach', () => {
    it('targets span elements inside text containers for subtitle styling', () => {
      expect(netflix.css?.selectors.subtitle).toContain('span');
      expect(netflix.css?.selectors.subtitle).toContain('player-timedtext-text-container');
    });

    it('targets text container for background styling', () => {
      expect(netflix.css?.selectors.background).toContain('player-timedtext-text-container');
      expect(netflix.css?.selectors.background).not.toContain('span');
    });

    it('targets main timedtext container for window styling', () => {
      expect(netflix.css?.selectors.window).toBe('.player-timedtext');
    });

    it('subtitle container selector targets the main player-timedtext element', () => {
      expect(netflix.css?.subtitleContainerSelector).toBe('.player-timedtext');
    });

    it('does not use shadow DOM (Netflix renders subtitles in the main document)', () => {
      expect(netflix.css?.shadowHost).toBeUndefined();
    });

    it('does not define baseline CSS (no extra base styles needed)', () => {
      expect(netflix.baselineCss).toBeUndefined();
    });

    it('subtitle and background selectors target different element levels', () => {
      // Subtitle targets spans (text), background targets the container
      expect(netflix.css?.selectors.subtitle).not.toBe(netflix.css?.selectors.background);
    });
  });
});
