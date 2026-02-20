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
      raised: '-1px -1px 1px rgba(255,255,255,0.5), 1px -1px 1px rgba(255,255,255,0.5), -1px 1px 1px rgba(255,255,255,0.5), 1px 1px 1px rgba(255,255,255,0.5)',
      depressed: '1px 1px 1px rgba(0,0,0,0.5)',
      outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
      auto: ''
    }
  },
  backgroundOpacity: {
    property: 'backgroundColor',
    appliesTo: 'background',
    isOpacity: true
  },
  windowOpacity: {
    property: 'backgroundColor',
    appliesTo: 'window',
    isOpacity: true
  }
};

export function applyCssSetting(
  elements: NodeListOf<Element>,
  mapping: CssSettingMapping,
  value: string
): SettingApplicationReport {
  try {
    const cssValue = mapping.valueMap?.[value] ?? (mapping.isOpacity ? opacityToRgba(value) : value);

    elements.forEach(element => {
      const target = mapping.appliesTo === 'window' ? element.parentElement : element;
      if (target instanceof HTMLElement) {
        if (cssValue === '' || cssValue === undefined) {
          target.style[mapping.property as any] = '';
        } else {
          target.style[mapping.property as any] = cssValue;
        }
      }
    });

    return { success: true, message: `Applied ${mapping.property}: ${cssValue}` };
  } catch (e) {
    return { success: false, message: `Failed to apply ${mapping.property}: ${e}` };
  }
}

function opacityToRgba(value: string): string {
  if (value === 'auto') return '';
  const opacity = parseInt(value) / 100;
  return `rgba(0, 0, 0, ${opacity})`;
}

interface SettingApplicationReport {
  success: boolean;
  message: string;
}
