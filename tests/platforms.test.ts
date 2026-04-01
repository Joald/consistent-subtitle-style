import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { youtube } from '../src/platforms/youtube.js';
import type { YouTubePlayerElement } from '../src/types/index.js';

describe('platforms index', () => {
  describe('detectPlatform', () => {
    // YouTube
    it('detects youtube properly', () => {
      vi.stubGlobal('location', { hostname: 'www.youtube.com' });
      expect(detectPlatform()).toBe('youtube');
    });

    it('detects youtube without www prefix', () => {
      vi.stubGlobal('location', { hostname: 'youtube.com' });
      expect(detectPlatform()).toBe('youtube');
    });

    it('detects youtube music subdomain', () => {
      vi.stubGlobal('location', { hostname: 'music.youtube.com' });
      expect(detectPlatform()).toBe('youtube');
    });

    // Nebula
    it('detects nebula properly', () => {
      vi.stubGlobal('location', { hostname: 'nebula.tv' });
      expect(detectPlatform()).toBe('nebula');
    });

    it('detects nebula with subdomain', () => {
      vi.stubGlobal('location', { hostname: 'www.nebula.tv' });
      expect(detectPlatform()).toBe('nebula');
    });

    // Dropout
    it('detects dropout.tv', () => {
      vi.stubGlobal('location', { hostname: 'www.dropout.tv' });
      expect(detectPlatform()).toBe('dropout');
    });

    it('detects dropout via vhx.tv embed', () => {
      vi.stubGlobal('location', { hostname: 'embed.vhx.tv' });
      expect(detectPlatform()).toBe('dropout');
    });

    it('detects dropout via vhx.tv subdomain', () => {
      vi.stubGlobal('location', { hostname: 'player.vhx.tv' });
      expect(detectPlatform()).toBe('dropout');
    });

    // Prime Video
    it('detects primevideo.com', () => {
      vi.stubGlobal('location', { hostname: 'www.primevideo.com', pathname: '/watch' });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.com/gp/video', () => {
      vi.stubGlobal('location', { hostname: 'www.amazon.com', pathname: '/gp/video/detail/123' });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.co.uk/gp/video', () => {
      vi.stubGlobal('location', {
        hostname: 'www.amazon.co.uk',
        pathname: '/gp/video/detail/456',
      });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.de/gp/video', () => {
      vi.stubGlobal('location', { hostname: 'www.amazon.de', pathname: '/gp/video/offers' });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('detects amazon.co.jp/gp/video', () => {
      vi.stubGlobal('location', { hostname: 'www.amazon.co.jp', pathname: '/gp/video/detail' });
      expect(detectPlatform()).toBe('primevideo');
    });

    it('does not detect amazon.com without /gp/video path', () => {
      vi.stubGlobal('location', { hostname: 'www.amazon.com', pathname: '/dp/B08N5WRWNW' });
      expect(detectPlatform()).toBe('unknown');
    });

    // Max (HBO Max)
    it('detects max.com', () => {
      vi.stubGlobal('location', { hostname: 'max.com' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects play.max.com subdomain', () => {
      vi.stubGlobal('location', { hostname: 'play.max.com' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects www.max.com subdomain', () => {
      vi.stubGlobal('location', { hostname: 'www.max.com' });
      expect(detectPlatform()).toBe('max');
    });

    it('detects legacy hbomax.com', () => {
      vi.stubGlobal('location', { hostname: 'www.hbomax.com' });
      expect(detectPlatform()).toBe('max');
    });

    it('does not detect maxfoo.com as max', () => {
      vi.stubGlobal('location', { hostname: 'maxfoo.com' });
      expect(detectPlatform()).toBe('unknown');
    });

    // Crunchyroll
    it('detects crunchyroll.com', () => {
      vi.stubGlobal('location', { hostname: 'www.crunchyroll.com' });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    it('detects crunchyroll.com without www', () => {
      vi.stubGlobal('location', { hostname: 'crunchyroll.com' });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    it('detects regional crunchyroll subdomain', () => {
      vi.stubGlobal('location', { hostname: 'beta.crunchyroll.com' });
      expect(detectPlatform()).toBe('crunchyroll');
    });

    // Unknown
    it('returns unknown for other hostnames', () => {
      vi.stubGlobal('location', { hostname: 'google.com' });
      expect(detectPlatform()).toBe('unknown');
    });

    it('returns unknown for empty hostname', () => {
      vi.stubGlobal('location', { hostname: '' });
      expect(detectPlatform()).toBe('unknown');
    });
  });

  describe('getPlatformConfig', () => {
    it('returns correct config for all platforms', () => {
      expect(getPlatformConfig('youtube')?.name).toBe('YouTube');
      expect(getPlatformConfig('nebula')?.name).toBe('Nebula');
      expect(getPlatformConfig('dropout')?.name).toBe('Dropout');
      expect(getPlatformConfig('primevideo')?.name).toBe('Prime Video');
      expect(getPlatformConfig('max')?.name).toBe('Max');
      expect(getPlatformConfig('crunchyroll')?.name).toBe('Crunchyroll');
    });

    it('returns null for unknown platform', () => {
      expect(getPlatformConfig('unknown')).toBeNull();
    });

    it('youtube has native settings', () => {
      const config = getPlatformConfig('youtube');
      expect(config?.nativeSettings).toBeDefined();
    });

    it('css-only platforms have css config but no native settings', () => {
      for (const platform of ['nebula', 'primevideo', 'max', 'crunchyroll'] as const) {
        const config = getPlatformConfig(platform);
        expect(config?.css).toBeDefined();
        expect(config?.nativeSettings).toBeUndefined();
      }
    });

    it('dropout has both css and native settings', () => {
      const config = getPlatformConfig('dropout');
      expect(config?.css).toBeDefined();
      expect(config?.nativeSettings).toBeDefined();
    });
  });
});

describe('youtube platform', () => {
  let mockPlayer: YouTubePlayerElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayer = {
      getSubtitlesUserSettings: vi.fn(),
      updateSubtitlesUserSettings: vi.fn(),
      classList: {
        contains: vi.fn().mockReturnValue(true),
      } as unknown as DOMTokenList,
    } as unknown as YouTubePlayerElement;

    // Mock getYouTubePlayers behavior via document.querySelectorAll
    vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === '.html5-video-player') {
        return [mockPlayer] as unknown as NodeListOf<Element>;
      }
      return [] as unknown as NodeListOf<Element>;
    });
  });

  it('gets native settings correctly', () => {
    (mockPlayer.getSubtitlesUserSettings as Mock).mockReturnValue({
      charEdgeStyle: 4, // dropshadow
      backgroundOpacity: 0.5,
      color: '#f00', // red
      fontFamily: 3, // monospaced-sans-serif
      fontSizeIncrement: 1, // 150%
    });

    const edgeStyle = youtube.nativeSettings?.characterEdgeStyle.getCurrentValue();
    expect(edgeStyle).toBe('dropshadow');

    const bgOpacity = youtube.nativeSettings?.backgroundOpacity.getCurrentValue();
    expect(bgOpacity).toBe('50');

    const winOpacity = youtube.nativeSettings?.windowOpacity.getCurrentValue();
    expect(winOpacity).toBe('auto');

    const fontColor = youtube.nativeSettings?.fontColor.getCurrentValue();
    expect(fontColor).toBe('red');

    const fontOpacity = youtube.nativeSettings?.fontOpacity.getCurrentValue();
    expect(fontOpacity).toBe('auto');

    const bgColor = youtube.nativeSettings?.backgroundColor.getCurrentValue();
    expect(bgColor).toBe('auto');

    const winColor = youtube.nativeSettings?.windowColor.getCurrentValue();
    expect(winColor).toBe('auto');

    const fontFamily = youtube.nativeSettings?.fontFamily.getCurrentValue();
    expect(fontFamily).toBe('monospaced-sans-serif');

    const fontSize = youtube.nativeSettings?.fontSize.getCurrentValue();
    expect(fontSize).toBe('150%');
  });

  it('gets native settings for other properties', () => {
    (mockPlayer.getSubtitlesUserSettings as Mock).mockReturnValue({
      windowOpacity: 0.75,
      textOpacity: 0.25,
      background: '#00f', // blue
      windowColor: '#ff0', // yellow
    });

    expect(youtube.nativeSettings?.windowOpacity.getCurrentValue()).toBe('75');
    expect(youtube.nativeSettings?.fontOpacity.getCurrentValue()).toBe('25');
    expect(youtube.nativeSettings?.backgroundColor.getCurrentValue()).toBe('blue');
    expect(youtube.nativeSettings?.windowColor.getCurrentValue()).toBe('yellow');
  });

  it('applies native settings correctly', () => {
    youtube.nativeSettings?.characterEdgeStyle.applySetting('raised');
    expect(vi.mocked(mockPlayer.updateSubtitlesUserSettings)).toHaveBeenCalledWith({
      charEdgeStyle: 1,
    });

    youtube.nativeSettings?.fontColor.applySetting('blue');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      color: '#00f',
    });

    youtube.nativeSettings?.fontSize.applySetting('200%');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      fontSizeIncrement: 2,
    });

    youtube.nativeSettings?.backgroundOpacity.applySetting('75');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      backgroundOpacity: 0.75,
    });

    youtube.nativeSettings?.windowOpacity.applySetting('100');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      windowOpacity: 1,
    });

    youtube.nativeSettings?.fontOpacity.applySetting('25');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      textOpacity: 0.25,
    });

    youtube.nativeSettings?.backgroundColor.applySetting('black');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      background: '#080808',
    });

    youtube.nativeSettings?.windowColor.applySetting('white');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      windowColor: '#fff',
    });

    youtube.nativeSettings?.fontFamily.applySetting('cursive');
    expect(mockPlayer.updateSubtitlesUserSettings).toHaveBeenCalledWith({
      fontFamily: 6,
    });
  });

  it('handles missing players gracefully', () => {
    vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as NodeListOf<Element>);

    const report = youtube.nativeSettings?.fontColor.applySetting('red');
    expect(report?.success).toBe(false);
    expect(report?.message).toContain('No active YouTube players');
  });

  it('handles "auto" values in application', () => {
    const report = youtube.nativeSettings?.fontColor.applySetting('auto');
    expect(report?.success).toBe(true);
    expect(mockPlayer.updateSubtitlesUserSettings).not.toHaveBeenCalled();
  });
});
