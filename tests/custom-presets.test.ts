import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadCustomPresets, saveCustomPreset, deleteCustomPreset } from '../src/custom-presets.js';
import type { CustomPreset } from '../src/custom-presets.js';
import type { StorageSettings } from '../src/types/index.js';

const ALL_AUTO: StorageSettings = {
  characterEdgeStyle: 'auto',
  backgroundOpacity: 'auto',
  windowOpacity: 'auto',
  fontColor: 'auto',
  fontOpacity: 'auto',
  backgroundColor: 'auto',
  windowColor: 'auto',
  fontFamily: 'auto',
  fontSize: 'auto',
};

describe('custom-presets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
  });

  describe('loadCustomPresets', () => {
    it('returns empty array when no custom presets stored', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
        {},
      );
      const result = await loadCustomPresets();
      expect(result).toEqual([]);
    });

    it('returns stored custom presets', async () => {
      const stored: CustomPreset[] = [{ id: 'custom-123', name: 'My Preset', settings: ALL_AUTO }];
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        customPresets: stored,
      });
      const result = await loadCustomPresets();
      expect(result).toEqual(stored);
      expect(result.length).toBe(1);
      expect(result[0]!.name).toBe('My Preset');
    });

    it('returns multiple custom presets', async () => {
      const stored: CustomPreset[] = [
        { id: 'custom-1', name: 'First', settings: ALL_AUTO },
        { id: 'custom-2', name: 'Second', settings: { ...ALL_AUTO, fontColor: 'red' } },
      ];
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        customPresets: stored,
      });
      const result = await loadCustomPresets();
      expect(result.length).toBe(2);
    });
  });

  describe('saveCustomPreset', () => {
    it('saves a new custom preset with generated id', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
        {},
      );

      const settings: StorageSettings = { ...ALL_AUTO, fontColor: 'cyan', fontSize: '200%' };
      const result = await saveCustomPreset('My Style', settings);

      expect(result.id).toMatch(/^custom-\d+$/);
      expect(result.name).toBe('My Style');
      expect(result.settings).toEqual(settings);

      expect(vi.mocked(chrome.storage.sync.set)).toHaveBeenCalledWith({
        customPresets: [result],
      });
    });

    it('trims whitespace from preset name', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
        {},
      );

      const result = await saveCustomPreset('  Padded Name  ', ALL_AUTO);
      expect(result.name).toBe('Padded Name');
    });

    it('appends to existing custom presets', async () => {
      const existing: CustomPreset[] = [{ id: 'custom-1', name: 'First', settings: ALL_AUTO }];
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        customPresets: existing,
      });

      const result = await saveCustomPreset('Second', { ...ALL_AUTO, fontColor: 'red' });

      const setCall = vi.mocked(chrome.storage.sync.set).mock.calls[0]![0] as {
        customPresets: CustomPreset[];
      };
      expect(setCall.customPresets.length).toBe(2);
      expect(setCall.customPresets[0]!.name).toBe('First');
      expect(setCall.customPresets[1]!.name).toBe('Second');
      expect(result.name).toBe('Second');
    });

    it('creates a deep copy of settings', async () => {
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue(
        {},
      );

      const settings: StorageSettings = { ...ALL_AUTO, fontColor: 'red' };
      const result = await saveCustomPreset('Test', settings);

      // Mutating original should not affect the saved copy
      settings.fontColor = 'blue';
      expect(result.settings.fontColor).toBe('red');
    });
  });

  describe('deleteCustomPreset', () => {
    it('removes a custom preset by id', async () => {
      const existing: CustomPreset[] = [
        { id: 'custom-1', name: 'First', settings: ALL_AUTO },
        { id: 'custom-2', name: 'Second', settings: { ...ALL_AUTO, fontColor: 'red' } },
      ];
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        customPresets: existing,
      });

      await deleteCustomPreset('custom-1');

      const setCall = vi.mocked(chrome.storage.sync.set).mock.calls[0]![0] as {
        customPresets: CustomPreset[];
      };
      expect(setCall.customPresets.length).toBe(1);
      expect(setCall.customPresets[0]!.id).toBe('custom-2');
    });

    it('does nothing when preset id not found', async () => {
      const existing: CustomPreset[] = [{ id: 'custom-1', name: 'First', settings: ALL_AUTO }];
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        customPresets: existing,
      });

      await deleteCustomPreset('custom-nonexistent');

      const setCall = vi.mocked(chrome.storage.sync.set).mock.calls[0]![0] as {
        customPresets: CustomPreset[];
      };
      expect(setCall.customPresets.length).toBe(1);
      expect(setCall.customPresets[0]!.id).toBe('custom-1');
    });

    it('results in empty array when last preset is deleted', async () => {
      const existing: CustomPreset[] = [{ id: 'custom-1', name: 'Only', settings: ALL_AUTO }];
      vi.mocked<() => Promise<Record<string, unknown>>>(chrome.storage.sync.get).mockResolvedValue({
        customPresets: existing,
      });

      await deleteCustomPreset('custom-1');

      const setCall = vi.mocked(chrome.storage.sync.set).mock.calls[0]![0] as {
        customPresets: CustomPreset[];
      };
      expect(setCall.customPresets).toEqual([]);
    });
  });
});
