// Injection script - runs in isolated world and bridges to main page world
(function() {
  'use strict';

  console.log('Subtitle extension injection script loaded');

  // Use postMessage for communication between worlds
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

  // Listen for messages from main world
  window.addEventListener('message', (event) => {
    // Only accept messages from same window
    if (event.source !== window) return;
    
    const { type, data, requestId } = event.data;
    
    console.log('🔍 DEBUG: Isolated world received message:', { type, data, requestId });
    
    if (type === 'subtitleStyler') {
      // Handle storage requests from main world
      if (data.action === 'get') {
        console.log('🔍 DEBUG: Handling storage GET request');
        bridge.storage.get().then(result => {
          console.log('🔍 DEBUG: Storage GET result:', result);
          window.postMessage({
            type: 'subtitleStylerResponse',
            requestId,
            data: result
          }, '*');
        });
      } else if (data.action === 'set') {
        console.log('🔍 DEBUG: Handling storage SET request:', data.settings);
        bridge.storage.set(data.settings).then(() => {
          console.log('🔍 DEBUG: Storage SET complete');
          window.postMessage({
            type: 'subtitleStylerResponse',
            requestId,
            data: { success: true }
          }, '*');
        });
      } else if (data.action === 'onChanged') {
        console.log('🔍 DEBUG: Setting up storage change listener');
        bridge.storage.onChanged((changes) => {
          console.log('🔍 DEBUG: Forwarding storage changes to main world:', changes);
          window.postMessage({
            type: 'subtitleStylerChanged',
            data: changes
          }, '*');
        });
        window.postMessage({
          type: 'subtitleStylerResponse',
          requestId,
          data: { success: true }
        }, '*');
      }
    }
  });

  // Function to inject scripts into main world
  function injectScript(scriptUrl: string, callback?: () => void): void {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptUrl);
    script.onload = function() {
      script.remove();
      if (callback) callback();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Inject bridge script first
  injectScript('bridge.js', () => {
    console.log('Bridge script loaded');
  });

  // Inject our main scripts in order
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
        console.log(`Injecting script: ${scriptName}`);
        injectScript(scriptName, () => {
          console.log(`Loaded script: ${scriptName}`);
          currentScript++;
          setTimeout(loadNextScript, 100); // Small delay between scripts
        });
      } else {
        currentScript++;
        setTimeout(loadNextScript, 10);
      }
    } else {
      console.log('All scripts injected successfully');
    }
  }

  // Start injection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadNextScript, 500); // Extra delay for YouTube to load
    });
  } else {
    setTimeout(loadNextScript, 500); // Extra delay for YouTube to load
  }
})();