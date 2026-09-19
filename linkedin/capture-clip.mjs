// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Clip A — "the tour": twenty seconds that show the game is real and playable.
 *
 *   npm run build && npm run preview      (in another terminal)
 *   node linkedin/capture-clip.mjs [url]  default http://localhost:4173
 *
 * Five scenes: the headline over a live battle, the custom match menu, banana bomb, air strike and
 * the sheep. Written for a muted autoplay feed, so every scene carries its own caption.
 *
 * Output: linkedin/clip-a-tour.mp4 (1080x1350, 4:5, 30 fps, H.264) and clip-a-poster.jpg.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clip, FPS, easeOut, easeOutBack, hold, ramp } from './clipkit.mjs';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = dirname(fileURLToPath(import.meta.url));
const clip = new Clip(url);
await clip.open();

/** The corner badge, shown on every scene once the title card has cleared. */
const badge = { o: 0.92 };
const headline = { eyebrow: 'Fully playable', text: '<span>🧄</span>Allium Assault', sub: 'Turn-based garlic warfare · in your browser' };

// ---------------------------------------------------------------------------- 1. title (105)

await clip.load();
await clip.match('clip-title', 'meadow');
await clip.zoom(26);
await clip.faceEnemy(0.62);
await clip.fire();

// The headline sits over a real battle — the rocket is already in the air behind it.
await clip.record(18, (f) => ({
  scrim: { o: easeOut(ramp(f, 0, 10)) },
  title: { ...headline, o: easeOut(ramp(f, 2, 14)), s: 0.86 + 0.14 * easeOutBack(ramp(f, 2, 20)) },
}));
await clip.release();
await clip.record(
  87,
  (f) => ({
    // The title holds, then lifts away to leave the explosion clean in frame.
    scrim: { o: 1 - easeOut(ramp(f, 50, 76)) },
    title: { ...headline, o: 1 - easeOut(ramp(f, 50, 72)), y: -60 * easeOut(ramp(f, 50, 78)), s: 1 - 0.06 * ramp(f, 50, 78) },
    badge: { o: 0.92 * ramp(f, 72, 84) },
  }),
  1 / FPS,
  18,
);

// ---------------------------------------------------------------------------- 2. the menu (105)

await clip.load();
await clip.page.evaluate(() => window.__allium.setManual(true));
await clip.page.click('[data-action="setup"]');

const menu = (f) => ({
  badge,
  label: {
    o: hold(f, 4, 105, 9, 10),
    y: 26 * (1 - easeOutBack(ramp(f, 4, 20))),
    icon: '⚙',
    text: 'Custom match',
    sub: 'teams · arsenal · sudden death · scenery',
  },
});

// One option per beat, each held long enough to read at full speed.
await clip.record(12, menu, 1 / FPS, 0);
let at = 12;
const clicks = [
  '[data-action="theme"][data-value="candy"]',
  '[data-action="arsenal"][data-value="crates"]',
  '[data-action="sudden-death"][data-value="20"]',
  '[data-action="buddies"][data-team="0"][data-value="1"]',
  '[data-action="color"][data-team="1"][data-value="#a45ee5"]',
  '[data-action="wind"][data-value="1"]',
];
for (const selector of clicks) {
  const button = clip.page.locator(selector).first();
  // A setting that moved or is already selected must not abort a recording that is minutes in.
  if ((await button.count()) > 0) await button.click({ timeout: 5000 }).catch(() => undefined);
  await clip.record(12, menu, 1 / FPS, at);
  at += 12;
}
await clip.page.click('[data-action="start"]');
await clip.record(105 - at, menu, 1 / FPS, at);

// ---------------------------------------------------------------------------- 3. banana bomb (125)

/** A weapon scene's lower third, plus an optional chip in the top corner. */
const weapon = (icon, text, sub, end, chip) => (f) => ({
  badge,
  chip: chip ? { o: hold(f, 10, end, 8, 12), text: chip } : {},
  label: { o: hold(f, 3, end, 9, 12), y: 26 * (1 - easeOutBack(ramp(f, 3, 19))), icon, text, sub },
});

await clip.load();
await clip.match('clip-banana', 'sunset');
await clip.zoom(22);
await clip.faceEnemy(0.92);
await clip.select('banana');
await clip.fire();
const banana = weapon('🍌', 'Banana Bomb', 'bursts into five bouncing bananas', 125, '13 new weapons');
await clip.record(12, banana, 1 / FPS, 0);
await clip.release();
// Throw and arc, then skip most of the three second fuse straight to the burst.
await clip.record(45, banana, 1 / FPS, 12);
await clip.skip(1.1);
await clip.record(68, banana, 1 / FPS, 57);

// ---------------------------------------------------------------------------- 4. air strike (125)

await clip.load();
await clip.match('clip-strike', 'frost');
const target = await clip.faceEnemy(0.4);
await clip.select('airstrike');
await clip.strike(target.x);
// The plane needs a moment to fly in; the strike view also pulls the camera way out.
await clip.skip(0.9);
const strike = weapon('✈️', 'Air Strike', 'click the map, the plane does the rest', 125, 'Wind-aware AI');
await clip.record(55, strike, 1 / FPS, 0);
await clip.zoom(26);
await clip.record(70, strike, 1 / FPS, 55);

// ---------------------------------------------------------------------------- 5. the sheep (140)

await clip.load();
await clip.match('clip-sheep', 'candy');
await clip.zoom(20);
await clip.faceEnemy(0.25);
await clip.select('sheep');
await clip.fire();
const sheep = (f) => ({
  badge: { o: 0.92 * (1 - ramp(f, 96, 110)) },
  label: { o: hold(f, 3, 92, 9, 12), y: 26 * (1 - easeOutBack(ramp(f, 3, 19))), icon: '🐑', text: 'The Sheep', sub: 'hops off — Space detonates it' },
  cta: {
    o: easeOut(ramp(f, 104, 120)),
    s: 0.9 + 0.1 * easeOutBack(ramp(f, 104, 126)),
    text: '17 weapons · free · open source',
    url: 'marcelpetrick.github.io/AlliumAssault',
  },
});
// Three seconds of hopping across the Candy Shop, then the detonation in half speed.
await clip.record(88, sheep, 1 / FPS, 0);
await clip.fire();
await clip.record(26, sheep, 1 / (FPS * 2), 88);
await clip.record(26, sheep, 1 / FPS, 114);

await clip.close();
clip.encode(join(out, 'clip-a-tour.mp4'), join(out, 'clip-a-poster.jpg'), 100);
