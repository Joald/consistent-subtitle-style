/**
 * E2E tests for Consistent Subtitle Style — YouTube platform.
 *
 * YouTube aggressively blocks bots on most videos. The Rick Astley video
 * (dQw4w9WgXcQ) is one of the few that reliably loads without CAPTCHA.
 * Since this is a music video, caption text is rarely present, so we test:
 *
 *   1. Extension initialisation (bridge, platform detection, applyStyles)
 *   2. Live settings propagation (storage change → applyStyles re-fires)
 *   3. YouTube player API integration
 *
 * Settings are changed via the popup page (no SW dependency).
 *
 * Run:
 *   bun e2e/youtube.e2e.js
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

const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    // ── Navigate & init ──────────────────────────────────────────────────
    console.log('\n🔧  Extension loading on YouTube');
    await page.goto(YT_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
    await sleep(5000);

    // Check for bot wall
    const isBot = await page.evaluate(
      () =>
        document.body?.innerText?.includes('not a bot') ||
        document.body?.innerText?.includes('confirm you') ||
        false,
    );
    if (isBot) {
      console.log('\n⚠️  YouTube bot detection triggered — skipping YouTube E2E tests.');
      console.log('    This is expected in some CI/headless environments.');
      console.log('\n' + '═'.repeat(50));
      console.log('  YouTube: SKIPPED (bot detection)');
      console.log('═'.repeat(50));
      return;
    }

    const extId = await getExtensionId(browser);
    assert(extId, 'Extension ID found');

    if (!extId) {
      console.log('  ⚠️  Cannot continue without extension ID');
      process.exit(1);
    }

    // ── Platform detection ───────────────────────────────────────────────
    console.log('\n📺  YouTube platform detection');

    const initLogs = consoleLogs.filter((l) => l.includes('CSS-STYL'));
    assert(
      initLogs.some((l) => l.includes('Bridge script initialized')),
      'Bridge initialises',
    );
    assert(
      initLogs.some((l) => l.includes('Detected platform: youtube')),
      'Platform detected as youtube',
    );
    assert(
      initLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() runs on init',
    );

    // ── Player state ─────────────────────────────────────────────────────
    console.log('\n▶️  YouTube player');

    const playerState = await page.evaluate(() => ({
      hasPlayer: !!document.querySelector('.html5-video-player'),
      hasVideo: !!document.querySelector('video'),
      videoPlaying: (() => {
        const v = document.querySelector('video');
        return v ? !v.paused : false;
      })(),
      hasCCButton: !!document.querySelector('.ytp-subtitles-button'),
    }));

    assert(playerState.hasPlayer, 'YouTube player element exists');
    assert(playerState.hasVideo, 'Video element exists');
    assert(playerState.hasCCButton, 'CC/subtitles button exists');

    // Try to enable captions
    await page.evaluate(() => {
      const cc = document.querySelector('.ytp-subtitles-button');
      if (cc && cc.getAttribute('aria-pressed') !== 'true') cc.click();
    });
    await sleep(2000);

    const ccState = await page.evaluate(() => {
      const cc = document.querySelector('.ytp-subtitles-button');
      return cc?.getAttribute('aria-pressed');
    });
    assert(ccState === 'true', 'Captions enabled via CC button', `aria-pressed=${ccState}`);

    // ── Live update: storage change triggers applyStyles ─────────────────
    console.log('\n🎨  Live update — fontColor → yellow');
    const logsBeforeChange = consoleLogs.length;
    await setStorage(browser, extId, { fontColor: 'yellow' });
    await sleep(3000);

    const newLogs = consoleLogs.slice(logsBeforeChange).filter((l) => l.includes('CSS-STYL'));
    assert(
      newLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after fontColor change',
    );

    // ── Live update: font family ─────────────────────────────────────────
    console.log('\n🔤  Live update — fontFamily → casual');
    const logsBeforeFont = consoleLogs.length;
    await setStorage(browser, extId, { fontFamily: 'casual' });
    await sleep(3000);

    const fontLogs = consoleLogs.slice(logsBeforeFont).filter((l) => l.includes('CSS-STYL'));
    assert(
      fontLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after fontFamily change',
    );

    // ── Live update: font size ───────────────────────────────────────────
    console.log('\n📏  Live update — fontSize → 200%');
    const logsBeforeSize = consoleLogs.length;
    await setStorage(browser, extId, { fontSize: '200%' });
    await sleep(3000);

    const sizeLogs = consoleLogs.slice(logsBeforeSize).filter((l) => l.includes('CSS-STYL'));
    assert(
      sizeLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after fontSize change',
    );

    // ── Live update: edge style ──────────────────────────────────────────
    console.log('\n✨  Live update — characterEdgeStyle → dropshadow');
    const logsBeforeEdge = consoleLogs.length;
    await setStorage(browser, extId, { characterEdgeStyle: 'dropshadow' });
    await sleep(3000);

    const edgeLogs = consoleLogs.slice(logsBeforeEdge).filter((l) => l.includes('CSS-STYL'));
    assert(
      edgeLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after characterEdgeStyle change',
    );

    // ── Live update: combined ────────────────────────────────────────────
    console.log('\n🔀  Combined settings change');
    const logsBeforeCombo = consoleLogs.length;
    await setStorage(browser, extId, {
      fontColor: 'cyan',
      backgroundColor: 'blue',
      fontFamily: 'monospaced-serif',
      characterEdgeStyle: 'outline',
    });
    await sleep(3000);

    const comboLogs = consoleLogs.slice(logsBeforeCombo).filter((l) => l.includes('CSS-STYL'));
    assert(
      comboLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after combined settings change',
    );

    // ── Reset ────────────────────────────────────────────────────────────
    console.log('\n🔄  Reset to defaults');
    const logsBeforeReset = consoleLogs.length;
    await resetStorage(browser, extId);
    await sleep(3000);

    const resetLogs = consoleLogs.slice(logsBeforeReset).filter((l) => l.includes('CSS-STYL'));
    assert(
      resetLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after reset',
    );
  } finally {
    await browser.close();
  }

  const result = summary('YouTube');
  process.exit(result.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
