import { describe, it, expect } from 'vitest';
import { getAvailablePresets, getPresetById, detectActivePreset } from '../src/presets.js';

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
});
