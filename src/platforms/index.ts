import type { PlatformConfig, StorageSettings, SettingApplicationReport } from '../types/index.js';
import { youtube } from './youtube.js';
import { debug } from '../debug.js';


function applyCharacterEdgeStyle(elements: NodeListOf<Element>, value: StorageSettings['characterEdgeStyle']): SettingApplicationReport {
  try {
    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        switch (value) {
          case 'dropshadow':
            element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.95)';
            break;
          case 'none':
            element.style.textShadow = 'none';
            break;
          case 'raised':
            element.style.textShadow = '-1px -1px 1px rgba(255,255,255,0.5), 1px -1px 1px rgba(255,255,255,0.5), -1px 1px 1px rgba(255,255,255,0.5), 1px 1px 1px rgba(255,255,255,0.5)';
            break;
          case 'depressed':
            element.style.textShadow = '1px 1px 1px rgba(0,0,0,0.5)';
            break;
          case 'outline':
            element.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
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
  nebula: {
    name: 'Nebula',
    css: {
      subtitleContainerSelector: '#video-player [data-subtitles-container]'
    },
    settings: {
      characterEdgeStyle: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['characterEdgeStyle']) => applyCharacterEdgeStyle(document.querySelectorAll('#video-player [data-subtitles-container] > div > div > div'), value)
      },
      backgroundOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['backgroundOpacity']) => applyBackgroundOpacity(document.querySelectorAll('#video-player [data-subtitles-container] > div > div > div'), value)
      },
      windowOpacity: {
        getCurrentValue() { return undefined; },
        applySetting: (value: StorageSettings['windowOpacity']) => applyWindowOpacity(document.querySelectorAll('#video-player [data-subtitles-container] > div > div > div'), value)
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

export type Platform = 'youtube' | 'nebula';

export function detectPlatform(): Platform | 'unknown' {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('nebula.tv')) return 'nebula';

  return 'unknown';
}

export function getPlatformConfig(platform: Platform | 'unknown'): PlatformConfig | null {
  if (platform === 'unknown') return null;
  return PLATFORMS[platform] ?? null;
}