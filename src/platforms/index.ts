import type { PlatformConfig, StorageSettings, CharacterEdgeStyle, SettingApplicationReport, PlatformSettingConfig } from '../types/index.js';
import { youtube } from './youtube.js';

// CSS application helpers
function applyCharacterEdgeStyle(elements: NodeListOf<Element>, value: StorageSettings['characterEdgeStyle']): SettingApplicationReport {
  console.log('🔍 CSS FALLBACK: applyCharacterEdgeStyle called with value:', value);
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
  console.log('🔍 CSS FALLBACK: applyBackgroundOpacity called with value:', value);
  try {
    const opacity = value === 'auto' ? '' : value === '0' ? '0' : (parseInt(value) / 100).toString();
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        if (opacity) {
          element.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
        }
      }
    });
    return { success: true, message: `Applied background opacity: ${value}` };
  } catch (e) {
    return { success: false, message: `Failed to apply background opacity: ${e}` };
  }
}

function applyWindowOpacity(elements: NodeListOf<Element>, value: StorageSettings['windowOpacity']): SettingApplicationReport {
  console.log('🔍 CSS FALLBACK: applyWindowOpacity called with value:', value);
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

// Platform registry with CSS fallback configurations
export const PLATFORMS: { [platformName: string]: PlatformConfig } = {
  youtube,
  netflix: {
    selector: '.player-timedtext',
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
    selector: '.dss-subtitle-renderer',
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