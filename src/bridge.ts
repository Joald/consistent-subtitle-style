declare const DEBUG: boolean;

(function () {
  'use strict';

  let requestId = 0;

  const extendedWindow = window as { chrome?: { storage?: { sync?: unknown; onChanged?: unknown } } };

  if (!extendedWindow.chrome) extendedWindow.chrome = {};
  if (!extendedWindow.chrome.storage) extendedWindow.chrome.storage = {};

  extendedWindow.chrome.storage.sync = {
    get: () => {
      return new Promise<any>((resolve) => {
        const id = ++requestId;
        const timeout = setTimeout(() => {
          resolve({});
        }, 5000); // Timeout after 5 seconds

        const handleMessage = (event: any) => {
          if (event.data.type === 'subtitleStylerResponse' && event.data.requestId === id) {
            clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
            resolve(event.data.data);
          }
        };

        window.addEventListener('message', handleMessage);
        window.postMessage({
          type: 'subtitleStyler',
          requestId: id,
          data: { action: 'get' }
        }, '*');
      });
    },

    set: (settings: any) => {
      return new Promise<void>((resolve) => {
        const id = ++requestId;

        const handleMessage = (event: any) => {
          if (event.data.type === 'subtitleStylerResponse' && event.data.requestId === id) {
            window.removeEventListener('message', handleMessage);
            resolve();
          }
        };

        window.addEventListener('message', handleMessage);
        window.postMessage({
          type: 'subtitleStyler',
          requestId: id,
          data: { action: 'set', settings }
        }, '*');
      });
    }
  };

  extendedWindow.chrome.storage.onChanged = {
    addListener: (callback: (changes: Record<string, unknown>) => void) => {
      const id = ++requestId;
      const handleMessage = (event: any) => {
        if (event.data.type === 'subtitleStylerChanged') {
          callback(event.data.data);
        }
      };

      window.addEventListener('message', handleMessage);
      window.postMessage({
        type: 'subtitleStyler',
        requestId: id,
        data: { action: 'onChanged' }
      }, '*');
    }
  };
})();