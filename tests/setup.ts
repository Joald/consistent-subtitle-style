import { vi, beforeEach } from 'vitest';

// Manual type-safe mock for Chrome APIs
// vitest-chrome has compatibility issues with Vitest 4.x
const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    getURL: vi.fn().mockImplementation((path: string) => `chrome-extension://mock-id/${path}`),
  },
} as unknown as typeof chrome;

beforeEach(() => {
  vi.stubGlobal('chrome', chromeMock);
  vi.stubGlobal('DEBUG', true);
});
