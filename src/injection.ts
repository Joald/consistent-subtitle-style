(function () {
  'use strict';

  const bridge = {
    storage: {
      get: () => {
        return new Promise((resolve) => {
          chrome.storage.sync.get(['characterEdgeStyle', 'backgroundOpacity', 'windowOpacity'], (result) => {
            resolve(result);
          });
        });
      },
      set: (settings: any) => {
        return new Promise<void>((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve();
          });
        });
      },
      onChanged: (callback: (changes: any) => void) => {
        chrome.storage.onChanged.addListener((changes: any, namespace: string) => {
          if (namespace === 'sync') {
            callback(changes);
          }
        });
      }
    }
  };

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      window.postMessage({
        type: 'subtitleStylerChanged',
        data: changes
      }, '*');
    }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    const { type, data, requestId } = event.data;

    if (type === 'subtitleStyler') {
      if (data.action === 'get') {
        bridge.storage.get().then(result => {
          window.postMessage({
            type: 'subtitleStylerResponse',
            requestId,
            data: result
          }, '*');
        });
      } else if (data.action === 'set') {
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'subtitleStylerPopupUpdate') {
      window.postMessage({
        type: 'subtitleStylerChanged',
        data: Object.keys(message.settings).reduce((acc, key) => {
          acc[key] = { newValue: message.settings[key] };
          return acc;
        }, {} as Record<string, { newValue: unknown }>)
      }, '*');
    }

    sendResponse({ success: true });
  });

  function injectScript(scriptUrl: string, callback?: () => void): void {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptUrl);
    script.onload = function () {
      script.remove();
      if (callback) callback();
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