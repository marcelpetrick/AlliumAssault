// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from 'vitest/config';

/** `npm run profile`: the measuring runs in bench/, away from the unit tests and their thresholds. */
export default defineConfig({
  test: {
    include: ['bench/**/*.bench.ts'],
    environment: 'node',
    // Measuring needs the whole machine, and each scenario runs for about a second.
    fileParallelism: false,
    testTimeout: 120_000,
    // The table is the whole point of the run, so it goes straight to stdout.
    disableConsoleIntercept: true,
  },
});
