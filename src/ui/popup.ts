// Inject the Chrome API mock only in development builds.
// esbuild replaces __DEV__ with a boolean literal at compile time, so this
// import is completely eliminated from the production bundle.
if (__DEV__) void import('./mock-chrome.js');
import type { StorageSettings } from '../types/index.js';
import { loadSettings, applyPreset, DEFAULTS } from '../storage.js';
import { debug } from '../debug.js';
import { generateCombinedCssRules } from '../css-mappings.js';
import { getAvailablePresets, getPresetById, detectActivePreset } from '../presets.js';
import { loadSiteOverride, saveSiteOverride, clearSiteOverride } from '../site-settings.js';
import type { Platform } from '../platforms/index.js';

/** Detected platform for the active tab (null when on a non-supported site). */
let currentPlatform: Platform | null = null;
/** Whether we're in per-site mode (true) or global mode (false). */
let siteScope = false;

const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  youtube: 'YouTube',
  nebula: 'Nebula',
  dropout: 'Dropout',
};

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

    const fullSettings: StorageSettings = { ...DEFAULTS, ...settings };

    if (siteScope && currentPlatform) {
      // Per-site mode: save to site overrides
      await saveSiteOverride(currentPlatform, fullSettings, null);
    } else {
      // Global mode: save to chrome.storage.sync directly
      if (typeof chrome !== 'undefined') {
        await chrome.storage.sync.set({ ...settings, activePreset: null });
      }
    }

    updatePresetIndicator(settings);
    updatePreview();

    // Notify content scripts directly so live updates work even when
    // chrome.storage.onChanged doesn't fire in cross-origin iframes (e.g. Dropout).
    // injection.ts already has a handler for 'subtitleStylerPopupUpdate'.
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) {
        await chrome.tabs
          .sendMessage(tab.id, {
            type: 'subtitleStylerPopupUpdate',
            settings,
          })
          .catch(() => {
            // Tab may not have a content script (e.g. non-matching URL) — ignore.
          });
      }
    } catch {
      // Popup may not have tabs permission in some contexts — ignore.
    }

    showMessage('Saved!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showMessage('Failed to save settings', 'error');
  }
}

async function handleReset(): Promise<void> {
  const defaults: StorageSettings = { ...DEFAULTS };
  populateForm(defaults);

  if (siteScope && currentPlatform) {
    // In per-site mode, clearing means removing the site override entirely
    await clearSiteOverride(currentPlatform);
    // Switch back to global mode since there's no more override
    siteScope = false;
    updateScopeUI();
    // Re-load global settings into the form
    const globalSettings = await loadSettings();
    populateForm(globalSettings);
    updatePresetIndicator(globalSettings);
  } else {
    // Global mode: reset to defaults
    if (typeof chrome !== 'undefined') {
      await chrome.storage.sync.set({ ...defaults, activePreset: null });
    }
    updatePresetIndicator(defaults);
  }

  updatePreview();
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

function updatePresetIndicator(settings: Partial<StorageSettings>): void {
  const presetSelect = document.getElementById('preset-select') as HTMLSelectElement | null;
  if (!presetSelect) return;
  // Fill missing keys with 'auto' for detection
  const full: StorageSettings = {
    characterEdgeStyle: 'auto',
    backgroundOpacity: 'auto',
    windowOpacity: 'auto',
    fontColor: 'auto',
    fontOpacity: 'auto',
    backgroundColor: 'auto',
    windowColor: 'auto',
    fontFamily: 'auto',
    fontSize: 'auto',
    ...settings,
  };
  const detected = detectActivePreset(full, __DEV__);
  presetSelect.value = detected ?? 'custom';
}

function buildPresetSelector(): void {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-group preset-group';

  const label = document.createElement('label');
  label.setAttribute('for', 'preset-select');
  label.textContent = 'Preset';

  const select = document.createElement('select');
  select.id = 'preset-select';
  select.className = 'preset-select';

  // "Custom" option (shown when no preset matches)
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Custom';
  select.appendChild(customOpt);

  const presets = getAvailablePresets(__DEV__);
  let addedDevSeparator = false;

  for (const preset of presets) {
    if (preset.devOnly && !addedDevSeparator) {
      const sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Dev Presets ──';
      select.appendChild(sep);
      addedDevSeparator = true;
    }
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.isRecommended ? `★ ${preset.name}` : preset.name;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    void handlePresetChange(select.value);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);

  // Insert before the first .form-group in the form
  const firstGroup = form.querySelector('.form-group');
  if (firstGroup) {
    form.insertBefore(wrapper, firstGroup);
  } else {
    form.prepend(wrapper);
  }
}

async function handlePresetChange(presetId: string): Promise<void> {
  if (presetId === 'custom') return;

  const preset = getPresetById(presetId);
  if (!preset) return;

  try {
    if (siteScope && currentPlatform) {
      // Per-site mode: store preset in site override
      await saveSiteOverride(currentPlatform, preset.settings, preset.id);
    } else {
      // Global mode: save as before
      await applyPreset(preset.settings, preset.id);
    }

    populateForm(preset.settings);
    updatePreview();
    showMessage(`Applied "${preset.name}"`, 'success');

    // Notify content scripts
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) {
        await chrome.tabs
          .sendMessage(tab.id, {
            type: 'subtitleStylerPopupUpdate',
            settings: preset.settings,
          })
          .catch(() => {
            /* Tab may not have content script */
          });
      }
    } catch {
      // ignore
    }
  } catch (error) {
    console.error('Failed to apply preset:', error);
    showMessage('Failed to apply preset', 'error');
  }
}

/**
 * Detect the platform of the active tab from its URL.
 */
async function detectActiveTabPlatform(): Promise<Platform | null> {
  if (typeof chrome === 'undefined') return null;
  try {
    const tabs = chrome.tabs as typeof chrome.tabs | undefined;
    if (!tabs) return null;
    const [tab] = await tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('youtube.com')) return 'youtube';
    if (hostname.includes('nebula.tv')) return 'nebula';
    if (hostname.includes('vhx.tv') || hostname.includes('dropout.tv')) return 'dropout';
  } catch {
    // ignore — might not have tabs permission
  }
  return null;
}

/**
 * Build the scope toggle UI that lets users switch between global and per-site settings.
 */
function buildScopeToggle(): void {
  const form = document.getElementById('settings-form');
  if (!form || !currentPlatform) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-group scope-group';
  wrapper.id = 'scope-toggle-group';

  const label = document.createElement('label');
  label.textContent = 'Apply to';

  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'scope-toggle';

  const globalBtn = document.createElement('button');
  globalBtn.type = 'button';
  globalBtn.id = 'scope-global';
  globalBtn.className = 'scope-btn' + (siteScope ? '' : ' active');
  globalBtn.textContent = 'All Sites';

  const siteBtn = document.createElement('button');
  siteBtn.type = 'button';
  siteBtn.id = 'scope-site';
  siteBtn.className = 'scope-btn' + (siteScope ? ' active' : '');
  siteBtn.textContent = PLATFORM_DISPLAY_NAMES[currentPlatform];

  globalBtn.addEventListener('click', () => {
    if (!siteScope) return;
    siteScope = false;
    void switchScope();
  });

  siteBtn.addEventListener('click', () => {
    if (siteScope) return;
    siteScope = true;
    void switchScope();
  });

  toggleContainer.appendChild(globalBtn);
  toggleContainer.appendChild(siteBtn);

  wrapper.appendChild(label);
  wrapper.appendChild(toggleContainer);

  // Insert before preset selector or first form-group
  const presetGroup = form.querySelector('.preset-group');
  const target = presetGroup ?? form.querySelector('.form-group');
  if (target) {
    form.insertBefore(wrapper, target);
  } else {
    form.prepend(wrapper);
  }
}

/**
 * Update the scope toggle button classes.
 */
function updateScopeUI(): void {
  const globalBtn = document.getElementById('scope-global');
  const siteBtn = document.getElementById('scope-site');
  if (globalBtn) globalBtn.className = 'scope-btn' + (siteScope ? '' : ' active');
  if (siteBtn) siteBtn.className = 'scope-btn' + (siteScope ? ' active' : '');
}

/**
 * Switch between global and per-site mode: reload settings for the new scope.
 */
async function switchScope(): Promise<void> {
  updateScopeUI();

  if (siteScope && currentPlatform) {
    // Load per-site override, or fall back to global
    const override = await loadSiteOverride(currentPlatform);
    if (override) {
      populateForm(override.settings);
      updatePresetIndicator(override.settings);
    } else {
      // No per-site override yet — start with a copy of global settings
      const globalSettings = await loadSettings();
      populateForm(globalSettings);
      updatePresetIndicator(globalSettings);
    }
  } else {
    // Global mode: load global settings
    const globalSettings = await loadSettings();
    populateForm(globalSettings);
    updatePresetIndicator(globalSettings);
  }

  updatePreview();
}

async function initializePopup(): Promise<void> {
  try {
    // Detect current platform from the active tab
    currentPlatform = await detectActiveTabPlatform();

    // Determine initial settings: check for per-site override first
    let settings: StorageSettings;
    if (currentPlatform) {
      const override = await loadSiteOverride(currentPlatform);
      if (override) {
        siteScope = true;
        settings = override.settings;
      } else {
        siteScope = false;
        settings = await loadSettings();
      }
    } else {
      siteScope = false;
      settings = await loadSettings();
    }

    buildPresetSelector();
    if (currentPlatform) {
      buildScopeToggle();
    }
    populateForm(settings);
    updatePresetIndicator(settings);

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
