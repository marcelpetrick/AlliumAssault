// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, select, startDuel, state } from './support';

test('homing rocket: starts with one, accepts a head/label click, and homes after an ordinary ballistic launch', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /How to Play/ }).click();
  await expect(page.locator('.keys').getByText('H', { exact: true })).toBeVisible();
  await expect(page.locator('.weapon-row').filter({ hasText: 'Flamethrower' }).locator('small')).toContainText('7 dmg per fireball + burning');
  await expect(page.locator('.weapon-row').filter({ hasText: 'Minigun' }).locator('small')).toContainText('14 × 5');
  await expect(page.locator('.weapon-row').filter({ hasText: 'Shotgun' }).locator('small')).toContainText('2 × 22');
  await expect(page.locator('.keys').getByText('J', { exact: true })).toBeVisible();
  await expect(page.locator('.weapon-row').filter({ hasText: 'Homing Rocket' }).locator('small')).toContainText('1 per team');
  await page.locator('[data-action="help-back"]').click();
  await startDuel(page);
  await page.evaluate(() => {
    window.__allium.setManual(true);
    const g = window.__allium.app.game!;
    g.terrain.fill((_x, y) => 20 - y);
    g.buddies.forEach((b, i) => Object.assign(b.body, { x: i === 0 ? 40 : 65, y: 20.65, vx: 0, vy: 0, grounded: true }));
    window.__allium.app.world!.zoom(1500);
    window.__allium.stepFrames(1, 2);
  });
  expect((await state(page)).ammo?.homing).toBe(1);
  await select(page, 'KeyH', 'homing');
  await page.keyboard.press('Space');
  expect((await state(page)).charge).toBeNull();
  for (const viewport of [
    { width: 800, height: 600 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      window.__allium.app.game!.homingTarget = null;
      window.__allium.stepFrames(1, 0);
    });
    const at = await page.evaluate(() => {
      const enemy = window.__allium.app.game!.buddies[1];
      return window.__allium.project(enemy.body.x, enemy.body.y + 2)!;
    });
    await page.mouse.click(at.x, at.y);
    expect((await state(page)).homingTarget).not.toBeNull();
  }
  await page.evaluate(() => {
    window.__allium.stepFrames(1, 0);
    window.__allium.app.game!.activeBuddy!.aim = 0.5;
    window.__allium.app.game!.face(1);
  });
  await expect(page.locator('.hint')).toContainText('Target:');
  await page.keyboard.down('Space');
  await page.evaluate(() => {
    window.__allium.fastForward(1.4);
  });
  await page.keyboard.up('Space');
  await page.evaluate(() => {
    window.__allium.fastForward(0.8);
    window.__allium.stepFrames(1, 0);
  });
  const ballistic = await page.evaluate(() => ({ ...window.__allium.app.game!.projectiles[0] }));
  expect(ballistic.age).toBeLessThan(1);
  await page.evaluate(() => {
    window.__allium.fastForward(0.3);
    window.__allium.stepFrames(1, 0);
  });
  const guided = await page.evaluate(() => ({ ...window.__allium.app.game!.projectiles[0] }));
  expect(guided.age).toBeGreaterThan(1);
  expect(Math.hypot(guided.vx, guided.vy)).toBeCloseTo(24, 3);
  expect(guided.vy).toBeLessThan(0);
  await page.evaluate(() => {
    window.__allium.fastForward(5);
  });
  expect((await state(page)).buddies[1].hp).toBeLessThan(100);
  expect(errors).toEqual([]);
});
