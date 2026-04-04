import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { youtube } from '../src/platforms/youtube.js';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import type { YouTubePlayerElement, StorageSettings } from '../src/types/index.js';

// Helper to pass iterated string values through the typed applySetting interface.
type AnySettingValue = StorageSettings[keyof StorageSettings];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create a mock YouTube player element with optional subtitle settings. */
function createMockPlayer(
  settings: Record<string, unknown> = {},
): YouTubePlayerElement & HTMLElement {
  const el = document.createElement('div');
  el.classList.add('html5-video-player');
  const player = el as unknown as YouTubePlayerElement & HTMLElement;
  player.getSubtitlesUserSettings = vi.fn().mockReturnValue(settings);
  player.updateSubtitlesUserSettings = vi.fn();
  return player;
}

// ── Platform Detection ──────────────────────────────────────────────────────

describe('youtube platform detection', () => {
  it('detects www.youtube.com', () => {
    vi.stubGlobal('location', { hostname: 'www.youtube.com', pathname: '/' });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects youtube.com without subdomain', () => {
    vi.stubGlobal('location', { hostname: 'youtube.com', pathname: '/' });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects youtube.com on watch page', () => {
    vi.stubGlobal('location', {
      hostname: 'www.youtube.com',
      pathname: '/watch',
    });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects youtube.com on shorts page', () => {
    vi.stubGlobal('location', {
      hostname: 'www.youtube.com',
      pathname: '/shorts/abc123',
    });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects youtube.com on channel page', () => {
    vi.stubGlobal('location', {
      hostname: 'www.youtube.com',
      pathname: '/@channel',
    });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects m.youtube.com (mobile)', () => {
    vi.stubGlobal('location', { hostname: 'm.youtube.com', pathname: '/' });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects music.youtube.com', () => {
    vi.stubGlobal('location', { hostname: 'music.youtube.com', pathname: '/' });
    expect(detectPlatform()).toBe('youtube');
  });

  it('does NOT detect unrelated domains containing "youtube"', () => {
    vi.stubGlobal('location', { hostname: 'youtube.fakesite.com', pathname: '/' });
    expect(detectPlatform()).not.toBe('youtube');
  });
});

// ── Platform Config ─────────────────────────────────────────────────────────

describe('youtube platform config', () => {
  it('returns correct config for youtube', () => {
    const config = getPlatformConfig('youtube');
    expect(config).not.toBeNull();
    expect(config?.name).toBe('YouTube');
  });

  it('has no CSS selectors (uses native API)', () => {
    expect(youtube.css).toBeUndefined();
  });

  it('detectNativeCapabilities returns true', () => {
    expect(youtube.detectNativeCapabilities?.()).toBe(true);
  });

  it('has nativeSettings defined', () => {
    expect(youtube.nativeSettings).toBeDefined();
  });

  it('has all expected native setting keys', () => {
    const expectedKeys = [
      'characterEdgeStyle',
      'backgroundOpacity',
      'windowOpacity',
      'fontColor',
      'fontOpacity',
      'backgroundColor',
      'windowColor',
      'fontFamily',
      'fontSize',
    ];
    for (const key of expectedKeys) {
      expect(youtube.nativeSettings).toHaveProperty(key);
    }
  });
});

// ── Native Settings: getCurrentValue ────────────────────────────────────────

describe('youtube nativeSettings getCurrentValue', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fontColor returns auto when no player is found', () => {
    expect(youtube.nativeSettings?.fontColor.getCurrentValue()).toBe('auto');
  });

  it('fontColor reads from player settings', () => {
    const player = createMockPlayer({ color: '#fff' });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontColor.getCurrentValue()).toBe('white');
  });

  it('fontColor returns auto for unrecognized color', () => {
    const player = createMockPlayer({ color: '#123456' });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontColor.getCurrentValue()).toBe('auto');
  });

  it('backgroundColor reads from player settings', () => {
    const player = createMockPlayer({ background: '#080808' });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.backgroundColor.getCurrentValue()).toBe('black');
  });

  it('windowColor reads from player settings', () => {
    const player = createMockPlayer({ windowColor: '#0ff' });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.windowColor.getCurrentValue()).toBe('cyan');
  });

  it('fontOpacity reads from player settings', () => {
    const player = createMockPlayer({ textOpacity: 0.75 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontOpacity.getCurrentValue()).toBe('75');
  });

  it('backgroundOpacity reads from player settings', () => {
    const player = createMockPlayer({ backgroundOpacity: 0.5 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.backgroundOpacity.getCurrentValue()).toBe('50');
  });

  it('windowOpacity reads from player settings', () => {
    const player = createMockPlayer({ windowOpacity: 1.0 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.windowOpacity.getCurrentValue()).toBe('100');
  });

  it('fontFamily reads from player settings', () => {
    const player = createMockPlayer({ fontFamily: 4 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontFamily.getCurrentValue()).toBe('proportional-sans-serif');
  });

  it('fontFamily returns auto for unknown family number', () => {
    const player = createMockPlayer({ fontFamily: 99 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontFamily.getCurrentValue()).toBe('auto');
  });

  it('fontSize reads from player settings', () => {
    const player = createMockPlayer({ fontSizeIncrement: 1 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontSize.getCurrentValue()).toBe('150%');
  });

  it('fontSize returns auto for unknown size increment', () => {
    const player = createMockPlayer({ fontSizeIncrement: 99 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.fontSize.getCurrentValue()).toBe('auto');
  });

  it('characterEdgeStyle reads from player settings', () => {
    const player = createMockPlayer({ charEdgeStyle: 4 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.characterEdgeStyle.getCurrentValue()).toBe('dropshadow');
  });

  it('characterEdgeStyle returns auto for unknown edge style', () => {
    const player = createMockPlayer({ charEdgeStyle: 99 });
    document.body.appendChild(player as unknown as HTMLElement);
    expect(youtube.nativeSettings?.characterEdgeStyle.getCurrentValue()).toBe('auto');
  });

  it('returns auto when player has no settings methods', () => {
    // Player element without the getSubtitlesUserSettings method
    const el = document.createElement('div');
    el.classList.add('html5-video-player');
    document.body.appendChild(el);
    expect(youtube.nativeSettings?.fontColor.getCurrentValue()).toBe('auto');
  });
});

// ── Native Settings: applySetting ───────────────────────────────────────────

describe('youtube nativeSettings applySetting', () => {
  let player: YouTubePlayerElement & HTMLElement;

  beforeEach(() => {
    player = createMockPlayer();
    document.body.appendChild(player as unknown as HTMLElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fontColor applies known color', () => {
    const report = youtube.nativeSettings?.fontColor.applySetting('yellow');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ color: '#ff0' });
  });

  it('fontOpacity applies as decimal', () => {
    const report = youtube.nativeSettings?.fontOpacity.applySetting('75');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ textOpacity: 0.75 });
  });

  it('fontOpacity skips auto value', () => {
    const report = youtube.nativeSettings?.fontOpacity.applySetting('auto');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).not.toHaveBeenCalled();
  });

  it('backgroundColor applies known color', () => {
    const report = youtube.nativeSettings?.backgroundColor.applySetting('black');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ background: '#080808' });
  });

  it('backgroundOpacity applies as decimal', () => {
    const report = youtube.nativeSettings?.backgroundOpacity.applySetting('50');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ backgroundOpacity: 0.5 });
  });

  it('backgroundOpacity skips auto value', () => {
    const report = youtube.nativeSettings?.backgroundOpacity.applySetting('auto');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).not.toHaveBeenCalled();
  });

  it('windowColor applies known color', () => {
    const report = youtube.nativeSettings?.windowColor.applySetting('cyan');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ windowColor: '#0ff' });
  });

  it('windowOpacity applies as decimal', () => {
    const report = youtube.nativeSettings?.windowOpacity.applySetting('100');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ windowOpacity: 1.0 });
  });

  it('windowOpacity skips auto value', () => {
    const report = youtube.nativeSettings?.windowOpacity.applySetting('auto');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).not.toHaveBeenCalled();
  });

  it('fontFamily applies known family', () => {
    const report = youtube.nativeSettings?.fontFamily.applySetting('casual');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ fontFamily: 5 });
  });

  it('fontFamily skips auto value', () => {
    const report = youtube.nativeSettings?.fontFamily.applySetting('auto');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).not.toHaveBeenCalled();
  });

  it('fontSize applies known size', () => {
    const report = youtube.nativeSettings?.fontSize.applySetting('200%');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ fontSizeIncrement: 2 });
  });

  it('fontSize skips auto value', () => {
    const report = youtube.nativeSettings?.fontSize.applySetting('auto');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).not.toHaveBeenCalled();
  });

  it('characterEdgeStyle applies known style', () => {
    const report = youtube.nativeSettings?.characterEdgeStyle.applySetting('outline');
    expect(report?.success).toBe(true);
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ charEdgeStyle: 3 });
  });

  it('reports failure when no player found', () => {
    document.body.innerHTML = ''; // Remove the player
    const report = youtube.nativeSettings?.fontColor.applySetting('white');
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('No active YouTube players');
  });

  it('applies to multiple players', () => {
    const player2 = createMockPlayer();
    document.body.appendChild(player2 as unknown as HTMLElement);

    const report = youtube.nativeSettings?.fontColor.applySetting('red');
    expect(report?.success).toBe(true);
    expect(report?.message).toContain('2 player(s)');
    expect(player.updateSubtitlesUserSettings).toHaveBeenCalledWith({ color: '#f00' });
    expect(player2.updateSubtitlesUserSettings).toHaveBeenCalledWith({ color: '#f00' });
  });
});

// ── Color Mapping Completeness ──────────────────────────────────────────────

describe('youtube color mapping', () => {
  const expectedColors = ['white', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'red', 'black'];

  let player: YouTubePlayerElement & HTMLElement;

  beforeEach(() => {
    player = createMockPlayer();
    document.body.appendChild(player as unknown as HTMLElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  for (const color of expectedColors) {
    it(`fontColor round-trips ${color}`, () => {
      youtube.nativeSettings?.fontColor.applySetting(color as AnySettingValue);
      // Get the hex value that was sent to the player
      const call = (player.updateSubtitlesUserSettings as ReturnType<typeof vi.fn>).mock.calls[0];
      const args = call?.[0] as Record<string, unknown> | undefined;
      const hex = args?.['color'] as string;

      // Create a player that returns this hex
      document.body.innerHTML = '';
      const readPlayer = createMockPlayer({ color: hex });
      document.body.appendChild(readPlayer as unknown as HTMLElement);

      expect(youtube.nativeSettings?.fontColor.getCurrentValue()).toBe(color);
    });
  }
});

// ── Font Family Mapping ─────────────────────────────────────────────────────

describe('youtube font family mapping', () => {
  const expectedFamilies = [
    'monospaced-serif',
    'proportional-serif',
    'monospaced-sans-serif',
    'proportional-sans-serif',
    'casual',
    'cursive',
    'small-caps',
  ];

  let player: YouTubePlayerElement & HTMLElement;

  beforeEach(() => {
    player = createMockPlayer();
    document.body.appendChild(player as unknown as HTMLElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  for (const family of expectedFamilies) {
    it(`fontFamily round-trips ${family}`, () => {
      youtube.nativeSettings?.fontFamily.applySetting(family as AnySettingValue);
      const call = (player.updateSubtitlesUserSettings as ReturnType<typeof vi.fn>).mock.calls[0];
      const args = call?.[0] as Record<string, unknown> | undefined;
      const num = args?.['fontFamily'] as number;

      document.body.innerHTML = '';
      const readPlayer = createMockPlayer({ fontFamily: num });
      document.body.appendChild(readPlayer as unknown as HTMLElement);

      expect(youtube.nativeSettings?.fontFamily.getCurrentValue()).toBe(family);
    });
  }
});

// ── Edge Style Mapping ──────────────────────────────────────────────────────

describe('youtube edge style mapping', () => {
  const expectedStyles = ['none', 'raised', 'depressed', 'outline', 'dropshadow'];

  let player: YouTubePlayerElement & HTMLElement;

  beforeEach(() => {
    player = createMockPlayer();
    document.body.appendChild(player as unknown as HTMLElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  for (const style of expectedStyles) {
    it(`characterEdgeStyle round-trips ${style}`, () => {
      youtube.nativeSettings?.characterEdgeStyle.applySetting(style as AnySettingValue);
      const call = (player.updateSubtitlesUserSettings as ReturnType<typeof vi.fn>).mock.calls[0];
      const args = call?.[0] as Record<string, unknown> | undefined;
      const num = args?.['charEdgeStyle'] as number;

      document.body.innerHTML = '';
      const readPlayer = createMockPlayer({ charEdgeStyle: num });
      document.body.appendChild(readPlayer as unknown as HTMLElement);

      expect(youtube.nativeSettings?.characterEdgeStyle.getCurrentValue()).toBe(style);
    });
  }
});

// ── Font Size Mapping ───────────────────────────────────────────────────────

describe('youtube font size mapping', () => {
  const expectedSizes = ['50%', '75%', '100%', '150%', '200%', '300%', '400%'];

  let player: YouTubePlayerElement & HTMLElement;

  beforeEach(() => {
    player = createMockPlayer();
    document.body.appendChild(player as unknown as HTMLElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  for (const size of expectedSizes) {
    it(`fontSize round-trips ${size}`, () => {
      youtube.nativeSettings?.fontSize.applySetting(size as AnySettingValue);
      const call = (player.updateSubtitlesUserSettings as ReturnType<typeof vi.fn>).mock.calls[0];
      const args = call?.[0] as Record<string, unknown> | undefined;
      const num = args?.['fontSizeIncrement'] as number;

      document.body.innerHTML = '';
      const readPlayer = createMockPlayer({ fontSizeIncrement: num });
      document.body.appendChild(readPlayer as unknown as HTMLElement);

      expect(youtube.nativeSettings?.fontSize.getCurrentValue()).toBe(size);
    });
  }
});

// ── Error Paths ─────────────────────────────────────────────────────────────

describe('youtube error paths', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('getCurrentValue returns undefined when getSubtitlesUserSettings throws', () => {
    const el = document.createElement('div');
    el.classList.add('html5-video-player');
    const player = el as unknown as YouTubePlayerElement & HTMLElement;
    player.getSubtitlesUserSettings = vi.fn().mockImplementation(() => {
      throw new Error('player error');
    });
    player.updateSubtitlesUserSettings = vi.fn();
    document.body.appendChild(el);

    // Should handle gracefully and return auto/undefined
    const result = youtube.nativeSettings?.fontColor.getCurrentValue();
    expect(result === 'auto' || result === undefined).toBe(true);
  });

  it('applySetting handles updateSubtitlesUserSettings throwing', () => {
    const el = document.createElement('div');
    el.classList.add('html5-video-player');
    const player = el as unknown as YouTubePlayerElement & HTMLElement;
    player.getSubtitlesUserSettings = vi.fn().mockReturnValue({});
    player.updateSubtitlesUserSettings = vi.fn().mockImplementation(() => {
      throw new Error('update error');
    });
    document.body.appendChild(el);

    const result = youtube.nativeSettings?.fontColor.applySetting('white' as AnySettingValue);
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('Failed');
  });

  it('getCurrentValue returns auto when no players in DOM', () => {
    // No player elements in DOM
    const result = youtube.nativeSettings?.backgroundOpacity.getCurrentValue();
    expect(result).toBe('auto');
  });

  it('applySetting reports no players found', () => {
    // No player elements in DOM
    const result = youtube.nativeSettings?.fontFamily.applySetting('casual' as AnySettingValue);
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('No active YouTube player');
  });
});

