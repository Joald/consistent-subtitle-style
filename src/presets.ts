import type { StorageSettings } from './types/index.js';
import type { CustomPreset } from './custom-presets.js';

export interface Preset {
  /** Unique identifier (slug) */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** Brief description */
  description?: string;
  /** Whether this is the recommended default */
  isRecommended?: boolean;
  /** Whether this is a dev-only preset (hidden in production builds) */
  devOnly?: boolean;
  /** Whether this is a user-created custom preset */
  isCustom?: boolean;
  /** The settings this preset applies */
  settings: StorageSettings;
}

const ALL_AUTO: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto',
  fontColor: 'auto',
  fontOpacity: 'auto',
  backgroundColor: 'auto',
  windowColor: 'auto',
  fontFamily: 'auto',
  fontSize: 'auto',
};

const PRODUCTION_PRESETS: Preset[] = [
  {
    id: 'recommended',
    name: 'Recommended',
    description: 'Drop shadow, sans-serif font, transparent background — clean and readable',
    isRecommended: true,
    settings: {
      ...ALL_AUTO,
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '0',
      windowOpacity: '0',
      fontFamily: 'proportional-sans-serif',
    },
  },
  {
    id: 'classic',
    name: 'High Contrast',
    description: 'Traditional white-on-black subtitles',
    settings: {
      ...ALL_AUTO,
      fontColor: 'white',
      backgroundColor: 'black',
      backgroundOpacity: '75',
      characterEdgeStyle: 'none',
    },
  },
  {
    id: 'minimal',
    name: 'Do Nothing',
    description: 'No decoration — site defaults for everything',
    settings: { ...ALL_AUTO },
  },
];

const DEV_PRESETS: Preset[] = [
  {
    id: 'dev-high-contrast',
    name: 'High Contrast',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'outline',
      backgroundOpacity: '100',
      windowOpacity: '75',
      fontColor: 'yellow',
      fontOpacity: '100',
      backgroundColor: 'black',
      windowColor: 'black',
      fontFamily: 'auto',
      fontSize: '150%',
    },
  },
  {
    id: 'dev-monospace',
    name: 'Monospace Serif',
    devOnly: true,
    settings: {
      ...ALL_AUTO,
      characterEdgeStyle: 'outline',
      fontFamily: 'monospaced-serif',
    },
  },
  {
    id: 'dev-colorful',
    name: 'Colorful',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '75',
      windowOpacity: '50',
      fontColor: 'cyan',
      fontOpacity: '100',
      backgroundColor: 'magenta',
      windowColor: 'green',
      fontFamily: 'casual',
      fontSize: '150%',
    },
  },
  {
    id: 'dev-large',
    name: 'Large Text',
    devOnly: true,
    settings: {
      ...ALL_AUTO,
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '0',
      windowOpacity: '0',
      fontColor: 'white',
      fontOpacity: '100',
      fontSize: '300%',
    },
  },
  {
    id: 'dev-transparent',
    name: 'Fully Transparent',
    devOnly: true,
    settings: {
      ...ALL_AUTO,
      characterEdgeStyle: 'none',
      fontOpacity: '25',
      backgroundOpacity: '0',
      windowOpacity: '0',
    },
  },
  {
    id: 'dev-everything',
    name: 'Everything On',
    devOnly: true,
    settings: {
      characterEdgeStyle: 'raised',
      backgroundOpacity: '100',
      windowOpacity: '100',
      fontColor: 'yellow',
      fontOpacity: '100',
      backgroundColor: 'blue',
      windowColor: 'red',
      fontFamily: 'cursive',
      fontSize: '200%',
    },
  },
];

/**
 * Returns all available presets for the current build mode.
 * Dev presets are included only when `isDev` is true.
 * Custom presets (if provided) are inserted after production presets.
 */
export function getAvailablePresets(isDev: boolean, customPresets?: CustomPreset[]): Preset[] {
  const custom: Preset[] = (customPresets ?? []).map((cp) => ({
    id: cp.id,
    name: cp.name,
    isCustom: true,
    settings: cp.settings,
  }));
  if (isDev) {
    return [...PRODUCTION_PRESETS, ...custom, ...DEV_PRESETS];
  }
  return [...PRODUCTION_PRESETS, ...custom];
}

/**
 * Look up a preset by id. Searches production presets first, then custom, then dev presets.
 */
export function getPresetById(id: string, customPresets?: CustomPreset[]): Preset | undefined {
  const prod = PRODUCTION_PRESETS.find((p) => p.id === id);
  if (prod) return prod;

  if (customPresets) {
    const custom = customPresets.find((cp) => cp.id === id);
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        isCustom: true,
        settings: custom.settings,
      };
    }
  }

  return DEV_PRESETS.find((p) => p.id === id);
}

/**
 * Check whether the given settings exactly match a known preset's settings.
 * Returns the matching preset id, or null if no match.
 */
export function detectActivePreset(
  settings: StorageSettings,
  isDev: boolean,
  customPresets?: CustomPreset[],
): string | null {
  const presets = getAvailablePresets(isDev, customPresets);
  for (const preset of presets) {
    const keys = Object.keys(preset.settings) as (keyof StorageSettings)[];
    const match = keys.every((k) => settings[k] === preset.settings[k]);
    if (match) return preset.id;
  }
  return null;
}
