/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unsafe-argument */
// @ts-nocheck — Testing an untyped JS build script; type-level strictness adds no value here.
import { describe, it, expect } from 'vitest';
import { transformManifest, validateFirefoxManifest } from '../scripts/firefox-manifest.js';

// Minimal Chrome manifest that mirrors the real one's structure
function chromeManifest(): Record<string, unknown> {
  return {
    name: 'Consistent Subtitle Style',
    description: 'Configure persistent subtitle styles across streaming services',
    version: '1.1.0',
    manifest_version: 3,
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzXD/kT...DAQAB',
    action: {
      default_popup: 'index.html',
      default_title: 'Consistent Subtitle Style',
      default_icon: {
        '16': 'images/logo-16.png',
        '48': 'images/logo-48.png',
        '128': 'images/logo-128.png',
      },
    },
    permissions: ['storage', 'activeTab'],
    content_scripts: [
      {
        js: ['injection.js'],
        matches: ['*://*.youtube.com/*', '*://*.nebula.tv/*', '*://*.dropout.tv/*'],
        run_at: 'document_idle',
        all_frames: true,
      },
    ],
    web_accessible_resources: [
      {
        resources: ['platforms.js', 'storage.js', 'main.js', 'bridge.js'],
        matches: ['*://*.youtube.com/*', '*://*.nebula.tv/*'],
      },
    ],
    icons: {
      '16': 'images/logo-16.png',
      '48': 'images/logo-48.png',
      '128': 'images/logo-128.png',
    },
    background: { service_worker: 'background.js' },
  };
}

/** Helper to access nested gecko settings from a transformed manifest */
function gecko(manifest: Record<string, unknown>) {
  const bss = manifest.browser_specific_settings as Record<string, unknown> | undefined;
  return bss?.gecko as Record<string, unknown> | undefined;
}

describe('transformManifest', () => {
  it('should remove the Chrome key field', () => {
    const result = transformManifest(chromeManifest());
    expect(result.key).toBeUndefined();
  });

  it('should add browser_specific_settings.gecko', () => {
    const result = transformManifest(chromeManifest());
    expect(result.browser_specific_settings).toBeDefined();
    const g = gecko(result);
    expect(g).toBeDefined();
    expect(g?.id).toBe('consistent-subtitle-style@joald');
    expect(g?.strict_min_version).toBe('128.0');
  });

  it('should not mutate the input manifest', () => {
    const input = chromeManifest();
    const originalKey = input.key;
    transformManifest(input);
    expect(input.key).toBe(originalKey);
    expect(input.browser_specific_settings).toBeUndefined();
  });

  it('should preserve all non-key Chrome fields', () => {
    const input = chromeManifest();
    const result = transformManifest(input);

    expect(result.name).toBe(input.name);
    expect(result.description).toBe(input.description);
    expect(result.version).toBe(input.version);
    expect(result.manifest_version).toBe(3);
    expect(result.action).toEqual(input.action);
    expect(result.permissions).toEqual(input.permissions);
    expect(result.content_scripts).toEqual(input.content_scripts);
    expect(result.web_accessible_resources).toEqual(input.web_accessible_resources);
    expect(result.icons).toEqual(input.icons);
    expect(result.background).toEqual(input.background);
  });

  it('should work when key field is already absent', () => {
    const input = chromeManifest();
    delete input.key;
    const result = transformManifest(input);
    expect(result.key).toBeUndefined();
    expect(gecko(result)?.id).toBe('consistent-subtitle-style@joald');
  });

  it('should produce a manifest with the correct field count', () => {
    const input = chromeManifest();
    const result = transformManifest(input);
    // Chrome has key, Firefox has browser_specific_settings → same number of top-level fields
    const inputKeys = Object.keys(input).length; // includes key
    const resultKeys = Object.keys(result).length; // has browser_specific_settings, no key
    expect(resultKeys).toBe(inputKeys); // key removed + browser_specific_settings added = same count
  });
});

describe('validateFirefoxManifest', () => {
  it('should pass for a valid Firefox manifest', () => {
    const manifest = transformManifest(chromeManifest());
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail if Chrome key is still present', () => {
    const manifest = transformManifest(chromeManifest());
    manifest.key = 'some-key';
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Chrome "key" field should be removed for Firefox');
  });

  it('should fail if gecko.id is missing', () => {
    const manifest = transformManifest(chromeManifest());
    const g = gecko(manifest);
    delete g?.id;
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing browser_specific_settings.gecko.id');
  });

  it('should fail if gecko.strict_min_version is missing', () => {
    const manifest = transformManifest(chromeManifest());
    const g = gecko(manifest);
    delete g?.strict_min_version;
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing browser_specific_settings.gecko.strict_min_version');
  });

  it('should fail if browser_specific_settings is entirely missing', () => {
    const manifest = transformManifest(chromeManifest());
    delete manifest.browser_specific_settings;
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('should fail if manifest_version is not 3', () => {
    const manifest = transformManifest(chromeManifest());
    manifest.manifest_version = 2;
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Expected manifest_version 3, got 2');
  });

  it('should fail if background.service_worker is missing', () => {
    const manifest = transformManifest(chromeManifest());
    delete manifest.background;
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Missing background.service_worker (required for MV3 Firefox 128+)',
    );
  });

  it('should collect multiple errors at once', () => {
    const manifest: Record<string, unknown> = {
      name: 'Test',
      manifest_version: 2,
      key: 'should-not-be-here',
    };
    const result = validateFirefoxManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should validate the real manifest.json structure', async () => {
    const fs = await import('node:fs');
    const realManifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8')) as Record<
      string,
      unknown
    >;
    const transformed = transformManifest(realManifest);
    const result = validateFirefoxManifest(transformed);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Verify key was actually present in original and removed
    expect(realManifest.key).toBeDefined();
    expect(transformed.key).toBeUndefined();
  });
});
