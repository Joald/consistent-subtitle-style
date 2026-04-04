import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirror esbuild's compile-time constants so tests see the same globals.
  define: {
    __DEV__: true,
    DEBUG: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      // Istanbul coverage provider — works on Node 18+.
      // Run: npm run test:coverage
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**', 'src/ui/mock-chrome.ts'],
    },
  },
});
