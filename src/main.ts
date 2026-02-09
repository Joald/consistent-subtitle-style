import { loadSettings, saveSettings } from './storage.js';
import { detectPlatform, getPlatformConfig, PLATFORMS } from './platforms/index.js';
import type { StorageSettings, PlatformConfig, ApplicationLog, ProcessedSettings, StyleElement, StorageKey, CharacterEdgeStyle, DebugWindow, StorageChanges, ValidCharacterEdgeStyles, ValidOpacityValues, Platform } from './types/index.js';

let currentSettings: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto'
};
let currentPlatform: Platform | 'unknown';
let applicationLog: ApplicationLog = {};

console.log('Subtitle styler content script loaded');

  (window as DebugWindow).subtitleStylerDebug = () => {
    return {
      platform: currentPlatform,
      settings: currentSettings,
      log: applicationLog,
      config: currentPlatform !== 'unknown' ? getPlatformConfig(currentPlatform) : null,
      status: 'loading',
      chromeAPIs: !!(chrome && chrome.storage && chrome.runtime),
      playerElement: !!document.querySelector('#movie_player'),
      storageBridge: !!(window as any).subtitleStylerBridge
    };
  };

function processSettings(platform: PlatformConfig, extensionSettings: StorageSettings): {
  toApply: Array<{ key: keyof StorageSettings; value: StorageSettings[keyof StorageSettings] }>
} {
  const toApply: Array<{ key: keyof StorageSettings; value: StorageSettings[keyof StorageSettings] }> = [];

  for (const [settingKey, settingValue] of Object.entries(extensionSettings)) {
    const key = settingKey as keyof StorageSettings;
    const value = settingValue as StorageSettings[keyof StorageSettings];

    if (value === 'auto') continue;

    const config = platform.settings[key];
    const currentValue = config.getCurrentValue();

    if (currentValue !== undefined && currentValue === value) {
      continue; // No change needed
    }

    toApply.push({
      key,
      value
    });
  }

  return { toApply };
}



async function applyStyles(platform: PlatformConfig): Promise<void> {
  const { toApply } = processSettings(platform, currentSettings);
  
  console.log(`🔍 DEBUG: Processing ${toApply.length} settings to apply for ${platform.name}`);

  // Initialize application log
  for (const { key } of toApply) {
    applicationLog[key] = {
      success: false
    };
  }

  // Apply settings using per-platform per-setting configuration
  // Note: For YouTube, this uses the player API, not DOM elements
  for (const { key, value } of toApply) {
    console.log(`🔍 DEBUG: Applying setting ${key}: ${value}`);
    const config = platform.settings[key];
    const report = config.applySetting(value);
    
    console.log(`Applied setting ${key}: ${value} - ${report.message}`);

    if (applicationLog[key]) {
      applicationLog[key].success = report.success;
      applicationLog[key].details = report.message;
    }
  }
  
  console.log('✅ DEBUG: All settings processed');
}

async function initialize(): Promise<void> {
  try {
    console.log('Initializing subtitle extension...');
    console.log('Chrome APIs available:', {
      chrome: !!chrome,
      storage: !!(chrome?.storage),
      runtime: !!(chrome?.runtime),
      sync: !!(chrome?.storage?.sync)
    });

    currentPlatform = detectPlatform();
    console.log('🔍 DEBUG: Platform detected, getting config...');
    const platform = getPlatformConfig(currentPlatform);

    if (!platform) {
      console.error(`No configuration found for platform: ${currentPlatform}`);
      return;
    }

    console.log(`Platform detected: ${currentPlatform} (${platform.name})`);
    console.log('🔍 DEBUG: About to load settings...');
    
    currentSettings = await loadSettings();
    console.log('✅ SUCCESS: Settings loaded:', currentSettings);
    console.log('🔍 DEBUG: About to apply styles...');
    await applyStyles(platform);
    console.log('✅ SUCCESS: Styles applied');
    console.log('Extension initialized successfully');

  } catch (error) {
    console.error('Failed to initialize extension:', error);

    (window as DebugWindow).subtitleStylerDebug = () => {
      return {
        error: error instanceof Error ? error.message : String(error),
        platform: currentPlatform,
        settings: currentSettings,
        log: applicationLog,
        config: currentPlatform !== 'unknown' ? getPlatformConfig(currentPlatform) : null
      };
    };
  }
}

(window as DebugWindow).subtitleStylerDebug = () => {
  return {
    platform: currentPlatform,
    settings: currentSettings,
    log: applicationLog,
    config: currentPlatform !== 'unknown' ? getPlatformConfig(currentPlatform) : null
  };
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    console.log('Storage changed:', changes);

    const settingKeys = Object.keys(changes) as Array<keyof StorageSettings>;
    settingKeys.forEach(key => {
      if (key in currentSettings) {
        const change = changes[key];
        if (change && change.newValue !== undefined) {
          const newValue = change.newValue as string;
          if (key === 'characterEdgeStyle') {
            const validValues: readonly CharacterEdgeStyle[] = ['auto', 'dropshadow', 'none', 'raised', 'depressed', 'outline'];
            if (validValues.includes(newValue as CharacterEdgeStyle)) {
              currentSettings[key] = newValue as CharacterEdgeStyle;
            }
          } else if ((key === 'backgroundOpacity' || key === 'windowOpacity')) {
            const validValues: readonly StorageSettings['backgroundOpacity'][] = ['auto', '0', '25', '50', '75', '100'];
            if (validValues.includes(newValue as StorageSettings['backgroundOpacity'])) {
              currentSettings[key] = newValue as StorageSettings['backgroundOpacity'];
            }
          }
        }
      }
    });

    console.log('Updated settings:', currentSettings);

    if (currentPlatform !== 'unknown') {
      const platform = getPlatformConfig(currentPlatform);
      if (platform) {
        applyStyles(platform).catch(error => {
          console.error('Failed to apply updated styles:', error);
        });
      }
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}