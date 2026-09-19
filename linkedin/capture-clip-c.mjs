// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Clip C — "it is just a link": twenty seconds built around the one thing the other two only claim.
 *
 *   npm run build && npm run preview        (in another terminal)
 *   node linkedin/capture-clip-c.mjs [url]  default http://localhost:4173
 *
 * The whole clip plays inside browser chrome: the address bar types the URL, a cursor clicks Quick
 * Match, and the game is running seconds later. Nothing is installed, nothing is signed into, and
 * the tab stays on screen the entire time so a muted viewer cannot miss where this runs.
 *
 * Output: linkedin/clip-c-browser.mp4 (1080x1350, 4:5, 30 fps, H.264) and clip-c-poster.jpg.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clip, FPS, easeOut, easeOutBack, hold, ramp } from './clipkit.mjs';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = dirname(fileURLToPath(import.meta.url));
const clip = new Clip(url);
await clip.open();

const ADDRESS = 'marcelpetrick.github.io/AlliumAssault';
/** The tab is on screen for the whole clip — that is the argument this cut is making. */
const chrome = (f, typed = ADDRESS) => ({ o: 1, url: typed, caret: f % 20 < 10 ? 1 : 0 });
/** Moves the pointer towards a target and flashes a click ring when it lands. */
const cursor = (f, from, to, start, end) => {
  const t = easeOut(ramp(f, start, end));
  const click = ramp(f, end, end + 9);
  return {
    o: hold(f, start - 6, end + 26, 6, 8),
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    ring: f > end ? 1 - click : 0,
    ringScale: 1 + 1.4 * click,
  };
};

// ---------------------------------------------------------------------------- 1. the address bar (140)

await clip.load();
await clip.page.evaluate(() => window.__clip.browserFrame(true));
await clip.page.evaluate(() => window.__allium.setManual(true));

// The title screen runs its own demo battle behind the menu while the URL is typed.
await clip.record(140, (f) => ({
  // One character every two frames, so the address lands just as the cursor starts moving.
  chrome: chrome(f, ADDRESS.slice(0, Math.min(ADDRESS.length, Math.floor(ramp(f, 6, 62) * ADDRESS.length)))),
  label: {
    o: hold(f, 66, 140, 9, 10),
    y: 24 * (1 - easeOutBack(ramp(f, 66, 82))),
    icon: '🌐',
    text: 'No install',
    sub: 'no account · no launcher · just a tab',
  },
  cursor: cursor(f, { x: 250, y: 1180 }, { x: 540, y: 812 }, 86, 128),
}));

// ---------------------------------------------------------------------------- 2. one click in (110)

await clip.page.click('[data-action="quick"]');
await clip.page.evaluate(() => {
  const app = window.__allium.app;
  for (let k = 0; k < 600 && app.game.phase !== 'aiming'; k++) app.fastForward(1 / 60);
});
await clip.zoom(24);
await clip.record(110, (f) => ({
  chrome: chrome(f),
  label: {
    o: hold(f, 4, 110, 9, 11),
    y: 24 * (1 - easeOutBack(ramp(f, 4, 20))),
    icon: '⚡',
    text: 'One click in',
    sub: 'you against the AI, right away',
  },
}));

// ---------------------------------------------------------------------------- 3. a real turn (150)

await clip.faceEnemy(0.55);
await clip.page.evaluate(() => window.__allium.app.game.jump());
const turn = (f) => ({
  chrome: chrome(f),
  label: {
    o: hold(f, 4, 150, 9, 11),
    y: 24 * (1 - easeOutBack(ramp(f, 4, 20))),
    icon: '💥',
    text: 'Destructible islands',
    sub: 'wind, physics and a crater where the hill was',
  },
});
await clip.record(34, turn);
await clip.faceEnemy(0.62);
await clip.select('bazooka');
await clip.fire();
await clip.record(16, turn, 1 / FPS, 34);
await clip.release();
await clip.record(100, turn, 1 / FPS, 50);

// ---------------------------------------------------------------------------- 4. and there is a sheep (110)

await clip.load();
await clip.page.evaluate(() => window.__clip.browserFrame(true));
await clip.match('c-sheep', 'candy');
await clip.zoom(21);
await clip.faceEnemy(0.25);
await clip.select('sheep');
await clip.fire();
const sheep = (f) => ({
  chrome: chrome(f),
  label: {
    o: hold(f, 3, 110, 9, 11),
    y: 24 * (1 - easeOutBack(ramp(f, 3, 19))),
    icon: '🐑',
    text: '17 weapons',
    sub: 'including a sheep you set off yourself',
  },
});
await clip.record(74, sheep);
await clip.fire();
await clip.record(36, sheep, 1 / (FPS * 2), 74);

// ---------------------------------------------------------------------------- 5. the tab (90)

const card = (f) => ({
  chrome: chrome(f),
  scrim: { o: 0.8 * easeOut(ramp(f, 0, 18)) },
  title:
    f > 2
      ? {
          o: easeOut(ramp(f, 4, 20)),
          s: 0.9 + 0.1 * easeOutBack(ramp(f, 4, 28)),
          eyebrow: 'Playable right now',
          text: 'Open<br>the tab',
          sub: 'desktop or phone · free · open source',
        }
      : {},
  cta: f > 30 ? { o: easeOut(ramp(f, 32, 48)), y: 250, text: '', url: ADDRESS } : {},
});
await clip.record(90, card, 1 / FPS, 0);

await clip.close();
clip.encode(join(out, 'clip-c-browser.mp4'), join(out, 'clip-c-poster.jpg'), 300);
