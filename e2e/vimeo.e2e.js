/**
 * E2E tests for Consistent Subtitle Style — Vimeo platform.
 *
 * Uses a free public Vimeo video with captions to test the full extension
 * flow: init → platform detection → captions → live CSS-based style changes.
 *
 * Settings are changed via the popup page (no SW dependency).
 *
 * Run:
 *   DISPLAY=:99 bun e2e/vimeo.e2e.js
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

// Vimeo embed player with text track enabled.
// Using a popular public video — the embed player is more reliable
// for headless testing than the full vimeo.com page.
// ?texttrack=en requests English captions be auto-enabled.
const VIDEO_IDS = [
  '76979871', // The Scarecrow (Chipotle) — very popular
  '347119375', // TEDx talk
  '253989945', // Popular staff pick
];

// Selector for Vimeo subtitle text (CSS injection targets .vp-captions)
const SUB_SEL = '.vp-captions';
const SUB_BG_SEL = '.vp-captions > span';

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser({ freshProfile: true });

  try {
    // Try video IDs until one loads successfully
    let page = null;
    let videoUrl = null;
    let consoleLogs = [];

    for (const videoId of VIDEO_IDS) {
      const url = `https://player.vimeo.com/video/${videoId}?texttrack=en&autoplay=1`;
      console.log(`\nTrying video: ${url}`);

      const testPage = await browser.newPage();
      const logs = [];
      testPage.on('console', (msg) => logs.push(msg.text()));

      try {
        await testPage.goto(url, { waitUntil: 'networkidle2', timeout: 20_000 });
        await sleep(3000);

        // Check if video player loaded
        const hasPlayer = await testPage.evaluate(() => {
          const v = document.querySelector('video');
          const player = document.querySelector('.player');
          return !!(v || player);
        });

        if (hasPlayer) {
          page = testPage;
          videoUrl = url;
          consoleLogs = logs;
          console.log(`  ✓ Video loaded: ${videoId}`);
          break;
        } else {
          console.log(`  ✗ No player found for ${videoId}`);
          await testPage.close();
        }
      } catch (e) {
        console.log(`  ✗ Failed to load ${videoId}: ${e.message}`);
        await testPage.close();
      }
    }

    if (!page) {
      console.log('\n⚠️  No Vimeo video could be loaded. Skipping all tests.');
      process.exit(0);
    }

    // ── Extension ID ─────────────────────────────────────────────────────
    console.log('\n🔧  Extension loading on Vimeo');

    const extId = await getExtensionId(browser, 10_000);
    if (extId) {
      assert(true, 'Extension ID found');
    } else {
      console.log('  ⚠️  Extension ID not found — cannot run tests');
      process.exit(1);
    }

    // ── Platform detection ───────────────────────────────────────────────
    console.log('\n📺  Vimeo platform detection');

    const initLogs = consoleLogs.filter((l) => l.includes('CSS-STYL'));
    assert(
      initLogs.some((l) => l.includes('Bridge script initialized')),
      'Bridge initialises',
    );
    assert(
      initLogs.some((l) => l.includes('Detected platform: vimeo')),
      'Platform detected as vimeo',
    );
    assert(
      initLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() runs on init',
    );

    // ── Page state ───────────────────────────────────────────────────────
    console.log('\n🌐  Vimeo page state');

    const pageState = await page.evaluate(() => ({
      hostname: location.hostname,
      hasVideo: !!document.querySelector('video'),
      hasCaptionsContainer: !!document.querySelector('.vp-captions'),
    }));
    assert(
      pageState.hostname === 'player.vimeo.com',
      'Hostname is player.vimeo.com',
      pageState.hostname,
    );
    assert(pageState.hasVideo, 'Video element present');

    // ── Enable captions ──────────────────────────────────────────────────
    console.log('\n💬  Enabling captions');

    // Ensure video is playing
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v?.paused) v.play().catch(() => {});
    });
    await sleep(2000);

    // Try to click CC button if captions aren't already on
    await page.evaluate(() => {
      // Look for CC button in Vimeo player
      const ccBtn =
        document.querySelector('[data-cc-button]') ||
        document.querySelector('button[aria-label*="aption"]') ||
        document.querySelector('button[aria-label*="ubtitle"]') ||
        document.querySelector('.cc-button');
      if (ccBtn) ccBtn.click();

      // Also try enabling text tracks directly
      const v = document.querySelector('video');
      if (v?.textTracks) {
        for (const t of v.textTracks) {
          if (t.kind === 'subtitles' || t.kind === 'captions') t.mode = 'showing';
        }
      }
    });
    await sleep(3000);

    // Wait for captions container to appear
    let hasCaptions = false;
    let captionText = '';
    for (let i = 0; i < 20; i++) {
      const result = await page.evaluate(() => {
        const container = document.querySelector('.vp-captions');
        return {
          exists: !!container,
          text: container?.innerText?.trim() || '',
          visible:
            container && getComputedStyle(container).display !== 'none' && container.offsetHeight > 0,
        };
      });
      if (result.exists) {
        hasCaptions = true;
        captionText = result.text;
        if (captionText.length > 0) break;
      }
      await sleep(1000);
    }

    assert(hasCaptions, 'Captions container (.vp-captions) exists');

    if (!hasCaptions) {
      // Skip visual tests but still test popup
      console.log('  ⚠️  No captions container — skipping style tests');
      skip('Caption text visible', 'no captions container');
      skip('Font color change', 'no captions container');
      skip('Font family change', 'no captions container');
      skip('Font size change', 'no captions container');
      skip('Background color change', 'no captions container');
      skip('Edge style change', 'no captions container');
      skip('Combined settings', 'no captions container');
      skip('Reset', 'no captions container');
    } else {
      // Caption text might be empty if video hasn't reached a caption cue yet
      if (captionText.length > 0) {
        assert(true, 'Caption text visible', captionText.substring(0, 40));
      } else {
        skip('Caption text visible', 'container exists but no text yet (video timing)');
      }

      // ── Baseline styles ──────────────────────────────────────────────
      console.log('\n🎨  Baseline styles');

      const baseline = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          fontFamily: cs.fontFamily?.substring(0, 60),
          fontSize: cs.fontSize,
        };
      }, SUB_SEL);

      if (baseline) {
        assert(
          baseline.color === 'rgb(255, 255, 255)',
          'Default color is white',
          baseline.color,
        );
      }

      // ── Live font color ──────────────────────────────────────────────
      console.log('\n🟡  Live font color');

      consoleLogs.length = 0;
      await setStorage(browser, extId, { fontColor: 'yellow' });

      const color1 = await waitForStyle(
        page,
        SUB_SEL,
        'color',
        (v) => v === 'rgb(255, 255, 0)',
      );
      assert(color1 === 'rgb(255, 255, 0)', 'Font color changes to yellow', color1);

      const logs1 = consoleLogs.filter((l) => l.includes('CSS-STYL'));
      assert(
        logs1.some((l) => l.includes('app.applyStyles() called')),
        'applyStyles() re-fires after fontColor change',
      );

      // ── Live font family ─────────────────────────────────────────────
      console.log('\n🔤  Live font family');

      await setStorage(browser, extId, { fontFamily: 'monospaced-serif' });

      const font1 = await waitForStyle(
        page,
        SUB_SEL,
        'fontFamily',
        (v) => v != null && (v.includes('Courier') || v.includes('monospace')),
      );
      assert(
        font1 && (font1.includes('Courier') || font1.includes('monospace')),
        'Font family changes to monospace serif',
        font1,
      );

      // ── Live font size ───────────────────────────────────────────────
      console.log('\n📏  Live font size');

      const beforeSize = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).fontSize : null;
      }, SUB_SEL);
      const baseSize = parseFloat(beforeSize || '20');

      const logsBeforeSize = consoleLogs.length;
      await setStorage(browser, extId, { fontSize: '200%' });
      await sleep(3000);

      const sizeLogs = consoleLogs.slice(logsBeforeSize).filter((l) => l.includes('CSS-STYL'));
      assert(
        sizeLogs.some((l) => l.includes('app.applyStyles() called')),
        'applyStyles() fires for fontSize change',
      );

      // ── Live background color ────────────────────────────────────────
      console.log('\n🟦  Live background color');

      await setStorage(browser, extId, { backgroundColor: 'blue' });

      const bgColor = await waitForStyle(
        page,
        SUB_BG_SEL,
        'backgroundColor',
        (v) => v != null && v.includes('0, 0, 255'),
      );
      assert(
        bgColor && bgColor.includes('0, 0, 255'),
        'Background changes to blue',
        bgColor,
      );

      // ── Live edge style ──────────────────────────────────────────────
      console.log('\n🔲  Live edge style');

      await setStorage(browser, extId, { characterEdgeStyle: 'dropshadow' });

      const shadow = await waitForStyle(
        page,
        SUB_SEL,
        'textShadow',
        (v) => v != null && v !== 'none',
      );
      assert(
        shadow && shadow !== 'none',
        'Text shadow applied for dropshadow edge',
        shadow?.substring(0, 60),
      );

      // ── Combined settings ────────────────────────────────────────────
      console.log('\n🎯  Combined settings');

      await setStorage(browser, extId, {
        fontColor: 'cyan',
        fontFamily: 'cursive',
        characterEdgeStyle: 'raised',
      });

      await waitForStyle(page, SUB_SEL, 'color', (v) => v === 'rgb(0, 255, 255)');

      const combined = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          fontFamily: cs.fontFamily?.substring(0, 60),
          textShadow: cs.textShadow?.substring(0, 60),
        };
      }, SUB_SEL);
      assert(combined?.color === 'rgb(0, 255, 255)', 'Combined: cyan color', combined?.color);
      assert(
        combined?.fontFamily?.toLowerCase().includes('cursive') ||
          combined?.fontFamily?.includes('Corsiva') ||
          combined?.fontFamily?.includes('Chancery'),
        'Combined: cursive font family',
        combined?.fontFamily,
      );
      assert(
        combined?.textShadow && combined.textShadow !== 'none',
        'Combined: raised edge style',
        combined?.textShadow,
      );

      // ── Reset ────────────────────────────────────────────────────────
      console.log('\n🔄  Reset to auto');

      const logsBeforeReset = consoleLogs.length;
      await resetStorage(browser, extId);
      await sleep(3000);

      const resetLogs = consoleLogs
        .slice(logsBeforeReset)
        .filter((l) => l.includes('app.applyStyles() called'));
      assert(resetLogs.length > 0, 'applyStyles() fires on reset');
    }

    // ── Popup loads ──────────────────────────────────────────────────────
    if (extId) {
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
    }
  } finally {
    await browser.close();
  }

  const result = summary('Vimeo');
  process.exit(result.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
