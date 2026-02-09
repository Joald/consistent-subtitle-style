import type { StorageSettings, ValidCharacterEdgeStyles, ValidOpacityValues } from '../types/index.js';

type CharacterEdgeStyle = StorageSettings['characterEdgeStyle'];

async function loadSettings(): Promise<StorageSettings> {
  if (!chrome?.storage?.sync) {
    console.log('Chrome storage not available, returning defaults');
    return { characterEdgeStyle: 'auto', backgroundOpacity: 'auto', windowOpacity: 'auto' };
  }
  
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (result: Record<string, unknown>) => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        resolve({ characterEdgeStyle: 'auto', backgroundOpacity: 'auto', windowOpacity: 'auto' });
      } else {
        console.log('Raw storage result:', result);
        const settings: StorageSettings = { 
          characterEdgeStyle: 'auto', 
          backgroundOpacity: 'auto', 
          windowOpacity: 'auto'
        };

        if (typeof result === 'object' && result !== null) {
          const charEdgeStyle = result['characterEdgeStyle'];
          const bgOpacity = result['backgroundOpacity'];
          const winOpacity = result['windowOpacity'];
          
          if (typeof charEdgeStyle === 'string' && isValidCharacterEdgeStyle(charEdgeStyle)) {
            settings.characterEdgeStyle = charEdgeStyle;
          }
          if (typeof bgOpacity === 'string' && isValidOpacity(bgOpacity)) {
            settings.backgroundOpacity = bgOpacity;
          }
          if (typeof winOpacity === 'string' && isValidOpacity(winOpacity)) {
            settings.windowOpacity = winOpacity;
          }
        }
        console.log('Processed settings:', settings);
        resolve(settings);
      }
    });
  });
}

async function saveSettings(settings: Partial<StorageSettings>): Promise<void> {
  if (!chrome?.storage?.sync) return Promise.resolve();
  
  return new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        console.log('Settings saved to Chrome storage:', settings);
        // Notify content scripts that settings have changed
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
              console.warn('🔍 POPUP: Could not query tabs:', chrome.runtime.lastError);
              return;
            }
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'subtitleStylerPopupUpdate',
                settings: settings
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.warn('🔍 POPUP: Could not send message to tab:', chrome.runtime.lastError);
                } else {
                  console.log('🔍 POPUP: Successfully notified content script');
                }
              });
            }
          });
        } catch (error) {
          console.warn('🔍 POPUP: Tabs API not available in popup context:', error);
        }
        resolve();
      }
    });
  });
}

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

function isValidCharacterEdgeStyle(value: string): value is CharacterEdgeStyle {
  const validStyles = ['auto', 'dropshadow', 'none', 'raised', 'depressed', 'outline'] as const;
  return validStyles.includes(value as CharacterEdgeStyle);
}

function isValidOpacity(value: string): value is 'auto' | '0' | '25' | '50' | '75' | '100' {
  const validOpacities = ['auto', '0', '25', '50', '75', '100'] as const;
  return validOpacities.includes(value as 'auto' | '0' | '25' | '50' | '75' | '100');
}

function collectSettings(): Partial<StorageSettings> {
  const characterEdgeStyleEl = document.getElementById('character-edge-style');
  const backgroundOpacityEl = document.getElementById('background-opacity');
  const windowOpacityEl = document.getElementById('window-opacity');
  
  const characterEdgeValue = characterEdgeStyleEl instanceof HTMLSelectElement ? characterEdgeStyleEl.value : 'auto';
  const backgroundOpacityValue = backgroundOpacityEl instanceof HTMLSelectElement ? backgroundOpacityEl.value : 'auto';
  const windowOpacityValue = windowOpacityEl instanceof HTMLSelectElement ? windowOpacityEl.value : 'auto';
  
  console.log('🔍 POPUP: collectSettings:', {
    characterEdgeStyle: characterEdgeValue,
    backgroundOpacity: backgroundOpacityValue,
    windowOpacity: windowOpacityValue,
    elements: { characterEdgeStyle: !!characterEdgeStyleEl, backgroundOpacity: !!backgroundOpacityEl, windowOpacity: !!windowOpacityEl }
  });
  
  const result: Partial<StorageSettings> = {};
  
  if (isValidCharacterEdgeStyle(characterEdgeValue)) {
    result.characterEdgeStyle = characterEdgeValue;
  }
  if (isValidOpacity(backgroundOpacityValue)) {
    result.backgroundOpacity = backgroundOpacityValue;
  }
  if (isValidOpacity(windowOpacityValue)) {
    result.windowOpacity = windowOpacityValue;
  }
  
  return result;
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
  console.log('🔍 POPUP: handleSave called');
  try {
    const settings = collectSettings();
    console.log('🔍 POPUP: Collected settings:', settings);
    await saveSettings(settings);
    console.log('🔍 POPUP: Settings saved to storage and content scripts notified');
    showMessage('Settings saved and applied', 'success');
  } catch (error) {
    console.error('🔍 POPUP: Failed to save settings:', error);
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
    
    console.log('Setting up event listeners:', { resetBtn: !!resetBtn, presetSelect: !!presetSelect });
    
    if (resetBtn) {
      resetBtn.addEventListener('click', async (e) => {
        console.log('Reset button clicked');
        e.preventDefault();
        await handleReset();
      });
    }
    
    if (presetSelect) {
      presetSelect.addEventListener('change', async (e) => {
        console.log('Preset select changed');
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

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM content loaded');
  initializePopup();
});

if (document.readyState === 'loading') {
  console.log('DOM still loading, adding event listener');
} else {
  console.log('DOM already loaded, initializing immediately');
  initializePopup();
}