// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, select, startDuel } from './support';

test('punch and bat knock holes into a wall without needing a victim', async ({ page }) => {
  const errors = await boot(page);
  for (const [weapon, key] of [
    ['punch', '8'],
    ['bat', '9'],
  ] as const) {
    await page.evaluate(() => window.__allium.setManual(false));
    await startDuel(page);
    await page.evaluate(() => {
      window.__allium.setManual(true);
      const g = window.__allium.app.game!;
      g.terrain.fill((_x, y) => 20 - y);
      const b = g.activeBuddy!;
      Object.assign(b.body, { x: 40, y: 20.65, vx: 0, vy: 0, grounded: true });
      b.facing = 1;
      b.aim = 0;
      g.terrain.addDisc(41.4, 20.65, 0.8);
    });
    await select(page, key, weapon);
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.__allium.app.game!.terrain.isSolid(41.4, 20.65))).toBe(false);
  }
  expect(errors).toEqual([]);
});
