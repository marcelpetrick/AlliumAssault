import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@persistence': path.resolve(__dirname, 'src/persistence'),
      '@workers': path.resolve(__dirname, 'src/workers'),
      '@data': path.resolve(__dirname, 'data'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/core/**', 'src/persistence/**'],
      exclude: ['src/presentation/**', 'src/workers/**'],
    },
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
