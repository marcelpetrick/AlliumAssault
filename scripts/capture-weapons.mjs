// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Records one short clip of every weapon for docs/weapons_preview.md.
 *
 *   npm run build && npm run preview             (in another terminal)
 *   node scripts/capture-weapons.mjs [url]       default http://localhost:4173
 *   node scripts/capture-weapons.mjs [url] bazooka grenade    just those two
 *
 * Every clip is a scripted match through the window.__allium hook: fixed seed, fixed frame step,
 * a scenery of its own, so re-running repeats the same actions. Needs ffmpeg on the PATH.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCapture, startMatch, focus, frames, recordFrame, encodeGif } from './media-kit.mjs';

const url = process.argv[2] ?? 'http://localhost:4173';
const only = process.argv.slice(3);
const out = 'docs/weapons';

/**
 * One clip per weapon: where it is fired from, what it is aimed at, and how long to film.
 *
 * `hold` is frames of charge before release (charge weapons only), `after` a callback fired that
 * many frames in — detonating the sheep, letting go of the rope. Sceneries rotate so the page is
 * not many pictures of the same meadow.
 */
const CLIPS = [
  { id: 'bazooka', theme: 'meadow', aim: 0.62, hold: 8, frames: 42 },
  { id: 'grenade', theme: 'sunset', aim: 0.85, hold: 8, frames: 46 },
  { id: 'cluster', theme: 'frost', aim: 0.85, hold: 9, frames: 52 },
  { id: 'banana', theme: 'candy', aim: 0.9, hold: 9, frames: 60 },
  { id: 'holy', theme: 'night', aim: 0.8, hold: 2, frames: 140 },
  { id: 'shotgun', theme: 'meadow', aim: 0.06, frames: 26 },
  { id: 'minigun', theme: 'sunset', aim: 0.05, frames: 40 },
  { id: 'punch', theme: 'candy', aim: 0, close: 1.1, frames: 26 },
  { id: 'bat', theme: 'meadow', aim: 0.2, close: 1.1, frames: 34 },
  { id: 'sheep', theme: 'frost', aim: 0, frames: 60, after: [42, 'fire'] },
  { id: 'flysheep', theme: 'night', aim: 0.5, frames: 52, after: [34, 'fire'] },
  { id: 'airstrike', theme: 'sunset', strike: true, frames: 56 },
  { id: 'napalm', theme: 'night', strike: true, frames: 70 },
  { id: 'mule', theme: 'frost', strike: true, frames: 56 },
  { id: 'torch', theme: 'meadow', aim: 0.35, frames: 52 },
  { id: 'drill', theme: 'candy', aim: 0, frames: 52 },
  { id: 'rope', theme: 'frost', aim: 1.55, frames: 85 },
  { id: 'platform', theme: 'meadow', platform: true, frames: 26 },
  { id: 'surrender', theme: 'candy', aim: 0, frames: 30 },
  { id: 'mine', theme: 'sunset', aim: 0, frames: 65 },
  { id: 'teleport', theme: 'night', teleport: true, frames: 40 },
  { id: 'selfdestruct', theme: 'sunset', aim: 0, frames: 60 },
  { id: 'ming', theme: 'candy', aim: 0.85, hold: 10, frames: 70 },
  { id: 'flamer', theme: 'night', aim: -0.1, frames: 60 },
  { id: 'homing', theme: 'night', aim: 1.4, hold: 14, frames: 95 },
  { id: 'jetpack', theme: 'sunset', aim: 0, frames: 105 },
];

const capture = await openCapture(url);
const { page } = capture;
mkdirSync(out, { recursive: true });
const wanted = only.length ? CLIPS.filter((c) => only.includes(c.id)) : CLIPS;
assert.equal(wanted.length, only.length || CLIPS.length, 'unknown or repeated weapon id');
try {
  for (const clip of wanted) {
    const dir = mkdtempSync(join(tmpdir(), `allium-${clip.id}-`));
    try {
      await startMatch(page, `clip-${clip.id}`, clip.theme);
      await page.evaluate((c) => {
        const h = window.__allium,
          g = h.app.game,
          me = g.activeBuddy,
          enemy = g.buddies[1];
        if (c.id === 'homing') {
          enemy.body.x = 80;
          g.crates.push({ id: 9999, kind: 'weapon', weapon: 'homing', body: { ...me.body, radius: 0.45 } });
          h.fastForward(0.1);
        }
        if (c.close) enemy.body.x = me.body.x + c.close;
        if (['shotgun', 'minigun'].includes(c.id)) enemy.body.x = 49;
        if (c.close) g.terrain.fill((x, y) => Math.max(20 - y, Math.min(0.4 - Math.abs(x - 42.4), 24 - y)));
        if (c.id === 'selfdestruct') enemy.body.x = me.body.x + 4;
        if (c.id === 'torch') {
          g.terrain.fill((x, y) => Math.max(20 - y, Math.min(1 - Math.abs(x - 44), 22.5 - y)));
          enemy.body.x = 60;
        }
        if (c.id === 'rope') for (let x = 30; x <= 65; x++) g.terrain.addDisc(x, 34, 1.5);
        if (c.id === 'drill') g.terrain.carve(40, 12, 4);
        g.selectWeapon(c.id);
        g.face(1);
        me.aim = c.aim ?? 0;
        window.__captureStart = { x: me.body.x, y: me.body.y, hp: enemy.hp, terrain: g.terrain.solidFraction(), guided: false, airborne: false };
        window.__captureClipTarget = enemy.body.x;
      }, clip);
      await focus(page, clip.id === 'homing' ? 60 : 47, clip.id === 'jetpack' ? 29 : 24, clip.id === 'homing' ? 72 : clip.id === 'jetpack' ? 52 : 40);
      for (let k = 0; k < 5; k++) {
        await frames(page);
        await recordFrame(page, dir, k);
      }
      await page.evaluate((c) => {
        const h = window.__allium,
          g = h.app.game,
          me = g.activeBuddy;
        if (c.strike) {
          g.setStrikeDir(1);
          g.strike(window.__captureClipTarget);
        } else if (c.teleport) g.teleportTo(52, 28);
        else if (c.platform) g.placePlatform({ x: 46, y: 24, angle: 0.2 });
        else {
          if (c.id === 'homing') g.targetBuddy(g.buddies[1].id);
          g.pressFire();
        }
        if (c.id === 'jetpack') g.input.up = true;
        if (c.id === 'rope') {
          g.input.up = true;
          g.input.right = true;
        }
        // Instant weapons ignore release; charged projectiles retain it until their hold expires.
        if (!c.hold) g.releaseFire();
        me.facing = 1;
        h.fastForward(0);
      }, clip);
      if (clip.id === 'jetpack' || clip.id === 'rope') await page.keyboard.down('ArrowUp');
      if (clip.id === 'rope') await page.keyboard.down('ArrowRight');
      for (let k = 5; k < clip.frames; k++) {
        if (clip.id === 'rope' && k === 30) await page.keyboard.up('ArrowUp');
        if (clip.id === 'rope' && k === 45) await page.keyboard.up('ArrowRight');
        if (clip.id === 'jetpack' && k === 65) await page.keyboard.up('ArrowUp');
        await page.evaluate(
          ([c, k]) => {
            const g = window.__allium.app.game;
            if (c.hold && k === 5 + c.hold) g.releaseFire();
            if (c.after && k === c.after[0]) {
              g.pressFire();
              g.releaseFire();
            }
            if (c.id === 'shotgun' && k === 14) {
              g.pressFire();
              g.releaseFire();
            }
            if (c.id === 'rope' && k === 30) g.input.up = false;
            if (c.id === 'rope' && k === 45) {
              g.input.right = false;
              g.pressFire();
              g.releaseFire();
            }
            if (c.id === 'jetpack') {
              g.input.up = k < 65;
              // After showing fuel exhaustion, skip uneventful descent, preserving ordinary physics.
              if (k === 80) window.__allium.fastForward(20);
            }
            if (c.id === 'mine' && k === 30) g.buddies[1].body.x = 41;
            const s = window.__captureStart;
            s.guided ||= g.projectiles.some((p) => p.weapon === 'homing' && p.age >= 3);
            s.airborne ||= c.id === 'jetpack' && g.activeBuddy.body.y > s.y + 3;
            s.attached ||= g.rope?.state === 'attached';
          },
          [clip, k],
        );
        await frames(page);
        await recordFrame(page, dir, k);
      }
      await page.keyboard.up('ArrowUp');
      await page.keyboard.up('ArrowRight');
      const result = await page.evaluate((id) => {
        const g = window.__allium.app.game;
        return {
          id,
          events: window.__captureEvents.map((e) => e.type),
          start: window.__captureStart,
          x: g.buddies[0].body.x,
          y: g.buddies[0].body.y,
          hp: g.buddies[1].hp,
          phase: g.phase,
          platforms: g.terrain.platforms.length,
        };
      }, clip.id);
      const required = clip.strike
        ? 'airstrike'
        : clip.platform
          ? 'platformPlaced'
          : clip.teleport
            ? 'teleport'
            : clip.id === 'surrender'
              ? 'turnStart'
              : clip.id === 'rope'
                ? 'ropeBite'
                : clip.id === 'mine'
                  ? 'mineTriggered'
                  : 'fire';
      assert.ok(result.events.includes(required), `${clip.id}: missing ${required}`);
      if (clip.id === 'homing') {
        assert.ok(result.start.guided, 'homing phase recorded');
        assert.ok(result.hp < result.start.hp, 'homing target hit');
      }
      if (clip.id === 'jetpack') {
        assert.ok(result.start.airborne, 'jetpack rose');
        assert.equal(result.phase, 'aiming', 'jetpack landed');
      }
      if (clip.id === 'rope') {
        assert.ok(result.events.includes('ropeRelease'), 'rope released');
        assert.equal(result.phase, 'aiming', 'rope landing recorded');
      }
      if (['shotgun', 'minigun', 'punch', 'bat'].includes(clip.id)) assert.ok(result.hp < result.start.hp, `${clip.id}: actual damage`);
      if (['bazooka', 'grenade', 'cluster', 'banana', 'holy', 'ming', 'sheep', 'flysheep', 'mule', 'airstrike', 'napalm', 'selfdestruct'].includes(clip.id))
        assert.ok(result.events.includes('explosion'), `${clip.id}: no explosion recorded`);
      capture.check();
      encodeGif(dir, `${out}/${clip.id}.gif`);
      console.log(`${clip.id}: ${clip.frames} frames, ${Math.round(statSync(`${out}/${clip.id}.gif`).size / 1024)} kB; outcomes verified`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  await capture.browser.close();
}
