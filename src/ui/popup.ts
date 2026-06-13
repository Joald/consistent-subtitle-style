// Inject the Chrome API mock only in development builds.
// esbuild replaces __DEV__ with a boolean literal at compile time, so this
// import is completely eliminated from the production bundle.
if (__DEV__) void import('./mock-chrome.js');
import type { StorageSettings, SiteSettings, SiteValue } from '../types/index.js';
import { loadSettings, applyPreset, DEFAULTS } from '../storage.js';
import { debug } from '../debug.js';
import { generateCombinedCssRules } from '../css-mappings.js';
import { getAvailablePresets, getPresetById, detectActivePreset } from '../presets.js';
import {
  loadSiteOverride,
  saveSiteOverride,
  loadAllSiteOverrides,
  clearSiteOverride,
  toSiteSettings,
  flattenSiteSettings,
} from '../site-settings.js';
import { loadCustomPresets, saveCustomPreset, deleteCustomPreset } from '../custom-presets.js';
import { getPlatformDoc } from '../platform-docs.js';
import { platformIconHtml } from '../platform-icons.js';
import { validatePresetJson } from '../settings-io.js';
import type { CustomPreset } from '../custom-presets.js';
import type { SiteSettingsMap, SiteOverride } from '../site-settings.js';
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
  updateGlobalIndicators();
  updatePreview();
}

/**
 * Platforms where font opacity only works when a custom font color is set.
 * These use CSS color-mix() injection — when fontColor is "auto", no color rule
 * is emitted, so the opacity percentage has no effect.
 * YouTube and Dropout have native/DOM-based opacity handling that works independently.
 */
const OPACITY_NEEDS_CUSTOM_COLOR: ReadonlySet<string> = new Set([
  'nebula', 'crunchyroll', 'disneyplus', 'max', 'netflix', 'primevideo', 'vimeo',
]);

function updateOpacityStates(): void {
  const colorEl = document.querySelector('[data-id="font-color"]');
  const opacityEl = document.querySelector('[data-id="font-opacity"]');
  const helpEl = document.getElementById('font-opacity-help');

  if (colorEl instanceof HTMLElement && opacityEl instanceof HTMLElement) {
    const colorValue = colorEl.dataset['selectedValue'] ?? 'auto';
    const opacityValue = opacityEl.dataset['selectedValue'] ?? 'auto';

    if (
      colorValue === 'auto' &&
      opacityValue !== 'auto' &&
      currentPlatform &&
      OPACITY_NEEDS_CUSTOM_COLOR.has(currentPlatform)
    ) {
      helpEl?.classList.remove('hidden');
    } else {
      helpEl?.classList.add('hidden');
    }
  }
}

/**
 * Update override badges on dropdown triggers.
 * When a per-site override is active and the setting is enabled per-site,
 * we show a small dot badge on the trigger so users can see at a
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

    const override = allSiteOverrides[currentPlatform];
    if (!override) return;

    const entry = override.settings[settingKey] as SiteValue<string> | undefined;
    if (!entry?.enabled) return;

    // Show badge when per-site value differs from global
    const globalValue = globalSettings[settingKey] as string;
    if (entry.value !== globalValue) {
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
 * for platforms that have an ENABLED per-site override using that value (when it
 * differs from the global value). Excludes the currently active platform
 * since the user already knows they're on it.
 * Platforms with that setting disabled are not shown.
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

      // Find platforms that use this value as an ENABLED per-site override (different from global)
      const matchingPlatforms: Platform[] = [];
      for (const platform of platforms) {
        // Skip the current platform — already shown in scope toggle
        if (platform === currentPlatform) continue;

        const override = allSiteOverrides[platform];
        if (!override) continue;

        const entry = override.settings[settingKey] as SiteValue<string>;
        // Only show if the setting is enabled AND differs from global AND matches this option
        if (!entry.enabled) continue;

        const globalValue = (globalSettings ?? ({} as StorageSettings))[settingKey] as string;
        if (entry.value !== globalValue && entry.value === optionValue) {
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
 * Update global value indicators inside dropdown options.
 * When on a supported platform, each dropdown option that matches
 * the global value gets a small globe icon to show "this is global".
 * Only shown when a per-site override exists (otherwise everything is global).
 */
function updateGlobalIndicators(): void {
  if (!globalSettings || !currentPlatform) return;

  Object.entries(ID_TO_SETTING_KEY).forEach(([id, settingKey]) => {
    const container = document.querySelector(`[data-id="${id}"]`);
    if (!container) return;

    const options = container.querySelectorAll('.select-option');
    const globalValue = globalSettings![settingKey] as string;

    options.forEach((opt) => {
      if (!(opt instanceof HTMLElement)) return;
      const optionValue = opt.dataset['value'] ?? 'auto';

      // Remove existing global indicators
      opt.querySelectorAll('.global-indicator').forEach((el) => {
        el.remove();
      });

      // Show globe on the option matching the global value
      if (optionValue === globalValue) {
        const indicator = document.createElement('span');
        indicator.className = 'global-indicator';
        indicator.innerHTML = globeIconHtml(12);
        indicator.title = 'Global setting';
        opt.appendChild(indicator);
      }
    });
  });
}

/**
 * Determine initial per-setting scopes based on per-site override data.
 * A setting is 'site'-scoped if the current platform has a per-site override
 * with that setting enabled.
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
    const entry = override.settings[settingKey] as SiteValue<string>;
    if (entry.enabled) {
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
 * Site → Global: shows global value in form, keeps per-site value stored.
 * Global → Site: restores per-site value from stored override.
 */
function toggleSettingScope(settingId: string): void {
  if (!currentPlatform || !globalSettings) return;

  const settingKey = ID_TO_SETTING_KEY[settingId];
  if (!settingKey) return;

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

  // Update the form value based on new scope
  const el = document.querySelector(`[data-id="${settingId}"]`);
  if (el instanceof HTMLElement) {
    if (next === 'global') {
      // Switching to global: show global value in form (don't save to global)
      setCustomSelectValue(el, globalSettings[settingKey] as string);
    } else {
      // Switching to site: restore per-site value if we have one
      const override = allSiteOverrides[currentPlatform];
      if (override) {
        const entry = override.settings[settingKey] as SiteValue<string>;
        setCustomSelectValue(el, entry.value);
      }
    }
  }

  updatePreview();
  updateOverrideBadges();
  updateSiteIndicators();
  updateGlobalIndicators();

  // Auto-save the scope change
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
    const formValues = collectSettings();
    debug.log(`Saving settings: ${JSON.stringify(formValues)}`);

    const fullFormSettings: StorageSettings = { ...DEFAULTS, ...formValues };
    const hasSiteScoped = currentPlatform && Object.values(settingScopes).some((s) => s === 'site');

    // Build the global update: only include global-scoped settings' form values.
    // NEVER write site-scoped values to global storage.
    const globalUpdate: Record<string, string> = {};
    for (const [id, settingKey] of Object.entries(ID_TO_SETTING_KEY)) {
      if (settingScopes[id] !== 'site') {
        globalUpdate[settingKey] = fullFormSettings[settingKey] as string;
      }
    }

    if (Object.keys(globalUpdate).length > 0 && typeof chrome !== 'undefined') {
      await chrome.storage.sync.set({ ...globalUpdate, activePreset: null });
    }
    // Update local cache — merge only global updates
    globalSettings = { ...(globalSettings ?? DEFAULTS), ...globalUpdate } as StorageSettings;

    if (hasSiteScoped && currentPlatform) {
      // Build SiteSettings: for each key, wrap in SiteValue with the appropriate enabled flag.
      const existingOverride = allSiteOverrides[currentPlatform];
      const siteSettings = {} as Record<string, SiteValue<string>>;

      for (const [id, settingKey] of Object.entries(ID_TO_SETTING_KEY)) {
        const isEnabled = settingScopes[id] === 'site';
        if (isEnabled) {
          // Use current form value for enabled per-site settings
          siteSettings[settingKey] = { value: fullFormSettings[settingKey] as string, enabled: true };
        } else {
          // Preserve the stored per-site value (if any), keep it disabled
          const existing = existingOverride?.settings[settingKey] as SiteValue<string> | undefined;
          siteSettings[settingKey] = {
            value: existing?.value ?? (globalSettings[settingKey] as string),
            enabled: false,
          };
        }
      }

      await saveSiteOverride(currentPlatform, siteSettings as SiteSettings, null);
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: siteSettings as SiteSettings, activePreset: null },
      };
    } else if (currentPlatform && allSiteOverrides[currentPlatform]) {
      // No site-scoped settings remain — keep override with all disabled to preserve
      // stored per-site values for toggle round-trips (site → global → site).
      const existingOverride = allSiteOverrides[currentPlatform];
      const siteSettings = {} as Record<string, SiteValue<string>>;
      for (const [, settingKey] of Object.entries(ID_TO_SETTING_KEY)) {
        const existing = existingOverride?.settings[settingKey] as SiteValue<string> | undefined;
        siteSettings[settingKey] = {
          value: existing?.value ?? (globalSettings[settingKey] as string),
          enabled: false,
        };
      }
      await saveSiteOverride(currentPlatform, siteSettings as SiteSettings, null);
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: siteSettings as SiteSettings, activePreset: null },
      };
    }

    updatePresetIndicator(formValues);
    updateOverrideBadges();
    updateSiteIndicators();
    updateGlobalIndicators();
    updateScopeChips();
    updatePreview();

    // Notify content scripts directly so live updates work even when
    // chrome.storage.onChanged doesn't fire in cross-origin iframes (e.g. Dropout).
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) {
        await chrome.tabs
          .sendMessage(tab.id, {
            type: 'subtitleStylerPopupUpdate',
            settings: formValues,
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
    // Skip the preset dropdown — it has its own listeners via setupPresetOptionListeners
    if (select.dataset['id'] === 'preset') return;
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
  updateGlobalIndicators();
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
  const presetContainer = document.getElementById('preset-select');
  if (!presetContainer) return;
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
  setCustomSelectValue(presetContainer, detected ?? 'custom');

  // Show delete button only when a custom preset is active
  const isCustom = customPresets.some((cp) => cp.id === detected);
  updateDeleteButton(isCustom);
}

function buildPresetSelector(): void {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-group preset-group';

  const selectRow = document.createElement('div');
  selectRow.className = 'preset-row';

  // Build custom-select container
  const container = document.createElement('div');
  container.className = 'custom-select';
  container.id = 'preset-select';
  container.dataset['id'] = 'preset';

  const trigger = document.createElement('div');
  trigger.className = 'select-trigger';
  trigger.tabIndex = 0;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'listbox');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'select-name';
  nameSpan.textContent = 'Preset';

  const valueSpan = document.createElement('span');
  valueSpan.className = 'select-value';
  valueSpan.textContent = 'Custom';

  const arrowSpan = document.createElement('span');
  arrowSpan.className = 'select-arrow';
  arrowSpan.textContent = '▼';

  trigger.appendChild(nameSpan);
  trigger.appendChild(valueSpan);
  trigger.appendChild(arrowSpan);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'select-options';
  optionsContainer.setAttribute('role', 'listbox');

  container.appendChild(trigger);
  container.appendChild(optionsContainer);

  populatePresetOptions(container);

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
    const currentId = getCustomSelectValue(container);
    if (currentId && currentId !== 'custom') {
      void handleDeleteCustomPreset(currentId);
    }
  });

  selectRow.appendChild(container);
  selectRow.appendChild(saveBtn);
  selectRow.appendChild(deleteBtn);
  wrapper.appendChild(selectRow);

  // Insert after the last element in the form (at the bottom)
  form.appendChild(wrapper);
}

/**
 * Build the import/export section below the preset selector.
 * Contains a text input for pasting JSON + submit arrow button,
 * and a "Copy current settings" button.
 */
function buildImportExportSection(): void {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const section = document.createElement('div');
  section.className = 'import-export-section';

  // Import row: text input + submit arrow
  const importRow = document.createElement('div');
  importRow.className = 'import-row';

  const importInput = document.createElement('input');
  importInput.type = 'text';
  importInput.id = 'import-json-input';
  importInput.className = 'import-json-input';
  importInput.placeholder = 'paste json here';

  // Submit on Enter key
  importInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handlePasteJson();
    }
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.id = 'import-json-btn';
  submitBtn.className = 'import-json-btn';
  submitBtn.textContent = '→';
  submitBtn.title = 'Import settings from JSON';
  submitBtn.addEventListener('click', () => {
    void handlePasteJson();
  });

  importRow.appendChild(importInput);
  importRow.appendChild(submitBtn);

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.id = 'copy-settings-btn';
  copyBtn.className = 'copy-settings-btn';
  copyBtn.textContent = '📋 Copy current settings to clipboard';
  copyBtn.addEventListener('click', () => {
    handleCopyJson();
  });

  section.appendChild(importRow);
  section.appendChild(copyBtn);
  form.appendChild(section);
}

/**
 * Populate preset custom-select options from built-in + custom presets.
 */
function populatePresetOptions(container: HTMLElement): void {
  const optionsContainer = container.querySelector('.select-options');
  if (!optionsContainer) return;

  // Clear existing options
  optionsContainer.innerHTML = '';

  // "Custom" option (shown when no preset matches)
  const customOpt = document.createElement('div');
  customOpt.className = 'select-option';
  customOpt.setAttribute('role', 'option');
  customOpt.dataset['value'] = 'custom';
  customOpt.textContent = 'Custom';
  optionsContainer.appendChild(customOpt);

  const presets = getAvailablePresets(__DEV__, customPresets);
  let addedDevSeparator = false;
  let addedCustomSeparator = false;

  for (const preset of presets) {
    if (preset.isCustom && !addedCustomSeparator) {
      const sep = document.createElement('div');
      sep.className = 'select-separator';
      sep.textContent = '── My Presets ──';
      optionsContainer.appendChild(sep);
      addedCustomSeparator = true;
    }
    if (preset.devOnly && !addedDevSeparator) {
      const sep = document.createElement('div');
      sep.className = 'select-separator';
      sep.textContent = '── Dev Presets ──';
      optionsContainer.appendChild(sep);
      addedDevSeparator = true;
    }
    const opt = document.createElement('div');
    opt.className = 'select-option';
    opt.setAttribute('role', 'option');
    opt.dataset['value'] = preset.id;
    if (preset.isRecommended) {
      opt.textContent = `★ ${preset.name}`;
    } else {
      opt.textContent = preset.name;
    }
    optionsContainer.appendChild(opt);
  }

  // Wire up click handlers on the new options
  setupPresetOptionListeners(container);
}

/**
 * Refresh the preset dropdown options (after adding/deleting a custom preset).
 */
/**
 * Wire up click handlers for preset custom-select options.
 * Called after populatePresetOptions rebuilds the option list.
 */
function setupPresetOptionListeners(container: HTMLElement): void {
  const trigger = container.querySelector('.select-trigger');
  const options = container.querySelectorAll('.select-option');

  // Remove and re-add trigger listener by cloning (avoids duplicates after refresh)
  if (trigger instanceof HTMLElement && !trigger.dataset['presetWired']) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains('open');
      closeAllSelects();
      if (!isOpen) {
        openSelect(container);
      }
    });

    // Keyboard navigation on trigger
    trigger.addEventListener('keydown', (e: KeyboardEvent) => {
      const isOpen = container.classList.contains('open');

      switch (e.key) {
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (isOpen) {
            const highlighted = container.querySelector('.select-option.highlighted');
            if (highlighted instanceof HTMLElement) {
              presetSelectOption(container, highlighted);
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
            e.preventDefault();
            closeSelect(container);
            trigger.focus();
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (!isOpen) {
            closeAllSelects();
            openSelect(container);
          }
          highlightNext(container, 1);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
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

    trigger.dataset['presetWired'] = '1';
  }

  options.forEach((option) => {
    if (!(option instanceof HTMLElement)) return;
    option.addEventListener('click', () => {
      presetSelectOption(container, option);
      container.classList.remove('open');
      updateAriaExpanded(container, false);
    });
  });
}

/**
 * Select a preset option in the custom-select — updates the display and triggers preset change.
 */
function presetSelectOption(container: HTMLElement, option: HTMLElement): void {
  const value = option.dataset['value'] ?? 'custom';
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

  void handlePresetChange(value);
}

function refreshPresetDropdown(): void {
  const container = document.getElementById('preset-select');
  if (!container) return;
  const currentValue = container.dataset['selectedValue'] ?? 'custom';
  populatePresetOptions(container);
  // Try to restore previous selection
  const optionExists = container.querySelector(`.select-option[data-value="${currentValue}"]`);
  setCustomSelectValue(container, optionExists ? currentValue : 'custom');
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
    const presetContainer = document.getElementById('preset-select');
    if (presetContainer) setCustomSelectValue(presetContainer, newPreset.id);

    // Also persist the active preset id
    // When a preset is applied, set all settings to site scope if we're on a supported platform
    // and any settings were already site-scoped; otherwise save globally.
    if (siteScope && currentPlatform) {
      // Mark all settings as site-scoped since preset applies as a whole
      for (const id of Object.keys(ID_TO_SETTING_KEY)) {
        settingScopes[id] = 'site';
      }
      const siteSettings = toSiteSettings(fullSettings);
      await saveSiteOverride(currentPlatform, siteSettings, newPreset.id);
      // Update local cache so badge comparisons use fresh data
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: siteSettings, activePreset: newPreset.id },
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
      const siteSettings = toSiteSettings(preset.settings);
      await saveSiteOverride(currentPlatform, siteSettings, preset.id);
      // Update local cache so badge comparisons use fresh data
      allSiteOverrides = {
        ...allSiteOverrides,
        [currentPlatform]: { settings: siteSettings, activePreset: preset.id },
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
    textSpan.textContent = PLATFORM_DISPLAY_NAMES[currentPlatform];

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
        // Check if any setting is enabled per-site
        const hasEnabled = Object.values(override.settings).some(
          (entry) => (entry as SiteValue<string>).enabled,
        );
        siteScope = hasEnabled;
        // For the form: show per-site value for enabled settings, global for disabled
        settings = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as (keyof StorageSettings)[]) {
          const entry = override.settings[key] as SiteValue<string>;
          (settings as unknown as Record<string, string>)[key] = entry.enabled
            ? entry.value
            : (globalSettings[key] as string);
        }
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
    buildImportExportSection();
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

/**
 * Copy current settings as a preset JSON to the clipboard.
 * Exports only global StorageSettings + site overrides (no version envelope,
 * no custom presets array).
 */
function handleCopyJson(): void {
  if (!globalSettings) return;

  const payload: { global: StorageSettings; siteOverrides: typeof allSiteOverrides } = {
    global: { ...globalSettings },
    siteOverrides: { ...allSiteOverrides },
  };

  const json = JSON.stringify(payload, null, 2);

  void navigator.clipboard.writeText(json).then(
    () => {
      showMessage('Copied to clipboard!', 'success');
    },
    () => {
      showMessage('Failed to copy', 'error');
    },
  );
}

/**
 * Read JSON from the import text field, validate as a preset, prompt for a
 * name, and save as a new custom preset.
 */
async function handlePasteJson(): Promise<void> {
  const importInput = document.getElementById('import-json-input') as HTMLInputElement | null;
  if (!importInput) return;

  const text = importInput.value.trim();

  if (!text) {
    showMessage('Paste settings JSON first', 'error');
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    showMessage('Invalid JSON format', 'error');
    return;
  }

  const result = validatePresetJson(raw);
  if (!result.valid || !result.data) {
    showMessage(result.error ?? 'Invalid preset JSON', 'error');
    return;
  }

  // Prompt for a preset name
  const name = window.prompt('Preset name:');
  if (!name || !name.trim()) return;

  try {
    // Save as a new custom preset (global settings)
    const newPreset = await saveCustomPreset(name.trim(), result.data.global);
    customPresets = await loadCustomPresets();

    // Merge imported site overrides into storage if present
    const importedOverrides = result.data.siteOverrides;
    const importedPlatforms = Object.keys(importedOverrides);
    if (importedPlatforms.length > 0) {
      // Merge into existing site overrides, migrating to new format
      for (const [platform, override] of Object.entries(importedOverrides)) {
        if (override) {
          // Import may have legacy plain settings — convert to SiteSettings
          const settings = override.settings;
          const firstKey = Object.keys(settings)[0];
          const isLegacy = firstKey && typeof (settings as Record<string, unknown>)[firstKey] === 'string';
          const migrated: SiteOverride = isLegacy
            ? { settings: toSiteSettings(settings as unknown as StorageSettings), activePreset: override.activePreset }
            : override as SiteOverride;
          allSiteOverrides[platform as Platform] = migrated;
        }
      }
      await chrome.storage.sync.set({ siteSettings: allSiteOverrides });
    }

    // Apply the preset's global settings as the current settings
    globalSettings = result.data.global;
    await chrome.storage.sync.set({
      ...globalSettings,
      activePreset: newPreset.id,
    });

    // Refresh the UI
    refreshPresetDropdown();

    // Determine what to display
    let displaySettings = globalSettings;
    if (currentPlatform && allSiteOverrides[currentPlatform]) {
      const override = allSiteOverrides[currentPlatform]!;
      // Show effective values: per-site for enabled, global for disabled
      displaySettings = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS) as (keyof StorageSettings)[]) {
        const entry = override.settings[key] as SiteValue<string>;
        (displaySettings as unknown as Record<string, string>)[key] = entry.enabled
          ? entry.value
          : (globalSettings[key] as string);
      }
      siteScope = true;
    } else {
      siteScope = false;
    }

    populateForm(displaySettings);
    updatePresetIndicator(displaySettings);
    initSettingScopes();
    buildScopeChips();
    updateScopeChips();

    // Clear the import field
    importInput.value = '';

    const siteCount = importedPlatforms.length;
    const siteMsg = siteCount > 0 ? ` + ${String(siteCount)} site override(s)` : '';
    showMessage(`Preset "${name.trim()}" saved!${siteMsg}`, 'success');
  } catch (error) {
    console.error('Preset import failed:', error);
    showMessage('Failed to import preset', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initializePopup();
});
