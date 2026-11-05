// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Refresh the README gallery and battle GIF from real actions in authored arenas. */
import assert from 'node:assert/strict';
import { WEAPONS } from '../src/core/weapons.ts';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCapture, startMatch, frames, focus, encodeGif, recordFrame } from './media-kit.mjs';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = 'docs/screenshots';
const only = process.argv.slice(3);
const names = ['title', 'action-1', 'action-2', 'candy-shop', 'frosty-peaks', 'napalm', 'tombstone', 'jetpack', 'homing', 'setup', 'paint', 'battle'];
assert.ok(
  only.every((name) => names.includes(name)),
  'unknown media selection',
);
mkdirSync(out, { recursive: true });
const capture = await openCapture(url, { width: 1280, height: 720 });
const { page } = capture;
const shoot = async (name) => {
  if (only.length && !only.includes(name)) return;
  capture.check();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 88 });
  console.log(`${name}.jpg`);
};
try {
  await frames(page, 20);
  await shoot('title');

  await startMatch(page, 'readme-action', 'meadow');
  await focus(page, 50, 23, 40);
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.activeBuddy.aim = 0.4;
    g.face(1);
    g.pressFire();
  });
  await frames(page, 8);
  await page.evaluate(() => window.__allium.app.game.releaseFire());
  await frames(page, 4);
  assert.ok(await page.evaluate(() => window.__allium.app.game.projectiles.length), 'rocket in flight');
  await shoot('action-1');
  for (let k = 0; k < 100 && (await page.evaluate(() => window.__allium.app.game.projectiles.length > 0)); k++) await frames(page);
  const blast = await page.evaluate(() => window.__captureEvents.filter((e) => e.type === 'explosion').at(-1));
  assert.ok(blast, 'actual rocket explosion');
  await focus(page, blast.x, blast.y + 2, 32);
  await shoot('action-2');

  await startMatch(page, 'readme-candy', 'candy');
  await focus(page, 46, 25, 38);
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.selectWeapon('flysheep');
    g.activeBuddy.aim = 0.8;
    g.face(1);
    g.pressFire();
  });
  await frames(page, 5);
  assert.ok(await page.evaluate(() => window.__allium.app.game.flyer), 'flying sheep visible');
  await shoot('candy-shop');

  await startMatch(page, 'readme-frost', 'frost');
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.selectWeapon('airstrike');
    g.setStrikeDir(1);
    g.strike(55);
  });
  await frames(page, 14);
  await focus(page, 50, 30, 54);
  await shoot('frosty-peaks');

  await startMatch(page, 'readme-napalm', 'sunset');
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.selectWeapon('napalm');
    g.setStrikeDir(1);
    g.strike(55);
  });
  for (let k = 0; k < 140 && !(await page.evaluate(() => window.__allium.app.game.flames.length)); k++) await frames(page);
  const flame = await page.evaluate(() => window.__allium.app.game.flames[0]);
  assert.ok(flame, 'napalm actually ignited');
  await focus(page, flame.x, flame.y + 3, 35);
  await shoot('napalm');

  await startMatch(page, 'readme-night', 'night', {
    crates: 1,
    teams: [
      { name: 'Garlic Gang', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Clovis', 'Aioli'] },
      { name: 'Clove Crew', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Chive'] },
    ],
  });
  await page.evaluate(() => {
    const h = window.__allium,
      g = h.app.game;
    g.activeBuddy.hp = 1;
    g.explode(40, 20.5, 1.2, 5, 1);
    h.fastForward(15);
  });
  const grave = await page.evaluate(() => window.__allium.app.game.graves[0]);
  assert.ok(grave, 'tombstone from an actual death');
  await frames(page, 25);
  await focus(page, grave.body.x, grave.body.y + 2, 28);
  await shoot('tombstone');

  await startMatch(page, 'readme-jetpack', 'sunset');
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.selectWeapon('jetpack');
    g.pressFire();
  });
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await frames(page, 14);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');
  const flying = await page.evaluate(() => window.__allium.app.game.activeBuddy.body);
  await focus(page, flying.x, flying.y, 30);
  await shoot('jetpack');

  await startMatch(page, 'readme-homing', 'night');
  await page.evaluate(() => {
    const h = window.__allium,
      g = h.app.game;
    g.buddies[1].body.x = 80;
    g.selectWeapon('homing');
    g.targetBuddy(g.buddies[1].id);
    g.activeBuddy.aim = 0.65;
    g.face(1);
  });
  await page.evaluate(() => {
    const h = window.__allium,
      g = h.app.game;
    g.pressFire();
    h.fastForward(1.5);
    g.releaseFire();
    h.fastForward(1.1);
  });
  const guided = await page.evaluate(() => window.__allium.app.game.projectiles[0]);
  assert.ok(guided?.age >= WEAPONS.homing.homing.delay, 'rocket guidance active');
  await focus(page, 60, 31, 68);
  await shoot('homing');

  await page.evaluate(() => {
    window.__allium.app.showTitle();
    window.__allium.setManual(true);
    window.__allium.app.menu.showSetup();
  });
  await page.locator('[data-action="tag-teams"][data-value="1"]').click();
  await page.locator('[data-field="faction-name"][data-faction="0"]').fill('Bulb Alliance');
  await page.locator('[data-action="walled"][data-value="1"]').click();
  await page.waitForTimeout(300);
  await shoot('setup');

  if (only.length === 0 || only.includes('paint')) {
    await page.locator('[data-action="paint-open"]').click();
    const box = await page.locator('[data-paint]').boundingBox();
    assert.ok(box, 'paint canvas visible');
    for (const [x1, x2, y] of [
      [0.12, 0.88, 0.7],
      [0.36, 0.55, 0.35],
    ]) {
      await page.mouse.move(box.x + box.width * x1, box.y + box.height * y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * x2, box.y + box.height * y, { steps: 5 });
      await page.mouse.up();
    }
    await shoot('paint');
    await page.locator('[data-action="paint-apply"]').click();
    assert.equal(await page.locator('[data-action="paint-remove"]').count(), 1, 'painted landscape accepted');
  }

  await startMatch(page, 'readme-gif', 'meadow');
  await focus(page, 55, 23, 56);
  await page.evaluate(() => {
    const g = window.__allium.app.game;
    g.selectWeapon('banana');
    g.activeBuddy.aim = 0.8;
    g.face(1);
    g.pressFire();
  });
  if (only.length === 0 || only.includes('battle')) {
    const dir = mkdtempSync(join(tmpdir(), 'allium-battle-'));
    try {
      for (let k = 0; k < 110; k++) {
        if (k === 9) await page.evaluate(() => window.__allium.app.game.releaseFire());
        await frames(page, 1, 1 / 12);
        await recordFrame(page, dir, k);
      }
      assert.ok(await page.evaluate(() => window.__captureEvents.filter((e) => e.type === 'explosion').length > 2), 'banana fragments exploded');
      encodeGif(dir, `${out}/battle.gif`, 12, 640);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  capture.check();
} finally {
  await capture.browser.close();
}
console.log('README screenshots and battle GIF refreshed; actions verified');
