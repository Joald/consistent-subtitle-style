import esbuild from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Configuration
const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

// Create dist directory if it doesn't exist
if (!existsSync('./dist')) {
  mkdirSync('./dist', { recursive: true });
}

// Base configuration
const baseConfig = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: isProduction,
  sourcemap: !isProduction,
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    DEBUG: `${!isProduction}`,
  },
};

// Build function
async function build() {
  try {
    console.log(`Building ${isProduction ? 'production' : 'development'} version...`);

    // Build content scripts (separate files for manifest)
    try {
      await esbuild.build({
        ...baseConfig,
        entryPoints: ['src/platforms/index.ts'],
        outfile: 'dist/platforms.js',
      });
      console.log('Built platforms.js');

      await esbuild.build({
        ...baseConfig,
        entryPoints: ['src/storage.ts'],
        outfile: 'dist/storage.js',
      });
      console.log('Built storage.js');

      await esbuild.build({
        ...baseConfig,
        entryPoints: ['src/main.ts'],
        outfile: 'dist/main.js',
      });
      console.log('Built main.js');

      await esbuild.build({
        ...baseConfig,
        entryPoints: ['src/injection.ts'],
        outfile: 'dist/injection.js',
      });
      console.log('Built injection.js');

      await esbuild.build({
        ...baseConfig,
        entryPoints: ['src/bridge.ts'],
        outfile: 'dist/bridge.js',
      });
      console.log('Built bridge.js');
    } catch (buildError) {
      console.error('Content script build failed:', buildError);
      throw buildError;
    }

    // Build popup script
    await esbuild.build({
      ...baseConfig,
      entryPoints: ['src/ui/popup.ts'],
      outfile: 'dist/popup.js',
    });

    // Copy static files with unique version to force new extension ID
    await copyStaticFiles();

    // Generate PNGs from HTML
    await generatePngs();

    console.log('Build completed successfully!');

    if (isWatch) {
      console.log('Watching for changes...');
      // Start watch mode separately
      const ctx = await esbuild.context({
        ...baseConfig,
        entryPoints: [
          'src/platforms/index.ts',
          'src/storage.ts',
          'src/main.ts',
          'src/injection.ts',
          'src/bridge.ts',
          'src/ui/popup.ts',
        ],
        outdir: 'dist',
        plugins: [
          {
            name: 'copy-on-rebuild',
            setup(build) {
              build.onEnd(async () => {
                await copyStaticFiles();
                await generatePngs();
              });
            },
          },
        ],
      });

      await ctx.watch();
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Copy static files function
async function copyStaticFiles() {
  const fs = await import('fs/promises');

  try {
    // Copy manifest.json (will be updated)
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

    // Keep version stable to preserve extension ID and settings across builds

    manifest.content_scripts[0].js = ['injection.js'];
    manifest.action.default_popup = 'index.html';
    writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

    // Copy UI files
    if (existsSync('src/ui/index.html')) {
      await fs.copyFile('src/ui/index.html', 'dist/index.html');
    }
    if (existsSync('src/ui/styles.css')) {
      await fs.copyFile('src/ui/styles.css', 'dist/styles.css');
    }

    // Copy images
    if (existsSync('images')) {
      await fs.cp('images', 'dist/images', { recursive: true });
    }
  } catch (error) {
    console.warn('Some static files could not be copied:', error.message);
  }
}

// Generate PNGs from HTML using Puppeteer
async function generatePngs() {
  const fs = await import('fs/promises');
  const puppeteer = await import('puppeteer');

  const sizes = [
    { html: 'logo-16.html', png: 'logo-16.png', width: 16, height: 16 },
    { html: 'logo-48.html', png: 'logo-48.png', width: 48, height: 48 },
    { html: 'logo-128.html', png: 'logo-128.png', width: 128, height: 128 },
    { html: 'logo-512.html', png: 'logo-512.png', width: 512, height: 512 },
  ];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const size of sizes) {
      const htmlPath = path.resolve('images', size.html);
      if (!existsSync(htmlPath)) {
        console.warn(`Skipping ${size.html} - not found`);
        continue;
      }

      const htmlContent = readFileSync(htmlPath, 'utf8');
      const page = await browser.newPage();

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });

      const outputPath = path.resolve('dist/images', size.png);
      await page.screenshot({ path: outputPath, omitBackground: false });

      // If it's the 512px logo, also copy it to the source images folder for README usage
      if (size.width === 512) {
        await fs.copyFile(outputPath, path.resolve('images', size.png));
      }

      await page.close();
      console.log(`Generated ${size.png}`);
    }
  } finally {
    await browser.close();
  }
}

// Run build
build();
