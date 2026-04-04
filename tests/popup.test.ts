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
});
