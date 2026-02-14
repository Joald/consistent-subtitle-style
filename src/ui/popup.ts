import type { StorageSettings } from '../types/index.js';
import { loadSettings, saveSettings, Settings } from '../storage.js';
import { debug } from '../debug.js';

function setCustomSelectValue(container: HTMLElement | null, value: string): void {
  if (!container) return;
  const options = container.querySelectorAll('.select-option');
  const triggerValue = container.querySelector('.select-value');
  
  options.forEach(opt => {
    const el = opt as HTMLElement;
    if (el.dataset['value'] === value) {
      el.classList.add('selected');
      if (triggerValue) {
        triggerValue.textContent = el.textContent;
      }
    } else {
      el.classList.remove('selected');
    }
  });
}

function populateForm(settings: StorageSettings): void {
  const characterEdgeStyle = document.querySelector('[data-id="character-edge-style"]');
  const backgroundOpacity = document.querySelector('[data-id="background-opacity"]');
  const windowOpacity = document.querySelector('[data-id="window-opacity"]');

  setCustomSelectValue(characterEdgeStyle as HTMLElement, settings.characterEdgeStyle || 'auto');
  setCustomSelectValue(backgroundOpacity as HTMLElement, settings.backgroundOpacity || 'auto');
  setCustomSelectValue(windowOpacity as HTMLElement, settings.windowOpacity || 'auto');
}

function getCustomSelectValue(container: HTMLElement | null): string {
  if (!container) return 'auto';
  const selected = container.querySelector('.select-option.selected');
  return selected ? (selected as HTMLElement).dataset['value'] || 'auto' : 'auto';
}

function collectSettings(): Partial<StorageSettings> {
  const characterEdgeStyleEl = document.querySelector('[data-id="character-edge-style"]');
  const backgroundOpacityEl = document.querySelector('[data-id="background-opacity"]');
  const windowOpacityEl = document.querySelector('[data-id="window-opacity"]');

  const characterEdgeValue = getCustomSelectValue(characterEdgeStyleEl as HTMLElement);
  const backgroundOpacityValue = getCustomSelectValue(backgroundOpacityEl as HTMLElement);
  const windowOpacityValue = getCustomSelectValue(windowOpacityEl as HTMLElement);

  const tempSettings = new Settings({
    characterEdgeStyle: 'auto',
    backgroundOpacity: 'auto',
    windowOpacity: 'auto'
  });

  tempSettings.set('characterEdgeStyle', characterEdgeValue);
  tempSettings.set('backgroundOpacity', backgroundOpacityValue);
  tempSettings.set('windowOpacity', windowOpacityValue);

  return tempSettings.toObject();
}

function showMessage(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const messageEl = document.getElementById('message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;

    setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'message';
    }, 3000);
  }
}

async function handleSave(): Promise<void> {
  try {
    const settings = collectSettings();
    debug.log(`Saving settings: characterEdge=${settings.characterEdgeStyle}, bgOpacity=${settings.backgroundOpacity}, winOpacity=${settings.windowOpacity}`);
    await saveSettings(settings);
    showMessage('Settings saved and applied', 'success');
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
  showMessage('Settings reset to defaults', 'success');
}

async function applyPreset(presetName: string): Promise<void> {
  const presets: Record<string, StorageSettings> = {
    highContrast: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '100',
      windowOpacity: '100'
    },
    cinema: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '75',
      windowOpacity: '50'
    },
    minimal: {
      characterEdgeStyle: 'none',
      backgroundOpacity: '0',
      windowOpacity: '0'
    },
    accessibility: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '100',
      windowOpacity: '100'
    }
  };

  const preset = presets[presetName];
  if (preset) {
    populateForm(preset);
    await handleSave();
    showMessage(`Applied ${presetName} preset`, 'success');
  }
}

function setupCustomSelects(): void {
  const selects = document.querySelectorAll('.custom-select');
  
  selects.forEach(select => {
    const container = select as HTMLElement;
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
      const el = option as HTMLElement;
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
        
        if (container.dataset['id'] === 'preset-select' && value) {
          await applyPreset(value);
        }
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
