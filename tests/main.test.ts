import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';
import type { StorageSettings, PlatformConfig } from '../src/types/index.js';

// Top-level mocks are hoisted
vi.mock('../src/storage.js', () => ({
  loadSettings: vi.fn(),
  loadActivePreset: vi.fn(),
  Settings: class {
    private settings: Record<string, unknown>;
    constructor(s: Record<string, unknown>) {
      this.settings = { ...s };
    }
    set(k: string, v: string): boolean {
      this.settings[k] = v;
      return true;
    }
    get(k: string): unknown {
      return this.settings[k];
    }
    toObject(): Record<string, unknown> {
      return { ...this.settings };
    }
    merge(p: Record<string, unknown>): Record<string, unknown> {
      Object.assign(this.settings, p);
      return this.settings;
    }
    updateFromStorageResult(r: Record<string, unknown>): void {
      this.merge(r);
    }
  },
}));

vi.mock('../src/site-settings.js', () => ({
  getEffectiveSettings: vi.fn(),
}));

vi.mock('../src/platforms/index.js', () => ({
  detectPlatform: vi.fn(),
  getPlatformConfig: vi.fn(),
}));

vi.mock('../src/css-mappings.js', () => ({
  CSS_SETTING_MAPPINGS: {
    fontColor: { appliesTo: 'subtitle', property: 'color' },
    fontSize: { appliesTo: 'subtitle', property: 'fontSize' },
    characterEdgeStyle: { appliesTo: 'subtitle', property: 'textShadow' },
    backgroundOpacity: { appliesTo: 'background', property: 'backgroundColor', isOpacity: true },
    windowOpacity: { appliesTo: 'window', property: 'backgroundColor', isOpacity: true },
    fontOpacity: { appliesTo: 'subtitle', property: 'opacity' },
    backgroundColor: { appliesTo: 'background', property: 'backgroundColor' },
    windowColor: { appliesTo: 'window', property: 'backgroundColor' },
    fontFamily: { appliesTo: 'subtitle', property: 'fontFamily' },
  },
  generateCombinedCssRules: vi.fn(),
}));

// ── Helper: default all-auto settings ──
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

// ── Helper: CSS-only YouTube config ──
function makeYouTubeConfig(overrides?: Partial<PlatformConfig>): PlatformConfig {
  return {
    name: 'YouTube',
    css: {
      subtitleContainerSelector: '.ytp-caption-window-container',
      selectors: {
        subtitle: '.ytp-caption-segment',
        background: '.ytp-caption-window-container',
        window: '.ytp-caption-window-container',
      },
    },
    baselineCss: { subtitle: 'font-family: Arial;' },
    ...overrides,
  };
}

// ── Shared setup/teardown ──
let addEventListenerSpy: Mock;
let loadSettingsMock: Mock;
let loadActivePresetMock: Mock;
let detectPlatformMock: Mock;
let getPlatformConfigMock: Mock;
let generateCombinedCssRulesMock: Mock;
let getEffectiveSettingsMock: Mock;

async function setupMocks(opts?: {
  settings?: StorageSettings;
  platform?: string;
  config?: PlatformConfig | null;
  cssRules?: string[];
  effectiveOverride?: boolean;
  effectiveSettings?: StorageSettings;
}) {
  vi.resetModules();
  vi.clearAllMocks();

  const { loadSettings, loadActivePreset } = await import('../src/storage.js');
  const { detectPlatform, getPlatformConfig } = await import('../src/platforms/index.js');
  const { generateCombinedCssRules } = await import('../src/css-mappings.js');
  const { getEffectiveSettings } = await import('../src/site-settings.js');

  loadSettingsMock = loadSettings as Mock;
  loadActivePresetMock = loadActivePreset as Mock;
  detectPlatformMock = detectPlatform as Mock;
  getPlatformConfigMock = getPlatformConfig as Mock;
  generateCombinedCssRulesMock = generateCombinedCssRules as Mock;
  getEffectiveSettingsMock = getEffectiveSettings as Mock;

  const settings = opts?.settings ?? { ...ALL_AUTO, fontColor: 'red' };
  loadSettingsMock.mockResolvedValue(settings);
  loadActivePresetMock.mockResolvedValue(null);

  const effectiveSettings = opts?.effectiveSettings ?? settings;
  getEffectiveSettingsMock.mockResolvedValue({
    settings: effectiveSettings,
    activePreset: null,
    isOverride: opts?.effectiveOverride ?? false,
  });

  detectPlatformMock.mockReturnValue(opts?.platform ?? 'youtube');
  getPlatformConfigMock.mockReturnValue(
    opts?.config !== undefined ? opts.config : makeYouTubeConfig(),
  );
  generateCombinedCssRulesMock.mockReturnValue(opts?.cssRules ?? ['color: red !important;']);

  addEventListenerSpy = vi.spyOn(window, 'addEventListener') as Mock;
  vi.spyOn(document.head, 'appendChild').mockImplementation((el: Node) => el);

  document.documentElement.innerHTML = '<html><head></head><body></body></html>';
}

async function initMain(): Promise<void> {
  await import('../src/main.js');
  // Wait for internal async init
  await new Promise((r) => setTimeout(r, 150));
}

function getStyleElement(): HTMLStyleElement | null {
  return document.getElementById('subtitle-styler-dynamic-styles') as HTMLStyleElement | null;
}

// ── Tests ──

describe('SubtitleStylerApp', () => {
  afterEach(() => {
    const style = getStyleElement();
    if (style) style.remove();
  });

  // ── Initialization ──

  describe('initialization', () => {
    it('initializes and applies styles to the DOM', async () => {
      await setupMocks();
      await initMain();

      const el = getStyleElement();
      expect(el).not.toBeNull();
      expect(el!.textContent).toContain('.ytp-caption-segment');
      expect(el!.textContent).toContain('color: red !important;');
    });

    it('does not inject CSS when platform is unknown', async () => {
      await setupMocks({ platform: 'unknown', config: null });
      await initMain();

      const el = getStyleElement();
      // Style element should not exist or be empty — no config to apply
      if (el) {
        expect(el.textContent).toBe('');
      }
    });

    it('calls detectPlatform during initialization', async () => {
      await setupMocks();
      await initMain();
      expect(detectPlatformMock).toHaveBeenCalledOnce();
    });

    it('calls loadSettings during initialization', async () => {
      await setupMocks();
      await initMain();
      expect(loadSettingsMock).toHaveBeenCalledOnce();
    });

    it('calls getEffectiveSettings for per-site override check', async () => {
      await setupMocks();
      await initMain();
      expect(getEffectiveSettingsMock).toHaveBeenCalledOnce();
    });

    it('exposes subtitleStylerDebug on window', async () => {
      await setupMocks();
      await initMain();

      type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };
      const debugFn = (window as DebugWindow).subtitleStylerDebug;
      expect(debugFn).toBeDefined();
      const info = debugFn!();
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('settings');
    });
  });

  // ── CSS injection ──

  describe('CSS injection', () => {
    it('injects baseline CSS when baselineCss is defined', async () => {
      await setupMocks();
      await initMain();

      const el = getStyleElement();
      expect(el!.textContent).toContain('.ytp-caption-segment { font-family: Arial; }');
    });

    it('does not inject baseline CSS when it is not defined', async () => {
      // Create a config without baselineCss
      const { baselineCss: _unused, ...configNoBaseline } =
        makeYouTubeConfig() as PlatformConfig & {
          baselineCss?: unknown;
        };
      await setupMocks({
        config: configNoBaseline as PlatformConfig,
      });
      await initMain();

      const el = getStyleElement();
      // Should still have the combined CSS rules but not baseline
      expect(el!.textContent).not.toContain('font-family: Arial;');
    });

    it('generates combined CSS rules for each appliesTo group', async () => {
      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red', backgroundColor: 'black' },
      });
      await initMain();

      // generateCombinedCssRules should be called for both subtitle and background groups
      expect(generateCombinedCssRulesMock).toHaveBeenCalled();
    });

    it('produces empty style when all settings are auto', async () => {
      await setupMocks({
        settings: ALL_AUTO,
        cssRules: [],
      });
      await initMain();

      const el = getStyleElement();
      // With all auto, only baseline CSS might be present (no combined rules)
      if (el) {
        // Baseline is still injected
        expect(el.textContent).toContain('.ytp-caption-segment { font-family: Arial; }');
        // But no color/font rules from combined
        expect(el.textContent).not.toContain('color:');
      }
    });
  });

  // ── Per-site overrides ──

  describe('per-site settings', () => {
    it('uses effective settings when isOverride is true', async () => {
      const overrideSettings: StorageSettings = {
        ...ALL_AUTO,
        fontColor: 'green',
        fontSize: '150%',
      };

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        effectiveOverride: true,
        effectiveSettings: overrideSettings,
      });
      await initMain();

      // The mock returns whatever we configured, but the app should use the override
      expect(getEffectiveSettingsMock).toHaveBeenCalledOnce();
    });

    it('uses global settings when isOverride is false', async () => {
      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        effectiveOverride: false,
      });
      await initMain();

      expect(getEffectiveSettingsMock).toHaveBeenCalledOnce();
    });
  });

  // ── Message handling ──

  describe('message handling', () => {
    it('updates styles on subtitleStylerChanged message', async () => {
      await setupMocks();
      await initMain();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;
      expect(messageHandler).toBeDefined();

      messageHandler({
        source: window,
        data: {
          type: 'subtitleStylerChanged',
          data: { fontColor: { newValue: 'green' } },
        },
      } as unknown as MessageEvent);

      const el = getStyleElement();
      expect(el!.textContent).toContain('.ytp-caption-segment');
    });

    it('ignores messages with unrelated type', async () => {
      await setupMocks();
      await initMain();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      const el = getStyleElement();
      const _contentBefore = el!.textContent;

      // Reset mock call count
      generateCombinedCssRulesMock.mockClear();

      messageHandler({
        source: window,
        data: {
          type: 'somethingElse',
          data: { fontColor: { newValue: 'blue' } },
        },
      } as unknown as MessageEvent);

      // applyStyles should NOT have been called again
      expect(generateCombinedCssRulesMock).not.toHaveBeenCalled();
    });

    it('handles subtitleStylerChanged from cross-origin frame', async () => {
      await setupMocks();
      await initMain();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      // Simulate message from a different source (cross-origin iframe)
      const fakeSource = {} as Window;
      messageHandler({
        source: fakeSource,
        data: {
          type: 'subtitleStylerChanged',
          data: { fontColor: { newValue: 'cyan' } },
        },
      } as unknown as MessageEvent);

      // Should still process — subtitleStylerChanged accepts messages from any source
      const el = getStyleElement();
      expect(el).not.toBeNull();
    });

    it('handles message with missing newValue gracefully', async () => {
      await setupMocks();
      await initMain();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      // Should not throw
      expect(() => {
        messageHandler({
          source: window,
          data: {
            type: 'subtitleStylerChanged',
            data: { fontColor: {} },
          },
        } as unknown as MessageEvent);
      }).not.toThrow();
    });

    it('handles message with unknown setting key gracefully', async () => {
      await setupMocks();
      await initMain();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      expect(() => {
        messageHandler({
          source: window,
          data: {
            type: 'subtitleStylerChanged',
            data: { nonExistentSetting: { newValue: 'foo' } },
          },
        } as unknown as MessageEvent);
      }).not.toThrow();
    });
  });

  // ── YouTube SPA navigation ──

  describe('YouTube SPA navigation', () => {
    it('registers yt-navigate-finish listener', async () => {
      await setupMocks();
      await initMain();

      const navHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'yt-navigate-finish',
      );
      expect(navHandler).toBeDefined();
    });

    it('re-applies styles on yt-navigate-finish', async () => {
      await setupMocks();
      await initMain();

      const navHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'yt-navigate-finish',
      )?.[1] as () => void;

      const el = getStyleElement();
      el!.textContent = '';

      navHandler();

      expect(el!.textContent).toContain('.ytp-caption-segment');
    });

    it('does not re-apply on yt-navigate-finish if not YouTube', async () => {
      await setupMocks({
        platform: 'netflix',
        config: {
          name: 'Netflix',
          css: {
            subtitleContainerSelector: '.player-timedtext',
            selectors: {
              subtitle: '.player-timedtext-text-container span',
              background: '.player-timedtext-text-container',
              window: '.player-timedtext',
            },
          },
        },
      });
      await initMain();

      generateCombinedCssRulesMock.mockClear();

      const navHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'yt-navigate-finish',
      )?.[1] as () => void;
      navHandler();

      // Should NOT have called generateCombinedCssRules for a non-YouTube platform
      expect(generateCombinedCssRulesMock).not.toHaveBeenCalled();
    });
  });

  // ── Native settings ──

  describe('native settings', () => {
    it('prefers native settings over CSS when platform supports them', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });
      const getCurrentValueMock = vi.fn().mockReturnValue(undefined);

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: getCurrentValueMock,
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      // Native applySetting should have been called
      expect(applySettingMock).toHaveBeenCalledWith('red');
      // CSS rules should NOT have been generated for fontColor since native handled it
      // (The mock still returns rules but native took priority in processSettings)
    });

    it('falls back to CSS when native capabilities are not detected', async () => {
      const applySettingMock = vi.fn();

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn(),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => false,
        } as unknown as PlatformConfig,
      });
      await initMain();

      // Native applySetting should NOT have been called
      expect(applySettingMock).not.toHaveBeenCalled();
      // CSS path should have been used instead
      expect(generateCombinedCssRulesMock).toHaveBeenCalled();
    });

    it('skips native setting when current value already matches', async () => {
      const applySettingMock = vi.fn();
      const getCurrentValueMock = vi.fn().mockReturnValue('red');

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: getCurrentValueMock,
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      // Value already matches — applySetting should NOT be called
      expect(applySettingMock).not.toHaveBeenCalled();
    });
  });

  // ── Shadow DOM ──

  describe('shadow DOM injection', () => {
    it('injects CSS into shadow root when shadowHost is configured', async () => {
      // Need to set up mocks BEFORE creating the element, because setupMocks
      // resets the DOM (documentElement.innerHTML). So: setup first, then create element.
      await setupMocks({
        config: {
          name: 'Disney+',
          css: {
            subtitleContainerSelector: '.dss-subtitle-renderer',
            selectors: {
              subtitle: '.dss-subtitle-renderer-cue',
              background: '.dss-subtitle-renderer-cue',
              window: '.dss-subtitle-renderer',
            },
            shadowHost: '#test-shadow-host',
          },
        },
      });

      // Create a custom element with shadow root after mocks reset the DOM
      const shadowHost = document.createElement('div');
      shadowHost.id = 'test-shadow-host';
      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      document.body.appendChild(shadowHost);

      await initMain();

      // Check that a style element was injected into the shadow root
      // Use querySelector since some JSDOM implementations don't support getElementById on ShadowRoot
      const shadowStyle = shadowRoot.querySelector('#subtitle-styler-shadow-styles');
      expect(shadowStyle).not.toBeNull();
      expect(shadowStyle!.textContent).toBeTruthy();

      // Cleanup
      shadowHost.remove();
    });

    it('does not crash when shadow host element is not in DOM', async () => {
      await setupMocks({
        config: {
          name: 'Disney+',
          css: {
            subtitleContainerSelector: '.dss-subtitle-renderer',
            selectors: {
              subtitle: '.dss-subtitle-renderer-cue',
              background: '.dss-subtitle-renderer-cue',
              window: '.dss-subtitle-renderer',
            },
            shadowHost: 'disney-web-player',
          },
        },
      });

      // Should not throw even though the shadow host doesn't exist
      await expect(initMain()).resolves.not.toThrow();
    });
  });

  // ── Platform without CSS ──

  describe('platform without CSS config', () => {
    it('handles platform with only native settings (no CSS selectors)', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'NativeOnly',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      expect(applySettingMock).toHaveBeenCalledWith('red');
    });
  });

  // ── Multiple settings across groups ──

  describe('multiple settings across CSS groups', () => {
    it('generates rules for subtitle, background, and window groups', async () => {
      await setupMocks({
        settings: {
          ...ALL_AUTO,
          fontColor: 'red',
          backgroundColor: 'black',
          windowColor: 'blue',
        },
      });

      generateCombinedCssRulesMock.mockImplementation((appliesTo: string) => {
        switch (appliesTo) {
          case 'subtitle':
            return ['color: #f00 !important;'];
          case 'background':
            return ['background-color: #000 !important;'];
          case 'window':
            return ['background-color: #00f !important;'];
          default:
            return [];
        }
      });

      await initMain();

      const el = getStyleElement();
      expect(el).not.toBeNull();
      // All three groups should have CSS rules injected
      expect(el!.textContent).toContain('color: #f00 !important;');
      expect(el!.textContent).toContain('background-color: #000 !important;');
      expect(el!.textContent).toContain('background-color: #00f !important;');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles loadSettings rejection gracefully', async () => {
      await setupMocks();
      loadSettingsMock.mockRejectedValue(new Error('Storage access denied'));
      // Should not throw to the outside
      await expect(initMain()).resolves.not.toThrow();
    });

    it('handles getEffectiveSettings rejection gracefully', async () => {
      await setupMocks();
      getEffectiveSettingsMock.mockRejectedValue(new Error('Site settings error'));
      await expect(initMain()).resolves.not.toThrow();
    });
  });

  // ── Style element reuse ──

  describe('style element reuse', () => {
    it('reuses the same style element on subsequent applyStyles calls', async () => {
      await setupMocks();
      await initMain();

      const el1 = getStyleElement();
      expect(el1).not.toBeNull();

      // Trigger applyStyles again via yt-navigate-finish
      const navHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'yt-navigate-finish',
      )?.[1] as () => void;
      navHandler();

      const el2 = getStyleElement();
      expect(el2).toBe(el1); // Same DOM element
    });

    it('updates style content on re-apply with new rules', async () => {
      await setupMocks();
      await initMain();

      const el = getStyleElement();
      const initialContent = el!.textContent;

      // Change the mock to return different rules
      generateCombinedCssRulesMock.mockReturnValue(['font-size: 200% !important;']);

      // Trigger re-apply via yt-navigate-finish
      const navHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'yt-navigate-finish',
      )?.[1] as () => void;
      navHandler();

      expect(el!.textContent).not.toBe(initialContent);
      expect(el!.textContent).toContain('font-size: 200% !important;');
    });
  });

  // ── MutationObserver ──

  describe('MutationObserver', () => {
    it('does not trigger re-apply for CSS-only platforms without shadow DOM', async () => {
      await setupMocks({
        config: makeYouTubeConfig(), // No native settings, no shadow DOM
      });
      await initMain();

      generateCombinedCssRulesMock.mockClear();

      // Simulate adding a video element to the DOM
      const video = document.createElement('video');
      document.body.appendChild(video);

      // Wait for potential debounce timeout
      await new Promise((r) => setTimeout(r, 600));

      // CSS-only platform (no native, no shadow) → MutationObserver should NOT re-apply
      expect(generateCombinedCssRulesMock).not.toHaveBeenCalled();

      video.remove();
    });

    it('triggers re-apply when video element is added on native settings platform', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestNative',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      applySettingMock.mockClear();

      // Add a video element
      const video = document.createElement('video');
      document.body.appendChild(video);

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 600));

      // Native settings platform should re-apply when video is added
      expect(applySettingMock).toHaveBeenCalledWith('red');

      video.remove();
    });

    it('triggers re-apply when shadow host element is added', async () => {
      await setupMocks({
        config: {
          name: 'Disney+',
          css: {
            subtitleContainerSelector: '.dss-subtitle-renderer',
            selectors: {
              subtitle: '.dss-subtitle-renderer-cue',
              background: '.dss-subtitle-renderer-cue',
              window: '.dss-subtitle-renderer',
            },
            shadowHost: 'disney-web-player',
          },
        },
      });
      await initMain();

      generateCombinedCssRulesMock.mockClear();

      // Add a shadow host element
      const hostEl = document.createElement('disney-web-player');
      document.body.appendChild(hostEl);

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 600));

      expect(generateCombinedCssRulesMock).toHaveBeenCalled();

      hostEl.remove();
    });

    it('debounces multiple rapid mutations', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestNative',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      applySettingMock.mockClear();

      // Add multiple video elements rapidly
      for (let i = 0; i < 5; i++) {
        const video = document.createElement('video');
        document.body.appendChild(video);
      }

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 600));

      // Should only have been called once due to debouncing
      expect(applySettingMock).toHaveBeenCalledTimes(1);
    });

    it('ignores non-HTMLElement added nodes', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestNative',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      applySettingMock.mockClear();

      // Add a text node (not HTMLElement)
      const textNode = document.createTextNode('hello');
      document.body.appendChild(textNode);

      await new Promise((r) => setTimeout(r, 600));

      // Text nodes should be ignored
      expect(applySettingMock).not.toHaveBeenCalled();
    });

    it('detects video player containers nested inside added elements', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestNative',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      applySettingMock.mockClear();

      // Add a div containing an html5-video-player class element
      const wrapper = document.createElement('div');
      const player = document.createElement('div');
      player.classList.add('html5-video-player');
      wrapper.appendChild(player);
      document.body.appendChild(wrapper);

      await new Promise((r) => setTimeout(r, 600));

      expect(applySettingMock).toHaveBeenCalledWith('red');

      wrapper.remove();
    });
  });

  // ── Debug function detailed state ──

  describe('debug function', () => {
    it('returns all expected state fields', async () => {
      await setupMocks();
      await initMain();

      type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };
      const info = (window as DebugWindow).subtitleStylerDebug!();

      expect(info).toHaveProperty('platform', 'youtube');
      expect(info).toHaveProperty('settings');
      expect(info).toHaveProperty('log');
      expect(info).toHaveProperty('config');
      expect(info).toHaveProperty('status');
      expect(info).toHaveProperty('chromeAPIs');
      expect(info).toHaveProperty('playerElement');
      expect(info).toHaveProperty('storageBridge');
    });

    it('exposes error info in debug function after initialization failure', async () => {
      await setupMocks();
      loadSettingsMock.mockRejectedValue(new Error('Test error'));
      await initMain();

      type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };
      const info = (window as DebugWindow).subtitleStylerDebug!();

      // After failure, debug function should include error info
      expect(info).toHaveProperty('error', 'Test error');
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('settings');
    });
  });

  // ── Baseline CSS multiple groups ──

  describe('baseline CSS with multiple groups', () => {
    it('injects baseline CSS for subtitle, background, and window groups', async () => {
      await setupMocks({
        settings: ALL_AUTO,
        cssRules: [],
        config: {
          name: 'TestPlatform',
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          baselineCss: {
            subtitle: 'font-family: sans-serif;',
            background: 'padding: 2px;',
            window: 'margin: 0;',
          },
        },
      });
      await initMain();

      const el = getStyleElement();
      expect(el!.textContent).toContain('.sub-text { font-family: sans-serif; }');
      expect(el!.textContent).toContain('.sub-bg { padding: 2px; }');
      expect(el!.textContent).toContain('.sub-window { margin: 0; }');
    });

    it('skips baseline group when selector is missing', async () => {
      await setupMocks({
        settings: ALL_AUTO,
        cssRules: [],
        config: {
          name: 'TestPlatform',
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              // no background or window selectors
            },
          },
          baselineCss: {
            subtitle: 'font-family: sans-serif;',
            background: 'padding: 2px;',
            window: 'margin: 0;',
          },
        } as unknown as PlatformConfig,
      });
      await initMain();

      const el = getStyleElement();
      expect(el!.textContent).toContain('.sub-text { font-family: sans-serif; }');
      // These should NOT appear because selectors are missing
      expect(el!.textContent).not.toContain('padding: 2px;');
      expect(el!.textContent).not.toContain('margin: 0;');
    });
  });

  // ── Native settings edge cases ──

  describe('native settings edge cases', () => {
    it('defaults to native when detectNativeCapabilities is undefined', async () => {
      const applySettingMock = vi.fn().mockReturnValue({ success: true, message: 'Applied' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          // detectNativeCapabilities not set — should default to capable
        } as unknown as PlatformConfig,
      });
      await initMain();

      expect(applySettingMock).toHaveBeenCalledWith('red');
    });

    it('logs native applySetting failure correctly', async () => {
      const applySettingMock = vi
        .fn()
        .mockReturnValue({ success: false, message: 'Player not found' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      // applySetting was called and returned failure
      expect(applySettingMock).toHaveBeenCalledWith('red');
      // The app should have tracked this in applicationLog (no crash)
    });

    it('applies multiple native settings when all are configured', async () => {
      const fontApply = vi.fn().mockReturnValue({ success: true, message: 'OK' });
      const bgApply = vi.fn().mockReturnValue({ success: true, message: 'OK' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red', backgroundColor: 'black' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: fontApply,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
            backgroundColor: {
              applySetting: bgApply,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      expect(fontApply).toHaveBeenCalledWith('red');
      expect(bgApply).toHaveBeenCalledWith('black');
    });
  });

  // ── Message handling advanced ──

  describe('message handling advanced', () => {
    it('updates multiple settings from a single message', async () => {
      await setupMocks();
      await initMain();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      messageHandler({
        source: window,
        data: {
          type: 'subtitleStylerChanged',
          data: {
            fontColor: { newValue: 'blue' },
            fontSize: { newValue: '150%' },
            backgroundColor: { newValue: 'green' },
          },
        },
      } as unknown as MessageEvent);

      // Style should have been re-applied (element should exist and have content)
      const el = getStyleElement();
      expect(el).not.toBeNull();
      expect(el!.textContent).toBeTruthy();
    });

    it('does not re-apply when platform config is null (unknown platform message handler)', async () => {
      await setupMocks({ platform: 'unknown', config: null });
      await initMain();

      generateCombinedCssRulesMock.mockClear();

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      messageHandler({
        source: window,
        data: {
          type: 'subtitleStylerChanged',
          data: { fontColor: { newValue: 'red' } },
        },
      } as unknown as MessageEvent);

      // Platform config is null, so applyStyles won't produce CSS rules
      expect(generateCombinedCssRulesMock).not.toHaveBeenCalled();
    });

    it('catches applyStyles error during message handling without crashing', async () => {
      await setupMocks();
      await initMain();

      // Make generateCombinedCssRules throw on next call
      generateCombinedCssRulesMock.mockImplementation(() => {
        throw new Error('CSS generation failed');
      });

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      // Should not throw even though applyStyles internally fails
      expect(() => {
        messageHandler({
          source: window,
          data: {
            type: 'subtitleStylerChanged',
            data: { fontColor: { newValue: 'red' } },
          },
        } as unknown as MessageEvent);
      }).not.toThrow();
    });
  });

  // ── Shadow DOM advanced ──

  describe('shadow DOM advanced', () => {
    it('reuses existing shadow style element on re-apply', async () => {
      await setupMocks({
        config: {
          name: 'Disney+',
          css: {
            subtitleContainerSelector: '.dss-subtitle-renderer',
            selectors: {
              subtitle: '.dss-subtitle-renderer-cue',
              background: '.dss-subtitle-renderer-cue',
              window: '.dss-subtitle-renderer',
            },
            shadowHost: '#test-shadow-reuse',
          },
        },
      });

      const shadowHost = document.createElement('div');
      shadowHost.id = 'test-shadow-reuse';
      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      document.body.appendChild(shadowHost);

      await initMain();

      const style1 = shadowRoot.querySelector('#subtitle-styler-shadow-styles');
      expect(style1).not.toBeNull();

      // Trigger re-apply via yt-navigate-finish (platform is not YouTube, but
      // we can trigger applyStyles via message)
      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as (ev: MessageEvent) => void;

      messageHandler({
        source: window,
        data: {
          type: 'subtitleStylerChanged',
          data: { fontColor: { newValue: 'blue' } },
        },
      } as unknown as MessageEvent);

      const styles = shadowRoot.querySelectorAll('#subtitle-styler-shadow-styles');
      // Should still be only one style element (reused, not duplicated)
      expect(styles.length).toBe(1);

      shadowHost.remove();
    });
  });

  // ── Combined CSS rules grouping ──

  describe('CSS rules grouping', () => {
    it('groups settings by appliesTo and calls generateCombinedCssRules per group', async () => {
      await setupMocks({
        settings: {
          ...ALL_AUTO,
          fontColor: 'red',
          fontSize: '120%' as StorageSettings['fontSize'],
          characterEdgeStyle: 'dropshadow',
          backgroundColor: 'black',
          backgroundOpacity: '75%' as StorageSettings['backgroundOpacity'],
          windowColor: 'blue',
        },
      });

      const groupCalls: string[] = [];
      generateCombinedCssRulesMock.mockImplementation((appliesTo: string) => {
        groupCalls.push(appliesTo);
        return [`/* ${appliesTo} rules */`];
      });

      await initMain();

      // Should have been called for subtitle, background, and window groups
      expect(groupCalls).toContain('subtitle');
      expect(groupCalls).toContain('background');
      expect(groupCalls).toContain('window');
    });

    it('skips groups with empty combined rules', async () => {
      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
      });

      // Return empty array for subtitle group
      generateCombinedCssRulesMock.mockReturnValue([]);

      await initMain();

      const el = getStyleElement();
      // With empty combined rules + baseline, only baseline should appear
      expect(el!.textContent).toContain('.ytp-caption-segment { font-family: Arial; }');
      // But no combined rule section for subtitle
      expect(el!.textContent).not.toContain('color:');
    });
  });

  // ── Application log tracking ──

  // ── Platform-specific live update tests ──

  describe('platform-specific live update via subtitleStylerChanged', () => {
    function makePlatformConfig(
      name: string,
      selectors: { subtitle: string; background: string; window: string },
      extra?: Partial<PlatformConfig>,
    ): PlatformConfig {
      return {
        name,
        css: {
          subtitleContainerSelector: selectors.window,
          selectors,
          ...extra?.css,
        },
        detectNativeCapabilities: () => false,
        getCurrentNativeSettings: () => null,
        ...extra,
      };
    }

    const platformConfigs: {
      platform: string;
      name: string;
      selectors: { subtitle: string; background: string; window: string };
      shadowHost?: string;
    }[] = [
      {
        platform: 'primevideo',
        name: 'Prime Video',
        selectors: {
          subtitle: '.atvwebplayersdk-captions-text',
          background: '.atvwebplayersdk-captions-region',
          window: '.atvwebplayersdk-captions-overlay',
        },
      },
      {
        platform: 'max',
        name: 'Max',
        selectors: {
          subtitle: '[class^="TextCue"]',
          background: '[data-testid="CueBoxContainer"]',
          window: '[class^="CaptionWindow"]',
        },
      },
      {
        platform: 'crunchyroll',
        name: 'Crunchyroll',
        selectors: {
          subtitle: '.bmpui-ui-subtitle-label',
          background: '.bmpui-ui-subtitle-label',
          window: '.bmpui-ui-subtitle-overlay',
        },
      },
      {
        platform: 'disneyplus',
        name: 'Disney+',
        selectors: {
          subtitle: '.dss-subtitle-renderer-cue > span, .hive-subtitle-renderer-cue > span',
          background: '.dss-subtitle-renderer-cue > span, .hive-subtitle-renderer-cue > span',
          window: '.dss-subtitle-renderer-cue, .hive-subtitle-renderer-cue',
        },
        shadowHost: 'disney-web-player',
      },
      {
        platform: 'netflix',
        name: 'Netflix',
        selectors: {
          subtitle: '.player-timedtext-text-container span',
          background: '.player-timedtext-text-container',
          window: '.player-timedtext',
        },
      },
    ];

    for (const { platform, name, selectors, shadowHost } of platformConfigs) {
      describe(`${name} (${platform})`, () => {
        it('applies CSS with correct subtitle selector on fontColor change', async () => {
          const config = makePlatformConfig(
            name,
            selectors,
            shadowHost
              ? { css: { subtitleContainerSelector: selectors.window, selectors, shadowHost } }
              : undefined,
          );
          await setupMocks({ platform, config });
          await initMain();

          const messageHandler = addEventListenerSpy.mock.calls.find(
            (c: unknown[]) => c[0] === 'message',
          )?.[1] as (ev: MessageEvent) => void;
          expect(messageHandler).toBeDefined();

          messageHandler({
            source: window,
            data: {
              type: 'subtitleStylerChanged',
              data: { fontColor: { newValue: 'yellow' } },
            },
          } as unknown as MessageEvent);

          const el = getStyleElement();
          expect(el).not.toBeNull();
          expect(el!.textContent).toContain(selectors.subtitle);
        });

        it('applies CSS with correct background selector on backgroundColor change', async () => {
          const config = makePlatformConfig(
            name,
            selectors,
            shadowHost
              ? { css: { subtitleContainerSelector: selectors.window, selectors, shadowHost } }
              : undefined,
          );
          await setupMocks({
            platform,
            config,
            settings: { ...ALL_AUTO, backgroundColor: 'blue' },
          });
          await initMain();

          const messageHandler = addEventListenerSpy.mock.calls.find(
            (c: unknown[]) => c[0] === 'message',
          )?.[1] as (ev: MessageEvent) => void;

          // Clear mocks to verify the message triggers a new call
          generateCombinedCssRulesMock.mockClear();
          generateCombinedCssRulesMock.mockReturnValue(['background-color: blue !important;']);

          messageHandler({
            source: window,
            data: {
              type: 'subtitleStylerChanged',
              data: { backgroundColor: { newValue: 'blue' } },
            },
          } as unknown as MessageEvent);

          expect(generateCombinedCssRulesMock).toHaveBeenCalled();
          const el = getStyleElement();
          expect(el).not.toBeNull();
          expect(el!.textContent).toContain(selectors.background);
        });

        it('applies CSS with correct window selector on windowColor change', async () => {
          const config = makePlatformConfig(
            name,
            selectors,
            shadowHost
              ? { css: { subtitleContainerSelector: selectors.window, selectors, shadowHost } }
              : undefined,
          );
          await setupMocks({ platform, config, settings: { ...ALL_AUTO, windowColor: 'red' } });
          await initMain();

          const messageHandler = addEventListenerSpy.mock.calls.find(
            (c: unknown[]) => c[0] === 'message',
          )?.[1] as (ev: MessageEvent) => void;

          generateCombinedCssRulesMock.mockClear();
          generateCombinedCssRulesMock.mockReturnValue(['background-color: red !important;']);

          messageHandler({
            source: window,
            data: {
              type: 'subtitleStylerChanged',
              data: { windowColor: { newValue: 'red' } },
            },
          } as unknown as MessageEvent);

          expect(generateCombinedCssRulesMock).toHaveBeenCalled();
          const el = getStyleElement();
          expect(el).not.toBeNull();
          expect(el!.textContent).toContain(selectors.window);
        });

        it('updates CSS when multiple settings change simultaneously', async () => {
          const config = makePlatformConfig(
            name,
            selectors,
            shadowHost
              ? { css: { subtitleContainerSelector: selectors.window, selectors, shadowHost } }
              : undefined,
          );
          await setupMocks({
            platform,
            config,
            settings: { ...ALL_AUTO, fontColor: 'green', characterEdgeStyle: 'dropshadow' },
          });
          await initMain();

          const messageHandler = addEventListenerSpy.mock.calls.find(
            (c: unknown[]) => c[0] === 'message',
          )?.[1] as (ev: MessageEvent) => void;

          generateCombinedCssRulesMock.mockClear();
          generateCombinedCssRulesMock.mockReturnValue([
            'color: green !important;',
            'text-shadow: 2px 2px 3px rgba(0,0,0,0.9) !important;',
          ]);

          messageHandler({
            source: window,
            data: {
              type: 'subtitleStylerChanged',
              data: {
                fontColor: { newValue: 'green' },
                characterEdgeStyle: { newValue: 'dropshadow' },
              },
            },
          } as unknown as MessageEvent);

          expect(generateCombinedCssRulesMock).toHaveBeenCalled();
          const el = getStyleElement();
          expect(el).not.toBeNull();
          expect(el!.textContent).toContain(selectors.subtitle);
        });

        it('re-applies styles on subtitleStylerChanged from cross-origin frame', async () => {
          const config = makePlatformConfig(
            name,
            selectors,
            shadowHost
              ? { css: { subtitleContainerSelector: selectors.window, selectors, shadowHost } }
              : undefined,
          );
          await setupMocks({ platform, config });
          await initMain();

          const messageHandler = addEventListenerSpy.mock.calls.find(
            (c: unknown[]) => c[0] === 'message',
          )?.[1] as (ev: MessageEvent) => void;

          generateCombinedCssRulesMock.mockClear();
          generateCombinedCssRulesMock.mockReturnValue(['color: cyan !important;']);

          const fakeSource = {} as Window;
          messageHandler({
            source: fakeSource,
            data: {
              type: 'subtitleStylerChanged',
              data: { fontColor: { newValue: 'cyan' } },
            },
          } as unknown as MessageEvent);

          expect(generateCombinedCssRulesMock).toHaveBeenCalled();
          const el = getStyleElement();
          expect(el).not.toBeNull();
          expect(el!.textContent).toContain(selectors.subtitle);
        });
      });
    }
  });

  describe('application log', () => {
    it('tracks CSS setting application in applicationLog', async () => {
      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
      });
      await initMain();

      type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };
      const info = (window as DebugWindow).subtitleStylerDebug!();
      const log = info['log'] as Record<string, { success: boolean; details?: string }>;

      expect(log['fontColor']).toBeDefined();
      expect(log['fontColor']!.success).toBe(true);
      expect(log['fontColor']!.details).toBe('CSS rule queued');
    });

    it('tracks native setting application in applicationLog', async () => {
      const applySettingMock = vi
        .fn()
        .mockReturnValue({ success: true, message: 'Font color set to red' });

      await setupMocks({
        settings: { ...ALL_AUTO, fontColor: 'red' },
        config: {
          name: 'TestPlatform',
          nativeSettings: {
            fontColor: {
              applySetting: applySettingMock,
              getCurrentValue: vi.fn().mockReturnValue(undefined),
            },
          },
          css: {
            subtitleContainerSelector: '.subs',
            selectors: {
              subtitle: '.sub-text',
              background: '.sub-bg',
              window: '.sub-window',
            },
          },
          detectNativeCapabilities: () => true,
        } as unknown as PlatformConfig,
      });
      await initMain();

      type DebugWindow = typeof window & { subtitleStylerDebug?: () => Record<string, unknown> };
      const info = (window as DebugWindow).subtitleStylerDebug!();
      const log = info['log'] as Record<string, { success: boolean; details?: string }>;

      expect(log['fontColor']).toBeDefined();
      expect(log['fontColor']!.success).toBe(true);
      expect(log['fontColor']!.details).toBe('Font color set to red');
    });
  });
});
