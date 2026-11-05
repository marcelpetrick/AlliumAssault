// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot } from './support';

test('painted landscape: reject empty canvas, draw separate islands and play the result', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('[data-action="setup"]').click();
  await page.locator('[data-action="tag-teams"][data-value="1"]').click();
  await page.locator('[data-action="paint-open"]').click();
  await page.locator('[data-action="paint-apply"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('[data-action="paint-open"]').click();
  const canvas = page.locator('[data-paint]');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('paint canvas missing');
  const stroke = async (x1: number, y: number, x2: number) => {
    await page.mouse.move(box.x + box.width * x1, box.y + box.height * y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * x2, box.y + box.height * y, { steps: 5 });
    await page.mouse.up();
  };
  await stroke(0.12, 0.7, 0.88);
  await stroke(0.35, 0.35, 0.55);
  await page.locator('[data-action="paint-erase"]').click();
  await expect(page.locator('[data-action="paint-erase"]')).toHaveAttribute('aria-pressed', 'true');
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.7 } });
  await page.locator('[data-action="paint-apply"]').click();
  await expect(page.locator('[data-action="paint-remove"]')).toBeVisible();
  await page.locator('[data-action="paint-open"]').click();
  await page.locator('[data-action="paint-clear"]').click();
  await page.locator('[data-action="paint-cancel"]').click();
  await expect(page.locator('[data-action="paint-remove"]')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => '__allium' in window && window.__allium.ready);
  await page.locator('[data-action="setup"]').click();
  await expect(page.locator('[data-action="paint-remove"]')).toBeVisible();
  await page.locator('[data-action="start"]').click();
  const result = await page.evaluate(() => {
    const game = window.__allium.app.game!;
    return {
      mask: game.config.painted,
      factions: game.config.tagTeams,
      land: game.terrain.isSolid(32, 19),
      erased: game.terrain.isSolid(64, 19),
      floating: game.terrain.isSolid(58, 41.5),
      gap: game.terrain.isSolid(58, 31),
      grounded: game.buddies.every((b) => b.body.y > game.terrain.waterLevel && game.terrain.isSolid(b.body.x, b.body.y - 0.8)),
    };
  });
  expect(result.mask).toHaveLength(2048);
  expect(result.factions).toBe(true);
  expect(result.land).toBe(true);
  expect(result.erased).toBe(false);
  expect(result.floating).toBe(true);
  expect(result.gap).toBe(false);
  expect(result.grounded).toBe(true);
  expect(errors).toEqual([]);
});
