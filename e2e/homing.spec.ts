// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, select, startDuel, state } from './support';

test('homing rocket: collect from a crate, H selects, click locks an enemy, then ballistic flight changes to pursuit', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /How to Play/ }).click();
  await expect(page.locator('.keys').getByText('H', { exact: true })).toBeVisible();
  await expect(page.locator('.keys').getByText('J', { exact: true })).toBeVisible();
  await expect(page.locator('.weapon-row').filter({ hasText: 'Homing Rocket' }).locator('small')).toContainText('1 per crate');
  await page.locator('[data-action="help-back"]').click();
  await startDuel(page);
  await page.evaluate(() => {
    window.__allium.setManual(true);
    const g = window.__allium.app.game!;
    g.terrain.fill((_x, y) => 20 - y);
    g.buddies.forEach((b, i) => Object.assign(b.body, { x: i === 0 ? 40 : 80, y: 20.65, vx: 0, vy: 0, grounded: true }));
    g.crates.push({ id: 9999, kind: 'weapon', weapon: 'homing', body: { ...g.activeBuddy!.body, radius: 0.45 } });
    window.__allium.fastForward(0.1);
    window.__allium.app.world!.zoom(1500);
    window.__allium.stepFrames(1, 2);
  });
  expect((await state(page)).ammo?.homing).toBe(1);
  await select(page, 'KeyH', 'homing');
  await page.keyboard.press('Space');
  expect((await state(page)).charge).toBeNull();
  const at = await page.evaluate(() => {
    const enemy = window.__allium.app.game!.buddies[1];
    return window.__allium.project(enemy.body.x, enemy.body.y)!;
  });
  await page.mouse.click(at.x, at.y);
  expect((await state(page)).homingTarget).not.toBeNull();
  await page.evaluate(() => {
    window.__allium.stepFrames(1, 0);
    window.__allium.app.game!.activeBuddy!.aim = 1.4;
    window.__allium.app.game!.face(1);
  });
  await expect(page.locator('.hint')).toContainText('Target:');
  await page.keyboard.down('Space');
  await page.evaluate(() => {
    window.__allium.fastForward(1.6);
  });
  await page.keyboard.up('Space');
  await page.evaluate(() => {
    window.__allium.fastForward(2.7);
    window.__allium.stepFrames(1, 0);
  });
  const ballistic = await page.evaluate(() => ({ ...window.__allium.app.game!.projectiles[0] }));
  expect(ballistic.age).toBeLessThan(3);
  await page.evaluate(() => {
    window.__allium.fastForward(0.4);
    window.__allium.stepFrames(1, 0);
  });
  const guided = await page.evaluate(() => ({ ...window.__allium.app.game!.projectiles[0] }));
  expect(guided.age).toBeGreaterThan(3);
  expect(guided.vx).toBeGreaterThan(ballistic.vx);
  await info.attach('homing-rocket', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => {
    window.__allium.fastForward(5);
  });
  expect((await state(page)).buddies[1].hp).toBeLessThan(100);
  expect(errors).toEqual([]);
});
