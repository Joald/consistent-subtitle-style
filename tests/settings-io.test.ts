import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateImportData,
  buildExportData,
  applyImportData,
  readJsonFile,
  downloadJson,
} from '../src/settings-io.js';
import type { SettingsExportData } from '../src/settings-io.js';
import { DEFAULTS } from '../src/storage.js';
import type { StorageSettings } from '../src/types/index.js';
import type { SiteSettingsMap } from '../src/site-settings.js';
import type { CustomPreset } from '../src/custom-presets.js';

const SAMPLE_SETTINGS: StorageSettings = {
  characterEdgeStyle: 'dropshadow',
  backgroundOpacity: '75',
  windowOpacity: '50',
  fontColor: 'yellow',
  fontOpacity: '100',
  backgroundColor: 'black',
  windowColor: 'auto',
  fontFamily: 'proportional-sans-serif',
  fontSize: '150%',
};

const SAMPLE_SITE_OVERRIDES: SiteSettingsMap = {
  youtube: {
    settings: { ...DEFAULTS, fontColor: 'cyan', fontSize: '200%' },
    activePreset: null,
  },
  netflix: {
    settings: { ...DEFAULTS, backgroundColor: 'blue', backgroundOpacity: '50' },
    activePreset: 'recommended',
  },
};

const SAMPLE_CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: 'custom-1712345678901',
    name: 'Movie Night',
    settings: { ...DEFAULTS, fontColor: 'white', characterEdgeStyle: 'dropshadow' },
  },
  {
    id: 'custom-1712345678902',
    name: 'High Contrast',
    settings: {
      ...DEFAULTS,
      fontColor: 'yellow',
      backgroundColor: 'black',
      backgroundOpacity: '100',
    },
  },
];

function buildValidExport(overrides?: Partial<SettingsExportData>): SettingsExportData {
  return {
    version: 1,
    exportedAt: '2026-04-07T12:00:00.000Z',
    global: SAMPLE_SETTINGS,
    activePreset: null,
    siteOverrides: SAMPLE_SITE_OVERRIDES,
    customPresets: SAMPLE_CUSTOM_PRESETS,
    ...overrides,
  };
}

describe('settings-io', () => {
  describe('validateImportData', () => {
    it('accepts a valid full export', () => {
      const data = buildValidExport();
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.global.fontColor).toBe('yellow');
      expect(Object.keys(result.data!.siteOverrides)).toHaveLength(2);
      expect(result.data!.customPresets).toHaveLength(2);
    });

    it('rejects null input', () => {
      const result = validateImportData(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Import data must be a JSON object');
    });

    it('rejects non-object input', () => {
      const result = validateImportData('not an object');
      expect(result.valid).toBe(false);
    });

    it('rejects array input', () => {
      const result = validateImportData([1, 2, 3]);
      expect(result.valid).toBe(false);
    });

    it('rejects missing global settings', () => {
      const result = validateImportData({ version: 1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('"global"'))).toBe(true);
    });

    it('rejects unsupported version', () => {
      const data = buildValidExport({ version: 99 });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('Unsupported version'))).toBe(true);
    });

    it('reports missing version field', () => {
      const data = buildValidExport();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (data as any).version;
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('"version"'))).toBe(true);
    });

    it('fills missing global settings keys with defaults', () => {
      const data = buildValidExport({ global: { fontColor: 'cyan' } as StorageSettings });
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(result.data!.global.fontColor).toBe('cyan');
      expect(result.data!.global.fontFamily).toBe('auto'); // filled from DEFAULTS
    });

    it('reports invalid setting values', () => {
      const badSettings = { ...SAMPLE_SETTINGS, fontColor: 'rainbow' };
      const data = buildValidExport({ global: badSettings as unknown as StorageSettings });
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.includes('fontColor'))).toBe(true);
      // Invalid value should be replaced with default
      expect(result.data!.global.fontColor).toBe('auto');
    });

    it('reports non-string setting values', () => {
      const badSettings = { ...SAMPLE_SETTINGS, fontSize: 42 };
      const data = buildValidExport({ global: badSettings as unknown as StorageSettings });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('fontSize'))).toBe(true);
    });

    it('accepts export with no site overrides', () => {
      const data = buildValidExport({ siteOverrides: {} });
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.data!.siteOverrides)).toHaveLength(0);
    });

    it('accepts export with no custom presets', () => {
      const data = buildValidExport({ customPresets: [] });
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(result.data!.customPresets).toHaveLength(0);
    });

    it('skips unknown platforms in site overrides', () => {
      const overrides = {
        youtube: SAMPLE_SITE_OVERRIDES.youtube,
        hulu: { settings: DEFAULTS, activePreset: null },
      };
      const data = buildValidExport({ siteOverrides: overrides as unknown as SiteSettingsMap });
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.includes('hulu'))).toBe(true);
      expect(Object.keys(result.data!.siteOverrides)).toHaveLength(1);
    });

    it('validates site override settings', () => {
      const overrides = {
        youtube: {
          settings: { ...DEFAULTS, fontColor: 'neon' },
          activePreset: null,
        },
      };
      const data = buildValidExport({
        siteOverrides: overrides as unknown as SiteSettingsMap,
      });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('siteOverrides.youtube'))).toBe(true);
    });

    it('rejects custom presets without id', () => {
      const presets = [{ name: 'Test', settings: DEFAULTS }];
      const data = buildValidExport({
        customPresets: presets as unknown as CustomPreset[],
      });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('customPresets[0].id'))).toBe(true);
      expect(result.data!.customPresets).toHaveLength(0);
    });

    it('rejects custom presets without name', () => {
      const presets = [{ id: 'custom-1', settings: DEFAULTS }];
      const data = buildValidExport({
        customPresets: presets as unknown as CustomPreset[],
      });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('customPresets[0].name'))).toBe(true);
    });

    it('rejects custom presets with empty name', () => {
      const presets = [{ id: 'custom-1', name: '  ', settings: DEFAULTS }];
      const data = buildValidExport({
        customPresets: presets as unknown as CustomPreset[],
      });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('handles missing siteOverrides and customPresets gracefully', () => {
      const data = { version: 1, global: SAMPLE_SETTINGS };
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.data!.siteOverrides)).toHaveLength(0);
      expect(result.data!.customPresets).toHaveLength(0);
    });

    it('preserves activePreset from export data', () => {
      const data = buildValidExport({ activePreset: 'recommended' });
      const result = validateImportData(data);
      expect(result.data!.activePreset).toBe('recommended');
    });

    it('handles null activePreset', () => {
      const data = buildValidExport({ activePreset: null });
      const result = validateImportData(data);
      expect(result.data!.activePreset).toBeNull();
    });

    it('preserves exportedAt timestamp', () => {
      const data = buildValidExport({ exportedAt: '2026-01-01T00:00:00Z' });
      const result = validateImportData(data);
      expect(result.data!.exportedAt).toBe('2026-01-01T00:00:00Z');
    });

    describe('v1.0 backward compatibility', () => {
      it('accepts a flat v1.0 storage dump (all 9 keys)', () => {
        const v1Dump = {
          characterEdgeStyle: 'dropshadow',
          backgroundOpacity: '75',
          windowOpacity: '50',
          fontColor: 'yellow',
          fontOpacity: '100',
          backgroundColor: 'black',
          windowColor: 'auto',
          fontFamily: 'proportional-sans-serif',
          fontSize: '150%',
        };
        const result = validateImportData(v1Dump);
        expect(result.valid).toBe(true);
        expect(result.data!.global.fontColor).toBe('yellow');
        expect(result.data!.global.fontSize).toBe('150%');
        expect(result.data!.global.characterEdgeStyle).toBe('dropshadow');
        expect(result.data!.activePreset).toBeNull();
        expect(Object.keys(result.data!.siteOverrides)).toHaveLength(0);
        expect(result.data!.customPresets).toHaveLength(0);
      });

      it('accepts a partial v1.0 dump (only some keys set)', () => {
        const v1Partial = {
          fontColor: 'cyan',
          fontSize: '200%',
        };
        const result = validateImportData(v1Partial);
        expect(result.valid).toBe(true);
        expect(result.data!.global.fontColor).toBe('cyan');
        expect(result.data!.global.fontSize).toBe('200%');
        // Missing keys filled with defaults
        expect(result.data!.global.characterEdgeStyle).toBe('auto');
        expect(result.data!.global.backgroundOpacity).toBe('auto');
      });

      it('accepts a v1.0 dump with all defaults (all auto)', () => {
        const v1AllDefaults = {
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
        const result = validateImportData(v1AllDefaults);
        expect(result.valid).toBe(true);
        expect(result.data!.global).toEqual(DEFAULTS);
      });

      it('handles v1.0 dump with invalid values', () => {
        const v1Bad = {
          fontColor: 'rainbow',
          fontSize: '999%',
          characterEdgeStyle: 'dropshadow',
        };
        const result = validateImportData(v1Bad);
        expect(result.valid).toBe(true);
        // Invalid values replaced with defaults
        expect(result.data!.global.fontColor).toBe('auto');
        expect(result.data!.global.fontSize).toBe('auto');
        // Valid value preserved
        expect(result.data!.global.characterEdgeStyle).toBe('dropshadow');
      });

      it('accepts a v1.0 dump with a single key', () => {
        const v1Single = { fontColor: 'yellow' };
        const result = validateImportData(v1Single);
        expect(result.valid).toBe(true);
        expect(result.data!.global.fontColor).toBe('yellow');
      });

      it('handles v1.1+ storage dump with activePreset and siteSettings', () => {
        // Post-v1.0 but still flat (raw chrome.storage.sync dump)
        const dump = {
          characterEdgeStyle: 'dropshadow',
          fontColor: 'yellow',
          backgroundOpacity: '75',
          windowOpacity: 'auto',
          fontOpacity: 'auto',
          backgroundColor: 'auto',
          windowColor: 'auto',
          fontFamily: 'auto',
          fontSize: 'auto',
          activePreset: 'recommended',
          siteSettings: {
            youtube: {
              settings: { ...DEFAULTS, fontColor: 'cyan' },
              activePreset: null,
            },
          },
          customPresets: [
            {
              id: 'custom-1',
              name: 'My Preset',
              settings: DEFAULTS,
            },
          ],
        };
        const result = validateImportData(dump);
        expect(result.valid).toBe(true);
        expect(result.data!.global.fontColor).toBe('yellow');
        expect(result.data!.activePreset).toBe('recommended');
        expect(Object.keys(result.data!.siteOverrides)).toHaveLength(1);
        expect(result.data!.customPresets).toHaveLength(1);
      });

      it('does NOT treat modern envelope as flat format', () => {
        const modern = buildValidExport();
        const result = validateImportData(modern);
        expect(result.valid).toBe(true);
        // Should use the global key, not root-level keys
        expect(result.data!.global.fontColor).toBe('yellow');
      });

      it('round-trips: export → import flat dump', () => {
        // Simulate: v1.0 user exports chrome.storage.sync as flat JSON
        const v1Dump = {
          characterEdgeStyle: 'outline',
          backgroundOpacity: '100',
          windowOpacity: '0',
          fontColor: 'white',
          fontOpacity: '75',
          backgroundColor: 'blue',
          windowColor: 'red',
          fontFamily: 'casual',
          fontSize: '300%',
        };
        const result = validateImportData(v1Dump);
        expect(result.valid).toBe(true);

        // Re-export using modern format
        const reExported = buildExportData(
          result.data!.global,
          result.data!.activePreset,
          result.data!.siteOverrides,
          result.data!.customPresets,
        );

        // Re-import should still work
        const result2 = validateImportData(reExported);
        expect(result2.valid).toBe(true);
        expect(result2.data!.global).toEqual(v1Dump);
      });
    });

    it('handles site override with non-object settings', () => {
      const overrides = {
        youtube: { settings: 'invalid', activePreset: null },
      };
      const data = buildValidExport({
        siteOverrides: overrides as unknown as SiteSettingsMap,
      });
      const result = validateImportData(data);
      expect(result.errors.some((e) => e.includes('siteOverrides.youtube'))).toBe(true);
    });

    it('validates all 9 platforms as valid', () => {
      const platforms = [
        'youtube',
        'nebula',
        'dropout',
        'primevideo',
        'max',
        'crunchyroll',
        'disneyplus',
        'netflix',
        'vimeo',
      ] as const;
      const overrides: Record<string, { settings: StorageSettings; activePreset: null }> = {};
      for (const p of platforms) {
        overrides[p] = { settings: DEFAULTS, activePreset: null };
      }
      const data = buildValidExport({ siteOverrides: overrides as SiteSettingsMap });
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.data!.siteOverrides)).toHaveLength(9);
    });
  });

  describe('buildExportData', () => {
    it('builds a complete export payload', () => {
      const data = buildExportData(
        SAMPLE_SETTINGS,
        'recommended',
        SAMPLE_SITE_OVERRIDES,
        SAMPLE_CUSTOM_PRESETS,
      );

      expect(data.version).toBe(1);
      expect(data.exportedAt).toBeTruthy();
      expect(data.global.fontColor).toBe('yellow');
      expect(data.activePreset).toBe('recommended');
      expect(Object.keys(data.siteOverrides)).toHaveLength(2);
      expect(data.customPresets).toHaveLength(2);
    });

    it('produces valid ISO timestamp', () => {
      const data = buildExportData(DEFAULTS, null, {}, []);
      expect(() => new Date(data.exportedAt)).not.toThrow();
      expect(new Date(data.exportedAt).toISOString()).toBe(data.exportedAt);
    });

    it('creates deep copies of settings', () => {
      const original = { ...SAMPLE_SETTINGS };
      const data = buildExportData(original, null, {}, []);
      original.fontColor = 'red';
      expect(data.global.fontColor).toBe('yellow');
    });

    it('creates deep copies of custom presets', () => {
      const source = SAMPLE_CUSTOM_PRESETS[0]!;
      const presets: CustomPreset[] = [{ ...source }];
      const data = buildExportData(DEFAULTS, null, {}, presets);
      presets[0]!.name = 'Modified';
      expect(data.customPresets[0]!.name).toBe('Movie Night');
    });

    it('round-trips through validate', () => {
      const data = buildExportData(
        SAMPLE_SETTINGS,
        'recommended',
        SAMPLE_SITE_OVERRIDES,
        SAMPLE_CUSTOM_PRESETS,
      );
      const result = validateImportData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data!.global).toEqual(SAMPLE_SETTINGS);
      expect(result.data!.activePreset).toBe('recommended');
      expect(result.data!.customPresets).toHaveLength(2);
    });
  });

  describe('applyImportData', () => {
    let syncStore: Record<string, unknown>;

    beforeEach(() => {
      syncStore = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock chrome API
      (globalThis as any).chrome = {
        storage: {
          sync: {
            set: vi.fn(async (items: Record<string, unknown>) => {
              Object.assign(syncStore, items);
            }),
            remove: vi.fn(async (key: string) => {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mock storage
              delete syncStore[key];
            }),
          },
        },
      };
    });

    it('writes global settings to storage', async () => {
      const data = buildValidExport();
      await applyImportData(data);

      expect(syncStore['fontColor']).toBe('yellow');
      expect(syncStore['fontSize']).toBe('150%');
      expect(syncStore['activePreset']).toBeNull();
    });

    it('writes site overrides to storage', async () => {
      const data = buildValidExport();
      const result = await applyImportData(data);

      expect(result.siteOverrideCount).toBe(2);
      expect(syncStore['siteSettings']).toBeDefined();
      const stored = syncStore['siteSettings'] as SiteSettingsMap;
      expect(stored.youtube).toBeDefined();
      expect(stored.netflix).toBeDefined();
    });

    it('writes custom presets to storage', async () => {
      const data = buildValidExport();
      const result = await applyImportData(data);

      expect(result.customPresetCount).toBe(2);
      expect(syncStore['customPresets']).toBeDefined();
      const stored = syncStore['customPresets'] as CustomPreset[];
      expect(stored).toHaveLength(2);
      expect(stored[0]!.name).toBe('Movie Night');
    });

    it('removes siteSettings when no overrides', async () => {
      const data = buildValidExport({ siteOverrides: {} });
      await applyImportData(data);

      expect(chrome.storage.sync.remove).toHaveBeenCalledWith('siteSettings');
    });

    it('removes customPresets when empty', async () => {
      const data = buildValidExport({ customPresets: [] });
      await applyImportData(data);

      expect(chrome.storage.sync.remove).toHaveBeenCalledWith('customPresets');
    });

    it('returns correct counts', async () => {
      const data = buildValidExport();
      const result = await applyImportData(data);

      expect(result.siteOverrideCount).toBe(2);
      expect(result.customPresetCount).toBe(2);
    });

    it('returns zeros when chrome is undefined', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- remove mock
      delete (globalThis as any).chrome;
      const data = buildValidExport();
      const result = await applyImportData(data);

      expect(result.siteOverrideCount).toBe(0);
      expect(result.customPresetCount).toBe(0);
    });
  });

  describe('readJsonFile', () => {
    it('parses valid JSON from a File', async () => {
      const content = JSON.stringify({ test: true });
      const file = new File([content], 'test.json', { type: 'application/json' });
      const result = await readJsonFile(file);
      expect(result).toEqual({ test: true });
    });

    it('rejects invalid JSON', async () => {
      const file = new File(['not json {{{'], 'bad.json', { type: 'application/json' });
      await expect(readJsonFile(file)).rejects.toThrow('Invalid JSON file');
    });
  });

  describe('downloadJson', () => {
    it('creates and clicks a download link', () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) {
          node.click = clickSpy;
        }
        return node;
      });
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);

      const data = buildValidExport();
      downloadJson(data, 'test-export.json');

      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(appendChildSpy).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();

      const anchor = appendChildSpy.mock.calls[0]![0] as HTMLAnchorElement;
      expect(anchor.download).toBe('test-export.json');
      expect(anchor.href).toBe('blob:test');

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('uses default filename when none provided', () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = vi.fn();

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) {
          node.click = vi.fn();
        }
        return node;
      });
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);

      const data = buildValidExport();
      downloadJson(data);

      const anchor = appendChildSpy.mock.calls[0]![0] as HTMLAnchorElement;
      expect(anchor.download).toMatch(/^subtitle-styles-\d{4}-\d{2}-\d{2}\.json$/);

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });
});
