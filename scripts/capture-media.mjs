// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Captures the README screenshots and the battle recording in Google Chrome.
 *
 *   npm run build && npm run preview          (in another terminal)
 *   node scripts/capture-media.mjs [url]      default http://localhost:4173
 *
 * Scenes are scripted through the window.__allium test hook with fixed seeds and a fixed frame
 * step, so re-running produces comparable media. Writes docs/screenshots/*.jpg and battle.gif
 * (needs ffmpeg on the PATH).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = 'docs/screenshots';

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url);
await page.waitForFunction(() => window.__allium?.ready, null, { timeout: 120_000 });

const shoot = (name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 });
const frames = (count, dt = 1 / 30) => page.evaluate(([n, step]) => window.__allium.stepFrames(n, step), [count, dt]);

/** Start a two-team human match and run until the first turn is ready. */
async function match(seed, theme, extra = {}) {
  await page.evaluate(
    ([s, t, e]) =>
      window.__allium.startMatch({
        seed: s,
        teams: [
          { name: 'Garlic Gang', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Clovis', 'Aioli', 'Pesto'] },
          { name: 'Clove Crew', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Chive', 'Sprout', 'Toasty'] },
        ],
        turnTime: 90,
        retreatTime: 5,
        windMax: 0,
        crates: 0,
        theme: t,
        ...e,
      }),
    [seed, theme, extra],
  );
  await page.evaluate(() => window.__allium.setManual(true));
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 400 && app.game.phase !== 'aiming'; k++) app.fastForward(1 / 60);
  });
  await frames(45);
}

// Title screen with the live demo behind the menu.
await page.evaluate(() => window.__allium.setManual(false));
await page.waitForTimeout(2500);
await shoot('title');

// Bazooka in flight over the meadow, then the blast.
await match('readme-1', 'meadow');
await page.evaluate(() => {
  const g = window.__allium.app.game;
  const me = g.activeBuddy;
  const enemy = g.buddies.filter((b) => b.team !== me.team).sort((a, b) => Math.abs(a.body.x - me.body.x) - Math.abs(b.body.x - me.body.x))[0];
  g.face(enemy.body.x < me.body.x ? -1 : 1);
  me.aim = 0.6;
  g.pressFire();
});
await frames(20);
await page.evaluate(() => window.__allium.app.game.releaseFire());
// Follow the rocket: shoot mid-flight, then the first frames of the explosion.
let flight = 0;
for (let k = 0; k < 120; k++) {
  const flying = await page.evaluate(() => window.__allium.app.game.projectiles.length > 0);
  if (!flying) break;
  flight++;
  if (flight === 12) await shoot('action-1');
  await frames(1);
}
await frames(2);
await shoot('action-2');

// Flying sheep in the Candy Shop.
await match('readme-candy', 'candy');
await page.evaluate(() => {
  const g = window.__allium.app.game;
  g.selectWeapon('flysheep');
  g.activeBuddy.aim = 1.1;
  g.pressFire();
});
await frames(40);
await shoot('candy-shop');

// Air strike plane over Frosty Peaks.
await match('readme-frost', 'frost');
await page.evaluate(() => {
  const g = window.__allium.app.game;
  g.selectWeapon('airstrike');
  g.strike(g.activeBuddy.body.x + 12 * g.activeBuddy.facing);
});
await frames(62);
await shoot('frosty-peaks');

// Napalm burning at sunset.
await match('readme-napalm', 'sunset');
await page.evaluate(() => {
  const app = window.__allium.app;
  const g = app.game;
  g.selectWeapon('napalm');
  g.strike(g.activeBuddy.body.x + 10 * g.activeBuddy.facing);
  for (let k = 0; k < 600 && !g.flames.length; k++) app.fastForward(1 / 60);
  // Keep the flames burning for the photo and centre the camera on them.
  for (const f of g.flames) f.life = 60;
  const w = app.world;
  w.goal.x = g.flames.reduce((sum, f) => sum + f.x, 0) / g.flames.length;
  w.goal.y = g.flames[0].y + 2;
  w.manualUntil = w.time + 100;
  w.goalDistance = 20;
});
// Let the "Retreat!" banner (1.8 s) fade and the camera settle before switching to real time.
await frames(60);
// Particle emitters need real frame time, so let the page run for a while.
await page.evaluate(() => window.__allium.setManual(false));
await page.waitForTimeout(8000);
await shoot('napalm');

// A tombstone and a fresh crate in the Moonlit Grove.
await match('readme-night', 'night', { crates: 1 });
await page.evaluate(() => {
  const app = window.__allium.app;
  const g = app.game;
  const victim = g.activeBuddy;
  victim.hp = 1;
  g.explode(victim.body.x + 0.4, victim.body.y - 0.4, 1.2, 5, 1);
  for (let k = 0; k < 60 * 20 && g.turn < 3; k++) app.fastForward(1 / 60);
  const grave = g.graves[0];
  const w = app.world;
  w.goal.x = grave.body.x;
  w.goal.y = grave.body.y + 1;
  w.manualUntil = w.time + 100;
  w.goalDistance = 18;
});
await frames(60);
await shoot('tombstone');

// Battle recording: a banana bomb volley, captured frame by frame.
await match('readme-gif', 'meadow');
await page.evaluate(() => {
  const g = window.__allium.app.game;
  g.selectWeapon('banana');
  g.activeBuddy.aim = 0.9;
  g.pressFire();
});
const dir = mkdtempSync(join(tmpdir(), 'allium-gif-'));
try {
  for (let k = 0; k < 105; k++) {
    if (k === 10) await page.evaluate(() => window.__allium.app.game.releaseFire());
    await frames(1, 1 / 12);
    await page.screenshot({ path: join(dir, `f${String(k).padStart(4, '0')}.png`) });
  }
  console.log(`captured ${readdirSync(dir).length} frames`);
  const palette = join(dir, 'palette.png');
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    '12',
    '-i',
    join(dir, 'f%04d.png'),
    '-vf',
    'scale=560:-1:flags=lanczos,palettegen=max_colors=96:stats_mode=diff',
    palette,
  ]);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    '12',
    '-i',
    join(dir, 'f%04d.png'),
    '-i',
    palette,
    '-lavfi',
    'scale=560:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    `${out}/battle.gif`,
  ]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

await browser.close();
console.log('media written to docs/screenshots');
