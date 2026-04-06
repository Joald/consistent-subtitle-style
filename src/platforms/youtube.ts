import type {
  PlatformConfig,
  StorageSettings,
  YouTubeDisplaySettings,
  CharacterEdgeStyle,
  SettingApplicationReport,
  YouTubePlayerElement,
} from '../types/index.js';
import { debug } from '../debug.js';

const COLOR_MAP = {
  white: '#fff',
  yellow: '#ff0',
  green: '#0f0',
  cyan: '#0ff',
  blue: '#00f',
  magenta: '#f0f',
  red: '#f00',
  black: '#080808',
} as const;

const REVERSE_COLOR_MAP: Record<string, keyof typeof COLOR_MAP> = Object.fromEntries(
  Object.entries(COLOR_MAP).map(([key, value]) => [value, key as keyof typeof COLOR_MAP]),
);

const FONT_FAMILY_MAP = {
  'monospaced-serif': 1,
  'proportional-serif': 2,
  'monospaced-sans-serif': 3,
  'proportional-sans-serif': 4,
  casual: 5,
  cursive: 6,
  'small-caps': 7,
} as const;

const REVERSE_FONT_FAMILY_MAP: Record<number, keyof typeof FONT_FAMILY_MAP> = Object.fromEntries(
  Object.entries(FONT_FAMILY_MAP).map(([key, value]) => [
    value,
    key as keyof typeof FONT_FAMILY_MAP,
  ]),
);

const FONT_SIZE_MAP = {
  '50%': -2,
  '75%': -1,
  '100%': 0,
  '150%': 1,
  '200%': 2,
  '300%': 3,
  '400%': 4,
} as const;

const REVERSE_FONT_SIZE_MAP: Record<number, keyof typeof FONT_SIZE_MAP> = Object.fromEntries(
  Object.entries(FONT_SIZE_MAP).map(([key, value]) => [value, key as keyof typeof FONT_SIZE_MAP]),
);

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

function getYouTubePlayers(): YouTubePlayerElement[] {
  return Array.from(document.querySelectorAll<YouTubePlayerElement>('.html5-video-player'));
}

function getCurrentYouTubeSettings(): YouTubeDisplaySettings | null {
  try {
    // Skip embedded players
    if (window.self !== window.top && !window.location.pathname.startsWith('/watch')) {
      return null;
    }

    const players = getYouTubePlayers();
    for (const player of players) {
      try {
        if (typeof player.getSubtitlesUserSettings === 'function') {
          return player.getSubtitlesUserSettings();
        }
      } catch {
        // Embedded player with broken API — skip
      }
    }
    return null;
  } catch (error) {
    debug.error('YouTube get settings failed:', error);
    return null;
  }
}

function applyYouTubeSetting(
  updateSettings: Partial<YouTubeDisplaySettings>,
): SettingApplicationReport {
  try {
    // Skip embedded players (e.g. YouTube previews on Google Search)
    // They have .html5-video-player but lack the full caption API
    if (window.self !== window.top && !window.location.pathname.startsWith('/watch')) {
      return {
        success: false,
        message: 'Skipped: embedded YouTube player without full caption API',
      };
    }

    const players = getYouTubePlayers();
    let appliedCount = 0;

    for (const player of players) {
      try {
        if (typeof player.updateSubtitlesUserSettings === 'function') {
          player.updateSubtitlesUserSettings(updateSettings);
          appliedCount++;
        }
      } catch (playerError) {
        debug.error('YouTube player setting failed (likely embedded/lite player):', playerError);
      }
    }

    if (appliedCount === 0) {
      return {
        success: false,
        message: 'No active YouTube players found to apply settings to',
      };
    }

    return {
      success: true,
      message: `Applied YouTube setting to ${appliedCount.toString()} player(s)`,
    };
  } catch (error) {
    debug.error('YouTube apply setting failed:', error);
    return { success: false, message: `Failed to apply YouTube setting: ${String(error)}` };
  }
}

export const youtube: PlatformConfig = {
  name: 'YouTube',
  detectNativeCapabilities(): boolean {
    // Any YouTube page can potentially have a player (main, mini, preview)
    return true;
  },
  nativeSettings: {
    characterEdgeStyle: {
      getCurrentValue: (): StorageSettings['characterEdgeStyle'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.charEdgeStyle !== undefined) {
          return REVERSE_EDGE_STYLE_MAP[displaySettings.charEdgeStyle] ?? 'auto';
        }
        return undefined;
      },
      applySetting: (value: string): SettingApplicationReport => {
        const edgeValue = value as keyof typeof EDGE_STYLE_MAP;
        const charEdgeStyle = EDGE_STYLE_MAP[edgeValue];
        return applyYouTubeSetting({ charEdgeStyle });
      },
    },
    backgroundOpacity: {
      getCurrentValue: (): StorageSettings['backgroundOpacity'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.backgroundOpacity !== undefined) {
          return Math.round(
            displaySettings.backgroundOpacity * 100,
          ).toString() as StorageSettings['backgroundOpacity'];
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const backgroundOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ backgroundOpacity });
      },
    },
    windowOpacity: {
      getCurrentValue: (): StorageSettings['windowOpacity'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.windowOpacity !== undefined) {
          return Math.round(
            displaySettings.windowOpacity * 100,
          ).toString() as StorageSettings['windowOpacity'];
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const windowOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ windowOpacity });
      },
    },
    fontColor: {
      getCurrentValue: (): StorageSettings['fontColor'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        const color = displaySettings?.color;
        if (color && color in REVERSE_COLOR_MAP) {
          return REVERSE_COLOR_MAP[color];
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const color = COLOR_MAP[value as keyof typeof COLOR_MAP];
        return applyYouTubeSetting({ color });
      },
    },
    fontOpacity: {
      getCurrentValue: (): StorageSettings['fontOpacity'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.textOpacity !== undefined) {
          return Math.round(
            displaySettings.textOpacity * 100,
          ).toString() as StorageSettings['fontOpacity'];
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const textOpacity = parseInt(value) / 100;
        return applyYouTubeSetting({ textOpacity });
      },
    },
    backgroundColor: {
      getCurrentValue: (): StorageSettings['backgroundColor'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        const background = displaySettings?.background;
        if (background && background in REVERSE_COLOR_MAP) {
          return REVERSE_COLOR_MAP[background];
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const background = COLOR_MAP[value as keyof typeof COLOR_MAP];
        return applyYouTubeSetting({ background });
      },
    },
    windowColor: {
      getCurrentValue: (): StorageSettings['windowColor'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        const windowColor = displaySettings?.windowColor;
        if (windowColor && windowColor in REVERSE_COLOR_MAP) {
          return REVERSE_COLOR_MAP[windowColor];
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const windowColor = COLOR_MAP[value as keyof typeof COLOR_MAP];
        return applyYouTubeSetting({ windowColor });
      },
    },
    fontFamily: {
      getCurrentValue: (): StorageSettings['fontFamily'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.fontFamily !== undefined) {
          return REVERSE_FONT_FAMILY_MAP[displaySettings.fontFamily] ?? 'auto';
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const fontFamily = FONT_FAMILY_MAP[value as keyof typeof FONT_FAMILY_MAP];
        return applyYouTubeSetting({ fontFamily });
      },
    },
    fontSize: {
      getCurrentValue: (): StorageSettings['fontSize'] | undefined => {
        const displaySettings = getCurrentYouTubeSettings();
        if (displaySettings?.fontSizeIncrement !== undefined) {
          return REVERSE_FONT_SIZE_MAP[displaySettings.fontSizeIncrement] ?? 'auto';
        }
        return 'auto';
      },
      applySetting: (value: string): SettingApplicationReport => {
        if (value === 'auto') return { success: true, message: 'Skip auto value' };
        const fontSizeIncrement = FONT_SIZE_MAP[value as keyof typeof FONT_SIZE_MAP];
        return applyYouTubeSetting({ fontSizeIncrement });
      },
    },
  },
};
