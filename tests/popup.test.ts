import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Popup UI Integration', () => {
  beforeEach(() => {
    // Reset DOM
    document.documentElement.innerHTML = html;

    // Reset mocks
    vi.clearAllMocks();
  });

  async function triggerInit(): Promise<void> {
    if (typeof domContentLoadedCallback === 'function') {
      domContentLoadedCallback(new Event('DOMContentLoaded'));
      // wait for microtasks
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  it('initializes popup and loads settings properly', async () => {
    const mockedSettings = {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'red',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
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
    vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
      characterEdgeStyle: 'auto',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'auto',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    });

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

  it('handles reset button click', async () => {
    vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'red',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    });

    await triggerInit();

    const fontColorSelect = document.querySelector<HTMLElement>('[data-id="font-color"]');
    if (!fontColorSelect) throw new Error('fontColorSelect not found');
    expect(fontColorSelect.dataset['selectedValue']).toBe('red');

    const resetBtn = document.getElementById('reset-btn');
    resetBtn?.click();

    await new Promise((r) => setTimeout(r, 0));

    expect(fontColorSelect.dataset['selectedValue']).toBe('auto');
    const setMock = vi.mocked(chrome.storage.sync.set);
    expect(setMock.mock.calls.length).toBeGreaterThan(0);
    const lastCall = setMock.mock.calls[setMock.mock.calls.length - 1];
    if (!lastCall) throw new Error('set not called');
    const saveCallArg = lastCall[0] as Partial<import('../src/types/index.js').StorageSettings>;
    expect(saveCallArg.fontColor).toBe('auto');
  });
});
