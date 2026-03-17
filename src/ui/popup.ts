// Inject the Chrome API mock only in development builds.
// esbuild replaces __DEV__ with a boolean literal at compile time, so this
// import is completely eliminated from the production bundle.
if (__DEV__) void import('./mock-chrome.js');
import type { StorageSettings } from '../types/index.js';
import { loadSettings, saveSettings } from '../storage.js';
import { debug } from '../debug.js';
import { generateCombinedCssRules } from '../css-mappings.js';

const ID_TO_SETTING_KEY: Record<string, keyof StorageSettings> = {
  'character-edge-style': 'characterEdgeStyle',
  'background-opacity': 'backgroundOpacity',
  'window-opacity': 'windowOpacity',
  'font-color': 'fontColor',
  'font-opacity': 'fontOpacity',
  'background-color': 'backgroundColor',
  'window-color': 'windowColor',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
};

function setCustomSelectValue(container: HTMLElement | null, value: string): void {
  if (!container) return;
  const options = container.querySelectorAll('.select-option');
  const triggerValue = container.querySelector('.select-value');

  container.dataset['selectedValue'] = value;

  options.forEach((opt) => {
    if (!(opt instanceof HTMLElement)) return;
    if (opt.dataset['value'] === value) {
      opt.classList.add('selected');
      if (triggerValue) {
        triggerValue.textContent = opt.textContent.trim();
      }
    } else {
      opt.classList.remove('selected');
    }
  });
}

function getCustomSelectValue(container: HTMLElement | null): string {
  if (!container) return 'auto';
  const selected = container.querySelector('.select-option.selected');
  return selected instanceof HTMLElement ? (selected.dataset['value'] ?? 'auto') : 'auto';
}

function updatePreview(): void {
  const currentSettings = collectSettings();

  const windowEl = document.getElementById('preview-window');
  const bgEl = document.getElementById('preview-bg');
  const textEl = document.getElementById('preview-text');

  if (windowEl) {
    windowEl.style.cssText = generateCombinedCssRules('window', currentSettings).join(' ');
  }

  if (bgEl) {
    bgEl.style.cssText = generateCombinedCssRules('background', currentSettings).join(' ');
  }

  if (textEl) {
    textEl.style.cssText = generateCombinedCssRules('subtitle', currentSettings).join(' ');
    // Small Caps requires font-variant, not just a different font-family
    const fontFamilyEl = document.querySelector('[data-id="font-family"]');
    const fontFamilyValue =
      fontFamilyEl instanceof HTMLElement ? fontFamilyEl.dataset['selectedValue'] : 'auto';
    textEl.style.fontVariant = fontFamilyValue === 'small-caps' ? 'small-caps' : 'normal';
  }
}

function populateForm(settings: StorageSettings): void {
  Object.entries(ID_TO_SETTING_KEY).forEach(([id, settingKey]) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el instanceof HTMLElement) {
      setCustomSelectValue(el, settings[settingKey] as string);
    }
  });
  updateOpacityStates();
  updatePreview();
}

function updateOpacityStates(): void {
  const colorEl = document.querySelector('[data-id="font-color"]');
  const opacityEl = document.querySelector('[data-id="font-opacity"]');
  const helpEl = document.getElementById('font-opacity-help');

  if (colorEl instanceof HTMLElement && opacityEl instanceof HTMLElement) {
    const colorValue = colorEl.dataset['selectedValue'] ?? 'auto';
    const opacityValue = opacityEl.dataset['selectedValue'] ?? 'auto';

    if (colorValue === 'auto' && opacityValue !== 'auto') {
      helpEl?.classList.remove('hidden');
    } else {
      helpEl?.classList.add('hidden');
    }
  }
}

function collectSettings(): Partial<StorageSettings> {
  const partialSettings: Record<string, string> = {};

  Object.entries(ID_TO_SETTING_KEY).forEach(([id, settingKey]) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el instanceof HTMLElement) {
      partialSettings[settingKey] = getCustomSelectValue(el);
    }
  });

  return partialSettings as unknown as Partial<StorageSettings>;
}

function showMessage(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const messageEl = document.getElementById('message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = `message ${type} show`;

    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'message';
      }, 300);
    }, 2500);
  }
}

async function handleSave(): Promise<void> {
  try {
    const settings = collectSettings();
    debug.log(`Saving settings: ${JSON.stringify(settings)}`);
    await saveSettings(settings);
    updatePreview();
    showMessage('Saved!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showMessage('Failed to save settings', 'error');
  }
}

async function handleReset(): Promise<void> {
  populateForm({
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
  await handleSave();
  showMessage('Saved', 'success');
}

function setupCustomSelects(): void {
  const selects = document.querySelectorAll('.custom-select');

  selects.forEach((select) => {
    if (!(select instanceof HTMLElement)) return;
    const container = select;
    const trigger = container.querySelector('.select-trigger');
    const options = container.querySelectorAll('.select-option');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains('open');

      document.querySelectorAll('.custom-select.open').forEach((open) => {
        open.classList.remove('open');
      });

      if (!isOpen) {
        container.classList.add('open');
      }
    });

    options.forEach((option) => {
      if (!(option instanceof HTMLElement)) return;
      const el = option;
      el.addEventListener('click', () => {
        const value = el.dataset['value'] ?? 'auto';
        const text = el.textContent.trim();

        container.querySelectorAll('.select-option').forEach((opt) => {
          opt.classList.remove('selected');
        });
        el.classList.add('selected');

        container.dataset['selectedValue'] = value;

        const valueEl = container.querySelector('.select-value');
        if (valueEl) valueEl.textContent = text;

        container.classList.remove('open');

        updatePreview();
        updateOpacityStates();
        void handleSave();
      });
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach((open) => {
      open.classList.remove('open');
    });
  });
}

async function initializePopup(): Promise<void> {
  try {
    const settings = await loadSettings();
    populateForm(settings);

    setupCustomSelects();

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        void handleReset();
      });
    }
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showMessage('Failed to initialize popup', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initializePopup();
});
