import { describe, it, expect } from 'vitest';
import { generateCssRule, CSS_SETTING_MAPPINGS } from '../src/css-mappings.js';
import type { StorageSettings } from '../src/types/index.js';

describe('css-mappings', () => {
  describe('CSS_SETTING_MAPPINGS', () => {
    it('has mapping for characterEdgeStyle', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      expect(mapping.property).toBe('textShadow');
      expect(mapping.appliesTo).toBe('subtitle');
      expect(mapping.valueMap).toBeDefined();
    });

    it('has mapping for backgroundOpacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      expect(mapping.property).toBe('backgroundColor');
      expect(mapping.appliesTo).toBe('background');
      expect(mapping.isOpacity).toBe(true);
    });

    it('has mapping for windowOpacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.windowOpacity;
      expect(mapping.property).toBe('backgroundColor');
      expect(mapping.appliesTo).toBe('window');
      expect(mapping.isOpacity).toBe(true);
    });

    it('has mapping for all StorageSettings keys', () => {
      const keys: (keyof StorageSettings)[] = [
        'characterEdgeStyle',
        'backgroundOpacity',
        'windowOpacity',
      ];
      keys.forEach((key) => {
        expect(CSS_SETTING_MAPPINGS[key]).toBeDefined();
        expect(CSS_SETTING_MAPPINGS[key].property).toBeDefined();
        expect(CSS_SETTING_MAPPINGS[key].appliesTo).toMatch(/subtitle|background|window/);
      });
    });
  });

  describe('generateCssRule', () => {
    it('applies textShadow for characterEdgeStyle dropshadow', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'dropshadow');
      expect(result).toBe('text-shadow: 2px 2px 4px rgba(0,0,0,0.95) !important;');
    });

    it('applies raised style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'raised');
      expect(result).toBe(
        'text-shadow: -1px -1px 1px rgba(255,255,255,0.5), 1px -1px 1px rgba(255,255,255,0.5), -1px 1px 1px rgba(255,255,255,0.5), 1px 1px 1px rgba(255,255,255,0.5) !important;',
      );
    });

    it('applies outline style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'outline');
      expect(result).toBe(
        'text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000 !important;',
      );
    });

    it('applies none style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'none');
      expect(result).toBe('text-shadow: none !important;');
    });

    it('returns null for auto value', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'auto');
      expect(result).toBeNull();
    });

    it('converts opacity percentage to rgba', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = generateCssRule(mapping, '50');
      expect(result).toBe('background-color: rgba(0, 0, 0, 0.5) !important;');
    });

    it('handles 0 opacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = generateCssRule(mapping, '0');
      expect(result).toBe('background-color: rgba(0, 0, 0, 0) !important;');
    });

    it('handles 100 opacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = generateCssRule(mapping, '100');
      expect(result).toMatch(/background-color:\s*rgba?\(0,\s*0,\s*0(,\s*1)?\)\s*!important;/);
    });

    it('returns null for auto opacity value', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = generateCssRule(mapping, 'auto');
      expect(result).toBeNull();
    });
  });
});
