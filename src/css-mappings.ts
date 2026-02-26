import type { StorageSettings, AppliesTo } from './types/index.js';

export interface CssSettingMapping {
  property: string;
  appliesTo: AppliesTo;
  isOpacity?: boolean;
  valueMap?: Record<string, string>;
}

export const CSS_SETTING_MAPPINGS: {
  [K in keyof StorageSettings]: CssSettingMapping;
} = {
  characterEdgeStyle: {
    property: 'textShadow',
    appliesTo: 'subtitle',
    valueMap: {
      dropshadow:
        '2px 2px 3px rgba(0,0,0,1), 0px 0px 6px rgba(0,0,0,0.9), 1px 1px 8px rgba(0,0,0,0.8)',
      none: 'none',
      raised: '1px 1px 0px #222, -1px -1px 0px #fff',
      depressed: '-1px -1px 0px #222, 1px 1px 0px #fff',
      outline:
        '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
      auto: '',
    },
  },
  backgroundOpacity: {
    property: 'backgroundColor',
    appliesTo: 'background',
    isOpacity: true,
  },
  windowOpacity: {
    property: 'backgroundColor',
    appliesTo: 'window',
    isOpacity: true,
  },
  fontColor: {
    property: 'color',
    appliesTo: 'subtitle',
    valueMap: {
      white: '#fff',
      yellow: '#ff0',
      green: '#0f0',
      cyan: '#0ff',
      blue: '#00f',
      magenta: '#f0f',
      red: '#f00',
      black: '#000',
    },
  },
  fontOpacity: {
    property: 'opacity',
    appliesTo: 'subtitle',
  },
  backgroundColor: {
    property: 'backgroundColor',
    appliesTo: 'background',
    valueMap: {
      white: '#fff',
      yellow: '#ff0',
      green: '#0f0',
      cyan: '#0ff',
      blue: '#00f',
      magenta: '#f0f',
      red: '#f00',
      black: '#000',
    },
  },
  windowColor: {
    property: 'backgroundColor',
    appliesTo: 'window',
    valueMap: {
      white: '#fff',
      yellow: '#ff0',
      green: '#0f0',
      cyan: '#0ff',
      blue: '#00f',
      magenta: '#f0f',
      red: '#f00',
      black: '#000',
    },
  },
  fontFamily: {
    property: 'fontFamily',
    appliesTo: 'subtitle',
    valueMap: {
      // YouTube uses Courier New for "Monospaced Serif" (Courier has serifs)
      'monospaced-serif': '"Courier New", Courier, "Nimbus Mono L", monospace',
      // YouTube uses Times New Roman for "Proportional Serif"
      'proportional-serif': '"Times New Roman", Times, Georgia, serif',
      // Monospaced Sans-Serif needs a sans-serif monospace (no serifs)
      'monospaced-sans-serif': '"Lucida Console", "Consolas", "DejaVu Sans Mono", monospace',
      // YouTube uses Roboto/Arial for "Proportional Sans-Serif"
      'proportional-sans-serif': 'Roboto, Arial, Helvetica, sans-serif',
      casual: '"Comic Sans MS", "Chalkboard SE", cursive, sans-serif',
      cursive: '"Monotype Corsiva", "URW Chancery L", cursive',
      // Small Caps uses the same font but with font-variant applied via CSS
      'small-caps': 'Roboto, Arial, Helvetica, sans-serif',
    },
  },
  fontSize: {
    property: 'fontSize',
    appliesTo: 'subtitle',
  },
};

function getCssProperty(jsProperty: string): string {
  switch (jsProperty) {
    case 'textShadow':
      return 'text-shadow';
    case 'backgroundColor':
      return 'background-color';
    case 'color':
      return 'color';
    case 'opacity':
      return 'opacity';
    case 'fontFamily':
      return 'font-family';
    case 'fontSize':
      return 'font-size';
    default:
      throw new Error(`Unexpected CSS property mapping requested: ${jsProperty}`);
  }
}

export function generateCssRule(mapping: CssSettingMapping, value: string): string | null {
  try {
    const cssValue = mapping.valueMap?.[value] ?? value;
    if (cssValue === '' || cssValue === 'auto') {
      return null;
    }
    const cssProperty = getCssProperty(mapping.property);
    return `${cssProperty}: ${cssValue} !important;`;
  } catch (e) {
    console.error(`Failed to generate CSS rule for ${mapping.property}:`, e);
    return null;
  }
}

export function generateCombinedCssRules(
  appliesTo: AppliesTo,
  settings: Partial<Record<keyof StorageSettings, string>>,
): string[] {
  const rules: string[] = [];

  // Identifiers for color/opacity pairs
  const pairs: Record<
    string,
    { colorKey?: keyof StorageSettings; opacityKey?: keyof StorageSettings }
  > = {
    background: { colorKey: 'backgroundColor', opacityKey: 'backgroundOpacity' },
    window: { colorKey: 'windowColor', opacityKey: 'windowOpacity' },
    subtitle: { colorKey: 'fontColor', opacityKey: 'fontOpacity' },
  };

  const pair = pairs[appliesTo];
  const handledKeys = new Set<keyof StorageSettings>();

  if (pair) {
    const colorValue = (pair.colorKey ? settings[pair.colorKey] : undefined) ?? 'auto';
    const opacityValue = (pair.opacityKey ? settings[pair.opacityKey] : undefined) ?? 'auto';

    if ((colorValue !== 'auto' || opacityValue !== 'auto') && pair.colorKey) {
      const mapping = CSS_SETTING_MAPPINGS[pair.colorKey];
      const cssProperty = getCssProperty(mapping.property);

      let finalValue: string;
      const color = (colorValue !== 'auto' ? mapping.valueMap?.[colorValue] : undefined) ?? 'black';
      const opacity = opacityValue !== 'auto' ? parseInt(opacityValue) / 100 : 1;

      if (opacityValue !== 'auto') {
        const percentage = Math.round((1 - opacity) * 100);
        finalValue = `color-mix(in srgb, ${color}, transparent ${percentage.toString()}%)`;
      } else {
        finalValue = color;
      }

      rules.push(`${cssProperty}: ${finalValue} !important;`);
      handledKeys.add(pair.colorKey);
      if (pair.opacityKey) handledKeys.add(pair.opacityKey);
    } else if (colorValue === 'auto' && opacityValue === 'auto') {
      // mark as handled to avoid generateCssRule trying to process them individually
      if (pair.colorKey) handledKeys.add(pair.colorKey);
      if (pair.opacityKey) handledKeys.add(pair.opacityKey);
    }
  }

  // Handle remaining settings
  for (const [key, value] of Object.entries(settings)) {
    const sKey = key as keyof StorageSettings;
    if (handledKeys.has(sKey)) continue;

    const mapping = CSS_SETTING_MAPPINGS[sKey];
    if (mapping.appliesTo === appliesTo && value) {
      const rule = generateCssRule(mapping, value);
      if (rule) rules.push(rule);
    }
  }

  return rules;
}
