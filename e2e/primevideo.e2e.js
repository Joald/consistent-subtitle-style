/**
 * E2E tests for Consistent Subtitle Style — Prime Video platform.
 *
 * Tests against a REAL Prime Video page with Amazon login to verify:
 * 1. Content script loads on the actual domain
 * 2. Platform is correctly detected as 'primevideo'
 * 3. CSS injection works in real page context (no CSP/script blocking)
 * 4. Style changes propagate to subtitle elements
 *
 * Video playback is NOT tested — Prime Video's DRM blocks headless/Linux
 * Chrome. Mock subtitle elements matching the ATVWebPlayerSDK structure
 * are injected after verifying the extension loaded correctly on the real
 * page.
 *
 * Requires: AMAZON_EMAIL and AMAZON_PASSWORD env vars (or defaults to
 * the test account).
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
  setSiteOverride,
  clearSiteOverrides,
  PRESET_HIGH_CONTRAST,
  PRESET_RECOMMENDED,
} from './helpers.js';

const { assert, skip, summary } = createTestRunner();

// Prime Video subtitle selectors (from src/platforms/primevideo.ts)
const SUB_SEL = '.atvwebplayersdk-captions-text';
const BG_SEL = '.atvwebplayersdk-captions-region';
const WINDOW_SEL = '.atvwebplayersdk-captions-overlay';

// Test account (override with env vars)
const AMAZON_EMAIL = process.env.AMAZON_EMAIL || 'joald.bott@gmail.com';
const AMAZON_PASSWORD = process.env.AMAZON_PASSWORD || 'Kremowka!2137Amazon';

// Real Prime Video detail page — Bosch: Legacy (free with ads, 29+ subtitle langs)
const PRIMEVIDEO_DETAIL_URL =
  'https://www.primevideo.com/detail/0OKLTS8BQLJG2B44ALO0FYAQ8R/';
// Same content on amazon.co.uk domain
const AMAZON_UK_VIDEO_URL =
  'https://www.amazon.co.uk/gp/video/detail/B09WV8HF2Z/';

/**
 * Try to sign in to Amazon UK (best-effort).
 * Returns true if login succeeded, false if blocked by CAPTCHA/OTP.
 * Tests run either way — extension injection doesn't require auth.
 */
async function amazonSignIn(page) {
  console.log('  Navigating to Amazon sign-in...');
  try {
    await page.goto(
      'https://www.amazon.co.uk/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.co.uk%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=gflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0',
      { waitUntil: 'networkidle2', timeout: 15_000 },
    );

    const emailField = await page.$('#ap_email');
    if (emailField) {
      await emailField.type(AMAZON_EMAIL, { delay: 50 });
      const continueBtn = await page.$('#continue');
      if (continueBtn) {
        await continueBtn.click();
        await sleep(2000);
      }
    }

    const passwordField = await page.$('#ap_password');
    if (passwordField) {
      await passwordField.type(AMAZON_PASSWORD, { delay: 50 });
      const signInBtn = await page.$('#signInSubmit');
      if (signInBtn) {
        await signInBtn.click();
        await page
          .waitForNavigation({ waitUntil: 'networkidle2', timeout: 15_000 })
          .catch(() => {});
      }
    }

    await sleep(2000);
    const url = page.url();
    return !url.includes('/ap/signin') && !url.includes('/ap/cvf');
  } catch (e) {
    console.log(`  Sign-in error: ${e.message}`);
    return false;
  }
}

/**
 * Inject mock Prime Video subtitle elements into the page.
 * Replicates the real ATVWebPlayerSDK DOM structure.
 */
async function injectMockSubtitles(page) {
  await page.evaluate(() => {
    document.querySelector('#css-e2e-mock-primevideo')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'css-e2e-mock-primevideo';
    overlay.className = 'atvwebplayersdk-captions-overlay';
    overlay.style.cssText =
      'position:fixed;bottom:80px;left:50%;z-index:99999;';

    const region = document.createElement('div');
    region.className = 'atvwebplayersdk-captions-region';

    const text = document.createElement('span');
    text.className = 'atvwebplayersdk-captions-text';
    text.textContent = 'Real page e2e — subtitle styling verification';

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
      summary('Prime Video (Real Page)');
      await browser.close();
      process.exit(1);
      return;
    }

    // ── Phase 1: Sign in to Amazon (best-effort) ────────────────────────
    console.log('\n── Amazon sign-in (optional) ──');
    const loginPage = await browser.newPage();
    const signedIn = await amazonSignIn(loginPage);
    if (signedIn) {
      console.log('  ✅ Signed in');
    } else {
      console.log('  ⚠ Sign-in skipped (CAPTCHA/OTP). Tests run without auth.');
    }
    await loginPage.close();

    // ── Phase 2: Load real Prime Video detail page ─────────────────────
    console.log('\n── Loading Prime Video detail page (primevideo.com) ──');
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    let loaded = false;
    try {
      const resp = await page.goto(PRIMEVIDEO_DETAIL_URL, {
        waitUntil: 'networkidle2',
        timeout: 45_000,
      });
      const status = resp?.status() ?? 0;
      const finalUrl = page.url();
      const title = await page.title();
      console.log(`  Status: ${status}, URL: ${finalUrl}`);
      console.log(`  Title: "${title}"`);
      loaded = status >= 200 && status < 400;
    } catch (e) {
      console.log(`  Navigation error: ${e.message}`);
      const url = page.url();
      if (url.includes('primevideo.com') || url.includes('amazon.co')) {
        loaded = true;
        console.log('  Page partially loaded, continuing...');
      }
    }

    assert(loaded, 'Prime Video detail page loaded');

    // Wait for extension scripts to inject and initialize
    await sleep(5000);

    // ── Phase 3: Verify extension loaded on real page ──────────────────
    console.log('\n── Verifying extension injection on real page ──');

    const extLogs = consoleLogs.filter(
      (l) => l.includes('[CSS-STYL]') || l.includes('Consistent Subtitle'),
    );

    console.log(`  Extension console logs: ${extLogs.length} entries`);
    extLogs.slice(0, 10).forEach((l) => console.log(`    ${l}`));

    const injectionStarted = extLogs.some((l) => l.includes('Bridge script initialized'));
    assert(injectionStarted, 'Content script injection started on real page');

    const scriptsLoaded = extLogs.some((l) => l.includes('SubtitleStylerApp initializing'));
    assert(scriptsLoaded, 'Page-context scripts loaded (no CSP block)');

    const detected = extLogs.some((l) => l.includes('Detected platform: primevideo'));
    assert(detected, 'Platform detected as primevideo on real page');

    // Check if the style element was created
    const hasStyleElement = await page.evaluate(
      () => !!document.querySelector('#subtitle-styler-dynamic-styles'),
    );
    assert(hasStyleElement, 'Style element injected into page DOM');

    // Check for any script injection errors
    const injectionErrors = extLogs.filter((l) => l.includes('Failed to inject'));
    assert(
      injectionErrors.length === 0,
      'No script injection failures',
      injectionErrors.length > 0 ? injectionErrors.join('; ') : undefined,
    );

    // ── Phase 4: Inject mock subtitles on real page ────────────────────
    console.log('\n── Injecting mock subtitle elements on real page ──');
    await injectMockSubtitles(page);

    const mockCheck = await page.evaluate(() => ({
      hasOverlay: !!document.querySelector('.atvwebplayersdk-captions-overlay'),
      hasRegion: !!document.querySelector('.atvwebplayersdk-captions-region'),
      hasText: !!document.querySelector('.atvwebplayersdk-captions-text'),
    }));
    assert(
      mockCheck.hasOverlay && mockCheck.hasRegion && mockCheck.hasText,
      'Mock subtitle elements injected on real page',
    );

    // ── Phase 5: Test CSS style injection ──────────────────────────────

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

    // Font size → 200% (applies transform: scale() on the overlay container)
    console.log('\n── Font size → 200% ──');

    await setStorage(browser, extId, { fontSize: '200%' });
    await sleep(3000);

    // fontSize applies transform: scale() on .atvwebplayersdk-captions-overlay
    // Our mock overlay has id='css-e2e-mock-primevideo'; use it to avoid
    // picking up the real page's overlay element via querySelector.
    const fontSizeTransform = await waitForStyle(
      page,
      '#css-e2e-mock-primevideo',
      'transform',
      (v) => v && v !== 'none',
      { timeoutMs: 10_000 },
    );
    assert(
      fontSizeTransform && fontSizeTransform !== 'none' && fontSizeTransform.includes('2'),
      'Font size → 200% applies scale transform on container',
      `got: ${fontSizeTransform}`,
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
      fontOpacity: '100',
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
      combined?.color === 'rgb(255, 0, 255)' || combined?.color?.includes('1, 0, 1') || combined?.color?.includes('1 0 1'),
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

    // ── Preset: High Contrast ─────────────────────────────────────────
    console.log('\n── Preset: High Contrast ──');
    await resetStorage(browser, extId);
    await sleep(1000);
    await setStorage(browser, extId, PRESET_HIGH_CONTRAST);

    const hcColor = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('255') && v.includes('255') && v.includes('255'),
      { timeoutMs: 10_000 },
    );
    assert(
      hcColor && hcColor.includes('255'),
      'High Contrast preset: white font color',
      `got: ${hcColor}`,
    );

    const hcShadow = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).textShadow : null;
    }, SUB_SEL);
    assert(
      !hcShadow || hcShadow === 'none',
      'High Contrast preset: no text shadow',
      `got: ${hcShadow}`,
    );

    // ── Preset: Recommended ─────────────────────────────────────────
    console.log('\n── Preset: Recommended ──');
    await setStorage(browser, extId, PRESET_RECOMMENDED);

    const recShadow = await waitForStyle(
      page,
      SUB_SEL,
      'textShadow',
      (v) => v && v !== 'none',
      { timeoutMs: 10_000 },
    );
    assert(
      recShadow && recShadow !== 'none',
      'Recommended preset: dropshadow applied',
      `got: ${recShadow?.substring(0, 60)}`,
    );

    // ── Per-site override ─────────────────────────────────────────────
    console.log('\n── Per-site override ──');
    await resetStorage(browser, extId);
    await sleep(1000);

    // Set global fontColor=red
    await setStorage(browser, extId, { fontColor: 'red' });
    await sleep(1500);

    const globalRed = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('255, 0, 0'),
      { timeoutMs: 10_000 },
    );
    assert(
      globalRed && globalRed.includes('255, 0, 0'),
      'Per-site: global fontColor=red applied',
      `got: ${globalRed}`,
    );

    // Set per-site override: fontColor=cyan
    const siteSettings = {
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
    await setSiteOverride(browser, extId, 'primevideo', siteSettings);
    await sleep(500);

    // Reload page + re-inject mocks
    await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 });
    await sleep(3000);
    await injectMockSubtitles(page);

    const siteCyan = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('0, 255, 255'),
      { timeoutMs: 10_000 },
    );
    assert(
      siteCyan && siteCyan.includes('0, 255, 255'),
      'Per-site: primevideo override fontColor=cyan applied',
      `got: ${siteCyan}`,
    );

    // Clear per-site, verify fallback to global red
    await clearSiteOverrides(browser, extId);
    await sleep(500);

    await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 });
    await sleep(3000);
    await injectMockSubtitles(page);

    const fallbackRed = await waitForStyle(
      page,
      SUB_SEL,
      'color',
      (v) => v && v.includes('255, 0, 0'),
      { timeoutMs: 10_000 },
    );
    assert(
      fallbackRed && fallbackRed.includes('255, 0, 0'),
      'Per-site: cleared → falls back to global fontColor=red',
      `got: ${fallbackRed}`,
    );

    // ── Phase 6: Test on amazon.co.uk domain ──────────────────────────
    console.log('\n── Testing on amazon.co.uk domain ──');
    await resetStorage(browser, extId);
    consoleLogs.length = 0;

    try {
      await page.goto(AMAZON_UK_VIDEO_URL, {
        waitUntil: 'networkidle2',
        timeout: 45_000,
      });
      await sleep(5000);

      const ukLogs = consoleLogs.filter((l) => l.includes('[CSS-STYL]'));
      const ukDetected = ukLogs.some((l) => l.includes('Detected platform: primevideo'));
      assert(ukDetected, 'Platform detected as primevideo on amazon.co.uk');

      console.log(`  amazon.co.uk extension logs: ${ukLogs.length}`);
      ukLogs.slice(0, 5).forEach((l) => console.log(`    ${l}`));

      await injectMockSubtitles(page);
      await setStorage(browser, extId, { fontColor: 'green' });

      const ukColor = await waitForStyle(
        page,
        SUB_SEL,
        'color',
        (v) => v && (v.includes('0, 128, 0') || v.includes('0, 255, 0')),
        { timeoutMs: 10_000 },
      );
      assert(
        ukColor && (ukColor.includes('0, 128, 0') || ukColor.includes('0, 255, 0')),
        'CSS injection works on amazon.co.uk domain',
        `got: ${ukColor}`,
      );
    } catch (e) {
      console.log(`  amazon.co.uk test failed: ${e.message}`);
      assert(false, 'amazon.co.uk domain test', e.message);
    }

    // Reset
    console.log('\n── Reset to defaults ──');
    await resetStorage(browser, extId);
    await sleep(2000);

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
        hasSiteDefault: !!Array.from(document.querySelectorAll('[data-value="auto"]')).find((el) =>
          el.textContent.includes('Site default'),
        ),
        hasPreview: !!document.getElementById('preview-text'),
      }));

      assert(popupInfo.title === 'Subtitle Styles', 'Popup title correct');
      assert(popupInfo.selectCount >= 9, 'Popup has dropdowns', String(popupInfo.selectCount));
      assert(popupInfo.hasSiteDefault, 'Popup has Site default option');
      assert(popupInfo.hasPreview, 'Popup has preview element');
    } catch (e) {
      assert(false, 'Popup loads', e.message);
    } finally {
      await popupPage.close();
    }

    const { failed } = summary('Prime Video (Real Page)');
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
