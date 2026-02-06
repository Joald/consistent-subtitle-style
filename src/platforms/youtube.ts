import type { PlatformConfig, StorageSettings, YouTubeDisplaySettings, CharacterEdgeStyle, SettingApplicationReport, YouTubePlayerElement } from '../types/index.js';

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
  console.log('DEBUG: Searching for YouTube player...');
  
  // Try to get the YouTube player instance from the global scope
  const moviePlayer = document.querySelector('#movie_player') as any;
  const playerElement = document.querySelector('#player') as any;
  console.log('DEBUG: #movie_player DOM element:', moviePlayer);
  console.log('DEBUG: #player DOM element:', playerElement);
  
  // Check if we need to wait for player initialization
  if (moviePlayer) {
    // Method 1: Check if the element has YouTube API properties directly
    if (moviePlayer.getSubtitlesUserSettings && moviePlayer.updateSubtitlesUserSettings) {
      console.log('DEBUG: Found YouTube API methods directly on #movie_player');
      return moviePlayer as YouTubePlayerElement;
    }
    
    // Method 2: Check for YouTube API in element properties
    const possibleApiProps = ['__ytPlayer__', 'player', 'api', 'ytPlayer', '_player', 'ytcPlayer', 'ytdPlayer'];
    for (const prop of possibleApiProps) {
      if (moviePlayer[prop] && typeof moviePlayer[prop] === 'object') {
        console.log(`DEBUG: Checking property ${prop}:`, moviePlayer[prop]);
        if (moviePlayer[prop].getSubtitlesUserSettings && moviePlayer[prop].updateSubtitlesUserSettings) {
          console.log(`DEBUG: Found YouTube API in ${prop}`);
          return moviePlayer[prop] as YouTubePlayerElement;
        }
      }
    }
    
    // Method 3: Check if playerElement has the API
    if (playerElement) {
      for (const prop of possibleApiProps) {
        if (playerElement[prop] && typeof playerElement[prop] === 'object') {
          if (playerElement[prop].getSubtitlesUserSettings && playerElement[prop].updateSubtitlesUserSettings) {
            console.log(`DEBUG: Found YouTube API in #player.${prop}`);
            return playerElement[prop] as YouTubePlayerElement;
          }
        }
      }
    }
    
    // Method 4: Check for YouTube's internal player systems
    const windowAny = window as any;
    console.log('DEBUG: Checking global window object for YouTube player...');
    
    // YouTube often stores the player in yt.config or similar
    if (windowAny.yt?.config?.PLAYER_CONFIG) {
      console.log('DEBUG: Found yt.config.PLAYER_CONFIG');
    }
    
    // Check for ytplayer or similar global references
    const globalRefs = [
      'ytplayer', 'ytPlayer', 'player', 'ytcPlayer', 
      'yt', 'YOUTUBE_PLAYER', 'videoPlayer'
    ];
    
    for (const ref of globalRefs) {
      if (windowAny[ref] && typeof windowAny[ref] === 'object') {
        console.log(`DEBUG: Found global ${ref}:`, windowAny[ref]);
        const obj = windowAny[ref];
        
        // Check direct methods
        if (obj.getSubtitlesUserSettings && obj.updateSubtitlesUserSettings) {
          console.log(`DEBUG: Found YouTube API in ${ref}`);
          return obj as YouTubePlayerElement;
        }
        
        // Check nested properties
        for (const prop of ['player', 'api', 'instance', 'playerInstance']) {
          if (obj[prop] && obj[prop].getSubtitlesUserSettings) {
            console.log(`DEBUG: Found YouTube API in ${ref}.${prop}`);
            return obj[prop] as YouTubePlayerElement;
          }
        }
      }
    }
    
    // Method 5: Check for Polymer/web components that might have the API
    const polymerElements = [
      'ytd-player', 'ytd-watch-flexy', 'ytd-app'
    ];
    
    for (const tagName of polymerElements) {
      const element = document.querySelector(tagName);
      if (element) {
        console.log(`DEBUG: Checking ${tagName} element:`, element);
        const elementAny = element as any;
        
        for (const prop of possibleApiProps) {
          if (elementAny[prop] && elementAny[prop].getSubtitlesUserSettings) {
            console.log(`DEBUG: Found YouTube API in ${tagName}.${prop}`);
            return elementAny[prop] as YouTubePlayerElement;
          }
        }
      }
    }
    
    // Method 6: Try to access the YouTube player through the video element
    const videoElement = document.querySelector('video');
    if (videoElement) {
      console.log('DEBUG: Checking video element:', videoElement);
      const videoAny = videoElement as any;
      
      for (const prop of possibleApiProps) {
        if (videoAny[prop] && videoAny[prop].getSubtitlesUserSettings) {
          console.log(`DEBUG: Found YouTube API in video.${prop}`);
          return videoAny[prop] as YouTubePlayerElement;
        }
      }
    }
    
    // Method 7: Check if we can find any object with the right methods by searching the entire window
    console.log('DEBUG: Desperate search for player API...');
    const findPlayerAPI = (obj: any, depth: number = 0, maxDepth: number = 3): any => {
      if (depth > maxDepth || !obj || typeof obj !== 'object') return null;
      
      if (obj.getSubtitlesUserSettings && obj.updateSubtitlesUserSettings) {
        console.log('DEBUG: Found player API at depth', depth);
        return obj;
      }
      
      try {
        for (const key in obj) {
          if (key.includes('player') || key.includes('Player') || key.includes('yt')) {
            const result = findPlayerAPI(obj[key], depth + 1, maxDepth);
            if (result) return result;
          }
        }
      } catch (e) {
        // Ignore access errors
      }
      
      return null;
    };
    
    const foundAPI = findPlayerAPI(windowAny);
    if (foundAPI) {
      console.log('DEBUG: Found YouTube API through deep search');
      return foundAPI as YouTubePlayerElement;
    }
  }
  
  console.log('DEBUG: YouTube player API not found anywhere, returning null');
  return null;
}

function logError(setting: string, operation: string, error: unknown): void {
  console.error(`YouTube ${setting} ${operation} failed:`, error);
}

function getCurrentYouTubeSettings(): YouTubeDisplaySettings | null {
  try {
    const player = getYouTubePlayer();
    if (!player) {
      console.log('DEBUG: YouTube player element not found');
      return null;
    }
    
    console.log('DEBUG: YouTube player element found:', player);
    console.log('DEBUG: Player element type:', typeof player);
    console.log('DEBUG: Player element constructor:', player.constructor?.name);
    console.log('DEBUG: Available methods on player:', Object.getOwnPropertyNames(Object.getPrototypeOf(player)));
    console.log('DEBUG: getSubtitlesUserSettings method:', typeof player.getSubtitlesUserSettings);
    console.log('DEBUG: updateSubtitlesUserSettings method:', typeof player.updateSubtitlesUserSettings);
    
    if (!player.getSubtitlesUserSettings) {
      console.log('DEBUG: getSubtitlesUserSettings method not available');
      return null;
    }

    const displaySettings: YouTubeDisplaySettings = player.getSubtitlesUserSettings();
    console.log('DEBUG: Raw displaySettings:', displaySettings);
    console.log('DEBUG: displaySettings type:', typeof displaySettings);
    
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
      console.log('DEBUG: YouTube player element not found for apply setting');
      return { success: false, message: 'YouTube player not available' };
    }
    
    console.log('DEBUG: Player element in apply setting:', player);
    console.log('DEBUG: updateSubtitlesUserSettings method available:', typeof player.updateSubtitlesUserSettings);
    console.log('DEBUG: Settings to apply:', updateSettings);
    
    if (!player.updateSubtitlesUserSettings) {
      console.log('DEBUG: updateSubtitlesUserSettings method not available');
      return { success: false, message: 'YouTube player missing subtitle methods' };
    }

    const result = player.updateSubtitlesUserSettings(updateSettings);
    console.log('DEBUG: updateSubtitlesUserSettings returned:', result);
    
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