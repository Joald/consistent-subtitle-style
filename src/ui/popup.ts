import type { StorageSettings } from '../types/index.js';
import { loadSettings, saveSettings, Settings } from '../storage.js';
import { debug } from '../debug.js';

function setCustomSelectValue(container: HTMLElement | null, value: string): void {
  if (!container) return;
  const options = container.querySelectorAll('.select-option');
  const triggerValue = container.querySelector('.select-value');

  options.forEach(opt => {
    if (!(opt instanceof HTMLElement)) return;
    if (opt.dataset['value'] === value) {
      opt.classList.add('selected');
      if (triggerValue) {
        triggerValue.textContent = opt.textContent;
      }
    } else {
      opt.classList.remove('selected');
    }
  });
}

function getCustomSelectValue(container: HTMLElement | null): string {
  if (!container) return 'auto';
  const selected = container.querySelector('.select-option.selected');
  return selected instanceof HTMLElement ? selected.dataset['value'] || 'auto' : 'auto';
}

function populateForm(settings: StorageSettings): void {
  const characterEdgeStyle = document.querySelector('[data-id="character-edge-style"]');
  const backgroundOpacity = document.querySelector('[data-id="background-opacity"]');
  const windowOpacity = document.querySelector('[data-id="window-opacity"]');

  if (characterEdgeStyle instanceof HTMLElement) setCustomSelectValue(characterEdgeStyle, settings.characterEdgeStyle || 'auto');
  if (backgroundOpacity instanceof HTMLElement) setCustomSelectValue(backgroundOpacity, settings.backgroundOpacity || 'auto');
  if (windowOpacity instanceof HTMLElement) setCustomSelectValue(windowOpacity, settings.windowOpacity || 'auto');
}

function collectSettings(): Partial<StorageSettings> {
  const characterEdgeStyleEl = document.querySelector('[data-id="character-edge-style"]');
  const backgroundOpacityEl = document.querySelector('[data-id="background-opacity"]');
  const windowOpacityEl = document.querySelector('[data-id="window-opacity"]');

  const characterEdgeValue = characterEdgeStyleEl instanceof HTMLElement ? getCustomSelectValue(characterEdgeStyleEl) : 'auto';
  const backgroundOpacityValue = backgroundOpacityEl instanceof HTMLElement ? getCustomSelectValue(backgroundOpacityEl) : 'auto';
  const windowOpacityValue = windowOpacityEl instanceof HTMLElement ? getCustomSelectValue(windowOpacityEl) : 'auto';

  const tempSettings = new Settings({
    characterEdgeStyle: 'auto',
    backgroundOpacity: 'auto',
    windowOpacity: 'auto'
  });

  if (typeof characterEdgeValue === 'string') tempSettings.set('characterEdgeStyle', characterEdgeValue);
  if (typeof backgroundOpacityValue === 'string') tempSettings.set('backgroundOpacity', backgroundOpacityValue);
  if (typeof windowOpacityValue === 'string') tempSettings.set('windowOpacity', windowOpacityValue);

  return tempSettings.toObject();
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
    debug.log(`Saving settings: characterEdge=${settings.characterEdgeStyle}, bgOpacity=${settings.backgroundOpacity}, winOpacity=${settings.windowOpacity}`);
    await saveSettings(settings);
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
    windowOpacity: 'auto'
  });
  await handleSave();
  showMessage('Saved', 'success');
}

function setupCustomSelects(): void {
  const selects = document.querySelectorAll('.custom-select');

  selects.forEach(select => {
    if (!(select instanceof HTMLElement)) return;
    const container = select;
    const trigger = container.querySelector('.select-trigger');
    const options = container.querySelectorAll('.select-option');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains('open');

      document.querySelectorAll('.custom-select.open').forEach(open => {
        open.classList.remove('open');
      });

      if (!isOpen) {
        container.classList.add('open');
      }
    });

    options.forEach(option => {
      if (!(option instanceof HTMLElement)) return;
      const el = option;
      el.addEventListener('click', async () => {
        const value = el.dataset['value'];
        const text = el.textContent;

        container.querySelectorAll('.select-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        el.classList.add('selected');

        const valueEl = container.querySelector('.select-value');
        if (valueEl) valueEl.textContent = text;

        container.classList.remove('open');

        await handleSave();
      });
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach(open => {
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
      resetBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleReset();
      });
    }

  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showMessage('Failed to initialize popup', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => { initializePopup(); });
