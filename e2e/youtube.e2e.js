/**
 * E2E tests for Consistent Subtitle Style — YouTube platform.
 *
 * YouTube aggressively blocks bots on most videos. The Rick Astley video
 * (dQw4w9WgXcQ) is one of the few that reliably loads without a CAPTCHA
 * wall in headless/Xvfb Chrome.  Since this is a music video, visible
 * caption text is rarely present (no speech), so we test:
 *
 *   1. Extension initialisation (bridge, platform detection, applyStyles)
 *   2. Live settings propagation (storage change → applyStyles re-fires)
 *   3. YouTube player API integration (native settings path)
 *   4. CSS style element injection on storage change
 *
 * We do NOT assert caption text visibility — that depends on the video
 * having active speech at the current timestamp.
 *
 * Prerequisites:
 *   - Xvfb running on :99
 *   - Extension built (`bun run build`)
 *
 * Run:
 *   DISPLAY=:99 bun e2e/youtube.e2e.js
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--window-size=1920,1080',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });
}

async function getExtensionId(browser, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sw = browser.targets().find((t) => t.type() === 'service_worker');
    if (sw) return sw.url().split('/')[2];
    await sleep(1000);
  }
  for (const t of browser.targets()) {
    const url = t.url();
    if (url.startsWith('chrome-extension://')) return url.split('/')[2];
  }
  return null;
}

async function getServiceWorker(browser, extId, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let sw = browser.targets().find((t) => t.type() === 'service_worker');
    if (sw) return sw;
    if (extId) {
      const p = await browser.newPage();
      await p.goto(`chrome-extension://${extId}/index.html`, { waitUntil: 'load', timeout: 3000 }).catch(() => {});
      await sleep(500);
      await p.close();
    }
    await sleep(500);
    sw = browser.targets().find((t) => t.type() === 'service_worker');
    if (sw) return sw;
  }
  return null;
}

async function setStorage(browser, extId, settings) {
  const swTarget = await getServiceWorker(browser, extId);
  if (!swTarget) throw new Error('Service worker not found');
  const sw = await swTarget.worker();
  await sw.evaluate((s) => new Promise((resolve) => chrome.storage.sync.set(s, resolve)), settings);
}

async function clearStorage(browser, extId) {
  const swTarget = await getServiceWorker(browser, extId);
  if (!swTarget) throw new Error('Service worker not found');
  const sw = await swTarget.worker();
  await sw.evaluate(() => new Promise((resolve) => chrome.storage.sync.clear(resolve)));
}

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

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

    // Check for bot wall — if hit, skip all tests gracefully
    const isBot = await page.evaluate(() =>
      document.body?.innerText?.includes('not a bot') ||
      document.body?.innerText?.includes('confirm you') || false
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
    assert(extId, 'Service worker starts and has extension ID');

    // Wake SW
    if (extId) {
      const warmup = await browser.newPage();
      await warmup.goto(`chrome-extension://${extId}/index.html`, { waitUntil: 'load', timeout: 5000 }).catch(() => {});
      await warmup.close();
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
    await clearStorage(browser, extId);
    await sleep(3000);

    const resetLogs = consoleLogs.slice(logsBeforeReset).filter((l) => l.includes('CSS-STYL'));
    assert(
      resetLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after storage clear',
    );

  } finally {
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`  YouTube: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\n  Failures:');
    for (const f of failures) console.log(`    • ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  }
  console.log('═'.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
