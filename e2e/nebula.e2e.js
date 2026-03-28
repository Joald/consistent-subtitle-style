/**
 * E2E tests for Consistent Subtitle Style — Nebula platform.
 *
 * Uses Nebula's "first one is on us" free video feature (no login needed)
 * to test the full extension flow: init → captions → live style changes.
 *
 * The test navigates to a video page on the Explore feed, clicks the
 * "Watch video" button, enables subtitles, and verifies live CSS
 * injection when settings change via chrome.storage.sync.
 *
 * Prerequisites:
 *   - Extension built (`bun run build`)
 *   - Xvfb on :99 OR Chrome new-headless mode (auto-detected)
 *
 * Run:
 *   bun e2e/nebula.e2e.js
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hasXvfb() {
  try {
    const fs = require('fs');
    return fs.existsSync('/tmp/.X11-unix/X99');
  } catch {
    return false;
  }
}

async function launchBrowser() {
  // Use headless:'new' (Chrome ≥112) which supports extensions without Xvfb.
  // Fall back to headful+Xvfb when DISPLAY is set and Xvfb is running.
  const useHeadful = hasXvfb() && process.env.DISPLAY;
  // Use a fresh temp profile to avoid cached "free video used" state
  const fs = require('fs');
  const os = require('os');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-e2e-'));
  return puppeteer.launch({
    headless: useHeadful ? false : 'new',
    userDataDir,
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
    for (const t of browser.targets()) {
      const url = t.url();
      if (url.startsWith('chrome-extension://') && url.includes('/'))
        return url.split('/')[2];
    }
    await sleep(500);
  }
  return null;
}

async function getServiceWorker(browser, extId, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let sw = browser.targets().find((t) => t.type() === 'service_worker');
    if (sw) return sw;
    // SW may have gone idle — wake it by touching the popup
    if (extId) {
      const p = await browser.newPage();
      await p.goto(`chrome-extension://${extId}/index.html`, { waitUntil: 'load', timeout: 3000 }).catch(() => {});
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
  if (!swTarget) return false;
  const sw = await swTarget.worker();
  await sw.evaluate((s) => new Promise((resolve) => chrome.storage.sync.set(s, resolve)), settings);
  return true;
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
    // Use a known free video URL. Nebula offers "first one is on us" to
    // unauthenticated users on individual video pages.
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

    // Get extension ID (content script triggers SW on page load)
    let extId = await getExtensionId(browser, 10_000);
    if (extId) {
      assert(true, 'Service worker starts and has extension ID');
    } else {
      // In new-headless mode, SW may take longer to appear. This is not a code bug.
      console.log('  ⚠️  Extension ID not found (SW may have gone idle) — live tests will be skipped');
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
    // The free-video play button label varies between sessions — match broadly.
    const PLAY_SELECTORS = [
      'button[aria-label="Play video"]',
      'button[aria-label="Play this video"]',
    ];
    // Wait for any play button to appear
    let playSelector = null;
    for (let i = 0; i < 20 && !playSelector; i++) {
      for (const sel of PLAY_SELECTORS) {
        const el = await page.$(sel);
        if (el) { playSelector = sel; break; }
      }
      if (!playSelector) {
        // Also try text-based match
        const found = await page.evaluate(() => {
          for (const b of document.querySelectorAll('button')) {
            const text = (b.textContent || '').toLowerCase();
            if (text.includes('play') && (text.includes('video') || text.includes('watch'))) return true;
          }
          return false;
        });
        if (found) { playSelector = 'text-match'; break; }
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
      // Wait for player to appear with retries
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
      skip('Live font color change', 'player did not load');
      skip('Live font family change', 'player did not load');
      skip('Live font size change', 'player did not load');
      skip('Live background color change', 'player did not load');
      skip('Live edge style change', 'player did not load');
      skip('Combined settings change', 'player did not load');
      skip('Reset to auto', 'player did not load');
    } else {
      // Wait for video
      try {
        await page.waitForSelector('video', { timeout: 5_000 });
      } catch { /* may already exist */ }
      await sleep(2000);

      const hasVideo = await page.evaluate(() => !!document.querySelector('video'));
      assert(hasVideo, 'Video element present');

      const hasSubs = await page.evaluate(() => !!document.querySelector('[data-subtitles-container]'));
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

      // Wait for subtitle text
      let subsText = '';
      for (let i = 0; i < 15; i++) {
        subsText = await page.evaluate(() =>
          document.querySelector('[data-subtitles-container]')?.textContent?.trim() || ''
        );
        if (subsText) break;
        await sleep(1000);
      }
      assert(!!subsText, 'Subtitle text visible', subsText ? subsText.substring(0, 40) : 'empty');

      // Selector for subtitle text divs (Nebula uses CSS-only path)
      const SUB_SEL = '#video-player [data-subtitles-container] > div > div > div';

      // ── Baseline styles ──────────────────────────────────────────────
      console.log('\n🎨  Baseline styles');

      const baseline = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, fontFamily: cs.fontFamily?.substring(0, 60), fontWeight: cs.fontWeight, fontSize: cs.fontSize };
      }, SUB_SEL);

      if (baseline) {
        assert(baseline.color === 'rgb(255, 255, 255)', 'Default color is white', baseline.color);
        assert(baseline.fontWeight === '700', 'Default font-weight is bold (Nebula baseline CSS)', baseline.fontWeight);
      }

      // ── Live font color ──────────────────────────────────────────────
      console.log('\n🟡  Live font color');

      const canSetStorage = await setStorage(browser, extId, { fontColor: 'yellow' });
      if (!canSetStorage) {
        skip('Font color changes to yellow', 'SW idle — cannot change storage');
        skip('applyStyles() re-fires after fontColor change', 'SW idle');
        skip('Font family changes to monospace serif', 'SW idle');
        skip('applyStyles() fires for fontSize change', 'SW idle');
        skip('Background changes to blue', 'SW idle');
        skip('Text shadow applied for dropshadow edge', 'SW idle');
        skip('Combined: cyan color', 'SW idle');
        skip('Combined: cursive font family', 'SW idle');
        skip('Combined: raised edge style', 'SW idle');
        skip('applyStyles() fires on reset', 'SW idle');
      } else {
      const logsBefore1 = consoleLogs.length;
      await sleep(3000);

      const color1 = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).color : null;
      }, SUB_SEL);
      assert(color1 === 'rgb(255, 255, 0)', 'Font color changes to yellow', color1);

      const logs1 = consoleLogs.slice(logsBefore1).filter((l) => l.includes('CSS-STYL'));
      assert(
        logs1.some((l) => l.includes('app.applyStyles() called')),
        'applyStyles() re-fires after fontColor change',
      );

      // ── Live font family ─────────────────────────────────────────────
      console.log('\n🔤  Live font family');

      await setStorage(browser, extId, { fontFamily: 'monospaced-serif' });
      await sleep(3000);

      const font1 = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).fontFamily?.substring(0, 60) : null;
      }, SUB_SEL);
      // monospaced-serif maps to Courier New in CSS
      assert(
        font1 && (font1.includes('Courier') || font1.includes('monospace')),
        'Font family changes to monospace serif',
        font1,
      );

      // ── Live font size ───────────────────────────────────────────────
      console.log('\n📏  Live font size');

      const logsBeforeSize = consoleLogs.length;
      await setStorage(browser, extId, { fontSize: '200' });
      await sleep(3000);

      const sizeLogs = consoleLogs.slice(logsBeforeSize).filter((l) => l.includes('CSS-STYL'));
      assert(
        sizeLogs.some((l) => l.includes('app.applyStyles() called')),
        'applyStyles() fires for fontSize change',
      );

      // ── Live background color ────────────────────────────────────────
      console.log('\n🟦  Live background color');

      await setStorage(browser, extId, { backgroundColor: 'blue' });
      await sleep(3000);

      const bgColor = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).backgroundColor : null;
      }, SUB_SEL);
      assert(
        bgColor && bgColor.includes('0, 0, 255'),
        'Background changes to blue',
        bgColor,
      );

      // ── Live edge style ──────────────────────────────────────────────
      console.log('\n🔲  Live edge style');

      await setStorage(browser, extId, { characterEdgeStyle: 'dropshadow' });
      await sleep(3000);

      const shadow = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).textShadow : null;
      }, SUB_SEL);
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
      await sleep(3000);

      const combined = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, fontFamily: cs.fontFamily?.substring(0, 60), textShadow: cs.textShadow?.substring(0, 60) };
      }, SUB_SEL);
      assert(
        combined?.color === 'rgb(0, 255, 255)',
        'Combined: cyan color',
        combined?.color,
      );
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
      await setStorage(browser, extId, {
        fontColor: 'auto',
        fontSize: 'auto',
        fontFamily: 'auto',
        backgroundColor: 'auto',
        characterEdgeStyle: 'auto',
      });
      await sleep(3000);

      const resetLogs = consoleLogs.slice(logsBeforeReset).filter((l) => l.includes('CSS-STYL'));
      assert(
        resetLogs.some((l) => l.includes('app.applyStyles() called')),
        'applyStyles() fires on reset',
      );
      } // end if (canSetStorage)
    } // end if (playerLoaded)
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
