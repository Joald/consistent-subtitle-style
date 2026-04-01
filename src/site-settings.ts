import type { StorageSettings } from './types/index.js';
import type { Platform } from './platforms/index.js';

/**
 * A full per-site override: all 9 settings + optional preset id.
 */
export interface SiteOverride {
  settings: StorageSettings;
  activePreset: string | null;
}

/**
 * Map of platform → per-site override (only populated platforms have overrides).
 */
export type SiteSettingsMap = Partial<Record<Platform, SiteOverride>>;

const STORAGE_KEY = 'siteSettings';

/**
 * Load all per-site overrides from chrome.storage.sync.
 */
export async function loadAllSiteOverrides(): Promise<SiteSettingsMap> {
  if (typeof chrome === 'undefined') return {};
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as SiteSettingsMap | undefined;
  return stored ?? {};
}

/**
 * Load the per-site override for a specific platform, or null if none.
 */
export async function loadSiteOverride(platform: Platform): Promise<SiteOverride | null> {
  const all = await loadAllSiteOverrides();
  return all[platform] ?? null;
}

/**
 * Check whether a platform has a per-site override.
 */
export async function hasSiteOverride(platform: Platform): Promise<boolean> {
  const override = await loadSiteOverride(platform);
  return override !== null;
}

/**
 * Save a per-site override for a platform.
 * Stores a full settings snapshot so each site is self-contained.
 */
export async function saveSiteOverride(
  platform: Platform,
  settings: StorageSettings,
  activePreset: string | null,
): Promise<void> {
  if (typeof chrome === 'undefined') return;
  const all = await loadAllSiteOverrides();
  all[platform] = { settings, activePreset };
  await chrome.storage.sync.set({ [STORAGE_KEY]: all });
}

/**
 * Remove a per-site override for a platform (falls back to global).
 */
export async function clearSiteOverride(platform: Platform): Promise<void> {
  if (typeof chrome === 'undefined') return;
  const all = await loadAllSiteOverrides();
  const { [platform]: _, ...rest } = all;
  void _;
  await chrome.storage.sync.set({ [STORAGE_KEY]: rest });
}

/**
 * Get the effective settings for a platform:
 * - If the platform has a per-site override, return that.
 * - Otherwise, return global settings.
 */
export async function getEffectiveSettings(
  platform: Platform | 'unknown',
  loadGlobalSettings: () => Promise<StorageSettings>,
  loadGlobalPreset: () => Promise<string | null>,
): Promise<{ settings: StorageSettings; activePreset: string | null; isOverride: boolean }> {
  if (platform === 'unknown') {
    const settings = await loadGlobalSettings();
    const activePreset = await loadGlobalPreset();
    return { settings, activePreset, isOverride: false };
  }

  const override = await loadSiteOverride(platform);
  if (override) {
    return {
      settings: override.settings,
      activePreset: override.activePreset,
      isOverride: true,
    };
  }

  const settings = await loadGlobalSettings();
  const activePreset = await loadGlobalPreset();
  return { settings, activePreset, isOverride: false };
}
