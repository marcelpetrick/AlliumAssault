// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, duel, played, state } from './support';

test('Normal jumps a step to collect a crate with only aircraft ammo, then calls its attack', async ({ page }) => {
  const errors = await boot(page);
  await page.keyboard.press('Shift');
  const config = duel();
  config.teams[0].controller = 'ai';
  const pickupX = await page.evaluate((config) => {
    const h = window.__allium;
    h.startMatch(config);
    h.setManual(true);
    const g = h.app.game!;
    g.terrain.fill((x, y) => Math.max(20 - y, Math.min(0.6 - Math.abs(x - 42), 21.2 - y)));
    g.buddies.forEach((b, i) => Object.assign(b.body, { x: i === 0 ? 40 : 100, y: 20.65, vx: 0, vy: 0, grounded: true }));
    const ammo = g.teams[0].ammo;
    for (const id of Object.keys(ammo) as (keyof typeof ammo)[]) ammo[id] = id === 'airstrike' ? 1 : 0;
    g.selectWeapon('airstrike');
    g.strikeDir = -1;
    g.crates.push({ id: 9999, kind: 'health', weapon: null, body: { ...g.buddies[0].body, x: 45, radius: 0.45 } });
    for (let k = 0; k < 480 && g.buddies[0].hp < 125; k++) h.fastForward(1 / 60);
    const pickupX = g.buddies[0].body.x;
    h.fastForward(5);
    h.stepFrames(1, 0);
    return pickupX;
  }, config);
  const s = await state(page);
  expect(s.crates).toHaveLength(0);
  expect(s.buddies[0].hp).toBe(125);
  expect(pickupX).toBeGreaterThan(43);
  expect(played(s, 'jump')).toBeGreaterThan(0);
  expect(s.lastStrike?.dir).toBe(1);
  expect(errors).toEqual([]);
});
