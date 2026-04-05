/**
 * E2E tests for Consistent Subtitle Style — Max (HBO Max) platform.
 *
 * Uses free content at hbomax.com/collections/watch-free.
 * Free trailers don't have real subtitles, so we inject mock subtitle
 * elements matching Max's DOM structure to test the CSS injection pipeline:
 *   platform detection → selector matching → CSS generation → style application
 *
 * Run:
 *   DISPLAY=:99 bun e2e/max.e2e.js
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

// Max subtitle selectors (from src/platforms/max.ts)
const SUB_SEL = '[class^="TextCue"]';
const BG_SEL = '[data-testid="CueBoxContainer"]';
const WINDOW_SEL = '[class^="CaptionWindow"]';

// Free content — no login required
const FREE_COLLECTION_URL = 'https://www.hbomax.com/collections/watch-free';
const FALLBACK_VIDEO_URLS = [
  'https://www.hbomax.com/a/video/f4p3mfhvjl',
  'https://www.hbomax.com/a/video/7gcy5b25kx',
  'https://www.hbomax.com/a/video/d7qc12wmld',
];

async function injectMockSubtitles(page) {
  await page.evaluate(() => {
    // Remove any previous mock elements
    document.querySelector('#css-e2e-mock-subs')?.remove();

    const container = document.createElement('div');
    container.id = 'css-e2e-mock-subs';
    container.className = 'CaptionWindow__MockTest';
    container.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;';

    const cueBox = document.createElement('div');
    cueBox.setAttribute('data-testid', 'CueBoxContainer');

    const textCue = document.createElement('span');
    textCue.className = 'TextCue__MockTest';
    textCue.textContent = 'Mock subtitle for CSS injection test';
    // No inline color/font styles — let the extension's CSS !important rules control these

    cueBox.appendChild(textCue);
    container.appendChild(cueBox);
    document.body.appendChild(container);
  });
  await sleep(1500);
}

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser({ freshProfile: true });

  try {
    // ── Phase 0: Extension init ────────────────────────────────────────
    const extId = await getExtensionId(browser);
    assert(!!extId, 'Extension loaded', extId ? `ID: ${extId}` : 'not found');
    if (!extId) {
      summary('Max');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Load Max/HBO page ─────────────────────────────────────
    console.log('\n── Loading HBO Max free collection ──');
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    let loaded = false;
    let videoPageUrl = null;

    // Try the free collection page first
    try {
      const resp = await page.goto(FREE_COLLECTION_URL, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });
      const status = resp?.status() ?? 0;
      const title = await page.title();
      console.log(`  Status: ${status}, Title: "${title}"`);

      if (status >= 200 && status < 400) {
        loaded = true;
        await sleep(2000);

        // Dismiss cookie consent
        await page.evaluate(() => {
          for (const btn of document.querySelectorAll('button')) {
            const t = btn.textContent?.trim().toLowerCase() || '';
            if (['accept', 'accept all', 'agree', 'ok'].includes(t) || t.includes('accept all cookies')) {
              btn.click();
              return;
            }
          }
        });
        await sleep(500);

        // Find video links
        const episodeUrls = await page.evaluate(() => {
          const out = [];
          for (const a of document.querySelectorAll('a[href]')) {
            const h = a.href;
            if (
              (h.includes('/a/video/') || h.includes('/video/watch/') || h.includes('/episode/')) &&
              !out.includes(h)
            )
              out.push(h);
          }
          return out.slice(0, 5);
        });

        console.log(`  Found ${episodeUrls.length} video links`);

        // Navigate to first video to get Max player page
        const tryUrls = episodeUrls.length > 0 ? episodeUrls : FALLBACK_VIDEO_URLS;
        for (const url of tryUrls) {
          console.log(`  Trying: ${url}`);
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 25_000 });
            videoPageUrl = page.url();
            console.log(`  ✓ Navigated to video page`);
            break;
          } catch (e) {
            console.log(`  ✗ ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.log(`  Collection page error: ${e.message}`);
    }

    // Fallback: go directly to a known video URL
    if (!videoPageUrl) {
      console.log('  Using fallback video URL');
      try {
        await page.goto(FALLBACK_VIDEO_URLS[0], { waitUntil: 'networkidle2', timeout: 25_000 });
        videoPageUrl = page.url();
        loaded = true;
      } catch (e) {
        console.log(`  Fallback failed: ${e.message}`);
      }
    }

    assert(loaded, 'Max/HBO page loaded');

    // Wait for extension content script to load
    await sleep(3000);

    // Check platform detection
    const extLogs = consoleLogs.filter(
      (l) => l.includes('[CSS-STYL]') || l.includes('Consistent Subtitle'),
    );
    const detected = extLogs.some((l) => l.includes('Detected platform: max'));
    assert(detected, 'Platform detected as max');

    if (extLogs.length > 0) {
      console.log(`  Extension logs: ${extLogs.length} entries`);
      extLogs.slice(0, 3).forEach((l) => console.log(`    ${l}`));
    }

    // ── Phase 2: Inject mock subtitle elements ─────────────────────────
    console.log('\n── Injecting mock subtitle elements ──');
    await injectMockSubtitles(page);

    const mockCheck = await page.evaluate(() => ({
      hasTextCue: !!document.querySelector('[class^="TextCue"]'),
      hasCueBox: !!document.querySelector('[data-testid="CueBoxContainer"]'),
      hasWindow: !!document.querySelector('[class^="CaptionWindow"]'),
    }));
    assert(
      mockCheck.hasTextCue && mockCheck.hasCueBox && mockCheck.hasWindow,
      'Mock subtitle elements injected',
      JSON.stringify(mockCheck),
    );

    // ── Phase 3: Test CSS style injection ──────────────────────────────
    // Use named values that match popup dropdown data-value attributes

    // Font color → yellow
    console.log('\n── Font color → yellow ──');
    await setStorage(browser, extId, { fontColor: 'yellow' });

    const color = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('255') && v.includes('255') && v.includes('0'),
      { timeoutMs: 10_000 },
    );
    assert(
      color === 'rgb(255, 255, 0)',
      'Font color → yellow',
      `got: ${color}`,
    );

    // Font family → casual
    console.log('\n── Font family → casual ──');
    await setStorage(browser, extId, { fontFamily: 'casual' });

    const font = await waitForStyle(
      page,
      SUB_SEL,
      'fontFamily',
      (v) =>
        v &&
        (v.toLowerCase().includes('comic') ||
          v.toLowerCase().includes('casual') ||
          v.toLowerCase().includes('cursive')),
      { timeoutMs: 10_000 },
    );
    assert(
      font &&
        (font.toLowerCase().includes('comic') ||
          font.toLowerCase().includes('casual') ||
          font.toLowerCase().includes('cursive')),
      'Font family → casual',
      `got: ${font}`,
    );

    // Font size → 200%
    console.log('\n── Font size → 200% ──');
    const baseSize = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : 16;
    }, SUB_SEL);

    await setStorage(browser, extId, { fontSize: '200%' });

    const size = await waitForStyle(
      page,
      SUB_SEL,
      'fontSize',
      (v) => v && parseFloat(v) > baseSize,
      { timeoutMs: 10_000 },
    );
    assert(
      size && parseFloat(size) > baseSize,
      'Font size → 200%',
      `base: ${baseSize}px, got: ${size}`,
    );

    // Background color → green
    // The CSS maps 'green' → '#0f0' (rgb(0, 255, 0)), applied to background selector
    console.log('\n── Background color → green ──');
    await setStorage(browser, extId, { backgroundColor: 'green' });
    await sleep(2000); // Extra wait for CSS regeneration on non-subtitle element

    let bgResult = await waitForStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v && v.includes('0, 255, 0'),
      { timeoutMs: 10_000 },
    );
    if (!bgResult || !bgResult.includes('0, 255, 0')) {
      // Fallback: check window element
      bgResult = await waitForStyle(
        page,
        WINDOW_SEL,
        'backgroundColor',
        (v) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent',
        { timeoutMs: 5_000 },
      );
    }
    if (!bgResult || !bgResult.includes('0, 255, 0')) {
      // Last resort: check TextCue background
      bgResult = await waitForStyle(
        page,
        SUB_SEL,
        'backgroundColor',
        (v) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent',
        { timeoutMs: 3_000 },
      );
    }
    assert(
      bgResult && bgResult !== 'rgba(0, 0, 0, 0)' && bgResult !== 'transparent',
      'Background color applied',
      `got: ${bgResult}`,
    );

    // Character edge → dropshadow
    console.log('\n── Character edge → dropshadow ──');
    await setStorage(browser, extId, { characterEdgeStyle: 'dropshadow' });

    const shadow = await waitForStyle(
      page,
      SUB_SEL,
      'textShadow',
      (v) => v && v !== 'none',
      { timeoutMs: 10_000 },
    );
    assert(
      shadow && shadow !== 'none',
      'Text shadow → dropshadow',
      `got: ${shadow?.substring(0, 60)}`,
    );

    // Font opacity → 50% with yellow color
    console.log('\n── Font opacity 50% (color-mix) ──');
    await setStorage(browser, extId, { fontColor: 'yellow', fontOpacity: '50' });

    const fontOpacity = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('0.5'),
      { timeoutMs: 10_000 },
    );
    assert(
      fontOpacity && fontOpacity.includes('0.5'),
      'Font color+opacity produces semi-transparent color',
      `got: ${fontOpacity}`,
    );
    const isFontYellow = fontOpacity && (
      (fontOpacity.includes('255') && fontOpacity.includes('255, 0')) ||
      fontOpacity.includes('srgb 1 1 0')
    );
    assert(isFontYellow, 'Font opacity preserves yellow hue', `got: ${fontOpacity}`);

    // Background opacity → 75% with blue color
    console.log('\n── Background opacity 75% (color-mix) ──');
    await setStorage(browser, extId, { backgroundColor: 'blue', backgroundOpacity: '75' });

    let bgOpacity = await waitForStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v && v.includes('0.75'),
      { timeoutMs: 10_000 },
    );
    if (!bgOpacity || !bgOpacity.includes('0.75')) {
      // Fallback: check window or subtitle element
      bgOpacity = await waitForStyle(
        page,
        WINDOW_SEL,
        'backgroundColor',
        (v) => v && v.includes('0.75'),
        { timeoutMs: 5_000 },
      );
    }
    assert(
      bgOpacity && bgOpacity.includes('0.75'),
      'Background color+opacity produces 75% alpha',
      `got: ${bgOpacity}`,
    );

    // Window opacity → 50% with green color
    console.log('\n── Window opacity 50% (color-mix) ──');
    await setStorage(browser, extId, { backgroundColor: 'auto', backgroundOpacity: 'auto' });
    await sleep(1000);
    await setStorage(browser, extId, { windowColor: 'green', windowOpacity: '50' });

    const windowOpacity = await waitForStyle(
      page,
      WINDOW_SEL,
      'backgroundColor',
      (v) => v && v.includes('0.5'),
      { timeoutMs: 10_000 },
    );
    assert(
      windowOpacity && windowOpacity.includes('0.5'),
      'Window color+opacity produces 50% alpha',
      `got: ${windowOpacity}`,
    );

    // Reset before combined test
    await resetStorage(browser, extId);
    await sleep(1000);

    // Combined settings
    console.log('\n── Combined settings ──');
    await setStorage(browser, extId, {
      fontColor: 'cyan',
      fontFamily: 'monospaced-serif',
      characterEdgeStyle: 'outline',
    });

    await sleep(3000);

    const combined = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        fontFamily: cs.fontFamily?.substring(0, 80),
        textShadow: cs.textShadow?.substring(0, 60),
      };
    }, SUB_SEL);

    assert(
      combined?.color === 'rgb(0, 255, 255)',
      'Combined: cyan color',
      `got: ${combined?.color}`,
    );
    assert(
      combined?.fontFamily &&
        (combined.fontFamily.includes('Courier') || combined.fontFamily.includes('monospace')),
      'Combined: monospaced-serif font',
      `got: ${combined?.fontFamily}`,
    );
    assert(
      combined?.textShadow && combined.textShadow !== 'none',
      'Combined: outline edge',
      `got: ${combined?.textShadow}`,
    );

    // Reset to defaults
    console.log('\n── Reset to defaults ──');
    await resetStorage(browser, extId);
    await sleep(2000);

    const afterReset = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el).color;
    }, SUB_SEL);

    assert(
      afterReset !== 'rgb(0, 255, 255)',
      'Reset reverted font color',
      `got: ${afterReset}`,
    );

    // ── Phase 4: Popup UI test ─────────────────────────────────────────
    console.log('\n── Popup UI ──');
    const popupPage = await browser.newPage();
    try {
      await popupPage.goto(`chrome-extension://${extId}/index.html`, {
        waitUntil: 'networkidle2',
        timeout: 5_000,
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

      assert(popupInfo.title === 'Subtitle Styles', 'Popup title correct');
      assert(popupInfo.selectCount === 9, 'Popup has 9 dropdowns', String(popupInfo.selectCount));
      assert(popupInfo.hasResetBtn, 'Popup has Reset button');
      assert(popupInfo.hasPreview, 'Popup has preview element');
    } catch (e) {
      assert(false, 'Popup loads', e.message);
    } finally {
      await popupPage.close();
    }

    const { failed } = summary('Max');
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
