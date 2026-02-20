import { loadSettings, Settings } from './storage.js';
import { detectPlatform, getPlatformConfig } from './platforms/index.js';
import { debug } from './debug.js';
import { CSS_SETTING_MAPPINGS, applyCssSetting } from './css-mappings.js';
import type {
  StorageSettings,
  PlatformConfig,
  ApplicationLog,
  Platform,
  ExtendedWindow,
  SettingApplicationReport
} from './types/index.js';

type DebugWindow = typeof window & { subtitleStylerDebug?: Function };

let currentSettings: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto'
};
let settings = new Settings(currentSettings);
let currentPlatform: Platform | 'unknown';
let applicationLog: ApplicationLog = {};

(window as DebugWindow).subtitleStylerDebug = () => {
  return {
    platform: currentPlatform,
    settings: currentSettings,
    log: applicationLog,
    config: currentPlatform !== 'unknown' ? getPlatformConfig(currentPlatform) : null,
    status: 'loading',
    chromeAPIs: !!(chrome && chrome.storage && chrome.runtime),
    playerElement: !!document.querySelector('#movie_player'),
    storageBridge: !!(window as ExtendedWindow).subtitleStylerBridge
  };
};

function processSettings(platform: PlatformConfig, extensionSettings: StorageSettings): {
  toApply: Array<{ key: keyof StorageSettings; value: StorageSettings[keyof StorageSettings]; type: 'native' | 'css' }>
} {
  const toApply: Array<{ key: keyof StorageSettings; value: StorageSettings[keyof StorageSettings]; type: 'native' | 'css' }> = [];

  for (const [settingKey, settingValue] of Object.entries(extensionSettings)) {
    const key = settingKey as keyof StorageSettings;
    const value = settingValue as StorageSettings[keyof StorageSettings];

    if (value === 'auto') continue;

    if (platform.nativeSettings?.[key]) {
      const config = platform.nativeSettings[key];
      const currentValue = config.getCurrentValue();

      if (currentValue !== undefined && currentValue === value) {
        continue;
      }

      toApply.push({ key, value, type: 'native' });
    }

    if (platform.css?.selectors) {
      toApply.push({ key, value, type: 'css' });
    }
  }

  return { toApply };
}

async function applyStyles(platform: PlatformConfig): Promise<void> {
  const { toApply } = processSettings(platform, currentSettings);

  for (const { key } of toApply) {
    applicationLog[key] = {
      success: false
    };
  }

  for (const { key, value, type } of toApply) {
    let report: SettingApplicationReport;

    if (type === 'native' && platform.nativeSettings?.[key]) {
      const config = platform.nativeSettings[key];
      report = config.applySetting(value);
    } else if (type === 'css' && platform.css?.selectors) {
      const mapping = CSS_SETTING_MAPPINGS[key];
      const selector = platform.css.selectors[mapping.appliesTo];
      const elements = document.querySelectorAll(selector);
      report = applyCssSetting(elements, mapping, value as string);
    } else {
      continue;
    }

    if (applicationLog[key]) {
      applicationLog[key].success = report.success;
      applicationLog[key].details = report.message;
    }
  }
}

function startSubtitleObserver(platform: PlatformConfig): void {
  if (!platform.css) return;

  const containerSelector = platform.css.subtitleContainerSelector;
  if (!containerSelector) return;

  function setupObserver(): void {
    const container = document.querySelector(containerSelector);
    if (container) {
      const observer = new MutationObserver(() => applyStyles(platform));
      observer.observe(container, { childList: true, subtree: true, attributes: true });
    }
  }

  const playerSelector = '#video-player';
  const playerElement = document.querySelector(playerSelector);

  if (playerElement) {
    setupObserver();
  } else {
    const playerObserver = new MutationObserver(() => {
      const player = document.querySelector(playerSelector);
      if (player) {
        playerObserver.disconnect();
        setupObserver();
      }
    });
    playerObserver.observe(document.body, { childList: true, subtree: true });
  }
}

async function initialize(): Promise<void> {
  try {
    currentPlatform = detectPlatform();
    const platform = getPlatformConfig(currentPlatform);

    if (!platform) {
      console.error(`No configuration found for platform: ${currentPlatform}`);
      return;
    }

    currentSettings = await loadSettings();
    settings = new Settings(currentSettings);

    await applyStyles(platform);

    if (platform.css) {
      startSubtitleObserver(platform);
    }

    debug.log(
      `Extension initialized - Platform: ${currentPlatform}, settings: ${Object
        .entries(currentSettings)
        .filter(([_, v]) => v !== 'auto')
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      }`
    );
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

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'subtitleStylerChanged') {
    const changes = event.data.data;

    const settingKeys = Object.keys(changes) as Array<keyof StorageSettings>;
    settingKeys.forEach(key => {
      if (key in currentSettings) {
        const change = changes[key];
        if (change && change.newValue !== undefined) {
          const newValue = change.newValue as string;
          if (settings.set(key, newValue)) {
            currentSettings = settings.toObject();
          }
        }
      }
    });

    if (currentPlatform !== 'unknown') {
      const platform = getPlatformConfig(currentPlatform);
      if (platform) {
        applyStyles(platform).catch(error => {
          console.error(`Failed to apply updated styles on ${platform.name}:`, error);
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