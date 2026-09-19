// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Babylon.js is one large chunk by design; it is cached after the first load.
    chunkSizeWarningLimit: 8000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Only the game rules are unit tested. `src/render`, `src/ui`, `src/app.ts` and `src/audio.ts`
      // need a GPU context or the DOM, so they are covered by the Playwright suite in `e2e/`
      // instead; measuring them here would report a number that no unit test could ever move.
      include: ['src/core/**/*.ts'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
