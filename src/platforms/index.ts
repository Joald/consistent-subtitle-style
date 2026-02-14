import type { PlatformConfig, StorageSettings, CharacterEdgeStyle, SettingApplicationReport, PlatformSettingConfig } from '../types/index.js';
import { youtube } from './youtube.js';
import { debug } from '../debug.js';


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
    debug.log(`Character edge style applied: ${value} to ${elements.length} elements`);
    return { success: true, message: `Applied character edge style: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply character edge style: ${e}` };
  }
}

function applyBackgroundOpacity(elements: NodeListOf<Element>, value: StorageSettings['backgroundOpacity']): SettingApplicationReport {
  const opacity = value === 'auto' ? '' : value === '0' ? '0' : (parseInt(value) / 100).toString();

  try {
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        if (opacity) {
          element.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
        } else {
          element.style.backgroundColor = '';
        }
      }
    });
    debug.log(`Background opacity applied: ${value} (${opacity}) to ${elements.length} elements`);
    return { success: true, message: `Applied background opacity: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply background opacity: ${e}` };
  }
}

function applyWindowOpacity(elements: NodeListOf<Element>, value: StorageSettings['windowOpacity']): SettingApplicationReport {
  const opacity = value === 'auto' ? '' : value === '0' ? '0' : (parseInt(value) / 100).toString();

  try {
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        const parent = element.parentElement;
        if (parent) {
          if (opacity) {
            parent.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
          } else {
            parent.style.backgroundColor = '';
          }
        }
      }
    });
    debug.log(`Window opacity applied: ${value} (${opacity}) to ${elements.length} subtitle elements`);
    return { success: true, message: `Applied window opacity: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply window opacity: ${e}` };
  }
}


export const PLATFORMS: { [platformName: string]: PlatformConfig } = {
  youtube,
  netflix: {
    name: 'Netflix',
    settings: {
      characterEdgeStyle: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['characterEdgeStyle']) => applyCharacterEdgeStyle(document.querySelectorAll('.player-timedtext'), value)
      },
      backgroundOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['backgroundOpacity']) => applyBackgroundOpacity(document.querySelectorAll('.player-timedtext'), value)
      },
      windowOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['windowOpacity']) => applyWindowOpacity(document.querySelectorAll('.player-timedtext'), value)
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
    name: 'Disney+',
    settings: {
      characterEdgeStyle: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['characterEdgeStyle']) => applyCharacterEdgeStyle(document.querySelectorAll('.dss-subtitle-renderer'), value)
      },
      backgroundOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['backgroundOpacity']) => applyBackgroundOpacity(document.querySelectorAll('.dss-subtitle-renderer'), value)
      },
      windowOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['windowOpacity']) => applyWindowOpacity(document.querySelectorAll('.dss-subtitle-renderer'), value)
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

export type Platform = 'youtube' | 'netflix' | 'disney';

export function detectPlatform(): Platform | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('netflix.com')) return 'netflix';
  if (hostname.includes('disneyplus.com')) return 'disney';

  return 'unknown';
}

export function getPlatformConfig(platform: Platform | 'unknown'): PlatformConfig | null {
  if (platform === 'unknown') return null;
  return PLATFORMS[platform] ?? null;
}