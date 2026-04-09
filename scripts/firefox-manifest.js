/**
 * Firefox manifest transformer.
 *
 * Reads the Chrome dist/manifest.json, removes Chrome-specific fields,
 * adds Firefox-specific fields (browser_specific_settings.gecko), and
 * writes it back. Intended to run AFTER the normal build.
 *
 * Usage:
 *   node scripts/firefox-manifest.js [--output <dir>]
 *
 * By default operates on dist/manifest.json in place.
 * With --output, writes to <dir>/manifest.json instead.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Firefox extension ID for AMO submission
const GECKO_ID = 'consistent-subtitle-style@joald';
// Minimum Firefox version with MV3 service worker support
const GECKO_MIN_VERSION = '128.0';

/**
 * Transform a Chrome MV3 manifest into a Firefox-compatible manifest.
 *
 * @param {object} manifest - parsed Chrome manifest.json
 * @returns {object} Firefox-compatible manifest (new object, input not mutated)
 */
export function transformManifest(manifest) {
  // Shallow-clone to avoid mutating the input
  const fx = { ...manifest };

  // Remove Chrome-only fields
  delete fx.key;

  // Add Firefox-specific settings
  fx.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: GECKO_MIN_VERSION,
    },
  };

  return fx;
}

/**
 * Validate that a manifest looks correct for Firefox submission.
 *
 * @param {object} manifest - manifest to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFirefoxManifest(manifest) {
  const errors = [];

  if (manifest.key) {
    errors.push('Chrome "key" field should be removed for Firefox');
  }

  if (!manifest.browser_specific_settings?.gecko?.id) {
    errors.push('Missing browser_specific_settings.gecko.id');
  }

  if (!manifest.browser_specific_settings?.gecko?.strict_min_version) {
    errors.push('Missing browser_specific_settings.gecko.strict_min_version');
  }

  if (manifest.manifest_version !== 3) {
    errors.push(`Expected manifest_version 3, got ${manifest.manifest_version}`);
  }

  if (!manifest.background?.service_worker) {
    errors.push('Missing background.service_worker (required for MV3 Firefox 128+)');
  }

  return { valid: errors.length === 0, errors };
}

// CLI execution
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('firefox-manifest.js') || process.argv[1].endsWith('firefox-manifest'));

if (isDirectRun) {
  // Parse --output flag
  const outputIdx = process.argv.indexOf('--output');
  const outputDir = outputIdx !== -1 ? process.argv[outputIdx + 1] : 'dist';

  const inputPath = path.resolve('dist', 'manifest.json');
  const outputPath = path.resolve(outputDir, 'manifest.json');

  if (!existsSync(inputPath)) {
    console.error(`❌ ${inputPath} not found. Run the build first (npm run build:prod).`);
    process.exit(1);
  }

  const chromeManifest = JSON.parse(readFileSync(inputPath, 'utf8'));
  const firefoxManifest = transformManifest(chromeManifest);
  const validation = validateFirefoxManifest(firefoxManifest);

  if (!validation.valid) {
    console.error('❌ Firefox manifest validation failed:');
    validation.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  writeFileSync(outputPath, JSON.stringify(firefoxManifest, null, 2) + '\n');
  console.log(`✅ Firefox manifest written to ${outputPath}`);
  console.log(`   gecko.id: ${firefoxManifest.browser_specific_settings.gecko.id}`);
  console.log(
    `   strict_min_version: ${firefoxManifest.browser_specific_settings.gecko.strict_min_version}`,
  );
}
