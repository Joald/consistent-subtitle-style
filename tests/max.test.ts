import { describe, it, expect, vi } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { max } from '../src/platforms/max.js';

describe('max platform', () => {
  describe('platform detection', () => {
    it('detects play.max.com', () => {
      vi.stubGlobal('location', { hostname: 'play.max.com', pathname: '/' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects www.max.com', () => {
      vi.stubGlobal('location', { hostname: 'www.max.com', pathname: '/' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects max.com without subdomain', () => {
      vi.stubGlobal('location', { hostname: 'max.com', pathname: '/' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects play.hbomax.com (legacy domain)', () => {
      vi.stubGlobal('location', { hostname: 'play.hbomax.com', pathname: '/' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects www.hbomax.com (legacy domain)', () => {
      vi.stubGlobal('location', { hostname: 'www.hbomax.com', pathname: '/' });
      expect(detectPlatform()).toBe('max');
    });

    it('does NOT detect unrelated domains containing "max"', () => {
      vi.stubGlobal('location', { hostname: 'www.maxpreps.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('max');
    });

    it('does NOT detect domains ending with max.com as substring', () => {
      vi.stubGlobal('location', { hostname: 'www.climax.com', pathname: '/' });
      expect(detectPlatform()).not.toBe('max');
    });
  });

  describe('platform config', () => {
    it('returns correct config for max', () => {
      const config = getPlatformConfig('max');
      expect(config).not.toBeNull();
      expect(config?.name).toBe('Max');
    });

    it('has CSS selectors defined', () => {
      const config = getPlatformConfig('max');
      expect(config?.css).toBeDefined();
      expect(config?.css?.subtitleContainerSelector).toBe('[class^="CaptionWindow"]');
      expect(config?.css?.selectors.subtitle).toBe('[class^="TextCue"]');
      expect(config?.css?.selectors.background).toBe('[data-testid="CueBoxContainer"]');
      expect(config?.css?.selectors.window).toBe('[class^="CaptionWindow"]');
    });

    it('has no native settings (CSS-only approach)', () => {
      expect(max.nativeSettings).toBeUndefined();
    });

    it('detectNativeCapabilities returns false', () => {
      expect(max.detectNativeCapabilities?.()).toBe(false);
    });

    it('getCurrentNativeSettings returns null', () => {
      expect(max.getCurrentNativeSettings?.()).toBeNull();
    });
  });

  describe('CSS-only styling approach', () => {
    it('uses CSS selectors matching Max player subtitle DOM structure', () => {
      // Max uses class names starting with "TextCue" for subtitle text
      expect(max.css?.selectors.subtitle).toContain('TextCue');
      // CueBoxContainer is the data-testid for the cue box
      expect(max.css?.selectors.background).toContain('CueBoxContainer');
      // CaptionWindow is the outer container class prefix
      expect(max.css?.selectors.window).toContain('CaptionWindow');
    });

    it('subtitle container selector targets the CaptionWindow', () => {
      expect(max.css?.subtitleContainerSelector).toContain('CaptionWindow');
    });

    it('does not define baseline CSS (no extra base styles needed)', () => {
      expect(max.baselineCss).toBeUndefined();
    });
  });
});
