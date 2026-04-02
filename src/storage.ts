import type { StorageSettings } from './types/index.js';

const VALID_SETTINGS: Record<keyof StorageSettings, readonly string[]> = {
  characterEdgeStyle: ['auto', 'dropshadow', 'none', 'raised', 'depressed', 'outline'] as const,
  backgroundOpacity: ['auto', '0', '25', '50', '75', '100'] as const,
  windowOpacity: ['auto', '0', '25', '50', '75', '100'] as const,
  fontColor: [
    'auto',
    'white',
    'yellow',
    'green',
    'cyan',
    'blue',
    'magenta',
    'red',
    'black',
  ] as const,
  fontOpacity: ['auto', '0', '25', '50', '75', '100'] as const,
  backgroundColor: [
    'auto',
    'white',
    'yellow',
    'green',
    'cyan',
    'blue',
    'magenta',
    'red',
    'black',
  ] as const,
  windowColor: [
    'auto',
    'white',
    'yellow',
    'green',
    'cyan',
    'blue',
    'magenta',
    'red',
    'black',
  ] as const,
  fontFamily: [
    'auto',
    'monospaced-serif',
    'proportional-serif',
    'monospaced-sans-serif',
    'proportional-sans-serif',
    'casual',
    'cursive',
    'small-caps',
  ] as const,
  fontSize: ['auto', '50%', '75%', '100%', '150%', '200%', '300%', '400%'] as const,
};

export function isValidValue<K extends keyof StorageSettings>(
  key: K,
  value: string,
): value is StorageSettings[K] {
  const allowed = VALID_SETTINGS[key];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for unknown keys at runtime
  if (!allowed) return false;
  return allowed.includes(value);
}

export class Settings {
  private settings: StorageSettings;

  constructor(initialSettings: StorageSettings) {
    this.settings = { ...initialSettings };
  }

  set(key: keyof StorageSettings, value: string): boolean {
    if (isValidValue(key, value)) {
      this.settings[key] = value as never;
      return true;
    }
    return false;
  }

  get(key: keyof StorageSettings): StorageSettings[keyof StorageSettings] {
    return this.settings[key];
  }

  toObject(): StorageSettings {
    return { ...this.settings };
  }

  merge(partialSettings: Record<string, unknown>): StorageSettings {
    for (const [key, value] of Object.entries(partialSettings)) {
      const settingKey = key as keyof StorageSettings;
      if (typeof value === 'string' && isValidValue(settingKey, value)) {
        this.set(settingKey, value);
      }
    }
    return this.toObject();
  }

  updateFromStorageResult(result: Record<string, unknown>): void {
    this.merge(result);
  }
}

export const DEFAULTS: StorageSettings = {
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

export async function loadSettings(): Promise<StorageSettings> {
  if (typeof chrome !== 'undefined') {
    const result = await chrome.storage.sync.get(null);
    const settings = new Settings(DEFAULTS);
    settings.updateFromStorageResult(result);
    return settings.toObject();
  }

  return new Promise((resolve) => {
    const requestId = Date.now();
    const messageHandler = (
      event: MessageEvent<{ type?: string; requestId?: number; data?: unknown }>,
    ): void => {
      if (event.data.type === 'subtitleStylerResponse' && event.data.requestId === requestId) {
        window.removeEventListener('message', messageHandler);
        const settings = new Settings(DEFAULTS);
        const result = (event.data.data ?? {}) as Record<string, unknown>;
        settings.updateFromStorageResult(result);
        resolve(settings.toObject());
      }
    };

    window.addEventListener('message', messageHandler);
    window.postMessage(
      {
        type: 'subtitleStyler',
        data: { action: 'get' },
        requestId,
      },
      '*',
    );
  });
}

export const saveSettings = (settings: Partial<StorageSettings>): Promise<void> => {
  if (typeof chrome === 'undefined') return Promise.resolve();

  return chrome.storage.sync.set(settings);
};

/**
 * Save the active preset id (or null for custom/manual mode).
 */
export const saveActivePreset = (presetId: string | null): Promise<void> => {
  if (typeof chrome === 'undefined') return Promise.resolve();
  return chrome.storage.sync.set({ activePreset: presetId });
};

/**
 * Load the active preset id from storage.
 */
export const loadActivePreset = async (): Promise<string | null> => {
  if (typeof chrome === 'undefined') return null;
  const result = await chrome.storage.sync.get('activePreset');
  return (result['activePreset'] as string | null) ?? null;
};

/**
 * Apply a preset: write all its settings + mark it as active in one shot.
 */
export const applyPreset = async (
  presetSettings: StorageSettings,
  presetId: string,
): Promise<void> => {
  if (typeof chrome === 'undefined') return;
  await chrome.storage.sync.set({ ...presetSettings, activePreset: presetId });
};
