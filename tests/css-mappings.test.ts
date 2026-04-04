import { describe, it, expect } from 'vitest';
import {
  generateCssRule,
  generateCombinedCssRules,
  CSS_SETTING_MAPPINGS,
} from '../src/css-mappings.js';
import type { StorageSettings } from '../src/types/index.js';

describe('css-mappings', () => {
  describe('CSS_SETTING_MAPPINGS', () => {
    it('has mapping for every StorageSettings key', () => {
      const allKeys: (keyof StorageSettings)[] = [
        'characterEdgeStyle',
        'backgroundOpacity',
        'windowOpacity',
        'fontColor',
        'fontOpacity',
        'backgroundColor',
        'windowColor',
        'fontFamily',
        'fontSize',
      ];
      allKeys.forEach((key) => {
        expect(CSS_SETTING_MAPPINGS[key]).toBeDefined();
        expect(CSS_SETTING_MAPPINGS[key].property).toBeDefined();
        expect(CSS_SETTING_MAPPINGS[key].appliesTo).toMatch(/^(subtitle|background|window)$/);
      });
    });

    it('maps characterEdgeStyle to textShadow on subtitle', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;
      expect(mapping.property).toBe('textShadow');
      expect(mapping.appliesTo).toBe('subtitle');
      expect(mapping.valueMap).toBeDefined();
    });

    it('maps backgroundOpacity to backgroundColor on background with isOpacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundOpacity;
      expect(mapping.property).toBe('backgroundColor');
      expect(mapping.appliesTo).toBe('background');
      expect(mapping.isOpacity).toBe(true);
    });

    it('maps windowOpacity to backgroundColor on window with isOpacity', () => {
      const mapping = CSS_SETTING_MAPPINGS.windowOpacity;
      expect(mapping.property).toBe('backgroundColor');
      expect(mapping.appliesTo).toBe('window');
      expect(mapping.isOpacity).toBe(true);
    });

    it('maps fontColor to color on subtitle', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontColor;
      expect(mapping.property).toBe('color');
      expect(mapping.appliesTo).toBe('subtitle');
      expect(mapping.valueMap).toBeDefined();
    });

    it('maps fontOpacity to opacity on subtitle', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontOpacity;
      expect(mapping.property).toBe('opacity');
      expect(mapping.appliesTo).toBe('subtitle');
    });

    it('maps backgroundColor to backgroundColor on background', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundColor;
      expect(mapping.property).toBe('backgroundColor');
      expect(mapping.appliesTo).toBe('background');
      expect(mapping.valueMap).toBeDefined();
    });

    it('maps windowColor to backgroundColor on window', () => {
      const mapping = CSS_SETTING_MAPPINGS.windowColor;
      expect(mapping.property).toBe('backgroundColor');
      expect(mapping.appliesTo).toBe('window');
      expect(mapping.valueMap).toBeDefined();
    });

    it('maps fontFamily to fontFamily on subtitle', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontFamily;
      expect(mapping.property).toBe('fontFamily');
      expect(mapping.appliesTo).toBe('subtitle');
      expect(mapping.valueMap).toBeDefined();
    });

    it('maps fontSize to fontSize on subtitle', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontSize;
      expect(mapping.property).toBe('fontSize');
      expect(mapping.appliesTo).toBe('subtitle');
    });

    describe('color valueMaps are consistent across fontColor, backgroundColor, windowColor', () => {
      const colorKeys: (keyof StorageSettings)[] = ['fontColor', 'backgroundColor', 'windowColor'];
      const expectedColors = [
        'white',
        'yellow',
        'green',
        'cyan',
        'blue',
        'magenta',
        'red',
        'black',
      ];

      colorKeys.forEach((key) => {
        it(`${key} has all 8 standard color values`, () => {
          const mapping = CSS_SETTING_MAPPINGS[key];
          expectedColors.forEach((color) => {
            expect(mapping.valueMap?.[color]).toBeDefined();
            expect(mapping.valueMap?.[color]).toMatch(/^#[0-9a-f]{3}$/);
          });
        });
      });
    });

    describe('fontFamily valueMap covers all font types', () => {
      const expectedFonts = [
        'monospaced-serif',
        'proportional-serif',
        'monospaced-sans-serif',
        'proportional-sans-serif',
        'casual',
        'cursive',
        'small-caps',
      ];

      expectedFonts.forEach((font) => {
        it(`has mapping for ${font}`, () => {
          expect(CSS_SETTING_MAPPINGS.fontFamily.valueMap?.[font]).toBeDefined();
          expect(CSS_SETTING_MAPPINGS.fontFamily.valueMap?.[font]?.length).toBeGreaterThan(0);
        });
      });
    });

    describe('characterEdgeStyle valueMap covers all edge styles', () => {
      const expectedStyles = ['dropshadow', 'none', 'raised', 'depressed', 'outline', 'auto'];

      expectedStyles.forEach((style) => {
        it(`has mapping for ${style}`, () => {
          expect(CSS_SETTING_MAPPINGS.characterEdgeStyle.valueMap?.[style]).toBeDefined();
        });
      });
    });
  });

  describe('generateCssRule', () => {
    describe('characterEdgeStyle', () => {
      const mapping = CSS_SETTING_MAPPINGS.characterEdgeStyle;

      it('generates dropshadow with multi-layer shadow', () => {
        const result = generateCssRule(mapping, 'dropshadow');
        expect(result).toBe(
          'text-shadow: 2px 2px 3px rgba(0,0,0,1), 0px 0px 6px rgba(0,0,0,0.9), 1px 1px 8px rgba(0,0,0,0.8) !important;',
        );
      });

      it('generates raised style', () => {
        const result = generateCssRule(mapping, 'raised');
        expect(result).toBe('text-shadow: 1px 1px 0px #222, -1px -1px 0px #fff !important;');
      });

      it('generates depressed style', () => {
        const result = generateCssRule(mapping, 'depressed');
        expect(result).toBe('text-shadow: -1px -1px 0px #222, 1px 1px 0px #fff !important;');
      });

      it('generates outline with 8-direction shadow', () => {
        const result = generateCssRule(mapping, 'outline');
        expect(result).toBe(
          'text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000 !important;',
        );
      });

      it('generates none to remove shadows', () => {
        const result = generateCssRule(mapping, 'none');
        expect(result).toBe('text-shadow: none !important;');
      });

      it('returns null for auto (no override)', () => {
        const result = generateCssRule(mapping, 'auto');
        expect(result).toBeNull();
      });
    });

    describe('fontColor', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontColor;

      it.each([
        ['white', '#fff'],
        ['yellow', '#ff0'],
        ['green', '#0f0'],
        ['cyan', '#0ff'],
        ['blue', '#00f'],
        ['magenta', '#f0f'],
        ['red', '#f00'],
        ['black', '#000'],
      ])('maps %s to %s', (colorName, cssHex) => {
        const result = generateCssRule(mapping, colorName);
        expect(result).toBe(`color: ${cssHex} !important;`);
      });

      it('returns null for auto', () => {
        expect(generateCssRule(mapping, 'auto')).toBeNull();
      });
    });

    describe('backgroundColor', () => {
      const mapping = CSS_SETTING_MAPPINGS.backgroundColor;

      it.each([
        ['white', '#fff'],
        ['yellow', '#ff0'],
        ['green', '#0f0'],
        ['cyan', '#0ff'],
        ['blue', '#00f'],
        ['magenta', '#f0f'],
        ['red', '#f00'],
        ['black', '#000'],
      ])('maps %s to %s', (colorName, cssHex) => {
        const result = generateCssRule(mapping, colorName);
        expect(result).toBe(`background-color: ${cssHex} !important;`);
      });
    });

    describe('windowColor', () => {
      const mapping = CSS_SETTING_MAPPINGS.windowColor;

      it('maps white to #fff', () => {
        expect(generateCssRule(mapping, 'white')).toBe('background-color: #fff !important;');
      });

      it('maps black to #000', () => {
        expect(generateCssRule(mapping, 'black')).toBe('background-color: #000 !important;');
      });
    });

    describe('fontFamily', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontFamily;

      it('generates monospaced-serif with Courier New stack', () => {
        const result = generateCssRule(mapping, 'monospaced-serif');
        expect(result).toContain('font-family:');
        expect(result).toContain('Courier New');
        expect(result).toContain('monospace');
        expect(result).toContain('!important');
      });

      it('generates proportional-serif with Times New Roman stack', () => {
        const result = generateCssRule(mapping, 'proportional-serif');
        expect(result).toContain('Times New Roman');
        expect(result).toContain('serif');
      });

      it('generates monospaced-sans-serif with Lucida Console stack', () => {
        const result = generateCssRule(mapping, 'monospaced-sans-serif');
        expect(result).toContain('Lucida Console');
        expect(result).toContain('monospace');
      });

      it('generates proportional-sans-serif with Roboto/Arial stack', () => {
        const result = generateCssRule(mapping, 'proportional-sans-serif');
        expect(result).toContain('Roboto');
        expect(result).toContain('sans-serif');
      });

      it('generates casual with Comic Sans', () => {
        const result = generateCssRule(mapping, 'casual');
        expect(result).toContain('Comic Sans');
      });

      it('generates cursive with Monotype Corsiva', () => {
        const result = generateCssRule(mapping, 'cursive');
        expect(result).toContain('Monotype Corsiva');
      });

      it('generates small-caps with same font as proportional-sans-serif', () => {
        const result = generateCssRule(mapping, 'small-caps');
        expect(result).toContain('Roboto');
        expect(result).toContain('sans-serif');
      });

      it('returns null for auto', () => {
        expect(generateCssRule(mapping, 'auto')).toBeNull();
      });
    });

    describe('fontSize', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontSize;

      it('passes through percentage values as font-size', () => {
        const result = generateCssRule(mapping, '150%');
        expect(result).toBe('font-size: 150% !important;');
      });

      it('passes through 50% value', () => {
        expect(generateCssRule(mapping, '50%')).toBe('font-size: 50% !important;');
      });

      it('passes through 400% value', () => {
        expect(generateCssRule(mapping, '400%')).toBe('font-size: 400% !important;');
      });

      it('returns null for auto', () => {
        expect(generateCssRule(mapping, 'auto')).toBeNull();
      });
    });

    describe('opacity settings (direct generateCssRule)', () => {
      it('backgroundOpacity returns null for auto', () => {
        expect(generateCssRule(CSS_SETTING_MAPPINGS.backgroundOpacity, 'auto')).toBeNull();
      });

      it('windowOpacity returns null for auto', () => {
        expect(generateCssRule(CSS_SETTING_MAPPINGS.windowOpacity, 'auto')).toBeNull();
      });

      it('fontOpacity returns null for auto', () => {
        expect(generateCssRule(CSS_SETTING_MAPPINGS.fontOpacity, 'auto')).toBeNull();
      });

      it('fontOpacity passes through numeric value', () => {
        const result = generateCssRule(CSS_SETTING_MAPPINGS.fontOpacity, '75');
        expect(result).toBe('opacity: 75 !important;');
      });
    });
  });

  describe('generateCombinedCssRules', () => {
    describe('background: color + opacity combinations', () => {
      it('combines color red with 50% opacity using color-mix', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'red',
          backgroundOpacity: '50',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, #f00, transparent 50%) !important;',
        );
      });

      it('combines color blue with 100% opacity (0% transparent)', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'blue',
          backgroundOpacity: '100',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, #00f, transparent 0%) !important;',
        );
      });

      it('combines color green with 0% opacity (fully transparent)', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'green',
          backgroundOpacity: '0',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, #0f0, transparent 100%) !important;',
        );
      });

      it('combines color with 75% opacity', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'yellow',
          backgroundOpacity: '75',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, #ff0, transparent 25%) !important;',
        );
      });

      it('combines color with 25% opacity', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'cyan',
          backgroundOpacity: '25',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, #0ff, transparent 75%) !important;',
        );
      });

      it('uses just color when opacity is auto', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'blue',
          backgroundOpacity: 'auto',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('background-color: #00f !important;');
      });

      it('defaults to black when only opacity is set (no color)', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundOpacity: '75',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, black, transparent 25%) !important;',
        );
      });

      it('returns empty when both are auto', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'auto',
          backgroundOpacity: 'auto',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(0);
      });

      it('returns empty when no settings provided', () => {
        const result = generateCombinedCssRules('background', {});
        expect(result).toHaveLength(0);
      });
    });

    describe('window: color + opacity combinations', () => {
      it('combines window color and opacity', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          windowColor: 'black',
          windowOpacity: '80',
        };
        const result = generateCombinedCssRules('window', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, #000, transparent 20%) !important;',
        );
      });

      it('uses just window color when opacity is auto', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          windowColor: 'magenta',
          windowOpacity: 'auto',
        };
        const result = generateCombinedCssRules('window', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('background-color: #f0f !important;');
      });

      it('defaults to black when only window opacity is set', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          windowOpacity: '50',
        };
        const result = generateCombinedCssRules('window', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(
          'background-color: color-mix(in srgb, black, transparent 50%) !important;',
        );
      });

      it('returns empty when both window settings are auto', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          windowColor: 'auto',
          windowOpacity: 'auto',
        };
        const result = generateCombinedCssRules('window', settings);
        expect(result).toHaveLength(0);
      });
    });

    describe('subtitle: font color + opacity (special behavior)', () => {
      it('combines font color and opacity', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'yellow',
          fontOpacity: '75',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toContain('color: color-mix(in srgb, #ff0, transparent 25%) !important;');
      });

      it('uses just font color when opacity is auto', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'white',
          fontOpacity: 'auto',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toContain('color: #fff !important;');
      });

      it('does NOT default to black when only fontOpacity is set (preserves site default)', () => {
        // This is the critical difference from background/window:
        // Font Color auto + opacity set = emit NO color rule, preserving the site's
        // default text color (e.g. Nebula white).
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontOpacity: '75',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        // Should NOT contain any color rule — no fallback to black for fontColor
        expect(result).toHaveLength(0);
      });

      it('does NOT emit color rule when fontColor is explicitly auto with opacity set', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'auto',
          fontOpacity: '50',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toHaveLength(0);
      });
    });

    describe('subtitle: non-color settings', () => {
      it('generates character edge style rule', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          characterEdgeStyle: 'dropshadow',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toContain('text-shadow:');
        expect(result[0]).toContain('!important');
      });

      it('generates font family rule', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontFamily: 'proportional-sans-serif',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        // font-family + font-variant: normal = 2 rules
        expect(result).toHaveLength(2);
        expect(result[0]).toContain('font-family:');
        expect(result[0]).toContain('Roboto');
        expect(result[1]).toBe('font-variant: normal !important;');
      });

      it('generates font size rule', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontSize: '150%',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('font-size: 150% !important;');
      });

      it('skips auto character edge style', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          characterEdgeStyle: 'auto',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toHaveLength(0);
      });

      it('skips auto font family', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontFamily: 'auto',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toHaveLength(0);
      });

      it('skips auto font size', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontSize: 'auto',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        expect(result).toHaveLength(0);
      });
    });

    describe('subtitle: multiple settings combined', () => {
      it('combines font color, edge style, font family, and font size', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'yellow',
          fontOpacity: 'auto',
          characterEdgeStyle: 'outline',
          fontFamily: 'casual',
          fontSize: '200%',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        // Should have: color rule + textShadow + fontFamily + font-variant: normal + fontSize = 5 rules
        expect(result).toHaveLength(5);

        const joined = result.join(' ');
        expect(joined).toContain('color: #ff0 !important;');
        expect(joined).toContain('text-shadow:');
        expect(joined).toContain('font-family:');
        expect(joined).toContain('Comic Sans');
        expect(joined).toContain('font-size: 200% !important;');
      });

      it('combines font color+opacity with edge style and size', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'green',
          fontOpacity: '50',
          characterEdgeStyle: 'dropshadow',
          fontSize: '300%',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        // color-mix rule + textShadow + fontSize = 3 rules
        expect(result).toHaveLength(3);

        const joined = result.join(' ');
        expect(joined).toContain('color: color-mix(in srgb, #0f0, transparent 50%)');
        expect(joined).toContain('text-shadow:');
        expect(joined).toContain('font-size: 300%');
      });
    });

    describe('cross-appliesTo filtering', () => {
      it('ignores background settings when generating subtitle rules', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'red',
          backgroundOpacity: '50',
          characterEdgeStyle: 'outline',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        // Only characterEdgeStyle applies to subtitle
        expect(result).toHaveLength(1);
        expect(result[0]).toContain('text-shadow:');
      });

      it('ignores subtitle settings when generating background rules', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'yellow',
          characterEdgeStyle: 'dropshadow',
          backgroundColor: 'black',
          backgroundOpacity: '75',
        };
        const result = generateCombinedCssRules('background', settings);
        // Only backgroundColor + backgroundOpacity apply to background
        expect(result).toHaveLength(1);
        expect(result[0]).toContain('background-color:');
        expect(result[0]).not.toContain('text-shadow');
        // Ensure there's no standalone "color:" rule (font color) — only background-color
        expect(result[0]).not.toMatch(/(?<!background-)color:/);
        expect(result).toHaveLength(1);
      });

      it('ignores window settings when generating background rules', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          windowColor: 'blue',
          windowOpacity: '50',
          backgroundColor: 'red',
        };
        const result = generateCombinedCssRules('background', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('background-color: #f00 !important;');
      });

      it('ignores background settings when generating window rules', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          backgroundColor: 'red',
          backgroundOpacity: '50',
          windowColor: 'cyan',
        };
        const result = generateCombinedCssRules('window', settings);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('background-color: #0ff !important;');
      });
    });

    describe('edge cases', () => {
      it('handles completely empty settings for all appliesTo types', () => {
        expect(generateCombinedCssRules('subtitle', {})).toHaveLength(0);
        expect(generateCombinedCssRules('background', {})).toHaveLength(0);
        expect(generateCombinedCssRules('window', {})).toHaveLength(0);
      });

      it('handles all-auto settings', () => {
        const allAuto: Partial<Record<keyof StorageSettings, string>> = {
          characterEdgeStyle: 'auto',
          backgroundOpacity: 'auto',
          windowOpacity: 'auto',
          fontColor: 'auto',
          fontOpacity: 'auto',
          backgroundColor: 'auto',
          windowColor: 'auto',
          fontFamily: 'auto',
          fontSize: 'auto',
        };
        expect(generateCombinedCssRules('subtitle', allAuto)).toHaveLength(0);
        expect(generateCombinedCssRules('background', allAuto)).toHaveLength(0);
        expect(generateCombinedCssRules('window', allAuto)).toHaveLength(0);
      });

      it('handles all settings set to non-auto values for subtitle', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'white',
          fontOpacity: '100',
          characterEdgeStyle: 'outline',
          fontFamily: 'monospaced-serif',
          fontSize: '100%',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        // color-mix rule + textShadow + fontFamily + fontSize = 4 rules
        expect(result.length).toBeGreaterThanOrEqual(3);
        const joined = result.join(' ');
        expect(joined).toContain('color:');
        expect(joined).toContain('text-shadow:');
        expect(joined).toContain('font-family:');
        expect(joined).toContain('font-size:');
      });

      it('every generated rule ends with !important;', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'red',
          characterEdgeStyle: 'none',
          fontFamily: 'casual',
          fontSize: '200%',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        result.forEach((rule) => {
          expect(rule).toMatch(/!important;$/);
        });
      });
    });

    describe('small-caps font-variant handling', () => {
      it('emits font-variant: small-caps when fontFamily is small-caps', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontFamily: 'small-caps',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        const joined = result.join(' ');
        expect(joined).toContain('font-variant: small-caps !important;');
      });

      it('emits font-family rule alongside font-variant for small-caps', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontFamily: 'small-caps',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        const joined = result.join(' ');
        expect(joined).toContain('font-family:');
        expect(joined).toContain('Roboto');
      });

      it('emits font-variant: normal for non-small-caps fonts to reset any prior small-caps', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontFamily: 'casual',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        const joined = result.join(' ');
        expect(joined).toContain('font-variant: normal !important;');
      });

      it('does NOT emit font-variant when fontFamily is auto', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontColor: 'white',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        const joined = result.join(' ');
        expect(joined).not.toContain('font-variant');
      });

      it('combines small-caps font-variant with other subtitle settings', () => {
        const settings: Partial<Record<keyof StorageSettings, string>> = {
          fontFamily: 'small-caps',
          fontColor: 'yellow',
          characterEdgeStyle: 'outline',
        };
        const result = generateCombinedCssRules('subtitle', settings);
        const joined = result.join(' ');
        expect(joined).toContain('font-variant: small-caps !important;');
        expect(joined).toContain('font-family:');
        expect(joined).toContain('text-shadow:');
        expect(joined).toContain('color:');
      });
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('generateCssRule returns null for unknown CSS property (error path)', () => {
      const bogusMapping = {
        property: 'totallyBogusProperty' as keyof StorageSettings,
        appliesTo: 'subtitle' as const,
      };
      const result = generateCssRule(bogusMapping, 'red');
      expect(result).toBeNull();
    });

    it('generateCssRule returns null for empty string value', () => {
      const mapping = CSS_SETTING_MAPPINGS.fontColor;
      const result = generateCssRule(mapping, '');
      expect(result).toBeNull();
    });
  });
});
