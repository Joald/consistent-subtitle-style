/**
 * Shared E2E test helpers for Consistent Subtitle Style.
 *
 * Provides a reliable way to change extension settings without depending
 * on the MV3 service worker staying alive.  Instead of evaluating code in
 * the SW context, we open the extension popup page in a real tab and
 * programmatically interact with its custom-select dropdowns — exactly
 * what a human user would do.
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.resolve(__dirname, '..', 'dist');

// ── Browser helpers ──────────────────────────────────────────────────────────

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function hasXvfb() {
  try {
    const fs = require('fs');
    return fs.existsSync('/tmp/.X11-unix/X99');
  } catch {
    return false;
  }
}

/**
 * Launch Chrome with the extension loaded.
 * Prefers headless:'new' (Chrome ≥112) which supports extensions.
 * Falls back to headful+Xvfb when available.
 */
export async function launchBrowser(opts = {}) {
  const useHeadful = hasXvfb() && process.env.DISPLAY;
  const launchOpts = {
    headless: useHeadful ? false : 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--window-size=1920,1080',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: 1920, height: 1080 },
    ...opts,
  };

  // Optionally use a fresh temp profile
  if (opts.freshProfile) {
    const fs = require('fs');
    const os = require('os');
    launchOpts.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-e2e-'));
  }

  return puppeteer.launch(launchOpts);
}

// ── Extension ID discovery ───────────────────────────────────────────────────

/**
 * Find the extension ID by scanning browser targets.
 * Tries multiple strategies:
 * 1. Check existing targets for service_worker or chrome-extension:// URLs
 * 2. Open chrome://extensions to discover the extension ID from the page
 * 3. Wake the SW by navigating to the popup page once we have an ID
 */
export async function getExtensionId(browser, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  // Strategy 1: scan existing targets
  while (Date.now() < deadline) {
    for (const t of browser.targets()) {
      const url = t.url();
      if (t.type() === 'service_worker' && url.startsWith('chrome-extension://'))
        return url.split('/')[2];
    }
    for (const t of browser.targets()) {
      const url = t.url();
      if (url.startsWith('chrome-extension://') && url.includes('/')) {
        const id = url.split('/')[2];
        // Validate it looks like a Chrome extension ID (32 lowercase hex chars)
        if (/^[a-z]{32}$/.test(id)) return id;
      }
    }

    // Strategy 2: read extension ID from chrome://extensions
    try {
      const extPage = await browser.newPage();
      await extPage.goto('chrome://extensions', {
        waitUntil: 'domcontentloaded',
        timeout: 5_000,
      });
      await sleep(1000);

      const extId = await extPage.evaluate(() => {
        // Chrome extensions page uses shadow DOM
        const mgr = document.querySelector('extensions-manager');
        if (!mgr?.shadowRoot) return null;
        const itemsList = mgr.shadowRoot.querySelector('extensions-item-list');
        if (!itemsList?.shadowRoot) return null;
        const items = itemsList.shadowRoot.querySelectorAll('extensions-item');
        for (const item of items) {
          const id = item.getAttribute('id');
          if (id) return id;
        }
        return null;
      });

      await extPage.close();

      if (extId) return extId;
    } catch {
      // chrome://extensions may not be accessible in some modes
    }

    await sleep(500);
  }
  return null;
}

// ── Setting names mapping ────────────────────────────────────────────────────

// Maps storage keys to popup data-id attributes
const STORAGE_KEY_TO_DATA_ID = {
  fontColor: 'font-color',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontOpacity: 'font-opacity',
  backgroundColor: 'background-color',
  backgroundOpacity: 'background-opacity',
  windowColor: 'window-color',
  windowOpacity: 'window-opacity',
  characterEdgeStyle: 'character-edge-style',
};

// ── Popup-based storage manipulation ─────────────────────────────────────────

/**
 * Wait for the popup's "Saved!" confirmation message to appear.
 * This ensures chrome.storage.sync.set() has completed before we close
 * the popup tab.
 *
 * @param {Page} popupPage - Puppeteer page for the popup
 * @param {number} timeoutMs - Maximum wait time
 * @returns {Promise<boolean>} true if saved confirmation appeared
 */
async function waitForSaveConfirmation(popupPage, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const saved = await popupPage.evaluate(() => {
      const msg = document.getElementById('message');
      return msg?.textContent?.includes('Saved') && msg?.classList?.contains('show');
    });
    if (saved) return true;
    await sleep(100);
  }
  return false;
}

/**
 * Change extension settings by interacting with the popup UI.
 *
 * Opens chrome-extension://{extId}/index.html in a new tab, clicks the
 * appropriate dropdown options, which triggers handleSave() in popup.ts.
 * This saves to chrome.storage.sync AND sends chrome.tabs.sendMessage
 * to content scripts for live updates.
 *
 * Waits for the "Saved!" confirmation to appear before closing the tab,
 * ensuring the async chrome.storage.sync.set() has completed.
 *
 * Does NOT require the service worker to be alive.
 *
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extId - Extension ID
 * @param {Record<string, string>} settings - Map of storage keys to values
 * @returns {Promise<boolean>} true if settings were changed successfully
 */
export async function setStorageViaPopup(browser, extId, settings) {
  if (!extId) return false;

  const popupPage = await browser.newPage();
  try {
    await popupPage.goto(`chrome-extension://${extId}/index.html`, {
      waitUntil: 'networkidle2',
      timeout: 10_000,
    });
    await sleep(500);

    // Change each setting by clicking the appropriate dropdown option
    for (const [storageKey, value] of Object.entries(settings)) {
      const dataId = STORAGE_KEY_TO_DATA_ID[storageKey];
      if (!dataId) {
        console.warn(`  ⚠️  Unknown storage key: ${storageKey}`);
        continue;
      }

      const changed = await popupPage.evaluate(
        (id, val) => {
          const container = document.querySelector(`[data-id="${id}"]`);
          if (!container) return false;

          // Find the option with the matching data-value
          const option = container.querySelector(`.select-option[data-value="${val}"]`);
          if (!option) return false;

          // Click it — this triggers the event handler in popup.ts which:
          // 1. Updates the UI
          // 2. Calls handleSave() → saveSettings() → chrome.storage.sync.set()
          // 3. Sends chrome.tabs.sendMessage for live updates
          option.click();
          return true;
        },
        dataId,
        value,
      );

      if (!changed) {
        console.warn(`  ⚠️  Could not set ${storageKey}=${value} (data-id="${dataId}")`);
      }
    }

    // Wait for the "Saved!" confirmation instead of a blind timeout.
    // This ensures chrome.storage.sync.set() has completed before we
    // close the popup tab — fixing the intermittent font-family flake
    // where the tab was closed before the async save finished.
    const confirmed = await waitForSaveConfirmation(popupPage);
    if (!confirmed) {
      // Fallback: give extra time if the confirmation didn't appear
      console.warn('  ⚠️  Save confirmation not detected, waiting additional 1s');
      await sleep(1000);
    }

    return true;
  } catch (e) {
    console.warn(`  ⚠️  Popup interaction failed: ${e.message}`);
    return false;
  } finally {
    await popupPage.close();
  }
}

/**
 * Reset all settings to "auto" via the popup's Reset button.
 */
export async function resetStorageViaPopup(browser, extId) {
  if (!extId) return false;

  const popupPage = await browser.newPage();
  try {
    await popupPage.goto(`chrome-extension://${extId}/index.html`, {
      waitUntil: 'networkidle2',
      timeout: 10_000,
    });
    await sleep(500);

    await popupPage.evaluate(() => {
      const resetBtn = document.getElementById('reset-btn');
      if (resetBtn) resetBtn.click();
    });

    // Wait for "Saved!" confirmation after reset too
    const confirmed = await waitForSaveConfirmation(popupPage);
    if (!confirmed) {
      await sleep(1000);
    }

    return true;
  } catch (e) {
    console.warn(`  ⚠️  Reset via popup failed: ${e.message}`);
    return false;
  } finally {
    await popupPage.close();
  }
}

// ── Legacy SW-based storage (fallback) ───────────────────────────────────────

/**
 * Try to find the service worker and set storage directly.
 * Falls back gracefully — returns false if SW is not available.
 */
export async function setStorageViaSW(browser, extId, settings) {
  try {
    const swTarget = await getServiceWorker(browser, extId, 5_000);
    if (!swTarget) return false;
    const sw = await swTarget.worker();
    await sw.evaluate(
      (s) => new Promise((resolve) => chrome.storage.sync.set(s, resolve)),
      settings,
    );
    return true;
  } catch {
    return false;
  }
}

async function getServiceWorker(browser, extId, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sw = browser.targets().find((t) => t.type() === 'service_worker');
    if (sw) return sw;
    // Try to wake SW by opening popup
    if (extId) {
      const p = await browser.newPage();
      await p
        .goto(`chrome-extension://${extId}/index.html`, {
          waitUntil: 'load',
          timeout: 3000,
        })
        .catch(() => {});
      await sleep(500);
      await p.close();
    }
    await sleep(500);
  }
  return null;
}

/**
 * Set storage using the best available method.
 * Tries popup first (most reliable), falls back to SW.
 */
export async function setStorage(browser, extId, settings) {
  // Popup approach is the primary — works even when SW is idle
  const ok = await setStorageViaPopup(browser, extId, settings);
  if (ok) return true;
  // Fallback to SW
  return setStorageViaSW(browser, extId, settings);
}

/**
 * Reset storage using the best available method.
 */
export async function resetStorage(browser, extId) {
  return resetStorageViaPopup(browser, extId);
}

// ── Style polling helpers ────────────────────────────────────────────────────

/**
 * Poll a computed CSS property on an element until it satisfies a predicate.
 *
 * Useful for style-change assertions that depend on timing (CSS injection,
 * React re-renders, etc.).  Returns the final value, or the last sampled
 * value if the timeout expires — the caller can still assert on it.
 *
 * @param {Page} page         Puppeteer page
 * @param {string} selector   CSS selector for the target element
 * @param {string} cssProp    CSS property name (camelCase, e.g. 'fontFamily')
 * @param {(v: string|null) => boolean} predicate  Return true when the value is acceptable
 * @param {{ timeoutMs?: number, intervalMs?: number }} opts
 * @returns {Promise<string|null>}
 */
export async function waitForStyle(page, selector, cssProp, predicate, opts = {}) {
  const { timeoutMs = 10_000, intervalMs = 500 } = opts;
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;

  while (Date.now() < deadline) {
    lastValue = await page.evaluate(
      (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? (getComputedStyle(el)[prop] ?? null) : null;
      },
      selector,
      cssProp,
    );

    if (predicate(lastValue)) return lastValue;
    await sleep(intervalMs);
  }
  return lastValue; // timed out — return last value for assertion message
}

// ── Per-site override helpers ────────────────────────────────────────────────

/**
 * Set a per-site override via the extension page.
 * The siteSettings storage key holds a map: { [platform]: { settings, activePreset } }
 */
export async function setSiteOverride(browser, extId, platform, settings, activePreset = null) {
  const swPage = await browser.newPage();
  await swPage.goto(`chrome-extension://${extId}/index.html`, {
    waitUntil: 'networkidle2',
    timeout: 5000,
  });

  const result = await swPage.evaluate(
    async (p, s, ap) => {
      try {
        const data = await chrome.storage.sync.get('siteSettings');
        const existing = data.siteSettings || {};
        existing[p] = { settings: s, activePreset: ap };
        await chrome.storage.sync.set({ siteSettings: existing });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    platform,
    settings,
    activePreset,
  );

  await swPage.close();
  return result.ok;
}

/**
 * Clear all per-site overrides.
 */
export async function clearSiteOverrides(browser, extId) {
  const swPage = await browser.newPage();
  await swPage.goto(`chrome-extension://${extId}/index.html`, {
    waitUntil: 'networkidle2',
    timeout: 5000,
  });

  await swPage.evaluate(async () => {
    await chrome.storage.sync.set({ siteSettings: {} });
  });

  await swPage.close();
}

// ── Preset settings (must match src/presets.ts) ─────────────────────────────

export const PRESET_HIGH_CONTRAST = {
  characterEdgeStyle: 'none',
  backgroundOpacity: '75',
  windowOpacity: 'auto',
  fontColor: 'white',
  fontOpacity: 'auto',
  backgroundColor: 'black',
  windowColor: 'auto',
  fontFamily: 'auto',
  fontSize: 'auto',
};

export const PRESET_RECOMMENDED = {
  characterEdgeStyle: 'dropshadow',
  backgroundOpacity: '0',
  windowOpacity: '0',
  fontColor: 'auto',
  fontOpacity: 'auto',
  backgroundColor: 'auto',
  windowColor: 'auto',
  fontFamily: 'proportional-sans-serif',
  fontSize: 'auto',
};

// ── Test runner helpers ──────────────────────────────────────────────────────

export function createTestRunner() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  function assert(condition, name, detail) {
    if (condition) {
      passed++;
      console.log(`  ✅ ${name}`);
    } else {
      failed++;
      failures.push({ name, detail });
      console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
    }
  }

  function skip(name, reason) {
    skipped++;
    console.log(`  ⏭️  ${name} — ${reason}`);
  }

  function summary(platform) {
    console.log('\n' + '═'.repeat(50));
    console.log(
      `  ${platform}: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`,
    );
    if (failures.length) {
      console.log('\n  Failures:');
      for (const f of failures) console.log(`    • ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    }
    console.log('═'.repeat(50));
    return { passed, failed, skipped };
  }

  return {
    assert,
    skip,
    summary,
    get passed() {
      return passed;
    },
    get failed() {
      return failed;
    },
  };
}
