import type { StorageSettings, ValidCharacterEdgeStyles, ValidOpacityValues, ValidationValuesMap } from './types/index.js';

type CharacterEdgeStyle = StorageSettings['characterEdgeStyle'];

const DEFAULTS: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto'
};

export function loadSettings(): Promise<StorageSettings> {
  if (!chrome?.storage?.sync) return Promise.resolve(DEFAULTS);

  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (result: Record<string, unknown>) => {
      if (chrome.runtime.lastError) {
        resolve(DEFAULTS);
      } else {
        const settings: StorageSettings = { ...DEFAULTS };

        const charEdgeStyle = result['characterEdgeStyle'];
        const bgOpacity = result['backgroundOpacity'];
        const winOpacity = result['windowOpacity'];
        
        const validEdgeStyles = ['auto', 'dropshadow', 'none', 'raised', 'depressed', 'outline'] as const;
        const validOpacities = ['auto', '0', '25', '50', '75', '100'] as const;
        
        if (typeof charEdgeStyle === 'string' && validEdgeStyles.includes(charEdgeStyle as CharacterEdgeStyle)) {
          settings.characterEdgeStyle = charEdgeStyle as CharacterEdgeStyle;
        }
        if (typeof bgOpacity === 'string' && validOpacities.includes(bgOpacity as StorageSettings['backgroundOpacity'])) {
          settings.backgroundOpacity = bgOpacity as StorageSettings['backgroundOpacity'];
        }
        if (typeof winOpacity === 'string' && validOpacities.includes(winOpacity as StorageSettings['windowOpacity'])) {
          settings.windowOpacity = winOpacity as StorageSettings['windowOpacity'];
        }
        
        resolve(settings);
      }
    });
  });
}

export function saveSettings(settings: Partial<StorageSettings>): Promise<void> {
  if (!chrome?.storage?.sync) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function updateSettings(newSettings: Partial<StorageSettings>): Promise<StorageSettings> {
  await saveSettings(newSettings);
  return await loadSettings();
}

export function validateSettings(settings: Partial<StorageSettings>): { isValid: boolean; errors: string[] } {
  const validValues: ValidationValuesMap = {
    characterEdgeStyle: ['auto', 'dropshadow', 'none', 'raised', 'depressed', 'outline'],
    backgroundOpacity: ['auto', '0', '25', '50', '75', '100'],
    windowOpacity: ['auto', '0', '25', '50', '75', '100']
  };

  const errors: string[] = [];

  const settingKeys = Object.keys(settings) as Array<keyof StorageSettings>;
  settingKeys.forEach(key => {
    const value = settings[key];

    if (value && validValues[key] && !validValues[key].includes(value)) {
      errors.push(`Invalid ${key}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function resetSettings(): Promise<void> {
  return saveSettings(DEFAULTS);
}