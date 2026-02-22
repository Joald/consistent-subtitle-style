import { loadSettings, Settings } from './storage.js';
import { detectPlatform, getPlatformConfig } from './platforms/index.js';
import { debug } from './debug.js';
import { CSS_SETTING_MAPPINGS, generateCssRule } from './css-mappings.js';
import type {
  StorageSettings,
  PlatformConfig,
  ApplicationLog,
  Platform,
  ExtendedWindow,
  SettingApplicationReport,
} from './types/index.js';

type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };

class SubtitleStylerApp {
  private currentSettings: StorageSettings = {
    characterEdgeStyle: 'auto',
    backgroundOpacity: 'auto',
    windowOpacity: 'auto',
  };
  private settings = new Settings(this.currentSettings);
  private currentPlatform: Platform | 'unknown' = 'unknown';
  private platformConfig: PlatformConfig | null = null;
  private applicationLog: ApplicationLog = {};
  private styleElement: HTMLStyleElement | null = null;

  constructor() {
    this.setupDebug();
    this.setupMessageListener();
  }

  private setupDebug(): void {
    (window as DebugWindow).subtitleStylerDebug = (): Record<string, unknown> => {
      return {
        platform: this.currentPlatform,
        settings: this.currentSettings,
        log: this.applicationLog,
        config: this.platformConfig,
        status: 'loading',
        chromeAPIs: typeof chrome !== 'undefined',
        playerElement: !!document.querySelector('#movie_player'),
        storageBridge: !!(window as ExtendedWindow).subtitleStylerBridge,
      };
    };
  }

  private processSettings(
    platform: PlatformConfig,
    extensionSettings: StorageSettings,
  ): {
    key: keyof StorageSettings;
    value: StorageSettings[keyof StorageSettings];
    type: 'native' | 'css';
  }[] {
    const toApply: {
      key: keyof StorageSettings;
      value: StorageSettings[keyof StorageSettings];
      type: 'native' | 'css';
    }[] = [];

    for (const [settingKey, settingValue] of Object.entries(extensionSettings)) {
      const key = settingKey as keyof StorageSettings;
      const value = settingValue as StorageSettings[keyof StorageSettings];

      if (value === 'auto') continue;

      if (platform.nativeSettings?.[key]) {
        const config = platform.nativeSettings[key];
        const currentValue = config.getCurrentValue();

        if (currentValue !== undefined && currentValue === value) {
          continue;
        }

        toApply.push({ key, value, type: 'native' });
      }

      if (platform.css?.selectors) {
        toApply.push({ key, value, type: 'css' });
      }
    }

    return toApply;
  }

  private applyStyles(): void {
    if (!this.platformConfig) return;

    const toApply = this.processSettings(this.platformConfig, this.currentSettings);

    for (const { key } of toApply) {
      this.applicationLog[key] = { success: false };
    }

    const cssRules: string[] = [];

    for (const { key, value, type } of toApply) {
      if (type === 'native' && this.platformConfig.nativeSettings?.[key]) {
        const config = this.platformConfig.nativeSettings[key];
        const report = config.applySetting(value);
        if (this.applicationLog[key]) {
          this.applicationLog[key].success = report.success;
          this.applicationLog[key].details = report.message;
        }
      } else if (type === 'css' && this.platformConfig.css?.selectors) {
        const mapping = CSS_SETTING_MAPPINGS[key];
        const selector = this.platformConfig.css.selectors[mapping.appliesTo];
        const ruleValue = generateCssRule(mapping, value as string);
        let report: SettingApplicationReport;

        if (ruleValue) {
          cssRules.push(`${selector} { ${ruleValue} }`);
          report = { success: true, message: `Generated CSS for ${key} (${mapping.property})` };
        } else {
          report = { success: true, message: `Skipped CSS for ${key} (auto check passed)` };
        }
        if (this.applicationLog[key]) {
          this.applicationLog[key].success = report.success;
          this.applicationLog[key].details = report.message;
        }
      }
    }

    this.injectCssRules(cssRules);
  }

  private injectCssRules(rules: string[]): void {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'subtitle-styler-dynamic-styles';
      document.head.appendChild(this.styleElement);
    }
    this.styleElement.textContent = rules.join('\n');
  }

  public async initialize(): Promise<void> {
    try {
      this.currentPlatform = detectPlatform();
      this.platformConfig = getPlatformConfig(this.currentPlatform);

      if (!this.platformConfig) {
        console.error(`No configuration found for platform: ${this.currentPlatform}`);
        return;
      }

      this.currentSettings = await loadSettings();
      this.settings = new Settings(this.currentSettings);

      this.applyStyles();

      debug.log(
        `Extension initialized - Platform: ${this.currentPlatform}, settings: ${Object.entries(
          this.currentSettings,
        )
          .filter(([, v]) => v !== 'auto')
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(', ')}`,
      );
    } catch (error) {
      console.error('Failed to initialize extension:', error);

      (window as DebugWindow).subtitleStylerDebug = (): Record<string, unknown> => {
        return {
          error: error instanceof Error ? error.message : String(error),
          platform: this.currentPlatform,
          settings: this.currentSettings,
          log: this.applicationLog,
          config: this.platformConfig,
        };
      };
    }
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent<{ type?: string; data?: unknown }>) => {
      if (event.source !== window) return;

      if (event.data.type === 'subtitleStylerChanged') {
        const changes = event.data.data as Record<string, { newValue?: unknown }>;

        const settingKeys = Object.keys(changes) as (keyof StorageSettings)[];
        settingKeys.forEach((key) => {
          if (key in this.currentSettings) {
            // Depending on how bridge sends it, it might be { newValue: "dropshadow" }
            const change = changes[key];
            if (change?.newValue !== undefined) {
              const newValue = change.newValue as string;
              if (this.settings.set(key, newValue)) {
                this.currentSettings = this.settings.toObject();
              }
            }
          }
        });

        if (this.platformConfig) {
          try {
            this.applyStyles();
          } catch (error) {
            console.error(`Failed to apply updated styles on ${this.platformConfig.name}:`, error);
          }
        }
      }
    });
  }
}

const app = new SubtitleStylerApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void app.initialize();
  });
} else {
  void app.initialize();
}
