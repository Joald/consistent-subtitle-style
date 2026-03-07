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
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
    },
  },
});
