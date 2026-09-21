// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test';
import { boot, fastForward, played, select, startDuel, state, waitFor, waitForSound } from './support';

/** Crates, audio cues and HUD behaviour in real Google Chrome. */

test('crates: one teleports in on the next turn and heals or arms the buddy who grabs it', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page, { crates: 1 });
  expect((await state(page)).crates).toHaveLength(0);

  await page.evaluate(() => {
    window.__allium.app.game!.skipTurn();
  });
  await waitFor(page, (s) => s.turn === 2 && s.crates.length === 1, 30_000);
  const s = await state(page);
  expect(s.phase).toBe('turnStart');
  await waitForSound(page, 'teleport');
  // The camera pans over to the new crate while the (longer) turn intro runs.
  await page.waitForFunction(
    ([cx, cy]) => {
      const c = window.__allium.state().camera!;
      return Math.hypot(c.x - cx, c.y - cy) < 4;
    },
    [s.crates[0].x, s.crates[0].y] as const,
    { timeout: 30_000, polling: 'raf' },
  );
  await waitFor(page, (st) => st.phase === 'aiming', 30_000);
  await page.evaluate(() => {
    window.__allium.stepFrames(20, 1 / 30);
  });
  await info.attach('crate', { body: await page.screenshot(), contentType: 'image/png' });

  const crate = s.crates[0];
  const grabber = s.buddies.find((b) => b.name === s.activeBuddy)!;
  const ammoBefore = s.ammo!;
  await page.evaluate((c) => {
    const b = window.__allium.app.game!.activeBuddy!;
    b.body.x = c.x - 0.95;
    b.body.y = c.y + 0.2;
    b.body.vx = b.body.vy = 0;
  }, crate);
  await fastForward(page, 0.5);
  const after = await state(page);
  expect(after.crates).toHaveLength(0);
  if (crate.kind === 'health') {
    expect(after.buddies.find((b) => b.name === grabber.name)!.hp).toBe(grabber.hp + 25);
    expect(played(after, 'heal')).toBe(1);
  } else {
    const weapon = crate.weapon!;
    expect(after.ammo![weapon]).toBe(ammoBefore[weapon] + 1);
    expect(played(after, 'pickup')).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('crates: a flying sheep collects one for the buddy that launched it, across the map', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page, { crates: 0 });
  const start = await state(page);
  const launcher = start.buddies.find((b) => b.name === start.activeBuddy)!;
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    g.activeBuddy!.hp = 40;
    g.selectWeapon('flysheep');
    g.activeBuddy!.aim = 0.9;
    g.face(1);
    g.pressFire();
  });
  await waitFor(page, (s) => s.phase === 'guiding', 10_000);
  // Let it climb clear of the ground first, so the pickup happens far from the launcher.
  await fastForward(page, 0.8);
  const flown = await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const f = g.action?.kind === 'flyer' ? g.action.flyer : null;
    if (!f) return null;
    // Just ahead on the flight line: close enough that the crate barely falls before it arrives.
    const x = f.x + Math.cos(f.angle) * 1.2;
    const y = f.y + Math.sin(f.angle) * 1.2;
    g.crates.push({ id: 990, kind: 'health', weapon: null, body: { x, y, vx: 0, vy: 0, radius: 0.45, grounded: false, impact: 0, restTime: 0 } });
    return { x, y, fromLauncher: Math.hypot(f.x - g.activeBuddy!.body.x, f.y - g.activeBuddy!.body.y) };
  });
  expect(flown).not.toBeNull();
  expect(flown!.fromLauncher).toBeGreaterThan(4);
  expect((await state(page)).crates).toHaveLength(1);
  await fastForward(page, 0.35);
  await page.evaluate(() => {
    window.__allium.stepFrames(10, 1 / 30);
  });
  await info.attach('sheep-crate', { body: await page.screenshot(), contentType: 'image/png' });
  const after = await state(page);
  expect(after.crates).toHaveLength(0);
  // The health went to the launcher, not to whoever else is on the map, and the heal sound played.
  expect(after.buddies.find((b) => b.name === launcher.name)!.hp).toBe(65);
  expect(played(after, 'heal')).toBe(1);
  expect(errors).toEqual([]);
});

test('tombstones: a buddy that dies leaves a comic tombstone with its name', async ({ page }, info) => {
  const errors = await boot(page);
  const start = await startDuel(page, {
    teams: [
      { name: 'Red Roasters', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Ruby', 'Rex'] },
      { name: 'Blue Bulbs', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Blu', 'Bo'] },
    ],
  });
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const b = g.activeBuddy!;
    b.hp = 1;
    g.explode(b.body.x + 0.5, b.body.y - 0.4, 1.2, 5, 1);
  });
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 12 && !app.game!.graves.length; k++) app.fastForward(1 / 60);
  });
  await waitForSound(page, 'thud');
  const s = await state(page);
  expect(s.graves).toHaveLength(1);
  expect(s.graves[0].name).toBe(start.activeBuddy);
  await info.attach('tombstone', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('gravity: Moon is picked in the setup, shown in the HUD and floats the jumps', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await page.getByRole('button', { name: 'Moon', exact: true }).click();
  await page.getByRole('button', { name: /Start Battle/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase === 'aiming', 60_000);
  expect(await page.evaluate(() => window.__allium.app.game!.terrain.gravityScale)).toBe(0.55);
  await expect(page.locator('.gravity')).toBeVisible();
  await info.attach('moon-gravity', { body: await page.screenshot(), contentType: 'image/png' });

  // The same jump reaches higher than it does in the ordinary world.
  const jump = async () => {
    const start = await page.evaluate(() => {
      const b = window.__allium.app.game!.activeBuddy!;
      b.body.vx = b.body.vy = 0;
      return b.body.y;
    });
    await page.keyboard.press('Enter');
    let top = start;
    for (let k = 0; k < 12; k++) {
      await fastForward(page, 0.1);
      top = Math.max(top, await page.evaluate(() => window.__allium.app.game!.activeBuddy!.body.y));
    }
    await fastForward(page, 2);
    return top - start;
  };
  const moon = await jump();
  await page.evaluate(() => {
    window.__allium.app.game!.terrain.gravityScale = 1;
  });
  const normal = await jump();
  expect(moon).toBeGreaterThan(normal * 1.3);
  expect(errors).toEqual([]);
});

test('setup: the map preview shows the seed\u2019s island and follows the seed and scenery', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  const preview = page.locator('canvas.map-preview');
  await expect(preview).toBeVisible();
  // A drawn preview: the pixels are not all the same colour.
  const fingerprint = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.map-preview')!;
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      const colours = new Set<number>();
      for (let k = 0; k < data.length; k += 4) {
        const rgb = (data[k] << 16) | (data[k + 1] << 8) | data[k + 2];
        sum = (sum * 31 + rgb) % 2147483647;
        if (colours.size < 64) colours.add(rgb);
      }
      return { sum, colours: colours.size };
    });
  const first = await fingerprint();
  expect(first.colours).toBeGreaterThan(3);
  await info.attach('map-preview', { body: await page.screenshot(), contentType: 'image/png' });

  // A different seed draws a different island.
  const seed = page.locator('input[data-field="seed"]');
  await seed.fill('another-island');
  await expect.poll(async () => (await fingerprint()).sum, { timeout: 15_000 }).not.toBe(first.sum);
  const second = await fingerprint();

  // The same seed in another scenery keeps the shape but changes the colours.
  await page.getByRole('button', { name: 'Frosty Peaks' }).click();
  await expect.poll(async () => (await fingerprint()).sum, { timeout: 15_000 }).not.toBe(second.sum);
  expect(await seed.inputValue()).toBe('another-island');

  // And the match that starts really is the previewed seed.
  await page.getByRole('button', { name: /Start Battle/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase === 'aiming', 60_000);
  expect(await page.evaluate(() => window.__allium.app.game!.config.seed)).toBe('another-island');
  expect(errors).toEqual([]);
});

for (const scenery of ['Candy Shop', 'Frosty Peaks']) {
  test(`scenery "${scenery}" can be picked in the setup and renders a match`, async ({ page }, info) => {
    const errors = await boot(page);
    await page.getByRole('button', { name: /Custom Match/ }).click();
    await page.getByRole('button', { name: scenery }).click();
    await page.getByRole('button', { name: /Start Battle/ }).click();
    await waitFor(page, (s) => !s.demo && s.phase === 'aiming', 60_000);
    await page.waitForTimeout(1500);
    const shot = await page.screenshot();
    await info.attach(scenery, { body: shot, contentType: 'image/png' });
    expect(shot.byteLength).toBeGreaterThan(100_000);
    expect(errors).toEqual([]);
  });
}

test('audio cues: weapon select blip, turn start chime, last-seconds tick, mute silences', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);

  await select(page, '2', 'grenade');
  await waitFor(page, (s) => ((s.sound.played as Partial<Record<string, number>>).select ?? 0) >= 1, 10_000);

  // Wind the turn clock down to the last seconds and let real frames run.
  await page.evaluate(() => (window.__allium.app.game!.turnTimeLeft = 4.2));
  await waitFor(page, (s) => ((s.sound.played as Partial<Record<string, number>>).tick ?? 0) >= 1, 30_000);

  // The clock keeps ticking while a sheep is being guided.
  const ticks = played(await state(page), 'tick');
  await select(page, '6', 'sheep');
  await page.evaluate(() => (window.__allium.app.game!.turnTimeLeft = 30));
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'guiding', 10_000);
  await page.evaluate(() => (window.__allium.app.game!.turnTimeLeft = 3.2));
  await waitForSound(page, 'tick', ticks + 1);
  await page.keyboard.press('Space');

  // After the blast and retreat the next turn starts with its chime.
  await fastForward(page, 12);
  await waitFor(page, (s) => s.turn >= 2 && ((s.sound.played as Partial<Record<string, number>>).turn ?? 0) >= 1, 30_000);

  await page.keyboard.press('KeyM');
  const muted = await state(page);
  await select(page, '1', 'bazooka');
  expect(played(await state(page), 'select')).toBe(played(muted, 'select'));
  await page.keyboard.press('KeyM');
  expect(errors).toEqual([]);
});

test('movement sounds: footsteps while walking, a hup when jumping, a thud on landing', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await page.keyboard.down('ArrowRight');
  await waitForSound(page, 'step', 2);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await waitForSound(page, 'step', 4);
  await page.keyboard.up('ArrowLeft');
  await fastForward(page, 0.5);

  await page.keyboard.press('Backspace');
  await waitForSound(page, 'jump');
  await fastForward(page, 2);
  expect(played(await state(page), 'land')).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('a jump rises and lands safely, while a long unprotected fall costs health', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    g.terrain.fill((_x, y) => 20 - y);
    const b = g.activeBuddy!;
    Object.assign(b.body, { x: 40, y: 20.65, vx: 0, vy: 0, grounded: true });
    // Keep the other buddy out of the way of everything that follows.
    g.buddies.find((other) => other !== b)!.body.x = 100;
  });
  const initial = await state(page);
  const jumper = initial.buddies.find((b) => b.name === initial.activeBuddy)!;
  await page.keyboard.press('Enter');
  await fastForward(page, 0.3);
  expect((await state(page)).buddies.find((b) => b.name === jumper.name)!.y).toBeGreaterThan(jumper.y + 1);
  await fastForward(page, 2);
  const landed = (await state(page)).buddies.find((b) => b.name === jumper.name)!;
  expect(landed.y).toBeCloseTo(jumper.y, 1);
  expect(landed.hp).toBe(100);

  // Dropped from ten units up, the same landing hurts and thuds.
  await page.evaluate(() => {
    Object.assign(window.__allium.app.game!.activeBuddy!.body, { y: 31, vx: 0, vy: 0, grounded: false });
  });
  await fastForward(page, 2);
  expect((await state(page)).buddies.find((b) => b.name === jumper.name)!.hp).toBeLessThan(100);
  await waitForSound(page, 'land');
  expect(errors).toEqual([]);
});

test('the drill digs down through a cave and cushions the fall through it', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    g.terrain.fill((_x, y) => 20 - y);
    // A hollow under the buddy: falling into it unprotected would hurt.
    g.terrain.carve(40, 14, 4);
    Object.assign(g.activeBuddy!.body, { x: 40, y: 20.65, vx: 0, vy: 0, grounded: true });
    g.buddies.find((b) => b !== g.activeBuddy)!.body.x = 100;
  });
  await select(page, 'Shift+6', 'drill');
  await page.keyboard.press('Space');
  await fastForward(page, 2);
  const result = await page.evaluate(() => {
    const g = window.__allium.app.game!;
    return { y: g.activeBuddy!.body.y, hp: g.activeBuddy!.hp };
  });
  expect(result.y).toBeLessThan(12);
  expect(result.hp).toBe(100);
  expect(errors).toEqual([]);
});

test('fire effects clean up: no flame meshes, particle systems or light left burning', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  const counts = () =>
    page.evaluate(() => {
      const scene = window.__allium.app.world!.scene;
      return {
        systems: scene.particleSystems.length,
        // A stopped system keeps reporting "started", so count the particles it still draws.
        particles: scene.particleSystems.reduce((sum, ps) => sum + (ps as unknown as { particles: unknown[] }).particles.length, 0),
        flameMeshes: scene.meshes.filter((mesh) => mesh.name.startsWith('groundFlame')).length,
        light: scene.getLightByName('napalmLight')?.intensity ?? 0,
        flames: window.__allium.app.game!.flames.length,
      };
    });
  const before = await counts();

  // Set a patch of ground alight with a napalm strike and let it burn out again.
  await select(page, 'Shift+7', 'napalm');
  const target = await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const b = g.activeBuddy!;
    return window.__allium.project(b.body.x + 8, b.body.y);
  });
  expect(target).not.toBeNull();
  const canvas = await page.locator('#stage').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.click(canvas!.x + target!.x, canvas!.y + target!.y);
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 10 && !app.game!.flames.length; k++) app.fastForward(1 / 60);
  });
  await expect.poll(async () => (await counts()).flameMeshes, { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await counts()).light).toBeGreaterThan(0);

  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 15 && app.game!.flames.length; k++) app.fastForward(1 / 60);
  });
  // Let the one-shot bursts run out their lifetime and be disposed of.
  await page.evaluate(() => {
    window.__allium.stepFrames(180, 1 / 30);
  });
  const after = await counts();
  expect(after.flames).toBe(0);
  expect(after.flameMeshes).toBe(0);
  expect(after.light).toBe(0);
  // The two napalm systems stay allocated for the next fire; every one-shot burst is gone and
  // not a single particle is left being drawn.
  expect(after.systems).toBeLessThanOrEqual(before.systems + 2);
  expect(after.particles).toBe(0);
  expect(errors).toEqual([]);
});

test('HUD: weapon bar lists every weapon with ammo and follows the selection', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  const slots = page.locator('.weapons .slot');
  const ids = await page.evaluate(() => Object.keys(window.__allium.state().ammo!));
  const selectable = await slots.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.weapon!));
  expect(selectable.length).toBeGreaterThanOrEqual(8);
  for (const id of selectable) expect(ids).toContain(id);
  await expect(page.locator('.slot[data-weapon="cluster"]')).toContainText('×3');
  await expect(page.locator('.weapon-name')).toContainText('Bazooka');
  const sheep = page.locator('.slot[data-weapon="sheep"]');
  await sheep.click();
  await waitFor(page, (s) => s.weapon === 'sheep', 10_000);
  await expect(sheep).toHaveClass(/on/);
  await expect(page.locator('.hint')).toContainText('release the sheep');
  await expect(page.locator('.weapon-name')).toContainText('Sheep ×1');

  // All slots fit on one row at 1280 px, and the bar never overflows the viewport.
  const box = (await page.locator('.weapons').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  const tops = await slots.evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size);
  expect(tops).toBe(1);
  expect(errors).toEqual([]);
});

test('sudden death: 1 HP, siren, banner and rising visible water', async ({ page }, info) => {
  const errors = await boot(page);
  // A turn long enough to sit out for a while: the water must not move until the next one starts.
  await startDuel(page, { suddenDeath: 4, turnTime: 20 });
  expect((await state(page)).buddies.every((b) => b.hp === 100)).toBe(true);

  // Skip ahead turn by turn; the strike lands when turn 4 begins.
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    for (let k = 0; k < 600 && g.turn < 4; k++) {
      if (g.phase === 'aiming') g.skipTurn();
      window.__allium.app.fastForward(1 / 60);
    }
  });
  await waitFor(page, (s) => s.turn >= 4, 30_000);
  await waitForSound(page, 'alarm');
  await expect(page.locator('.banner-title')).toHaveText('Sudden Death!');
  await info.attach('sudden-death', { body: await page.screenshot(), contentType: 'image/png' });
  const struck = await state(page);
  expect(struck.buddies.every((b) => b.alive && b.hp === 1)).toBe(true);
  expect(struck.waterRising).toBe(true);
  // Playing on does not raise the water; the next turn does, by exactly one step.
  await fastForward(page, 5);
  expect((await state(page)).waterLevel).toBe(struck.waterLevel);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    for (let k = 0; k < 600 && g.turn < 5; k++) {
      if (g.phase === 'aiming') g.skipTurn();
      window.__allium.app.fastForward(1 / 60);
    }
  });
  await waitFor(page, (s) => s.turn >= 5, 30_000);
  const flooded = await state(page);
  expect(flooded.waterLevel).toBe(struck.waterLevel + 1);
  // The water surface follows the level on the next rendered frame.
  await expect
    .poll(() => page.evaluate(() => window.__allium.app.world!.scene.getMeshByName('water')?.position.y ?? 0), { timeout: 30_000 })
    .toBeCloseTo(flooded.waterLevel, 2);
  expect(errors).toEqual([]);
});
