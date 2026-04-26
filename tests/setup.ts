import { vi, beforeEach } from 'vitest';

// Manual type-safe mock for Chrome APIs
// vitest-chrome has compatibility issues with Vitest 4.x
const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
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

// Mock navigator.clipboard (not available in jsdom)
const clipboardMock = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
};

beforeEach(() => {
  vi.stubGlobal('chrome', chromeMock);
  vi.stubGlobal('DEBUG', true);
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboardMock,
    writable: true,
    configurable: true,
  });
  vi.mocked(clipboardMock.writeText).mockResolvedValue(undefined);
  vi.mocked(clipboardMock.readText).mockResolvedValue('');
});
