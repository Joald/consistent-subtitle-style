import type { StorageSettings, SiteSettings, SiteValue } from './types/index.js';
import type { Platform } from './platforms/index.js';
import { DEFAULTS, loadSettings } from './storage.js';

/**
 * A full per-site override: wrapped settings + optional preset id.
 */
export interface SiteOverride {
  settings: SiteSettings;
  activePreset: string | null;
}

/**
 * Map of platform → per-site override (only populated platforms have overrides).
 */
export type SiteSettingsMap = Partial<Record<Platform, SiteOverride>>;

const STORAGE_KEY = 'siteSettings';

// ---------------------------------------------------------------------------
// Migration: old format (plain StorageSettings) → new format (SiteSettings)
// ---------------------------------------------------------------------------

/**
 * Check whether a stored settings object is in the legacy plain format
 * (values are raw strings) vs the new wrapped format (values are {value, enabled}).
 */
function isLegacySettings(
  settings: Record<string, unknown>,
): settings is Record<string, string> {
  const firstKey = Object.keys(settings)[0];
  if (!firstKey) return false;
  return typeof settings[firstKey] === 'string';
}

/**
 * Convert plain StorageSettings to the new SiteSettings format.
 * All settings are marked as enabled (preserving previous behavior).
 */
export function toSiteSettings(plain: StorageSettings): SiteSettings {
  const result = {} as Record<string, SiteValue<string>>;
  for (const [key, value] of Object.entries(plain)) {
    result[key] = { value, enabled: true };
  }
  return result as SiteSettings;
}

/**
 * Extract effective StorageSettings from SiteSettings.
 * For enabled keys, uses the per-site value.
 * For disabled keys, uses the provided global fallback.
 */
export function resolveEffective(
  site: SiteSettings,
  global: StorageSettings,
): StorageSettings {
  const result = {} as Record<string, string>;
  for (const key of Object.keys(DEFAULTS) as (keyof StorageSettings)[]) {
    const entry = site[key];
    result[key] = entry.enabled ? entry.value : global[key];
  }
  return result as unknown as StorageSettings;
}

/**
 * Extract raw StorageSettings from SiteSettings (all values, ignoring enabled flag).
 */
export function flattenSiteSettings(site: SiteSettings): StorageSettings {
  const result = {} as Record<string, string>;
  for (const key of Object.keys(DEFAULTS) as (keyof StorageSettings)[]) {
    result[key] = site[key].value;
  }
  return result as unknown as StorageSettings;
}

/**
 * Migrate a stored override entry: if it's in the legacy format, convert it.
 * When global settings are provided, only settings that differ from global
 * are marked as enabled (smart migration). Without global, all are enabled.
 */
function migrateOverride(
  raw: { settings: unknown; activePreset: string | null },
  global?: StorageSettings,
): SiteOverride {
  const settings = raw.settings as Record<string, unknown>;
  if (isLegacySettings(settings)) {
    const plain = settings as unknown as StorageSettings;
    const result = {} as Record<string, SiteValue<string>>;
    for (const [key, value] of Object.entries(plain)) {
      const globalVal = global ? (global[key as keyof StorageSettings] as string) : undefined;
      result[key] = {
        value,
        enabled: globalVal !== undefined ? value !== globalVal : true,
      };
    }
    return {
      settings: result as SiteSettings,
      activePreset: raw.activePreset,
    };
  }
  return raw as SiteOverride;
}

// ---------------------------------------------------------------------------
// Storage CRUD
// ---------------------------------------------------------------------------

/**
 * Load all per-site overrides from chrome.storage.sync.
 * Automatically migrates legacy entries.
 */
export async function loadAllSiteOverrides(): Promise<SiteSettingsMap> {
  if (typeof chrome === 'undefined') return {};
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Record<string, { settings: unknown; activePreset: string | null }> | undefined;
  if (!stored) return {};

  // Load global settings for smart legacy migration (compare per-site vs global)
  const global = await loadSettings();

  const migrated: SiteSettingsMap = {};
  let needsPersist = false;
  for (const [platform, entry] of Object.entries(stored)) {
    const settings = entry.settings as Record<string, unknown>;
    const wasLegacy = isLegacySettings(settings);
    migrated[platform as Platform] = migrateOverride(entry, global);
    if (wasLegacy) needsPersist = true;
  }

  // Persist the migrated format so legacy detection doesn't re-run
  if (needsPersist && typeof chrome !== 'undefined') {
    await chrome.storage.sync.set({ [STORAGE_KEY]: migrated });
  }

  return migrated;
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
 */
export async function saveSiteOverride(
  platform: Platform,
  settings: SiteSettings,
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
 * - If the platform has a per-site override, merge enabled per-site values
 *   with global values for disabled keys.
 * - Otherwise, return global settings.
 */
export async function getEffectiveSettings(
  platform: Platform | 'unknown',
  loadGlobalSettings: () => Promise<StorageSettings>,
  loadGlobalPreset: () => Promise<string | null>,
): Promise<{ settings: StorageSettings; activePreset: string | null; isOverride: boolean }> {
  const globalSettings = await loadGlobalSettings();

  if (platform === 'unknown') {
    const activePreset = await loadGlobalPreset();
    return { settings: globalSettings, activePreset, isOverride: false };
  }

  const override = await loadSiteOverride(platform);
  if (override) {
    // Check if ANY setting is enabled per-site
    const hasEnabled = Object.values(override.settings).some(
      (entry) => (entry as SiteValue<string>).enabled,
    );

    return {
      settings: resolveEffective(override.settings, globalSettings),
      activePreset: hasEnabled ? override.activePreset : await loadGlobalPreset(),
      isOverride: hasEnabled,
    };
  }

  const activePreset = await loadGlobalPreset();
  return { settings: globalSettings, activePreset, isOverride: false };
}
