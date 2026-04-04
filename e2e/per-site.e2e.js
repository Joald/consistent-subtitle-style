/**
 * E2E tests for Consistent Subtitle Style — Per-Site Settings.
 *
 * Tests that per-site overrides take priority over global settings.
 * Uses Vimeo embeds (no login required) for visual verification.
 * Manipulates chrome.storage.sync directly via the service worker
 * to set per-site overrides for the 'vimeo' platform.
 *
 * Run:
 *   DISPLAY=:99 bun e2e/per-site.e2e.js
 */

import {
  launchBrowser,
  getExtensionId,
  setStorage,
  resetStorage,
  sleep,
  waitForStyle,
  createTestRunner,
} from './helpers.js';

const { assert, skip, summary } = createTestRunner();

// Vimeo embed — reliable free video
const VIMEO_URLS = [
  'https://player.vimeo.com/video/824804225?texttrack=en',
  'https://player.vimeo.com/video/783455878?texttrack=en',
  'https://player.vimeo.com/video/76979871?texttrack=en',
];

/**
 * Set a per-site override via the service worker.
 * The siteSettings storage key holds a map: { [platform]: { settings, activePreset } }
 */
async function setSiteOverride(browser, extId, platform, settings, activePreset = null) {
  // Open service worker page
  const swPage = await browser.newPage();
  await swPage.goto(`chrome-extension://${extId}/index.html`, {
    waitUntil: 'networkidle2',
    timeout: 5000,
  });

  const result = await swPage.evaluate(
    async (p, s, ap) => {
      try {
        // Load existing site settings
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
async function clearSiteOverrides(browser, extId) {
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

/**
 * Read current storage state via popup page.
 */
async function readStorage(browser, extId) {
  const swPage = await browser.newPage();
  await swPage.goto(`chrome-extension://${extId}/index.html`, {
    waitUntil: 'networkidle2',
    timeout: 5000,
  });

  const data = await swPage.evaluate(async () => {
    return chrome.storage.sync.get(null);
  });

  await swPage.close();
  return data;
}

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser({ freshProfile: true });

  try {
    // ── Phase 0: Extension init ────────────────────────────────────────
    const extId = await getExtensionId(browser);
    assert(!!extId, 'Extension loaded', extId ? `ID: ${extId}` : 'not found');
    if (!extId) {
      summary('Per-Site Settings');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Load Vimeo embed ──────────────────────────────────────
    console.log('\n── Loading Vimeo embed ──');
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    let loaded = false;
    for (const url of VIMEO_URLS) {
      console.log(`  Trying: ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25_000 });
        loaded = true;
        console.log('  ✓ Video loaded');
        break;
      } catch (e) {
        console.log(`  ✗ ${e.message}`);
      }
    }

    if (!loaded) {
      console.log('  No Vimeo video loaded — skipping visual tests');
      skip('Vimeo page loaded', 'all videos unavailable');
      summary('Per-Site Settings');
      await browser.close();
      process.exit(1);
      return;
    }
    assert(true, 'Vimeo page loaded');

    // Wait for extension to initialize
    await sleep(3000);

    // ── Phase 2: Set global settings ───────────────────────────────────
    console.log('\n── Set global settings (fontColor=red) ──');
    await setStorage(browser, extId, { fontColor: 'red' });
    await sleep(2000);

    // Verify global settings applied on Vimeo
    const captionSel = '.vp-captions';
    const globalColor = await waitForStyle(
      page,
      captionSel,
      'color',
      (v) => v && (v.includes('255, 0, 0') || v.includes('rgb(255, 0, 0)')),
      { timeoutMs: 10_000 },
    );
    assert(
      globalColor && (globalColor.includes('255, 0, 0') || globalColor.includes('rgb(255, 0, 0)')),
      'Global fontColor=red applied on Vimeo',
      `got: ${globalColor}`,
    );

    // ── Phase 3: Set per-site override for Vimeo ───────────────────────
    console.log('\n── Set per-site override (vimeo: fontColor=cyan) ──');
    const vimeoSettings = {
      characterEdgeStyle: 'auto',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'cyan',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    };
    const setOk = await setSiteOverride(browser, extId, 'vimeo', vimeoSettings);
    assert(setOk, 'Per-site override saved successfully');

    // Verify storage has the override
    const storageAfter = await readStorage(browser, extId);
    const siteSettings = storageAfter.siteSettings || {};
    assert(
      siteSettings.vimeo !== undefined,
      'Storage contains vimeo per-site override',
      JSON.stringify(Object.keys(siteSettings)),
    );
    assert(
      siteSettings.vimeo?.settings?.fontColor === 'cyan',
      'Vimeo override has fontColor=cyan',
      `got: ${siteSettings.vimeo?.settings?.fontColor}`,
    );

    // Reload the Vimeo page to pick up the per-site override
    console.log('\n── Reload Vimeo to apply per-site override ──');
    await page.reload({ waitUntil: 'networkidle2', timeout: 25_000 });
    await sleep(3000);

    // Verify per-site cyan color on Vimeo
    const siteColor = await waitForStyle(
      page,
      captionSel,
      'color',
      (v) => v && (v.includes('0, 255, 255') || v.includes('rgb(0, 255, 255)')),
      { timeoutMs: 10_000 },
    );
    assert(
      siteColor && (siteColor.includes('0, 255, 255') || siteColor.includes('rgb(0, 255, 255)')),
      'Per-site fontColor=cyan applied on Vimeo after reload',
      `got: ${siteColor}`,
    );

    // ── Phase 4: Verify global settings unchanged ──────────────────────
    console.log('\n── Verify global fontColor still red ──');
    const globalStorage = await readStorage(browser, extId);
    assert(
      globalStorage.fontColor === 'red',
      'Global fontColor still "red" in storage',
      `got: ${globalStorage.fontColor}`,
    );

    // ── Phase 5: Change global settings, verify per-site unaffected ────
    console.log('\n── Change global to fontColor=yellow ──');
    await setStorage(browser, extId, { fontColor: 'yellow' });
    await sleep(1500);

    // Reload Vimeo — should still use per-site cyan, not global yellow
    await page.reload({ waitUntil: 'networkidle2', timeout: 25_000 });
    await sleep(3000);

    const afterGlobalChange = await waitForStyle(
      page,
      captionSel,
      'color',
      (v) => v && (v.includes('0, 255, 255') || v.includes('rgb(0, 255, 255)')),
      { timeoutMs: 10_000 },
    );
    assert(
      afterGlobalChange &&
        (afterGlobalChange.includes('0, 255, 255') ||
          afterGlobalChange.includes('rgb(0, 255, 255)')),
      'Per-site override persists after global change (still cyan)',
      `got: ${afterGlobalChange}`,
    );

    // ── Phase 6: Clear per-site override, verify fallback to global ────
    console.log('\n── Clear per-site override ──');
    await clearSiteOverrides(browser, extId);
    await sleep(1000);

    // Verify storage cleared
    const clearedStorage = await readStorage(browser, extId);
    const clearedSiteSettings = clearedStorage.siteSettings || {};
    assert(
      clearedSiteSettings.vimeo === undefined,
      'Vimeo per-site override cleared from storage',
      JSON.stringify(Object.keys(clearedSiteSettings)),
    );

    // Reload Vimeo — should now use global yellow
    await page.reload({ waitUntil: 'networkidle2', timeout: 25_000 });
    await sleep(3000);

    const fallbackColor = await waitForStyle(
      page,
      captionSel,
      'color',
      (v) => v && (v.includes('255, 255, 0') || v.includes('rgb(255, 255, 0)')),
      { timeoutMs: 10_000 },
    );
    assert(
      fallbackColor &&
        (fallbackColor.includes('255, 255, 0') || fallbackColor.includes('rgb(255, 255, 0)')),
      'After clearing per-site, Vimeo falls back to global fontColor=yellow',
      `got: ${fallbackColor}`,
    );

    // ── Phase 7: Multiple per-site overrides ───────────────────────────
    console.log('\n── Set per-site overrides for multiple platforms ──');
    const youtubeSettings = {
      characterEdgeStyle: 'outline',
      backgroundOpacity: '50',
      windowOpacity: 'auto',
      fontColor: 'green',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    };
    const vimeoSettings2 = {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'white',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    };

    await setSiteOverride(browser, extId, 'youtube', youtubeSettings);
    await setSiteOverride(browser, extId, 'vimeo', vimeoSettings2);
    await sleep(1000);

    // Verify both overrides exist
    const multiStorage = await readStorage(browser, extId);
    const multiSiteSettings = multiStorage.siteSettings || {};
    assert(
      multiSiteSettings.youtube !== undefined && multiSiteSettings.vimeo !== undefined,
      'Both YouTube and Vimeo per-site overrides exist',
      `platforms: ${Object.keys(multiSiteSettings).join(', ')}`,
    );
    assert(
      multiSiteSettings.youtube?.settings?.fontColor === 'green',
      'YouTube override: fontColor=green',
      `got: ${multiSiteSettings.youtube?.settings?.fontColor}`,
    );
    assert(
      multiSiteSettings.vimeo?.settings?.fontColor === 'white',
      'Vimeo override: fontColor=white',
      `got: ${multiSiteSettings.vimeo?.settings?.fontColor}`,
    );

    // Reload Vimeo — should use Vimeo-specific white, not YouTube's green
    await page.reload({ waitUntil: 'networkidle2', timeout: 25_000 });
    await sleep(3000);

    const vimeoSpecific = await waitForStyle(
      page,
      captionSel,
      'color',
      (v) => v && v.includes('255') && v.includes('255') && v.includes('255'),
      { timeoutMs: 10_000 },
    );
    assert(
      vimeoSpecific && vimeoSpecific.includes('255'),
      'Vimeo uses its own per-site white, not YouTube green',
      `got: ${vimeoSpecific}`,
    );

    // Also verify dropshadow edge style from Vimeo override
    const vimeoShadow = await waitForStyle(
      page,
      captionSel,
      'textShadow',
      (v) => v && v !== 'none',
      { timeoutMs: 5_000 },
    );
    assert(
      vimeoShadow && vimeoShadow !== 'none',
      'Vimeo per-site dropshadow applied',
      `got: ${vimeoShadow?.substring(0, 60)}`,
    );

    // ── Phase 8: Reset everything ──────────────────────────────────────
    console.log('\n── Reset all settings ──');
    await clearSiteOverrides(browser, extId);
    await resetStorage(browser, extId);
    await sleep(1000);

    const finalStorage = await readStorage(browser, extId);
    const finalSiteSettings = finalStorage.siteSettings || {};
    assert(
      Object.keys(finalSiteSettings).length === 0,
      'All per-site overrides cleared after reset',
      JSON.stringify(finalSiteSettings),
    );

    const { failed } = summary('Per-Site Settings');
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err);
    try {
      await browser.close();
    } catch {}
    process.exit(1);
  }
}

run();
