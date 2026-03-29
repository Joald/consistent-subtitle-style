/**
 * E2E tests for Consistent Subtitle Style — Nebula platform.
 *
 * Uses Nebula's "first one is on us" free video feature (no login needed)
 * to test the full extension flow: init → captions → live style changes.
 *
 * Settings are changed via the popup page (no SW dependency).
 *
 * Run:
 *   bun e2e/nebula.e2e.js
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

// Selector for Nebula subtitle text
const SUB_SEL = '#video-player [data-subtitles-container] > div > div > div';

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser({ freshProfile: true });

  try {
    const videoUrl = 'https://nebula.tv/videos/tldrnewseu-why-albania-and-kosovo-have-fallen-out';
    console.log(`Using free video: ${videoUrl}`);

    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    // ── Navigate to video page ───────────────────────────────────────────
    console.log('\n🔧  Extension loading on Nebula');
    try {
      await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 20_000 });
    } catch {
      // Nebula can be slow
    }
    await sleep(3000);

    // Get extension ID
    const extId = await getExtensionId(browser, 10_000);
    if (extId) {
      assert(true, 'Extension ID found');
    } else {
      console.log('  ⚠️  Extension ID not found — cannot run tests');
      process.exit(1);
    }

    // ── Platform detection ───────────────────────────────────────────────
    console.log('\n📺  Nebula platform detection');

    const initLogs = consoleLogs.filter((l) => l.includes('CSS-STYL'));
    assert(
      initLogs.some((l) => l.includes('Bridge script initialized')),
      'Bridge initialises',
    );
    assert(
      initLogs.some((l) => l.includes('Detected platform: nebula')),
      'Platform detected as nebula',
    );
    assert(
      initLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() runs on init',
    );

    // ── Page state ───────────────────────────────────────────────────────
    console.log('\n🌐  Nebula page state');

    const pageState = await page.evaluate(() => ({
      hostname: location.hostname,
    }));
    assert(pageState.hostname === 'nebula.tv', 'Hostname is nebula.tv', pageState.hostname);

    // ── Click "Watch video" (free) ───────────────────────────────────────
    console.log('\n▶️  Starting free video');

    let playerLoaded = false;
    const PLAY_SELECTORS = [
      'button[aria-label="Play video"]',
      'button[aria-label="Play this video"]',
    ];

    let playSelector = null;
    for (let i = 0; i < 20 && !playSelector; i++) {
      for (const sel of PLAY_SELECTORS) {
        const el = await page.$(sel);
        if (el) {
          playSelector = sel;
          break;
        }
      }
      if (!playSelector) {
        const found = await page.evaluate(() => {
          for (const b of document.querySelectorAll('button')) {
            const text = (b.textContent || '').toLowerCase();
            if (text.includes('play') && (text.includes('video') || text.includes('watch')))
              return true;
          }
          return false;
        });
        if (found) {
          playSelector = 'text-match';
          break;
        }
        await sleep(500);
      }
    }

    if (playSelector) {
      if (playSelector === 'text-match') {
        await page.evaluate(() => {
          for (const b of document.querySelectorAll('button')) {
            const text = (b.textContent || '').toLowerCase();
            if (text.includes('play') && (text.includes('video') || text.includes('watch'))) {
              b.click();
              return;
            }
          }
        });
      } else {
        await page.click(playSelector);
      }
      for (let attempt = 0; attempt < 3 && !playerLoaded; attempt++) {
        try {
          await page.waitForSelector('#video-player', { timeout: 5_000 });
          playerLoaded = true;
        } catch {
          await sleep(1000);
          playerLoaded = await page.evaluate(() => !!document.querySelector('#video-player'));
        }
      }
    }

    assert(playerLoaded, 'Player loads after clicking "Watch video"');

    if (!playerLoaded) {
      skip('Video element present', 'player did not load');
      skip('Subtitles container present', 'player did not load');
      skip('Subtitle text visible', 'player did not load');
      for (let i = 0; i < 10; i++) skip('Live test', 'player did not load');
    } else {
      try {
        await page.waitForSelector('video', { timeout: 5_000 });
      } catch {
        /* may already exist */
      }
      await sleep(2000);

      const hasVideo = await page.evaluate(() => !!document.querySelector('video'));
      assert(hasVideo, 'Video element present');

      const hasSubs = await page.evaluate(
        () => !!document.querySelector('[data-subtitles-container]'),
      );
      assert(hasSubs, 'Subtitles container present');

      // Enable subtitles
      await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v?.textTracks) {
          for (const t of v.textTracks) {
            if (t.kind === 'subtitles' || t.kind === 'captions') t.mode = 'showing';
          }
        }
      });
      await sleep(3000);

      let subsText = '';
      for (let i = 0; i < 15; i++) {
        subsText = await page.evaluate(
          () => document.querySelector('[data-subtitles-container]')?.textContent?.trim() || '',
        );
        if (subsText) break;
        await sleep(1000);
      }
      assert(!!subsText, 'Subtitle text visible', subsText ? subsText.substring(0, 40) : 'empty');

      // ── Baseline styles ──────────────────────────────────────────────
      console.log('\n🎨  Baseline styles');

      const baseline = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          fontFamily: cs.fontFamily?.substring(0, 60),
          fontWeight: cs.fontWeight,
          fontSize: cs.fontSize,
        };
      }, SUB_SEL);

      if (baseline) {
        assert(baseline.color === 'rgb(255, 255, 255)', 'Default color is white', baseline.color);
        assert(
          baseline.fontWeight === '700',
          'Default font-weight is bold (Nebula baseline CSS)',
          baseline.fontWeight,
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

      // Poll — font-family update can lag behind the storage change,
      // especially when the suite runs sequentially after other platforms.
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
        SUB_SEL,
        'backgroundColor',
        (v) => v != null && v.includes('0, 0, 255'),
      );
      assert(bgColor && bgColor.includes('0, 0, 255'), 'Background changes to blue', bgColor);

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

      // Wait for at least color to settle, then grab all properties together
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

  const result = summary('Nebula');
  process.exit(result.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
