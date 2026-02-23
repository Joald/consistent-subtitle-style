import { describe, it, expect, beforeEach } from 'vitest';
import { Settings, isValidValue } from '../src/storage.js';

describe('storage', () => {
  describe('isValidValue', () => {
    it('returns true for valid characterEdgeStyle values', () => {
      expect(isValidValue('characterEdgeStyle', 'auto')).toBe(true);
      expect(isValidValue('characterEdgeStyle', 'dropshadow')).toBe(true);
      expect(isValidValue('characterEdgeStyle', 'none')).toBe(true);
      expect(isValidValue('characterEdgeStyle', 'raised')).toBe(true);
      expect(isValidValue('characterEdgeStyle', 'depressed')).toBe(true);
      expect(isValidValue('characterEdgeStyle', 'outline')).toBe(true);
    });

    it('returns true for valid backgroundOpacity values', () => {
      expect(isValidValue('backgroundOpacity', 'auto')).toBe(true);
      expect(isValidValue('backgroundOpacity', '0')).toBe(true);
      expect(isValidValue('backgroundOpacity', '25')).toBe(true);
      expect(isValidValue('backgroundOpacity', '50')).toBe(true);
      expect(isValidValue('backgroundOpacity', '75')).toBe(true);
      expect(isValidValue('backgroundOpacity', '100')).toBe(true);
    });

    it('returns true for valid windowOpacity values', () => {
      expect(isValidValue('windowOpacity', 'auto')).toBe(true);
      expect(isValidValue('windowOpacity', '0')).toBe(true);
      expect(isValidValue('windowOpacity', '25')).toBe(true);
      expect(isValidValue('windowOpacity', '50')).toBe(true);
      expect(isValidValue('windowOpacity', '75')).toBe(true);
      expect(isValidValue('windowOpacity', '100')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isValidValue('characterEdgeStyle', 'invalid')).toBe(false);
      expect(isValidValue('characterEdgeStyle', 'shadow')).toBe(false);
      expect(isValidValue('backgroundOpacity', '10')).toBe(false);
      expect(isValidValue('backgroundOpacity', '150')).toBe(false);
      expect(isValidValue('windowOpacity', 'abc')).toBe(false);
    });
  });

  describe('Settings', () => {
    let settings: Settings;

    beforeEach(() => {
      settings = new Settings({
        characterEdgeStyle: 'auto',
        backgroundOpacity: 'auto',
        windowOpacity: 'auto',
        fontColor: 'auto',
        fontOpacity: 'auto',
        backgroundColor: 'auto',
        windowColor: 'auto',
        fontFamily: 'auto',
        fontSize: 'auto',
      });
    });

    describe('set', () => {
      it('sets a valid value and returns true', () => {
        expect(settings.set('characterEdgeStyle', 'dropshadow')).toBe(true);
        expect(settings.get('characterEdgeStyle')).toBe('dropshadow');
      });

      it('rejects invalid value and returns false', () => {
        expect(settings.set('characterEdgeStyle', 'invalid')).toBe(false);
        expect(settings.get('characterEdgeStyle')).toBe('auto');
      });

      it('updates different setting types', () => {
        expect(settings.set('backgroundOpacity', '50')).toBe(true);
        expect(settings.set('windowOpacity', '75')).toBe(true);
        expect(settings.set('fontColor', 'yellow')).toBe(true);
        expect(settings.get('backgroundOpacity')).toBe('50');
        expect(settings.get('windowOpacity')).toBe('75');
        expect(settings.get('fontColor')).toBe('yellow');
      });
    });

    describe('get', () => {
      it('returns current value', () => {
        expect(settings.get('characterEdgeStyle')).toBe('auto');
        expect(settings.get('backgroundOpacity')).toBe('auto');
        expect(settings.get('windowOpacity')).toBe('auto');
      });
    });

    describe('toObject', () => {
      it('returns a copy of settings', () => {
        const obj = settings.toObject();
        expect(obj).toEqual({
          characterEdgeStyle: 'auto',
          backgroundOpacity: 'auto',
          windowOpacity: 'auto',
          fontColor: 'auto',
          fontOpacity: 'auto',
          backgroundColor: 'auto',
          windowColor: 'auto',
          fontFamily: 'auto',
          fontSize: 'auto',
        });
        expect(obj).not.toBe(settings);
      });
    });

    describe('merge', () => {
      it('merges valid values from partial object', () => {
        const result = settings.merge({
          characterEdgeStyle: 'dropshadow',
          backgroundOpacity: '50',
        });
        expect(result.characterEdgeStyle).toBe('dropshadow');
        expect(result.backgroundOpacity).toBe('50');
        expect(result.windowOpacity).toBe('auto');
      });

      it('ignores invalid values', () => {
        const result = settings.merge({
          characterEdgeStyle: 'invalid',
          backgroundOpacity: '50',
        });
        expect(result.characterEdgeStyle).toBe('auto');
        expect(result.backgroundOpacity).toBe('50');
      });

      it('ignores non-string values', () => {
        const result = settings.merge({
          characterEdgeStyle: 123,
          backgroundOpacity: null,
        } as unknown as Record<string, unknown>);
        expect(result.characterEdgeStyle).toBe('auto');
        expect(result.backgroundOpacity).toBe('auto');
      });
    });

    describe('updateFromStorageResult', () => {
      it('updates settings from storage result', () => {
        settings.updateFromStorageResult({
          characterEdgeStyle: 'outline',
          windowOpacity: '100',
        });
        expect(settings.get('characterEdgeStyle')).toBe('outline');
        expect(settings.get('windowOpacity')).toBe('100');
        expect(settings.get('backgroundOpacity')).toBe('auto');
      });
    });
  });
});
