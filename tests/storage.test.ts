import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
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

  describe('loadSettings', () => {
    let addEventListenerSpy: Mock;
    let postMessageSpy: Mock;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      postMessageSpy = vi.spyOn(window, 'postMessage');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      const g = globalThis as unknown as Record<string, unknown>;
      delete g['chrome'];
    });

    it('loads settings from chrome.storage.sync if chrome is available', async () => {
      const mockGet = vi.fn().mockResolvedValue({ characterEdgeStyle: 'outline' });
      vi.stubGlobal('chrome', {
        storage: {
          sync: {
            get: mockGet,
          },
        },
      });

      const { loadSettings } = await import('../src/storage.js');
      const result = await loadSettings();

      expect(mockGet).toHaveBeenCalledWith(null as unknown as string);
      expect(result.characterEdgeStyle).toBe('outline');
    });

    it('uses postMessage fallback if chrome is not available', async () => {
      vi.stubGlobal('chrome', undefined);
      vi.useFakeTimers();

      const { loadSettings } = await import('../src/storage.js');
      const promise = loadSettings();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subtitleStyler',
          data: { action: 'get' },
        }),
        '*',
      );

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;
      const firstCall = postMessageSpy.mock.calls[0];
      if (!firstCall) throw new Error('postMessage not called');
      const callArgs = firstCall[0] as { requestId: number };
      const reqId = callArgs.requestId;

      messageHandler({
        data: {
          type: 'subtitleStylerResponse',
          requestId: reqId,
          data: { windowOpacity: '75' },
        },
      } as unknown as MessageEvent);

      const result = await promise;
      expect(result.windowOpacity).toBe('75');
      expect(result.characterEdgeStyle).toBe('auto');

      vi.useRealTimers();
    });
  });

  describe('saveSettings', () => {
    it('resolves immediately if chrome is not available', async () => {
      vi.stubGlobal('chrome', undefined);
      const { saveSettings } = await import('../src/storage.js');
      await expect(saveSettings({ characterEdgeStyle: 'none' })).resolves.toBeUndefined();
    });

    it('calls chrome.storage.sync.set if chrome is available', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('chrome', {
        storage: {
          sync: {
            set: mockSet,
          },
        },
      });

      const { saveSettings } = await import('../src/storage.js');
      await saveSettings({ characterEdgeStyle: 'none' });

      expect(mockSet).toHaveBeenCalledWith({ characterEdgeStyle: 'none' });
    });
  });

  describe('saveActivePreset', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      const g = globalThis as unknown as Record<string, unknown>;
      delete g['chrome'];
    });

    it('resolves immediately if chrome is not available', async () => {
      vi.stubGlobal('chrome', undefined);
      const { saveActivePreset } = await import('../src/storage.js');
      await expect(saveActivePreset('recommended')).resolves.toBeUndefined();
    });

    it('saves preset id via chrome.storage.sync.set', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('chrome', { storage: { sync: { set: mockSet } } });

      const { saveActivePreset } = await import('../src/storage.js');
      await saveActivePreset('recommended');

      expect(mockSet).toHaveBeenCalledWith({ activePreset: 'recommended' });
    });

    it('saves null to clear active preset', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('chrome', { storage: { sync: { set: mockSet } } });

      const { saveActivePreset } = await import('../src/storage.js');
      await saveActivePreset(null);

      expect(mockSet).toHaveBeenCalledWith({ activePreset: null });
    });
  });

  describe('loadActivePreset', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      const g = globalThis as unknown as Record<string, unknown>;
      delete g['chrome'];
    });

    it('returns null if chrome is not available', async () => {
      vi.stubGlobal('chrome', undefined);
      const { loadActivePreset } = await import('../src/storage.js');
      const result = await loadActivePreset();
      expect(result).toBeNull();
    });

    it('returns preset id from storage', async () => {
      const mockGet = vi.fn().mockResolvedValue({ activePreset: 'classic' });
      vi.stubGlobal('chrome', { storage: { sync: { get: mockGet } } });

      const { loadActivePreset } = await import('../src/storage.js');
      const result = await loadActivePreset();

      expect(mockGet).toHaveBeenCalledWith('activePreset');
      expect(result).toBe('classic');
    });

    it('returns null when activePreset is not in storage', async () => {
      const mockGet = vi.fn().mockResolvedValue({});
      vi.stubGlobal('chrome', { storage: { sync: { get: mockGet } } });

      const { loadActivePreset } = await import('../src/storage.js');
      const result = await loadActivePreset();

      expect(result).toBeNull();
    });

    it('returns null when activePreset is explicitly null in storage', async () => {
      const mockGet = vi.fn().mockResolvedValue({ activePreset: null });
      vi.stubGlobal('chrome', { storage: { sync: { get: mockGet } } });

      const { loadActivePreset } = await import('../src/storage.js');
      const result = await loadActivePreset();

      expect(result).toBeNull();
    });
  });

  describe('applyPreset', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      const g = globalThis as unknown as Record<string, unknown>;
      delete g['chrome'];
    });

    it('resolves immediately if chrome is not available', async () => {
      vi.stubGlobal('chrome', undefined);
      const { applyPreset, DEFAULTS } = await import('../src/storage.js');
      await expect(applyPreset(DEFAULTS, 'recommended')).resolves.toBeUndefined();
    });

    it('saves all preset settings + activePreset id in one call', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('chrome', { storage: { sync: { set: mockSet } } });

      const { applyPreset } = await import('../src/storage.js');
      const presetSettings = {
        characterEdgeStyle: 'dropshadow' as const,
        backgroundOpacity: '75' as const,
        windowOpacity: '0' as const,
        fontColor: 'white' as const,
        fontOpacity: '100' as const,
        backgroundColor: 'black' as const,
        windowColor: 'black' as const,
        fontFamily: 'proportional-sans-serif' as const,
        fontSize: '100%' as const,
      };

      await applyPreset(presetSettings, 'recommended');

      expect(mockSet).toHaveBeenCalledWith({
        ...presetSettings,
        activePreset: 'recommended',
      });
    });

    it('merges activePreset key with preset settings object', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('chrome', { storage: { sync: { set: mockSet } } });

      const { applyPreset, DEFAULTS } = await import('../src/storage.js');
      await applyPreset(DEFAULTS, 'minimal');

      const calledWith = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(calledWith).toBeDefined();
      expect(calledWith['activePreset']).toBe('minimal');
      // All default settings should also be present
      expect(calledWith['characterEdgeStyle']).toBe('auto');
      expect(calledWith['fontColor']).toBe('auto');
    });
  });

  describe('Settings edge cases', () => {
    it('constructor does not share reference with input', () => {
      const input = {
        characterEdgeStyle: 'auto' as const,
        backgroundOpacity: 'auto' as const,
        windowOpacity: 'auto' as const,
        fontColor: 'auto' as const,
        fontOpacity: 'auto' as const,
        backgroundColor: 'auto' as const,
        windowColor: 'auto' as const,
        fontFamily: 'auto' as const,
        fontSize: 'auto' as const,
      };
      const settings = new Settings(input);
      settings.set('fontColor', 'red');
      expect(input.fontColor).toBe('auto'); // original unchanged
    });

    it('toObject returns independent copy each time', () => {
      const settings = new Settings({
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
      const obj1 = settings.toObject();
      const obj2 = settings.toObject();
      expect(obj1).not.toBe(obj2);
      expect(obj1).toEqual(obj2);
    });

    it('merge handles empty object', () => {
      const settings = new Settings({
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
      const result = settings.merge({});
      expect(result.characterEdgeStyle).toBe('auto');
    });

    it('merge ignores unknown keys gracefully', () => {
      const settings = new Settings({
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
      // Unknown key — isValidValue will receive an unknown key
      const result = settings.merge({ unknownKey: 'someValue' });
      expect(result.characterEdgeStyle).toBe('auto');
    });

    it('set validates all fontFamily options', () => {
      const settings = new Settings({
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
      const validFonts = [
        'auto',
        'monospaced-serif',
        'proportional-serif',
        'monospaced-sans-serif',
        'proportional-sans-serif',
        'casual',
        'cursive',
        'small-caps',
      ];
      for (const font of validFonts) {
        expect(settings.set('fontFamily', font)).toBe(true);
        expect(settings.get('fontFamily')).toBe(font);
      }
      expect(settings.set('fontFamily', 'arial')).toBe(false);
    });

    it('set validates all fontSize options', () => {
      const settings = new Settings({
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
      const validSizes = ['auto', '50%', '75%', '100%', '150%', '200%', '300%', '400%'];
      for (const size of validSizes) {
        expect(settings.set('fontSize', size)).toBe(true);
        expect(settings.get('fontSize')).toBe(size);
      }
      expect(settings.set('fontSize', '125%')).toBe(false);
    });

    it('set validates all fontColor options', () => {
      const settings = new Settings({
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
      const validColors = [
        'auto',
        'white',
        'yellow',
        'green',
        'cyan',
        'blue',
        'magenta',
        'red',
        'black',
      ];
      for (const color of validColors) {
        expect(settings.set('fontColor', color)).toBe(true);
        expect(settings.get('fontColor')).toBe(color);
      }
      expect(settings.set('fontColor', 'orange')).toBe(false);
    });

    it('merge with multiple valid and invalid values at once', () => {
      const settings = new Settings({
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
      const result = settings.merge({
        fontColor: 'cyan',
        fontSize: '200%',
        fontFamily: 'invalid-font',
        backgroundColor: 42,
        windowColor: 'red',
      });
      expect(result.fontColor).toBe('cyan');
      expect(result.fontSize).toBe('200%');
      expect(result.fontFamily).toBe('auto'); // invalid, kept default
      expect(result.backgroundColor).toBe('auto'); // non-string, kept default
      expect(result.windowColor).toBe('red');
    });
  });

  describe('isValidValue comprehensive', () => {
    it('validates fontOpacity values', () => {
      expect(isValidValue('fontOpacity', 'auto')).toBe(true);
      expect(isValidValue('fontOpacity', '0')).toBe(true);
      expect(isValidValue('fontOpacity', '100')).toBe(true);
      expect(isValidValue('fontOpacity', '50')).toBe(true);
      expect(isValidValue('fontOpacity', '110')).toBe(false);
    });

    it('validates fontColor values', () => {
      expect(isValidValue('fontColor', 'auto')).toBe(true);
      expect(isValidValue('fontColor', 'white')).toBe(true);
      expect(isValidValue('fontColor', 'cyan')).toBe(true);
      expect(isValidValue('fontColor', 'purple')).toBe(false);
    });

    it('validates backgroundColor values', () => {
      expect(isValidValue('backgroundColor', 'auto')).toBe(true);
      expect(isValidValue('backgroundColor', 'black')).toBe(true);
      expect(isValidValue('backgroundColor', 'transparent')).toBe(false);
    });

    it('validates windowColor values', () => {
      expect(isValidValue('windowColor', 'auto')).toBe(true);
      expect(isValidValue('windowColor', 'magenta')).toBe(true);
      expect(isValidValue('windowColor', 'grey')).toBe(false);
    });

    it('validates fontFamily values', () => {
      expect(isValidValue('fontFamily', 'auto')).toBe(true);
      expect(isValidValue('fontFamily', 'casual')).toBe(true);
      expect(isValidValue('fontFamily', 'small-caps')).toBe(true);
      expect(isValidValue('fontFamily', 'helvetica')).toBe(false);
    });

    it('validates fontSize values', () => {
      expect(isValidValue('fontSize', 'auto')).toBe(true);
      expect(isValidValue('fontSize', '400%')).toBe(true);
      expect(isValidValue('fontSize', '50%')).toBe(true);
      expect(isValidValue('fontSize', '250%')).toBe(false);
    });
  });
});
