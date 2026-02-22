import type { StorageSettings } from './types/index.js';

const VALID_SETTINGS: Record<keyof StorageSettings, readonly string[]> = {
  characterEdgeStyle: ['auto', 'dropshadow', 'none', 'raised', 'depressed', 'outline'] as const,
  backgroundOpacity: ['auto', '0', '25', '50', '75', '100'] as const,
  windowOpacity: ['auto', '0', '25', '50', '75', '100'] as const,
};

export function isValidValue<K extends keyof StorageSettings>(
  key: K,
  value: string,
): value is StorageSettings[K] {
  return VALID_SETTINGS[key].includes(value);
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

const DEFAULTS: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto',
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
