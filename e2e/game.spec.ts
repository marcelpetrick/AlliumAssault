// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, fastForward, played, startDuel, state, toHumanAiming, waitFor } from './support';

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

  await page.keyboard.press('Digit6');
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
  // Hold the render loop so the match advances only by the amounts this test asks for: otherwise
  // the frames that slip between these calls decide how much was simulated, and the run varies.
  await page.evaluate(() => {
    window.__allium.setManual(true);
  });
  for (let round = 0; round < 60 && (await state(page)).phase !== 'gameOver'; round++) {
    await page.evaluate(() => {
      window.__allium.fastForward(15);
    });
  }
  expect((await state(page)).phase).toBe('gameOver');
  // Frames again, so the two-second pause after the last blast can run and the victory screen open.
  await page.evaluate(() => {
    window.__allium.stepFrames(30, 1 / 10);
  });
  await expect(page.getByText(/wins!|Draw!/)).toBeVisible({ timeout: 90_000 });
  await info.attach('victory', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: /Rematch/ }).click();
  await page.evaluate(() => {
    window.__allium.setManual(false);
  });
  const s = await state(page);
  expect(s.phase).not.toBe('gameOver');
  expect(s.screen).toBeNull();
  expect(errors).toEqual([]);
});

test('every AI level plays a match with crates to a finish without stalling', async ({ page }) => {
  const errors = await boot(page);
  for (const level of ['easy', 'normal', 'hard'] as const) {
    await page.evaluate((aiLevel) => {
      window.__allium.startMatch({
        seed: `e2e-levels-${aiLevel}`,
        teams: [
          { name: 'Red Roasters', color: '#ef4b3c', controller: 'ai', aiLevel, buddyNames: ['Ruby', 'Rex'] },
          { name: 'Blue Bulbs', color: '#3d8bfd', controller: 'ai', aiLevel, buddyNames: ['Blu', 'Bo'] },
        ],
        turnTime: 20,
        retreatTime: 2,
        windMax: 0.3,
        crates: 1,
        theme: 'meadow',
      });
    }, level);
    for (let round = 0; round < 80 && (await state(page)).phase !== 'gameOver'; round++) {
      await page.evaluate(() => {
        window.__allium.fastForward(15);
      });
    }
    const done = await state(page);
    expect(done.phase, `${level} should finish`).toBe('gameOver');
    expect(done.turn).toBeGreaterThan(2);
  }
  expect(errors).toEqual([]);
});

test('a badly hurt AI buddy walks to a health crate instead of taking its shot', async ({ page }, info) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    window.__allium.startMatch({
      seed: 'e2e-duel',
      teams: [
        { name: 'Red Roasters', color: '#ef4b3c', controller: 'ai', aiLevel: 'hard', buddyNames: ['Ruby'] },
        { name: 'Blue Bulbs', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Blu'] },
      ],
      turnTime: 40,
      retreatTime: 2,
      windMax: 0,
      crates: 0,
      theme: 'meadow',
    });
  });
  await page.keyboard.press('Shift');
  // Hold the frame loop so the AI cannot decide before the crate is on the map.
  await page.evaluate(() => {
    window.__allium.setManual(true);
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 30 && !(app.game!.phase === 'aiming' && !app.game!.isHumanTurn); k++) app.fastForward(1 / 60);
  });
  const s = await state(page);
  expect(s.phase).toBe('aiming');
  expect(s.humanTurn).toBe(false);

  // Nearly dead, with a health crate a few steps along the ground it is already standing on.
  const placed = await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const me = g.activeBuddy!;
    me.hp = 12;
    const surface = (x: number) => {
      let y = g.terrain.height - 1;
      while (y > 1 && !g.terrain.isSolid(x, y)) y -= 0.25;
      return y;
    };
    // Put the enemy at the far end of the map: no shot from here is worth more than surviving.
    const enemy = g.buddies.find((b) => b !== me)!;
    enemy.body.x = me.body.x > g.terrain.width / 2 ? 8 : g.terrain.width - 8;
    enemy.body.y = surface(enemy.body.x) + 0.7;
    enemy.body.vx = enemy.body.vy = 0;
    for (const side of [1, -1]) {
      const x = me.body.x + side * 5;
      if (Math.abs(surface(x) - me.body.y) > 1.5) continue;
      g.crates.push({
        id: 980,
        kind: 'health',
        weapon: null,
        body: { x, y: surface(x) + 0.45, vx: 0, vy: 0, radius: 0.45, grounded: true, impact: 0, restTime: 0 },
      });
      return { x, startX: me.body.x };
    }
    return null;
  });
  expect(placed, 'a level patch of ground beside the AI buddy').not.toBeNull();

  // Headless Chrome renders at about 2 fps, so drive the simulation instead of waiting on the clock.
  for (let k = 0; k < 12 && (await state(page)).crates.length > 0; k++) await fastForward(page, 1);
  const after = await state(page);
  await info.attach('ai-crate', { body: await page.screenshot(), contentType: 'image/png' });
  // It walked over and healed itself, rather than shooting from where it stood.
  expect(after.crates).toHaveLength(0);
  expect(Math.abs(after.buddies.find((b) => b.name === 'Ruby')!.x - placed!.startX)).toBeGreaterThan(2);
  expect(after.buddies.find((b) => b.name === 'Ruby')!.hp).toBe(37);
  expect(played(after, 'heal')).toBe(1);
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
  expect(await ammo.count()).toBeGreaterThanOrEqual(15);
  // The HUD renders on frames; poll until it shows the new match.
  await expect.poll(async () => (await ammo.allTextContents()).every((t) => t === '∞'), { timeout: 10_000 }).toBe(true);
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

test('all text sizes keep menu controls and the in-game HUD reachable on a compact viewport', async ({ page }) => {
  const errors = await boot(page);
  await page.setViewportSize({ width: 960, height: 600 });
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });

  const expectInsideViewport = async (selector: string) => {
    const boxes = await page.locator(selector).evaluateAll((els) =>
      els
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
    );
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(-1);
      expect(box.top).toBeGreaterThanOrEqual(-1);
      expect(box.right).toBeLessThanOrEqual(961);
      expect(box.bottom).toBeLessThanOrEqual(601);
    }
  };

  for (const size of ['normal', 'large', 'huge']) {
    await page.evaluate(() => {
      window.__allium.app.menu.showSetup();
    });
    await page.locator(`[data-action="text-size"][data-value="${size}"]`).click();
    await expectInsideViewport('.panel');

    await page.evaluate(() => {
      window.__allium.app.menu.showTitle();
    });
    for (const button of await page.locator('.title-buttons button').all()) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
    }

    await startDuel(page);
    await expectInsideViewport('.hud-top, .team-bars, .weapons, .hint');
    await page.evaluate(() => {
      window.__allium.app.menu.showHelp('pause');
    });
    await expectInsideViewport('.panel');
    await page.evaluate(() => {
      window.__allium.app.menu.showAbout();
    });
    await expectInsideViewport('.panel');
    await page.evaluate(() => {
      window.__allium.app.menu.showPause();
    });
    await expectInsideViewport('.panel');
    await page.evaluate(() => {
      window.__allium.app.menu.showVictory({ name: 'Red Roasters', color: '#ef4b3c' }, 12);
    });
    await expectInsideViewport('.panel');
  }

  await page.evaluate(() => {
    window.__allium.app.menu.showSetup();
  });
  await page.locator('[data-action="text-size"][data-value="normal"]').click();
  await startDuel(page);
  expect(
    await page
      .locator('.slot-key')
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe('12px');
  expect(
    await page
      .locator('.slot-ammo')
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe('12px');
  expect(errors).toEqual([]);
});

test('text size can change while paused without replacing the saved custom setup', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.getByRole('button', { name: '60s' }).click();
  await page.getByRole('button', { name: 'Candy Shop' }).click();
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase !== null, 30_000);

  await page.keyboard.press('Escape');
  await waitFor(page, (s) => s.paused && s.screen === 'pause', 10_000);
  const frozen = (await state(page)).turnTimeLeft;
  await page.locator('[data-action="text-size"][data-value="huge"]').click();
  expect(await page.evaluate(() => document.documentElement.dataset.textSize)).toBe('huge');
  await expect(page.locator('[data-action="text-size"][data-value="huge"]')).toHaveClass(/on/);
  expect((await state(page)).turnTimeLeft).toBe(frozen);
  expect((await state(page)).screen).toBe('pause');

  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('allium.settings') ?? '{}') as { textSize?: string; match?: { turnTime?: number; theme?: string } },
  );
  expect(stored.textSize).toBe('huge');
  expect(stored.match?.turnTime).toBe(60);
  expect(stored.match?.theme).toBe('candy');

  await page.getByRole('button', { name: 'Resume' }).click();
  await waitFor(page, (s) => !s.paused && s.screen === null, 10_000);
  await boot(page);
  expect(await page.evaluate(() => document.documentElement.dataset.textSize)).toBe('huge');
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.getByRole('button', { name: '60s' })).toHaveClass(/on/);
  await expect(page.getByRole('button', { name: 'Candy Shop' })).toHaveClass(/on/);
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

test('HUD buttons pause the match and open How to Play, and the turn timer stops', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase !== null, 30_000);

  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await waitFor(page, (s) => s.paused && s.screen === 'help', 10_000);
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
  // The clock must not run down behind the menu.
  const frozen = (await state(page)).turnTimeLeft;
  await page.waitForTimeout(1200);
  expect((await state(page)).turnTimeLeft).toBe(frozen);
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await waitFor(page, (s) => !s.paused && s.screen === null, 10_000);

  await page.getByRole('button', { name: 'Pause' }).click();
  await waitFor(page, (s) => s.paused && s.screen === 'pause', 10_000);
  await page.getByRole('button', { name: 'Resume' }).click();
  await waitFor(page, (s) => !s.paused && s.screen === null, 10_000);
  expect(errors).toEqual([]);
});

test('pause menu: controls, resume and quit to title', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase !== null, 30_000);
  await page.keyboard.press('Escape');
  await waitFor(page, (s) => s.paused && s.screen === 'pause', 10_000);
  await page.getByRole('button', { name: /How to Play/ }).click();
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await waitFor(page, (s) => !s.paused && s.screen === null, 10_000);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Quit to title/ }).click();
  await waitFor(page, (s) => s.demo && s.screen === 'title', 10_000);
  expect(errors).toEqual([]);
});

test('the Graphics setting picks the renderer budget, persists, and yields to ?quality=low', async ({ page }) => {
  // Booted without the URL override, so the stored setting is what decides.
  const errors = await boot(page, '/');
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await boot(page, '/');

  // Full is the default, and the scene it builds has the shadow cascade.
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.locator('[data-action="quality"][data-value="high"]')).toHaveClass(/on/);
  expect((await state(page)).quality).toBe('high');
  expect((await state(page)).shadows).toBe(true);

  // Low is remembered, and takes effect for the next match rather than the one on screen.
  await page.locator('[data-action="quality"][data-value="low"]').click();
  await expect(page.locator('[data-action="quality"][data-value="low"]')).toHaveClass(/on/);
  expect((await state(page)).shadows).toBe(true);
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('allium.settings') ?? '{}') as { quality?: string }).quality)).toBe('low');
  await startDuel(page);
  expect((await state(page)).quality).toBe('low');
  expect((await state(page)).shadows).toBe(false);

  // A reload restores the choice, and Reset all puts Full back.
  await boot(page, '/');
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.locator('[data-action="quality"][data-value="low"]')).toHaveClass(/on/);
  expect((await state(page)).quality).toBe('low');
  await page.getByRole('button', { name: /Reset all/ }).click();
  await expect(page.locator('[data-action="quality"][data-value="high"]')).toHaveClass(/on/);
  // The scene on screen keeps the budget it was built with; the new choice arrives with the next match.
  expect((await state(page)).quality).toBe('low');
  await startDuel(page);
  expect((await state(page)).quality).toBe('high');
  expect((await state(page)).shadows).toBe(true);

  // The URL escape hatch forces Low even though the stored setting now says Full.
  await boot(page);
  expect((await state(page)).quality).toBe('low');
  expect((await state(page)).shadows).toBe(false);
  expect(errors).toEqual([]);
});

test('setup screen: the map seed sits in the same row as the preview it feeds', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  const boxes = await page.evaluate(() => {
    const seed = document.querySelector('.seed input')!.getBoundingClientRect();
    const preview = document.querySelector('.map-preview')!.getBoundingClientRect();
    return { seed: { top: seed.top, bottom: seed.bottom, right: seed.right }, preview: { top: preview.top, bottom: preview.bottom, left: preview.left } };
  });
  // Same row: their vertical extents overlap, and the seed is to the left of the picture it makes.
  expect(boxes.seed.top).toBeLessThan(boxes.preview.bottom);
  expect(boxes.preview.top).toBeLessThan(boxes.seed.bottom);
  expect(boxes.seed.right).toBeLessThanOrEqual(boxes.preview.left + 1);
  expect(errors).toEqual([]);
});

test('setup screen: Start Battle stays on screen at every text size', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  for (const size of ['normal', 'large', 'huge'] as const) {
    await page.getByRole('button', { name: /Custom Match/ }).click();
    await page.locator(`[data-action="text-size"][data-value="${size}"]`).click();
    // Scroll the options as far as they go: the pinned footer must not go with them.
    await page.evaluate(() => {
      const panel = document.querySelector('.panel.wide')!;
      panel.scrollTop = panel.scrollHeight;
    });
    const start = page.getByRole('button', { name: /Start Battle/ });
    await expect(start).toBeInViewport({ ratio: 0.9 });
    const box = (await start.boundingBox())!;
    expect(box.y, `Start Battle is off the bottom at ${size} text`).toBeLessThan(720);
    expect(box.y + box.height).toBeLessThanOrEqual(721);
    await page.getByRole('button', { name: /Back/ }).click();
  }
  expect(errors).toEqual([]);
});

test('text size scales the whole overlay by one factor: menu, HUD and name tags together', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });

  /** Rendered heights of one element per region, so a region left out of the scaling is visible. */
  const heights = async () => {
    await startDuel(page);
    const h = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
      // Single-line elements only: a block that wraps grows by its line count, not by the scale.
      return { hudTop: box('.turn-buddy'), hudBottom: box('.slot-key'), tag: box('.tag-name'), caption: box('.timer-caption') };
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Quit to title/ }).click();
    await waitFor(page, (s) => s.demo && s.screen === 'title', 10_000);
    return h;
  };

  const pickSize = async (size: string) => {
    await page.getByRole('button', { name: /Custom Match/ }).click();
    await page.locator(`[data-action="text-size"][data-value="${size}"]`).click();
    const menu = await page.evaluate(() => document.querySelector('.setup-screen .field-label')!.getBoundingClientRect().height);
    await page.getByRole('button', { name: /Back/ }).click();
    return menu;
  };

  const base = { menu: await pickSize('normal'), ...(await heights()) };
  for (const [size, factor] of [
    ['large', 1.25],
    ['huge', 1.5],
  ] as const) {
    const scaled = { menu: await pickSize(size), ...(await heights()) };
    for (const key of ['menu', 'hudTop', 'hudBottom', 'tag', 'caption'] as const) {
      expect(base[key], `${key} must have a size to compare`).toBeGreaterThan(0);
      const grew = scaled[key] / base[key];
      // Every region grows by the same factor. The slack is for line boxes, which round to whole
      // pixels — on a 12px caption that is worth a few percent. A region left out of the scaling
      // reads 1.0 and is nowhere near it, which is the mistake this test exists to catch.
      expect(grew, `${key} grew ${grew.toFixed(3)}× at ${size}, not ${String(factor)}×`).toBeGreaterThan(factor * 0.93);
      expect(grew, `${key} grew ${grew.toFixed(3)}× at ${size}, not ${String(factor)}×`).toBeLessThan(factor * 1.07);
    }
  }
  expect(errors).toEqual([]);
});

test('match statistics: the victory screen leads to a scoreboard with teams, buddies and awards', async ({ page }, info) => {
  const errors = await boot(page);
  // A short, violent duel between two AI teams, so the match reaches a winner on its own. Started
  // directly rather than through startDuel, which waits for a human turn that never comes.
  await page.evaluate(() => {
    window.__allium.startMatch({
      seed: 'e2e-stats',
      teams: [
        { name: 'Reds', color: '#ef4b3c', controller: 'ai', aiLevel: 'hard', buddyNames: ['Rocco'] },
        { name: 'Blues', color: '#3d8bfd', controller: 'ai', aiLevel: 'hard', buddyNames: ['Bruno'] },
      ],
      turnTime: 10,
      retreatTime: 1,
      windMax: 0,
      crates: 0,
      theme: 'meadow',
    });
  });
  await page.keyboard.press('Shift');
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 400 && app.game!.phase !== 'gameOver'; k++) app.fastForward(1 / 60);
  });
  await waitFor(page, (s) => s.screen === 'victory', 30_000);

  await page.getByRole('button', { name: /Match statistics/ }).click();
  await expect(page.getByRole('heading', { name: 'Match statistics' })).toBeVisible();

  // Both teams are in the per-team table, with numbers rather than blanks.
  const teamRows = await page.locator('.stats-table').first().locator('tr').allTextContents();
  expect(teamRows.join(' ')).toContain('Reds');
  expect(teamRows.join(' ')).toContain('Blues');

  // At least a couple of awards, each naming somebody and saying something.
  const awards = page.locator('.award');
  expect(await awards.count()).toBeGreaterThanOrEqual(2);
  for (const text of await awards.allTextContents()) expect(text.trim().length).toBeGreaterThan(4);
  // The match length is always a fact, whatever else happened.
  expect((await awards.allTextContents()).join(' ')).toContain('turns');

  // Every buddy is listed by name.
  const buddyTable = await page.locator('.stats-table').last().allTextContents();
  expect(buddyTable.join(' ')).toContain('Rocco');
  expect(buddyTable.join(' ')).toContain('Bruno');
  await info.attach('statistics', { body: await page.screenshot(), contentType: 'image/png' });

  // The new sections: how they went, what was reached for, and the blunders beside the honours.
  await expect(page.getByRole('heading', { name: 'How they went' })).toBeVisible();
  const tally = (await page.locator('.tally').allTextContents()).join(' ');
  expect(tally).toContain('Drowned');
  expect(tally).toContain('Blown up');
  expect(tally).toContain('Self-destructed');
  // Awards are coloured by what they say: a triumph green, a blunder red.
  expect(await page.locator('.award.good').count()).toBeGreaterThan(0);

  // Back to the victory screen, and the winner is still there.
  await page.getByRole('button', { name: /Back/ }).click();
  await expect(page.getByRole('button', { name: /Rematch/ })).toBeVisible();

  expect(errors).toEqual([]);
});

test('match statistics: the whole scoreboard follows the language, awards included', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await boot(page);
  // German chosen before a shot is fired, so the scoreboard is built in it from the start.
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.locator('[data-action="language"][data-value="de"]').click();
  await page.getByRole('button', { name: /Zurück/ }).click();

  await page.evaluate(() => {
    window.__allium.startMatch({
      seed: 'e2e-stats-de',
      teams: [
        { name: 'Rot', color: '#ef4b3c', controller: 'ai', aiLevel: 'hard', buddyNames: ['Rocco'] },
        { name: 'Blau', color: '#3d8bfd', controller: 'ai', aiLevel: 'hard', buddyNames: ['Bruno'] },
      ],
      turnTime: 10,
      retreatTime: 1,
      windMax: 0,
      crates: 0,
      theme: 'meadow',
    });
  });
  await page.keyboard.press('Shift');
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 400 && app.game!.phase !== 'gameOver'; k++) app.fastForward(1 / 60);
  });
  await waitFor(page, (s) => s.screen === 'victory', 30_000);

  await page.getByRole('button', { name: /Match-Statistik/ }).click();
  await expect(page.getByRole('heading', { name: 'Match-Statistik' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wie sie gingen' })).toBeVisible();
  const german = (await page.locator('.stats-panel').textContent()) ?? '';
  expect(german).toContain('Auszeichnungen');
  expect(german).toContain('Ertrunken');
  expect(german).toContain('Schaden ausgeteilt');
  // Nothing English left behind — headings, award titles or table columns.
  for (const english of ['Honours', 'Drowned', 'Blown up', 'Most Valuable Buddy', 'Time in the field', 'Damage dealt', 'Weapon of the match']) {
    expect(german, `"${english}" was left untranslated`).not.toContain(english);
  }
  expect(errors).toEqual([]);
});

test('languages: the whole interface follows the setting, and it survives a reload', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await boot(page);
  // English is what an English browser gets, and the buttons say so.
  await expect(page.getByRole('button', { name: /Custom Match/ })).toBeVisible();

  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.locator('[data-action="language"][data-value="de"]').click();
  // The screen repaints in German, including the control that was just used.
  await expect(page.getByRole('button', { name: 'Schlacht beginnen ▶' })).toBeVisible();
  await expect(page.locator('.field-label').first()).not.toHaveText('Turn time');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('de');

  // The HUD comes up in German too, and so do the weapon names.
  await startDuel(page);
  await expect(page.locator('.timer-caption')).toHaveText('Zug');
  await expect(page.locator('.wind-label').first()).toHaveText('Wind');
  await expect(page.locator('.slot[data-weapon="sheep"]')).toHaveAttribute('aria-label', 'Schaf');
  await expect(page.locator('.hint')).toContainText('Leertaste');

  // Croatian is written the way it is spoken in Split.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Zurück zum Titel/ }).click();
  await waitFor(page, (s) => s.demo && s.screen === 'title', 10_000);
  await page.getByRole('button', { name: /Svoja partija|Eigenes Match/ }).click();
  await page.locator('[data-action="language"][data-value="hr"]').click();
  await expect(page.getByRole('button', { name: 'Počni bitku ▶' })).toBeVisible();
  await expect(page.locator('.setup-screen')).toContainText('Vrime poteza');

  // Mandarin.
  await page.locator('[data-action="language"][data-value="zh"]').click();
  await expect(page.getByRole('button', { name: '开战 ▶' })).toBeVisible();

  // And the choice is remembered across a reload.
  await boot(page);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('zh');
  await expect(page.getByRole('button', { name: /自定义对战/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('setup screen: buddies can be renamed, and the names come back next time', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();

  // Every buddy of every team is a field, not a label.
  const names = page.locator('.buddy-name input');
  const count = await names.count();
  expect(count).toBeGreaterThanOrEqual(4);

  await names.nth(0).fill('Knoblauch');
  await names.nth(1).fill('Češnjak');
  // The seed field and its dice are big enough to hit without aiming.
  const seed = (await page.locator('.seed input').boundingBox())!;
  const dice = (await page.locator('[data-action="dice"]').boundingBox())!;
  expect(seed.width).toBeGreaterThanOrEqual(180);
  expect(seed.height).toBeGreaterThanOrEqual(30);
  expect(dice.height).toBeGreaterThanOrEqual(30);

  // Straight into the browser's memory, and back out of it after a reload.
  const stored = await page.evaluate(() => localStorage.getItem('allium.settings') ?? '');
  expect(stored).toContain('Knoblauch');
  await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.locator('.buddy-name input').nth(0)).toHaveValue('Knoblauch');
  await expect(page.locator('.buddy-name input').nth(1)).toHaveValue('Češnjak');

  // And the match that starts really uses them.
  await page.getByRole('button', { name: /Start Battle/ }).click();
  await waitFor(page, (s) => !s.demo && s.buddies.length > 0, 30_000);
  expect((await state(page)).buddies.map((b) => b.name)).toContain('Knoblauch');
  expect(errors).toEqual([]);
});

test('title screen: About is a real button, the same size as the others', async ({ page }) => {
  const errors = await boot(page);
  const buttons = page.locator('.title-buttons button');
  expect(await buttons.count()).toBe(4);

  const boxes = await buttons.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { text: el.textContent.trim(), width: Math.round(r.width), height: Math.round(r.height), font: s.fontSize, border: s.borderTopColor };
    }),
  );
  const about = boxes.find((b) => b.text.includes('About'))!;
  const help = boxes.find((b) => b.text.includes('How to Play'))!;

  // The same button as the one above it, not a muted link tucked underneath.
  expect(about.width).toBe(help.width);
  expect(about.height).toBe(help.height);
  expect(about.font).toBe(help.font);
  // A visible border is what separates a button from a link here.
  expect(about.border).not.toBe('rgba(0, 0, 0, 0)');
  expect(about.border).toBe(help.border);
  // Every button in the stack is the same width, whatever its label.
  expect(new Set(boxes.map((b) => b.width)).size).toBe(1);

  // And it still does what it always did.
  await page.getByRole('button', { name: /About/ }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('languages: the setup screen options change too, not only their labels', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('allium.settings');
  });
  await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.locator('[data-action="language"][data-value="zh"]').click();

  // Every segmented option and every scenery card, in Mandarin. The labels above them were
  // translated from the start; these come from data modules and were not.
  const optionText = (await page.locator('.options .seg button').allTextContents()).join(' ');
  for (const english of ['Cratyness', 'Lots', 'Normal', 'Off', 'Moon', 'Heavy', 'All weapons', 'Full', 'Huge', 'Turn 10']) {
    expect(optionText, `the option "${english}" is still English in Mandarin`).not.toContain(english);
  }
  expect(optionText).toContain('补给箱狂潮');
  expect(optionText).toContain('月球');

  const scenery = (await page.locator('.themes button').allTextContents()).join(' ');
  for (const english of ['Garlic Meadow', 'Candy Shop', 'Frosty Peaks', 'Golden Sunset', 'Moonlit Grove']) {
    expect(scenery, `the scenery "${english}" is still English in Mandarin`).not.toContain(english);
  }
  expect(scenery).toContain('大蒜草原');

  // The controller buttons on each team card too.
  const players = (await page.locator('.team-card .seg button').allTextContents()).join(' ');
  for (const english of ['Human', 'AI Easy', 'AI Normal', 'AI Hard']) {
    expect(players, `the player option "${english}" is still English in Mandarin`).not.toContain(english);
  }
  expect(players).toContain('玩家');

  // The language list itself stays in each language's own words, which is the point of it.
  const langs = (await page.locator('[data-action="language"]').allTextContents()).join(' ');
  expect(langs).toContain('English');
  expect(langs).toContain('Deutsch');
  expect(errors).toEqual([]);
});
