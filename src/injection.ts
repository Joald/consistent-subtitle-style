/* eslint-disable */
(function (): void {
  'use strict';
  console.log(
    '[CSS-STYL] Injection script started (all_frames: ' +
      (window.location !== window.parent.location) +
      ')',
  );

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
          chrome.storage.sync.get(null, (result) => {
            resolve(result);
          });
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

  // Forward a subtitleStylerChanged message to the current window AND any
  // cross-origin VHX/Vimeo iframes on the page. This is needed because
  // injection.ts may only run in the top frame while the video player lives
  // inside an embed.vhx.tv iframe.
  function broadcastChanges(data: Record<string, unknown>): void {
    const msg = { type: 'subtitleStylerChanged', data };
    window.postMessage(msg, '*');

    // Also relay into cross-origin video iframes so main.ts there can apply styles.
    try {
      const iframes = document.querySelectorAll('iframe');
      console.log(`[CSS-STYL] broadcastChanges: found ${iframes.length} iframes`);
      iframes.forEach((iframe) => {
        const src = iframe.src || '';
        if (
          src.includes('embed.vhx.tv') ||
          src.includes('vhx.tv') ||
          src.includes('vimeo.com')
        ) {
          console.log(`[CSS-STYL] broadcastChanges: posting to iframe ${src.substring(0, 60)}`);
          iframe.contentWindow?.postMessage(msg, '*');
        }
      });
    } catch (e) {
      console.log('[CSS-STYL] broadcastChanges: error -', e);
    }
  }

  chrome.storage.onChanged.addListener(
    (changes: Record<string, chrome.storage.StorageChange>, namespace: string) => {
      if (namespace === 'sync') {
        broadcastChanges(changes);
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
        broadcastChanges(
          Object.keys(message.settings).reduce<Record<string, { newValue: unknown }>>(
            (acc, key) => {
              acc[key] = { newValue: message.settings?.[key] };
              return acc;
            },
            {},
          ),
        );
      }

      sendResponse({ success: true });
      return true; // Keep the message channel open for the asynchronous response if needed elsewhere later.
    },
  );

  function injectScript(scriptUrl: string, callback?: () => void): void {
    const fullUrl = chrome.runtime.getURL(scriptUrl);
    console.log(`[CSS-STYL] Injecting script: ${scriptUrl} (${fullUrl})`);
    const script = document.createElement('script');
    script.src = fullUrl;
    script.onload = function (): void {
      console.log(`[CSS-STYL] Script loaded successfully: ${scriptUrl}`);
      script.remove();
      if (callback) callback();
    };
    script.onerror = function (error: string | Event): void {
      console.error(`[CSS-STYL] Failed to inject script: ${scriptUrl}`, error);
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
