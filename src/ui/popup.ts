import type { StorageSettings } from '../types/index.js';
import { loadSettings, saveSettings, Settings } from '../storage.js';
import { debug } from '../debug.js';

type CharacterEdgeStyle = StorageSettings['characterEdgeStyle'];

function populateForm(settings: StorageSettings): void {
  const characterEdgeStyle = document.getElementById('character-edge-style');
  const backgroundOpacity = document.getElementById('background-opacity');
  const windowOpacity = document.getElementById('window-opacity');

  if (characterEdgeStyle instanceof HTMLSelectElement) {
    characterEdgeStyle.value = settings.characterEdgeStyle || 'auto';
  }
  if (backgroundOpacity instanceof HTMLSelectElement) {
    backgroundOpacity.value = settings.backgroundOpacity || 'auto';
  }
  if (windowOpacity instanceof HTMLSelectElement) {
    windowOpacity.value = settings.windowOpacity || 'auto';
  }
}



function collectSettings(): Partial<StorageSettings> {
  const characterEdgeStyleEl = document.getElementById('character-edge-style');
  const backgroundOpacityEl = document.getElementById('background-opacity');
  const windowOpacityEl = document.getElementById('window-opacity');

  const characterEdgeValue = characterEdgeStyleEl instanceof HTMLSelectElement ? characterEdgeStyleEl.value : 'auto';
  const backgroundOpacityValue = backgroundOpacityEl instanceof HTMLSelectElement ? backgroundOpacityEl.value : 'auto';
  const windowOpacityValue = windowOpacityEl instanceof HTMLSelectElement ? windowOpacityEl.value : 'auto';

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

async function initializePopup(): Promise<void> {
  try {
    const settings = await loadSettings();
    populateForm(settings);

    const resetBtn = document.getElementById('reset-btn');
    const presetSelect = document.getElementById('preset-select');

    if (resetBtn) {
      resetBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleReset();
      });
    }

    if (presetSelect) {
      presetSelect.addEventListener('change', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLSelectElement)) return;
        await applyPreset(target.value);
      });
    }

    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', async () => {
        await handleSave();
      });
    });

  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showMessage('Failed to initialize popup', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => { initializePopup(); });

