import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../src/platforms/index.js';
import { youtube } from '../src/platforms/youtube.js';
import type { YouTubePlayerElement } from '../src/types/index.js';

describe('platforms index', () => {
  it('detects youtube properly', () => {
    vi.stubGlobal('location', { hostname: 'www.youtube.com' });
    expect(detectPlatform()).toBe('youtube');
  });

  it('detects nebula properly', () => {
    vi.stubGlobal('location', { hostname: 'nebula.tv' });
    expect(detectPlatform()).toBe('nebula');
  });

  it('returns unknown for other hostnames', () => {
    vi.stubGlobal('location', { hostname: 'google.com' });
    expect(detectPlatform()).toBe('unknown');
  });

  it('returns correct config for platform', () => {
    const config = getPlatformConfig('youtube');
    expect(config?.name).toBe('YouTube');

    const nebulaConfig = getPlatformConfig('nebula');
    expect(nebulaConfig?.name).toBe('Nebula');

    expect(getPlatformConfig('unknown')).toBeNull();
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
