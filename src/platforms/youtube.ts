import type {
  PlatformConfig,
  StorageSettings,
  YouTubeDisplaySettings,
  CharacterEdgeStyle,
  SettingApplicationReport,
  YouTubePlayerElement,
} from '../types/index.js';
import { debug } from '../debug.js';

const EDGE_STYLE_MAP = {
  none: 0,
  raised: 1,
  depressed: 2,
  outline: 3,
  dropshadow: 4,
} as const;

const REVERSE_EDGE_STYLE_MAP: Record<number, CharacterEdgeStyle> = Object.fromEntries(
  Object.entries(EDGE_STYLE_MAP).map(([key, value]) => [value, key as keyof typeof EDGE_STYLE_MAP]),
);

function getYouTubePlayer(): YouTubePlayerElement | null {
  const moviePlayer = document.querySelector<YouTubePlayerElement>('#movie_player');

  if (!moviePlayer) {
    debug.error('No HTML element with #movie_player found! cannot proceed');
    return null;
  }

  if (
    typeof moviePlayer.getSubtitlesUserSettings !== 'function' ||
    typeof moviePlayer.updateSubtitlesUserSettings !== 'function'
  ) {
    debug.error('Expected subtitle player API methods not found.');
    return null;
  }

  return moviePlayer;
}

function getCurrentYouTubeSettings(): YouTubeDisplaySettings | null {
  try {
    const player = getYouTubePlayer();
    if (!player) {
      return null;
    }

    const displaySettings: YouTubeDisplaySettings = player.getSubtitlesUserSettings();
    return displaySettings;
  } catch (error) {
    console.error('YouTube get settings failed:', error);
    return null;
  }
}

function applyYouTubeSetting(
  updateSettings: Partial<YouTubeDisplaySettings>,
): SettingApplicationReport {
  try {
    const player = getYouTubePlayer();
    if (!player) {
      return { success: false, message: 'YouTube player not available for applying settings' };
    }

    player.updateSubtitlesUserSettings(updateSettings);
    debug.log(
      `YouTube settings applied: ${Object.keys(updateSettings)
        .map((k) => `${k}=${String(updateSettings[k as keyof YouTubeDisplaySettings])}`)
        .join(', ')}`,
    );
    return { success: true, message: 'Applied YouTube setting successfully' };
  } catch (error) {
    console.error('YouTube apply setting failed:', error);
    return { success: false, message: `Failed to apply YouTube setting: ${String(error)}` };
  }
}

export const youtube: PlatformConfig = {
  name: 'YouTube',
  nativeSettings: {
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
        const charEdgeStyle = EDGE_STYLE_MAP[edgeValue];
        return applyYouTubeSetting({ charEdgeStyle });
      },
    },
    backgroundOpacity: {
      getCurrentValue(): StorageSettings['backgroundOpacity'] | undefined {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.backgroundOpacity !== undefined) {
          return Math.round(
            displaySettings.backgroundOpacity * 100,
          ).toString() as StorageSettings['backgroundOpacity'];
        }
        return '0';
      },
      applySetting(value: string): SettingApplicationReport {
        const backgroundOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ backgroundOpacity });
      },
    },
    windowOpacity: {
      getCurrentValue(): StorageSettings['windowOpacity'] | undefined {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.windowOpacity !== undefined) {
          return Math.round(
            displaySettings.windowOpacity * 100,
          ).toString() as StorageSettings['windowOpacity'];
        }
        return '0';
      },
      applySetting(value: string): SettingApplicationReport {
        const windowOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ windowOpacity });
      },
    },
  },
};
