export type AppliesTo = 'subtitle' | 'background' | 'window';

export type CharacterEdgeStyle =
  | 'auto'
  | 'dropshadow'
  | 'none'
  | 'raised'
  | 'depressed'
  | 'outline';

export type OpacityValue = 'auto' | '0' | '25' | '50' | '75' | '100';
export type ColorValue =
  | 'auto'
  | 'white'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'magenta'
  | 'red'
  | 'black';

export type FontFamilyValue =
  | 'auto'
  | 'monospaced-serif'
  | 'proportional-serif'
  | 'monospaced-sans-serif'
  | 'proportional-sans-serif'
  | 'casual'
  | 'cursive'
  | 'small-caps';

export type FontSizeValue = 'auto' | '50%' | '75%' | '100%' | '150%' | '200%' | '300%' | '400%';

export interface StorageSettings {
  characterEdgeStyle: CharacterEdgeStyle;
  backgroundOpacity: OpacityValue;
  windowOpacity: OpacityValue;
  fontColor: ColorValue;
  fontOpacity: OpacityValue;
  backgroundColor: ColorValue;
  windowColor: ColorValue;
  fontFamily: FontFamilyValue;
  fontSize: FontSizeValue;
}

export interface SettingApplicationReport {
  success: boolean;
  message: string;
}

export interface PlatformSettingConfig {
  getCurrentValue: () => StorageSettings[keyof StorageSettings] | undefined;
  applySetting: (value: StorageSettings[keyof StorageSettings]) => SettingApplicationReport;
}

export interface CssConfig {
  subtitleContainerSelector: string;
  selectors: {
    subtitle: string;
    background: string;
    window: string;
  };
}

export interface PlatformConfig {
  name: string;
  nativeSettings?: {
    [K in keyof StorageSettings]: PlatformSettingConfig;
  };
  css?: CssConfig;
  baselineCss?: {
    subtitle?: string;
    background?: string;
    window?: string;
  };
  detectNativeCapabilities?(): boolean;
  getCurrentNativeSettings?(): Partial<StorageSettings> | null;
  applyNativeSetting?(setting: keyof StorageSettings, value: string): boolean;
}

export type Platform = 'youtube' | 'nebula' | 'dropout' | 'primevideo';

export type PlatformRegistry = Record<string, PlatformConfig>;

export type ApplicationLog = Record<
  string,
  {
    success: boolean;
    details?: string;
  }
>;

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
export type StorageChanges = Record<string, chrome.storage.StorageChange>;

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
