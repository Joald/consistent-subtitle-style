import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dropout } from '../src/platforms/dropout.js';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import type { StorageSettings } from '../src/types/index.js';

// Helper to pass invalid values through the typed applySetting interface.
// The runtime code handles these gracefully; we just need to bypass the
// compile-time union constraint for negative tests.
type AnySettingValue = StorageSettings[keyof StorageSettings];

// ── Platform Detection ──────────────────────────────────────────────────────

describe('dropout platform detection', () => {
  it('detects embed.vhx.tv as dropout', () => {
    vi.stubGlobal('location', { hostname: 'embed.vhx.tv', href: 'https://embed.vhx.tv/test' });
    expect(detectPlatform()).toBe('dropout');
  });

  it('detects www.dropout.tv as dropout', () => {
    vi.stubGlobal('location', {
      hostname: 'www.dropout.tv',
      href: 'https://www.dropout.tv/test',
    });
    expect(detectPlatform()).toBe('dropout');
  });

  it('returns correct config for dropout', () => {
    const config = getPlatformConfig('dropout');
    expect(config).not.toBeNull();
    expect(config?.name).toBe('Dropout');
  });

  it('has CSS selectors configured', () => {
    const css = dropout.css;
    expect(css).toBeDefined();
    expect(css?.subtitleContainerSelector).toBe('.vp-captions');
    expect(css?.selectors.subtitle).toContain('CaptionsRenderer_module_captionsLine');
    expect(css?.selectors.background).toContain('CaptionsRenderer_module_captionsLine');
    expect(css?.selectors.window).toContain('CaptionsRenderer_module_captionsWindow');
  });
});

// ── detectNativeCapabilities ────────────────────────────────────────────────

describe('dropout detectNativeCapabilities', () => {
  it('returns true for vhx.tv', () => {
    vi.stubGlobal('location', { hostname: 'embed.vhx.tv', href: 'https://embed.vhx.tv/test' });
    expect(dropout.detectNativeCapabilities?.()).toBe(true);
  });

  it('returns true for dropout.tv', () => {
    vi.stubGlobal('location', {
      hostname: 'www.dropout.tv',
      href: 'https://www.dropout.tv/test',
    });
    expect(dropout.detectNativeCapabilities?.()).toBe(true);
  });

  it('returns false for other hostnames', () => {
    vi.stubGlobal('location', { hostname: 'youtube.com', href: 'https://youtube.com' });
    expect(dropout.detectNativeCapabilities?.()).toBe(false);
  });
});

// ── nativeSettings: getCurrentValue defaults ────────────────────────────────
// Module-level currentValues starts empty, so all getCurrentValue calls should
// return 'auto'. These MUST run before any applySetting tests (vitest runs
// tests in declaration order within a file).

describe('dropout nativeSettings getCurrentValue defaults', () => {
  it('fontColor defaults to auto', () => {
    expect(dropout.nativeSettings?.fontColor.getCurrentValue()).toBe('auto');
  });

  it('fontOpacity always returns auto', () => {
    expect(dropout.nativeSettings?.fontOpacity.getCurrentValue()).toBe('auto');
  });

  it('backgroundColor defaults to auto', () => {
    expect(dropout.nativeSettings?.backgroundColor.getCurrentValue()).toBe('auto');
  });

  it('backgroundOpacity always returns auto', () => {
    expect(dropout.nativeSettings?.backgroundOpacity.getCurrentValue()).toBe('auto');
  });

  it('windowColor always returns auto', () => {
    expect(dropout.nativeSettings?.windowColor.getCurrentValue()).toBe('auto');
  });

  it('windowOpacity always returns auto', () => {
    expect(dropout.nativeSettings?.windowOpacity.getCurrentValue()).toBe('auto');
  });

  it('characterEdgeStyle defaults to auto', () => {
    expect(dropout.nativeSettings?.characterEdgeStyle.getCurrentValue()).toBe('auto');
  });

  it('fontFamily defaults to auto', () => {
    expect(dropout.nativeSettings?.fontFamily.getCurrentValue()).toBe('auto');
  });

  it('fontSize defaults to auto', () => {
    expect(dropout.nativeSettings?.fontSize.getCurrentValue()).toBe('auto');
  });
});

// ── nativeSettings: applySetting with valid values ──────────────────────────
// These call into applyVjsSetting which uses localStorage and DOM. jsdom
// provides both, so this works without extra mocking. The Vimeo player
// discovery will find nothing and return a postMessage fallback (harmless).

describe('dropout nativeSettings applySetting valid values', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      hostname: 'embed.vhx.tv',
      href: 'https://embed.vhx.tv/videos/123',
    });
  });

  it('fontColor accepts known colors', () => {
    const report = dropout.nativeSettings?.fontColor.applySetting('white');
    expect(report?.success).toBe(true);
  });

  it('fontOpacity accepts known opacity values', () => {
    const report = dropout.nativeSettings?.fontOpacity.applySetting('75');
    expect(report?.success).toBe(true);
  });

  it('backgroundColor accepts known colors', () => {
    const report = dropout.nativeSettings?.backgroundColor.applySetting('black');
    expect(report?.success).toBe(true);
  });

  it('backgroundOpacity accepts known opacity values', () => {
    const report = dropout.nativeSettings?.backgroundOpacity.applySetting('50');
    expect(report?.success).toBe(true);
  });

  it('windowColor accepts known colors', () => {
    const report = dropout.nativeSettings?.windowColor.applySetting('yellow');
    expect(report?.success).toBe(true);
  });

  it('windowOpacity accepts known opacity values', () => {
    const report = dropout.nativeSettings?.windowOpacity.applySetting('100');
    expect(report?.success).toBe(true);
  });

  it('characterEdgeStyle accepts known styles', () => {
    const report = dropout.nativeSettings?.characterEdgeStyle.applySetting('dropshadow');
    expect(report?.success).toBe(true);
  });

  it('fontFamily accepts known families', () => {
    const report = dropout.nativeSettings?.fontFamily.applySetting('casual');
    expect(report?.success).toBe(true);
  });

  it('fontSize accepts known sizes', () => {
    const report = dropout.nativeSettings?.fontSize.applySetting('150%');
    expect(report?.success).toBe(true);
  });
});

// ── nativeSettings: applySetting with invalid values ────────────────────────

describe('dropout nativeSettings applySetting invalid values', () => {
  it('fontColor rejects unknown colors', () => {
    const report = dropout.nativeSettings?.fontColor.applySetting('purple' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown color');
  });

  it('fontOpacity rejects unknown opacity', () => {
    const report = dropout.nativeSettings?.fontOpacity.applySetting('99' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown opacity');
  });

  it('backgroundColor rejects unknown colors', () => {
    const report = dropout.nativeSettings?.backgroundColor.applySetting(
      'orange' as AnySettingValue,
    );
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown color');
  });

  it('backgroundOpacity rejects unknown opacity', () => {
    const report = dropout.nativeSettings?.backgroundOpacity.applySetting('33' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown opacity');
  });

  it('windowColor rejects unknown colors', () => {
    const report = dropout.nativeSettings?.windowColor.applySetting('orange' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown color');
  });

  it('windowOpacity rejects unknown opacity', () => {
    const report = dropout.nativeSettings?.windowOpacity.applySetting('10' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown opacity');
  });

  it('characterEdgeStyle rejects unknown styles', () => {
    const report = dropout.nativeSettings?.characterEdgeStyle.applySetting(
      'glow' as AnySettingValue,
    );
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown style');
  });

  it('fontFamily rejects unknown families', () => {
    const report = dropout.nativeSettings?.fontFamily.applySetting('papyrus' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown family');
  });

  it('fontSize rejects unknown sizes', () => {
    const report = dropout.nativeSettings?.fontSize.applySetting('250%' as AnySettingValue);
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('Unknown size');
  });
});

// ── nativeSettings: getCurrentValue reflects applied values ─────────────────
// The module-level `currentValues` record is populated by applySetting. Some
// settings read from it (fontColor, backgroundColor, characterEdgeStyle,
// fontFamily, fontSize); others always return 'auto' (fontOpacity,
// backgroundOpacity, windowColor, windowOpacity).

describe('dropout nativeSettings getCurrentValue after apply', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      hostname: 'embed.vhx.tv',
      href: 'https://embed.vhx.tv/videos/123',
    });
  });

  it('fontColor reflects applied value via reverse color map', () => {
    // applySetting stores the hex in currentValues['color']
    dropout.nativeSettings?.fontColor.applySetting('red');
    // getCurrentValue does REVERSE_COLOR_MAP[hex] → name
    expect(dropout.nativeSettings?.fontColor.getCurrentValue()).toBe('red');
  });

  it('backgroundColor reflects applied value directly', () => {
    // applySetting stores the name directly in currentValues['bgColor']
    dropout.nativeSettings?.backgroundColor.applySetting('green');
    expect(dropout.nativeSettings?.backgroundColor.getCurrentValue()).toBe('green');
  });

  it('characterEdgeStyle reflects applied value via reverse map', () => {
    // applySetting stores Vimeo name (e.g. 'shadow') in currentValues['edgeStyle']
    dropout.nativeSettings?.characterEdgeStyle.applySetting('dropshadow');
    // getCurrentValue does REVERSE_EDGE_STYLE_MAP['shadow'] → 'dropshadow'
    expect(dropout.nativeSettings?.characterEdgeStyle.getCurrentValue()).toBe('dropshadow');
  });

  it('fontFamily reflects applied value via reverse map', () => {
    dropout.nativeSettings?.fontFamily.applySetting('cursive');
    expect(dropout.nativeSettings?.fontFamily.getCurrentValue()).toBe('cursive');
  });

  it('fontSize reflects applied value via reverse map', () => {
    dropout.nativeSettings?.fontSize.applySetting('200%');
    expect(dropout.nativeSettings?.fontSize.getCurrentValue()).toBe('200%');
  });

  it('fontOpacity still returns auto after apply (by design)', () => {
    dropout.nativeSettings?.fontOpacity.applySetting('50');
    expect(dropout.nativeSettings?.fontOpacity.getCurrentValue()).toBe('auto');
  });

  it('backgroundOpacity still returns auto after apply (by design)', () => {
    dropout.nativeSettings?.backgroundOpacity.applySetting('75');
    expect(dropout.nativeSettings?.backgroundOpacity.getCurrentValue()).toBe('auto');
  });

  it('windowColor still returns auto after apply (by design)', () => {
    dropout.nativeSettings?.windowColor.applySetting('cyan');
    expect(dropout.nativeSettings?.windowColor.getCurrentValue()).toBe('auto');
  });

  it('windowOpacity still returns auto after apply (by design)', () => {
    dropout.nativeSettings?.windowOpacity.applySetting('25');
    expect(dropout.nativeSettings?.windowOpacity.getCurrentValue()).toBe('auto');
  });
});
