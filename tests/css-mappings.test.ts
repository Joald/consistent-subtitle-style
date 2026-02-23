import { describe, it, expect } from 'vitest';
import {
  generateCssRule,
  generateCombinedCssRules,
  CSS_SETTING_MAPPINGS,
} from '../src/css-mappings.js';
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
      expect(result).toBe('text-shadow: 4px 4px 4px rgba(0,0,0,0.9) !important;');
    });

    it('applies raised style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'raised');
      expect(result).toBe('text-shadow: 1px 1px 0px #222, -1px -1px 0px #fff !important;');
    });

    it('applies outline style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = generateCssRule(mapping, 'outline');
      expect(result).toBe(
        'text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000 !important;',
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

    it('returns passthrough for opacity percentage', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = generateCssRule(mapping, '50');
      expect(result).toBe('background-color: 50 !important;');
    });

    it('returns null for auto opacity value', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = generateCssRule(mapping, 'auto');
      expect(result).toBeNull();
    });
  });

  describe('generateCombinedCssRules', () => {
    it('combines color and opacity using color-mix for background', () => {
      const settings: Partial<Record<keyof StorageSettings, string>> = {
        backgroundColor: 'red',
        backgroundOpacity: '50',
      };
      const result = generateCombinedCssRules('background', settings);
      expect(result).toContain(
        'background-color: color-mix(in srgb, #f00, transparent 50%) !important;',
      );
    });

    it('handles auto opacity by using just color', () => {
      const settings: Partial<Record<keyof StorageSettings, string>> = {
        backgroundColor: 'blue',
        backgroundOpacity: 'auto',
      };
      const result = generateCombinedCssRules('background', settings);
      expect(result).toContain('background-color: #00f !important;');
    });

    it('handles missing color but present opacity by defaulting to black', () => {
      const settings: Partial<Record<keyof StorageSettings, string>> = {
        backgroundOpacity: '75',
      };
      const result = generateCombinedCssRules('background', settings);
      expect(result).toContain(
        'background-color: color-mix(in srgb, black, transparent 25%) !important;',
      );
    });
  });
});
