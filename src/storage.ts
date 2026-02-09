import type { StorageSettings, ValidCharacterEdgeStyles, ValidOpacityValues, ValidationValuesMap } from './types/index.js';

type CharacterEdgeStyle = StorageSettings['characterEdgeStyle'];

const DEFAULTS: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto'
};

export function loadSettings(): Promise<StorageSettings> {
  // Since main script runs in main world, use direct bridge communication
  console.log('🔍 DEBUG: Using direct bridge communication for storage');
  
  return new Promise((resolve) => {
    const requestId = Date.now();
    
    // Listen for response
    const messageHandler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data.type === 'subtitleStylerResponse' && event.data.requestId === requestId) {
        window.removeEventListener('message', messageHandler);
        
        console.log('🔍 DEBUG: Got bridge response:', event.data.data);
        const result = event.data.data as Record<string, unknown>;
        
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
        
        console.log('🔍 DEBUG: Final settings after validation:', settings);
        resolve(settings);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send request
    window.postMessage({
      type: 'subtitleStyler',
      data: { action: 'get' },
      requestId
    }, '*');
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