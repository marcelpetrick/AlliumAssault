// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Vite 8.4 folds previously preloaded modules into the 1,875 kB entry chunk.
    // Keep the warning close enough to catch large regressions. See docs/PERFORMANCE.md.
    chunkSizeWarningLimit: 1900,
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
      // The rules core is meant to stay fully exercised; raise these when the numbers allow it.
      thresholds: { statements: 98.1, branches: 98.1, functions: 98.1, lines: 98.1 },
    },
  },
});
