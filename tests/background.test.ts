import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

describe('background.ts', () => {
  let messageListeners: ((
    message: Record<string, unknown>,
    sender: unknown,
    sendResponse: (response?: unknown) => void,
  ) => boolean | void)[];
  let mockReload: Mock;

  beforeEach(() => {
    messageListeners = [];
    mockReload = vi.fn();

    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: vi.fn((cb: (typeof messageListeners)[0]) => {
            messageListeners.push(cb);
          }),
        },
        reload: mockReload,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    const g = globalThis as unknown as Record<string, unknown>;
    delete g['chrome'];
  });

  async function loadBackground(): Promise<void> {
    vi.resetModules();
    await import('../src/background.js' as string);
  }

  it('registers a message listener on load', async () => {
    await loadBackground();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(messageListeners).toHaveLength(1);
  });

  it('reloads extension on reload_extension action', async () => {
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    listener({ action: 'reload_extension' }, {}, sendResponse);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('responds with status ok on ping action', async () => {
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    listener({ action: 'ping' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('returns true to keep message channel open', async () => {
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    const result = listener({ action: 'ping' }, {}, sendResponse);

    expect(result).toBe(true);
  });

  it('does not reload on unknown action', async () => {
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    listener({ action: 'unknown_action' }, {}, sendResponse);

    expect(mockReload).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('does not call sendResponse on reload_extension', async () => {
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    listener({ action: 'reload_extension' }, {}, sendResponse);

    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('handles both actions in one message (reload_extension + ping)', async () => {
    // The code checks both conditions independently (no else-if)
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    // A message with action: 'reload_extension' will trigger reload but NOT ping
    listener({ action: 'reload_extension' }, {}, sendResponse);
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(sendResponse).not.toHaveBeenCalled();

    // A message with action: 'ping' will trigger sendResponse but NOT reload
    mockReload.mockClear();
    const sendResponse2 = vi.fn();
    listener({ action: 'ping' }, {}, sendResponse2);
    expect(mockReload).not.toHaveBeenCalled();
    expect(sendResponse2).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('handles message with no action property', async () => {
    await loadBackground();
    const listener = messageListeners[0]!;
    const sendResponse = vi.fn();

    const result = listener({}, {}, sendResponse);

    expect(mockReload).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
