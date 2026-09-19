// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Clip B — "the ship log": the same twenty seconds cut as a release trailer for a developer feed.
 *
 *   npm run build && npm run preview        (in another terminal)
 *   node linkedin/capture-clip-b.mjs [url]  default http://localhost:4173
 *
 * Where clip A tours the game, this one tells the build story: it opens on day one's four weapons,
 * runs a hard-cut montage of five of the thirteen that followed while a counter climbs 04 → 17,
 * then lands on what the repository can prove — commits, tests, licence — and the call to action.
 *
 * Output: linkedin/clip-b-shiplog.mp4 (1080x1350, 4:5, 30 fps, H.264) and clip-b-poster.jpg.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clip, FPS, easeOut, easeOutBack, hold, ramp } from './clipkit.mjs';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = dirname(fileURLToPath(import.meta.url));
const clip = new Clip(url);
await clip.open();

const badge = { o: 0.9 };
/** The counter in the top corner, the spine that ties the montage together. */
const counter = (n, o = 1) => ({ n: String(n).padStart(2, '0'), t: 'weapons', o });

// ---------------------------------------------------------------------------- 1. day one (78)

await clip.load();
await clip.match('b-day-one', 'meadow');
await clip.zoom(24);
await clip.faceEnemy(0.6);
await clip.select('bazooka');
await clip.fire();

const dayOne = (f) => ({
  scrim: { o: 0.72 * (1 - ramp(f, 26, 44)) },
  count: counter(4, hold(f, 8, 78, 8, 10)),
  title:
    f < 46
      ? {
          o: hold(f, 2, 44, 8, 10),
          s: 0.9 + 0.1 * easeOutBack(ramp(f, 2, 18)),
          eyebrow: 'Five days ago',
          text: 'Four<br>weapons',
          sub: 'bazooka · grenade · shotgun · fist',
        }
      : {},
  badge: { o: 0.9 * ramp(f, 46, 58) },
});
await clip.record(14, dayOne);
await clip.release();
await clip.record(64, dayOne, 1 / FPS, 14);

// ---------------------------------------------------------------------------- 2. the montage (280)

/**
 * One weapon per beat, 56 frames each, hard cut to the next. The counter climbs across the first
 * two beats and then holds at seventeen.
 */
const beat = (index, icon, name, note) => (f) => ({
  badge,
  count: counter(index < 2 ? 4 + Math.round(13 * ramp(index * 56 + f, 10, 100)) : 17, 1),
  label: { o: hold(f, 2, 56, 7, 9), y: 22 * (1 - easeOutBack(ramp(f, 2, 16))), icon, text: name, sub: note },
});

// Holy Garlic Grenade — the biggest blast in the game, in the Moonlit Grove.
await clip.load();
await clip.match('b-holy', 'night');
await clip.zoom(22);
await clip.faceEnemy(0.85);
await clip.select('holy');
await clip.fire();
await clip.record(10, beat(0, '✝️', 'Holy Grenade', '100 damage · sings first'), 1 / FPS, 0);
await clip.release();
await clip.skip(1.4);
await clip.record(46, beat(0, '✝️', 'Holy Grenade', '100 damage · sings first'), 1 / FPS, 10);

// Concrete Mule — drops from the sky and keeps crashing through its own craters.
await clip.load();
await clip.match('b-mule', 'sunset');
const muleTarget = await clip.faceEnemy(0.4);
await clip.select('mule');
await clip.strike(muleTarget.x);
await clip.skip(0.8);
await clip.zoom(26);
await clip.record(56, beat(1, '🐴', 'Concrete Mule', 'up to six impacts'));

// Minigun — fourteen bullets that shove the victim across the map.
await clip.load();
await clip.match('b-minigun', 'meadow');
await clip.zoom(20);
await clip.faceEnemy(0.05);
await clip.select('minigun');
await clip.fire();
await clip.record(56, beat(2, '🔫', 'Minigun', '14 rounds · the shoves add up'));

// Napalm Strike — fire against snow, the prettiest contrast in the game.
await clip.load();
await clip.match('b-napalm', 'frost');
const napalmTarget = await clip.faceEnemy(0.4);
await clip.select('napalm');
await clip.strike(napalmTarget.x);
await clip.skip(2.2);
await clip.zoom(24);
await clip.record(56, beat(3, '🔥', 'Napalm Strike', 'the ground keeps burning'));

// Flying Sheep — steered the whole flight, the nod every Worms player waits for.
await clip.load();
await clip.match('b-flysheep', 'candy');
await clip.zoom(22);
await clip.faceEnemy(1.0);
await clip.select('flysheep');
await clip.fire();
await clip.record(56, beat(4, '🐑', 'Flying Sheep', 'you steer it · Space detonates'));

// ---------------------------------------------------------------------------- 3. the receipts (122)

// The AI plays itself while the repository's own numbers come up.
await clip.load();
await clip.page.evaluate(() =>
  window.__allium.startMatch({
    seed: 'b-receipts',
    teams: [
      { name: 'Garlic Gang', color: '#ef4b3c', controller: 'ai', aiLevel: 'hard', buddyNames: ['Clovis', 'Aioli', 'Pesto'] },
      { name: 'Clove Crew', color: '#3d8bfd', controller: 'ai', aiLevel: 'hard', buddyNames: ['Chive', 'Sprout', 'Toasty'] },
    ],
    turnTime: 45,
    retreatTime: 3,
    windMax: 0.7,
    crates: 0.5,
    theme: 'meadow',
  }),
);
await clip.page.evaluate(() => window.__allium.setManual(true));
await clip.skip(3);
await clip.zoom(26);

/** Three facts, one at a time, each one checkable in the repository. */
const facts = [
  { icon: '⚡', text: '99 commits', sub: 'in five days' },
  { icon: '✅', text: '84 unit tests', sub: 'plus an E2E test per weapon' },
  { icon: '📖', text: 'Open source', sub: 'GPL-3.0 · REUSE compliant' },
];
for (const [i, fact] of facts.entries()) {
  await clip.record(41, (f) => ({
    badge,
    count: counter(17, 1),
    label: { o: hold(f, 1, 41, 7, 8), y: 22 * (1 - easeOutBack(ramp(f, 1, 15))), ...fact },
  }));
  if (i < facts.length - 1) await clip.skip(1.2);
}

// ---------------------------------------------------------------------------- 4. the card (120)

await clip.load();
await clip.match('b-card', 'sunset');
await clip.zoom(24);
await clip.faceEnemy(0.75);
await clip.select('banana');
await clip.fire();
const card = (f) => ({
  scrim: { o: 0.78 * easeOut(ramp(f, 30, 52)) },
  title:
    f > 28
      ? {
          o: easeOut(ramp(f, 32, 50)),
          s: 0.9 + 0.1 * easeOutBack(ramp(f, 32, 56)),
          eyebrow: 'Allium Assault',
          text: '17<em>×</em>weapons',
          sub: 'Turn-based garlic warfare · free in your browser',
        }
      : {},
  cta: f > 74 ? { o: easeOut(ramp(f, 76, 92)), y: 236, text: 'Play it free', url: 'marcelpetrick.github.io/AlliumAssault' } : {},
  badge: { o: 0.9 * (1 - ramp(f, 28, 40)) },
});
await clip.record(12, card);
await clip.release();
await clip.record(108, card, 1 / FPS, 12);

await clip.close();
clip.encode(join(out, 'clip-b-shiplog.mp4'), join(out, 'clip-b-poster.jpg'), 120);
