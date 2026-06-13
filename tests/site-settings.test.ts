import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  loadAllSiteOverrides,
  loadSiteOverride,
  hasSiteOverride,
  saveSiteOverride,
  clearSiteOverride,
  getEffectiveSettings,
  toSiteSettings,
} from '../src/site-settings.js';
import type { StorageSettings, SiteSettings, SiteValue } from '../src/types/index.js';

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

const CLASSIC_SETTINGS: StorageSettings = {
  ...ALL_AUTO,
  fontColor: 'white',
  backgroundColor: 'black',
  backgroundOpacity: '75',
  characterEdgeStyle: 'none',
};

/** Wrap plain settings with all enabled (convenience for tests). */
const CLASSIC_SITE = toSiteSettings(CLASSIC_SETTINGS);
const ALL_AUTO_SITE = toSiteSettings(ALL_AUTO);

describe('site-settings', () => {
  // Local storage backing for the chrome.storage.sync mock
  let storageData: Record<string, unknown>;

  beforeEach(() => {
    storageData = {};
    vi.clearAllMocks();

    // Configure the shared chrome mock's storage methods for our needs
    (chrome.storage.sync.get as Mock).mockImplementation((key: string | string[] | null) => {
      if (key === null) return Promise.resolve({ ...storageData });
      if (typeof key === 'string') return Promise.resolve({ [key]: storageData[key] });
      const result: Record<string, unknown> = {};
      for (const k of key) result[k] = storageData[k];
      return Promise.resolve(result);
    });

    (chrome.storage.sync.set as Mock).mockImplementation((items: Record<string, unknown>) => {
      Object.assign(storageData, items);
      return Promise.resolve();
    });
  });

  describe('toSiteSettings', () => {
    it('wraps all keys with enabled: true', () => {
      const site = toSiteSettings(ALL_AUTO);
      expect(site.fontColor).toEqual({ value: 'auto', enabled: true });
      expect(site.fontSize).toEqual({ value: 'auto', enabled: true });
    });
  });

  describe('loadAllSiteOverrides', () => {
    it('returns empty object when no site settings stored', async () => {
      const result = await loadAllSiteOverrides();
      expect(result).toEqual({});
    });

    it('returns stored site overrides', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      };
      const result = await loadAllSiteOverrides();
      expect(result).toEqual({
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      });
    });

    it('migrates legacy plain-value overrides', async () => {
      // Old format: settings is plain StorageSettings (string values)
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SETTINGS, activePreset: 'classic' },
      };
      const result = await loadAllSiteOverrides();
      // Should be migrated to SiteSettings format
      expect(result.youtube!.settings.fontColor).toEqual({ value: 'white', enabled: true });
    });
  });

  describe('loadSiteOverride', () => {
    it('returns null when no override for platform', async () => {
      const result = await loadSiteOverride('youtube');
      expect(result).toBeNull();
    });

    it('returns override when it exists', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      };
      const result = await loadSiteOverride('youtube');
      expect(result).toEqual({ settings: CLASSIC_SITE, activePreset: 'classic' });
    });

    it('returns null for a different platform', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      };
      const result = await loadSiteOverride('nebula');
      expect(result).toBeNull();
    });
  });

  describe('hasSiteOverride', () => {
    it('returns false when no override', async () => {
      expect(await hasSiteOverride('youtube')).toBe(false);
    });

    it('returns true when override exists', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: ALL_AUTO_SITE, activePreset: null },
      };
      expect(await hasSiteOverride('youtube')).toBe(true);
    });
  });

  describe('saveSiteOverride', () => {
    it('saves a new site override', async () => {
      await saveSiteOverride('youtube', CLASSIC_SITE, 'classic');
      expect(storageData['siteSettings']).toEqual({
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      });
    });

    it('adds override without overwriting others', async () => {
      storageData['siteSettings'] = {
        nebula: { settings: ALL_AUTO_SITE, activePreset: 'minimal' },
      };
      await saveSiteOverride('youtube', CLASSIC_SITE, 'classic');
      expect(storageData['siteSettings']).toEqual({
        nebula: { settings: ALL_AUTO_SITE, activePreset: 'minimal' },
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      });
    });

    it('overwrites existing override for the same platform', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: ALL_AUTO_SITE, activePreset: 'minimal' },
      };
      await saveSiteOverride('youtube', CLASSIC_SITE, 'classic');
      expect(storageData['siteSettings']).toEqual({
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      });
    });

    it('saves with null activePreset', async () => {
      await saveSiteOverride('dropout', CLASSIC_SITE, null);
      expect(storageData['siteSettings']).toEqual({
        dropout: { settings: CLASSIC_SITE, activePreset: null },
      });
    });
  });

  describe('clearSiteOverride', () => {
    it('removes override for a platform', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
        nebula: { settings: ALL_AUTO_SITE, activePreset: null },
      };
      await clearSiteOverride('youtube');
      expect(storageData['siteSettings']).toEqual({
        nebula: { settings: ALL_AUTO_SITE, activePreset: null },
      });
    });

    it('no-op when platform has no override', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      };
      await clearSiteOverride('nebula');
      expect(storageData['siteSettings']).toEqual({
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      });
    });
  });

  describe('getEffectiveSettings', () => {
    const loadGlobal = (): Promise<StorageSettings> => Promise.resolve(ALL_AUTO);
    const loadGlobalPreset = (): Promise<string | null> => Promise.resolve('minimal');

    it('returns global settings for unknown platform', async () => {
      const result = await getEffectiveSettings('unknown', loadGlobal, loadGlobalPreset);
      expect(result).toEqual({
        settings: ALL_AUTO,
        activePreset: 'minimal',
        isOverride: false,
      });
    });

    it('returns global settings when no site override exists', async () => {
      const result = await getEffectiveSettings('youtube', loadGlobal, loadGlobalPreset);
      expect(result).toEqual({
        settings: ALL_AUTO,
        activePreset: 'minimal',
        isOverride: false,
      });
    });

    it('returns site override values for enabled settings', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      };
      const result = await getEffectiveSettings('youtube', loadGlobal, loadGlobalPreset);
      expect(result).toEqual({
        settings: CLASSIC_SETTINGS,
        activePreset: 'classic',
        isOverride: true,
      });
    });

    it('uses global value for disabled per-site settings', async () => {
      // Create a site override with fontColor disabled
      const mixed = toSiteSettings(CLASSIC_SETTINGS);
      mixed.fontColor = { value: 'yellow', enabled: false };

      storageData['siteSettings'] = {
        youtube: { settings: mixed, activePreset: null },
      };

      const result = await getEffectiveSettings('youtube', loadGlobal, loadGlobalPreset);
      // fontColor should come from global (auto), not per-site (yellow)
      expect(result.settings.fontColor).toBe('auto');
      // Other enabled settings should use per-site values
      expect(result.settings.backgroundColor).toBe('black');
      expect(result.isOverride).toBe(true);
    });

    it('returns global settings for a different platform without override', async () => {
      storageData['siteSettings'] = {
        youtube: { settings: CLASSIC_SITE, activePreset: 'classic' },
      };
      const result = await getEffectiveSettings('nebula', loadGlobal, loadGlobalPreset);
      expect(result).toEqual({
        settings: ALL_AUTO,
        activePreset: 'minimal',
        isOverride: false,
      });
    });

    it('returns isOverride false when all settings are disabled', async () => {
      const allDisabled = toSiteSettings(CLASSIC_SETTINGS);
      for (const key of Object.keys(allDisabled) as (keyof SiteSettings)[]) {
        (allDisabled[key] as SiteValue<string>).enabled = false;
      }

      storageData['siteSettings'] = {
        youtube: { settings: allDisabled, activePreset: 'classic' },
      };

      const result = await getEffectiveSettings('youtube', loadGlobal, loadGlobalPreset);
      expect(result.isOverride).toBe(false);
      expect(result.settings).toEqual(ALL_AUTO);
      expect(result.activePreset).toBe('minimal'); // Falls back to global preset
    });
  });
});
