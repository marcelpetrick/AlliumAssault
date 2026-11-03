// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Headed Firefox audit, using its ordinary WebGL preferences. Install with
 * `npx playwright install firefox`, serve a production build, then run
 * `xvfb-run -a node scripts/check-firefox-fire.mjs [url]` on a Linux host without a display.
 * Mesh assertions supplement the screenshots: inspect those to confirm visible colour/placement.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { firefox } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = 'docs/screenshots';
await mkdir(out, { recursive: true });
const browser = await firefox.launch({ headless: false });
try {
  for (const [quality, width, height, facing] of [
    ['low', 1280, 720, 1],
    ['low', 800, 600, 1],
    ['high', 1280, 720, -1],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${url}/?quality=${quality}`);
    await page.waitForFunction(() => window.__allium?.ready, null, { timeout: 120_000 });
    const report = await page.evaluate((facing) => {
      const h = window.__allium;
      h.setManual(true);
      h.startMatch({
        seed: 'firefox-fire-audit',
        teams: [
          { name: 'A', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Flare'] },
          { name: 'B', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Target'] },
        ],
        turnTime: 90,
        retreatTime: 3,
        windMax: 0,
        crates: 0,
        theme: 'night',
      });
      h.fastForward(4);
      const g = h.app.game;
      g.terrain.fill((_x, y) => 20 - y);
      g.buddies.forEach((b, i) => Object.assign(b.body, { x: i === 0 ? 50 : 100, y: 20.65, vx: 0, vy: 0, grounded: true }));
      g.selectWeapon('torch');
      g.face(facing);
      g.activeBuddy.aim = 0.6;
      g.pressFire();
      h.stepFrames(2, 0.1);
      g.flames.push({ id: 9901, x: 56, y: 20.1, life: 8, bite: 1, bitesLeft: 3 }, { id: 9902, x: 58, y: 20.1, life: 8, bite: 1, bitesLeft: 3 });
      h.stepFrames(1, 0.1);
      g.explode(62, 20.5, 3, 0, 0, false, { buddy: g.activeBuddy.id, weapon: 'bazooka' });
      h.fastForward(0.05);
      h.stepFrames(1, 0);
      const scene = h.app.world.scene;
      return {
        quality: h.state().quality,
        renderer: scene.getEngine().getGlInfo(),
        torch: scene.getMeshByName('torchOuter')?.isEnabled(),
        angle: scene.getMeshByName('torchOuter')?.rotation.z,
        ground: scene.meshes.filter((m) => m.name.startsWith('groundFlame') && m.isEnabled()).length,
        blast: scene.getMeshByName('blastCore')?.isEnabled(),
      };
    }, facing);
    assert.equal(report.torch, true);
    assert.equal(report.ground, 4);
    assert.equal(report.blast, true);
    assert.ok(report.angle * facing < 0, 'torch points along the aimed facing');
    // Let the headed compositor present real frames before capturing the image.
    const started = await page.evaluate(() => window.__allium.state().frames);
    await page.evaluate(() => window.__allium.setManual(false));
    await page.waitForFunction((n) => window.__allium.state().frames >= n + 4, started, { timeout: 90_000 });
    await page.evaluate(() => window.__allium.setManual(true));
    await page.waitForTimeout(500);
    const screenshot = `${out}/firefox-${quality}-${width}.png`;
    await page.screenshot({ path: screenshot });
    // Exercise the actual homing UI under the same ordinary Firefox quality/viewport settings.
    const launch = await page.evaluate(() => {
      const h = window.__allium;
      h.setManual(true);
      h.startMatch({ ...h.app.game.config, seed: 'firefox-homing-audit', windMax: 0, arsenal: 'all' });
      const g = h.app.game;
      g.terrain.fill((_x, y) => 20 - y);
      g.buddies.forEach((b, i) => Object.assign(b.body, { x: i ? 65 : 40, y: 20.65, vx: 0, vy: 0, grounded: true }));
      h.fastForward(4);
      const w = h.app.world;
      Object.assign(w.goal, { x: 52, y: 24 });
      Object.assign(w.focus, { x: 52, y: 24 });
      w.goalDistance = w.distance = 78;
      w.manualUntil = w.time + 1000;
      g.selectWeapon('homing');
      g.face(1);
      g.activeBuddy.aim = 0.5;
      h.stepFrames(1, 0);
      return { at: h.project(g.buddies[1].body.x, g.buddies[1].body.y + 2), ammo: g.teams[0].ammo.homing };
    });
    assert.equal(launch.ammo, 1, 'normal starting homing stock');
    await page.mouse.click(launch.at.x, launch.at.y);
    assert.equal(await page.evaluate(() => window.__allium.app.game.homingTarget), await page.evaluate(() => window.__allium.app.game.buddies[1].id));
    await page.keyboard.down('Space');
    await page.evaluate(() => window.__allium.fastForward(1.4));
    await page.keyboard.up('Space');
    const homing = await page.evaluate(() => {
      const h = window.__allium,
        g = h.app.game;
      h.fastForward(0.8);
      const ballisticAge = g.projectiles[0]?.age;
      h.fastForward(0.3);
      const guided = g.projectiles[0];
      const speed = guided && Math.hypot(guided.vx, guided.vy);
      h.fastForward(5);
      return { ballisticAge, guidedSpeed: speed, targetHP: g.buddies[1].hp, ammo: g.teams[0].ammo.homing };
    });
    assert.ok(homing.ballisticAge < 1, 'ballistic opening');
    assert.ok(Math.abs(homing.guidedSpeed - 24) < 0.01, 'homing speed after arming');
    assert.ok(homing.targetHP < 100, 'actual homing hit');
    assert.equal(homing.ammo, 0, 'one use consumed');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport: { width, height }, ...report, homing, errors, screenshot }));
    await page.close();
  }
} finally {
  await browser.close();
}
