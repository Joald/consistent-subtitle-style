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
    launchOpts.userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'css-e2e-'),
    );
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
      if (t.type() === 'service_worker') return t.url().split('/')[2];
    }
    for (const t of browser.targets()) {
      const url = t.url();
      if (url.startsWith('chrome-extension://') && url.includes('/'))
        return url.split('/')[2];
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
 * Change extension settings by interacting with the popup UI.
 *
 * Opens chrome-extension://{extId}/index.html in a new tab, clicks the
 * appropriate dropdown options, which triggers handleSave() in popup.ts.
 * This saves to chrome.storage.sync AND sends chrome.tabs.sendMessage
 * to content scripts for live updates.
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
          const option = container.querySelector(
            `.select-option[data-value="${val}"]`,
          );
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
        console.warn(
          `  ⚠️  Could not set ${storageKey}=${value} (data-id="${dataId}")`,
        );
      }
    }

    // Give the popup a moment to save all settings
    await sleep(500);
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

    await sleep(1000);
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
      for (const f of failures)
        console.log(`    • ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    }
    console.log('═'.repeat(50));
    return { passed, failed, skipped };
  }

  return { assert, skip, summary, get passed() { return passed; }, get failed() { return failed; } };
}
