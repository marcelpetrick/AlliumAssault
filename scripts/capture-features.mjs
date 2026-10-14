// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Scripted current-feature GIFs: real terrain, setup, flooding and completed AI pickups. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCapture, startMatch, frames, focus, caption, recordFrame, encodeGif } from './media-kit.mjs';

const url = process.argv[2] ?? 'http://localhost:4173';
const only = process.argv.slice(3);
const ids = ['landscapes', 'rising-water', 'factions', 'ai-crates', 'ai-rope'];
assert.ok(
  only.every((id) => ids.includes(id)),
  'unknown feature id',
);
const selected = (id) => only.length === 0 || only.includes(id);
const capture = await openCapture(url, { width: 1280, height: 720 });
const { page } = capture;
mkdirSync('docs/features', { recursive: true });
async function film(id, count, step) {
  const dir = mkdtempSync(join(tmpdir(), `allium-feature-${id}-`));
  try {
    for (let k = 0; k < count; k++) {
      await step(k);
      await frames(page);
      if (selected(id)) await recordFrame(page, dir, k);
    }
    capture.check();
    if (selected(id)) encodeGif(dir, `docs/features/${id}.gif`, 10, 640);
    console.log(`${id}: outcomes verified${selected(id) ? `, ${count} frames recorded` : ''}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
try {
  await startMatch(page, 'layout-search');
  const seeds = await page.evaluate(() => {
    const g = window.__allium.app.game,
      found = {};
    for (let i = 0; i < 100 && Object.keys(found).length < 4; i++) {
      const seed = `gallery-landscape-${i}`,
        probe = new g.constructor({ ...g.config, seed });
      found[probe.terrain.layout] ??= seed;
    }
    return found;
  });
  assert.equal(Object.keys(seeds).length, 4);
  const families = ['plain', 'hills', 'islands', 'caverns'];
  await film('landscapes', 80, async (k) => {
    if (k % 20) return;
    const family = families[k / 20];
    await startMatch(page, seeds[family], ['meadow', 'sunset', 'candy', 'night'][k / 20], { walled: true }, false);
    assert.equal(await page.evaluate(() => window.__allium.app.game.terrain.layout), family);
    await focus(page, 64, 24, 110);
    await caption(page, `${family}: seeded terrain with arena walls`);
    if (selected('landscapes')) await page.screenshot({ path: `docs/screenshots/landscape-${family}.jpg`, type: 'jpeg', quality: 88 });
  });

  await startMatch(page, 'flood-gallery', 'night', { suddenDeath: 1 });
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.terrain.fill((_x, y) => 6 - y);
    g.buddies.forEach((b, i) => Object.assign(b.body, { x: 40 + i * 30, y: 6.65, vx: 0, vy: 0, grounded: true }));
  });
  await focus(page, 55, 8, 50);
  await caption(page, 'Sudden Death: the water rises every turn');
  await film('rising-water', 80, async (k) => {
    if (k > 0 && k % 12 === 0)
      await page.evaluate(() => {
        const h = window.__allium;
        h.app.game.skipTurn();
        h.fastForward(4);
      });
  });
  assert.ok(
    await page.evaluate(() => window.__captureEvents.some((e) => e.type === 'waterRise') && window.__captureEvents.some((e) => e.type === 'drown')),
    'rising water caused drowning',
  );

  // Show the real faction controls before the shared victory.
  await page.evaluate(() => {
    window.__allium.app.showTitle();
    window.__allium.setManual(true);
    window.__allium.app.menu.showSetup();
  });
  await page.locator('[data-action="sudden-death"][data-value="0"]').click();
  await page.locator('[data-action="add-team"]').click();
  await page.locator('[data-action="tag-teams"][data-value="1"]').click();
  await page.locator('[data-field="faction-name"][data-faction="0"]').fill('Bulb Alliance');
  await page.locator('[data-action="faction"][data-team="1"][data-value="0"]').click();
  await caption(page, 'Named factions: allies keep turns and ammo');
  await film('factions', 100, async (k) => {
    if (k === 20) {
      await page.locator('[data-action="start"]').click();
      await page.evaluate(() => {
        const h = window.__allium,
          g = h.app.game;
        g.terrain.fill((_x, y) => 20 - y);
        h.app.world.decorations.clearAround(64, 32, 150);
        g.buddies.forEach((b) => Object.assign(b.body, { x: b.team === 0 ? 40 : b.team === 1 ? 41.3 : 70 + b.id, y: 20.65, vx: 0, vy: 0, grounded: true }));
        h.fastForward(4);
      });
      await focus(page, 45, 23, 38);
      await caption(page, 'Friendly fire stays active');
    }
    if (k === 35)
      await page.evaluate(() => {
        const g = window.__allium.app.game;
        g.selectWeapon('punch');
        g.activeBuddy.aim = 0;
        g.face(1);
        g.pressFire();
      });
    if (k === 50) {
      assert.ok(await page.evaluate(() => window.__allium.app.game.buddies.some((b) => b.team === 1 && b.hp < 100)), 'allied damage');
      await page.evaluate(() => {
        const h = window.__allium,
          g = h.app.game;
        for (const b of g.buddies.filter((b) => b.team === 2)) g.explode(b.body.x, b.body.y, 2.2, 160, 0, false, { buddy: g.buddies[0].id, weapon: 'bazooka' });
        h.fastForward(15);
      });
      await caption(page, 'Bulb Alliance wins together');
    }
  });
  assert.deepEqual(await page.evaluate(() => window.__allium.app.game.winnerTeams), [0, 1]);

  for (const rope of [false, true]) {
    await page.evaluate((rope) => {
      const h = window.__allium,
        config = h.app.game.config;
      h.startMatch({
        ...config,
        seed: `capture-ai-${rope ? 'rope' : 'walk'}`,
        tagTeams: false,
        walled: false,
        suddenDeath: 0,
        crates: 0,
        teams: [
          { name: 'Normal AI', color: '#ef4b3c', controller: 'ai', aiLevel: 'normal', buddyNames: ['Clovis'] },
          { name: 'Target', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Chive'] },
        ],
      });
      const g = h.app.game;
      g.terrain.fill((_x, y) => 20 - y);
      h.app.world.decorations.clearAround(64, 32, 150);
      g.buddies.forEach((b, i) => Object.assign(b.body, { x: i ? 100 : 40, y: 20.65, vx: 0, vy: 0, grounded: true }));
      if (rope) {
        for (let x = 35; x <= 65; x++) g.terrain.addDisc(x, 32, 1.5);
        g.terrain.carve(47, 15, 8);
      } else g.terrain.fill((x, y) => Math.max(20 - y, Math.min(0.6 - Math.abs(x - 42), 21.2 - y)));
      for (const id of Object.keys(g.teams[0].ammo)) g.teams[0].ammo[id] = id === (rope ? 'rope' : 'airstrike') ? 2 : 0;
      g.crates.push({
        id: 991,
        kind: 'health',
        weapon: null,
        body: { x: rope ? 55 : 45, y: 20.45, vx: 0, vy: 0, radius: 0.45, grounded: true, restTime: 0, impact: 0 },
      });
      window.__captureEvents = [];
      const drain = g.drainEvents.bind(g);
      g.drainEvents = () => {
        const events = drain();
        window.__captureEvents.push(...events);
        return events;
      };
    }, rope);
    await focus(page, rope ? 47 : 44, rope ? 26 : 23, rope ? 48 : 34);
    await caption(page, rope ? 'Normal AI: swing across, collect, land' : 'Normal AI: jump, collect, then attack');
    await film(rope ? 'ai-rope' : 'ai-crates', rope ? 140 : 85, () => Promise.resolve());
    assert.equal(await page.evaluate(() => window.__allium.app.game.buddies[0].hp), 125, 'AI collected the health crate');
    const events = await page.evaluate(() => window.__captureEvents.map((e) => e.type));
    assert.ok(events.includes(rope ? 'ropeBite' : 'jump'));
    assert.ok(events.includes(rope ? 'ropeRelease' : 'airstrike'));
  }
} finally {
  await capture.browser.close();
}
console.log('Feature clips refreshed; flooding, shared victory and AI pickups verified');
