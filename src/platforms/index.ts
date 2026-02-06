import type { PlatformConfig, PlatformRegistry, StorageSettings, Platform, SettingApplicationReport } from '../types/index.js';
import { youtube } from './youtube.js';

// CSS application helper
function applyCharacterEdgeStyle(elements: NodeListOf<Element>, value: StorageSettings['characterEdgeStyle']): SettingApplicationReport {
  try {
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        switch (value) {
          case 'dropshadow':
            element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            break;
          case 'none':
            element.style.textShadow = 'none';
            break;
          case 'auto':
          default:
            element.style.textShadow = '';
        }
      }
    });
    return { success: true, message: `Applied character edge style: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply character edge style: ${e}` };
  }
}

function applyBackgroundOpacity(elements: NodeListOf<Element>, value: StorageSettings['backgroundOpacity']): SettingApplicationReport {
  try {
    const opacity = value === 'auto' ? '' : value === '0' ? '0' : (parseInt(value) / 100).toString();
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        if (opacity) {
          element.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
        } else {
          element.style.backgroundColor = '';
        }
      }
    });
    return { success: true, message: `Applied background opacity: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply background opacity: ${e}` };
  }
}

function applyWindowOpacity(elements: NodeListOf<Element>, value: StorageSettings['windowOpacity']): SettingApplicationReport {
  try {
    const opacity = value === 'auto' ? '' : value === '0' ? '0' : (parseInt(value) / 100).toString();
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        if (opacity) {
          const parent = element.parentElement;
          if (parent) {
            parent.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
          }
        }
      }
    });
    return { success: true, message: `Applied window opacity: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply window opacity: ${e}` };
  }
}

export const PLATFORMS: PlatformRegistry = {
  youtube,
  netflix: {
    selector: '.player-timedtext',
    name: 'Netflix',
    settings: {
      characterEdgeStyle: {
        getCurrentValue() { return undefined; },
        applySetting: (value) => applyCharacterEdgeStyle(document.querySelectorAll('.player-timedtext'), value as StorageSettings['characterEdgeStyle'])
      },
      backgroundOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value) => applyBackgroundOpacity(document.querySelectorAll('.player-timedtext'), value as StorageSettings['backgroundOpacity'])
      },
      windowOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value) => applyWindowOpacity(document.querySelectorAll('.player-timedtext'), value as StorageSettings['windowOpacity'])
      }
    },
    detectNativeCapabilities(): boolean {
      return false;
    },
    getCurrentNativeSettings(): Partial<StorageSettings> | null {
      return null;
    }
  },

  disney: {
    selector: '.dss-subtitle-renderer',
    name: 'Disney+',
    settings: {
      characterEdgeStyle: {
        getCurrentValue() { return undefined; },
        applySetting: (value) => applyCharacterEdgeStyle(document.querySelectorAll('.dss-subtitle-renderer'), value as StorageSettings['characterEdgeStyle'])
      },
      backgroundOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value) => applyBackgroundOpacity(document.querySelectorAll('.dss-subtitle-renderer'), value as StorageSettings['backgroundOpacity'])
      },
      windowOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value) => applyWindowOpacity(document.querySelectorAll('.dss-subtitle-renderer'), value as StorageSettings['windowOpacity'])
      }
    },
    detectNativeCapabilities(): boolean {
      return false;
    },
    getCurrentNativeSettings(): Partial<StorageSettings> | null {
      return null;
    }
  }
};

export function detectPlatform(): Platform | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('netflix.com')) return 'netflix';
  if (hostname.includes('disneyplus.com')) return 'disney';

  return 'unknown';
}

export function getPlatformConfig(platform: string): PlatformConfig {
  const platformKey = platform as keyof typeof PLATFORMS;
  const config = PLATFORMS[platformKey] ?? PLATFORMS['youtube'];
  return config as PlatformConfig;
}