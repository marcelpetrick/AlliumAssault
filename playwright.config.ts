// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  // One retry: the suite is deterministic, but the browser occasionally loses the dev server to a
  // network change, and that says nothing about the game.
  retries: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    // Locally the suite always builds what it is about to test: reusing a server that happens to
    // be on the port would certify a stale `dist/` and report it green. On CI nothing is listening.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
