import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Get version from package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;
const zipName = `${version}.zip`;
const buildDir = 'dist';
const releaseDir = 'releases';

console.log(`🚀 Starting release process for version ${version}...`);

try {
  // 1. Run build
  console.log('📦 Building project...');
  execSync('npm run build:prod', { stdio: 'inherit' });

  // 2. Create releases directory if it doesn't exist
  if (!fs.existsSync(releaseDir)) {
    console.log(`📁 Creating ${releaseDir} directory...`);
    fs.mkdirSync(releaseDir);
  }

  const outputPath = path.join(releaseDir, zipName);
  const absoluteOutputPath = path.resolve(outputPath);

  const absoluteBuildDir = path.resolve(buildDir);

  // 3. Zip the dist folder contents

  console.log(`🗜️  Zipping ${buildDir} to ${outputPath}...`);

  if (process.platform === 'win32') {
    // path.resolve gives us backslashes on Windows which PowerShell likes
    // We use PowerShell's Compress-Archive
    // We remove the existing file if it exists because Compress-Archive might fail or append
    if (fs.existsSync(absoluteOutputPath)) {
      fs.unlinkSync(absoluteOutputPath);
    }
    const psCommand = `powershell -Command "Compress-Archive -Path '${absoluteBuildDir}\\*' -DestinationPath '${absoluteOutputPath}' -Force"`;
    execSync(psCommand, { stdio: 'inherit' });
  } else {
    // On Unix-like systems, zip is usually available
    execSync(`zip -r ../${outputPath} .`, { cwd: buildDir, stdio: 'inherit' });
  }

  console.log(`✅ Release created successfully: ${outputPath}`);
} catch (error) {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
}
