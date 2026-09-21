// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test, type Page } from '@playwright/test';
import { aim, boot, chargeAndRelease, fastForward, played, select, startDuel, state, waitFor, waitForSound } from './support';

/**
 * One test per weapon in real Google Chrome: real keyboard and mouse input, checking what the
 * weapon does to the match (projectiles, craters, damage) and which sounds it produces.
 */

/** Stand the enemy right in front of the active buddy, let it settle, and aim at it. */
async function faceEnemyUpClose(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const me = g.activeBuddy!;
    const enemy = g.buddies.find((b) => b !== me)!;
    enemy.body.x = me.body.x + 1.2;
    enemy.body.y = me.body.y + 0.3;
    enemy.body.vx = enemy.body.vy = 0;
  });
  await fastForward(page, 0.6);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const me = g.activeBuddy!;
    const enemy = g.buddies.find((b) => b !== me)!;
    g.face(enemy.body.x < me.body.x ? -1 : 1);
    me.aim = Math.atan2(enemy.body.y - me.body.y, Math.abs(enemy.body.x - me.body.x));
  });
}

const me = (page: Page) => page.evaluate(() => window.__allium.state().buddies.find((b) => b.name === window.__allium.state().activeBuddy)!);

test('bazooka: charge whoosh while holding Space, whistling rocket, explosion and crater', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '1', 'bazooka');
  await aim(page, -0.5);
  const before = await state(page);

  await page.keyboard.down('Space');
  await waitFor(page, (s) => (s.charge ?? 0) > 0.15 && s.sound.charge, 60_000);
  await page.keyboard.up('Space');
  await waitFor(page, (s) => ((s.sound.played as Partial<Record<string, number>>).fire ?? 0) > 0 && !s.sound.charge, 10_000);

  // Flying rockets have a flight voice; once it hits, it explodes and carves a crater.
  const flying = await state(page);
  if (flying.projectiles > 0) await waitFor(page, (s) => s.projectiles === 0 || s.sound.flights > 0, 10_000);
  await fastForward(page, 3);
  const after = await state(page);
  expect(after.projectiles).toBe(0);
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(played(after, 'explosion')).toBeGreaterThan(played(before, 'explosion'));
  expect(await page.evaluate(() => window.__allium.app.world!.scene.getMeshesById('blastCore').some((mesh) => mesh.isEnabled()))).toBe(true);
  expect(['retreat', 'settling', 'deaths', 'turnStart', 'aiming']).toContain(after.phase);
  await info.attach('bazooka', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('grenade: bounces audibly, then explodes after its fuse', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '2', 'grenade');
  await aim(page, -0.35);
  const before = await state(page);
  await chargeAndRelease(page, 0.05);
  await waitFor(page, (s) => s.projectiles === 1, 10_000);

  await fastForward(page, 2);
  const mid = await state(page);
  expect(mid.projectiles).toBe(1);
  expect(played(mid, 'bounce')).toBeGreaterThan(0);
  expect(mid.terrainRevision).toBe(before.terrainRevision);

  await fastForward(page, 1.5);
  const after = await state(page);
  expect(after.projectiles).toBe(0);
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(played(after, 'explosion')).toBeGreaterThan(played(before, 'explosion'));
  expect(errors).toEqual([]);
});

test('shotgun: two instant shots with sound, each carving the ground', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '3', 'shotgun');
  await aim(page, -1.2);
  const before = await state(page);

  await page.keyboard.press('Space');
  // Each shot plays a gunshot, and its small crater a second one.
  await waitForSound(page, 'shot', 2);
  const first = await state(page);
  expect(first.phase).toBe('aiming');
  expect(first.terrainRevision).toBeGreaterThan(before.terrainRevision);

  await page.keyboard.press('Space');
  await waitForSound(page, 'shot', 4);
  const second = await state(page);
  expect(['retreat', 'settling']).toContain(second.phase);
  expect(second.terrainRevision).toBeGreaterThan(first.terrainRevision);
  expect(errors).toEqual([]);
});

test('garlic punch: 45 damage and launches the enemy upwards', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '4', 'punch');
  const puncher = await me(page);
  await faceEnemyUpClose(page);
  await page.keyboard.press('Space');
  await waitForSound(page, 'punch');
  const s = await state(page);
  const enemy = s.buddies.find((b) => b.name !== puncher.name)!;
  expect(enemy.hp).toBe(55);
  expect(played(s, 'punch')).toBe(1);
  expect(played(s, 'hurt')).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('baseball bat: crack, 25 damage and a long flight for the enemy', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '8', 'bat');
  const batter = await me(page);
  await faceEnemyUpClose(page);
  const standing = (await state(page)).buddies.find((b) => b.name !== batter.name)!;
  await page.keyboard.press('Space');
  await waitForSound(page, 'bat');
  const s = await state(page);
  const enemy = s.buddies.find((b) => b.name !== batter.name)!;
  expect(enemy.hp).toBe(75);
  expect(s.ammo!.bat).toBe(1);
  await fastForward(page, 0.5);
  const flying = (await state(page)).buddies.find((b) => b.name !== batter.name)!;
  expect(!flying.alive || Math.hypot(flying.x - standing.x, flying.y - standing.y) > 5).toBe(true);
  await info.attach('bat', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('blowtorch: roaring flame walks the buddy forward through the rock', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '9', 'torch');
  const start = await me(page);
  await aim(page, 0, 1);
  const before = await state(page);
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'torching' && s.sound.torch, 10_000);
  await page.evaluate(() => {
    window.__allium.stepFrames(20, 1 / 30);
  });
  const torch = await page.evaluate(() => {
    const game = window.__allium.app.game!;
    const mesh = window.__allium.app.world!.scene.getMeshByName('torchOuter');
    return { visible: mesh?.isEnabled(), reach: mesh?.scaling.y ?? 0, ahead: (mesh?.position.x ?? 0) - game.activeBuddy!.body.x };
  });
  expect(torch.visible).toBe(true);
  expect(torch.reach).toBeGreaterThan(2);
  expect(torch.ahead).toBeGreaterThan(1);
  await info.attach('torch', { body: await page.screenshot(), contentType: 'image/png' });
  // stepFrames switched to manual frames; sounds follow the game only while frames run.
  await page.evaluate(() => window.__allium.setManual(false));
  await fastForward(page, 3);
  const after = await state(page);
  expect(after.phase).not.toBe('torching');
  await waitFor(page, (s) => !s.sound.torch, 10_000);
  const moved = after.buddies.find((b) => b.name === start.name)!;
  expect(Math.abs(moved.x - start.x) > 2 || moved.y < start.y - 1).toBe(true);
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(errors).toEqual([]);
});

test('blowtorch aimed upwards cuts its way up through the rock', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '9', 'torch');
  // Put a block of rock up and ahead of the buddy, so the flame always has something to bite into.
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const b = g.activeBuddy!;
    for (let k = 0; k <= 30; k++) g.terrain.addDisc(b.body.x + 3, b.body.y + 2.5 + k * 0.5, 3);
  });
  const start = await me(page);
  await aim(page, 0.9, 1);
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'torching', 10_000);
  const upwardFlame = await page.evaluate(() => {
    const app = window.__allium.app;
    app.stepFrames(1);
    const mesh = app.world!.scene.getMeshByName('torchOuter');
    const rise = (mesh?.position.y ?? 0) - app.game!.activeBuddy!.body.y;
    app.manual = false;
    return rise;
  });
  expect(upwardFlame).toBeGreaterThan(1);
  await fastForward(page, 3.2);
  const moved = (await state(page)).buddies.find((b) => b.name === start.name)!;
  expect(moved.y).toBeGreaterThan(start.y + 1.5);
  expect(moved.x).toBeGreaterThan(start.x + 0.5);
  expect(errors).toEqual([]);
});

test('minigun: rattling burst of bullets that hurts and shoves the enemy', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+1', 'minigun');
  const gunner = await me(page);
  await faceEnemyUpClose(page);
  await page.keyboard.press('Space');
  await waitForSound(page, 'spinup');
  await waitForSound(page, 'bullet', 10);
  await fastForward(page, 1);
  const s = await state(page);
  expect(['retreat', 'settling', 'deaths', 'turnStart', 'aiming', 'gameOver']).toContain(s.phase);
  const enemy = s.buddies.find((b) => b.name !== gunner.name)!;
  expect(!enemy.alive || enemy.hp <= 70).toBe(true);
  expect(errors).toEqual([]);
});

test('holy garlic grenade: comes to rest, sings, then an enormous blast', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+2', 'holy');
  await aim(page, 0.5, 1);
  const before = await state(page);
  await chargeAndRelease(page, 0.1);
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 12 && !app.game!.projectiles.some((p) => p.armed); k++) app.fastForward(1 / 60);
  });
  await waitForSound(page, 'hallelujah');
  await page.evaluate(() => {
    window.__allium.stepFrames(6, 1 / 30);
  });
  await info.attach('holy', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => window.__allium.setManual(false));
  await fastForward(page, 2);
  await waitForSound(page, 'explosion', played(before, 'explosion') + 1);
  expect((await state(page)).terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(errors).toEqual([]);
});

test('holy garlic grenade on a hillside arms from rest and shows its countdown', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  // Put the buddy on real sloped ground: a contact that rejected its own step used to freeze the
  // grenade there with metres per second of stored speed, so it only armed on the 10-second fuse.
  const slope = await page.evaluate(() => {
    const t = window.__allium.app.game!.terrain;
    const surface = (x: number) => {
      let y = t.height - 1;
      while (y > 1 && !t.isSolid(x, y)) y -= 0.25;
      return y;
    };
    const mid = t.width / 2;
    for (let d = 0; d < mid - 16; d += 0.5) {
      for (const x of [mid - d, mid + d]) {
        const y = surface(x);
        const tilt = Math.abs(t.normal(x, y).x / t.normal(x, y).y);
        const room = [-4, -2, 2, 4].every((o) => surface(x + o) > t.waterLevel + 6);
        if (y > t.waterLevel + 6 && room && tilt > 0.45 && tilt < 0.95) return { x, y, tilt };
      }
    }
    return null;
  });
  expect(slope).not.toBeNull();
  await page.evaluate((spot) => {
    const b = window.__allium.app.game!.activeBuddy!;
    b.body.x = spot!.x;
    b.body.y = spot!.y + 1;
    b.body.vx = b.body.vy = 0;
  }, slope);
  await fastForward(page, 1);
  await select(page, 'Shift+2', 'holy');
  await aim(page, 1.2, 1);
  await chargeAndRelease(page, 0.15);
  const armed = await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 9; k++) {
      app.fastForward(1 / 60);
      const shot = app.game!.projectiles.find((p) => p.weapon === 'holy');
      if (!shot) return null;
      if (shot.armed) return { age: shot.age, speed: Math.hypot(shot.vx, shot.vy) };
    }
    return { age: Infinity, speed: Infinity };
  });
  expect(armed).not.toBeNull();
  expect(armed!.age).toBeLessThan(6);
  expect(armed!.speed).toBeLessThan(0.6);

  // The countdown is on screen and running down from the 1.6-second rest fuse.
  await page.evaluate(() => {
    window.__allium.stepFrames(2, 1 / 60);
  });
  const fuse = page.locator('.fuse').first();
  await expect(fuse).toHaveText('2');
  await page.evaluate(() => {
    window.__allium.app.fastForward(0.8);
    window.__allium.stepFrames(2, 1 / 60);
  });
  await expect(fuse).toHaveText('1');
  expect(errors).toEqual([]);
});

test('banana bomb: five bananas scatter and explode one after another', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+3', 'banana');
  await aim(page, 1.1, 1);
  const before = await state(page);
  await chargeAndRelease(page, 0.05);
  await waitFor(page, (s) => s.projectiles === 1, 10_000);
  const bananas = await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 5; k++) {
      app.fastForward(1 / 60);
      const n = app.game!.projectiles.filter((p) => p.weapon === 'bananalet').length;
      if (n) return n;
    }
    return 0;
  });
  expect(bananas).toBe(5);
  await page.evaluate(() => {
    window.__allium.stepFrames(4, 1 / 30);
  });
  await info.attach('bananas', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => window.__allium.setManual(false));
  await fastForward(page, 4);
  const after = await state(page);
  expect(after.projectiles).toBe(0);
  expect(played(after, 'explosion') - played(before, 'explosion')).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('flying sheep: the arrow keys steer it for the whole flight, Space detonates', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+4', 'flysheep');
  // Straight up, into open sky, so there is room to steer.
  await aim(page, 1.45, 1);
  const before = await state(page);
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'guiding' && ((s.sound.played as Partial<Record<string, number>>).baa ?? 0) >= 1 && s.sound.flights > 0, 10_000);
  // Hold each arrow until the sheep flies that way: left, then up, then right, then left again.
  const steer = async (key: string, x: number, y: number) => {
    await page.keyboard.down(key);
    await page.waitForFunction(
      ([hx, hy]) => {
        const f = window.__allium.app.game!.flyer;
        return !f || Math.cos(f.angle) * hx + Math.sin(f.angle) * hy > 0.95;
      },
      [x, y] as const,
      { timeout: 60_000, polling: 'raf' },
    );
    await page.keyboard.up(key);
    return page.evaluate(() => window.__allium.app.game!.flyer !== null);
  };
  expect(await steer('ArrowLeft', -1, 0)).toBe(true);
  expect(await steer('ArrowUp', 0, 1)).toBe(true);
  expect(await steer('ArrowRight', 1, 0)).toBe(true);
  expect(await steer('ArrowLeft', -1, 0)).toBe(true);
  await info.attach('flying sheep', { body: await page.screenshot(), contentType: 'image/png' });
  expect((await state(page)).phase).toBe('guiding');
  await page.keyboard.press('Space');
  await waitForSound(page, 'explosion', played(before, 'explosion') + 1);
  expect(await page.evaluate(() => window.__allium.app.game!.flyer)).toBeNull();
  expect(errors).toEqual([]);
});

test('concrete mule: a click drops it, it brays and smashes down repeatedly', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+5', 'mule');
  const m = await me(page);
  const canvas = (await page.locator('#stage').boundingBox())!;
  const target = (await page.evaluate(([x, y]) => window.__allium.project(x, y), [m.x + 8, m.y] as const))!;
  const before = await state(page);
  await page.mouse.click(canvas.x + target.x, canvas.y + target.y);
  await waitForSound(page, 'bray');
  expect((await state(page)).ammo!.mule).toBe(0);
  await fastForward(page, 1.6);
  await page.evaluate(() => {
    window.__allium.stepFrames(3, 1 / 30);
  });
  await info.attach('mule', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => window.__allium.setManual(false));
  await fastForward(page, 8);
  const after = await state(page);
  expect(played(after, 'explosion') - played(before, 'explosion')).toBeGreaterThanOrEqual(3);
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(errors).toEqual([]);
});

test('drill: Shift+6, grinding sound, the buddy drills straight down', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+6', 'drill');
  const start = await me(page);
  const before = await state(page);
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'drilling' && s.sound.drill, 10_000);
  await page.evaluate(() => {
    window.__allium.stepFrames(15, 1 / 30);
  });
  await info.attach('drill', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => window.__allium.setManual(false));
  await fastForward(page, 3);
  await waitFor(page, (s) => s.phase !== 'drilling' && !s.sound.drill, 10_000);
  const after = await state(page);
  const driller = after.buddies.find((b) => b.name === start.name)!;
  expect(start.y - driller.y).toBeGreaterThan(2);
  expect(Math.abs(driller.x - start.x)).toBeLessThan(1);
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(errors).toEqual([]);
});

test('napalm strike: Shift+7 and a click, flames crackle on the ground, then burn out', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+7', 'napalm');
  const m = await me(page);
  const canvas = (await page.locator('#stage').boundingBox())!;
  const target = (await page.evaluate(([x, y]) => window.__allium.project(x, y), [m.x + 8, m.y] as const))!;
  await page.mouse.click(canvas.x + target.x, canvas.y + target.y);
  await waitForSound(page, 'plane');
  expect((await state(page)).ammo!.napalm).toBe(0);
  // Fast-forward until the napalm has landed, then let real frames run the fire.
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 10 && !app.game!.flames.length; k++) app.fastForward(1 / 60);
  });
  await waitForSound(page, 'ignite');
  await waitFor(page, (s) => s.sound.fire, 10_000);
  const visibleFire = await page.evaluate(() => {
    const app = window.__allium.app;
    return app.game!.flames.filter((flame) => app.world!.scene.getMeshByName(`groundFlameOuter-${flame.id}`)?.isEnabled()).length;
  });
  expect(visibleFire).toBeGreaterThan(0);
  await info.attach('napalm', { body: await page.screenshot(), contentType: 'image/png' });
  await fastForward(page, 7);
  await waitFor(page, (s) => !s.sound.fire, 10_000);
  expect(await page.evaluate(() => window.__allium.app.game!.flames.length)).toBe(0);
  expect(await page.evaluate(() => window.__allium.app.world!.scene.meshes.filter((mesh) => mesh.name.startsWith('groundFlame')).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('self-destruct: siren, the buddy is gone and the nearby enemy badly hurt', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '0', 'selfdestruct');
  const bomber = await me(page);
  await faceEnemyUpClose(page);
  const before = await state(page);
  await page.keyboard.press('Space');
  await waitForSound(page, 'alarm');
  await waitForSound(page, 'explosion', played(before, 'explosion') + 1);
  const s = await state(page);
  expect(s.buddies.find((b) => b.name === bomber.name)!.alive).toBe(false);
  expect(s.buddies.find((b) => b.name !== bomber.name)!.hp).toBeLessThan(40);
  expect(s.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(errors).toEqual([]);
});

test('cluster bomb: red grenade bursts into five exploding bomblets', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '5', 'cluster');
  await aim(page, 1.1);
  const before = await state(page);
  await chargeAndRelease(page, 0.05);
  await waitFor(page, (s) => s.projectiles === 1, 10_000);
  expect((await state(page)).ammo!.cluster).toBe(2);

  // Step until the grenade bursts, then count the fragments.
  const bomblets = await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 60 * 5; k++) {
      app.fastForward(1 / 60);
      const fragments = app.game!.projectiles.filter((p) => p.weapon === 'bomblet').length;
      if (fragments) return fragments;
    }
    return 0;
  });
  expect(bomblets).toBe(5);
  await info.attach('bomblets', { body: await page.screenshot(), contentType: 'image/png' });
  await fastForward(page, 5);
  const after = await state(page);
  expect(after.projectiles).toBe(0);
  expect(played(after, 'explosion') - played(before, 'explosion')).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('sheep: baa on release, hops away, Space blows it up', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  const start = await me(page);
  await select(page, '6', 'sheep');
  await aim(page, 0, 1);
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'guiding' && s.sheep !== null && (s.sound.played as Partial<Record<string, number>>).baa === 1, 10_000);

  await fastForward(page, 1.5);
  const guiding = await state(page);
  expect(guiding.phase).toBe('guiding');
  expect(Math.abs(guiding.sheep!.x - start.x)).toBeGreaterThan(2);
  expect(played(guiding, 'hop')).toBeGreaterThanOrEqual(2);
  await info.attach('sheep', { body: await page.screenshot(), contentType: 'image/png' });

  await page.keyboard.press('Space');
  await page.waitForFunction((rev) => window.__allium.state().sheep === null && window.__allium.state().terrainRevision > rev, guiding.terrainRevision, {
    timeout: 10_000,
  });
  await waitForSound(page, 'explosion', played(guiding, 'explosion') + 1);
  expect(['retreat', 'settling']).toContain((await state(page)).phase);
  expect(errors).toEqual([]);
});

test('rope: Shift+9 hooks the rock overhead, then reel, swing and let go', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  const before = await state(page);
  // Give the buddy something to hook: a slab of rock well above its head, with a stub hanging off
  // it to the right so the swing has a corner to wrap the rope around.
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const me = g.activeBuddy!;
    for (let x = me.body.x - 12; x <= me.body.x + 12; x += 0.8) g.terrain.addDisc(x, me.body.y + 13.3, 1.6);
    for (let y = me.body.y + 5.3; y <= me.body.y + 13.3; y += 0.6) g.terrain.addDisc(me.body.x + 4, y, 1.1);
  });
  await select(page, 'Shift+9', 'rope');
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    g.activeBuddy!.aim = Math.PI / 2 - 0.01;
    g.face(1);
  });
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'roping', 10_000);
  await waitForSound(page, 'hookShot');
  await fastForward(page, 0.5);
  await waitForSound(page, 'hookBite');
  const hooked = await state(page);
  expect(hooked.rope!.state).toBe('attached');
  expect(hooked.rope!.pivots).toBe(1);
  // One use spent, and only once the hook actually bit.
  expect(hooked.ammo!.rope).toBe(before.ammo!.rope - 1);

  // Reel up, then swing sideways. Held keys only reach the game on a rendered frame, and those come
  // about twice a second here, so the traversal is driven through the input the key handler sets.
  const startY = (await me(page)).y;
  await page.evaluate(() => {
    window.__allium.app.game!.input.up = true;
  });
  await fastForward(page, 0.5);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    g.input.up = false;
    g.input.right = true;
  });
  await fastForward(page, 3);
  await page.evaluate(() => {
    window.__allium.app.game!.input.right = false;
  });
  const swung = await me(page);
  expect(swung.y).toBeGreaterThan(startY + 1.5);
  // Swinging past the stub bends the rope around it, which rebuilds the tube with an extra point.
  expect((await state(page)).rope!.pivots).toBeGreaterThan(1);
  await page.evaluate(() => {
    window.__allium.stepFrames(10, 1 / 30);
  });
  await info.attach('rope', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(page.locator('.hint')).toContainText('reel');

  // Space lets go and keeps the momentum; landing hands control back with the turn still running.
  const hanging = await me(page);
  await page.keyboard.press('Space');
  const loose = await state(page);
  expect(loose.rope).toBeNull();
  expect(loose.phase).toBe('roping');
  await fastForward(page, 4);
  const landed = await state(page);
  expect(landed.phase).toBe('aiming');
  expect(landed.turnTimeLeft).toBeGreaterThan(0);
  expect(Math.abs(landed.buddies.find((b) => b.name === hanging.name)!.x - hanging.x)).toBeGreaterThan(0.5);
  // And a weapon still fires afterwards: the rope is a way of getting about, not the turn's shot.
  await select(page, '1', 'bazooka');
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.projectiles > 0 || s.phase === 'retreat', 15_000);
  expect(errors).toEqual([]);
});

test('platform: Shift+0 previews a board, the wheel tilts it and a click sets it down', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 'Shift+0', 'platform');
  const before = await state(page);
  // Find open air near the buddy that the board fits into, and where on screen that is.
  const target = await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const world = window.__allium.app.world!;
    const buddy = g.activeBuddy!;
    const occupied = g.buddies.map((b) => b.body);
    for (let offset = 5; offset < 18; offset++) {
      const x = buddy.body.x + offset;
      for (let y = buddy.body.y + 4; y < buddy.body.y + 14; y++) {
        if (!g.terrain.canPlacePlatform({ x, y, angle: 0.08 }, occupied)) continue;
        const screen = world.project(x, y);
        if (screen && screen.x > 40 && screen.y > 40 && screen.x < innerWidth - 40 && screen.y < innerHeight - 100) return screen;
      }
    }
    return null;
  });
  expect(target).not.toBeNull();
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + target!.x, box!.y + target!.y);
  // The preview follows the mouse and the wheel tilts it instead of zooming.
  await expect.poll(() => page.evaluate(() => window.__allium.app.world!.scene.getMeshByName('platformPreview')?.isEnabled() ?? false)).toBe(true);
  const zoom = await page.evaluate(() => window.__allium.app.world!.zoomDistance);
  await page.mouse.wheel(0, 120);
  expect(await page.evaluate(() => window.__allium.app.world!.platformAngle)).toBeGreaterThan(0);
  // The wheel tilted the board instead of zooming the camera.
  expect(await page.evaluate(() => window.__allium.app.world!.zoomDistance)).toBe(zoom);
  await page.mouse.click(box!.x + target!.x, box!.y + target!.y);
  await waitFor(page, (s) => s.platforms.length === 1, 10_000);
  await waitForSound(page, 'clunk');
  const after = await state(page);
  expect(after.platforms[0].angle).toBeGreaterThan(0);
  expect(after.ammo!.platform).toBe(before.ammo!.platform - 1);
  expect(after.phase).toBe('retreat');
  expect(await page.evaluate(() => window.__allium.app.world!.scene.getMeshByName('platform-0')?.isEnabled())).toBe(true);
  await info.attach('platform', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('proximity mine: Shift+8 drops it, it arms with a click and blows up whoever comes near', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  const before = await state(page);
  await select(page, 'Shift+8', 'mine');
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.mines.length === 1, 10_000);
  expect((await state(page)).ammo!.mine).toBe(1);
  expect((await state(page)).mines[0].state).toBe('unarmed');

  // Run for it: the mine arms during the retreat window and does not care whose side laid it.
  // Held keys only reach the game on a rendered frame, and those come about twice a second here,
  // so the walk is driven through the input state the key handler would set.
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const away = g.activeBuddy!.body.x < g.mines[0].body.x ? 'left' : 'right';
    g.input[away] = true;
  });
  await fastForward(page, 1.4);
  await page.evaluate(() => {
    const g = window.__allium.app.game!;
    g.input.left = g.input.right = false;
  });
  await fastForward(page, 1);
  await waitForSound(page, 'armed');
  expect((await state(page)).mines[0].state).toBe('armed');
  await page.evaluate(() => {
    window.__allium.stepFrames(8, 1 / 30);
  });
  await info.attach('mine', { body: await page.screenshot(), contentType: 'image/png' });

  // Walk the enemy onto it: it beeps, counts down on screen and goes off.
  const victim = await page.evaluate(() => {
    const g = window.__allium.app.game!;
    const mine = g.mines[0];
    const enemy = g.buddies.find((b) => b.id !== mine.owner)!;
    enemy.body.x = mine.body.x + 1;
    enemy.body.y = mine.body.y + 0.4;
    enemy.body.vx = enemy.body.vy = 0;
    return { name: enemy.name, hp: enemy.hp };
  });
  await fastForward(page, 0.1);
  await waitForSound(page, 'beep');
  expect((await state(page)).mines[0].state).toBe('triggered');
  await page.evaluate(() => {
    window.__allium.stepFrames(2, 1 / 60);
  });
  await expect(page.locator('.fuse').first()).toHaveText('1');
  await fastForward(page, 1.5);
  const after = await state(page);
  expect(after.mines).toHaveLength(0);
  expect(after.buddies.find((b) => b.name === victim.name)!.hp).toBeLessThan(victim.hp);
  expect(played(after, 'explosion')).toBeGreaterThan(played(before, 'explosion'));
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(errors).toEqual([]);
});

test('air strike: the arrow keys pick the approach side and the buddy stays put', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '7', 'airstrike');
  const before = await me(page);
  expect((await state(page)).choosingApproach).toBe(true);

  await page.keyboard.down('ArrowRight');
  await waitFor(page, (s) => s.strikeDir === -1, 10_000);
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('.approach')).toBeVisible();
  await expect(page.locator('.approach-arrow')).toContainText('from the right');
  await expect(page.locator('.hint')).toContainText('plane comes in from the right');

  await page.keyboard.down('ArrowLeft');
  await waitFor(page, (s) => s.strikeDir === 1, 10_000);
  await page.keyboard.up('ArrowLeft');
  await expect(page.locator('.approach-arrow')).toContainText('from the left');

  // Choosing a side must not walk the buddy off its spot.
  const after = await me(page);
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.05);

  const canvas = (await page.locator('#stage').boundingBox())!;
  const target = (await page.evaluate(([x, y]) => window.__allium.project(x, y), [before.x + 6, before.y] as const))!;
  await page.mouse.click(canvas.x + target.x, canvas.y + target.y);
  await waitForSound(page, 'plane');
  // dir 1: the plane enters on the left of its target and flies right.
  const plane = (await state(page)).lastStrike;
  expect(plane).not.toBeNull();
  expect(plane!.dir).toBe(1);
  expect(plane!.startX).toBeLessThan(plane!.target - 20);
  await page.evaluate(() => {
    window.__allium.stepFrames(30, 1 / 30);
  });
  await info.attach('approach', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(page.locator('.approach')).toBeHidden();
  expect(errors).toEqual([]);
});

test('air strike: a drag pans the camera, a click calls the plane and five bombs', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, '7', 'airstrike');
  const m = await me(page);
  const canvas = (await page.locator('#stage').boundingBox())!;
  const spot = (await page.evaluate(([x, y]) => window.__allium.project(x, y), [m.x + 7, m.y] as const))!;
  expect(spot).not.toBeNull();

  // Dragging is camera panning, not a strike.
  await page.mouse.move(canvas.x + spot.x, canvas.y + spot.y);
  await page.mouse.down();
  await page.mouse.move(canvas.x + spot.x + 60, canvas.y + spot.y + 10, { steps: 4 });
  await page.mouse.up();
  let s = await state(page);
  expect(s.phase).toBe('aiming');
  expect(s.ammo!.airstrike).toBe(1);

  const target = (await page.evaluate(([x, y]) => window.__allium.project(x, y), [m.x + 7, m.y] as const))!;
  await page.mouse.click(canvas.x + target.x, canvas.y + target.y);
  await waitForSound(page, 'plane');
  s = await state(page);
  expect(s.phase).toBe('retreat');
  expect(s.ammo!.airstrike).toBe(0);
  await page.evaluate(() => {
    window.__allium.stepFrames(45, 1 / 30);
  });
  await info.attach('plane', { body: await page.screenshot(), contentType: 'image/png' });
  const bombs = await page.evaluate(
    () => window.__allium.app.game!.projectiles.filter((p) => p.weapon === 'airbomb').length + window.__allium.app.game!.drops.length,
  );
  expect(bombs).toBe(5);

  await fastForward(page, 6);
  const after = await state(page);
  expect(played(after, 'explosion') - played(s, 'explosion')).toBeGreaterThanOrEqual(3);
  expect(after.terrainRevision).toBeGreaterThan(s.terrainRevision);
  expect(errors).toEqual([]);
});
