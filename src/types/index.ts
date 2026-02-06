// Chrome Extension API types that aren't covered by @types/chrome
export type CharacterEdgeStyle = 'auto' | 'dropshadow' | 'none' | 'raised' | 'depressed' | 'outline';

export interface StorageSettings {
  characterEdgeStyle: CharacterEdgeStyle;
  backgroundOpacity: 'auto' | '0' | '25' | '50' | '75' | '100';
  windowOpacity: 'auto' | '0' | '25' | '50' | '75' | '100';
}

// Per-setting configuration for each platform
export interface SettingApplicationReport {
  success: boolean;
  message: string;
}

export interface PlatformSettingConfig {
  getCurrentValue(): StorageSettings[keyof StorageSettings] | undefined;
  applySetting(value: string): SettingApplicationReport;
}

export interface PlatformConfig {
  selector: string;
  name: string;
  settings: {
    [K in keyof StorageSettings]: PlatformSettingConfig;
  };
  detectNativeCapabilities?(): boolean;
  getCurrentNativeSettings?(): Partial<StorageSettings> | null;
  applyNativeSetting?(setting: keyof StorageSettings, value: string): boolean;
}

export type Platform = 'youtube' | 'netflix' | 'disney';

export type PlatformRegistry = {
  [platformName: string]: PlatformConfig;
};

export interface ApplicationLog {
  [setting: string]: {
    success: boolean;
    details?: string;
  };
}

export interface ProcessedSettings {
  native: {
    [K in keyof StorageSettings]?: StorageSettings[K];
  };
  css: {
    [K in keyof StorageSettings]?: StorageSettings[K];
  };
}

export type StorageKey = keyof StorageSettings;

export interface StyleElement extends HTMLElement {
  style: CSSStyleDeclaration;
  dataset: DOMStringMap;
}

export interface YouTubeDisplaySettings {
  background?: string;
  backgroundOpacity?: number;
  charEdgeStyle?: number;
  color?: string;
  fontFamily?: number;
  fontSizeIncrement?: number;
  fontStyle?: number;
  textOpacity?: number;
  windowColor?: string;
  windowOpacity?: number;
  [key: string]: unknown;
}

export interface YouTubePlayer {
  getSubtitlesUserSettings(): YouTubeDisplaySettings;
  updateSubtitlesUserSettings(settings: Partial<YouTubeDisplaySettings>): void;
}

export type YouTubePlayerElement = HTMLElement & YouTubePlayer;

export type DebugWindow = typeof window & { subtitleStylerDebug?: Function };
export type StorageChanges = { [key: string]: chrome.storage.StorageChange };
export type ValidCharacterEdgeStyles = readonly CharacterEdgeStyle[];
export type ValidOpacityValues = readonly StorageSettings['backgroundOpacity'][];
export type ValidationValuesMap = Record<keyof StorageSettings, string[]>;
