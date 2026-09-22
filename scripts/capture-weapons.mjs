// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Records one short clip of every weapon and writes docs/weapons_preview.md around them.
 *
 *   npm run build && npm run preview             (in another terminal)
 *   node scripts/capture-weapons.mjs [url]       default http://localhost:4173
 *   node scripts/capture-weapons.mjs [url] bazooka grenade    just those two
 *
 * Every clip is a scripted match through the window.__allium hook: fixed seed, fixed frame step,
 * a scenery of its own, so re-running produces the same film. Needs ffmpeg on the PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
const only = process.argv.slice(3);
const out = 'docs/weapons';

/** Small on purpose: twenty-four clips have to live in a git repository somebody clones. */
const WIDTH = 320;
const FPS = 10;
const COLORS = 48;

/**
 * One clip per weapon: where it is fired from, what it is aimed at, and how long to film.
 *
 * `hold` is frames of charge before release (charge weapons only), `after` a callback fired that
 * many frames in — detonating the sheep, letting go of the rope. Sceneries rotate so the page is
 * not twenty-four pictures of the same meadow.
 */
const CLIPS = [
  { id: 'bazooka', theme: 'meadow', aim: 0.62, hold: 8, frames: 42 },
  { id: 'grenade', theme: 'sunset', aim: 0.85, hold: 8, frames: 46 },
  { id: 'cluster', theme: 'frost', aim: 0.85, hold: 9, frames: 52 },
  { id: 'banana', theme: 'candy', aim: 0.9, hold: 9, frames: 60 },
  { id: 'holy', theme: 'night', aim: 0.8, hold: 9, frames: 64 },
  { id: 'shotgun', theme: 'meadow', aim: 0.06, frames: 26 },
  { id: 'minigun', theme: 'sunset', aim: 0.05, frames: 40 },
  { id: 'punch', theme: 'candy', aim: 0, close: 1.1, frames: 26 },
  { id: 'bat', theme: 'meadow', aim: 0.2, close: 1.1, frames: 34 },
  { id: 'sheep', theme: 'frost', aim: 0, frames: 60, after: [42, 'fire'] },
  { id: 'flysheep', theme: 'night', aim: 0.5, frames: 52, after: [34, 'fire'] },
  { id: 'airstrike', theme: 'sunset', strike: true, frames: 56 },
  { id: 'napalm', theme: 'night', strike: true, frames: 70 },
  { id: 'mule', theme: 'frost', strike: true, frames: 56 },
  { id: 'torch', theme: 'meadow', aim: -0.15, frames: 52 },
  { id: 'drill', theme: 'candy', aim: 0, frames: 52 },
  { id: 'rope', theme: 'frost', aim: 1.15, frames: 46 },
  { id: 'platform', theme: 'meadow', platform: true, frames: 26 },
  { id: 'surrender', theme: 'candy', aim: 0, frames: 30 },
  { id: 'mine', theme: 'sunset', aim: 0, frames: 34 },
  { id: 'teleport', theme: 'night', teleport: true, frames: 40 },
  { id: 'selfdestruct', theme: 'sunset', aim: 0, frames: 60 },
  { id: 'ming', theme: 'candy', aim: 0.85, hold: 10, frames: 70 },
  { id: 'flamer', theme: 'night', aim: -0.1, frames: 60 },
];

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(url);
await page.waitForFunction(() => window.__allium?.ready, null, { timeout: 120_000 });

const frames = (count, dt = 1 / FPS) => page.evaluate(([n, step]) => window.__allium.stepFrames(n, step), [count, dt]);

/** A two-team match on a named scenery, run up to the first player turn. */
async function match(clip) {
  await page.evaluate(
    ([seed, theme]) =>
      window.__allium.startMatch({
        seed,
        teams: [
          { name: 'Garlic Gang', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Clovis', 'Aioli'] },
          { name: 'Clove Crew', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Chive', 'Sprout'] },
        ],
        turnTime: 120,
        retreatTime: 3,
        windMax: 0,
        crates: 0,
        suddenDeath: 0,
        arsenal: 'all',
        theme,
      }),
    [`clip-${clip.id}`, clip.theme],
  );
  await page.evaluate(() => window.__allium.setManual(true));
  await page.evaluate(() => {
    const app = window.__allium.app;
    for (let k = 0; k < 600 && app.game.phase !== 'aiming'; k++) app.fastForward(1 / 60);
  });
  await frames(20);
}

/** Point the buddy at the nearest enemy and set the weapon up, optionally walking in close first. */
async function setUp(clip) {
  await page.evaluate((c) => {
    const g = window.__allium.app.game;
    const me = g.activeBuddy;
    const enemy = g.buddies.filter((b) => b.team !== me.team).sort((a, b) => Math.abs(a.body.x - me.body.x) - Math.abs(b.body.x - me.body.x))[0];
    const dir = enemy.body.x < me.body.x ? -1 : 1;
    // Melee has to be within arm's reach, so put the buddy there rather than filming it walk.
    if (c.close) me.body.x = enemy.body.x - dir * c.close;
    g.selectWeapon(c.id);
    g.face(dir);
    if (c.aim !== undefined) me.aim = c.aim;
    window.__alliumClip = { target: enemy.body.x, x: me.body.x, y: me.body.y };
  }, clip);
}

/** Pull the trigger, in whichever way this weapon is triggered. */
async function pull(clip) {
  if (clip.strike) {
    await page.evaluate(() => window.__allium.app.game.strike(window.__alliumClip.target));
    return;
  }
  if (clip.teleport) {
    await page.evaluate(() => {
      const g = window.__allium.app.game;
      const spot = window.__alliumClip;
      // Somewhere clearly elsewhere, and somewhere the buddy actually fits.
      for (const dx of [26, -26, 34, -34, 18, -18]) {
        if (g.canTeleportTo(spot.x + dx, spot.y + 6)) {
          g.teleportTo(spot.x + dx, spot.y + 6);
          return;
        }
      }
    });
    return;
  }
  if (clip.platform) {
    await page.evaluate(() => {
      const g = window.__allium.app.game;
      const spot = window.__alliumClip;
      for (const dy of [5, 7, 9]) g.placePlatform({ x: spot.x + 6, y: spot.y + dy, angle: 0.2 });
    });
    return;
  }
  await page.evaluate(() => window.__allium.app.game.pressFire());
  if (clip.hold) await frames(clip.hold);
  await page.evaluate(() => window.__allium.app.game.releaseFire());
}

/** A moment on the buddy with the weapon in its hands, before anything happens to look at. */
const PREROLL = 5;

/** Film the clip into `dir`, running whatever it asked for part-way through. */
async function film(clip, dir, from = 0) {
  for (let k = from; k < clip.frames; k++) {
    if (clip.after && k === clip.after[0]) {
      await page.evaluate(() => {
        const g = window.__allium.app.game;
        g.pressFire();
        g.releaseFire();
      });
    }
    await frames(1);
    await page.screenshot({ path: join(dir, `f${String(k).padStart(4, '0')}.png`) });
  }
}

function encode(dir, id) {
  const palette = join(dir, 'palette.png');
  const scale = `scale=${WIDTH}:-1:flags=lanczos`;
  const common = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png')];
  execFileSync('ffmpeg', [...common, '-vf', `${scale},palettegen=max_colors=${COLORS}:stats_mode=diff`, palette]);
  execFileSync('ffmpeg', [
    ...common,
    '-i',
    palette,
    '-lavfi',
    `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    `${out}/${id}.gif`,
  ]);
}

mkdirSync(out, { recursive: true });
const wanted = only.length ? CLIPS.filter((c) => only.includes(c.id)) : CLIPS;
let total = 0;
for (const clip of wanted) {
  const dir = mkdtempSync(join(tmpdir(), `allium-${clip.id}-`));
  try {
    await match(clip);
    await setUp(clip);
    await film({ ...clip, frames: PREROLL, after: null }, dir);
    await pull(clip);
    await film(clip, dir, PREROLL);
    encode(dir, clip.id);
    const size = statSync(`${out}/${clip.id}.gif`).size;
    total += size;
    console.log(`${clip.id.padEnd(14)} ${clip.frames} frames  ${(size / 1024).toFixed(0)} kB`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
console.log(`${wanted.length} clips, ${(total / 1024 / 1024).toFixed(1)} MB total`);

await browser.close();
