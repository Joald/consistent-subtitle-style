// Bridge script - runs in main world and provides Chrome API access
(function() {
  'use strict';
  
  console.log('Bridge script loading in main world');
  
  // Wait for bridge from isolated world
  function waitForBridge() {
    if (typeof (window as any).subtitleStylerBridge !== 'undefined') {
      console.log('Bridge found, setting up Chrome APIs');
      const bridge = (window as any).subtitleStylerBridge;
      
  // Create chrome.storage equivalent for main world
  if (!(window as any).chrome) (window as any).chrome = {};
  if (!(window as any).chrome.storage) (window as any).chrome.storage = {};
  
  (window as any).chrome.storage.sync = {
    get: () => bridge.storage.get(),
    set: (settings: any) => bridge.storage.set(settings),
    onChanged: {
      addListener: (callback: (changes: any) => void) => bridge.storage.onChanged(callback)
    }
  };
      
      console.log('Chrome storage bridge ready in main world');
    } else {
      console.log('Bridge not ready, retrying...');
      setTimeout(waitForBridge, 50);
    }
  }
  
  waitForBridge();
})();