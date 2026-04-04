import type { StorageSettings } from './types/index.js';

/**
 * A user-created custom preset stored in chrome.storage.sync.
 */
export interface CustomPreset {
  /** Unique id (auto-generated, e.g. "custom-1712345678901") */
  id: string;
  /** User-chosen display name */
  name: string;
  /** The saved settings snapshot */
  settings: StorageSettings;
}

const STORAGE_KEY = 'customPresets';

/**
 * Load all custom presets from chrome.storage.sync.
 */
export async function loadCustomPresets(): Promise<CustomPreset[]> {
  if (typeof chrome === 'undefined') return [];
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as CustomPreset[] | undefined;
  return stored ?? [];
}

/**
 * Save a new custom preset. Returns the created preset (with generated id).
 */
export async function saveCustomPreset(
  name: string,
  settings: StorageSettings,
): Promise<CustomPreset> {
  const presets = await loadCustomPresets();

  const preset: CustomPreset = {
    id: `custom-${String(Date.now())}`,
    name: name.trim(),
    settings: { ...settings },
  };

  presets.push(preset);
  if (typeof chrome !== 'undefined') {
    await chrome.storage.sync.set({ [STORAGE_KEY]: presets });
  }

  return preset;
}

/**
 * Delete a custom preset by id. No-op if not found.
 */
export async function deleteCustomPreset(id: string): Promise<void> {
  const presets = await loadCustomPresets();
  const filtered = presets.filter((p) => p.id !== id);

  if (typeof chrome !== 'undefined') {
    await chrome.storage.sync.set({ [STORAGE_KEY]: filtered });
  }
}
