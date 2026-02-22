(function (): void {
  'use strict';

  let requestId = 0;

  interface StylerMessageData {
    type?: string;
    requestId?: number;
    data?: unknown;
  }

  const extendedWindow = window as {
    chrome?: { storage?: { sync?: unknown; onChanged?: unknown } };
  };

  extendedWindow.chrome ??= {};
  extendedWindow.chrome.storage ??= {};

  extendedWindow.chrome.storage.sync = {
    get: (): Promise<Record<string, unknown>> => {
      return new Promise<Record<string, unknown>>((resolve) => {
        const id = ++requestId;

        const handleMessage = (event: MessageEvent<StylerMessageData>): void => {
          if (event.data.type === 'subtitleStylerResponse' && event.data.requestId === id) {
            clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
            resolve((event.data.data ?? {}) as Record<string, unknown>);
          }
        };

        const timeout = setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          resolve({});
        }, 5000); // Timeout after 5 seconds

        window.addEventListener('message', handleMessage);
        window.postMessage(
          {
            type: 'subtitleStyler',
            requestId: id,
            data: { action: 'get' },
          },
          '*',
        );
      });
    },

    set: (settings: Record<string, unknown>): Promise<void> => {
      return new Promise<void>((resolve) => {
        const id = ++requestId;

        const handleMessage = (event: MessageEvent<StylerMessageData>): void => {
          if (event.data.type === 'subtitleStylerResponse' && event.data.requestId === id) {
            clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
            resolve();
          }
        };

        const timeout = setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          resolve();
        }, 5000);

        window.addEventListener('message', handleMessage);
        window.postMessage(
          {
            type: 'subtitleStyler',
            requestId: id,
            data: { action: 'set', settings },
          },
          '*',
        );
      });
    },
  };

  extendedWindow.chrome.storage.onChanged = {
    addListener: (callback: (changes: Record<string, unknown>) => void): void => {
      const id = ++requestId;
      const handleMessage = (event: MessageEvent<StylerMessageData>): void => {
        if (event.data.type === 'subtitleStylerChanged') {
          callback((event.data.data ?? {}) as Record<string, unknown>);
        }
      };

      window.addEventListener('message', handleMessage);
      window.postMessage(
        {
          type: 'subtitleStyler',
          requestId: id,
          data: { action: 'onChanged' },
        },
        '*',
      );
    },
  };
})();
