import type { StorageSettings } from './types/index.js';

export type AppliesTo = 'subtitle' | 'background' | 'window';

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
      dropshadow: '2px 2px 4px rgba(0,0,0,0.95)',
      none: 'none',
      raised:
        '-1px -1px 1px rgba(255,255,255,0.5), 1px -1px 1px rgba(255,255,255,0.5), -1px 1px 1px rgba(255,255,255,0.5), 1px 1px 1px rgba(255,255,255,0.5)',
      depressed: '1px 1px 1px rgba(0,0,0,0.5)',
      outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
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
};

function getCssProperty(jsProperty: string): string {
  switch (jsProperty) {
    case 'textShadow':
      return 'text-shadow';
    case 'backgroundColor':
      return 'background-color';
    default:
      throw new Error(`Unexpected CSS property mapping requested: ${jsProperty}`);
  }
}

export function generateCssRule(mapping: CssSettingMapping, value: string): string | null {
  try {
    const cssValue =
      mapping.valueMap?.[value] ?? (mapping.isOpacity ? opacityToRgba(value) : value);
    if (cssValue === '') {
      return null;
    }
    const cssProperty = getCssProperty(mapping.property);
    // Use !important to override inline styles or high-specificity rules from the site
    return `${cssProperty}: ${cssValue} !important;`;
  } catch (e) {
    console.error(`Failed to generate CSS rule for ${mapping.property}:`, e);
    return null;
  }
}

function opacityToRgba(value: string): string {
  if (value === 'auto') return '';
  const opacity = parseInt(value, 10) / 100;
  return `rgba(0, 0, 0, ${opacity.toString()})`;
}
