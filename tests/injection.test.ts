import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

describe('injection.ts module', () => {
  let addEventListenerSpy: Mock;
  let createElementSpy: Mock;
  let appendChildSpy: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset injection dedup guard so each test can re-import
    delete (window as unknown as Record<string, unknown>)['__subtitleStylerInjected'];

    // Create spies
    addEventListenerSpy = vi.spyOn(window, 'addEventListener') as Mock;
    createElementSpy = vi.spyOn(document, 'createElement') as Mock;
    appendChildSpy = vi.spyOn(document.head, 'appendChild') as Mock;

    // mock chrome global
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn(),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn(),
        },
        getURL: vi.fn().mockImplementation((path: string) => `chrome-extension://mock-id/${path}`),
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.stubGlobal('chrome', undefined);
  });

  async function loadInjection(): Promise<void> {
    vi.resetModules();
    // @ts-expect-error File is not a module
    await import('../src/injection.js');
  }

  it('adds chrome.storage.onChanged listener', async () => {
    await loadInjection();
    expect(vi.mocked(chrome.storage.onChanged.addListener)).toHaveBeenCalled();
  });

  it('adds message listeners', async () => {
    await loadInjection();
    expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    expect(vi.mocked(chrome.runtime.onMessage.addListener)).toHaveBeenCalled();
  });

  it('injects bridge.js immediately', async () => {
    await loadInjection();
    expect(createElementSpy).toHaveBeenCalledWith('script');
    expect(appendChildSpy).toHaveBeenCalled();

    // Check if the script src matches
    const results = createElementSpy.mock.results;
    const mockScript = results.find(
      (r: { value: unknown }) =>
        (r.value as HTMLScriptElement).src === 'chrome-extension://mock-id/bridge.js',
    )?.value as HTMLScriptElement;

    expect(mockScript).toBeDefined();

    // Simulate onload
    const removeSpy = vi.fn();
    mockScript.remove = removeSpy;
    if (mockScript.onload) {
      (mockScript.onload as (ev: Event) => void)(new Event('load'));
    }
    expect(removeSpy).toHaveBeenCalled();
  });

  it('handles subtitleStyler message with action get', async () => {
    const mockGet = vi.fn().mockImplementation((_ignored: unknown, cb: (d: unknown) => void) => {
      cb({ test: 'data' });
    });
    chrome.storage.sync.get = mockGet;

    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;

    await loadInjection();

    // Find the message handler
    const messageHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'message',
    )?.[1] as EventListener;

    // Trigger it
    const reqId = 12345;
    messageHandler({
      source: window,
      data: {
        type: 'subtitleStyler',
        requestId: reqId,
        data: { action: 'get' },
      },
    } as unknown as MessageEvent);

    // Give promises time to resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subtitleStylerResponse',
        requestId: reqId,
        data: { test: 'data' },
      }),
      '*',
    );
  });

  it('handles subtitleStyler message with action set', async () => {
    const mockSet = vi.fn().mockImplementation((_settings: unknown, cb: () => void) => {
      cb();
    });
    chrome.storage.sync.set = mockSet;

    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;

    await loadInjection();

    // Find the message handler
    const messageHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'message',
    )?.[1] as EventListener;

    // Trigger it
    const reqId = 123456;
    messageHandler({
      source: window,
      data: {
        type: 'subtitleStyler',
        requestId: reqId,
        data: { action: 'set', settings: { test: 'test' } },
      },
    } as unknown as MessageEvent);

    // Give promises time to resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subtitleStylerResponse',
        requestId: reqId,
        data: { success: true },
      }),
      '*',
    );
  });

  it('handles subtitleStylerPopupUpdate message', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const firstCall = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0];
    if (!firstCall) throw new Error('addListener not called');
    const messageHandler = firstCall[0];

    const sendResponseMock = vi.fn();
    messageHandler(
      { type: 'subtitleStylerPopupUpdate', settings: { prop: 'value' } },
      {} as chrome.runtime.MessageSender,
      sendResponseMock,
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subtitleStylerChanged',
        data: { prop: { newValue: 'value' } },
      }),
      '*',
    );
    expect(sendResponseMock).toHaveBeenCalledWith({ success: true });
  });

  it('dispatches postMessage when chrome storage changes', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const firstCall = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0];
    if (!firstCall) throw new Error('addListener not called');
    const storageListener = firstCall[0];

    storageListener({ prop: { newValue: 'value', oldValue: 'old' } }, 'sync');

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subtitleStylerChanged',
        data: { prop: { newValue: 'value', oldValue: 'old' } },
      }),
      '*',
    );
  });

  // ── Double injection guard ──

  it('skips execution when already injected', async () => {
    // First injection
    await loadInjection();

    const firstCallCount = vi.mocked(chrome.storage.onChanged.addListener).mock.calls.length;

    // Mark as already injected (simulating the guard)
    // Re-import should skip
    vi.resetModules();
    // @ts-expect-error File is not a module
    await import('../src/injection.js');

    // Should not have registered additional listeners
    expect(vi.mocked(chrome.storage.onChanged.addListener).mock.calls.length).toBe(firstCallCount);
  });

  // ── Message source filtering ──

  it('ignores messages from non-window sources', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const messageHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'message',
    )?.[1] as EventListener;

    // Clear initial postMessage calls from setup
    postMessageSpy.mockClear();

    // Send from a different source (not window)
    messageHandler({
      source: {} as Window, // different source
      data: {
        type: 'subtitleStyler',
        requestId: 1,
        data: { action: 'get' },
      },
    } as unknown as MessageEvent);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Should not have posted any response
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  // ── Storage namespace filtering ──

  it('ignores chrome storage changes from non-sync namespace', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const firstCall = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0];
    if (!firstCall) throw new Error('addListener not called');
    const storageListener = firstCall[0];

    postMessageSpy.mockClear();

    // Fire with 'local' namespace instead of 'sync'
    storageListener({ prop: { newValue: 'value' } }, 'local');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  // ── broadcastChanges to VHX/Vimeo iframes ──

  it('broadcasts changes to VHX and Vimeo iframes', async () => {
    const _postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    // Create iframes with matching srcs
    const vhxIframe = document.createElement('iframe');
    vhxIframe.src = 'https://embed.vhx.tv/video/12345';
    const vimeoIframe = document.createElement('iframe');
    vimeoIframe.src = 'https://player.vimeo.com/video/12345';
    const otherIframe = document.createElement('iframe');
    otherIframe.src = 'https://www.google.com';

    document.body.appendChild(vhxIframe);
    document.body.appendChild(vimeoIframe);
    document.body.appendChild(otherIframe);

    // Mock contentWindow.postMessage for VHX iframe
    const vhxPostMessage = vi.fn();
    Object.defineProperty(vhxIframe, 'contentWindow', {
      value: { postMessage: vhxPostMessage },
      writable: true,
    });

    // Mock contentWindow.postMessage for Vimeo iframe
    const vimeoPostMessage = vi.fn();
    Object.defineProperty(vimeoIframe, 'contentWindow', {
      value: { postMessage: vimeoPostMessage },
      writable: true,
    });

    // Mock contentWindow.postMessage for other iframe
    const otherPostMessage = vi.fn();
    Object.defineProperty(otherIframe, 'contentWindow', {
      value: { postMessage: otherPostMessage },
      writable: true,
    });

    // Trigger storage change which calls broadcastChanges
    const firstCall = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0];
    if (!firstCall) throw new Error('addListener not called');
    const storageListener = firstCall[0];

    storageListener({ fontColor: { newValue: 'red', oldValue: 'auto' } }, 'sync');

    // VHX and Vimeo iframes should receive the message
    expect(vhxPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subtitleStylerChanged' }),
      '*',
    );
    expect(vimeoPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subtitleStylerChanged' }),
      '*',
    );
    // Other iframe should NOT receive the message
    expect(otherPostMessage).not.toHaveBeenCalled();

    vhxIframe.remove();
    vimeoIframe.remove();
    otherIframe.remove();
  });

  // ── Script error handling ──

  it('calls callback and removes script on injection error', async () => {
    await loadInjection();

    // Find the bridge.js script element
    const results = createElementSpy.mock.results;
    const mockScript = results.find(
      (r: { value: unknown }) =>
        (r.value as HTMLScriptElement).src === 'chrome-extension://mock-id/bridge.js',
    )?.value as HTMLScriptElement;

    expect(mockScript).toBeDefined();
    expect(mockScript.onerror).toBeDefined();

    // Simulate onerror
    const removeSpy = vi.fn();
    mockScript.remove = removeSpy;
    if (mockScript.onerror) {
      (mockScript.onerror as (error: string | Event) => void)(new Event('error'));
    }
    expect(removeSpy).toHaveBeenCalled();
  });

  // ── Runtime message handler ──

  it('always calls sendResponse for runtime messages', async () => {
    await loadInjection();

    const firstCall = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0];
    if (!firstCall) throw new Error('addListener not called');
    const messageHandler = firstCall[0];

    const sendResponseMock = vi.fn();

    // Send an unrelated message type
    const result = messageHandler(
      { type: 'someOtherMessage' },
      {} as chrome.runtime.MessageSender,
      sendResponseMock,
    );

    // Should still call sendResponse
    expect(sendResponseMock).toHaveBeenCalledWith({ success: true });
    // Should return true to keep message channel open
    expect(result).toBe(true);
  });

  it('does not broadcast for runtime messages without subtitleStylerPopupUpdate type', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const firstCall = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0];
    if (!firstCall) throw new Error('addListener not called');
    const messageHandler = firstCall[0];

    postMessageSpy.mockClear();

    messageHandler(
      { type: 'someOtherType', settings: { fontColor: 'red' } },
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    );

    // Should not broadcast changes for non-popup-update messages
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subtitleStylerChanged' }),
      '*',
    );
  });

  // ── Message handling edge cases ──

  it('ignores subtitleStyler message without requestId', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const messageHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'message',
    )?.[1] as EventListener;

    postMessageSpy.mockClear();

    // Send get action without requestId
    messageHandler({
      source: window,
      data: {
        type: 'subtitleStyler',
        data: { action: 'get' },
        // no requestId
      },
    } as unknown as MessageEvent);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Should not post any response
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subtitleStylerResponse' }),
      '*',
    );
  });

  it('ignores subtitleStyler message with unknown action', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const messageHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'message',
    )?.[1] as EventListener;

    postMessageSpy.mockClear();

    messageHandler({
      source: window,
      data: {
        type: 'subtitleStyler',
        requestId: 999,
        data: { action: 'unknownAction' },
      },
    } as unknown as MessageEvent);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Should not post a response for unknown actions
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subtitleStylerResponse' }),
      '*',
    );
  });

  it('ignores set action without settings', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage') as Mock;
    await loadInjection();

    const messageHandler = addEventListenerSpy.mock.calls.find(
      (c: unknown[]) => c[0] === 'message',
    )?.[1] as EventListener;

    postMessageSpy.mockClear();

    messageHandler({
      source: window,
      data: {
        type: 'subtitleStyler',
        requestId: 888,
        data: { action: 'set' }, // no settings
      },
    } as unknown as MessageEvent);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Should not post a response when settings are missing
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subtitleStylerResponse' }),
      '*',
    );
  });

  // ── Script loading chain ──

  it('starts loading script chain after bridge.js loads', async () => {
    await loadInjection();

    // Find bridge.js script
    const results = createElementSpy.mock.results;
    const bridgeScript = results.find(
      (r: { value: unknown }) =>
        (r.value as HTMLScriptElement).src === 'chrome-extension://mock-id/bridge.js',
    )?.value as HTMLScriptElement;

    expect(bridgeScript).toBeDefined();

    // Simulate bridge.js loading
    bridgeScript.remove = vi.fn();
    if (bridgeScript.onload) {
      (bridgeScript.onload as (ev: Event) => void)(new Event('load'));
    }

    // After bridge loads, the script chain should start after 500ms setTimeout
    // + 100ms intervals between each script
    vi.advanceTimersByTime(500);

    // platforms.js should now be loading
    const platformsScript = results.find(
      (r: { value: unknown }) =>
        (r.value as HTMLScriptElement).src === 'chrome-extension://mock-id/platforms.js',
    )?.value as HTMLScriptElement;

    expect(platformsScript).toBeDefined();
  });
});
