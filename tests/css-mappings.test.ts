import { describe, it, expect, beforeEach } from 'vitest';
import { applyCssSetting, CSS_SETTING_MAPPINGS } from '../src/css-mappings.js';
import type { StorageSettings } from '../src/types/index.js';

describe('css-mappings', () => {
  let container: HTMLDivElement;
  let subtitle: HTMLSpanElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'subtitle-container';
    subtitle = document.createElement('span');
    subtitle.className = 'subtitle-text';
    container.appendChild(subtitle);
    document.body.appendChild(container);
  });

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
      const keys: (keyof StorageSettings)[] = ['characterEdgeStyle', 'backgroundOpacity', 'windowOpacity'];
      keys.forEach(key => {
        expect(CSS_SETTING_MAPPINGS[key]).toBeDefined();
        expect(CSS_SETTING_MAPPINGS[key].property).toBeDefined();
        expect(CSS_SETTING_MAPPINGS[key].appliesTo).toMatch(/subtitle|background|window/);
      });
    });
  });

  describe('applyCssSetting', () => {
    it('applies textShadow for characterEdgeStyle', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'dropshadow'
      );

      expect(result.success).toBe(true);
      expect(subtitle.style.textShadow).toBe('2px 2px 4px rgba(0,0,0,0.95)');
    });

    it('applies raised style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'raised'
      );

      expect(result.success).toBe(true);
      expect(subtitle.style.textShadow).toBe('-1px -1px 1px rgba(255,255,255,0.5), 1px -1px 1px rgba(255,255,255,0.5), -1px 1px 1px rgba(255,255,255,0.5), 1px 1px 1px rgba(255,255,255,0.5)');
    });

    it('applies outline style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'outline'
      );

      expect(result.success).toBe(true);
      expect(subtitle.style.textShadow).toBe('-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000');
    });

    it('applies none style', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'dropshadow'
      );
      expect(subtitle.style.textShadow).not.toBe('');

      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'none'
      );
      expect(subtitle.style.textShadow).toBe('none');
    });

    it('clears style for auto value', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'dropshadow'
      );
      expect(subtitle.style.textShadow).not.toBe('');

      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'auto'
      );
      expect(subtitle.style.textShadow).toBe('');
    });

    it('converts opacity percentage to rgba', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      const result = applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        '50'
      );

      expect(result.success).toBe(true);
      expect(subtitle.style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('handles 0 opacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        '0'
      );
      expect(subtitle.style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it('handles 100 opacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        '100'
      );
      expect(subtitle.style.backgroundColor).toMatch(/rgba?\(0,\s*0,\s*0(,\s*1)?\)/);
    });

    it('clears opacity for auto value', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        '50'
      );
      expect(subtitle.style.backgroundColor).not.toBe('');

      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'auto'
      );
      expect(subtitle.style.backgroundColor).toBe('');
    });

    it('applies window style to parent element', () => {
      const mapping = CSS_SETTING_MAPPINGS.windowOpacity;
      applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        '75'
      );

      expect(container.style.backgroundColor).toBe('rgba(0, 0, 0, 0.75)');
      expect(subtitle.style.backgroundColor).toBe('');
    });

    it('returns success message with property and value', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = applyCssSetting(
        document.querySelectorAll('.subtitle-text'),
        mapping,
        'dropshadow'
      );

      expect(result.message).toContain('textShadow');
      expect(result.message).toContain('2px 2px 4px rgba(0,0,0,0.95)');
    });

    it('handles empty NodeList gracefully', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      const result = applyCssSetting(
        document.querySelectorAll('.nonexistent'),
        mapping,
        'dropshadow'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Applied');
    });
  });
});
