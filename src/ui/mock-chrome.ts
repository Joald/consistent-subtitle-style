/* eslint-disable */
// --- BROWSER AGENT & LOCAL DEVELOPMENT MOCK ---
const mockChrome = {
  storage: {
    sync: {
      get: (keys: any) =>
        new Promise((resolve) => {
          const data: any = {};
          const storage = JSON.parse(localStorage.getItem('cs_style_mock_storage') || '{}');
          if (keys === null || keys === undefined) {
            resolve(storage);
            return;
          }
          if (typeof keys === 'string') {
            data[keys] = storage[keys];
          } else if (Array.isArray(keys)) {
            keys.forEach((k) => (data[k] = storage[k]));
          } else {
            Object.keys(keys).forEach((k) => (data[k] = storage[k] ?? keys[k]));
          }
          setTimeout(() => resolve(data), 50);
        }),
      set: (data: any) =>
        new Promise((resolve) => {
          const storage = JSON.parse(localStorage.getItem('cs_style_mock_storage') || '{}');
          Object.assign(storage, data);
          localStorage.setItem('cs_style_mock_storage', JSON.stringify(storage));
          setTimeout(() => resolve(undefined), 50);
        }),
    },
  },
  runtime: {
    lastError: null,
    sendMessage: (msg: any) => console.log('Mock Runtime Message:', msg),
    reload: () => {
      console.log('Mock Reload triggered. Refreshing page...');
      window.location.reload();
    },
  },
  tabs: {
    query: (q: any, cb: any) => {
      if (cb) cb([{ id: 1 }]);
      return Promise.resolve([{ id: 1 }]);
    },
    sendMessage: (id: number, msg: any) => console.log(`Mock Tab Message to ${id}:`, msg),
  },
};

if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
  console.warn('Chrome Extension APIs not found. Injecting mock for local development.');
  (window as any).chrome = mockChrome;
}

export {};
