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
      // Note: vitest --coverage requires matching versions of @vitest/coverage-istanbul
      // and Node 19+ for @vitest/coverage-v8. Use `npm run test:coverage` for static
      // analysis via scripts/analyze-coverage.cjs instead.
      provider: 'istanbul',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
    },
  },
});
