/**
 * E2E tests for Consistent Subtitle Style — Preset system.
 *
 * Tests the preset dropdown in the popup: selecting presets, verifying
 * settings are applied, and verifying CSS changes on a live page.
 * Uses Vimeo embeds (no login required) for visual verification.
 *
 * Run:
 *   DISPLAY=:99 bun e2e/presets.e2e.js
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

// Vimeo embed — same as vimeo.e2e.js, reliable free video
const VIMEO_URLS = [
  'https://player.vimeo.com/video/824804225?texttrack=en',
  'https://player.vimeo.com/video/783455878?texttrack=en',
  'https://player.vimeo.com/video/76979871?texttrack=en',
];

// Preset definitions (must match src/presets.ts)
const PRESETS = {
  recommended: {
    name: 'Recommended',
    settings: {
      characterEdgeStyle: 'dropshadow',
      backgroundOpacity: '0',
      windowOpacity: '0',
      fontColor: 'auto',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    },
  },
  classic: {
    name: 'Classic',
    settings: {
      characterEdgeStyle: 'none',
      backgroundOpacity: '75',
      windowOpacity: 'auto',
      fontColor: 'white',
      fontOpacity: 'auto',
      backgroundColor: 'black',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    },
  },
  minimal: {
    name: 'Minimal',
    settings: {
      characterEdgeStyle: 'auto',
      backgroundOpacity: 'auto',
      windowOpacity: 'auto',
      fontColor: 'auto',
      fontOpacity: 'auto',
      backgroundColor: 'auto',
      windowColor: 'auto',
      fontFamily: 'auto',
      fontSize: 'auto',
    },
  },
};

async function openPopup(browser, extId) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/index.html`, {
    waitUntil: 'networkidle2',
    timeout: 5000,
  });
  await sleep(500);
  return page;
}

async function getPresetValue(popupPage) {
  return popupPage.evaluate(() => {
    const sel = document.getElementById('preset-select');
    return sel ? sel.value : null;
  });
}

async function selectPreset(popupPage, presetId) {
  await popupPage.evaluate((id) => {
    const sel = document.getElementById('preset-select');
    if (sel) {
      sel.value = id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, presetId);
  await sleep(1500); // Wait for preset to apply + storage sync + message broadcast
}

async function getPopupDropdownValues(popupPage) {
  return popupPage.evaluate(() => {
    const result = {};
    const selects = document.querySelectorAll('.custom-select[data-id]');
    for (const sel of selects) {
      const id = sel.getAttribute('data-id');
      // selectedValue is set on the container via dataset.selectedValue
      const value = sel.dataset?.selectedValue ?? null;
      if (id) result[id] = value;
    }
    return result;
  });
}

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser({ freshProfile: true });

  try {
    // ── Phase 0: Extension init ────────────────────────────────────────
    const extId = await getExtensionId(browser);
    assert(!!extId, 'Extension loaded', extId ? `ID: ${extId}` : 'not found');
    if (!extId) {
      summary('Presets');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Load Vimeo embed for visual verification ──────────────
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
    } else {
      assert(true, 'Vimeo page loaded');
    }

    // Wait for extension to init
    await sleep(3000);

    // ── Phase 2: Popup preset UI ───────────────────────────────────────
    console.log('\n── Popup preset UI ──');
    let popupPage = await openPopup(browser, extId);

    // Check preset dropdown exists
    const presetInfo = await popupPage.evaluate(() => {
      const sel = document.getElementById('preset-select');
      if (!sel) return null;
      const options = Array.from(sel.options).map((o) => ({
        value: o.value,
        text: o.textContent,
        disabled: o.disabled,
      }));
      return { tagName: sel.tagName, optionCount: options.length, options };
    });

    assert(presetInfo !== null, 'Preset dropdown exists');
    assert(
      presetInfo?.tagName === 'SELECT',
      'Preset dropdown is a <select>',
      presetInfo?.tagName,
    );

    // Should have: Custom + Recommended + Classic + Minimal = 4 minimum
    assert(
      presetInfo?.optionCount >= 4,
      'Preset dropdown has ≥4 options',
      `${presetInfo?.optionCount} options`,
    );

    // Check specific preset options exist
    const optionValues = presetInfo?.options?.map((o) => o.value) ?? [];
    assert(optionValues.includes('custom'), 'Has "Custom" option');
    assert(optionValues.includes('recommended'), 'Has "Recommended" option');
    assert(optionValues.includes('classic'), 'Has "Classic" option');
    assert(optionValues.includes('minimal'), 'Has "Minimal" option');

    // Recommended should have star prefix
    const recOpt = presetInfo?.options?.find((o) => o.value === 'recommended');
    assert(
      recOpt?.text?.includes('★'),
      'Recommended has ★ prefix',
      `text: "${recOpt?.text}"`,
    );

    await popupPage.close();

    // ── Phase 3: Apply "Classic" preset ────────────────────────────────
    console.log('\n── Apply Classic preset ──');
    popupPage = await openPopup(browser, extId);
    await selectPreset(popupPage, 'classic');

    // Verify the preset indicator shows 'classic'
    const classicVal = await getPresetValue(popupPage);
    assert(classicVal === 'classic', 'Preset indicator shows "classic"', `got: ${classicVal}`);

    // Verify individual dropdown values match Classic preset
    const classicDropdowns = await getPopupDropdownValues(popupPage);
    assert(
      classicDropdowns['font-color'] === 'white',
      'Classic: fontColor → white',
      `got: ${classicDropdowns['font-color']}`,
    );
    assert(
      classicDropdowns['background-color'] === 'black',
      'Classic: backgroundColor → black',
      `got: ${classicDropdowns['background-color']}`,
    );
    assert(
      classicDropdowns['character-edge-style'] === 'none',
      'Classic: edgeStyle → none',
      `got: ${classicDropdowns['character-edge-style']}`,
    );

    await popupPage.close();

    // Verify CSS on Vimeo page (if loaded)
    if (loaded) {
      console.log('\n── Verify Classic CSS on Vimeo ──');
      // Classic: fontColor=white → rgb(255,255,255), edgeStyle=none
      const captionSel = '.vp-captions';

      const classicColor = await waitForStyle(
        page,
        captionSel,
        'color',
        (v) => v && v.includes('255') && v.includes('255') && v.includes('255'),
        { timeoutMs: 10_000 },
      );
      assert(
        classicColor && classicColor.includes('255'),
        'Classic CSS: white font color on Vimeo',
        `got: ${classicColor}`,
      );

      const classicShadow = await waitForStyle(
        page,
        captionSel,
        'textShadow',
        (v) => v === 'none' || !v,
        { timeoutMs: 5_000 },
      );
      assert(
        !classicShadow || classicShadow === 'none',
        'Classic CSS: no text shadow on Vimeo',
        `got: ${classicShadow}`,
      );
    }

    // ── Phase 4: Switch to "Recommended" preset ────────────────────────
    console.log('\n── Switch to Recommended preset ──');
    popupPage = await openPopup(browser, extId);
    await selectPreset(popupPage, 'recommended');

    const recVal = await getPresetValue(popupPage);
    assert(recVal === 'recommended', 'Preset indicator shows "recommended"', `got: ${recVal}`);

    // Recommended: dropshadow edge, no background
    const recDropdowns = await getPopupDropdownValues(popupPage);
    assert(
      recDropdowns['character-edge-style'] === 'dropshadow',
      'Recommended: edgeStyle → dropshadow',
      `got: ${recDropdowns['character-edge-style']}`,
    );
    assert(
      recDropdowns['background-opacity'] === '0',
      'Recommended: bgOpacity → 0',
      `got: ${recDropdowns['background-opacity']}`,
    );

    await popupPage.close();

    // Verify CSS on Vimeo
    if (loaded) {
      console.log('\n── Verify Recommended CSS on Vimeo ──');
      const captionSel = '.vp-captions';

      const recShadow = await waitForStyle(
        page,
        captionSel,
        'textShadow',
        (v) => v && v !== 'none',
        { timeoutMs: 10_000 },
      );
      assert(
        recShadow && recShadow !== 'none',
        'Recommended CSS: dropshadow on Vimeo',
        `got: ${recShadow?.substring(0, 60)}`,
      );
    }

    // ── Phase 5: Manual change reverts to "Custom" ─────────────────────
    console.log('\n── Manual change → Custom ──');
    // Change a single setting manually
    await setStorage(browser, extId, { fontColor: 'yellow' });
    await sleep(1500);

    popupPage = await openPopup(browser, extId);
    await sleep(500);

    const afterManual = await getPresetValue(popupPage);
    assert(
      afterManual === 'custom',
      'Manual change reverts preset to "Custom"',
      `got: ${afterManual}`,
    );

    await popupPage.close();

    // ── Phase 6: Apply "Minimal" preset (all auto) ─────────────────────
    console.log('\n── Apply Minimal preset ──');
    popupPage = await openPopup(browser, extId);
    await selectPreset(popupPage, 'minimal');

    const minVal = await getPresetValue(popupPage);
    assert(minVal === 'minimal', 'Preset indicator shows "minimal"', `got: ${minVal}`);

    // All dropdowns should be 'auto'
    const minDropdowns = await getPopupDropdownValues(popupPage);
    const allAuto = Object.entries(minDropdowns).every(([, v]) => v === 'auto');
    assert(
      allAuto,
      'Minimal: all settings are "auto"',
      JSON.stringify(minDropdowns),
    );

    await popupPage.close();

    // ── Phase 7: Reset and verify ──────────────────────────────────────
    console.log('\n── Reset to defaults ──');
    await resetStorage(browser, extId);
    await sleep(1500);

    popupPage = await openPopup(browser, extId);
    await sleep(500);

    const afterReset = await getPresetValue(popupPage);
    // After reset, should be either 'minimal' (all auto matches) or 'custom'
    assert(
      afterReset === 'minimal' || afterReset === 'custom',
      'After reset: preset is minimal or custom',
      `got: ${afterReset}`,
    );

    await popupPage.close();

    const { failed } = summary('Presets');
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
