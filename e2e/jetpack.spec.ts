// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, select, startDuel, state } from './support';

test('jetpack: J launches, arrows accelerate with visible exhaust, fuel runs out and landing permits a shot', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await page.evaluate(() => {
    window.__allium.setManual(true);
    const g = window.__allium.app.game!;
    g.terrain.fill((_x, y) => 20 - y);
    g.buddies.forEach((b, i) => Object.assign(b.body, { x: i === 0 ? 40 : 100, y: 20.65, vx: 0, vy: 0, grounded: true }));
  });
  await select(page, 'KeyJ', 'jetpack');
  await page.keyboard.press('Space');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => {
    window.__allium.stepFrames(1, 1 / 60);
    window.__allium.fastForward(1);
    window.__allium.stepFrames(1, 0);
  });
  await page.keyboard.up('ArrowRight');
  const flight = await state(page);
  expect(flight.phase).toBe('jetpacking');
  expect(flight.jetpack?.fuel).toBeCloseTo(5, 1);
  expect(flight.buddies[0].y).toBeGreaterThan(25);
  expect(flight.buddies[0].x).toBeGreaterThan(44);
  await expect(page.locator('.hint')).toContainText('fuel');
  const exhaust = await page.evaluate(() => window.__allium.app.world!.scene.getMeshByName('jetpackOuter')?.isEnabled());
  expect(exhaust).toBe(true);
  await info.attach('jetpack-flight', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => {
    window.__allium.stepFrames(1, 1 / 60);
    window.__allium.fastForward(5.5);
    window.__allium.stepFrames(1, 0);
  });
  await page.keyboard.up('ArrowUp');
  expect((await state(page)).jetpack?.fuel).toBe(0);
  await page.evaluate(() => {
    window.__allium.fastForward(22);
    window.__allium.stepFrames(1, 0);
  });
  expect((await state(page)).phase).toBe('aiming');
  expect((await state(page)).buddies[0].hp).toBe(100);
  expect(await page.evaluate(() => window.__allium.app.world!.scene.getMeshByName('jetpackOuter')?.isEnabled())).toBe(false);
  await select(page, '1', 'bazooka');
  await page.keyboard.down('Space');
  await page.evaluate(() => {
    window.__allium.fastForward(0.3);
  });
  await page.keyboard.up('Space');
  expect((await state(page)).projectiles).toBe(1);
  expect(errors).toEqual([]);
});
