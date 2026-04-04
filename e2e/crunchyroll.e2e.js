/**
 * E2E tests for Consistent Subtitle Style — Crunchyroll platform (DOM-mock).
 *
 * Crunchyroll removed its free tier in Dec 2024, so we navigate to
 * crunchyroll.com (landing page) and inject mock subtitle elements
 * replicating the Bitmovin player structure:
 *
 *   <div class="bmpui-ui-subtitle-overlay">
 *     <span class="bmpui-ui-subtitle-label">Mock subtitle</span>
 *   </div>
 *
 * Run:
 *   DISPLAY=:99 bun e2e/crunchyroll.e2e.js
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

// Crunchyroll subtitle selectors (from src/platforms/crunchyroll.ts)
const SUB_SEL = '.bmpui-ui-subtitle-label';
const BG_SEL = '.bmpui-ui-subtitle-label';
const WINDOW_SEL = '.bmpui-ui-subtitle-overlay';

// Crunchyroll landing page
const CRUNCHYROLL_URL = 'https://www.crunchyroll.com';

/**
 * Inject mock Crunchyroll Bitmovin player subtitle elements.
 */
async function injectMockSubtitles(page) {
  await page.evaluate(() => {
    document.querySelector('#css-e2e-mock-crunchyroll')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'css-e2e-mock-crunchyroll';
    overlay.className = 'bmpui-ui-subtitle-overlay';
    overlay.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;';

    const label1 = document.createElement('span');
    label1.className = 'bmpui-ui-subtitle-label';
    label1.textContent = 'Mock Crunchyroll subtitle line one';

    const label2 = document.createElement('span');
    label2.className = 'bmpui-ui-subtitle-label';
    label2.textContent = 'Mock Crunchyroll subtitle line two';

    overlay.appendChild(label1);
    overlay.appendChild(label2);
    document.body.appendChild(overlay);
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
      summary('Crunchyroll');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Load Crunchyroll page ─────────────────────────────────
    console.log('\n── Loading Crunchyroll ──');
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    let loaded = false;
    try {
      const resp = await page.goto(CRUNCHYROLL_URL, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });
      const status = resp?.status() ?? 0;
      const finalUrl = page.url();
      const title = await page.title();
      console.log(`  Status: ${status}, URL: ${finalUrl}`);
      console.log(`  Title: "${title}"`);

      if (status >= 200 && status < 400) {
        loaded = true;
      }
    } catch (e) {
      console.log(`  Navigation error: ${e.message}`);
      const url = page.url();
      if (url.includes('crunchyroll.com')) {
        loaded = true;
        console.log('  Page partially loaded, continuing...');
      }
    }

    assert(loaded, 'Crunchyroll page loaded');

    await sleep(3000);

    const extLogs = consoleLogs.filter(
      (l) => l.includes('[CSS-STYL]') || l.includes('Consistent Subtitle'),
    );
    const detected = extLogs.some((l) => l.includes('Detected platform: crunchyroll'));
    assert(detected, 'Platform detected as crunchyroll');

    if (extLogs.length > 0) {
      console.log(`  Extension logs: ${extLogs.length} entries`);
      extLogs.slice(0, 5).forEach((l) => console.log(`    ${l}`));
    }

    // ── Phase 2: Inject mock subtitle elements ─────────────────────────
    console.log('\n── Injecting mock subtitle elements ──');
    await injectMockSubtitles(page);

    const mockCheck = await page.evaluate(() => ({
      hasOverlay: !!document.querySelector('.bmpui-ui-subtitle-overlay'),
      hasLabel: !!document.querySelector('.bmpui-ui-subtitle-label'),
      labelCount: document.querySelectorAll('.bmpui-ui-subtitle-label').length,
    }));
    assert(
      mockCheck.hasOverlay && mockCheck.hasLabel,
      'Mock subtitle elements injected',
      `labels: ${mockCheck.labelCount}`,
    );

    // ── Phase 3: Test CSS style injection ──────────────────────────────

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
    assert(color === 'rgb(255, 255, 0)', 'Font color → yellow', `got: ${color}`);

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

    // Background color → green (same selector as subtitle for Crunchyroll)
    console.log('\n── Background color → green ──');
    await setStorage(browser, extId, { backgroundColor: 'green' });

    const bgColor = await waitForStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent',
      { timeoutMs: 10_000 },
    );
    assert(
      bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent',
      'Background color applied on label',
      `got: ${bgColor}`,
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
    assert(shadow && shadow !== 'none', 'Text shadow → dropshadow', `got: ${shadow?.substring(0, 60)}`);

    // Window color → red (on .bmpui-ui-subtitle-overlay)
    console.log('\n── Window color → red ──');
    await setStorage(browser, extId, { windowColor: 'red' });

    const windowColor = await waitForStyle(
      page,
      WINDOW_SEL,
      'backgroundColor',
      (v) => v && v.includes('255, 0, 0'),
      { timeoutMs: 10_000 },
    );
    assert(
      windowColor && windowColor.includes('255, 0, 0'),
      'Window color → red on overlay',
      `got: ${windowColor}`,
    );

    // Font opacity → 50%
    console.log('\n── Font opacity → 50% ──');
    await setStorage(browser, extId, { fontColor: 'white', fontOpacity: '50' });

    const fontOpacity = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v != null && v.includes('0.5'),
      { timeoutMs: 10_000 },
    );
    assert(
      fontOpacity && fontOpacity.includes('0.5'),
      'Font opacity 50% produces semi-transparent color',
      `got: ${fontOpacity}`,
    );

    // Combined settings
    console.log('\n── Combined settings ──');
    await resetStorage(browser, extId);
    await sleep(1000);
    await setStorage(browser, extId, {
      fontColor: 'green',
      fontFamily: 'proportional-serif',
      characterEdgeStyle: 'depressed',
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
      combined?.color === 'rgb(0, 255, 0)',
      'Combined: green color',
      `got: ${combined?.color}`,
    );
    assert(
      combined?.fontFamily &&
        (combined.fontFamily.includes('Times') ||
          combined.fontFamily.includes('serif') ||
          combined.fontFamily.includes('Georgia')),
      'Combined: proportional-serif font',
      `got: ${combined?.fontFamily}`,
    );
    assert(
      combined?.textShadow && combined.textShadow !== 'none',
      'Combined: depressed edge',
      `got: ${combined?.textShadow}`,
    );

    // Reset
    console.log('\n── Reset to defaults ──');
    await resetStorage(browser, extId);
    await sleep(2000);

    const afterReset = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).color : null;
    }, SUB_SEL);
    assert(afterReset !== 'rgb(0, 128, 0)', 'Reset reverted font color', `got: ${afterReset}`);

    // Popup UI
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

    const { failed } = summary('Crunchyroll');
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
