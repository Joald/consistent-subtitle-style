/**
 * E2E tests for Consistent Subtitle Style — Nebula platform.
 *
 * Nebula requires a paid subscription to watch videos.  Without auth we
 * can only test extension initialisation on the public landing page:
 *
 *   1. Extension loads and detects the nebula platform
 *   2. Bridge initialises
 *   3. applyStyles() runs
 *
 * Video-level tests (captions, live style changes) are NOT possible
 * without Nebula credentials and are documented as skipped.
 *
 * Prerequisites:
 *   - Xvfb running on :99
 *   - Extension built (`bun run build`)
 *
 * Run:
 *   DISPLAY=:99 bun e2e/nebula.e2e.js
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const NEBULA_URL = 'https://nebula.tv';

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
  let triedExtPage = false;
  while (Date.now() < deadline) {
    const sw = browser.targets().find((t) => t.type() === 'service_worker');
    if (sw) return sw.url().split('/')[2];
    if (!triedExtPage && Date.now() > deadline - timeoutMs + 5000) {
      triedExtPage = true;
      const p = await browser.newPage();
      await p.goto('chrome://extensions', { waitUntil: 'load', timeout: 5000 }).catch(() => {});
      await sleep(1000);
      await p.close();
    }
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
    } else {
      const p = await browser.newPage();
      await p.goto('chrome://extensions', { waitUntil: 'load', timeout: 3000 }).catch(() => {});
      await sleep(1000);
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

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
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

function skip(name, reason) {
  skipped++;
  console.log(`  ⏭️  ${name} — ${reason}`);
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Launching Chrome with extension…');
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    // ── Navigate to landing page ─────────────────────────────────────────
    console.log('\n🔧  Extension loading on Nebula');

    // Kick-start the service worker
    const extWarmup = await browser.newPage();
    await extWarmup.goto('chrome://extensions', { waitUntil: 'load', timeout: 5000 }).catch(() => {});
    await sleep(2000);
    await extWarmup.close();

    try {
      await page.goto(NEBULA_URL, { waitUntil: 'networkidle2', timeout: 20_000 });
    } catch {
      // Nebula can be slow; continue even on timeout
    }
    await sleep(3000);

    const extId = await getExtensionId(browser);
    assert(extId, 'Service worker starts and has extension ID');

    // Wake SW
    if (extId) {
      const warmup = await browser.newPage();
      await warmup.goto(`chrome-extension://${extId}/index.html`, { waitUntil: 'load', timeout: 5000 }).catch(() => {});
      await warmup.close();
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
      title: document.title,
      isNebula: document.title.includes('Nebula'),
      hostname: location.hostname,
    }));
    assert(pageState.isNebula, 'Page title contains "Nebula"', pageState.title);
    assert(pageState.hostname === 'nebula.tv', 'Hostname is nebula.tv', pageState.hostname);

    // ── Live settings propagation (no video, but onChanged still fires) ──
    console.log('\n🎨  Live settings propagation');

    const logsBeforeChange = consoleLogs.length;
    await setStorage(browser, extId, { fontColor: 'yellow' });
    await sleep(3000);

    const newLogs = consoleLogs.slice(logsBeforeChange).filter((l) => l.includes('CSS-STYL'));
    assert(
      newLogs.some((l) => l.includes('app.applyStyles() called')),
      'applyStyles() re-fires after fontColor change',
    );

    // ── Video tests (skipped — requires auth) ────────────────────────────
    console.log('\n🔒  Video tests (require Nebula subscription)');
    skip('Caption text visible', 'requires auth');
    skip('Live font color change', 'requires auth');
    skip('Live font family change', 'requires auth');
    skip('CSS style element injected', 'requires auth');

  } finally {
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`  Nebula: ${passed} passed, ${failed} failed, ${skipped} skipped`);
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
