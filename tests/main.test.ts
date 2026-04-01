import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { StorageSettings } from '../src/types/index.js';

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
    fontColor: { appliesTo: 'subtitle' },
    fontSize: { appliesTo: 'subtitle' },
    characterEdgeStyle: { appliesTo: 'subtitle' },
    backgroundOpacity: { appliesTo: 'background' },
    windowOpacity: { appliesTo: 'window' },
    fontOpacity: { appliesTo: 'subtitle' },
    backgroundColor: { appliesTo: 'background' },
    windowColor: { appliesTo: 'window' },
    fontFamily: { appliesTo: 'subtitle' },
  },
  generateCombinedCssRules: vi.fn(),
}));

describe('SubtitleStylerApp', () => {
  let addEventListenerSpy: Mock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { loadSettings, loadActivePreset } = await import('../src/storage.js');
    const { detectPlatform, getPlatformConfig } = await import('../src/platforms/index.js');
    const { generateCombinedCssRules } = await import('../src/css-mappings.js');
    const { getEffectiveSettings } = await import('../src/site-settings.js');

    const mockSettings = {
      fontColor: 'red',
      fontSize: '100%',
      characterEdgeStyle: 'auto',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
    } as StorageSettings;

    (loadSettings as Mock).mockResolvedValue(mockSettings);
    (loadActivePreset as Mock).mockResolvedValue(null);
    (getEffectiveSettings as Mock).mockResolvedValue({
      settings: mockSettings,
      activePreset: null,
      isOverride: false,
    });

    (detectPlatform as Mock).mockReturnValue('youtube');
    (getPlatformConfig as Mock).mockReturnValue({
      name: 'YouTube',
      css: {
        selectors: {
          subtitle: '.ytp-caption-segment',
          background: '.ytp-caption-window-container',
          window: '.ytp-caption-window-container',
        },
      },
      baselineCss: { subtitle: 'font-family: Arial;' },
    });

    (generateCombinedCssRules as Mock).mockReturnValue(['color: red !important;']);

    addEventListenerSpy = vi.spyOn(window, 'addEventListener') as Mock;
    vi.spyOn(document.head, 'appendChild').mockImplementation((el: Node) => el);

    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
  });

  afterEach(() => {
    const style = document.getElementById('subtitle-styler-dynamic-styles');
    if (style) style.remove();
  });

  it('initializes and applies styles to the DOM', async () => {
    await import('../src/main.js');

    // Wait for internal async init
    await new Promise((r) => setTimeout(r, 100));

    const styleElement = document.getElementById(
      'subtitle-styler-dynamic-styles',
    ) as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.textContent).toContain('.ytp-caption-segment');
    expect(styleElement.textContent).toContain('color: red !important;');
  });

  it('updates styles on message', async () => {
    await import('../src/main.js');
    await new Promise((r) => setTimeout(r, 100));

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

    const styleElement = document.getElementById(
      'subtitle-styler-dynamic-styles',
    ) as HTMLStyleElement;
    expect(styleElement.textContent).toContain('.ytp-caption-segment');
  });

  it('updates styles on navigation', async () => {
    await import('../src/main.js');
    await new Promise((r) => setTimeout(r, 100));

    const navHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'yt-navigate-finish',
    )?.[1] as () => void;
    expect(navHandler).toBeDefined();

    const styleElement = document.getElementById(
      'subtitle-styler-dynamic-styles',
    ) as HTMLStyleElement;
    styleElement.textContent = '';

    navHandler();

    expect(styleElement.textContent).toContain('.ytp-caption-segment');
  });
});
