import type { StorageSettings } from './types/index.js';
import type { CustomPreset } from './custom-presets.js';
import type { SiteSettingsMap } from './site-settings.js';
import { isValidValue, DEFAULTS } from './storage.js';
import type { Platform } from './platforms/index.js';

/** Schema version for forward compatibility. */
const EXPORT_VERSION = 1;

const VALID_PLATFORMS: readonly string[] = [
  'youtube',
  'nebula',
  'dropout',
  'primevideo',
  'max',
  'crunchyroll',
  'disneyplus',
  'netflix',
  'vimeo',
];

/**
 * Full export payload containing all user data.
 */
export interface SettingsExportData {
  version: number;
  exportedAt: string;
  global: StorageSettings;
  activePreset: string | null;
  siteOverrides: SiteSettingsMap;
  customPresets: CustomPreset[];
}

/**
 * Result of validating an import payload.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Sanitized data (with invalid values replaced by defaults). Only set when valid. */
  data?: SettingsExportData;
}

/**
 * Validate that a StorageSettings object has all required keys with valid values.
 * Returns a sanitized copy (invalid values replaced with DEFAULTS).
 */
function validateSettings(
  raw: unknown,
  context: string,
): { settings: StorageSettings; errors: string[] } {
  const errors: string[] = [];
  const settings: StorageSettings = { ...DEFAULTS };

  if (raw == null || typeof raw !== 'object') {
    errors.push(`${context}: expected an object`);
    return { settings, errors };
  }

  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof StorageSettings)[]) {
    const value = obj[key];
    if (value === undefined) {
      // Missing key — use default (not an error, just fill in)
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`${context}.${key}: expected string, got ${typeof value}`);
      continue;
    }
    if (isValidValue(key, value)) {
      settings[key] = value as never;
    } else {
      errors.push(`${context}.${key}: invalid value "${value}"`);
    }
  }

  return { settings, errors };
}

/**
 * Validate a custom preset entry.
 */
function validateCustomPreset(
  raw: unknown,
  index: number,
): { preset: CustomPreset | null; errors: string[] } {
  const errors: string[] = [];

  if (raw == null || typeof raw !== 'object') {
    errors.push(`customPresets[${String(index)}]: expected an object`);
    return { preset: null, errors };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['id'] !== 'string' || obj['id'].trim() === '') {
    errors.push(`customPresets[${String(index)}].id: must be a non-empty string`);
    return { preset: null, errors };
  }

  if (typeof obj['name'] !== 'string' || obj['name'].trim() === '') {
    errors.push(`customPresets[${String(index)}].name: must be a non-empty string`);
    return { preset: null, errors };
  }

  const { settings, errors: settingsErrors } = validateSettings(
    obj['settings'],
    `customPresets[${String(index)}].settings`,
  );
  errors.push(...settingsErrors);

  // Only fail the preset if settings was not an object at all
  if (obj['settings'] == null || typeof obj['settings'] !== 'object') {
    return { preset: null, errors };
  }

  return {
    preset: {
      id: obj['id'],
      name: obj['name'].trim(),
      settings,
    },
    errors,
  };
}

/**
 * Validate an import payload. Returns sanitized data if valid.
 * Tolerates minor issues (missing fields filled with defaults) but rejects
 * structurally broken data.
 */
export function validateImportData(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (raw == null || typeof raw !== 'object') {
    return { valid: false, errors: ['Import data must be a JSON object'] };
  }

  const obj = raw as Record<string, unknown>;

  // Version check
  if (typeof obj['version'] !== 'number') {
    errors.push('Missing or invalid "version" field');
  } else if (obj['version'] > EXPORT_VERSION) {
    errors.push(
      `Unsupported version ${String(obj['version'])} (max supported: ${String(EXPORT_VERSION)})`,
    );
  }

  // Global settings
  const { settings: globalSettings, errors: globalErrors } = validateSettings(
    obj['global'],
    'global',
  );
  errors.push(...globalErrors);

  if (obj['global'] == null || typeof obj['global'] !== 'object') {
    return { valid: false, errors: [...errors, 'Missing "global" settings object'] };
  }

  // Active preset
  const activePreset =
    obj['activePreset'] === null || typeof obj['activePreset'] === 'string'
      ? obj['activePreset']
      : null;

  // Site overrides (optional)
  const siteOverrides: SiteSettingsMap = {};
  if (obj['siteOverrides'] != null && typeof obj['siteOverrides'] === 'object') {
    const overridesObj = obj['siteOverrides'] as Record<string, unknown>;
    for (const [platform, override] of Object.entries(overridesObj)) {
      if (!VALID_PLATFORMS.includes(platform)) {
        errors.push(`siteOverrides: unknown platform "${platform}"`);
        continue;
      }

      if (override == null || typeof override !== 'object') {
        errors.push(`siteOverrides.${platform}: expected an object`);
        continue;
      }

      const overrideObj = override as Record<string, unknown>;
      const { settings, errors: siteErrors } = validateSettings(
        overrideObj['settings'],
        `siteOverrides.${platform}.settings`,
      );
      errors.push(...siteErrors);

      if (overrideObj['settings'] != null && typeof overrideObj['settings'] === 'object') {
        const sitePreset =
          overrideObj['activePreset'] === null || typeof overrideObj['activePreset'] === 'string'
            ? overrideObj['activePreset']
            : null;

        siteOverrides[platform as Platform] = { settings, activePreset: sitePreset };
      }
    }
  }

  // Custom presets (optional)
  const customPresets: CustomPreset[] = [];
  if (Array.isArray(obj['customPresets'])) {
    for (let i = 0; i < (obj['customPresets'] as unknown[]).length; i++) {
      const { preset, errors: presetErrors } = validateCustomPreset(
        (obj['customPresets'] as unknown[])[i],
        i,
      );
      errors.push(...presetErrors);
      if (preset) customPresets.push(preset);
    }
  }

  return {
    valid: true,
    errors,
    data: {
      version: EXPORT_VERSION,
      exportedAt: typeof obj['exportedAt'] === 'string' ? obj['exportedAt'] : '',
      global: globalSettings,
      activePreset,
      siteOverrides,
      customPresets,
    },
  };
}

/**
 * Build an export payload from the current extension state.
 */
export function buildExportData(
  globalSettings: StorageSettings,
  activePreset: string | null,
  siteOverrides: SiteSettingsMap,
  customPresets: CustomPreset[],
): SettingsExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    global: { ...globalSettings },
    activePreset,
    siteOverrides: { ...siteOverrides },
    customPresets: customPresets.map((p) => ({
      id: p.id,
      name: p.name,
      settings: { ...p.settings },
    })),
  };
}

/**
 * Trigger a JSON file download in the browser.
 */
export function downloadJson(data: SettingsExportData, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `subtitle-styles-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Read a File as text and parse as JSON.
 */
export function readJsonFile(file: File): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        resolve(parsed);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
}

/**
 * Apply imported data to chrome.storage.sync.
 * Returns the number of site overrides and custom presets imported.
 */
export async function applyImportData(
  data: SettingsExportData,
): Promise<{ siteOverrideCount: number; customPresetCount: number }> {
  if (typeof chrome === 'undefined') {
    return { siteOverrideCount: 0, customPresetCount: 0 };
  }

  // 1. Save global settings + activePreset
  await chrome.storage.sync.set({
    ...data.global,
    activePreset: data.activePreset,
  });

  // 2. Save site overrides
  const siteOverrideCount = Object.keys(data.siteOverrides).length;
  if (siteOverrideCount > 0) {
    await chrome.storage.sync.set({ siteSettings: data.siteOverrides });
  } else {
    await chrome.storage.sync.remove('siteSettings');
  }

  // 3. Save custom presets
  const customPresetCount = data.customPresets.length;
  if (customPresetCount > 0) {
    await chrome.storage.sync.set({ customPresets: data.customPresets });
  } else {
    await chrome.storage.sync.remove('customPresets');
  }

  return { siteOverrideCount, customPresetCount };
}
