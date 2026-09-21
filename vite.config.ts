// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Just above the real entry chunk, so importing Babylon from its package root again — which
    // quadrupled the bundle before 1.56.0 — is loud instead of silent. See docs/PERFORMANCE.md.
    chunkSizeWarningLimit: 1800,
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
      thresholds: { statements: 98, branches: 98, functions: 98, lines: 98 },
    },
  },
});
