(function () {
  'use strict';

  interface SubtitleStylerMessage {
    type: string;
    data?: any;
    requestId?: number;
    settings?: any;
    action?: string;
  }

  const bridge = {
    storage: {
      get: () => {
        return new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.sync.get(['characterEdgeStyle', 'backgroundOpacity', 'windowOpacity'], (result) => {
            resolve(result);
          });
        });
      },
      set: (settings: Record<string, unknown>) => {
        return new Promise<void>((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve();
          });
        });
      },
      onChanged: (callback: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
        chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>, namespace: string) => {
          if (namespace === 'sync') {
            callback(changes);
          }
        });
      }
    }
  };

  chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
    if (namespace === 'sync') {
      window.postMessage({
        type: 'subtitleStylerChanged',
        data: changes
      }, '*');
    }
  });

  window.addEventListener('message', (event: MessageEvent<SubtitleStylerMessage>) => {
    if (event.source !== window || !event.data) return;

    const { type, data, requestId } = event.data;

    if (type === 'subtitleStyler' && data) {
      if (data.action === 'get' && requestId !== undefined) {
        bridge.storage.get().then(result => {
          window.postMessage({
            type: 'subtitleStylerResponse',
            requestId,
            data: result
          }, '*');
        });
      } else if (data.action === 'set' && data.settings && requestId !== undefined) {
        bridge.storage.set(data.settings).then(() => {
          window.postMessage({
            type: 'subtitleStylerResponse',
            requestId,
            data: { success: true }
          }, '*');
        });
      }
    }
  });

  chrome.runtime.onMessage.addListener((message: SubtitleStylerMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (message.type === 'subtitleStylerPopupUpdate' && message.settings) {
      window.postMessage({
        type: 'subtitleStylerChanged',
        data: Object.keys(message.settings).reduce((acc, key) => {
          acc[key] = { newValue: message.settings[key] };
          return acc;
        }, {} as Record<string, { newValue: unknown }>)
      }, '*');
    }

    sendResponse({ success: true });
    return true; // Keep the message channel open for the asynchronous response if needed elsewhere later.
  });

  function injectScript(scriptUrl: string, callback?: () => void): void {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptUrl);
    script.onload = function () {
      script.remove();
      if (callback) callback();
    };
    script.onerror = function (error: string | Event) {
      console.error(`SubtitleStyler: Failed to inject script ${scriptUrl}`, error);
      script.remove();
      if (callback) callback(); // Proceed so it doesn't block the rest of the chain
    };
    (document.head || document.documentElement).appendChild(script);
  }

  injectScript('bridge.js');

  const scripts = [
    'platforms.js',
    'storage.js',
    'main.js'
  ];

  let currentScript = 0;

  function loadNextScript() {
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