import { loadSettings, Settings } from './storage.js';
import { detectPlatform, getPlatformConfig } from './platforms/index.js';
import { debug } from './debug.js';
import { CSS_SETTING_MAPPINGS, generateCombinedCssRules } from './css-mappings.js';
import type {
  StorageSettings,
  PlatformConfig,
  ApplicationLog,
  Platform,
  ExtendedWindow,
  AppliesTo,
} from './types/index.js';

type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };

class SubtitleStylerApp {
  private currentSettings: StorageSettings = {
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
  private settings = new Settings(this.currentSettings);
  private currentPlatform: Platform | 'unknown' = 'unknown';
  private platformConfig: PlatformConfig | null = null;
  private applicationLog: ApplicationLog = {};
  private styleElement: HTMLStyleElement | null = null;

  constructor() {
    this.setupDebug();
    this.setupMessageListener();
    this.setupMutationObserver();
  }

  private setupMutationObserver(): void {
    let timeout: number | null = null;
    const observer = new MutationObserver((mutations) => {
      if (!this.platformConfig?.nativeSettings) return;

      let shouldReapply = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          if (
            node.tagName === 'VIDEO' ||
            node.querySelector('video') ||
            node.classList.contains('html5-video-player') ||
            node.classList.contains('vp-player') ||
            node.classList.contains('vjs-player') ||
            node.querySelector('.html5-video-player, .vp-player, .vjs-player')
          ) {
            shouldReapply = true;
            break;
          }
        }
        if (shouldReapply) break;
      }

      if (shouldReapply) {
        if (timeout) window.clearTimeout(timeout);
        timeout = window.setTimeout(() => {
          debug.log('New player detected via MutationObserver, re-applying styles');
          this.applyStyles();
          timeout = null;
        }, 500);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
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
        const hasNativeCapabilities =
          platform.detectNativeCapabilities === undefined || platform.detectNativeCapabilities();

        if (hasNativeCapabilities) {
          const config = platform.nativeSettings[key];
          const currentValue = config.getCurrentValue();

          if (currentValue !== undefined && currentValue === value) {
            continue;
          }

          toApply.push({ key, value, type: 'native' });
          // If we successfully identified a native setting to apply, we prefer it
          // over a CSS fallback to avoid double-application/compounding.
          continue;
        }
      }

      if (platform.css?.selectors) {
        toApply.push({ key, value, type: 'css' });
      }
    }

    return toApply;
  }

  private applyStyles(): void {
    console.log('[CSS-STYL] app.applyStyles() called');
    if (!this.platformConfig) {
      console.warn('[CSS-STYL] applyStyles failed: No platform configuration found');
      return;
    }

    const toApply = this.processSettings(this.platformConfig, this.currentSettings);
    console.log('[CSS-STYL] Settings to apply:', toApply);

    for (const { key } of toApply) {
      this.applicationLog[key] = { success: false };
    }

    const cssByAppliesTo: Partial<
      Record<AppliesTo, Partial<Record<keyof StorageSettings, string>>>
    > = {};

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
        const group = mapping.appliesTo;
        const groupSettings = (cssByAppliesTo[group] ??= {});
        groupSettings[key] = value as string;

        if (this.applicationLog[key]) {
          this.applicationLog[key].success = true;
          this.applicationLog[key].details = 'CSS rule queued';
        }
      }
    }

    const cssRules: string[] = [];

    if (this.platformConfig.baselineCss && this.platformConfig.css?.selectors) {
      const { baselineCss } = this.platformConfig;
      const selectors = this.platformConfig.css.selectors;
      if (baselineCss.subtitle && selectors.subtitle) {
        cssRules.push(`${selectors.subtitle} { ${baselineCss.subtitle} }`);
      }
      if (baselineCss.background && selectors.background) {
        cssRules.push(`${selectors.background} { ${baselineCss.background} }`);
      }
      if (baselineCss.window && selectors.window) {
        cssRules.push(`${selectors.window} { ${baselineCss.window} }`);
      }
    }

    if (this.platformConfig.css?.selectors) {
      const selectors = this.platformConfig.css.selectors;
      for (const group of Object.keys(cssByAppliesTo)) {
        const appliesTo = group as AppliesTo;
        const selector = selectors[appliesTo];
        const settings = cssByAppliesTo[appliesTo];
        if (settings) {
          const combinedRules = generateCombinedCssRules(appliesTo, settings);
          if (combinedRules.length > 0) {
            cssRules.push(`${selector} { ${combinedRules.join(' ')} }`);
          }
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
    console.log('[CSS-STYL] SubtitleStylerApp initializing...');
    try {
      this.currentPlatform = detectPlatform();
      console.log(
        `[CSS-STYL] Detected platform: ${this.currentPlatform} for host: ${window.location.host}`,
      );
      this.platformConfig = getPlatformConfig(this.currentPlatform);

      if (!this.platformConfig) {
        debug.error(`No configuration found for platform: ${this.currentPlatform}`);
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
      debug.error('Failed to initialize extension:', error);

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
      // For subtitleStylerChanged, accept messages from parent/sibling frames too
      // (injection.ts in the top frame relays storage changes to VHX iframes).
      // For other message types (bridge requests), require same-window origin.
      if (event.data.type === 'subtitleStylerChanged') {
        // Accept from any source — the message type is specific enough.
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
            debug.error(`Failed to apply updated styles on ${this.platformConfig.name}:`, error);
          }
        }
      }
    });

    // YouTube SPA navigation support
    window.addEventListener('yt-navigate-finish', () => {
      if (this.currentPlatform === 'youtube') {
        debug.log('YouTube navigation detected, re-applying styles');
        this.applyStyles();
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
