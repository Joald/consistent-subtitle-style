import { describe, it, expect } from 'vitest';
import { getAvailablePresets, getPresetById, detectActivePreset } from '../src/presets.js';
import type { CustomPreset } from '../src/custom-presets.js';

import type { StorageSettings } from '../src/types/index.js';

const ALL_AUTO: StorageSettings = {
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

describe('presets', () => {
  describe('getAvailablePresets', () => {
    it('returns only production presets when isDev is false', () => {
      const presets = getAvailablePresets(false);
      expect(presets.length).toBe(3);
      expect(presets.map((p) => p.id)).toEqual(['recommended', 'classic', 'minimal']);
      expect(presets.every((p) => !p.devOnly)).toBe(true);
    });

    it('returns production + dev presets when isDev is true', () => {
      const presets = getAvailablePresets(true);
      expect(presets.length).toBe(9); // 3 production + 6 dev
      const devPresets = presets.filter((p) => p.devOnly);
      expect(devPresets.length).toBe(6);
    });

    it('production presets come before dev presets', () => {
      const presets = getAvailablePresets(true);
      const firstDevIndex = presets.findIndex((p) => p.devOnly);
      const lastProdIndex =
        presets.length - 1 - [...presets].reverse().findIndex((p) => !p.devOnly);
      expect(firstDevIndex).toBeGreaterThan(lastProdIndex);
    });

    it('recommended preset is marked', () => {
      const presets = getAvailablePresets(false);
      const recommended = presets.find((p) => p.isRecommended);
      expect(recommended).toBeDefined();
      expect(recommended!.id).toBe('recommended');
    });
  });

  describe('getPresetById', () => {
    it('finds production presets', () => {
      const preset = getPresetById('recommended');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('Recommended');
    });

    it('finds dev presets', () => {
      const preset = getPresetById('dev-colorful');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('Colorful');
    });

    it('returns undefined for unknown id', () => {
      expect(getPresetById('nonexistent')).toBeUndefined();
    });
  });

  describe('detectActivePreset', () => {
    it('detects recommended preset', () => {
      const settings: StorageSettings = {
        ...ALL_AUTO,
        characterEdgeStyle: 'dropshadow',
        backgroundOpacity: '0',
        windowOpacity: '0',
        fontFamily: 'proportional-sans-serif',
      };
      expect(detectActivePreset(settings, false)).toBe('recommended');
    });

    it('detects classic preset', () => {
      const settings: StorageSettings = {
        ...ALL_AUTO,
        fontColor: 'white',
        backgroundColor: 'black',
        backgroundOpacity: '75',
        characterEdgeStyle: 'none',
      };
      expect(detectActivePreset(settings, false)).toBe('classic');
    });

    it('detects minimal preset (all auto)', () => {
      expect(detectActivePreset({ ...ALL_AUTO }, false)).toBe('minimal');
    });

    it('returns null for custom settings', () => {
      const settings: StorageSettings = {
        ...ALL_AUTO,
        fontColor: 'cyan',
        fontSize: '200%',
      };
      expect(detectActivePreset(settings, false)).toBeNull();
    });

    it('detects dev presets when isDev is true', () => {
      const preset = getPresetById('dev-everything');
      expect(preset).toBeDefined();
      const result = detectActivePreset(preset!.settings, true);
      expect(result).toBe('dev-everything');
    });

    it('does not detect dev presets when isDev is false', () => {
      const preset = getPresetById('dev-everything');
      expect(preset).toBeDefined();
      // dev-everything settings don't match any prod preset
      const result = detectActivePreset(preset!.settings, false);
      expect(result).toBeNull();
    });
  });

  describe('preset settings integrity', () => {
    it('every preset has all StorageSettings keys', () => {
      const requiredKeys = Object.keys(ALL_AUTO) as (keyof StorageSettings)[];
      const presets = getAvailablePresets(true);
      for (const preset of presets) {
        for (const key of requiredKeys) {
          expect(preset.settings[key], `${preset.id} missing ${key}`).toBeDefined();
        }
      }
    });

    it('recommended preset has dropshadow + sans-serif + 0% bg/window', () => {
      const preset = getPresetById('recommended');
      expect(preset!.settings.characterEdgeStyle).toBe('dropshadow');
      expect(preset!.settings.fontFamily).toBe('proportional-sans-serif');
      expect(preset!.settings.backgroundOpacity).toBe('0');
      expect(preset!.settings.windowOpacity).toBe('0');
    });

    it('all preset ids are unique', () => {
      const presets = getAvailablePresets(true);
      const ids = presets.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('dev presets all have devOnly: true', () => {
      const presets = getAvailablePresets(true);
      const devPresets = presets.filter((p) => p.id.startsWith('dev-'));
      expect(devPresets.length).toBe(6);
      expect(devPresets.every((p) => p.devOnly)).toBe(true);
    });
  });

  describe('custom presets integration', () => {
    const customPresets: CustomPreset[] = [
      {
        id: 'custom-1',
        name: 'My Cinema',
        settings: { ...ALL_AUTO, fontColor: 'cyan', fontSize: '200%' },
      },
      {
        id: 'custom-2',
        name: 'My Reading',
        settings: { ...ALL_AUTO, fontFamily: 'monospaced-serif', characterEdgeStyle: 'outline' },
      },
    ];

    describe('getAvailablePresets with custom presets', () => {
      it('includes custom presets between production and dev', () => {
        const presets = getAvailablePresets(true, customPresets);
        // 3 production + 2 custom + 6 dev = 11
        expect(presets.length).toBe(11);
      });

      it('includes custom presets after production in non-dev mode', () => {
        const presets = getAvailablePresets(false, customPresets);
        // 3 production + 2 custom = 5
        expect(presets.length).toBe(5);
        expect(presets[3]!.id).toBe('custom-1');
        expect(presets[4]!.id).toBe('custom-2');
      });

      it('marks custom presets with isCustom: true', () => {
        const presets = getAvailablePresets(false, customPresets);
        const custom = presets.filter((p) => p.isCustom);
        expect(custom.length).toBe(2);
        expect(custom[0]!.name).toBe('My Cinema');
      });

      it('custom presets come before dev presets', () => {
        const presets = getAvailablePresets(true, customPresets);
        const firstCustomIdx = presets.findIndex((p) => p.isCustom);
        const firstDevIdx = presets.findIndex((p) => p.devOnly);
        expect(firstCustomIdx).toBeLessThan(firstDevIdx);
      });

      it('returns normal results when customPresets is undefined', () => {
        const presets = getAvailablePresets(false, undefined);
        expect(presets.length).toBe(3);
      });

      it('returns normal results when customPresets is empty', () => {
        const presets = getAvailablePresets(false, []);
        expect(presets.length).toBe(3);
      });
    });

    describe('getPresetById with custom presets', () => {
      it('finds custom presets by id', () => {
        const preset = getPresetById('custom-1', customPresets);
        expect(preset).toBeDefined();
        expect(preset!.name).toBe('My Cinema');
        expect(preset!.isCustom).toBe(true);
      });

      it('still finds built-in presets', () => {
        const preset = getPresetById('recommended', customPresets);
        expect(preset).toBeDefined();
        expect(preset!.name).toBe('Recommended');
      });

      it('still finds dev presets', () => {
        const preset = getPresetById('dev-colorful', customPresets);
        expect(preset).toBeDefined();
      });

      it('returns undefined for unknown id', () => {
        expect(getPresetById('nonexistent', customPresets)).toBeUndefined();
      });

      it('prioritizes built-in over custom if ids clash', () => {
        const clash: CustomPreset[] = [{ id: 'recommended', name: 'Clash', settings: ALL_AUTO }];
        const preset = getPresetById('recommended', clash);
        expect(preset!.name).toBe('Recommended'); // built-in wins
      });
    });

    describe('detectActivePreset with custom presets', () => {
      it('detects a custom preset match', () => {
        const settings: StorageSettings = { ...ALL_AUTO, fontColor: 'cyan', fontSize: '200%' };
        const result = detectActivePreset(settings, false, customPresets);
        expect(result).toBe('custom-1');
      });

      it('still detects built-in presets first', () => {
        // minimal is all-auto, which matches before any custom
        const result = detectActivePreset(ALL_AUTO, false, customPresets);
        expect(result).toBe('minimal');
      });

      it('returns null when no preset matches', () => {
        const settings: StorageSettings = {
          ...ALL_AUTO,
          fontColor: 'magenta',
          windowColor: 'green',
        };
        const result = detectActivePreset(settings, false, customPresets);
        expect(result).toBeNull();
      });
    });
  });
});
