(function (): void {
  'use strict';

  interface SubtitleStylerMessage {
    type: string;
    data?: {
      action?: string;
      settings?: Record<string, unknown>;
      [key: string]: unknown;
    };
    requestId?: number;
    settings?: Record<string, unknown>;
  }

  const bridge = {
    storage: {
      get: (): Promise<Record<string, unknown>> => {
        return new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.sync.get(
            ['characterEdgeStyle', 'backgroundOpacity', 'windowOpacity'],
            (result) => {
              resolve(result);
            },
          );
        });
      },
      set: (settings: Record<string, unknown>): Promise<void> => {
        return new Promise<void>((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve();
          });
        });
      },
      onChanged: (
        callback: (changes: Record<string, chrome.storage.StorageChange>) => void,
      ): void => {
        chrome.storage.onChanged.addListener(
          (changes: Record<string, chrome.storage.StorageChange>, namespace: string) => {
            if (namespace === 'sync') {
              callback(changes);
            }
          },
        );
      },
    },
  };

  chrome.storage.onChanged.addListener(
    (changes: Record<string, chrome.storage.StorageChange>, namespace: string) => {
      if (namespace === 'sync') {
        window.postMessage(
          {
            type: 'subtitleStylerChanged',
            data: changes,
          },
          '*',
        );
      }
    },
  );

  window.addEventListener('message', (event: MessageEvent<SubtitleStylerMessage>) => {
    if (event.source !== window) return;

    const { type, data, requestId } = event.data;

    if (type === 'subtitleStyler' && data) {
      if (data.action === 'get' && requestId !== undefined) {
        void bridge.storage.get().then((result) => {
          window.postMessage(
            {
              type: 'subtitleStylerResponse',
              requestId,
              data: result,
            },
            '*',
          );
        });
      } else if (data.action === 'set' && data.settings && requestId !== undefined) {
        void bridge.storage.set(data.settings).then(() => {
          window.postMessage(
            {
              type: 'subtitleStylerResponse',
              requestId,
              data: { success: true },
            },
            '*',
          );
        });
      }
    }
  });

  chrome.runtime.onMessage.addListener(
    (
      message: SubtitleStylerMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: { success?: boolean }) => void,
    ) => {
      if (message.type === 'subtitleStylerPopupUpdate' && message.settings) {
        window.postMessage(
          {
            type: 'subtitleStylerChanged',
            data: Object.keys(message.settings).reduce<Record<string, { newValue: unknown }>>(
              (acc, key) => {
                acc[key] = { newValue: message.settings?.[key] };
                return acc;
              },
              {},
            ),
          },
          '*',
        );
      }

      sendResponse({ success: true });
      return true; // Keep the message channel open for the asynchronous response if needed elsewhere later.
    },
  );

  function injectScript(scriptUrl: string, callback?: () => void): void {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptUrl);
    script.onload = function (): void {
      script.remove();
      if (callback) callback();
    };
    script.onerror = function (error: string | Event): void {
      console.error(`SubtitleStyler: Failed to inject script ${scriptUrl}`, error);
      script.remove();
      if (callback) callback(); // Proceed so it doesn't block the rest of the chain
    };
    document.head.appendChild(script);
  }

  injectScript('bridge.js');

  const scripts = ['platforms.js', 'storage.js', 'main.js'];

  let currentScript = 0;

  function loadNextScript(): void {
    if (currentScript < scripts.length) {
      const scriptName = scripts[currentScript];
      if (scriptName) {
        injectScript(scriptName, () => {
          currentScript++;
          setTimeout(loadNextScript, 100);
        });
      } else {
        currentScript++;
        setTimeout(loadNextScript, 10);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadNextScript, 500);
    });
  } else {
    setTimeout(loadNextScript, 500);
  }
})();
