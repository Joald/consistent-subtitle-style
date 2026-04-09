/**
 * Firefox release builder.
 *
 * Runs the production build, transforms the manifest for Firefox,
 * validates, and creates a release zip ready for AMO submission.
 *
 * Usage: node scripts/release-firefox.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { transformManifest, validateFirefoxManifest } from './firefox-manifest.js';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;
const zipName = `v${version}-firefox.zip`;
const buildDir = 'dist';
const releaseDir = 'releases';

console.log(`🦊 Starting Firefox release for version ${version}...`);

try {
  // 1. Run production build (creates dist/ with Chrome manifest)
  console.log('📦 Building project...');
  execSync('npm run build:prod', { stdio: 'inherit' });

  // 2. Transform manifest for Firefox
  console.log('🔧 Transforming manifest for Firefox...');
  const manifestPath = path.resolve(buildDir, 'manifest.json');
  const chromeManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const firefoxManifest = transformManifest(chromeManifest);

  // 3. Validate
  const validation = validateFirefoxManifest(firefoxManifest);
  if (!validation.valid) {
    console.error('❌ Firefox manifest validation failed:');
    validation.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 4. Write transformed manifest back
  fs.writeFileSync(manifestPath, JSON.stringify(firefoxManifest, null, 2) + '\n');
  console.log('✅ Firefox manifest written');

  // 5. Create releases directory
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir);
  }

  const outputPath = path.join(releaseDir, zipName);

  // 6. Remove existing zip if present
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  // 7. Zip
  console.log(`🗜️  Zipping ${buildDir} to ${outputPath}...`);
  if (process.platform === 'win32') {
    const abs = path.resolve(outputPath);
    const absBuild = path.resolve(buildDir);
    execSync(
      `powershell -Command "Compress-Archive -Path '${absBuild}\\*' -DestinationPath '${abs}' -Force"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`zip -r ../${outputPath} .`, { cwd: buildDir, stdio: 'inherit' });
  }

  console.log(`✅ Firefox release created: ${outputPath}`);

  // 8. Restore Chrome manifest so dist/ stays valid for Chrome dev-loading
  console.log('🔄 Restoring Chrome manifest in dist/...');
  fs.writeFileSync(manifestPath, JSON.stringify(chromeManifest, null, 2) + '\n');
} catch (error) {
  console.error('❌ Firefox release failed:', error.message);
  process.exit(1);
}
