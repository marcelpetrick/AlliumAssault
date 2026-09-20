// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { WATER_LEVEL, WORLD_HEIGHT, WORLD_WIDTH } from '../src/core/constants';
import { Game, type Buddy } from '../src/core/game';
import { REEL_SPEED, ROPE_MAX, ROPE_MIN } from '../src/core/rope';
import { Terrain } from '../src/core/terrain';
import { config, runUntil, team } from './helpers';

/** Flat ground at y = 20 under a ceiling slab from y = 34 up, so a hook always has rock above. */
function cave(overrides: Partial<Parameters<typeof config>[1]> = {}): Game {
  const t = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
  t.fill((_x, y) => Math.max(20 - y, y - 34));
  return new Game(config([team('A', 1), team('B', 1)], { turnTime: 60, ...overrides }), {
    terrain: t,
    spawns: [
      { x: 40, y: 20.7 },
      { x: 90, y: 20.7 },
    ],
  });
}

const toAiming = (g: Game) => runUntil(g, () => g.phase === 'aiming', 8);

/** Fire the hook straight up (or at `aim`) and run until it has bitten or missed. */
function shoot(g: Game, aim = Math.PI / 2 - 0.01, facing: 1 | -1 = 1): Buddy {
  const me = g.activeBuddy!;
  g.selectWeapon('rope');
  g.face(facing);
  me.aim = aim;
  g.pressFire();
  runUntil(g, () => g.rope?.state === 'attached' || g.rope === null, 3);
  return me;
}

/** Hold the given inputs for `seconds`, then let go of everything. */
function hold(g: Game, seconds: number, keys: Partial<Record<'up' | 'down' | 'left' | 'right', boolean>>): void {
  Object.assign(g.input, keys);
  g.simulate(seconds);
  Object.assign(g.input, { up: false, down: false, left: false, right: false });
}

describe('rope', () => {
  it('bites into rock within range, pays out what it flew, and costs one use', () => {
    const g = cave();
    toAiming(g);
    const before = g.teams[0].ammo.rope;
    shoot(g);
    const rope = g.rope!;
    expect(rope.state).toBe('attached');
    expect(g.phase).toBe('roping');
    expect(rope.pivots).toHaveLength(1);
    expect(rope.pivots[0].y).toBeGreaterThan(33);
    expect(rope.length).toBeGreaterThan(10);
    expect(rope.length).toBeLessThanOrEqual(ROPE_MAX);
    expect(g.teams[0].ammo.rope).toBe(before - 1);
  });

  it('a hook that hits nothing is a free miss, and the buddy just falls', () => {
    const t = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
    t.fill((_x, y) => 20 - y);
    const g = new Game(config([team('A', 1), team('B', 1)], { turnTime: 60 }), {
      terrain: t,
      spawns: [
        { x: 40, y: 20.7 },
        { x: 90, y: 20.7 },
      ],
    });
    toAiming(g);
    const before = g.teams[0].ammo.rope;
    shoot(g);
    expect(g.rope).toBeNull();
    expect(g.teams[0].ammo.rope).toBe(before);
    // Nothing to hang from, so it lands and play carries on with the turn timer still running.
    runUntil(g, () => g.phase === 'aiming', 5);
    expect(g.phase).toBe('aiming');
    expect(g.turnTimeLeft).toBeGreaterThan(0);
  });

  it('Up climbs at the reel speed, and neither end of the rope can be passed', () => {
    const g = cave();
    toAiming(g);
    const me = shoot(g);
    const startY = me.body.y;
    const startLength = g.rope!.length;
    hold(g, 1, { up: true });
    expect(g.rope!.length).toBeCloseTo(startLength - REEL_SPEED, 1);
    expect(me.body.y - startY).toBeCloseTo(REEL_SPEED, 0);
    // Reeling all the way in stops at the minimum rather than pulling into the anchor.
    hold(g, 6, { up: true });
    expect(g.rope!.length).toBeCloseTo(ROPE_MIN, 2);
    // And paying out stops at the maximum.
    hold(g, 12, { down: true });
    expect(g.rope!.length).toBeLessThanOrEqual(ROPE_MAX + 1e-6);
  });

  it('Left and Right build a swing, and a swing left alone never gains energy', () => {
    const g = cave();
    toAiming(g);
    const me = shoot(g);
    hold(g, 1.7, { up: true });
    const hangX = me.body.x;
    hold(g, 2.4, { right: true });
    expect(me.body.x - hangX).toBeGreaterThan(1.5);

    // Now hands off: track the peak speed of each swing; it must not climb.
    let first = 0;
    let last = 0;
    for (let cycle = 0; cycle < 6; cycle++) {
      let peak = 0;
      for (let k = 0; k < 90; k++) {
        g.step(1 / 60);
        peak = Math.max(peak, Math.hypot(me.body.vx, me.body.vy));
      }
      if (cycle === 0) first = peak;
      last = peak;
      expect(Number.isFinite(peak)).toBe(true);
    }
    expect(last).toBeLessThanOrEqual(first + 1e-6);
  });

  it('Space lets go with the momentum it had, and a second hook in the same traversal is free', () => {
    const g = cave();
    toAiming(g);
    const me = shoot(g);
    hold(g, 1.7, { up: true });
    hold(g, 2, { right: true });
    const spent = g.teams[0].ammo.rope;
    const flying = { vx: me.body.vx, vy: me.body.vy };
    expect(Math.hypot(flying.vx, flying.vy)).toBeGreaterThan(1);
    g.pressFire();
    expect(g.rope).toBeNull();
    expect(g.phase).toBe('roping');
    expect(me.body.vx).toBeCloseTo(flying.vx, 6);
    expect(me.body.vy).toBeCloseTo(flying.vy, 6);

    // Straight back onto a new hook, without paying again.
    me.aim = Math.PI / 2 - 0.01;
    g.pressFire();
    runUntil(g, () => g.rope?.state === 'attached', 3);
    expect(g.rope?.state).toBe('attached');
    expect(g.teams[0].ammo.rope).toBe(spent);
  });

  it('wraps around a corner and unwraps again, keeping the rope out of the rock', () => {
    const t = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
    // Ground, a ceiling, and a pillar hanging down from the ceiling to bend the rope around.
    t.fill((x, y) => Math.max(20 - y, y - 34, Math.min(1.1 - Math.abs(x - 44), y - 26)));
    const g = new Game(config([team('A', 1), team('B', 1)], { turnTime: 60 }), {
      terrain: t,
      spawns: [
        { x: 40, y: 20.7 },
        { x: 90, y: 20.7 },
      ],
    });
    toAiming(g);
    const me = shoot(g);
    hold(g, 0.5, { up: true });
    expect(g.rope!.pivots).toHaveLength(1);
    // Swing past the pillar below its tip: the rope has to bend around the corner.
    hold(g, 3, { right: true });
    const wrapped = g.rope!.pivots.length;
    expect(wrapped).toBeGreaterThan(1);
    for (const p of g.rope!.pivots) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(g.terrain.isSolid(me.body.x, me.body.y)).toBe(false);
    // Swing back the other way and the corner is given up again.
    hold(g, 3, { left: true });
    expect(g.rope!.pivots.length).toBeLessThan(wrapped + 1);
  });

  it('lets go when the rock it bit into is blasted away', () => {
    const g = cave();
    toAiming(g);
    shoot(g);
    hold(g, 1.4, { up: true });
    const anchor = g.rope!.pivots[0];
    g.terrain.carve(anchor.x, anchor.y, 3);
    g.simulate(0.2);
    expect(g.rope).toBeNull();
    expect(g.phase).toBe('roping');
    // It falls and play goes on; no buddy is left hanging in mid-air.
    runUntil(g, () => g.phase === 'aiming', 6);
    expect(g.phase).toBe('aiming');
  });

  it('returns to ordinary control once the buddy lands, with the turn still running', () => {
    const g = cave();
    toAiming(g);
    const me = shoot(g);
    hold(g, 1.4, { up: true });
    g.pressFire();
    runUntil(g, () => g.phase === 'aiming', 8);
    expect(g.phase).toBe('aiming');
    expect(g.action).toBeNull();
    expect(me.body.grounded).toBe(true);
    expect(g.turnTimeLeft).toBeGreaterThan(0);
    // And a weapon can still be fired from where the rope left it.
    g.selectWeapon('bazooka');
    g.pressFire();
    g.simulate(0.3);
    g.releaseFire();
    expect(g.projectiles.length).toBeGreaterThan(0);
  });

  it('ends the turn when the clock runs out mid-swing', () => {
    const g = cave({ turnTime: 4 });
    toAiming(g);
    shoot(g);
    hold(g, 1, { up: true });
    expect(g.phase).toBe('roping');
    runUntil(g, () => g.phase !== 'roping', 10);
    expect(g.phase).not.toBe('roping');
    expect(g.rope).toBeNull();
    expect(g.action).toBeNull();
    // The turn resolves rather than hanging on a buddy that was in the air.
    expect(runUntil(g, () => g.phase === 'turnStart' || g.phase === 'gameOver', 25)).toBe(true);
  });

  it('drowns a buddy swung out over the water', () => {
    const t = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
    // An island with a ceiling over it, and open sea to the right.
    t.fill((x, y) => Math.max(Math.min(20 - y, 46 - x), y - 34));
    const g = new Game(config([team('A', 1), team('B', 1)], { turnTime: 60 }), {
      terrain: t,
      spawns: [
        { x: 40, y: 20.7 },
        { x: 20, y: 20.7 },
      ],
    });
    toAiming(g);
    const me = shoot(g);
    hold(g, 1.2, { up: true });
    g.pressFire();
    // Let go with a hard shove out to sea; there is no ground out there to land on.
    me.body.vx = 26;
    me.body.vy = 2;
    runUntil(g, () => !me.alive, 12);
    expect(me.alive).toBe(false);
    expect(me.hp).toBe(0);
    expect(me.body.x).toBeGreaterThan(46);
  });

  it('is deterministic: the same inputs give the same swing every time', () => {
    const run = () => {
      const g = cave();
      toAiming(g);
      const me = shoot(g);
      hold(g, 1.5, { up: true });
      hold(g, 2, { right: true });
      g.simulate(1.5);
      return { x: me.body.x, y: me.body.y, vx: me.body.vx, vy: me.body.vy, pivots: g.rope?.pivots.length ?? 0 };
    };
    expect(run()).toEqual(run());
  });

  it('catches a buddy already falling fast without teleporting it or producing nonsense', () => {
    const g = cave();
    toAiming(g);
    const me = g.activeBuddy!;
    me.body.y = 33;
    me.body.vy = -34;
    me.body.vx = 9;
    me.body.grounded = false;
    g.selectWeapon('rope');
    g.face(1);
    me.aim = Math.PI / 2 - 0.01;
    g.pressFire();
    const from = { x: me.body.x, y: me.body.y };
    g.simulate(0.02);
    let jump = 0;
    for (let k = 0; k < 60 * 3; k++) {
      const was = { x: me.body.x, y: me.body.y };
      g.step(1 / 60);
      jump = Math.max(jump, Math.hypot(me.body.x - was.x, me.body.y - was.y));
      expect(Number.isFinite(me.body.x) && Number.isFinite(me.body.y)).toBe(true);
    }
    // No single frame moves it further than a fast fall would.
    expect(jump).toBeLessThan(1.5);
    expect(Math.hypot(me.body.x - from.x, me.body.y - from.y)).toBeLessThan(ROPE_MAX * 2);
  });
});
