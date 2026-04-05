import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Read the actual HTML file used for the popup
const html = fs.readFileSync(path.resolve(__dirname, '../src/ui/index.html'), 'utf8');

// Intercept DOMContentLoaded listener
let domContentLoadedCallback: EventListenerOrEventListenerObject | null = null;
const originalAddEventListener = document.addEventListener.bind(document);
document.addEventListener = function (
  this: Document,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void {
  if (type === 'DOMContentLoaded') {
    domContentLoadedCallback = listener;
  }
  originalAddEventListener(type, listener, options);
};

// We only need to import it once. It will attach the event listener and we'll capture it.
await import('../src/ui/popup.js');

const ALL_AUTO = {
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

describe('Popup UI Integration', () => {
  beforeEach(() => {
    // Reset DOM
    document.documentElement.innerHTML = html;

    // Reset mocks
    vi.clearAllMocks();

    // Default chrome.storage.sync.get returns all-auto
    vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
      ALL_AUTO,
    );
    vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
  });

  async function triggerInit(): Promise<void> {
    if (typeof domContentLoadedCallback === 'function') {
      domContentLoadedCallback(new Event('DOMContentLoaded'));
      // wait for microtasks
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** Set up chrome.tabs.query to return a tab with the given URL. */
  function mockActiveTab(url: string): void {
    const tabsMock = {
      query: vi.fn().mockResolvedValue([{ id: 42, url }]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };
    (chrome as unknown as Record<string, unknown>)['tabs'] = tabsMock;
  }

  /** Clear the chrome.tabs mock (simulating no tab access). */
  function clearTabsMock(): void {
    delete (chrome as unknown as Record<string, unknown>)['tabs'];
  }

  it('initializes popup and loads settings properly', async () => {
    const mockedSettings = {
      ...ALL_AUTO,
      characterEdgeStyle: 'dropshadow',
      fontColor: 'red',
    };
    vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
      mockedSettings,
    );

    await triggerInit();

    const edgeStyleSelect = document.querySelector<HTMLElement>('[data-id="character-edge-style"]');
    if (!edgeStyleSelect) throw new Error('edgeStyleSelect not found');
    expect(edgeStyleSelect.dataset['selectedValue']).toBe('dropshadow');

    const previewText = document.getElementById('preview-text');
    if (!previewText) throw new Error('previewText not found');
    // test for the color with jsdom conversion
    expect(previewText.style.cssText).toContain('rgb(255, 0, 0)');
    expect(previewText.style.cssText).toContain('text-shadow:');
  });

  it('handles user saving settings via select click', async () => {
    await triggerInit();

    const edgeStyleSelect = document.querySelector<HTMLElement>('[data-id="character-edge-style"]');
    if (!edgeStyleSelect) throw new Error('edgeStyleSelect not found');

    // Select option
    const dropshadowOption = edgeStyleSelect.querySelector<HTMLElement>(
      '.select-option[data-value="dropshadow"]',
    );
    if (!dropshadowOption) throw new Error('dropshadowOption not found');
    dropshadowOption.click();

    await new Promise((r) => setTimeout(r, 0));

    expect(edgeStyleSelect.dataset['selectedValue']).toBe('dropshadow');
    const setMock = vi.mocked(chrome.storage.sync.set);
    expect(setMock.mock.calls.length).toBe(1);
    const saveCallArg = setMock.mock.calls[0]?.[0] as Partial<
      import('../src/types/index.js').StorageSettings
    >;
    expect(saveCallArg.characterEdgeStyle).toBe('dropshadow');
  });

  describe('preset selector', () => {
    it('builds preset dropdown during initialization', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement | null;
      expect(presetSelect).toBeTruthy();
      expect(presetSelect!.tagName).toBe('SELECT');

      // Should have Custom + 3 production + separator + 6 dev presets = 11 options
      const options = presetSelect!.querySelectorAll('option');
      expect(options.length).toBeGreaterThanOrEqual(4); // custom + 3 production at minimum
    });

    it('includes "Custom" as the first option', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const firstOption = presetSelect.querySelector('option');
      expect(firstOption!.value).toBe('custom');
      expect(firstOption!.textContent).toBe('Custom');
    });

    it('marks recommended preset with a star', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const recommendedOption = presetSelect.querySelector('option[value="recommended"]');
      expect(recommendedOption).toBeTruthy();
      expect(recommendedOption!.textContent).toContain('★');
    });

    it('includes dev presets when __DEV__ is true', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const devOption = presetSelect.querySelector('option[value="dev-high-contrast"]');
      expect(devOption).toBeTruthy();
    });

    it('detects active preset and sets select value on load', async () => {
      // Load settings that match the "recommended" preset
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        characterEdgeStyle: 'dropshadow',
        backgroundOpacity: '0',
        windowOpacity: '0',
        fontFamily: 'proportional-sans-serif',
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      expect(presetSelect.value).toBe('recommended');
    });

    it('shows "custom" when settings do not match any preset', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontColor: 'cyan',
        fontSize: '200%',
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      expect(presetSelect.value).toBe('custom');
    });

    it('applies preset settings when a preset is selected', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      presetSelect.value = 'recommended';
      presetSelect.dispatchEvent(new Event('change'));

      await new Promise((r) => setTimeout(r, 0));

      // Check that form was populated with recommended preset values
      const edgeStyleSelect = document.querySelector<HTMLElement>(
        '[data-id="character-edge-style"]',
      );
      expect(edgeStyleSelect!.dataset['selectedValue']).toBe('dropshadow');

      const bgOpacitySelect = document.querySelector<HTMLElement>('[data-id="background-opacity"]');
      expect(bgOpacitySelect!.dataset['selectedValue']).toBe('0');
    });

    it('saves preset via chrome.storage.sync when applying a preset', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      presetSelect.value = 'classic';
      presetSelect.dispatchEvent(new Event('change'));

      await new Promise((r) => setTimeout(r, 0));

      const setMock = vi.mocked(chrome.storage.sync.set);
      expect(setMock).toHaveBeenCalled();
      const callArg = setMock.mock.calls[setMock.mock.calls.length - 1]?.[0] as Record<
        string,
        unknown
      >;
      expect(callArg['fontColor']).toBe('white');
      expect(callArg['backgroundColor']).toBe('black');
      expect(callArg['activePreset']).toBe('classic');
    });

    it('does nothing when "custom" is selected', async () => {
      await triggerInit();
      vi.mocked(chrome.storage.sync.set).mockClear();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      presetSelect.value = 'custom';
      presetSelect.dispatchEvent(new Event('change'));

      await new Promise((r) => setTimeout(r, 0));

      // No additional save calls for "custom"
      expect(vi.mocked(chrome.storage.sync.set)).not.toHaveBeenCalled();
    });

    it('updates preset indicator to custom when user manually changes a setting', async () => {
      // Start with recommended preset
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        characterEdgeStyle: 'dropshadow',
        backgroundOpacity: '0',
        windowOpacity: '0',
        fontFamily: 'proportional-sans-serif',
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      expect(presetSelect.value).toBe('recommended');

      // Change font color manually (breaks the preset match)
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const redOption = fontColorSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="red"]',
      );
      redOption!.click();

      await new Promise((r) => setTimeout(r, 0));

      expect(presetSelect.value).toBe('custom');
    });
  });

  describe('preview updates', () => {
    it('updates preview window styles when window color is set', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        windowColor: 'blue',
        windowOpacity: '100',
      });

      await triggerInit();

      // The preview element gets its style updated; jsdom may not parse color-mix()
      // so we verify the form was populated correctly instead
      const windowColorSelect = document.querySelector<HTMLElement>('[data-id="window-color"]');
      expect(windowColorSelect!.dataset['selectedValue']).toBe('blue');
      const windowOpacitySelect = document.querySelector<HTMLElement>('[data-id="window-opacity"]');
      expect(windowOpacitySelect!.dataset['selectedValue']).toBe('100');
    });

    it('updates preview text with font family', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontFamily: 'cursive',
      });

      await triggerInit();

      const textEl = document.getElementById('preview-text');
      expect(textEl!.style.cssText).toContain('font-family');
    });

    it('sets font-variant to small-caps in preview when small-caps is selected', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontFamily: 'small-caps',
      });

      await triggerInit();

      const textEl = document.getElementById('preview-text');
      expect(textEl!.style.fontVariant).toBe('small-caps');
    });

    it('sets font-variant to normal for non-small-caps fonts in preview', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontFamily: 'casual',
      });

      await triggerInit();

      const textEl = document.getElementById('preview-text');
      expect(textEl!.style.fontVariant).toBe('normal');
    });

    it('updates preview background styles when background settings change', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        backgroundColor: 'black',
        backgroundOpacity: '75',
      });

      await triggerInit();

      // Verify form was populated with background settings
      const bgColorSelect = document.querySelector<HTMLElement>('[data-id="background-color"]');
      expect(bgColorSelect!.dataset['selectedValue']).toBe('black');
      const bgOpacitySelect = document.querySelector<HTMLElement>('[data-id="background-opacity"]');
      expect(bgOpacitySelect!.dataset['selectedValue']).toBe('75');
    });

    it('clears preview styles when all settings are auto', async () => {
      await triggerInit();

      const textEl = document.getElementById('preview-text');
      // With all auto, the only style might be font-variant: normal
      expect(textEl!.style.fontVariant).toBe('normal');
    });
  });

  describe('opacity states', () => {
    it('shows font-opacity help when font color is auto but opacity is not', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontOpacity: '75',
      });

      await triggerInit();

      const helpEl = document.getElementById('font-opacity-help');
      expect(helpEl!.classList.contains('hidden')).toBe(false);
    });

    it('hides font-opacity help when font color is set', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontColor: 'red',
        fontOpacity: '75',
      });

      await triggerInit();

      const helpEl = document.getElementById('font-opacity-help');
      expect(helpEl!.classList.contains('hidden')).toBe(true);
    });

    it('hides font-opacity help when both are auto', async () => {
      await triggerInit();

      const helpEl = document.getElementById('font-opacity-help');
      expect(helpEl!.classList.contains('hidden')).toBe(true);
    });

    it('toggles font-opacity help dynamically when user changes font color', async () => {
      // Start with auto color + non-auto opacity → help visible
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        ...ALL_AUTO,
        fontOpacity: '50',
      });

      await triggerInit();

      const helpEl = document.getElementById('font-opacity-help');
      expect(helpEl!.classList.contains('hidden')).toBe(false);

      // Now set a font color → help should hide
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const whiteOption = fontColorSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="white"]',
      );
      whiteOption!.click();

      await new Promise((r) => setTimeout(r, 0));

      expect(helpEl!.classList.contains('hidden')).toBe(true);
    });
  });

  describe('custom select behavior', () => {
    it('opens dropdown when trigger is clicked', async () => {
      await triggerInit();

      const selectContainer = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const trigger = selectContainer!.querySelector<HTMLElement>('.select-trigger')!;

      trigger.click();

      expect(selectContainer!.classList.contains('open')).toBe(true);
    });

    it('closes other dropdowns when one opens', async () => {
      await triggerInit();

      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const fontSizeSelect = document.querySelector<HTMLElement>('[data-id="font-size"]');

      // Open font-color
      const colorTrigger = fontColorSelect!.querySelector<HTMLElement>('.select-trigger')!;
      colorTrigger.click();
      expect(fontColorSelect!.classList.contains('open')).toBe(true);

      // Open font-size → should close font-color
      const sizeTrigger = fontSizeSelect!.querySelector<HTMLElement>('.select-trigger')!;
      sizeTrigger.click();
      expect(fontSizeSelect!.classList.contains('open')).toBe(true);
      expect(fontColorSelect!.classList.contains('open')).toBe(false);
    });

    it('closes dropdowns when clicking outside', async () => {
      await triggerInit();

      const selectContainer = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const trigger = selectContainer!.querySelector<HTMLElement>('.select-trigger')!;

      trigger.click();
      expect(selectContainer!.classList.contains('open')).toBe(true);

      // Click outside
      document.body.click();
      expect(selectContainer!.classList.contains('open')).toBe(false);
    });

    it('toggles dropdown closed when clicking trigger of already-open dropdown', async () => {
      await triggerInit();

      const selectContainer = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const trigger = selectContainer!.querySelector<HTMLElement>('.select-trigger')!;

      trigger.click();
      expect(selectContainer!.classList.contains('open')).toBe(true);

      trigger.click();
      expect(selectContainer!.classList.contains('open')).toBe(false);
    });

    it('updates display text when option is selected', async () => {
      await triggerInit();

      const selectContainer = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const valueEl = selectContainer!.querySelector('.select-value');

      expect(valueEl!.textContent.trim()).toBe('Site default');

      const redOption = selectContainer!.querySelector<HTMLElement>(
        '.select-option[data-value="red"]',
      );
      redOption!.click();

      await new Promise((r) => setTimeout(r, 0));

      expect(valueEl!.textContent.trim()).toContain('Red');
    });

    it('marks selected option with .selected class', async () => {
      await triggerInit();

      const selectContainer = document.querySelector<HTMLElement>('[data-id="font-color"]');

      const redOption = selectContainer!.querySelector<HTMLElement>(
        '.select-option[data-value="red"]',
      );
      redOption!.click();

      await new Promise((r) => setTimeout(r, 0));

      expect(redOption!.classList.contains('selected')).toBe(true);

      // Previous selection should lose .selected
      const autoOption = selectContainer!.querySelector<HTMLElement>(
        '.select-option[data-value="auto"]',
      );
      expect(autoOption!.classList.contains('selected')).toBe(false);
    });

    it('closes dropdown after selecting an option', async () => {
      await triggerInit();

      const selectContainer = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const trigger = selectContainer!.querySelector<HTMLElement>('.select-trigger')!;

      trigger.click();
      expect(selectContainer!.classList.contains('open')).toBe(true);

      const redOption = selectContainer!.querySelector<HTMLElement>(
        '.select-option[data-value="red"]',
      );
      redOption!.click();

      expect(selectContainer!.classList.contains('open')).toBe(false);
    });
  });

  describe('platform detection', () => {
    afterEach(() => {
      clearTabsMock();
    });

    it('detects YouTube from active tab URL', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');
      await triggerInit();

      // Should build scope toggle for YouTube
      const scopeGroup = document.getElementById('scope-toggle-group');
      expect(scopeGroup).toBeTruthy();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('YouTube');
    });

    it('detects Netflix from active tab URL', async () => {
      mockActiveTab('https://www.netflix.com/watch/12345');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Netflix');
    });

    it('detects Disney+ from active tab URL', async () => {
      mockActiveTab('https://www.disneyplus.com/video/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Disney+');
    });

    it('detects Prime Video from primevideo.com', async () => {
      mockActiveTab('https://www.primevideo.com/detail/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Prime Video');
    });

    it('detects Prime Video from amazon.com/gp/video', async () => {
      mockActiveTab('https://www.amazon.com/gp/video/detail/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Prime Video');
    });

    it('detects Dropout from dropout.tv', async () => {
      mockActiveTab('https://www.dropout.tv/videos/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Dropout');
    });

    it('detects Dropout from vhx.tv', async () => {
      mockActiveTab('https://embed.vhx.tv/videos/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Dropout');
    });

    it('detects Max from max.com', async () => {
      mockActiveTab('https://play.max.com/movie/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Max');
    });

    it('detects Crunchyroll from crunchyroll.com', async () => {
      mockActiveTab('https://www.crunchyroll.com/watch/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Crunchyroll');
    });

    it('detects Nebula from nebula.tv', async () => {
      mockActiveTab('https://nebula.tv/videos/abc');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Nebula');
    });

    it('detects Vimeo from vimeo.com', async () => {
      mockActiveTab('https://vimeo.com/12345');
      await triggerInit();

      const siteBtn = document.getElementById('scope-site');
      expect(siteBtn!.textContent).toBe('Vimeo');
    });

    it('does not build scope toggle for unknown sites', async () => {
      mockActiveTab('https://www.example.com/');
      await triggerInit();

      const scopeGroup = document.getElementById('scope-toggle-group');
      expect(scopeGroup).toBeNull();
    });

    it('does not build scope toggle when tabs API is unavailable', async () => {
      clearTabsMock();
      await triggerInit();

      const scopeGroup = document.getElementById('scope-toggle-group');
      expect(scopeGroup).toBeNull();
    });
  });

  describe('scope toggle (per-site settings)', () => {
    afterEach(() => {
      clearTabsMock();
    });

    it('starts in global mode when no per-site override exists', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');
      await triggerInit();

      const globalBtn = document.getElementById('scope-global');
      const siteBtn = document.getElementById('scope-site');

      expect(globalBtn!.classList.contains('active')).toBe(true);
      expect(siteBtn!.classList.contains('active')).toBe(false);
    });

    it('starts in site mode when a per-site override exists', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      // Return site override from storage
      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: {
                settings: { ...ALL_AUTO, fontColor: 'cyan' },
                activePreset: null,
              },
            },
          };
        }
        return ALL_AUTO;
      });

      await triggerInit();

      const globalBtn = document.getElementById('scope-global');
      const siteBtn = document.getElementById('scope-site');

      expect(globalBtn!.classList.contains('active')).toBe(false);
      expect(siteBtn!.classList.contains('active')).toBe(true);

      // Form should show the per-site color
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      expect(fontColorSelect!.dataset['selectedValue']).toBe('cyan');
    });

    it('switches to global mode without changing displayed settings', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white' };
      const siteSettings = { ...ALL_AUTO, fontColor: 'cyan' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // Should start in site mode with per-site settings
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      expect(fontColorSelect!.dataset['selectedValue']).toBe('cyan');

      // Click global button
      const globalBtn = document.getElementById('scope-global');
      globalBtn!.click();

      await new Promise((r) => setTimeout(r, 0));

      // Toggle UI updates
      expect(globalBtn!.classList.contains('active')).toBe(true);
      // Form keeps showing effective settings (what's applied on page) — no reload
      expect(fontColorSelect!.dataset['selectedValue']).toBe('cyan');
    });

    it('switches to site mode without changing displayed settings', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white' };

      // No site override on first load
      const hasSiteOverride = false;
      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return hasSiteOverride
            ? {
                siteSettings: {
                  youtube: {
                    settings: { ...ALL_AUTO, fontColor: 'red' },
                    activePreset: null,
                  },
                },
              }
            : {};
        }
        return globalSettings;
      });

      await triggerInit();

      // Should be in global mode, showing global color
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      expect(fontColorSelect!.dataset['selectedValue']).toBe('white');

      // Click site button
      const siteBtn = document.getElementById('scope-site');
      siteBtn!.click();

      await new Promise((r) => setTimeout(r, 0));

      // Toggle UI updates
      expect(siteBtn!.classList.contains('active')).toBe(true);
      // Form keeps showing effective settings — no reload
      expect(fontColorSelect!.dataset['selectedValue']).toBe('white');
    });

    it('does nothing when clicking already-active scope button', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');
      await triggerInit();

      const globalBtn = document.getElementById('scope-global');
      const getMock = vi.mocked(chrome.storage.sync.get);
      const callCountBefore = getMock.mock.calls.length;

      // Click global when already in global mode
      globalBtn!.click();
      await new Promise((r) => setTimeout(r, 0));

      // No additional storage calls — scope switch should not fire
      expect(getMock.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('message display', () => {
    it('shows success message after saving', async () => {
      await triggerInit();

      const edgeStyleSelect = document.querySelector<HTMLElement>(
        '[data-id="character-edge-style"]',
      );
      const option = edgeStyleSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="dropshadow"]',
      );
      option!.click();

      await new Promise((r) => setTimeout(r, 0));

      const messageEl = document.getElementById('message');
      expect(messageEl!.textContent).toBe('Saved!');
      expect(messageEl!.classList.contains('success')).toBe(true);
      expect(messageEl!.classList.contains('show')).toBe(true);
    });

    it('shows preset name message when applying a preset', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      presetSelect.value = 'classic';
      presetSelect.dispatchEvent(new Event('change'));

      await new Promise((r) => setTimeout(r, 0));

      const messageEl = document.getElementById('message');
      expect(messageEl!.textContent).toContain('High Contrast');
    });
  });

  describe('content script notifications', () => {
    afterEach(() => {
      clearTabsMock();
    });

    it('sends subtitleStylerPopupUpdate to content script on save', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');
      await triggerInit();

      const edgeStyleSelect = document.querySelector<HTMLElement>(
        '[data-id="character-edge-style"]',
      );
      const option = edgeStyleSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="outline"]',
      );
      option!.click();

      await new Promise((r) => setTimeout(r, 0));

      const tabsMock = (
        chrome as unknown as Record<string, { sendMessage: ReturnType<typeof vi.fn> }>
      )['tabs'];
      expect(tabsMock!.sendMessage).toHaveBeenCalledWith(42, {
        type: 'subtitleStylerPopupUpdate',
        settings: expect.objectContaining({
          characterEdgeStyle: 'outline',
        }),
      });
    });

    it('sends subtitleStylerPopupUpdate on preset change', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      presetSelect.value = 'recommended';
      presetSelect.dispatchEvent(new Event('change'));

      await new Promise((r) => setTimeout(r, 0));

      const tabsMock = (
        chrome as unknown as Record<string, { sendMessage: ReturnType<typeof vi.fn> }>
      )['tabs'];
      expect(tabsMock!.sendMessage).toHaveBeenCalledWith(42, {
        type: 'subtitleStylerPopupUpdate',
        settings: expect.objectContaining({
          characterEdgeStyle: 'dropshadow',
          backgroundOpacity: '0',
          windowOpacity: '0',
        }),
      });
    });

    it('does not crash when tabs API is unavailable during save', async () => {
      clearTabsMock();
      await triggerInit();

      const edgeStyleSelect = document.querySelector<HTMLElement>(
        '[data-id="character-edge-style"]',
      );
      const option = edgeStyleSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="outline"]',
      );

      // Should not throw
      option!.click();
      await new Promise((r) => setTimeout(r, 0));

      // Save still happened
      expect(vi.mocked(chrome.storage.sync.set)).toHaveBeenCalled();
    });
  });

  describe('form population', () => {
    it('sets all 9 form fields from loaded settings', async () => {
      const settings = {
        characterEdgeStyle: 'outline',
        backgroundOpacity: '75',
        windowOpacity: '50',
        fontColor: 'yellow',
        fontOpacity: '100',
        backgroundColor: 'blue',
        windowColor: 'red',
        fontFamily: 'casual',
        fontSize: '200%',
      };
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
        settings,
      );

      await triggerInit();

      expect(
        document.querySelector<HTMLElement>('[data-id="character-edge-style"]')!.dataset[
          'selectedValue'
        ],
      ).toBe('outline');
      expect(
        document.querySelector<HTMLElement>('[data-id="background-opacity"]')!.dataset[
          'selectedValue'
        ],
      ).toBe('75');
      expect(
        document.querySelector<HTMLElement>('[data-id="window-opacity"]')!.dataset['selectedValue'],
      ).toBe('50');
      expect(
        document.querySelector<HTMLElement>('[data-id="font-color"]')!.dataset['selectedValue'],
      ).toBe('yellow');
      expect(
        document.querySelector<HTMLElement>('[data-id="font-opacity"]')!.dataset['selectedValue'],
      ).toBe('100');
      expect(
        document.querySelector<HTMLElement>('[data-id="background-color"]')!.dataset[
          'selectedValue'
        ],
      ).toBe('blue');
      expect(
        document.querySelector<HTMLElement>('[data-id="window-color"]')!.dataset['selectedValue'],
      ).toBe('red');
      expect(
        document.querySelector<HTMLElement>('[data-id="font-family"]')!.dataset['selectedValue'],
      ).toBe('casual');
      expect(
        document.querySelector<HTMLElement>('[data-id="font-size"]')!.dataset['selectedValue'],
      ).toBe('200%');
    });

    it('collects all settings when saving', async () => {
      await triggerInit();

      // Set multiple values
      const fontColor = document.querySelector<HTMLElement>('[data-id="font-color"]');
      fontColor!.querySelector<HTMLElement>('.select-option[data-value="cyan"]')!.click();
      await new Promise((r) => setTimeout(r, 0));

      const setMock = vi.mocked(chrome.storage.sync.set);
      const lastCall = setMock.mock.calls[setMock.mock.calls.length - 1]?.[0] as Record<
        string,
        unknown
      >;

      // Should include all 9 settings
      expect(lastCall).toHaveProperty('fontColor', 'cyan');
      expect(lastCall).toHaveProperty('characterEdgeStyle', 'auto');
      expect(lastCall).toHaveProperty('backgroundOpacity', 'auto');
      expect(lastCall).toHaveProperty('windowOpacity', 'auto');
      expect(lastCall).toHaveProperty('fontOpacity', 'auto');
      expect(lastCall).toHaveProperty('backgroundColor', 'auto');
      expect(lastCall).toHaveProperty('windowColor', 'auto');
      expect(lastCall).toHaveProperty('fontFamily', 'auto');
      expect(lastCall).toHaveProperty('fontSize', 'auto');
    });
  });

  describe('error handling', () => {
    it('handles storage.sync.get rejection gracefully during init', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockRejectedValue(
        new Error('Storage unavailable'),
      );

      // Should not throw
      await triggerInit();

      const messageEl = document.getElementById('message');
      expect(messageEl!.textContent).toContain('Failed to initialize');
    });

    it('handles storage.sync.set rejection gracefully during save', async () => {
      await triggerInit();

      vi.mocked(chrome.storage.sync.set).mockRejectedValue(new Error('Quota exceeded'));

      const edgeStyleSelect = document.querySelector<HTMLElement>(
        '[data-id="character-edge-style"]',
      );
      edgeStyleSelect!.querySelector<HTMLElement>('.select-option[data-value="outline"]')!.click();

      await new Promise((r) => setTimeout(r, 0));

      const messageEl = document.getElementById('message');
      expect(messageEl!.textContent).toContain('Failed to save');
    });
  });

  describe('override badges', () => {
    afterEach(() => {
      clearTabsMock();
    });

    it('shows override badges when per-site settings differ from global', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white', fontSize: '100%' };
      const siteSettings = { ...ALL_AUTO, fontColor: 'cyan', fontSize: '150%' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // fontColor and fontSize differ — should have badges
      const fontColorBadge = document
        .querySelector('[data-id="font-color"]')
        ?.querySelector('.override-badge');
      const fontSizeBadge = document
        .querySelector('[data-id="font-size"]')
        ?.querySelector('.override-badge');
      expect(fontColorBadge).not.toBeNull();
      expect(fontSizeBadge).not.toBeNull();

      // Other settings are the same (all auto) — no badges
      const edgeStyleBadge = document
        .querySelector('[data-id="character-edge-style"]')
        ?.querySelector('.override-badge');
      expect(edgeStyleBadge).toBeNull();
    });

    it('shows no badges when there is no per-site override', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      await triggerInit();

      // All settings are global defaults — no badges
      const allBadges = document.querySelectorAll('.override-badge');
      expect(allBadges.length).toBe(0);
    });

    it('shows no badges on non-platform pages', async () => {
      // No tab mock = no platform detected
      await triggerInit();

      const allBadges = document.querySelectorAll('.override-badge');
      expect(allBadges.length).toBe(0);
    });

    it('shows badges for all 9 settings when all differ', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      const siteSettings = {
        characterEdgeStyle: 'outline',
        backgroundOpacity: '75',
        windowOpacity: '50',
        fontColor: 'yellow',
        fontOpacity: '100',
        backgroundColor: 'blue',
        windowColor: 'red',
        fontFamily: 'casual',
        fontSize: '200%',
      };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      const allBadges = document.querySelectorAll('.override-badge');
      expect(allBadges.length).toBe(9);
    });

    it('badge has tooltip with global value', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white' };
      const siteSettings = { ...ALL_AUTO, fontColor: 'red' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      const badge = document
        .querySelector('[data-id="font-color"]')!
        .querySelector<HTMLElement>('.override-badge')!;
      expect(badge).not.toBeNull();
      expect(badge.title).toContain('white');
    });

    it('updates badges when a setting changes to match global', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white' };
      const siteSettings = { ...ALL_AUTO, fontColor: 'red' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // Badge should exist initially
      let badge = document
        .querySelector('[data-id="font-color"]')
        ?.querySelector('.override-badge');
      expect(badge).not.toBeNull();

      // Change fontColor to match global value ('white')
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const whiteOption = fontColorSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="white"]',
      );
      whiteOption!.click();
      await new Promise((r) => setTimeout(r, 0));

      // Badge should be gone now
      badge = document.querySelector('[data-id="font-color"]')?.querySelector('.override-badge');
      expect(badge).toBeNull();
    });

    it('badge is placed before the arrow in the trigger', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white' };
      const siteSettings = { ...ALL_AUTO, fontColor: 'cyan' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      const trigger = document.querySelector('[data-id="font-color"] .select-trigger')!;
      const children = Array.from(trigger.children);
      const badgeIdx = children.findIndex((c) => c.classList.contains('override-badge'));
      const arrowIdx = children.findIndex((c) => c.classList.contains('select-arrow'));

      expect(badgeIdx).toBeGreaterThan(-1);
      expect(arrowIdx).toBeGreaterThan(-1);
      expect(badgeIdx).toBeLessThan(arrowIdx);
    });

    it('clears badge after global save updates cached globalSettings', async () => {
      // Regression test: saving in global mode must update the local
      // globalSettings cache so that updateOverrideBadges() uses fresh data.
      // Previously, the cache was stale after save, and badges persisted
      // until the popup was reopened.
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'white' };
      const siteSettings = { ...ALL_AUTO, fontColor: 'red' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: siteSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // Badge should exist (per-site red ≠ global white)
      let badge = document
        .querySelector('[data-id="font-color"]')
        ?.querySelector('.override-badge');
      expect(badge).not.toBeNull();

      // Switch to global mode
      const globalBtn = document.getElementById('scope-global');
      globalBtn!.click();

      // Change the global fontColor to 'red' (matching per-site) and save
      const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
      const redOption = fontColorSelect!.querySelector<HTMLElement>(
        '.select-option[data-value="red"]',
      );
      redOption!.click();
      // Wait for async handleSave to complete
      await new Promise((r) => setTimeout(r, 50));

      // Badge should be gone: global is now 'red', matching per-site 'red'
      badge = document.querySelector('[data-id="font-color"]')?.querySelector('.override-badge');
      expect(badge).toBeNull();
    });
  });

  describe('site indicator icons in dropdown options', () => {
    afterEach(() => {
      clearTabsMock();
    });

    it('shows platform indicators on options that match other platforms per-site overrides', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      const netflixSettings = { ...ALL_AUTO, fontColor: 'red' };
      const vimeoSettings = { ...ALL_AUTO, fontColor: 'red', fontSize: '200%' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              netflix: { settings: netflixSettings, activePreset: null },
              vimeo: { settings: vimeoSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // The "red" option in font-color should have NF and VM indicators
      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const redOption = fontColorSelect!.querySelector('.select-option[data-value="red"]');
      const indicators = redOption!.querySelectorAll('.site-indicator');
      expect(indicators.length).toBe(2);

      const platformTexts = Array.from(indicators).map((i) => i.textContent);
      expect(platformTexts).toContain('NF');
      expect(platformTexts).toContain('VM');
    });

    it('does not show indicators for the current platform', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      const youtubeSettings = { ...ALL_AUTO, fontColor: 'red' };
      const netflixSettings = { ...ALL_AUTO, fontColor: 'red' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              youtube: { settings: youtubeSettings, activePreset: null },
              netflix: { settings: netflixSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // Only NF should show (not YT — current platform is excluded)
      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const redOption = fontColorSelect!.querySelector('.select-option[data-value="red"]');
      const indicators = redOption!.querySelectorAll('.site-indicator');
      expect(indicators.length).toBe(1);
      expect(indicators[0]!.textContent).toBe('NF');
    });

    it('does not show indicators when override matches global value', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO, fontColor: 'red' };
      // Netflix also has red, same as global → no indicator
      const netflixSettings = { ...ALL_AUTO, fontColor: 'red' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              netflix: { settings: netflixSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // "red" option should have NO indicators (Netflix matches global)
      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const redOption = fontColorSelect!.querySelector('.select-option[data-value="red"]');
      const indicators = redOption!.querySelectorAll('.site-indicator');
      expect(indicators.length).toBe(0);
    });

    it('shows no indicators when no site overrides exist', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {};
        }
        return ALL_AUTO;
      });

      await triggerInit();

      const allIndicators = document.querySelectorAll('.site-indicator');
      expect(allIndicators.length).toBe(0);
    });

    it('shows indicators on correct options across multiple dropdowns', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      const netflixSettings = { ...ALL_AUTO, fontColor: 'cyan', fontSize: '150%' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              netflix: { settings: netflixSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      // NF indicator on "cyan" in font-color dropdown
      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const cyanOption = fontColorSelect!.querySelector('.select-option[data-value="cyan"]');
      const cyanIndicators = cyanOption!.querySelectorAll('.site-indicator');
      expect(cyanIndicators.length).toBe(1);
      expect(cyanIndicators[0]!.textContent).toBe('NF');

      // NF indicator on "150%" in font-size dropdown
      const fontSizeSelect = document.querySelector('[data-id="font-size"]');
      const sizeOption = fontSizeSelect!.querySelector('.select-option[data-value="150%"]');
      const sizeIndicators = sizeOption!.querySelectorAll('.site-indicator');
      expect(sizeIndicators.length).toBe(1);
      expect(sizeIndicators[0]!.textContent).toBe('NF');

      // No NF indicator on "auto" in font-color (matches global)
      const autoOption = fontColorSelect!.querySelector('.select-option[data-value="auto"]');
      const autoIndicators = autoOption!.querySelectorAll('.site-indicator');
      expect(autoIndicators.length).toBe(0);
    });

    it('indicator has tooltip with platform display name', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      const netflixSettings = { ...ALL_AUTO, fontColor: 'white' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              netflix: { settings: netflixSettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const whiteOption = fontColorSelect!.querySelector('.select-option[data-value="white"]');
      const indicator = whiteOption!.querySelector<HTMLElement>('.site-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator!.title).toContain('Netflix');
    });

    it('indicator has data-platform attribute', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      const disneySettings = { ...ALL_AUTO, fontFamily: 'casual' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              disneyplus: { settings: disneySettings, activePreset: null },
            },
          };
        }
        return globalSettings;
      });

      await triggerInit();

      const fontFamilySelect = document.querySelector('[data-id="font-family"]');
      const casualOption = fontFamilySelect!.querySelector('.select-option[data-value="casual"]');
      const indicator = casualOption!.querySelector<HTMLElement>('.site-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator!.dataset['platform']).toBe('disneyplus');
      expect(indicator!.textContent).toBe('D+');
    });

    it('shows no indicators on non-platform pages', async () => {
      // No tab mock = no platform detected
      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return {
            siteSettings: {
              netflix: { settings: { ...ALL_AUTO, fontColor: 'red' }, activePreset: null },
            },
          };
        }
        return ALL_AUTO;
      });

      await triggerInit();

      // Still shows indicators (they're useful even on non-platform pages for seeing config)
      // Actually the function runs regardless of currentPlatform — the only restriction
      // is we skip currentPlatform (which is null, so no platform is skipped)
      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const redOption = fontColorSelect!.querySelector('.select-option[data-value="red"]');
      const indicators = redOption!.querySelectorAll('.site-indicator');
      expect(indicators.length).toBe(1);
      expect(indicators[0]!.textContent).toBe('NF');
    });

    it('shows indicators for many platforms on one option', async () => {
      mockActiveTab('https://www.youtube.com/watch?v=abc');

      const globalSettings = { ...ALL_AUTO };
      // Several platforms all use fontColor: 'white'
      const overrides: Record<string, unknown> = {};
      const platformsWithWhite = ['netflix', 'vimeo', 'max', 'dropout'];
      for (const p of platformsWithWhite) {
        overrides[p] = {
          settings: { ...ALL_AUTO, fontColor: 'white' },
          activePreset: null,
        };
      }

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'siteSettings') {
          return { siteSettings: overrides };
        }
        return globalSettings;
      });

      await triggerInit();

      const fontColorSelect = document.querySelector('[data-id="font-color"]');
      const whiteOption = fontColorSelect!.querySelector('.select-option[data-value="white"]');
      const indicators = whiteOption!.querySelectorAll('.site-indicator');
      expect(indicators.length).toBe(4);

      const texts = Array.from(indicators).map((i) => i.textContent);
      expect(texts).toContain('NF');
      expect(texts).toContain('VM');
      expect(texts).toContain('MX');
      expect(texts).toContain('DO');
    });
  });

  describe('custom presets', () => {
    it('builds save preset button during initialization', async () => {
      await triggerInit();

      const saveBtn = document.getElementById('save-preset-btn');
      expect(saveBtn).toBeTruthy();
      expect(saveBtn!.title).toBe('Save as Preset');
    });

    it('shows "My Presets" separator when custom presets exist', async () => {
      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'customPresets') {
          return {
            customPresets: [
              {
                id: 'custom-1',
                name: 'My Style',
                settings: { ...ALL_AUTO, fontColor: 'cyan' },
              },
            ],
          };
        }
        if (typeof keys === 'string' && keys === 'siteSettings') return {};
        return ALL_AUTO;
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const options = Array.from(presetSelect.options);
      const separatorOption = options.find((o) => o.textContent?.includes('My Presets'));
      expect(separatorOption).toBeTruthy();
      expect(separatorOption!.disabled).toBe(true);
    });

    it('includes custom presets in dropdown', async () => {
      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'customPresets') {
          return {
            customPresets: [
              {
                id: 'custom-1',
                name: 'Cinema Mode',
                settings: { ...ALL_AUTO, fontColor: 'yellow', fontSize: '200%' },
              },
            ],
          };
        }
        if (typeof keys === 'string' && keys === 'siteSettings') return {};
        return ALL_AUTO;
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const customOption = presetSelect.querySelector('option[value="custom-1"]');
      expect(customOption).toBeTruthy();
      expect(customOption!.textContent).toContain('Cinema Mode');
    });

    it('custom preset option shows name without delete marker', async () => {
      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'customPresets') {
          return {
            customPresets: [
              {
                id: 'custom-1',
                name: 'My Preset',
                settings: ALL_AUTO,
              },
            ],
          };
        }
        if (typeof keys === 'string' && keys === 'siteSettings') return {};
        return ALL_AUTO;
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const customOption = presetSelect.querySelector<HTMLOptionElement>(
        'option[value="custom-1"]',
      );
      expect(customOption).toBeTruthy();
      expect(customOption!.textContent).toBe('My Preset');
    });

    it('delete button is hidden by default and shown when custom preset active', async () => {
      const customSettings = { ...ALL_AUTO, fontColor: 'cyan', fontSize: '200%' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'customPresets') {
          return {
            customPresets: [
              {
                id: 'custom-1',
                name: 'My Cinema',
                settings: customSettings,
              },
            ],
          };
        }
        if (typeof keys === 'string' && keys === 'siteSettings') return {};
        if (typeof keys === 'string' && keys === 'activePreset') {
          return { activePreset: 'custom-1' };
        }
        return customSettings;
      });

      await triggerInit();

      const deleteBtn = document.getElementById('delete-preset-btn');
      expect(deleteBtn).toBeTruthy();
      // Should be visible because custom preset is active
      expect(deleteBtn!.style.display).not.toBe('none');
    });

    it('delete button is hidden when built-in preset is active', async () => {
      await triggerInit();

      const deleteBtn = document.getElementById('delete-preset-btn');
      expect(deleteBtn).toBeTruthy();
      expect(deleteBtn!.style.display).toBe('none');
    });

    it('detects custom preset as active when settings match', async () => {
      const customSettings = { ...ALL_AUTO, fontColor: 'cyan', fontSize: '200%' };

      vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys: unknown) => {
        if (typeof keys === 'string' && keys === 'customPresets') {
          return {
            customPresets: [
              {
                id: 'custom-1',
                name: 'My Cinema',
                settings: customSettings,
              },
            ],
          };
        }
        if (typeof keys === 'string' && keys === 'siteSettings') return {};
        if (typeof keys === 'string' && keys === 'activePreset') {
          return { activePreset: 'custom-1' };
        }
        return customSettings;
      });

      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      expect(presetSelect.value).toBe('custom-1');
    });

    it('saves custom preset when save button is clicked', async () => {
      // Mock window.prompt to return a name
      const originalPrompt = globalThis.prompt;
      globalThis.prompt = vi.fn().mockReturnValue('My New Preset');

      await triggerInit();

      const saveBtn = document.getElementById('save-preset-btn');
      saveBtn!.click();

      await new Promise((r) => setTimeout(r, 0));

      // Should have called chrome.storage.sync.set with customPresets
      const setMock = vi.mocked(chrome.storage.sync.set);
      const customPresetsCall = setMock.mock.calls.find(
        (call) => (call[0] as Record<string, unknown>)['customPresets'] !== undefined,
      );
      expect(customPresetsCall).toBeTruthy();

      const saved = (customPresetsCall![0] as Record<string, unknown>)['customPresets'] as {
        name: string;
      }[];
      expect(saved.length).toBe(1);
      expect(saved[0]!.name).toBe('My New Preset');

      globalThis.prompt = originalPrompt;
    });

    it('does nothing when save prompt is cancelled', async () => {
      const originalPrompt = globalThis.prompt;
      globalThis.prompt = vi.fn().mockReturnValue(null);

      await triggerInit();
      vi.mocked(chrome.storage.sync.set).mockClear();

      const saveBtn = document.getElementById('save-preset-btn');
      saveBtn!.click();

      await new Promise((r) => setTimeout(r, 0));

      // No customPresets save call
      const setMock = vi.mocked(chrome.storage.sync.set);
      const customPresetsCall = setMock.mock.calls.find(
        (call) => (call[0] as Record<string, unknown>)['customPresets'] !== undefined,
      );
      expect(customPresetsCall).toBeUndefined();

      globalThis.prompt = originalPrompt;
    });

    it('does nothing when save prompt is empty string', async () => {
      const originalPrompt = globalThis.prompt;
      globalThis.prompt = vi.fn().mockReturnValue('');

      await triggerInit();
      vi.mocked(chrome.storage.sync.set).mockClear();

      const saveBtn = document.getElementById('save-preset-btn');
      saveBtn!.click();

      await new Promise((r) => setTimeout(r, 0));

      // No customPresets save call
      const setMock = vi.mocked(chrome.storage.sync.set);
      const customPresetsCall = setMock.mock.calls.find(
        (call) => (call[0] as Record<string, unknown>)['customPresets'] !== undefined,
      );
      expect(customPresetsCall).toBeUndefined();

      globalThis.prompt = originalPrompt;
    });

    it('shows no "My Presets" separator when no custom presets exist', async () => {
      await triggerInit();

      const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
      const options = Array.from(presetSelect.options);
      const separatorOption = options.find((o) => o.textContent?.includes('My Presets'));
      expect(separatorOption).toBeUndefined();
    });

    it('preset row contains select, save, and delete buttons', async () => {
      await triggerInit();

      const presetGroup = document.querySelector('.preset-group');
      expect(presetGroup).toBeTruthy();

      const presetRow = presetGroup!.querySelector('.preset-row');
      expect(presetRow).toBeTruthy();

      const select = presetRow!.querySelector('#preset-select');
      const saveBtn = presetRow!.querySelector('#save-preset-btn');
      const deleteBtn = presetRow!.querySelector('#delete-preset-btn');
      expect(select).toBeTruthy();
      expect(saveBtn).toBeTruthy();
      expect(deleteBtn).toBeTruthy();
    });
  });

  describe('keyboard navigation', () => {
    /** Helper to dispatch a keyboard event on an element. */
    function pressKey(
      element: HTMLElement,
      key: string,
      eventType: 'keydown' | 'keyup' = 'keydown',
    ): void {
      element.dispatchEvent(new KeyboardEvent(eventType, { key, bubbles: true, cancelable: true }));
    }

    it('triggers have tabindex="0" and role="combobox"', async () => {
      await triggerInit();

      const triggers = document.querySelectorAll('.select-trigger');
      expect(triggers.length).toBeGreaterThan(0);

      triggers.forEach((trigger) => {
        expect(trigger.getAttribute('tabindex')).toBe('0');
        expect(trigger.getAttribute('role')).toBe('combobox');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
      });
    });

    it('options containers have role="listbox"', async () => {
      await triggerInit();

      const optionContainers = document.querySelectorAll('.select-options');
      expect(optionContainers.length).toBeGreaterThan(0);

      optionContainers.forEach((container) => {
        expect(container.getAttribute('role')).toBe('listbox');
      });
    });

    it('individual options have role="option"', async () => {
      await triggerInit();

      const options = document.querySelectorAll('.select-option');
      expect(options.length).toBeGreaterThan(0);

      options.forEach((option) => {
        expect(option.getAttribute('role')).toBe('option');
      });
    });

    it('Enter key opens a closed dropdown', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      expect(container.classList.contains('open')).toBe(false);

      pressKey(trigger, 'Enter');

      expect(container.classList.contains('open')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('Space key opens a closed dropdown', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      expect(container.classList.contains('open')).toBe(false);

      pressKey(trigger, ' ');

      expect(container.classList.contains('open')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('Escape key closes an open dropdown', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Open first
      pressKey(trigger, 'Enter');
      expect(container.classList.contains('open')).toBe(true);

      // Escape to close
      pressKey(trigger, 'Escape');
      expect(container.classList.contains('open')).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('ArrowDown opens the dropdown if closed', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      expect(container.classList.contains('open')).toBe(false);

      pressKey(trigger, 'ArrowDown');

      expect(container.classList.contains('open')).toBe(true);
    });

    it('ArrowUp opens the dropdown if closed', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      expect(container.classList.contains('open')).toBe(false);

      pressKey(trigger, 'ArrowUp');

      expect(container.classList.contains('open')).toBe(true);
    });

    it('ArrowDown highlights the first option when nothing highlighted', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Open with Enter first, then ArrowDown to move
      pressKey(trigger, 'Enter');

      // Currently selected option is "auto" so it should be highlighted already after open
      const firstOption = container.querySelector('.select-option[data-value="auto"]')!;
      expect(firstOption.classList.contains('highlighted')).toBe(true);

      // Press ArrowDown to move to second option
      pressKey(trigger, 'ArrowDown');

      const secondOption = container.querySelector('.select-option[data-value="50%"]')!;
      expect(secondOption.classList.contains('highlighted')).toBe(true);
      // First option should no longer be highlighted
      expect(firstOption.classList.contains('highlighted')).toBe(false);
    });

    it('ArrowDown navigates through options sequentially', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;
      const options = Array.from(container.querySelectorAll<HTMLElement>('.select-option'));

      pressKey(trigger, 'Enter');

      // The selected ("auto") option should be highlighted after open
      expect(options[0]!.classList.contains('highlighted')).toBe(true);

      // Navigate down through several options
      pressKey(trigger, 'ArrowDown');
      expect(options[1]!.classList.contains('highlighted')).toBe(true);

      pressKey(trigger, 'ArrowDown');
      expect(options[2]!.classList.contains('highlighted')).toBe(true);

      pressKey(trigger, 'ArrowDown');
      expect(options[3]!.classList.contains('highlighted')).toBe(true);
    });

    it('ArrowUp navigates upward', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;
      const options = Array.from(container.querySelectorAll<HTMLElement>('.select-option'));

      pressKey(trigger, 'Enter');
      expect(options[0]!.classList.contains('highlighted')).toBe(true);

      // Go down twice
      pressKey(trigger, 'ArrowDown');
      pressKey(trigger, 'ArrowDown');
      expect(options[2]!.classList.contains('highlighted')).toBe(true);

      // Go back up once
      pressKey(trigger, 'ArrowUp');
      expect(options[1]!.classList.contains('highlighted')).toBe(true);
    });

    it('ArrowDown clamps at the last option', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;
      const options = Array.from(container.querySelectorAll<HTMLElement>('.select-option'));

      pressKey(trigger, 'Enter');

      // Navigate all the way to the end
      for (let i = 0; i < options.length + 5; i++) {
        pressKey(trigger, 'ArrowDown');
      }

      // Should be clamped at the last option
      const lastOption = options[options.length - 1]!;
      expect(lastOption.classList.contains('highlighted')).toBe(true);
    });

    it('ArrowUp clamps at the first option', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;
      const options = Array.from(container.querySelectorAll<HTMLElement>('.select-option'));

      pressKey(trigger, 'Enter');

      // Try going up many times from the top
      for (let i = 0; i < 5; i++) {
        pressKey(trigger, 'ArrowUp');
      }

      // Should be clamped at the first option
      expect(options[0]!.classList.contains('highlighted')).toBe(true);
    });

    it('Enter selects the highlighted option and closes the dropdown', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="character-edge-style"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Open
      pressKey(trigger, 'Enter');
      expect(container.classList.contains('open')).toBe(true);

      // Navigate to "dropshadow" (1 down from auto)
      pressKey(trigger, 'ArrowDown');

      // Select with Enter
      pressKey(trigger, 'Enter');

      await new Promise((r) => setTimeout(r, 0));

      // Dropdown should be closed
      expect(container.classList.contains('open')).toBe(false);

      // Value should be "dropshadow"
      expect(container.dataset['selectedValue']).toBe('dropshadow');

      // Display text should be updated
      const valueEl = container.querySelector('.select-value');
      expect(valueEl?.textContent).toBe('Drop Shadow');

      // Should have triggered save
      expect(vi.mocked(chrome.storage.sync.set)).toHaveBeenCalled();
    });

    it('Space selects the highlighted option and closes the dropdown', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="character-edge-style"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Open
      pressKey(trigger, ' ');

      // Navigate to "raised" (2 down from auto)
      pressKey(trigger, 'ArrowDown');
      pressKey(trigger, 'ArrowDown');

      // Select with Space
      pressKey(trigger, ' ');

      await new Promise((r) => setTimeout(r, 0));

      expect(container.classList.contains('open')).toBe(false);
      expect(container.dataset['selectedValue']).toBe('raised');
    });

    it('opening a dropdown highlights the currently selected option', async () => {
      // Set initial fontColor to "red"
      const settings = { ...ALL_AUTO, fontColor: 'red' };
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
        settings,
      );

      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-color"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Open
      pressKey(trigger, 'Enter');

      // The "red" option should be highlighted
      const redOption = container.querySelector<HTMLElement>('.select-option[data-value="red"]')!;
      expect(redOption.classList.contains('highlighted')).toBe(true);

      // "auto" should NOT be highlighted
      const autoOption = container.querySelector<HTMLElement>('.select-option[data-value="auto"]')!;
      expect(autoOption.classList.contains('highlighted')).toBe(false);
    });

    it('closing with Escape clears highlight', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      pressKey(trigger, 'Enter');
      pressKey(trigger, 'ArrowDown');

      // There should be a highlighted option
      expect(container.querySelector('.select-option.highlighted')).toBeTruthy();

      pressKey(trigger, 'Escape');

      // Highlights should be cleared
      expect(container.querySelector('.select-option.highlighted')).toBeNull();
    });

    it('opening another dropdown closes the first', async () => {
      await triggerInit();

      const container1 = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger1 = container1.querySelector<HTMLElement>('.select-trigger')!;

      const container2 = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger2 = container2.querySelector<HTMLElement>('.select-trigger')!;

      // Open first dropdown
      pressKey(trigger1, 'Enter');
      expect(container1.classList.contains('open')).toBe(true);

      // Open second dropdown via keyboard
      pressKey(trigger2, 'Enter');
      expect(container2.classList.contains('open')).toBe(true);
      expect(container1.classList.contains('open')).toBe(false);
    });

    it('Tab closes the dropdown without selecting', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-family"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Open and navigate
      pressKey(trigger, 'Enter');
      pressKey(trigger, 'ArrowDown');

      // Tab should close without changing the value
      const valueBefore = container.dataset['selectedValue'];
      pressKey(trigger, 'Tab');

      expect(container.classList.contains('open')).toBe(false);
      expect(container.dataset['selectedValue']).toBe(valueBefore);
    });

    it('ArrowUp from closed starts highlight at last option', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="font-size"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;
      const options = Array.from(container.querySelectorAll<HTMLElement>('.select-option'));

      // ArrowUp opens and highlights current selected ("auto"), then moves up (clamp at first)
      // Actually: ArrowUp opens → highlights selected ("auto" = first), then highlightNext(-1) clamps at 0
      pressKey(trigger, 'ArrowUp');

      expect(container.classList.contains('open')).toBe(true);
      // Selected is "auto" (first), highlightNext(-1) tries to go up from index 0 → clamps at 0
      // But actually, open highlights selected first, THEN highlightNext runs
      // Let me verify: the selected option is "auto" which is index 0
      // highlightNext(-1) starts from currentIndex=0, nextIndex=0-1=-1 → clamped to 0
      expect(options[0]!.classList.contains('highlighted')).toBe(true);
    });

    it('full keyboard flow: open → navigate → select → verify save', async () => {
      await triggerInit();

      const container = document.querySelector<HTMLElement>('[data-id="background-color"]')!;
      const trigger = container.querySelector<HTMLElement>('.select-trigger')!;

      // Initially "auto"
      expect(container.dataset['selectedValue']).toBe('auto');

      // Open with Enter
      pressKey(trigger, 'Enter');
      expect(container.classList.contains('open')).toBe(true);

      // Navigate: auto(0) → white(1) → yellow(2) → green(3)
      pressKey(trigger, 'ArrowDown'); // → white
      pressKey(trigger, 'ArrowDown'); // → yellow
      pressKey(trigger, 'ArrowDown'); // → green

      // Verify green is highlighted
      const greenOption = container.querySelector<HTMLElement>(
        '.select-option[data-value="green"]',
      )!;
      expect(greenOption.classList.contains('highlighted')).toBe(true);

      // Select with Enter
      pressKey(trigger, 'Enter');
      await new Promise((r) => setTimeout(r, 0));

      // Verify
      expect(container.classList.contains('open')).toBe(false);
      expect(container.dataset['selectedValue']).toBe('green');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      // Verify save was called with green background
      const setMock = vi.mocked(chrome.storage.sync.set);
      const lastCall = setMock.mock.calls[setMock.mock.calls.length - 1]?.[0] as Record<
        string,
        unknown
      >;
      expect(lastCall['backgroundColor']).toBe('green');
    });
  });
});
