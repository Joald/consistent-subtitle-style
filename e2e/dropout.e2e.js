/**
 * E2E tests for Consistent Subtitle Style — Dropout (Vimeo OTT) platform.
 *
 * Runs a real Chrome with the extension loaded against embed.vhx.tv
 * and verifies subtitle styles change live when settings are updated
 * via the popup page.
 *
 * Run:
 *   bun e2e/dropout.e2e.js
 */

import {
  launchBrowser,
  getExtensionId,
  setStorage,
  resetStorage,
  sleep,
  createTestRunner,
} from './helpers.js';

const { assert, skip, summary } = createTestRunner();

const EMBED_URL = 'https://embed.vhx.tv/videos/3867670?api=1&autoplay=1&vimeo=1';

/** Read computed styles from the caption container and lines. */
async function getCaptionStyles(page) {
  return page.evaluate(() => {
    const container = document.querySelector('.vp-captions');
    const line = document.querySelector('[class*="CaptionsRenderer_module_captionsLine"]');
    const win = document.querySelector('[class*="CaptionsRenderer_module_captionsWindow"]');
    if (!container) return null;
    const cs = getComputedStyle(container);
    return {
      color: cs.color,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      textShadow: cs.textShadow,
      lineBackground: line ? getComputedStyle(line).backgroundColor : null,
      windowBackground: win ? getComputedStyle(win).backgroundColor : null,
      containerStyle: container.getAttribute('style') || '',
    };
  });
}

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser();

  try {
    // ── Extension init ───────────────────────────────────────────────────
    console.log('\n🔧  Extension loading');

    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    await page.goto(EMBED_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
    await sleep(3000);

    // Try multiple times to get extension ID (SW may go idle quickly)
    let extId = null;
    for (let attempt = 0; attempt < 3 && !extId; attempt++) {
      extId = await getExtensionId(browser, 8_000);
      if (!extId) {
        await page.reload({ waitUntil: 'networkidle2', timeout: 20_000 }).catch(() => {});
        await sleep(3000);
      }
    }
    assert(extId, 'Extension ID found');

    if (!extId) {
      console.log('  ⚠️  Cannot continue without extension ID');
      process.exit(1);
    }

    // ── Captions on embed.vhx.tv ─────────────────────────────────────────
    console.log('\n📺  Captions on embed.vhx.tv');

    // Ensure video is playing
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v?.paused) v.play();
    });
    await sleep(1000);

    // Click CC button
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if ((b.textContent || '').includes('CC')) {
          b.click();
          return;
        }
      }
    });

    // Wait for visible caption
    let captionText = '';
    for (let i = 0; i < 15; i++) {
      captionText = await page.evaluate(
        () => document.querySelector('.vp-captions')?.innerText?.trim() || '',
      );
      if (captionText.length > 0) break;
      await sleep(1000);
    }
    assert(captionText.length > 0, 'Caption text is visible', `got "${captionText}"`);

    const initLogs = consoleLogs.filter((l) => l.includes('CSS-STYL'));
    assert(
      initLogs.some((l) => l.includes('Bridge script initialized')),
      'Bridge initialises',
    );
    assert(
      initLogs.some((l) => l.includes('Detected platform: dropout')),
      'Platform detected as dropout',
    );
    assert(
      initLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() runs on init',
    );

    // Baseline styles
    const baseline = await getCaptionStyles(page);
    assert(baseline !== null, 'Caption container (.vp-captions) exists');
    assert(
      baseline?.color === 'rgb(255, 255, 255)',
      'Default font color is white',
      baseline?.color,
    );
    assert(
      baseline?.fontFamily?.includes('Helvetica'),
      'Default font is Helvetica family',
      baseline?.fontFamily,
    );

    // ── Live update: font color ──────────────────────────────────────────
    console.log('\n🎨  Live update — font color → yellow');
    consoleLogs.length = 0;
    await setStorage(browser, extId, { fontColor: 'yellow' });
    await sleep(3000);

    const afterColor = await getCaptionStyles(page);
    assert(
      afterColor?.color === 'rgb(255, 255, 0)',
      'Font color changed to yellow',
      afterColor?.color,
    );

    // ── Live update: font family ─────────────────────────────────────────
    console.log('\n🔤  Live update — font family → monospaced-serif');
    await setStorage(browser, extId, { fontFamily: 'monospaced-serif' });
    await sleep(3000);

    const afterFont = await getCaptionStyles(page);
    assert(
      afterFont?.fontFamily?.includes('Courier'),
      'Font family changed to Courier (monospace serif)',
      afterFont?.fontFamily,
    );

    // Verify localStorage stores snake_case value (Vimeo expects "monospace_serif", not "monospaceSerif")
    const lsFontFamily = await page.evaluate(() => {
      const keys = [
        'vimeo-ott-player-settings',
        'vimeo-video-settings',
        'vimeo-player-settings',
        'vimeo.player.settings',
      ];
      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          // Check nested captionStyle.fontFamily
          const nested = parsed?.captionStyle?.fontFamily;
          if (nested) return nested;
          // Check flat key
          const flat = parsed?.['captionStyle.fontFamily'];
          if (flat) return flat;
        } catch {
          /* skip */
        }
      }
      return null;
    });
    assert(
      lsFontFamily === 'monospace_serif',
      'localStorage stores font-family in snake_case for Vimeo',
      lsFontFamily,
    );

    // ── Live update: edge style ──────────────────────────────────────────
    console.log('\n✨  Live update — edge style → dropshadow');
    await setStorage(browser, extId, { characterEdgeStyle: 'dropshadow' });
    await sleep(3000);

    const afterEdge = await getCaptionStyles(page);
    assert(
      afterEdge?.textShadow !== 'none' && afterEdge?.textShadow !== '',
      'Text shadow applied for dropshadow',
      afterEdge?.textShadow,
    );

    // ── Live update: background color ────────────────────────────────────
    console.log('\n🟦  Live update — background color → blue (persisted to localStorage)');
    consoleLogs.length = 0;
    await setStorage(browser, extId, { backgroundColor: 'blue' });
    await sleep(3000);

    const bgLogs = consoleLogs.filter((l) => l.includes('applyVjsSetting'));
    assert(
      bgLogs.some((l) => l.includes('bgColor')),
      'applyVjsSetting called with bgColor',
      bgLogs.join(' | ').substring(0, 120),
    );

    const lsUpdated = consoleLogs.some((l) => l.includes('Updated localStorage'));
    assert(lsUpdated, 'Background colour written to localStorage for next reload');

    // ── Live update: font size ───────────────────────────────────────────
    console.log('\n📏  Live update — font size → 200%');
    const beforeSize = await getCaptionStyles(page);
    const baseSize = parseFloat(beforeSize?.fontSize || '49');
    await setStorage(browser, extId, { fontSize: '200%' });
    await sleep(3000);

    const afterSize = await getCaptionStyles(page);
    const newSize = parseFloat(afterSize?.fontSize || '0');
    assert(
      newSize > baseSize * 1.5,
      `Font size increased (${baseSize}px → ${newSize}px)`,
      afterSize?.fontSize,
    );

    // ── Combined settings ────────────────────────────────────────────────
    console.log('\n🔀  Combined settings change');
    await setStorage(browser, extId, {
      fontColor: 'cyan',
      fontFamily: 'casual',
      characterEdgeStyle: 'raised',
    });
    await sleep(3000);

    const afterCombo = await getCaptionStyles(page);
    assert(
      afterCombo?.color === 'rgb(0, 255, 255)',
      'Combined: font color is cyan',
      afterCombo?.color,
    );
    assert(
      afterCombo?.fontFamily?.includes('Comic Sans') || afterCombo?.fontFamily?.includes('fantasy'),
      'Combined: font family is casual',
      afterCombo?.fontFamily,
    );
    assert(
      afterCombo?.textShadow !== 'none' && afterCombo?.textShadow !== '',
      'Combined: edge style applied',
      afterCombo?.textShadow,
    );

    // ── Reset ────────────────────────────────────────────────────────────
    console.log('\n🔄  Reset via explicit "auto" values');
    consoleLogs.length = 0;
    await resetStorage(browser, extId);
    await sleep(3000);

    const resetLogs = consoleLogs.filter((l) => l.includes('app.applyStyles() called'));
    assert(
      resetLogs.length >= 1,
      'applyStyles() called after reset',
      `called ${resetLogs.length} times`,
    );

    // ── Popup loads ──────────────────────────────────────────────────────
    console.log('\n🪟  Popup UI');
    const popupPage = await browser.newPage();
    try {
      await popupPage.goto(`chrome-extension://${extId}/index.html`, {
        waitUntil: 'networkidle2',
        timeout: 5000,
      });
      await sleep(500);

      const popupInfo = await popupPage.evaluate(() => ({
        title: document.title,
        selectCount: document.querySelectorAll('.custom-select').length,
        hasResetBtn: !!Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent.includes('Reset'),
        ),
        hasPreview: !!document.getElementById('preview-text'),
      }));

      assert(popupInfo.title === 'Subtitle Styles', 'Popup title is correct');
      assert(
        popupInfo.selectCount === 9,
        'Popup has 9 setting dropdowns',
        String(popupInfo.selectCount),
      );
      assert(popupInfo.hasResetBtn, 'Popup has Reset button');
      assert(popupInfo.hasPreview, 'Popup has live preview element');
    } catch (e) {
      assert(false, 'Popup loads without error', e.message);
    } finally {
      await popupPage.close();
    }
  } finally {
    await browser.close();
  }

  const result = summary('Dropout');
  process.exit(result.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
