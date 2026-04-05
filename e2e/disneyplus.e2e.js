/**
 * E2E tests for Consistent Subtitle Style — Disney+ platform (DOM-mock).
 *
 * Disney+ requires a subscription, so there's no free content to test against.
 * Instead, we navigate to disneyplus.com (landing/login page) and inject mock
 * subtitle elements that replicate Disney+'s Shadow DOM structure:
 *
 *   <disney-web-player>         ← custom element with open shadow root
 *     #shadow-root (open)
 *       <div class="dss-subtitle-renderer-cue">
 *         <span>Mock subtitle text</span>
 *       </div>
 *
 * This tests the full CSS injection pipeline including Shadow DOM injection:
 *   platform detection → CSS generation → document head injection
 *                                        → shadow root injection
 *
 * Run:
 *   DISPLAY=:99 bun e2e/disneyplus.e2e.js
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

// Disney+ subtitle selectors (from src/platforms/disneyplus.ts)
const SUB_SEL = '.dss-subtitle-renderer-cue > span';
const BG_SEL = '.dss-subtitle-renderer-cue > span';
const WINDOW_SEL = '.dss-subtitle-renderer-cue';
const SHADOW_HOST = 'disney-web-player';

// Disney+ landing page — no login required, just a signup/login page
const DISNEY_URL = 'https://www.disneyplus.com';

/**
 * Helper to get a computed style from an element inside the shadow root.
 * Regular document.querySelector won't penetrate shadow boundaries.
 */
async function getShadowStyle(page, selector, cssProp) {
  return page.evaluate(
    (hostTag, sel, prop) => {
      const host = document.querySelector(hostTag);
      if (!host?.shadowRoot) return null;
      const el = host.shadowRoot.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el)[prop] ?? null;
    },
    SHADOW_HOST,
    selector,
    cssProp,
  );
}

/**
 * Helper to get a computed style from an element in either shadow root or document.
 * Checks shadow root first (where Disney+ renders), falls back to document.
 */
async function getStyle(page, selector, cssProp) {
  // Try shadow root first
  const shadowVal = await getShadowStyle(page, selector, cssProp);
  if (shadowVal != null) return shadowVal;
  // Fallback: document-level (the extension also injects CSS into document head)
  return page.evaluate(
    (sel, prop) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el)[prop] ?? null;
    },
    selector,
    cssProp,
  );
}

/**
 * Poll a computed CSS property inside shadow root until predicate is met.
 */
async function waitForShadowStyle(page, selector, cssProp, predicate, opts = {}) {
  const { timeoutMs = 10_000, intervalMs = 500 } = opts;
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;

  while (Date.now() < deadline) {
    lastValue = await getStyle(page, selector, cssProp);
    if (predicate(lastValue)) return lastValue;
    await sleep(intervalMs);
  }
  return lastValue;
}

/**
 * Inject mock Disney+ subtitle elements with a Shadow DOM structure.
 * Creates a <disney-web-player> custom element with an open shadow root
 * containing the subtitle cue structure Disney+ uses.
 */
async function injectMockSubtitles(page) {
  await page.evaluate((hostTag) => {
    // Remove previous mock if it exists
    document.querySelector(hostTag)?.remove();

    // Define custom element if not already defined
    if (!customElements.get(hostTag)) {
      customElements.define(
        hostTag,
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }
        },
      );
    }

    // Create the custom element
    const player = document.createElement(hostTag);
    player.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;display:block;';

    // Build subtitle structure inside shadow root
    const dssRenderer = document.createElement('div');
    dssRenderer.className = 'dss-subtitle-renderer-cue';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'Mock Disney+ subtitle for CSS injection test';
    textSpan.id = 'mock-disney-sub-text';

    dssRenderer.appendChild(textSpan);
    player.shadowRoot.appendChild(dssRenderer);

    // Also add a hive-renderer variant for testing alternative selectors
    const hiveRenderer = document.createElement('div');
    hiveRenderer.className = 'hive-subtitle-renderer-cue';

    const hiveSpan = document.createElement('span');
    hiveSpan.textContent = 'Alternative renderer subtitle';
    hiveSpan.id = 'mock-disney-hive-text';

    hiveRenderer.appendChild(hiveSpan);
    player.shadowRoot.appendChild(hiveRenderer);

    document.body.appendChild(player);
  }, SHADOW_HOST);

  // Wait for the extension's MutationObserver to detect the new element
  await sleep(3000);
}

/**
 * Verify that mock elements exist in the shadow root.
 */
async function verifyMockElements(page) {
  return page.evaluate((hostTag) => {
    const host = document.querySelector(hostTag);
    if (!host) return { host: false, shadow: false, dss: false, hive: false };
    const shadow = !!host.shadowRoot;
    const dss = shadow ? !!host.shadowRoot.querySelector('.dss-subtitle-renderer-cue') : false;
    const hive = shadow ? !!host.shadowRoot.querySelector('.hive-subtitle-renderer-cue') : false;
    const styleInjected = shadow
      ? !!host.shadowRoot.querySelector('#subtitle-styler-shadow-styles')
      : false;
    return { host: true, shadow, dss, hive, styleInjected };
  }, SHADOW_HOST);
}

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser({ freshProfile: true });

  try {
    // ── Phase 0: Extension init ────────────────────────────────────────
    const extId = await getExtensionId(browser);
    assert(!!extId, 'Extension loaded', extId ? `ID: ${extId}` : 'not found');
    if (!extId) {
      summary('Disney+');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Load Disney+ page ─────────────────────────────────────
    console.log('\n── Loading Disney+ ──');
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    let loaded = false;
    try {
      const resp = await page.goto(DISNEY_URL, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });
      const status = resp?.status() ?? 0;
      const finalUrl = page.url();
      const title = await page.title();
      console.log(`  Status: ${status}, URL: ${finalUrl}`);
      console.log(`  Title: "${title}"`);

      // Accept: any page on disneyplus.com domain (may redirect to login)
      if (status >= 200 && status < 400) {
        loaded = true;
      }
    } catch (e) {
      console.log(`  Navigation error: ${e.message}`);
      // Even on timeout, the page may have loaded enough for content script
      const url = page.url();
      if (url.includes('disneyplus.com')) {
        loaded = true;
        console.log('  Page partially loaded, continuing...');
      }
    }

    assert(loaded, 'Disney+ page loaded');

    // Wait for extension content script to initialize
    await sleep(3000);

    // Check platform detection
    const extLogs = consoleLogs.filter(
      (l) => l.includes('[CSS-STYL]') || l.includes('Consistent Subtitle'),
    );
    const detected = extLogs.some((l) => l.includes('Detected platform: disneyplus'));
    assert(detected, 'Platform detected as disneyplus');

    if (extLogs.length > 0) {
      console.log(`  Extension logs: ${extLogs.length} entries`);
      extLogs.slice(0, 5).forEach((l) => console.log(`    ${l}`));
    }

    // ── Phase 2: Inject mock Shadow DOM subtitle elements ──────────────
    console.log('\n── Injecting mock Shadow DOM subtitle elements ──');
    await injectMockSubtitles(page);

    const mockCheck = await verifyMockElements(page);
    assert(mockCheck.host, 'Custom element <disney-web-player> created');
    assert(mockCheck.shadow, 'Shadow root is open');
    assert(mockCheck.dss, 'DSS subtitle renderer cue in shadow root');
    assert(mockCheck.hive, 'Hive subtitle renderer cue in shadow root');

    // The extension needs to detect the new shadow host and inject styles.
    // Trigger an applyStyles by changing a setting.
    console.log('\n── Triggering style injection ──');
    await setStorage(browser, extId, { fontColor: 'yellow' });
    await sleep(3000);

    // Check if the extension injected a <style> element into the shadow root
    const afterSetting = await verifyMockElements(page);
    assert(
      afterSetting.styleInjected,
      'Extension injected <style> into shadow root',
      `styleInjected: ${afterSetting.styleInjected}`,
    );

    // ── Phase 3: Test CSS style changes via shadow root ────────────────

    // Font color → yellow
    console.log('\n── Font color → yellow ──');
    const color = await waitForShadowStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('255') && v.includes('255') && v.includes('0'),
      { timeoutMs: 10_000 },
    );
    assert(
      color === 'rgb(255, 255, 0)',
      'Font color → yellow in shadow DOM',
      `got: ${color}`,
    );

    // Font family → casual
    console.log('\n── Font family → casual ──');
    await setStorage(browser, extId, { fontFamily: 'casual' });

    const font = await waitForShadowStyle(
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
      'Font family → casual in shadow DOM',
      `got: ${font}`,
    );

    // Font size → 200%
    console.log('\n── Font size → 200% ──');
    const baseSize = await getStyle(page, SUB_SEL, 'fontSize');
    const basePx = parseFloat(baseSize || '16');

    await setStorage(browser, extId, { fontSize: '200%' });

    const size = await waitForShadowStyle(
      page,
      SUB_SEL,
      'fontSize',
      (v) => v && parseFloat(v) > basePx,
      { timeoutMs: 10_000 },
    );
    assert(
      size && parseFloat(size) > basePx,
      'Font size → 200% in shadow DOM',
      `base: ${basePx}px, got: ${size}`,
    );

    // Background color → blue
    console.log('\n── Background color → blue ──');
    await setStorage(browser, extId, { backgroundColor: 'blue' });

    const bgColor = await waitForShadowStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v && v.includes('0, 0, 255'),
      { timeoutMs: 10_000 },
    );
    assert(
      bgColor && bgColor.includes('0, 0, 255'),
      'Background color → blue in shadow DOM',
      `got: ${bgColor}`,
    );

    // Character edge → dropshadow
    console.log('\n── Character edge → dropshadow ──');
    await setStorage(browser, extId, { characterEdgeStyle: 'dropshadow' });

    const shadow = await waitForShadowStyle(
      page,
      SUB_SEL,
      'textShadow',
      (v) => v && v !== 'none',
      { timeoutMs: 10_000 },
    );
    assert(
      shadow && shadow !== 'none',
      'Text shadow → dropshadow in shadow DOM',
      `got: ${shadow?.substring(0, 60)}`,
    );

    // Window color → red (applied to .dss-subtitle-renderer-cue)
    console.log('\n── Window color → red ──');
    await setStorage(browser, extId, { windowColor: 'red' });

    const windowColor = await waitForShadowStyle(
      page,
      WINDOW_SEL,
      'backgroundColor',
      (v) => v && v.includes('255, 0, 0'),
      { timeoutMs: 10_000 },
    );
    assert(
      windowColor && windowColor.includes('255, 0, 0'),
      'Window color → red in shadow DOM',
      `got: ${windowColor}`,
    );

    // Font opacity → 50% with yellow
    console.log('\n── Font opacity → 50% ──');
    await setStorage(browser, extId, { fontColor: 'yellow', fontOpacity: '50' });

    const fontOpacity = await waitForShadowStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v != null && v.includes('0.5'),
      { timeoutMs: 10_000 },
    );
    assert(
      fontOpacity && fontOpacity.includes('0.5'),
      'Font opacity 50% produces semi-transparent color in shadow DOM',
      `got: ${fontOpacity}`,
    );

    // Background opacity → 75%
    console.log('\n── Background opacity → 75% ──');
    await setStorage(browser, extId, { backgroundColor: 'blue', backgroundOpacity: '75' });

    const bgOpacity = await waitForShadowStyle(
      page,
      BG_SEL,
      'backgroundColor',
      (v) => v != null && v.includes('0.75'),
      { timeoutMs: 10_000 },
    );
    assert(
      bgOpacity && bgOpacity.includes('0.75'),
      'Background opacity 75% produces semi-transparent bg in shadow DOM',
      `got: ${bgOpacity}`,
    );

    // Window opacity → 50%
    console.log('\n── Window opacity → 50% ──');
    await setStorage(browser, extId, { windowColor: 'green', windowOpacity: '50' });

    const windowOpacity = await waitForShadowStyle(
      page,
      WINDOW_SEL,
      'backgroundColor',
      (v) => v != null && v.includes('0.5'),
      { timeoutMs: 10_000 },
    );
    assert(
      windowOpacity && windowOpacity.includes('0.5'),
      'Window opacity 50% produces semi-transparent window in shadow DOM',
      `got: ${windowOpacity}`,
    );

    // ── Phase 4: Hive renderer variant ─────────────────────────────────
    console.log('\n── Hive renderer variant ──');

    // Check that the hive-subtitle-renderer-cue also receives styles
    const hiveSel = '.hive-subtitle-renderer-cue > span';
    const hiveColor = await waitForShadowStyle(
      page,
      hiveSel,
      'color',
      (v) => v != null && v !== 'rgb(0, 0, 0)',
      { timeoutMs: 5_000 },
    );
    // The hive renderer uses the same CSS rules, so it should get styled too
    assert(
      hiveColor && hiveColor !== 'rgb(0, 0, 0)',
      'Hive renderer subtitle also styled in shadow DOM',
      `got: ${hiveColor}`,
    );

    // ── Phase 5: Combined settings ─────────────────────────────────────
    console.log('\n── Combined settings ──');
    // Reset first to clear lingering opacity from previous test
    await resetStorage(browser, extId);
    await sleep(1000);
    await setStorage(browser, extId, {
      fontColor: 'cyan',
      fontFamily: 'monospaced-serif',
      characterEdgeStyle: 'outline',
    });
    await sleep(3000);

    const combined = await page.evaluate(
      (hostTag, sel) => {
        const host = document.querySelector(hostTag);
        if (!host?.shadowRoot) return null;
        const el = host.shadowRoot.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          fontFamily: cs.fontFamily?.substring(0, 80),
          textShadow: cs.textShadow?.substring(0, 60),
        };
      },
      SHADOW_HOST,
      SUB_SEL,
    );

    assert(
      combined?.color === 'rgb(0, 255, 255)',
      'Combined: cyan color in shadow DOM',
      `got: ${combined?.color}`,
    );
    assert(
      combined?.fontFamily &&
        (combined.fontFamily.includes('Courier') || combined.fontFamily.includes('monospace')),
      'Combined: monospaced-serif font in shadow DOM',
      `got: ${combined?.fontFamily}`,
    );
    assert(
      combined?.textShadow && combined.textShadow !== 'none',
      'Combined: outline edge in shadow DOM',
      `got: ${combined?.textShadow}`,
    );

    // ── Phase 6: Reset ─────────────────────────────────────────────────
    console.log('\n── Reset to defaults ──');
    await resetStorage(browser, extId);
    await sleep(2000);

    const afterReset = await getStyle(page, SUB_SEL, 'color');
    assert(
      afterReset !== 'rgb(0, 255, 255)',
      'Reset reverted font color in shadow DOM',
      `got: ${afterReset}`,
    );

    // ── Phase 7: Popup UI ──────────────────────────────────────────────
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

    const { failed } = summary('Disney+');
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
