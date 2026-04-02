import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

describe('bridge.ts module', () => {
  let addEventListenerSpy: Mock;
  let removeEventListenerSpy: Mock;
  let postMessageSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create spies
    addEventListenerSpy = vi.spyOn(window, 'addEventListener') as Mock;
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener') as Mock;
    postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;

    // We need to re-evaluate the bridge script to test it properly
    // because it's an IIFE that executes immediately when imported
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // delete chrome from window to isolate tests
    const g = window as unknown as Record<string, unknown>;
    delete g['chrome'];
  });

  async function loadBridge(): Promise<void> {
    vi.resetModules();
    // @ts-expect-error File is not a module
    await import('../src/bridge.js');
  }

  it('initializes window.chrome.storage objects if not present', async () => {
    await loadBridge();
    expect(window.chrome).toBeDefined();
    expect(window.chrome.storage).toBeDefined();
    expect(window.chrome.storage.sync).toBeDefined();
    expect(window.chrome.storage.onChanged).toBeDefined();
  });

  describe('storage.sync.get', () => {
    it('sends get message and resolves with data on subtitleStylerResponse', async () => {
      await loadBridge();

      const getPromise = window.chrome.storage.sync.get({});

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subtitleStyler',
          data: { action: 'get' },
        }),
        '*',
      );

      // Extract the requestId from postMessage call
      const firstCall = postMessageSpy.mock.calls[0];
      if (!firstCall) throw new Error('postMessage not called');
      const callArgs = firstCall[0] as { requestId: number };
      const reqId = callArgs.requestId;

      // Find the message handler that was added
      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;
      expect(messageHandler).toBeDefined();

      // Trigger the handler with a mock response
      const mockResponse = { testKey: 'testValue' };
      messageHandler({
        data: {
          type: 'subtitleStylerResponse',
          requestId: reqId,
          data: mockResponse,
        },
      } as unknown as MessageEvent);

      const result = await getPromise;
      expect(result).toEqual(mockResponse);
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('resolves with empty object after 5s timeout', async () => {
      vi.useFakeTimers();
      await loadBridge();

      const getPromise = window.chrome.storage.sync.get({});

      vi.advanceTimersByTime(5000);

      const result = await getPromise;
      expect(result).toEqual({});
      expect(removeEventListenerSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('storage.sync.set', () => {
    it('sends set message and resolves on subtitleStylerResponse', async () => {
      await loadBridge();

      const setPromise = window.chrome.storage.sync.set({ key: 'val' });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subtitleStyler',
          data: { action: 'set', settings: { key: 'val' } },
        }),
        '*',
      );

      const firstSetCall = postMessageSpy.mock.calls[0];
      if (!firstSetCall) throw new Error('postMessage not called');
      const setCallArgs = firstSetCall[0] as { requestId: number };
      const reqId = setCallArgs.requestId;

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      messageHandler({
        data: {
          type: 'subtitleStylerResponse',
          requestId: reqId,
        },
      } as unknown as MessageEvent);

      await expect(setPromise).resolves.toBeUndefined();
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('resolves after 5s timeout', async () => {
      vi.useFakeTimers();
      await loadBridge();

      const setPromise = window.chrome.storage.sync.set({ key: 'val' });

      vi.advanceTimersByTime(5000);

      await expect(setPromise).resolves.toBeUndefined();
      expect(removeEventListenerSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('storage.onChanged.addListener', () => {
    it('calls the callback when subtitleStylerChanged message is received', async () => {
      await loadBridge();

      const callbackObj = { callback: vi.fn() };
      const callbackSpy = vi.spyOn(callbackObj, 'callback');

      window.chrome.storage.onChanged.addListener(callbackObj.callback);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subtitleStyler',
          data: { action: 'onChanged' },
        }),
        '*',
      );

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      const mockChanges = { key: { newValue: 'val' } };
      messageHandler({
        data: {
          type: 'subtitleStylerChanged',
          data: mockChanges,
        },
      } as unknown as MessageEvent);

      expect(callbackSpy).toHaveBeenCalledWith(mockChanges);
    });
  });

  describe('edge cases', () => {
    it('ignores responses with mismatched requestId for get', async () => {
      await loadBridge();
      vi.useFakeTimers();

      const getPromise = window.chrome.storage.sync.get({});

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      // Send response with wrong requestId — should not resolve
      messageHandler({
        data: {
          type: 'subtitleStylerResponse',
          requestId: 99999,
          data: { wrong: true },
        },
      } as unknown as MessageEvent);

      // Still pending — advance to timeout
      vi.advanceTimersByTime(5000);
      const result = await getPromise;
      expect(result).toEqual({}); // Timeout fallback, not wrong data

      vi.useRealTimers();
    });

    it('ignores responses with mismatched requestId for set', async () => {
      await loadBridge();
      vi.useFakeTimers();

      const setPromise = window.chrome.storage.sync.set({ a: 'b' });

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      // Wrong requestId
      messageHandler({
        data: {
          type: 'subtitleStylerResponse',
          requestId: 99999,
        },
      } as unknown as MessageEvent);

      vi.advanceTimersByTime(5000);
      await expect(setPromise).resolves.toBeUndefined();

      vi.useRealTimers();
    });

    it('ignores messages with wrong type', async () => {
      await loadBridge();
      vi.useFakeTimers();

      const getPromise = window.chrome.storage.sync.get({});

      const firstCall = postMessageSpy.mock.calls[0];
      if (!firstCall) throw new Error('postMessage not called');
      const callArgs = firstCall[0] as { requestId: number };
      const reqId = callArgs.requestId;

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      // Wrong message type — should not resolve
      messageHandler({
        data: {
          type: 'wrongType',
          requestId: reqId,
          data: { bad: true },
        },
      } as unknown as MessageEvent);

      vi.advanceTimersByTime(5000);
      const result = await getPromise;
      expect(result).toEqual({});

      vi.useRealTimers();
    });

    it('get resolves with empty object when response data is null/undefined', async () => {
      await loadBridge();

      const getPromise = window.chrome.storage.sync.get({});

      const firstCall = postMessageSpy.mock.calls[0];
      if (!firstCall) throw new Error('postMessage not called');
      const callArgs = firstCall[0] as { requestId: number };
      const reqId = callArgs.requestId;

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      // Response with no data field
      messageHandler({
        data: {
          type: 'subtitleStylerResponse',
          requestId: reqId,
          data: undefined,
        },
      } as unknown as MessageEvent);

      const result = await getPromise;
      expect(result).toEqual({});
    });

    it('onChanged callback receives empty object when data is undefined', async () => {
      await loadBridge();

      const callback = vi.fn();
      window.chrome.storage.onChanged.addListener(callback);

      const messageHandler = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )?.[1] as EventListener;

      messageHandler({
        data: {
          type: 'subtitleStylerChanged',
          data: undefined,
        },
      } as unknown as MessageEvent);

      expect(callback).toHaveBeenCalledWith({});
    });

    it('does not clobber existing window.chrome properties', async () => {
      // Set up partial chrome object before loading bridge
      const existingProp = { test: true };
      (window as unknown as Record<string, unknown>)['chrome'] = {
        someExistingProp: existingProp,
      };

      await loadBridge();

      const win = window as unknown as Record<string, Record<string, unknown>>;
      expect(win['chrome']?.['someExistingProp']).toBe(existingProp);
      expect(window.chrome.storage).toBeDefined();
    });

    it('increments requestId for sequential calls', async () => {
      await loadBridge();
      vi.useFakeTimers();

      // Make two get calls
      const p1 = window.chrome.storage.sync.get({});
      const p2 = window.chrome.storage.sync.get({});

      const calls = postMessageSpy.mock.calls;
      const id1 = (calls[0]?.[0] as { requestId: number }).requestId;
      const id2 = (calls[1]?.[0] as { requestId: number }).requestId;
      expect(id2).toBeGreaterThan(id1);

      // Clean up — let timeouts resolve
      vi.advanceTimersByTime(5000);
      await p1;
      await p2;

      vi.useRealTimers();
    });
  });
});
