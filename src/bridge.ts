// Bridge script - runs in main world and provides Chrome API access via postMessage
(function() {
  'use strict';
  
  console.log('Bridge script loading in main world');
  
  let requestId = 0;
  
  // Create chrome.storage equivalent for main world using postMessage
  if (!(window as any).chrome) (window as any).chrome = {};
  if (!(window as any).chrome.storage) (window as any).chrome.storage = {};
  
  (window as any).chrome.storage.sync = {
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
  
  // Also create the onChanged property
  (window as any).chrome.storage.onChanged = {
    addListener: (callback: (changes: any) => void) => {
      console.log('🔍 DEBUG: Storage onChanged listener registered in main world');
      const id = ++requestId;
      
      const handleMessage = (event: any) => {
        if (event.data.type === 'subtitleStylerChanged') {
          console.log('🔍 DEBUG: Storage change received in main world:', event.data.data);
          callback(event.data.data);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Request to start listening for changes
      window.postMessage({
        type: 'subtitleStyler',
        requestId: id,
        data: { action: 'onChanged' }
      }, '*');
      
      console.log('🔍 DEBUG: Storage onChanged setup complete');
    }
  };
  
  console.log('Chrome storage bridge ready in main world');
})();