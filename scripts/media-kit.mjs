// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Shared deterministic capture helpers. Headed capture uses the real GPU under Xvfb. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { join } from 'node:path';

export async function openCapture(url, viewport = { width: 960, height: 540 }) {
  const headed = process.env.ALLIUM_CAPTURE_HEADED === '1';
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !headed,
    args: headed ? ['--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${url.replace(/\/$/, '')}/?quality=high`);
  await page.waitForFunction(() => window.__allium?.ready, null, { timeout: 120_000 });
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  assert.ok((await page.locator('.version').textContent()).includes(`v${version}`), 'preview build matches package version');
  await page.evaluate(async () => {
    window.__allium.setManual(true);
    await document.fonts.ready;
  });
  return { browser, page, check: () => assert.deepEqual(errors, [], 'browser errors during capture') };
}

export const frames = (page, count = 1, dt = 0.1) => page.evaluate(([n, step]) => window.__allium.stepFrames(n, step), [count, dt]);

export async function startMatch(page, seed, theme = 'meadow', extra = {}, authored = true) {
  await page.evaluate(
    ([seed, theme, extra, authored]) => {
      const h = window.__allium;
      h.setManual(true);
      h.startMatch({
        seed,
        theme,
        teams: [
          { name: 'Garlic Gang', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Clovis'] },
          { name: 'Clove Crew', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Chive'] },
        ],
        turnTime: 120,
        retreatTime: 3,
        windMax: 0,
        crates: 0,
        suddenDeath: 0,
        arsenal: 'all',
        ...extra,
      });
      const g = h.app.game;
      if (authored) {
        g.terrain.fill((_x, y) => 20 - y);
        h.app.world.decorations.clearAround(64, 32, 150);
        g.buddies.forEach((b, i) => Object.assign(b.body, { x: 40 + i * 15, y: 20.65, vx: 0, vy: 0, grounded: true }));
      }
      window.__captureEvents = [];
      const drain = g.drainEvents.bind(g);
      g.drainEvents = () => {
        const events = drain();
        window.__captureEvents.push(...events);
        return events;
      };
      for (let k = 0; k < 600 && g.phase !== 'aiming'; k++) h.fastForward(1 / 60);
    },
    [seed, theme, extra, authored],
  );
  assert.equal(await page.evaluate(() => window.__allium.app.game.phase), 'aiming', `first turn for ${seed}`);
  await frames(page, 20);
}

export async function focus(page, x, y, distance = 34) {
  await page.evaluate(
    ([x, y, distance]) => {
      const w = window.__allium.app.world;
      Object.assign(w.goal, { x, y });
      Object.assign(w.focus, { x, y });
      w.goalDistance = w.distance = distance;
      w.manualUntil = w.time + 1000;
    },
    [x, y, distance],
  );
  await frames(page, 1, 0);
}

export async function caption(page, text) {
  await page.evaluate((text) => {
    let el = document.getElementById('capture-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'capture-caption';
      document.body.appendChild(el);
      el.style.cssText =
        'position:fixed;top:110px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 16px;background:#111d;color:white;border-radius:12px;font:600 22px system-ui;white-space:nowrap;pointer-events:none';
    }
    el.textContent = text;
  }, text);
}

export function encodeGif(dir, destination, fps = 10, width = 480) {
  const palette = join(dir, 'palette.png');
  const scale = `scale=${width}:-1:flags=lanczos`;
  const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png')];
  execFileSync('ffmpeg', [...args, '-vf', `${scale},palettegen=max_colors=96:stats_mode=diff`, '-frames:v', '1', palette]);
  execFileSync('ffmpeg', [
    ...args,
    '-i',
    palette,
    '-lavfi',
    `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop',
    '0',
    destination,
  ]);
}

export const recordFrame = (page, dir, k) => page.screenshot({ path: join(dir, `f${String(k).padStart(4, '0')}.png`), timeout: 120_000 });
