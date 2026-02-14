
export type CharacterEdgeStyle = 'auto' | 'dropshadow' | 'none' | 'raised' | 'depressed' | 'outline';

export interface StorageSettings {
  characterEdgeStyle: CharacterEdgeStyle;
  backgroundOpacity: 'auto' | '0' | '25' | '50' | '75' | '100';
  windowOpacity: 'auto' | '0' | '25' | '50' | '75' | '100';
}


export interface SettingApplicationReport {
  success: boolean;
  message: string;
}

export interface PlatformSettingConfig {
  getCurrentValue(): StorageSettings[keyof StorageSettings] | undefined;
  applySetting(value: StorageSettings[keyof StorageSettings]): SettingApplicationReport;
}

export interface CssConfig {
  subtitleContainerSelector: string;
}

export interface PlatformConfig {
  name: string;
  settings: {
    [K in keyof StorageSettings]: PlatformSettingConfig;
  };
  css?: CssConfig;
  detectNativeCapabilities?(): boolean;
  getCurrentNativeSettings?(): Partial<StorageSettings> | null;
  applyNativeSetting?(setting: keyof StorageSettings, value: string): boolean;
}

export type Platform = 'youtube' | 'nebula';

export type PlatformRegistry = {
  [platformName: string]: PlatformConfig;
};

export interface ApplicationLog {
  [setting: string]: {
    success: boolean;
    details?: string;
  };
}

export type StorageKey = keyof StorageSettings;

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
export type StorageChanges = { [key: string]: chrome.storage.StorageChange };

export interface ChromeStorageBridge {
  get(): Promise<Record<string, unknown>>;
  set(settings: Partial<StorageSettings>): Promise<void>;
  onChanged: {
    addListener(callback: (changes: Record<string, unknown>) => void): void;
  };
}

export interface SubtitleStylerBridge {
  storage: ChromeStorageBridge;
}

export interface ExtendedWindow extends Window {
  subtitleStylerBridge?: SubtitleStylerBridge;
}

