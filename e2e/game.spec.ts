// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, state, toHumanAiming, waitFor } from './support';

test('title screen runs a live 3D demo behind the menu', async ({ page }, info) => {
  const errors = await boot(page);
  await expect(page.getByRole('button', { name: /Quick Match/ })).toBeVisible();
  const s = await state(page);
  expect(s.demo).toBe(true);
  expect(s.screen).toBe('title');
  expect(s.buddies).toHaveLength(6);
  await page.waitForTimeout(1500);
  const shot = await page.screenshot();
  await info.attach('title', { body: shot, contentType: 'image/png' });
  expect(shot.byteLength).toBeGreaterThan(100_000);
  expect(errors).toEqual([]);
});

test('human turn: walk, jump, aim, shotgun crater, bazooka and retreat', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo && s.screen === null, 30_000);
  // Quick Match uses a random map; continue on a fixed one so a jump cannot land in the water.
  await page.evaluate(() => {
    window.__allium.startMatch({
      seed: 'e2e-human-turn',
      teams: [
        { name: 'Garlic Gang', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Clovis', 'Aioli'] },
        { name: 'Clove Crew', color: '#3d8bfd', controller: 'ai', aiLevel: 'normal', buddyNames: ['Chive', 'Sprout'] },
      ],
      turnTime: 45,
      retreatTime: 5,
      windMax: 0.7,
      crates: 0,
      theme: 'meadow',
    });
  });
  const start = await toHumanAiming(page);
  expect(start.screen).toBeNull();
  const me = () => state(page).then((s) => s.buddies.find((b) => b.name === start.activeBuddy)!);
  const origin = await me();

  await page.keyboard.press('Enter');
  await page.waitForFunction(([name, y]) => window.__allium.state().buddies.find((b) => b.name === name)!.y > y + 0.4, [start.activeBuddy, origin.y] as const, {
    timeout: 30_000,
    polling: 'raf',
  });

  await page.keyboard.press('Digit3');
  await waitFor(page, (s) => s.weapon === 'shotgun', 10_000);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction((name) => window.__allium.state().buddies.find((b) => b.name === name)!.aim < -1.3, start.activeBuddy, {
    timeout: 60_000,
    polling: 'raf',
  });
  await page.keyboard.up('ArrowDown');
  const before = await state(page);
  await page.keyboard.press('Space');
  await page.waitForFunction((rev) => window.__allium.state().terrainRevision > rev, before.terrainRevision, { timeout: 30_000 });
  expect((await state(page)).phase).toBe('aiming');
  await info.attach('shotgun-crater', { body: await page.screenshot(), contentType: 'image/png' });

  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'retreat', 20_000);

  // Next turn belongs to the AI team; skip ahead exactly until it is our turn again, so the human
  // turn starts with its full timer however long the AI takes.
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 600; k++) {
      const s = app.state();
      if ((s.turn >= 3 && s.phase === 'aiming' && s.humanTurn) || s.phase === 'gameOver') break;
      app.fastForward(0.25);
    }
  });
  expect((await state(page)).turn).toBeGreaterThanOrEqual(3);

  // Bazooka: charge with Space and release.
  const next = await toHumanAiming(page);
  expect(next.humanTurn).toBe(true);
  await page.keyboard.press('Digit1');
  await page.keyboard.down('Space');
  await waitFor(page, (s) => (s.charge ?? 0) > 0.3, 30_000);
  expect((await state(page)).sound.charge).toBe(true);
  await info.attach('charging', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.up('Space');
  await waitFor(page, (s) => s.phase === 'retreat' || s.phase === 'settling', 20_000);
  // Firing on key-up happens between frames; sounds follow on the next frame.
  await waitFor(page, (s) => !s.sound.charge && (s.projectiles === 0 || s.sound.flights > 0), 10_000);
  expect(errors).toEqual([]);
});

test('AI vs AI match reaches the victory screen and offers a rematch', async ({ page }, info) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    window.__allium.startMatch({
      seed: 'e2e-duel',
      teams: [
        { name: 'Red Roasters', color: '#ef4b3c', controller: 'ai', aiLevel: 'hard', buddyNames: ['Ruby'] },
        { name: 'Blue Bulbs', color: '#3d8bfd', controller: 'ai', aiLevel: 'hard', buddyNames: ['Blu'] },
      ],
      turnTime: 20,
      retreatTime: 2,
      windMax: 0,
      theme: 'night',
    });
  });
  for (let round = 0; round < 60 && (await state(page)).phase !== 'gameOver'; round++) {
    await page.evaluate(() => {
      window.__allium.fastForward(15);
    });
  }
  expect((await state(page)).phase).toBe('gameOver');
  await expect(page.getByText(/wins!|Draw!/)).toBeVisible({ timeout: 90_000 });
  await info.attach('victory', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: /Rematch/ }).click();
  const s = await state(page);
  expect(s.phase).not.toBe('gameOver');
  expect(s.screen).toBeNull();
  expect(errors).toEqual([]);
});

test('custom match setup: add a team, change options, start', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.getByRole('heading', { name: 'Custom Match' })).toBeVisible();
  await page.getByRole('button', { name: /Add team/ }).click();
  await expect(page.locator('.team-card:not(.add)')).toHaveCount(3);
  const third = page.locator('.team-card:not(.add)').nth(2);
  await third.locator('input.team-name').fill('Onion Outlaws');
  await third.getByRole('button', { name: 'AI Hard' }).click();
  await page.locator('.team-card:not(.add)').nth(0).getByRole('button', { name: '+' }).click();
  await page.getByRole('button', { name: '60s' }).click();
  await page.getByRole('button', { name: 'Moonlit Grove' }).click();
  await page.getByRole('button', { name: 'Find in crates' }).click();
  await info.attach('setup', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: /Start Battle/ }).click();
  const s = await state(page);
  expect(s.demo).toBe(false);
  expect(s.screen).toBeNull();
  expect(s.buddies).toHaveLength(10);
  expect(new Set(s.buddies.map((b) => b.team)).size).toBe(3);
  await expect(page.locator('.team-bar-name', { hasText: 'Onion Outlaws' })).toBeVisible();
  // Special weapons have to be found in crates first.
  await expect(page.locator('.slot[data-weapon="sheep"]')).toHaveClass(/empty/);
  await expect(page.locator('.slot[data-weapon="bazooka"]')).not.toHaveClass(/empty/);
  expect(errors).toEqual([]);
});

test('arsenal "Infinite supplies": every weapon slot shows unlimited ammo', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.getByRole('button', { name: 'Infinite supplies' }).click();
  await page.getByRole('button', { name: /Start Battle/ }).click();
  await waitFor(page, (s) => !s.demo && s.screen === null, 30_000);
  const ammo = page.locator('.weapons .slot .slot-ammo');
  await expect(ammo.first()).toHaveText('∞');
  const texts = await ammo.allTextContents();
  expect(texts.length).toBeGreaterThanOrEqual(15);
  expect(texts.every((t) => t === '∞')).toBe(true);
  expect(errors).toEqual([]);
});

test('settings persist across reloads, text size scales the UI, Reset all restores defaults', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.getByRole('button', { name: 'Large' }).click();
  await page.getByRole('button', { name: '60s' }).click();
  await page.getByRole('button', { name: 'Candy Shop' }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.textSize)).toBe('large');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'))).toBe('1.25');

  // Starting and leaving a Quick Match does not overwrite the saved custom setup.
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo, 30_000);

  // A fresh page load restores everything for the next game.
  await boot(page);
  expect(await page.evaluate(() => document.documentElement.dataset.textSize)).toBe('large');
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.getByRole('button', { name: '60s' })).toHaveClass(/on/);
  await expect(page.getByRole('button', { name: 'Candy Shop' })).toHaveClass(/on/);
  await expect(page.getByRole('button', { name: 'Large' })).toHaveClass(/on/);

  await page.getByRole('button', { name: /Reset all/ }).click();
  await expect(page.getByRole('button', { name: '45s' })).toHaveClass(/on/);
  await expect(page.getByRole('button', { name: 'Garlic Meadow' })).toHaveClass(/on/);
  await expect(page.locator('[data-action="text-size"][data-value="normal"]')).toHaveClass(/on/);
  expect(await page.evaluate(() => document.documentElement.dataset.textSize)).toBe('normal');
  expect(await page.evaluate(() => localStorage.getItem('allium.settings'))).toBeNull();
  expect(errors).toEqual([]);
});

test('about screen: author, free to play on GitHub Pages, tech stack and licenses', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /About/ }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  const about = page.locator('.panel.about');
  await expect(about).toContainText('mail@marcelpetrick.it');
  await expect(about).toContainText('free to play');
  await expect(about.getByRole('link', { name: /marcelpetrick.github.io\/AlliumAssault/ })).toHaveAttribute(
    'href',
    'https://marcelpetrick.github.io/AlliumAssault/',
  );
  await expect(about).toContainText('Babylon.js');
  await expect(about).toContainText('Apache-2.0');
  await expect(about).toContainText('GPL-3.0-or-later');
  await expect(about.locator('.licenses tr')).toHaveCount(9);
  await page.keyboard.press('Escape');
  await waitFor(page, (s) => s.screen === 'title', 10_000);
  expect(errors).toEqual([]);
});

test('pause menu: controls, resume and quit to title', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase !== null, 30_000);
  await page.keyboard.press('Escape');
  await waitFor(page, (s) => s.paused && s.screen === 'pause', 10_000);
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await waitFor(page, (s) => !s.paused && s.screen === null, 10_000);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Quit to title/ }).click();
  await waitFor(page, (s) => s.demo && s.screen === 'title', 10_000);
  expect(errors).toEqual([]);
});
