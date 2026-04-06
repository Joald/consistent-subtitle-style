// Inject the Chrome API mock only in development builds.
// esbuild replaces __DEV__ with a boolean literal at compile time, so this
// import is completely eliminated from the production bundle.
if (__DEV__) void import('./mock-chrome.js');
import type { StorageSettings } from '../types/index.js';
import { loadSettings, applyPreset, DEFAULTS } from '../storage.js';
import { debug } from '../debug.js';
import { generateCombinedCssRules } from '../css-mappings.js';
import { getAvailablePresets, getPresetById, detectActivePreset } from '../presets.js';
import {
  loadSiteOverride,
  saveSiteOverride,
  loadAllSiteOverrides,
  clearSiteOverride,
} from '../site-settings.js';
import { loadCustomPresets, saveCustomPreset, deleteCustomPreset } from '../custom-presets.js';
import { getPlatformDoc } from '../platform-docs.js';
import { platformIconHtml } from '../platform-icons.js';
import type { CustomPreset } from '../custom-presets.js';
import type { SiteSettingsMap } from '../site-settings.js';
import type { Platform } from '../platforms/index.js';

/** Detected platform for the active tab (null when on a non-supported site). */
let currentPlatform: Platform | null = null;
/** Whether we're in per-site mode (true) or global mode (false). */
let siteScope = false;
/**
 * Per-setting scope: tracks whether each setting saves to 'global' or 'site'.
 * Keys are data-id strings from ID_TO_SETTING_KEY.
 * When all are 'global', there's no per-site override. When any are 'site',
 * a per-site override is maintained for just those settings.
 */
let settingScopes: Record<string, 'global' | 'site'> = {};
/** Global settings, cached on init for comparing against per-site overrides. */
let globalSettings: StorageSettings | null = null;
/** All per-site overrides, loaded once at init for indicator icons. */
let allSiteOverrides: SiteSettingsMap = {};
/** User-created custom presets, loaded once at init. */
let customPresets: CustomPreset[] = [];

const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  youtube: 'YouTube',
  nebula: 'Nebula',
  dropout: 'Dropout',
  primevideo: 'Prime Video',
  max: 'Max',
  crunchyroll: 'Crunchyroll',
  disneyplus: 'Disney+',
  netflix: 'Netflix',
  vimeo: 'Vimeo',
};

const PLATFORM_SHORT_NAMES: Record<Platform, string> = {
  youtube: 'YT',
  nebula: 'NB',
  dropout: 'DO',
  primevideo: 'PV',
  max: 'MX',
  crunchyroll: 'CR',
  disneyplus: 'D+',
  netflix: 'NF',
  vimeo: 'VM',
};

/** Inline SVG globe icon for "All Sites" scope. */
function globeIconHtml(size = 14): string {
  return `<span class="scope-icon scope-icon-globe" style="width:${String(size)}px;height:${String(size)}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${String(size)}" height="${String(size)}"><circle cx="8" cy="8" r="7" fill="none" stroke="#888" stroke-width="1.5"/><ellipse cx="8" cy="8" rx="3.5" ry="7" fill="none" stroke="#888" stroke-width="1.2"/><line x1="1" y1="8" x2="15" y2="8" stroke="#888" stroke-width="1.2"/></svg></span>`;
}

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
  updateOverrideBadges();
  updateSiteIndicators();
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

/**
 * Update override badges on dropdown triggers.
 * When a per-site override is active and the current setting differs from the
 * global value, we show a small dot badge on the trigger so users can see at a
 * glance which settings are overridden for this site.
 */
function updateOverrideBadges(): void {
  Object.entries(ID_TO_SETTING_KEY).forEach(([id, settingKey]) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (!(el instanceof HTMLElement)) return;

    const trigger = el.querySelector('.select-trigger');
    if (!trigger) return;

    // Remove existing badge if any
    const existing = trigger.querySelector('.override-badge');
    existing?.remove();

    // Only show badges when we have both global settings and a per-site override
    if (!globalSettings || !currentPlatform) return;

    const currentValue = el.dataset['selectedValue'] ?? 'auto';
    const globalValue = globalSettings[settingKey] as string;

    if (currentValue !== globalValue) {
      const badge = document.createElement('span');
      badge.className = 'override-badge';
      badge.title = `Per-site override (global: ${globalValue})`;
      // Insert before the arrow
      const arrow = trigger.querySelector('.select-arrow');
      if (arrow) {
        trigger.insertBefore(badge, arrow);
      } else {
        trigger.appendChild(badge);
      }
    }
  });
}

/**
 * Update per-site indicator icons inside dropdown options.
 * For each option in each dropdown, show small platform abbreviation badges
 * for platforms that have a per-site override using that value (when it
 * differs from the global value). Excludes the currently active platform
 * since the user already knows they're on it.
 */
function updateSiteIndicators(): void {
  if (!globalSettings) return;

  const platforms = Object.keys(PLATFORM_SHORT_NAMES) as Platform[];

  Object.entries(ID_TO_SETTING_KEY).forEach(([id, settingKey]) => {
    const container = document.querySelector(`[data-id="${id}"]`);
    if (!container) return;

    const options = container.querySelectorAll('.select-option');
    options.forEach((opt) => {
      if (!(opt instanceof HTMLElement)) return;
      const optionValue = opt.dataset['value'] ?? 'auto';

      // Remove existing indicators
      opt.querySelectorAll('.site-indicator').forEach((el) => {
        el.remove();
      });

      // Find platforms that use this value as a per-site override (different from global)
      const matchingPlatforms: Platform[] = [];
      for (const platform of platforms) {
        // Skip the current platform — already shown in scope toggle
        if (platform === currentPlatform) continue;

        const override = allSiteOverrides[platform];
        if (!override) continue;

        const overrideValue = override.settings[settingKey] as string;
        const globalValue = (globalSettings ?? ({} as StorageSettings))[settingKey] as string;

        // Only show if the override differs from global AND matches this option value
        if (overrideValue !== globalValue && overrideValue === optionValue) {
          matchingPlatforms.push(platform);
        }
      }

      if (matchingPlatforms.length > 0) {
        const indicatorContainer = document.createElement('span');
        indicatorContainer.className = 'site-indicator-group';

        for (const platform of matchingPlatforms) {
          const badge = document.createElement('span');
          badge.className = 'site-indicator';
          badge.innerHTML = platformIconHtml(platform, 12);
          badge.title = `${PLATFORM_DISPLAY_NAMES[platform]} uses this setting`;
          badge.dataset['platform'] = platform;
          indicatorContainer.appendChild(badge);
        }

        opt.appendChild(indicatorContainer);
      }
    });
  });
}

/**
 * Determine initial per-setting scopes based on per-site override data.
 * A setting is 'site'-scoped if the current platform has a per-site override
 * whose value for that setting differs from the global value.
 */
function initSettingScopes(): void {
  settingScopes = {};
  for (const id of Object.keys(ID_TO_SETTING_KEY)) {
    settingScopes[id] = 'global';
  }

  if (!currentPlatform || !globalSettings) return;

  const override = allSiteOverrides[currentPlatform];
  if (!override) return;

  for (const [id, settingKey] of Object.entries(ID_TO_SETTING_KEY)) {
    const overrideValue = override.settings[settingKey] as string;
    const globalValue = globalSettings[settingKey] as string;
    if (overrideValue !== globalValue) {
      settingScopes[id] = 'site';
    }
  }

  // Update the legacy siteScope flag for backward compat
  siteScope = Object.values(settingScopes).some((s) => s === 'site');
}

/**
 * Build scope chip buttons for each setting row.
 * Each chip shows a globe (global) or platform icon (per-site).
 * Only built when on a supported platform.
 */
function buildScopeChips(): void {
  if (!currentPlatform) return;

  const allSelects = document.querySelectorAll('.custom-select');
  allSelects.forEach((selectEl) => {
    if (!(selectEl instanceof HTMLElement)) return;
    const id = selectEl.dataset['id'];
    if (!id || !(id in ID_TO_SETTING_KEY)) return;

    // Don't add duplicate chips
    const existing = selectEl.parentElement?.querySelector('.scope-chip');
    if (existing) return;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'scope-chip';
    chip.dataset['settingId'] = id;

    const scope = settingScopes[id] ?? 'global';
    updateScopeChipContent(chip, scope);

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingScope(id);
    });

    // Insert the chip after the custom-select in the form-group
    selectEl.parentElement?.appendChild(chip);
  });
}

/**
 * Update the visual content of a scope chip.
 */
function updateScopeChipContent(chip: HTMLElement, scope: 'global' | 'site'): void {
  if (scope === 'site' && currentPlatform) {
    chip.innerHTML = platformIconHtml(currentPlatform, 14);
    chip.title = `Saving to ${PLATFORM_DISPLAY_NAMES[currentPlatform]} only`;
    chip.classList.add('scope-site');
    chip.classList.remove('scope-global');
  } else {
    chip.innerHTML = globeIconHtml(14);
    chip.title = 'Saving to All Sites';
    chip.classList.add('scope-global');
    chip.classList.remove('scope-site');
  }
}

/**
 * Toggle a setting's scope between 'global' and 'site'.
 */
function toggleSettingScope(settingId: string): void {
  if (!currentPlatform) return;

  const current = settingScopes[settingId] ?? 'global';
  const next = current === 'global' ? 'site' : 'global';
  settingScopes[settingId] = next;

  // Update the legacy siteScope flag
  siteScope = Object.values(settingScopes).some((s) => s === 'site');

  // Update the chip visual
  const chip = document.querySelector(`.scope-chip[data-setting-id="${settingId}"]`);
  if (chip instanceof HTMLElement) {
    updateScopeChipContent(chip, next);
  }

  // Auto-save when scope changes
  void handleSave();
}

/**
 * Refresh all scope chip visuals to match current settingScopes state.
 */
function updateScopeChips(): void {
  if (!currentPlatform) return;

  for (const id of Object.keys(ID_TO_SETTING_KEY)) {
    const chip = document.querySelector(`.scope-chip[data-setting-id="${id}"]`);
    if (chip instanceof HTMLElement) {
      updateScopeChipContent(chip, settingScopes[id] ?? 'global');
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
    const hasSiteScoped = currentPlatform && Object.values(settingScopes).some((s) => s === 'site');

    // Always save global-scoped settings to global storage.
    // Build a global settings object using form values for global-scoped settings,
    // preserving existing global values for site-scoped settings.
    const globalUpdate: Record<string, string> = {};
    for (const [id, settingKey] of Object.entries(ID_TO_SETTING_KEY)) {
      if (settingScopes[id] !== 'site') {
        globalUpdate[settingKey] = fullSettings[settingKey] as string;
      }
    }

    if (Object.keys(globalUpdate).length > 0 && typeof chrome !== 'undefined') {
      await chrome.storage.sync.set({ ...globalUpdate, activePreset: null });
    }
    // Update local cache — merge global updates into existing global settings
    globalSettings = { ...(globalSettings ?? DEFAULTS), ...globalUpdate } as StorageSettings;

    if (hasSiteScoped && currentPlatform) {
      // Build per-site override: use form values for site-scoped settings,
      // global values for global-scoped settings.
      const siteSettings: StorageSettings = { ...DEFAULTS };
      for (const [id, settingKey] of Object.entries(ID_TO_SETTING_KEY)) {
        if (settingScopes[id] === 'site') {
          (siteSettings as unknown as Record<string, string>)[settingKey] = fullSettings[
            settingKey
          ] as string;
        } else {
          (siteSettings as unknown as Record<string, string>)[settingKey] = globalSettings[
            settingKey
          ] as string;
        }
      }
      await saveSiteOverride(currentPlatform, siteSettings, null);
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: siteSettings, activePreset: null },
      };
    } else if (currentPlatform && allSiteOverrides[currentPlatform]) {
      // No site-scoped settings remain — clear the per-site override
      await clearSiteOverride(currentPlatform);
      const { [currentPlatform]: _, ...rest } = allSiteOverrides;
      void _;
      allSiteOverrides = rest;
    }

    updatePresetIndicator(settings);
    updateOverrideBadges();
    updateSiteIndicators();
    updateScopeChips();
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

      closeAllSelects();

      if (!isOpen) {
        openSelect(container);
      }
    });

    // Keyboard navigation on trigger
    trigger?.addEventListener('keydown', (e) => {
      const event = e as KeyboardEvent;
      const isOpen = container.classList.contains('open');

      switch (event.key) {
        case 'Enter':
        case ' ': {
          event.preventDefault();
          if (isOpen) {
            // Select the highlighted option, or close if none highlighted
            const highlighted = container.querySelector('.select-option.highlighted');
            if (highlighted instanceof HTMLElement) {
              selectOption(container, highlighted);
            }
            closeSelect(container);
          } else {
            closeAllSelects();
            openSelect(container);
          }
          break;
        }
        case 'Escape': {
          if (isOpen) {
            event.preventDefault();
            closeSelect(container);
            (trigger as HTMLElement).focus();
          }
          break;
        }
        case 'ArrowDown': {
          event.preventDefault();
          if (!isOpen) {
            closeAllSelects();
            openSelect(container);
          }
          highlightNext(container, 1);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          if (!isOpen) {
            closeAllSelects();
            openSelect(container);
          }
          highlightNext(container, -1);
          break;
        }
        case 'Tab': {
          if (isOpen) {
            closeSelect(container);
          }
          break;
        }
      }
    });

    options.forEach((option) => {
      if (!(option instanceof HTMLElement)) return;
      const el = option;
      el.addEventListener('click', () => {
        selectOption(container, el);
        container.classList.remove('open');
        updateAriaExpanded(container, false);
      });
    });
  });

  document.addEventListener('click', () => {
    closeAllSelects();
  });
}

/** Open a custom select dropdown. */
function openSelect(container: HTMLElement): void {
  container.classList.add('open');
  updateAriaExpanded(container, true);
  // Highlight the currently selected option
  const selected = container.querySelector('.select-option.selected');
  clearHighlight(container);
  if (selected instanceof HTMLElement) {
    selected.classList.add('highlighted');
    scrollOptionIntoView(selected);
  }
}

/** Close a single custom select dropdown. */
function closeSelect(container: HTMLElement): void {
  container.classList.remove('open');
  clearHighlight(container);
  updateAriaExpanded(container, false);
}

/** Close all open custom selects. */
function closeAllSelects(): void {
  document.querySelectorAll('.custom-select.open').forEach((open) => {
    if (open instanceof HTMLElement) {
      closeSelect(open);
    }
  });
}

/** Clear highlight from all options in a container. */
function clearHighlight(container: HTMLElement): void {
  container.querySelectorAll('.select-option.highlighted').forEach((el) => {
    el.classList.remove('highlighted');
  });
}

/** Move highlight by a direction (+1 = down, -1 = up). */
function highlightNext(container: HTMLElement, direction: 1 | -1): void {
  const options = Array.from(container.querySelectorAll<HTMLElement>('.select-option'));
  if (options.length === 0) return;

  const currentIndex = options.findIndex((opt) => opt.classList.contains('highlighted'));
  clearHighlight(container);

  let nextIndex: number;
  if (currentIndex === -1) {
    // No highlight yet — start from top (down) or bottom (up)
    nextIndex = direction === 1 ? 0 : options.length - 1;
  } else {
    nextIndex = currentIndex + direction;
    // Clamp to bounds
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= options.length) nextIndex = options.length - 1;
  }

  const target = options[nextIndex];
  if (target) {
    target.classList.add('highlighted');
    scrollOptionIntoView(target);
  }
}

/** Scroll an option into view within the options container. */
function scrollOptionIntoView(option: HTMLElement): void {
  const container = option.closest('.select-options');
  if (container instanceof HTMLElement) {
    const containerRect = container.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.bottom > containerRect.bottom) {
      container.scrollTop += optionRect.bottom - containerRect.bottom;
    } else if (optionRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - optionRect.top;
    }
  }
}

/** Select a specific option in a custom select. */
function selectOption(container: HTMLElement, option: HTMLElement): void {
  const value = option.dataset['value'] ?? 'auto';
  const text = option.textContent.trim();

  container.querySelectorAll('.select-option').forEach((opt) => {
    opt.classList.remove('selected');
  });
  option.classList.add('selected');

  container.dataset['selectedValue'] = value;

  const valueEl = container.querySelector('.select-value');
  if (valueEl) valueEl.textContent = text;

  container.classList.remove('open');
  clearHighlight(container);
  updateAriaExpanded(container, false);

  updatePreview();
  updateOpacityStates();
  updateOverrideBadges();
  updateSiteIndicators();
  void handleSave();
}

/** Update aria-expanded attribute on the trigger element. */
function updateAriaExpanded(container: HTMLElement, expanded: boolean): void {
  const trigger = container.querySelector('.select-trigger');
  if (trigger) {
    trigger.setAttribute('aria-expanded', String(expanded));
  }
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
  const detected = detectActivePreset(full, __DEV__, customPresets);
  presetSelect.value = detected ?? 'custom';

  // Show delete button only when a custom preset is active
  const isCustom = customPresets.some((cp) => cp.id === detected);
  updateDeleteButton(isCustom);
}

function buildPresetSelector(): void {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-group preset-group';

  const label = document.createElement('label');
  label.setAttribute('for', 'preset-select');
  label.textContent = 'Preset';

  const selectRow = document.createElement('div');
  selectRow.className = 'preset-row';

  const select = document.createElement('select');
  select.id = 'preset-select';
  select.className = 'preset-select';

  populatePresetOptions(select);

  select.addEventListener('change', () => {
    void handlePresetChange(select.value);
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.id = 'save-preset-btn';
  saveBtn.className = 'save-preset-btn';
  saveBtn.textContent = '💾';
  saveBtn.title = 'Save as Preset';
  saveBtn.addEventListener('click', () => {
    void handleSaveAsPreset();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.id = 'delete-preset-btn';
  deleteBtn.className = 'delete-preset-btn';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete Custom Preset';
  deleteBtn.style.display = 'none';
  deleteBtn.addEventListener('click', () => {
    const currentId = select.value;
    if (currentId && currentId !== 'custom') {
      void handleDeleteCustomPreset(currentId);
    }
  });

  selectRow.appendChild(select);
  selectRow.appendChild(saveBtn);
  selectRow.appendChild(deleteBtn);
  wrapper.appendChild(label);
  wrapper.appendChild(selectRow);

  // Insert before the first .form-group in the form
  const firstGroup = form.querySelector('.form-group');
  if (firstGroup) {
    form.insertBefore(wrapper, firstGroup);
  } else {
    form.prepend(wrapper);
  }
}

/**
 * Populate preset <select> options from built-in + custom presets.
 */
function populatePresetOptions(select: HTMLSelectElement): void {
  // Clear existing options
  select.innerHTML = '';

  // "Custom" option (shown when no preset matches)
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Custom';
  select.appendChild(customOpt);

  const presets = getAvailablePresets(__DEV__, customPresets);
  let addedDevSeparator = false;
  let addedCustomSeparator = false;

  for (const preset of presets) {
    if (preset.isCustom && !addedCustomSeparator) {
      const sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── My Presets ──';
      select.appendChild(sep);
      addedCustomSeparator = true;
    }
    if (preset.devOnly && !addedDevSeparator) {
      const sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Dev Presets ──';
      select.appendChild(sep);
      addedDevSeparator = true;
    }
    const opt = document.createElement('option');
    opt.value = preset.id;
    if (preset.isRecommended) {
      opt.textContent = `★ ${preset.name}`;
    } else if (preset.isCustom) {
      opt.textContent = preset.name;
    } else {
      opt.textContent = preset.name;
    }
    select.appendChild(opt);
  }
}

/**
 * Refresh the preset dropdown options (after adding/deleting a custom preset).
 */
function refreshPresetDropdown(): void {
  const select = document.getElementById('preset-select') as HTMLSelectElement | null;
  if (!select) return;
  const currentValue = select.value;
  populatePresetOptions(select);
  // Try to restore previous selection
  const optionExists = Array.from(select.options).some((o) => o.value === currentValue);
  select.value = optionExists ? currentValue : 'custom';
}

/**
 * Handle "Save as Preset" button click.
 * Shows a simple prompt for the preset name.
 */
async function handleSaveAsPreset(): Promise<void> {
  const name = prompt('Preset name:');
  if (!name?.trim()) return;

  try {
    const currentSettings = collectSettings();
    const fullSettings: StorageSettings = { ...DEFAULTS, ...currentSettings };

    const newPreset = await saveCustomPreset(name.trim(), fullSettings);
    customPresets = await loadCustomPresets();

    refreshPresetDropdown();

    // Set the dropdown to the new preset
    const select = document.getElementById('preset-select') as HTMLSelectElement | null;
    if (select) select.value = newPreset.id;

    // Also persist the active preset id
    // When a preset is applied, set all settings to site scope if we're on a supported platform
    // and any settings were already site-scoped; otherwise save globally.
    if (siteScope && currentPlatform) {
      // Mark all settings as site-scoped since preset applies as a whole
      for (const id of Object.keys(ID_TO_SETTING_KEY)) {
        settingScopes[id] = 'site';
      }
      await saveSiteOverride(currentPlatform, fullSettings, newPreset.id);
      // Update local cache so badge comparisons use fresh data
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: fullSettings, activePreset: newPreset.id },
      };
    } else {
      await applyPreset(fullSettings, newPreset.id);
      // Update local cache so badge comparisons use fresh data
      globalSettings = fullSettings;
    }

    updateOverrideBadges();
    updateSiteIndicators();
    showMessage(`Saved "${name.trim()}"`, 'success');
  } catch (error) {
    console.error('Failed to save custom preset:', error);
    showMessage('Failed to save preset', 'error');
  }
}

async function handlePresetChange(presetId: string): Promise<void> {
  if (presetId === 'custom') {
    updateDeleteButton(false);
    return;
  }

  const preset = getPresetById(presetId, customPresets);
  if (!preset) return;

  try {
    if (siteScope && currentPlatform) {
      // Per-site mode: store preset in site override and mark all settings as site-scoped
      for (const id of Object.keys(ID_TO_SETTING_KEY)) {
        settingScopes[id] = 'site';
      }
      await saveSiteOverride(currentPlatform, preset.settings, preset.id);
      // Update local cache so badge comparisons use fresh data
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: preset.settings, activePreset: preset.id },
      };
    } else {
      // Global mode: save as before
      await applyPreset(preset.settings, preset.id);
      // Update local cache so badge comparisons use fresh data
      globalSettings = { ...DEFAULTS, ...preset.settings };
    }

    populateForm(preset.settings);
    updatePreview();
    updateScopeChips();
    updateDeleteButton(!!preset.isCustom);
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
 * Show or hide the delete button based on whether a custom preset is selected.
 */
function updateDeleteButton(show: boolean): void {
  const btn = document.getElementById('delete-preset-btn');
  if (btn) btn.style.display = show ? '' : 'none';
}

/**
 * Handle deletion of a custom preset.
 */
async function handleDeleteCustomPreset(presetId: string): Promise<void> {
  try {
    await deleteCustomPreset(presetId);
    customPresets = await loadCustomPresets();
    refreshPresetDropdown();

    // Update indicator based on current settings
    const currentSettings = collectSettings();
    updatePresetIndicator(currentSettings);

    showMessage('Preset deleted', 'success');
  } catch (error) {
    console.error('Failed to delete custom preset:', error);
    showMessage('Failed to delete preset', 'error');
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
    if (
      hostname.includes('primevideo.com') ||
      (hostname.includes('amazon.') && url.pathname.startsWith('/gp/video'))
    )
      return 'primevideo';
    if (hostname === 'max.com' || hostname.endsWith('.max.com') || hostname.includes('hbomax.com'))
      return 'max';
    if (hostname.includes('crunchyroll.com')) return 'crunchyroll';
    if (hostname.includes('disneyplus.com')) return 'disneyplus';
    if (hostname.includes('netflix.com')) return 'netflix';
    if (hostname.includes('vimeo.com')) return 'vimeo';
  } catch {
    // ignore — might not have tabs permission
  }
  return null;
}

/**
 * Build the platform support indicator banner.
 * Shows "✅ <Platform> supported" on supported sites, or
 * "⚠️ This site is not supported" on unsupported sites.
 */
function buildPlatformIndicator(): void {
  const indicator = document.getElementById('platform-indicator');
  if (!indicator) return;

  indicator.innerHTML = '';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'platform-indicator-icon';

  const textSpan = document.createElement('span');
  textSpan.className = 'platform-indicator-text';

  if (currentPlatform) {
    indicator.className = 'platform-indicator supported';
    iconSpan.innerHTML = platformIconHtml(currentPlatform, 18);
    textSpan.textContent = `${PLATFORM_DISPLAY_NAMES[currentPlatform]} — supported`;

    // Add info button for supported platforms
    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.id = 'platform-info-btn';
    infoBtn.className = 'platform-indicator-info';
    infoBtn.textContent = 'i';
    infoBtn.title = 'Platform details';
    infoBtn.setAttribute('aria-label', `${PLATFORM_DISPLAY_NAMES[currentPlatform]} details`);
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDocsPanel();
    });

    indicator.appendChild(iconSpan);
    indicator.appendChild(textSpan);
    indicator.appendChild(infoBtn);
  } else {
    indicator.className = 'platform-indicator unsupported';
    iconSpan.textContent = '⚠️';
    textSpan.textContent = 'This site is not supported';

    indicator.appendChild(iconSpan);
    indicator.appendChild(textSpan);
  }
}

/**
 * Toggle the docs panel visibility, populating content if needed.
 */
function toggleDocsPanel(): void {
  const panel = document.getElementById('docs-panel');
  if (!panel) return;

  if (panel.classList.contains('hidden')) {
    populateDocsPanel();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

/**
 * Populate the docs panel with data for the current platform.
 */
function populateDocsPanel(): void {
  if (!currentPlatform) return;

  const doc = getPlatformDoc(currentPlatform);
  if (!doc) return;

  const title = document.querySelector('.docs-panel-title');
  if (title) title.textContent = `${doc.name} — How it works`;

  const approach = document.getElementById('docs-approach');
  if (approach) approach.textContent = doc.approach;

  const supported = document.getElementById('docs-supported');
  if (supported) {
    supported.innerHTML = '';
    for (const feature of doc.supported) {
      const li = document.createElement('li');
      li.textContent = feature;
      supported.appendChild(li);
    }
  }

  const limitations = document.getElementById('docs-limitations');
  if (limitations) {
    limitations.innerHTML = '';
    for (const limitation of doc.limitations) {
      const li = document.createElement('li');
      li.textContent = limitation;
      limitations.appendChild(li);
    }
  }

  const notesSection = document.getElementById('docs-notes-section');
  const notesEl = document.getElementById('docs-notes');
  if (notesSection && notesEl) {
    if (doc.notes) {
      notesSection.classList.remove('hidden');
      notesEl.textContent = doc.notes;
    } else {
      notesSection.classList.add('hidden');
    }
  }

  // Wire up close button
  const closeBtn = document.getElementById('docs-close-btn');
  if (closeBtn) {
    // Remove old listener by cloning
    const newClose = closeBtn.cloneNode(true) as HTMLElement;
    closeBtn.parentNode?.replaceChild(newClose, closeBtn);
    newClose.addEventListener('click', () => {
      const panel = document.getElementById('docs-panel');
      panel?.classList.add('hidden');
    });
  }
}

async function initializePopup(): Promise<void> {
  try {
    // Detect current platform from the active tab
    currentPlatform = await detectActiveTabPlatform();

    // Always load global settings (needed for override badge comparison)
    globalSettings = await loadSettings();

    // Load all site overrides for indicator icons in dropdown options
    allSiteOverrides = await loadAllSiteOverrides();

    // Load custom presets
    customPresets = await loadCustomPresets();

    // Determine initial settings: check for per-site override first
    let settings: StorageSettings;
    if (currentPlatform) {
      const override = await loadSiteOverride(currentPlatform);
      if (override) {
        siteScope = true;
        settings = override.settings;
      } else {
        siteScope = false;
        settings = globalSettings;
      }
    } else {
      siteScope = false;
      settings = globalSettings;
    }

    buildPlatformIndicator();
    buildPresetSelector();
    populateForm(settings);
    updatePresetIndicator(settings);

    setupCustomSelects();

    // Initialize per-setting scopes and build scope chips (after form is populated)
    initSettingScopes();
    buildScopeChips();
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showMessage('Failed to initialize popup', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initializePopup();
});
