// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, state, toHumanAiming } from './support';

test('tag-team setup persists named factions and awards shared victory while friendly fire stays active', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.locator('[data-action="tag-teams"][data-value="0"]')).toHaveClass(/on/);
  await page.locator('[data-action="add-team"]').click();
  await page.locator('[data-action="tag-teams"][data-value="1"]').click();
  await page.locator('[data-field="faction-name"][data-faction="0"]').fill('Bulb Alliance');
  await page.locator('[data-action="faction"][data-team="1"][data-value="0"]').click();
  await page.locator('[data-action="faction"][data-team="2"][data-value="0"]').click();
  await expect(page.locator('[data-action="start"]')).toBeDisabled();
  await page.locator('[data-action="faction"][data-team="2"][data-value="1"]').click();
  await expect(page.locator('[data-action="start"]')).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.locator('[data-field="faction-name"][data-faction="0"]')).toHaveValue('Bulb Alliance');
  await expect(page.locator('[data-action="faction"][data-team="1"][data-value="0"]')).toHaveClass(/on/);
  await page.locator('[data-action="start"]').click();
  await page.evaluate(() => {
    window.__allium.setManual(true);
    const g = window.__allium.app.game!;
    for (let k = 0; k < 300 && g.phase !== 'aiming'; k++) window.__allium.fastForward(1 / 60);
    g.terrain.fill((_x, y) => 20 - y);
    g.buddies.forEach((b, i) => Object.assign(b.body, { x: 15 + i * 9, y: 20.65, vx: 0, vy: 0, grounded: true }));
    const me = g.activeBuddy!;
    const ally = g.buddies.find((b) => b.team === 1)!;
    Object.assign(me.body, { x: 40, y: 20.65, vx: 0, vy: 0, grounded: true });
    Object.assign(ally.body, { x: 41.3, y: 20.65, vx: 0, vy: 0, grounded: true });
    me.facing = 1;
    me.aim = 0;
    g.selectWeapon('punch');
    g.pressFire();
  });
  expect(await page.evaluate(() => window.__allium.app.game!.buddies.find((b) => b.team === 1)!.hp)).toBe(55);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    for (const b of g.buddies)
      if (b.team === 2) {
        b.alive = false;
        b.hp = 0;
      }
    window.__allium.fastForward(20);
    window.__allium.stepFrames(30, 1 / 10);
  });
  expect((await state(page)).winnerTeams).toEqual([0, 1]);
  await expect(page.locator('.victory h2')).toContainText('Bulb Alliance');
  await expect(page.locator('.faction-members')).toContainText('Garlic Gang');
  await expect(page.locator('.faction-members')).toContainText('Clove Crew');
  expect(errors).toEqual([]);
});

test('long faction and team names fit the compact HUD at Huge text size', async ({ page }) => {
  const errors = await boot(page);
  await page.setViewportSize({ width: 960, height: 600 });
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.locator('[data-action="text-size"][data-value="huge"]').click();
  await page.locator('[data-action="tag-teams"][data-value="1"]').click();
  await page.locator('[data-field="team-name"][data-team="0"]').fill('W'.repeat(24));
  await page.locator('[data-field="faction-name"][data-faction="0"]').fill('M'.repeat(24));
  await page.locator('[data-action="start"]').click();
  await toHumanAiming(page);
  await page.evaluate(() => {
    window.__allium.stepFrames(1, 0);
  });
  const boxes = await page.locator('.hud-top > *').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right };
    }),
  );
  for (const r of boxes) {
    expect(r.left).toBeGreaterThanOrEqual(-1);
    expect(r.right).toBeLessThanOrEqual(961);
  }
  expect(errors).toEqual([]);
});
