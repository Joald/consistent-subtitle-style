import { describe, it, expect } from 'vitest';
import { PLATFORM_DOCS, getPlatformDoc, getDocumentedPlatforms } from '../src/platform-docs.js';

const ALL_PLATFORMS = [
  'youtube',
  'nebula',
  'dropout',
  'primevideo',
  'max',
  'crunchyroll',
  'disneyplus',
  'netflix',
  'vimeo',
];

const EXPECTED_SETTINGS = [
  'Font color',
  'Font opacity',
  'Font family',
  'Font size',
  'Background color',
  'Background opacity',
  'Window color',
  'Window opacity',
  'Character edge style',
];

describe('platform-docs', () => {
  describe('PLATFORM_DOCS', () => {
    it('has documentation for all 9 platforms', () => {
      expect(Object.keys(PLATFORM_DOCS).sort()).toEqual(ALL_PLATFORMS.sort());
    });

    it.each(ALL_PLATFORMS)('%s has required fields', (platform) => {
      const doc = PLATFORM_DOCS[platform]!;
      expect(doc).toBeDefined();
      expect(doc.name).toBeTruthy();
      expect(doc.approach).toBeTruthy();
      expect(doc.supported).toBeInstanceOf(Array);
      expect(doc.supported.length).toBeGreaterThan(0);
      expect(doc.limitations).toBeInstanceOf(Array);
      expect(doc.limitations.length).toBeGreaterThan(0);
    });

    it.each(ALL_PLATFORMS)('%s lists all 9 supported settings', (platform) => {
      const doc = PLATFORM_DOCS[platform]!;
      expect(doc.supported).toEqual(EXPECTED_SETTINGS);
    });

    it('YouTube approach mentions native caption API', () => {
      const doc = PLATFORM_DOCS['youtube']!;
      expect(doc.approach).toContain('native');
      expect(doc.approach).toContain('setCaptionStyle');
    });

    it('Dropout approach mentions MutationObserver', () => {
      const doc = PLATFORM_DOCS['dropout']!;
      expect(doc.approach).toContain('MutationObserver');
    });

    it('Disney+ approach mentions Shadow DOM', () => {
      const doc = PLATFORM_DOCS['disneyplus']!;
      expect(doc.approach).toContain('Shadow DOM');
    });

    it('Netflix approach mentions Cadmium player', () => {
      const doc = PLATFORM_DOCS['netflix']!;
      expect(doc.approach).toContain('Cadmium');
    });

    it('Crunchyroll approach mentions Bitmovin', () => {
      const doc = PLATFORM_DOCS['crunchyroll']!;
      expect(doc.approach).toContain('Bitmovin');
    });

    it('Dropout has notes about Vimeo OTT', () => {
      const doc = PLATFORM_DOCS['dropout']!;
      expect(doc.notes).toBeDefined();
      expect(doc.notes!).toContain('Vimeo OTT');
    });

    it('CSS-only platforms mention transform: scale() limitation', () => {
      const cssOnly = [
        'nebula',
        'primevideo',
        'max',
        'crunchyroll',
        'disneyplus',
        'netflix',
        'vimeo',
      ];
      for (const platform of cssOnly) {
        const doc = PLATFORM_DOCS[platform]!;
        const hasScaleLimitation = doc.limitations.some((l) => l.includes('transform: scale()'));
        expect(hasScaleLimitation).toBe(true);
      }
    });
  });

  describe('getPlatformDoc()', () => {
    it('returns doc for a valid platform', () => {
      const doc = getPlatformDoc('youtube');
      expect(doc).toBeDefined();
      expect(doc!.name).toBe('YouTube');
    });

    it('returns undefined for an unknown platform', () => {
      expect(getPlatformDoc('twitch')).toBeUndefined();
    });

    it.each(ALL_PLATFORMS)('returns doc for %s', (platform) => {
      const doc = getPlatformDoc(platform);
      expect(doc).toBeDefined();
    });
  });

  describe('getDocumentedPlatforms()', () => {
    it('returns all 9 platform keys', () => {
      const platforms = getDocumentedPlatforms();
      expect(platforms.sort()).toEqual(ALL_PLATFORMS.sort());
    });

    it('returns an array of strings', () => {
      const platforms = getDocumentedPlatforms();
      for (const p of platforms) {
        expect(typeof p).toBe('string');
      }
    });
  });
});
