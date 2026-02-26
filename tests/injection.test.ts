import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

describe('injection.ts module', () => {
  let addEventListenerSpy: Mock;
  let createElementSpy: Mock;
  let appendChildSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

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
    await new Promise((resolve) => setTimeout(resolve, 0));

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
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

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
});
