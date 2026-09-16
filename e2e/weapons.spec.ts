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
  await select(page, 1, 'bazooka');
  await aim(page, -0.5);
  const before = await state(page);

  await page.keyboard.down('Space');
  await waitFor(page, (s) => (s.charge ?? 0) > 0.15 && s.sound.charge, 60_000);
  await page.keyboard.up('Space');
  await waitFor(page, (s) => ((s.sound.played as Record<string, number>).fire ?? 0) > 0 && !s.sound.charge, 10_000);

  // Flying rockets have a flight voice; once it hits, it explodes and carves a crater.
  const flying = await state(page);
  if (flying.projectiles > 0) await waitFor(page, (s) => s.projectiles === 0 || s.sound.flights > 0, 10_000);
  await fastForward(page, 3);
  const after = await state(page);
  expect(after.projectiles).toBe(0);
  expect(after.terrainRevision).toBeGreaterThan(before.terrainRevision);
  expect(played(after, 'explosion')).toBeGreaterThan(played(before, 'explosion'));
  expect(['retreat', 'settling', 'deaths', 'turnStart', 'aiming']).toContain(after.phase);
  await info.attach('bazooka', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('grenade: bounces audibly, then explodes after its fuse', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 2, 'grenade');
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
  await select(page, 3, 'shotgun');
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
  await select(page, 4, 'punch');
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
  await select(page, 8, 'bat');
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

test('cluster bomb: red grenade bursts into five exploding bomblets', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 5, 'cluster');
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
  await select(page, 6, 'sheep');
  await aim(page, 0, 1);
  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'guiding' && s.sheep !== null && (s.sound.played as Record<string, number>).baa === 1, 10_000);

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

test('air strike: a drag pans the camera, a click calls the plane and five bombs', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page);
  await select(page, 7, 'airstrike');
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
  await page.evaluate(() => window.__allium.stepFrames(45, 1 / 30));
  await info.attach('plane', { body: await page.screenshot(), contentType: 'image/png' });
  const bombs = await page.evaluate(() => window.__allium.app.game!.projectiles.filter((p) => p.weapon === 'airbomb').length + window.__allium.app.game!.drops.length);
  expect(bombs).toBe(5);

  await fastForward(page, 6);
  const after = await state(page);
  expect(played(after, 'explosion') - played(s, 'explosion')).toBeGreaterThanOrEqual(3);
  expect(after.terrainRevision).toBeGreaterThan(s.terrainRevision);
  expect(errors).toEqual([]);
});
