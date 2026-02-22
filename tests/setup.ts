import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  });
});
