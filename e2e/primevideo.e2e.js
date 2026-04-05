/**
 * E2E tests for Consistent Subtitle Style — Prime Video platform (DOM-mock).
 *
 * Prime Video requires an Amazon account, so we navigate to amazon.com/gp/video
 * (landing page) and inject mock subtitle elements replicating the ATVWebPlayer
 * SDK structure:
 *
 *   <div class="atvwebplayersdk-captions-overlay">
 *     <div class="atvwebplayersdk-captions-region">
 *       <span class="atvwebplayersdk-captions-text">Mock subtitle</span>
 *     </div>
 *   </div>
 *
 * Run:
 *   DISPLAY=:99 bun e2e/primevideo.e2e.js
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

// Prime Video subtitle selectors (from src/platforms/primevideo.ts)
const SUB_SEL = '.atvwebplayersdk-captions-text';
const BG_SEL = '.atvwebplayersdk-captions-region';
const WINDOW_SEL = '.atvwebplayersdk-captions-overlay';

// Prime Video landing page — redirects may occur but domain is matched
const PRIMEVIDEO_URL = 'https://www.amazon.com/gp/video/offers';

/**
 * Inject mock Prime Video subtitle elements.
 */
async function injectMockSubtitles(page) {
  await page.evaluate(() => {
    document.querySelector('#css-e2e-mock-primevideo')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'css-e2e-mock-primevideo';
    overlay.className = 'atvwebplayersdk-captions-overlay';
    overlay.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;';

    const region = document.createElement('div');
    region.className = 'atvwebplayersdk-captions-region';

    const text = document.createElement('span');
    text.className = 'atvwebplayersdk-captions-text';
    text.textContent = 'Mock Prime Video subtitle for CSS injection test';

    region.appendChild(text);
    overlay.appendChild(region);
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
      summary('Prime Video');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Load Prime Video page ─────────────────────────────────
    console.log('\n── Loading Prime Video ──');
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    let loaded = false;
    try {
      const resp = await page.goto(PRIMEVIDEO_URL, {
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
      if (url.includes('amazon.com') || url.includes('primevideo.com')) {
        loaded = true;
        console.log('  Page partially loaded, continuing...');
      }
    }

    assert(loaded, 'Prime Video page loaded');

    await sleep(3000);

    const extLogs = consoleLogs.filter(
      (l) => l.includes('[CSS-STYL]') || l.includes('Consistent Subtitle'),
    );
    const detected = extLogs.some((l) => l.includes('Detected platform: primevideo'));
    assert(detected, 'Platform detected as primevideo');

    if (extLogs.length > 0) {
      console.log(`  Extension logs: ${extLogs.length} entries`);
      extLogs.slice(0, 5).forEach((l) => console.log(`    ${l}`));
    }

    // ── Phase 2: Inject mock subtitle elements ─────────────────────────
    console.log('\n── Injecting mock subtitle elements ──');
    await injectMockSubtitles(page);

    const mockCheck = await page.evaluate(() => ({
      hasOverlay: !!document.querySelector('.atvwebplayersdk-captions-overlay'),
      hasRegion: !!document.querySelector('.atvwebplayersdk-captions-region'),
      hasText: !!document.querySelector('.atvwebplayersdk-captions-text'),
    }));
    assert(
      mockCheck.hasOverlay && mockCheck.hasRegion && mockCheck.hasText,
      'Mock subtitle elements injected',
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

    // Background color → blue (on .atvwebplayersdk-captions-region)
    console.log('\n── Background color → blue ──');
    await setStorage(browser, extId, { backgroundColor: 'blue' });

    const bgColor = await waitForStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v && v.includes('0, 0, 255'),
      { timeoutMs: 10_000 },
    );
    assert(
      bgColor && bgColor.includes('0, 0, 255'),
      'Background color → blue on region',
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

    // Window color → red (on .atvwebplayersdk-captions-overlay)
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
    await setStorage(browser, extId, { fontColor: 'cyan', fontOpacity: '50' });

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

    // Background opacity → 75%
    console.log('\n── Background opacity → 75% ──');
    await setStorage(browser, extId, { backgroundColor: 'white', backgroundOpacity: '75' });

    const bgOpacity = await waitForStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v != null && v.includes('0.75'),
      { timeoutMs: 10_000 },
    );
    assert(
      bgOpacity && bgOpacity.includes('0.75'),
      'Background opacity 75% produces semi-transparent background',
      `got: ${bgOpacity}`,
    );

    // Window opacity → 50%
    console.log('\n── Window opacity → 50% ──');
    await setStorage(browser, extId, { windowColor: 'green', windowOpacity: '50' });

    const windowOpacity = await waitForStyle(
      page,
      WINDOW_SEL,
      'backgroundColor',
      (v) => v != null && v.includes('0.5'),
      { timeoutMs: 10_000 },
    );
    assert(
      windowOpacity && windowOpacity.includes('0.5'),
      'Window opacity 50% produces semi-transparent window',
      `got: ${windowOpacity}`,
    );

    // Combined settings
    console.log('\n── Combined settings ──');
    await resetStorage(browser, extId);
    await sleep(1000);
    await setStorage(browser, extId, {
      fontColor: 'magenta',
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
      combined?.color === 'rgb(255, 0, 255)',
      'Combined: magenta color',
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

    // Reset
    console.log('\n── Reset to defaults ──');
    await resetStorage(browser, extId);
    await sleep(2000);

    const afterReset = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).color : null;
    }, SUB_SEL);
    assert(afterReset !== 'rgb(255, 0, 255)', 'Reset reverted font color', `got: ${afterReset}`);

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

    const { failed } = summary('Prime Video');
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
