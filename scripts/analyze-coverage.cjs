#!/usr/bin/env node
/**
 * Static coverage analysis for Consistent Subtitle Style.
 *
 * Produces per-file symbol coverage and test mapping.
 * Uses import analysis + name convention matching + vi.mock() detection.
 *
 * Usage: node scripts/analyze-coverage.cjs [--json] [--summary]
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const TESTS_DIR = path.join(__dirname, '..', 'tests');
const OUTPUT_FILE = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

// ─── Helpers ───────────────────────────────────────────────────────

function findFiles(dir, ext, prefix = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...findFiles(path.join(dir, entry.name), ext, rel));
    } else if (entry.name.endsWith(ext) && !entry.name.endsWith('.d.ts')) {
      results.push(rel);
    }
  }
  return results;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const total = lines.length;
  const blank = lines.filter((l) => l.trim() === '').length;
  const comment = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
  }).length;
  const code = total - blank - comment;
  return { total, blank, comment, code, content };
}

function extractExports(content, filePath) {
  const exports = [];
  const isTypeFile = filePath.includes('types/');
  // Runtime exports (functions, consts, classes, enums)
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+let\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+enum\s+(\w+)/g,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(content)) !== null) {
      exports.push(m[1]);
    }
  }
  // Non-exported top-level functions
  const fnPattern = /^(?:async\s+)?function\s+(\w+)/gm;
  let m;
  while ((m = fnPattern.exec(content)) !== null) {
    if (!exports.includes(m[1])) exports.push(m[1]);
  }
  // Count type exports separately (for reporting but not symbol coverage)
  const typeExports = [];
  if (isTypeFile) {
    const typePatterns = [/export\s+type\s+(\w+)/g, /export\s+interface\s+(\w+)/g];
    for (const pat of typePatterns) {
      let m2;
      while ((m2 = pat.exec(content)) !== null) {
        typeExports.push(m2[1]);
      }
    }
  }
  return { runtime: [...new Set(exports)], types: [...new Set(typeExports)] };
}

function extractAllRefs(content) {
  // Extract all import paths (both import {} from, vi.mock(), and dynamic imports)
  const refs = new Set();

  // import { ... } from '../src/...'
  const importPattern = /from\s+['"]([^'"]*src[^'"]*)['"]/g;
  let m;
  while ((m = importPattern.exec(content)) !== null) {
    refs.add(m[1]);
  }

  // vi.mock('../src/...')
  const mockPattern = /vi\.mock\s*\(\s*['"]([^'"]*src[^'"]*)['"]/g;
  while ((m = mockPattern.exec(content)) !== null) {
    refs.add(m[1]);
  }

  // Dynamic import('../src/...') or await import('../src/...')
  const dynPattern = /import\s*\(\s*['"]([^'"]*)['"]\s*\)/g;
  while ((m = dynPattern.exec(content)) !== null) {
    if (m[1].startsWith('.')) refs.add(m[1]);
  }

  return [...refs];
}

function countTestAssertions(content) {
  let count = 0;
  const expectPattern = /expect\s*\(/g;
  while (expectPattern.exec(content)) count++;
  return count;
}

function countTestCases(content) {
  let count = 0;
  const testPattern = /\b(?:it|test)\s*\(/g;
  while (testPattern.exec(content)) count++;
  return count;
}

function matchRefToSrcFile(ref, srcFiles) {
  // Normalize: strip .js/.ts extension, strip leading ../ chains
  const cleaned = ref.replace(/\.(js|ts)$/, '').replace(/^(\.\.\/)+/, '');
  // Extract the part after 'src/'
  const afterSrc = cleaned.includes('src/') ? cleaned.split('src/').pop() : cleaned;

  for (const srcFile of srcFiles) {
    const srcBase = srcFile.replace(/\.ts$/, '');
    if (srcBase === afterSrc) return srcFile;
    // Also try matching the end portion
    if (afterSrc && srcBase.endsWith(afterSrc)) return srcFile;
    if (afterSrc && afterSrc.endsWith(srcBase)) return srcFile;
    // Match last segment
    const srcLast = srcBase.split('/').pop();
    const refLast = afterSrc ? afterSrc.split('/').pop() : '';
    if (srcLast === refLast && srcLast !== 'index') return srcFile;
  }
  return null;
}

function matchTestToSrcByName(testFile, srcFiles) {
  // tests/foo.test.ts → src/foo.ts
  // tests/youtube.test.ts → src/platforms/youtube.ts
  const testBase = testFile.replace(/\.test\.ts$/, '');

  for (const srcFile of srcFiles) {
    const srcBase = srcFile.replace(/\.ts$/, '');
    // Direct match: tests/debug.test.ts → src/debug.ts
    if (srcBase === testBase) return srcFile;
    // Platform match: tests/youtube.test.ts → src/platforms/youtube.ts
    if (srcBase === `platforms/${testBase}`) return srcFile;
    // UI match: tests/popup.test.ts → src/ui/popup.ts
    if (srcBase === `ui/${testBase}`) return srcFile;
  }
  return null;
}

// ─── Main Analysis ─────────────────────────────────────────────────

function analyze() {
  const srcFiles = findFiles(SRC_DIR, '.ts');
  const testFiles = findFiles(TESTS_DIR, '.test.ts');

  const sourceAnalysis = {};
  const testAnalysis = {};
  const coverageMap = {};

  // Analyze source files
  for (const file of srcFiles) {
    const filePath = path.join(SRC_DIR, file);
    const { total, blank, comment, code, content } = countLines(filePath);
    const { runtime: exports, types: typeExports } = extractExports(content, file);
    sourceAnalysis[file] = { total, blank, comment, code, exports, typeExports };
    coverageMap[file] = {
      testedSymbols: [],
      untestedSymbols: [...exports],
      assertions: 0,
      testCases: 0,
      testFiles: [],
      typeExportCount: typeExports.length,
    };
  }

  // Analyze test files
  for (const testFile of testFiles) {
    const filePath = path.join(TESTS_DIR, testFile);
    const { content } = countLines(filePath);
    const refs = extractAllRefs(content);
    const assertions = countTestAssertions(content);
    const testCases = countTestCases(content);

    testAnalysis[testFile] = { assertions, testCases, refs };

    // Map refs to source files
    const mappedSrcFiles = new Set();
    for (const ref of refs) {
      const matched = matchRefToSrcFile(ref, srcFiles);
      if (matched) mappedSrcFiles.add(matched);
    }

    // Also try name-based matching
    const nameMatch = matchTestToSrcByName(testFile, srcFiles);
    if (nameMatch) mappedSrcFiles.add(nameMatch);

    // Apply mappings
    for (const srcFile of mappedSrcFiles) {
      if (!coverageMap[srcFile].testFiles.includes(testFile)) {
        coverageMap[srcFile].testFiles.push(testFile);
      }

      // Check if this is a dynamic/full-module import (tests via side effects)
      const isDynamicImport = refs.some((r) => {
        const m = matchRefToSrcFile(r, [srcFile]);
        return (
          (m && content.includes(`import('`)) ||
          content.includes(`import ("`) ||
          content.includes(`import(\``)
        );
      });

      // Mark symbols as tested if they appear in test content
      for (const sym of [...coverageMap[srcFile].untestedSymbols]) {
        const regex = new RegExp(`\\b${sym}\\b`);
        if (regex.test(content)) {
          const idx = coverageMap[srcFile].untestedSymbols.indexOf(sym);
          if (idx >= 0) {
            coverageMap[srcFile].untestedSymbols.splice(idx, 1);
            coverageMap[srcFile].testedSymbols.push(sym);
          }
        }
      }

      // For dynamic imports, mark all remaining non-type exports as exercised
      // (the module runs its side effects which exercise internal functions)
      if (isDynamicImport && coverageMap[srcFile].untestedSymbols.length > 0) {
        const remaining = [...coverageMap[srcFile].untestedSymbols];
        coverageMap[srcFile].testedSymbols.push(...remaining);
        coverageMap[srcFile].untestedSymbols = [];
      }
    }
  }

  // For files with test files but 0 exports (like background.ts), count assertions from matched test files
  for (const [srcFile, cov] of Object.entries(coverageMap)) {
    let totalAssert = 0;
    let totalCases = 0;
    for (const tf of cov.testFiles) {
      totalAssert += testAnalysis[tf].assertions;
      totalCases += testAnalysis[tf].testCases;
    }
    cov.assertions = totalAssert;
    cov.testCases = totalCases;
  }

  // Deduplicate
  for (const file of Object.keys(coverageMap)) {
    coverageMap[file].testedSymbols = [...new Set(coverageMap[file].testedSymbols)];
  }

  return { sourceAnalysis, testAnalysis, coverageMap };
}

function formatReport({ sourceAnalysis, testAnalysis, coverageMap }) {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const summaryOnly = args.includes('--summary');

  let totalSrcLines = 0,
    totalCodeLines = 0,
    totalExports = 0;
  let totalTestedSymbols = 0,
    totalUntestedSymbols = 0;
  let totalAssertions = 0,
    totalTestCases = 0;
  let filesWithTests = 0,
    filesWithoutTests = 0;

  for (const data of Object.values(sourceAnalysis)) {
    totalSrcLines += data.total;
    totalCodeLines += data.code;
    totalExports += data.exports.length;
  }
  for (const data of Object.values(coverageMap)) {
    totalTestedSymbols += data.testedSymbols.length;
    totalUntestedSymbols += data.untestedSymbols.length;
    if (data.testFiles.length > 0) filesWithTests++;
    else filesWithoutTests++;
  }
  for (const data of Object.values(testAnalysis)) {
    totalAssertions += data.assertions;
    totalTestCases += data.testCases;
  }

  const symbolCoveragePct =
    totalExports > 0 ? ((totalTestedSymbols / totalExports) * 100).toFixed(1) : '0.0';
  const fileCoveragePct =
    filesWithTests + filesWithoutTests > 0
      ? ((filesWithTests / (filesWithTests + filesWithoutTests)) * 100).toFixed(1)
      : '0.0';

  const summary = {
    timestamp: new Date().toISOString(),
    totals: {
      sourceFiles: Object.keys(sourceAnalysis).length,
      testFiles: Object.keys(testAnalysis).length,
      totalLines: totalSrcLines,
      codeLines: totalCodeLines,
      totalExports,
      testedSymbols: totalTestedSymbols,
      untestedSymbols: totalUntestedSymbols,
      symbolCoveragePct: parseFloat(symbolCoveragePct),
      fileCoveragePct: parseFloat(fileCoveragePct),
      filesWithTests,
      filesWithoutTests,
      totalTestCases,
      totalAssertions,
    },
    files: {},
  };

  for (const file of Object.keys(sourceAnalysis).sort()) {
    const src = sourceAnalysis[file];
    const cov = coverageMap[file];
    const pct =
      src.exports.length > 0
        ? ((cov.testedSymbols.length / src.exports.length) * 100).toFixed(1)
        : cov.testFiles.length > 0
          ? 'tested'
          : null;
    summary.files[file] = {
      lines: src.total,
      codeLines: src.code,
      exports: src.exports.length,
      testedSymbols: cov.testedSymbols.length,
      untestedSymbols: cov.untestedSymbols,
      symbolCoveragePct: pct === 'tested' ? 100 : pct ? parseFloat(pct) : null,
      testFiles: cov.testFiles,
      assertions: cov.assertions,
      testCases: cov.testCases,
    };
  }

  if (jsonOnly) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       Consistent Subtitle Style — Coverage Report       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Source files:       ${summary.totals.sourceFiles}`);
  console.log(`  Test files:         ${summary.totals.testFiles}`);
  console.log(`  Total lines:        ${summary.totals.totalLines}`);
  console.log(`  Code lines:         ${summary.totals.codeLines}`);
  console.log(`  Total test cases:   ${summary.totals.totalTestCases}`);
  console.log(`  Total assertions:   ${summary.totals.totalAssertions}`);
  console.log();
  console.log(
    `  📊 Symbol Coverage: ${symbolCoveragePct}% (${totalTestedSymbols}/${totalExports} exports tested)`,
  );
  console.log(
    `  📁 File Coverage:   ${fileCoveragePct}% (${filesWithTests}/${filesWithTests + filesWithoutTests} files have tests)`,
  );
  console.log();

  if (!summaryOnly) {
    console.log(
      '┌─────────────────────────────────────┬───────┬──────┬─────────┬─────────┬──────────┐',
    );
    console.log(
      '│ File                                │ Lines │ Code │ Exports │  Tests  │ Coverage │',
    );
    console.log(
      '├─────────────────────────────────────┼───────┼──────┼─────────┼─────────┼──────────┤',
    );

    for (const file of Object.keys(sourceAnalysis).sort()) {
      const src = sourceAnalysis[file];
      const cov = coverageMap[file];
      let pctStr;
      if (src.exports.length > 0) {
        const pct = ((cov.testedSymbols.length / src.exports.length) * 100).toFixed(0);
        pctStr = `${cov.testFiles.length > 0 ? '✓' : '✗'} ${pct}%`;
      } else {
        pctStr = cov.testFiles.length > 0 ? '✓ yes' : '✗ no';
      }
      const padFile = file.padEnd(35);
      const padLines = String(src.total).padStart(5);
      const padCode = String(src.code).padStart(4);
      const padExports = String(src.exports.length).padStart(7);
      const padTests = String(cov.testCases).padStart(7);
      const padPct = pctStr.padStart(8);
      console.log(
        `│ ${padFile} │ ${padLines} │ ${padCode} │ ${padExports} │ ${padTests} │ ${padPct} │`,
      );
    }

    console.log(
      '└─────────────────────────────────────┴───────┴──────┴─────────┴─────────┴──────────┘',
    );
    console.log();

    const untested = Object.entries(coverageMap)
      .filter(([, d]) => d.untestedSymbols.length > 0)
      .sort((a, b) => b[1].untestedSymbols.length - a[1].untestedSymbols.length);

    if (untested.length > 0) {
      console.log('  ⚠️  Untested symbols:');
      for (const [file, data] of untested) {
        console.log(`    ${file}: ${data.untestedSymbols.join(', ')}`);
      }
      console.log();
    }

    const noTests = Object.entries(coverageMap)
      .filter(([, d]) => d.testFiles.length === 0)
      .map(([f]) => f);
    if (noTests.length > 0) {
      console.log('  ❌ Files without test coverage:');
      for (const f of noTests) {
        console.log(`    ${f}`);
      }
      console.log();
    }
  }

  // Write JSON
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));
  console.log(`  📄 JSON report written to: coverage/coverage-summary.json`);
  return summary;
}

const result = analyze();
formatReport(result);
