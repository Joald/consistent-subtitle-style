import type { PlatformConfig, StorageSettings, YouTubeDisplaySettings, CharacterEdgeStyle, SettingApplicationReport, YouTubePlayerElement } from '../types/index.js';
import { debug } from '../debug.js';

const EDGE_STYLE_MAP = {
  none: 0,
  raised: 1,
  depressed: 2,
  outline: 3,
  dropshadow: 4,
};

const REVERSE_EDGE_STYLE_MAP: Record<number, CharacterEdgeStyle> = {
  0: 'none',
  1: 'raised',
  2: 'depressed',
  3: 'outline',
  4: 'dropshadow'
};

function getYouTubePlayer(): YouTubePlayerElement | null {
  debug.log('🔍 DEBUG: Looking for YouTube player...');
  const moviePlayer = document.querySelector('#movie_player') as any;
  
  debug.log('🔍 DEBUG: #movie_player element found:', !!moviePlayer);
  debug.log('🔍 DEBUG: Element tag:', moviePlayer?.tagName);
  debug.log('🔍 DEBUG: Element classes:', moviePlayer?.className);
  
  if (moviePlayer) {
    debug.log('🔍 DEBUG: Checking for getSubtitlesUserSettings method...');
    debug.log('🔍 DEBUG: getSubtitlesUserSettings type:', typeof moviePlayer.getSubtitlesUserSettings);
    
    debug.log('🔍 DEBUG: Checking for updateSubtitlesUserSettings method...');
    debug.log('🔍 DEBUG: updateSubtitlesUserSettings type:', typeof moviePlayer.updateSubtitlesUserSettings);
    
    if (typeof moviePlayer.getSubtitlesUserSettings === 'function' && typeof moviePlayer.updateSubtitlesUserSettings === 'function') {
      debug.log('✅ SUCCESS: Found YouTube player with subtitle methods!');
      
      // Test if methods actually work
      try {
        const testSettings = moviePlayer.getSubtitlesUserSettings();
        debug.log('🔍 DEBUG: Test getSubtitlesUserSettings() returned:', testSettings);
        debug.log('✅ SUCCESS: YouTube API methods are functional!');
        return moviePlayer as YouTubePlayerElement;
      } catch (e) {
        debug.log('❌ ERROR: YouTube API methods exist but failed when called:', e);
        return moviePlayer as YouTubePlayerElement;
      }
    }
  }
  
  debug.log('❌ FAILED: No YouTube player with subtitle methods found');
  debug.log('🔍 DEBUG: Player element properties:', moviePlayer ? Object.getOwnPropertyNames(moviePlayer) : 'null');
  debug.log('🔍 DEBUG: Player prototype:', moviePlayer ? Object.getPrototypeOf(moviePlayer) : 'null');
  
  return null;
}

function logError(setting: string, operation: string, error: unknown): void {
  console.error(`YouTube ${setting} ${operation} failed:`, error);
}

function getCurrentYouTubeSettings(): YouTubeDisplaySettings | null {
  try {
    const player = getYouTubePlayer();
    if (!player) {
      return null;
    }
    if (!player.getSubtitlesUserSettings) {
      return null;
    }

    const displaySettings: YouTubeDisplaySettings = player.getSubtitlesUserSettings();
    return displaySettings && typeof displaySettings === 'object' ? displaySettings : null;
  } catch (error) {
    logError('general', 'get settings', error);
    return null;
  }
}

function applyYouTubeSetting(updateSettings: Partial<YouTubeDisplaySettings>): SettingApplicationReport {
  try {
    const player = getYouTubePlayer();
    if (!player) {
      return { success: false, message: 'YouTube player not available' };
    }
    
    if (!player.updateSubtitlesUserSettings) {
      return { success: false, message: 'YouTube player missing subtitle methods' };
    }

    player.updateSubtitlesUserSettings(updateSettings);
    return { success: true, message: 'Applied YouTube setting successfully' };
  } catch (error) {
    logError('general', 'apply setting', error);
    return { success: false, message: `Failed to apply YouTube setting: ${error}` };
  }
}

export const youtube: PlatformConfig = {
  selector: '.ytp-caption-segment',
  name: 'YouTube',
  settings: {
    characterEdgeStyle: {
      getCurrentValue(): CharacterEdgeStyle | undefined {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.charEdgeStyle !== undefined) {
          return REVERSE_EDGE_STYLE_MAP[displaySettings.charEdgeStyle] ?? 'auto';
        }
        return undefined;
      },
      applySetting(value: string): SettingApplicationReport {
        const edgeValue = value as keyof typeof EDGE_STYLE_MAP;
        const charEdgeStyle = EDGE_STYLE_MAP[edgeValue] ?? 2;
        return applyYouTubeSetting({ charEdgeStyle });
      }
    },
    backgroundOpacity: {
      getCurrentValue(): StorageSettings['backgroundOpacity'] | undefined {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.backgroundOpacity !== undefined) {
          return `${Math.round(displaySettings.backgroundOpacity * 100)}` as StorageSettings['backgroundOpacity'];
        }
        return '0';
      },
      applySetting(value: string): SettingApplicationReport {
        const backgroundOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ backgroundOpacity });
      }
    },
    windowOpacity: {
      getCurrentValue(): StorageSettings['windowOpacity'] | undefined {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.windowOpacity !== undefined) {
          return `${Math.round(displaySettings.windowOpacity * 100)}` as StorageSettings['windowOpacity'];
        }
        return '0';
      },
      applySetting(value: string): SettingApplicationReport {
        const windowOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ windowOpacity });
      }
    }
  }
};