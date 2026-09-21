// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { contourRegion } from '../src/core/contour';
import { mulberry32, hashString } from '../src/core/rng';
import { CELL, findSpawnCandidates, generateTerrain, PLATFORM_LENGTH, PLATFORM_THICKNESS, pickSpawns, Terrain } from '../src/core/terrain';
import { burnSpot, spreadFlames } from '../src/core/fire';
import { stepFlyer, type Flyer } from '../src/core/flyer';
import { defined } from '../src/core/assert';
import { createBody } from '../src/core/physics';
import { mineSees, placeMine, stepMine } from '../src/core/mines';
import { clearLine, HOOK_MAX_TIME, ropePath, shootRope, stepRope } from '../src/core/rope';
import { releaseSheep, stepSheep } from '../src/core/sheep';
import { weaponForKey } from '../src/core/weapons';

const spec = { seed: 'garlic', width: 128, height: 64, waterLevel: 3 };

describe('rng', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = mulberry32(hashString('x'));
    const b = mulberry32(hashString('x'));
    const c = mulberry32(hashString('y'));
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('terrain generation', () => {
  it('is deterministic for a seed', () => {
    const a = generateTerrain(spec);
    const b = generateTerrain(spec);
    expect(a.field).toEqual(b.field);
    expect(generateTerrain({ ...spec, seed: 'onion' }).field).not.toEqual(a.field);
  });

  it('produces a sensible amount of land with nothing near the top edge', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const t = generateTerrain({ ...spec, seed });
      const fraction = t.solidFraction();
      expect(fraction).toBeGreaterThan(0.12);
      expect(fraction).toBeLessThan(0.55);
      for (let x = 0; x < t.width; x += 1) expect(t.isSolid(x, t.height - 1)).toBe(false);
    }
  });

  it('offers at least 16 separated spawn points above the water', () => {
    for (const seed of ['a', 'b', 'c']) {
      const t = generateTerrain({ ...spec, seed });
      const spawns = pickSpawns(findSpawnCandidates(t, 0.6), 16, mulberry32(1));
      expect(spawns.length).toBe(16);
      for (const p of spawns) {
        expect(p.y).toBeGreaterThan(t.waterLevel + 2);
        expect(t.distance(p.x, p.y)).toBeGreaterThan(0.45);
        expect(t.isSolid(p.x, p.y - 1.2)).toBe(true);
      }
    }
  });
});

describe('terrain destruction', () => {
  it('carves a round crater, scorches it and marks chunks dirty', () => {
    const t = new Terrain(40, 20, 1);
    t.fill((_x, y) => 10 - y);
    t.dirty.clear();
    t.carve(20, 10, 3);
    expect(t.isSolid(20, 9)).toBe(false);
    expect(t.isSolid(20, 7.5)).toBe(false);
    expect(t.isSolid(20, 6.5)).toBe(true);
    expect(t.isSolid(25, 9)).toBe(true);
    expect(t.dirty.size).toBeGreaterThan(0);
    expect(Math.max(...t.scorch)).toBeGreaterThan(0.5);
  });
});

describe('placed platforms', () => {
  const airAbove = (groundY: number) => {
    const t = new Terrain(40, 30, 3);
    t.fill((_x, y) => groundY - y);
    return t;
  };

  it('is solid rock for every terrain query once placed, without touching the field', () => {
    const t = airAbove(12);
    const board = { x: 20, y: 17, angle: 0.2 };
    expect(t.canPlacePlatform(board)).toBe(true);
    t.addPlatform(board);
    expect(t.isSolid(20, 17)).toBe(true);
    expect(t.isSolid(20 + PLATFORM_LENGTH / 2 + 0.5, 17)).toBe(false);
    // Its top surface points up, so a body lands on it instead of sliding through.
    expect(t.normal(20, 17.2).y).toBeGreaterThan(0.9);
    // The density field itself is untouched, so a blast cannot cut the board.
    t.carve(20, 17, 3);
    expect(t.isSolid(20, 17)).toBe(true);
  });

  it('keeps the deeper of two crossing boards when sampling their overlap', () => {
    const t = airAbove(12);
    t.addPlatform({ x: 20, y: 17, angle: 0 });
    // A second board crossing the first: the sample point sits deep in the flat one and only
    // clips the tilted one, so the deeper value has to win.
    t.addPlatform({ x: 20, y: 17.15, angle: 0.5 });
    expect(t.sample(20, 17)).toBeCloseTo(PLATFORM_THICKNESS / 2, 5);
  });

  it('refuses spots in rock, under water, off the map, over-tilted or on a body', () => {
    const t = airAbove(12);
    const board = { x: 20, y: 17, angle: 0.2 };
    expect(t.canPlacePlatform(board, [{ x: 20, y: 17 }])).toBe(false);
    expect(t.canPlacePlatform({ ...board, y: 12 })).toBe(false);
    expect(t.canPlacePlatform({ ...board, y: 3 })).toBe(false);
    expect(t.canPlacePlatform({ ...board, y: 30 })).toBe(false);
    expect(t.canPlacePlatform({ ...board, x: -1 })).toBe(false);
    expect(t.canPlacePlatform({ ...board, x: 39 })).toBe(false);
    expect(t.canPlacePlatform({ ...board, angle: Infinity })).toBe(false);
    expect(t.canPlacePlatform({ ...board, angle: Math.PI })).toBe(false);
    t.addPlatform(board);
    // Boards may not be stacked into each other either.
    expect(t.canPlacePlatform(board)).toBe(false);
  });
});

describe('hazards and hard cases at the map boundary', () => {
  it('reports no scorch outside the grid and none on untouched rock', () => {
    const t = new Terrain(40, 30, 3);
    t.fill((_x, y) => 12 - y);
    expect(t.scorchAt(-1, 17)).toBe(0);
    expect(t.scorchAt(20, 17)).toBe(0);
  });

  it('does not burn under water or beyond the map, and skips patches with no ground', () => {
    const t = new Terrain(20, 20, 3);
    t.fill((_x, y) => 3 - y);
    expect(burnSpot(t, -1, 3)).toBeNull();
    expect(burnSpot(t, 10, 3)).toBeNull();
    t.fill(() => -4);
    expect(burnSpot(t, 10, 10)).toBeNull();
    expect(spreadFlames(t, 10, 10, 3, 5, () => 1)).toEqual([]);
  });

  it('classifies a flying sheep hitting a buddy, water and the outer boundary', () => {
    const t = new Terrain(20, 20, 3);
    const flyer = (x: number, y: number, angle: number): Flyer => ({ id: 1, owner: 0, x, y, angle, age: 0 });
    expect(stepFlyer(t, flyer(10, 10, 0), 0.1, { x: 0, y: 0 }, () => true)).toBe('hit');
    expect(stepFlyer(t, flyer(10, 3.1, -Math.PI / 2), 0.1, { x: 0, y: 0 }, () => false)).toBe('water');
    expect(stepFlyer(t, flyer(49.9, 10, 0), 0.1, { x: 0, y: 0 }, () => false)).toBe('out');
    expect(stepFlyer(t, flyer(10, 59.9, Math.PI / 2), 0.1, { x: 0, y: 0 }, () => false)).toBe('out');
  });

  it('handles a mine on top of its target and mines leaving the arena', () => {
    const t = new Terrain(20, 20, 3);
    const mine = placeMine(1, 0, 0, 10, 10);
    expect(mineSees(t, mine, 10, 10)).toBe(true);
    mine.body.y = 2;
    expect(stepMine(t, mine, 0, false)).toBe('water');
    mine.body.x = -31;
    mine.body.y = 10;
    expect(stepMine(t, mine, 0, false)).toBe('out');
  });

  it('draws a flying hook and a taut rope, then detects a hook lost to water', () => {
    const t = new Terrain(20, 20, 3);
    const body = createBody(10, 10, 0.6);
    const hook = shootRope(1, 10, 10, 0, -1, false);
    expect(ropePath(hook, body)).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
    ]);
    expect(stepRope(t, hook, body, 0.5, 0, 0)).toBe('missed');
    hook.state = 'attached';
    hook.pivots = [{ x: 10, y: 14 }];
    hook.length = 4;
    expect(ropePath(hook, body)).toEqual([
      { x: 10, y: 14 },
      { x: 10, y: 10 },
    ]);
    expect(defined(hook, 'hook')).toBe(hook);
    expect(() => defined(null, 'hook')).toThrow('hook');
  });

  it('expires a stalled hook and safely releases a rope that would need too many corners', () => {
    const t = new Terrain(30, 30, 0);
    const body = createBody(10, 10, 0.6);
    expect(clearLine(t, { x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
    const stalled = shootRope(1, 10, 10, 0, 0, false);
    expect(stepRope(t, stalled, body, HOOK_MAX_TIME + 0.1, 0, 0)).toBe('missed');

    t.addDisc(10, 15, 0.5);
    t.addDisc(10, 12.5, 0.5);
    const attached = shootRope(1, 10, 15, 0, 0, true);
    attached.state = 'attached';
    attached.pivots = Array.from({ length: 8 }, (_, k) => ({ x: 10, y: 15 - k * 0.1 }));
    attached.length = 8;
    expect(stepRope(t, attached, body, 1 / 60, 0, 0)).toBe('detached');
  });

  it('holds a rope that has pulled the buddy right onto its pivot', () => {
    const t = new Terrain(30, 30, 0);
    // Rock for the anchor to hold on to, with the corner the buddy hangs from out in the air.
    t.addDisc(10, 18, 1);
    const body = createBody(10, 15, 0.6);
    const rope = shootRope(1, 10, 18, 0, 1, true);
    rope.state = 'attached';
    rope.pivots = [
      { x: 10, y: 18 },
      { x: 10, y: 15 },
    ];
    rope.length = 5;
    // The buddy is on the pivot, so there is no rope direction to work with: the solver has to
    // fall back on "straight down" instead of producing NaN.
    expect(stepRope(t, rope, body, 1e-5, 0, 0)).toBe('attached');
    expect(Number.isFinite(body.x) && Number.isFinite(body.y)).toBe(true);
    expect(Number.isFinite(body.vx) && Number.isFinite(body.vy)).toBe(true);
  });

  it('handles a sheep leaving the map and an unused weapon key', () => {
    const t = new Terrain(20, 20, 3);
    const sheep = releaseSheep(1, 1, 51, 10, 1);
    expect(stepSheep(t, sheep, 1 / 60)).toBe('out');
    expect(weaponForKey(11, true)).toBeNull();
  });

  it('removes isolated specks at every terrain edge and supplies an upward normal in empty air', () => {
    const t = new Terrain(2, 2, 0);
    expect(t.normal(1, 1)).toEqual({ x: 0, y: 1 });
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ])
      t.addDisc(x, y, 0.1);
    t.removeSpecks(2);
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ])
      expect(t.isSolid(x, y)).toBe(false);
  });

  it('does not try to carve a cave in a map too shallow to fit one', () => {
    const t = generateTerrain({ seed: 'shallow', width: 40, height: 18, waterLevel: 12 });
    expect(t.height).toBe(18);
    expect(t.solidFraction()).toBeGreaterThan(0);
  });
});

describe('marching squares contour', () => {
  it('keeps disconnected saddle corners separate', () => {
    const field = new Float32Array([1, -4, -4, 1]);
    const { triangles, edges } = contourRegion(field, 2, 0, 0, 1, 1);
    expect(triangles).toHaveLength(12);
    expect(edges).toHaveLength(8);
  });

  it('joins a saddle whose centre is rock into one patch', () => {
    // The same two opposite corners, but so much rock that the cell centre is solid.
    const field = new Float32Array([4, -1, -1, 4]);
    const { triangles, edges } = contourRegion(field, 2, 0, 0, 1, 1);
    expect(triangles.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);
    expect(triangles).not.toHaveLength(12);
  });

  it('splits a saddle that sits on the other pair of corners', () => {
    const field = new Float32Array([-4, 1, 1, -4]);
    const { triangles, edges } = contourRegion(field, 2, 0, 0, 1, 1);
    expect(triangles).toHaveLength(12);
    expect(edges).toHaveLength(8);
  });

  it('reproduces the area and perimeter of a disc', () => {
    const t = new Terrain(20, 20, 0);
    t.addDisc(10, 10, 5);
    const { triangles, edges } = contourRegion(t.field, t.nx, 0, 0, t.nx - 1, t.ny - 1);
    let area = 0;
    for (let k = 0; k < triangles.length; k += 6) {
      const [ax, ay, bx, by, cx, cy] = triangles.slice(k, k + 6);
      const signed = ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
      expect(signed).toBeGreaterThanOrEqual(-1e-9);
      area += signed;
    }
    let perimeter = 0;
    for (let k = 0; k < edges.length; k += 4) perimeter += Math.hypot(edges[k + 2] - edges[k], edges[k + 3] - edges[k + 1]);
    expect(area).toBeCloseTo(Math.PI * 25, 0);
    expect(perimeter).toBeCloseTo(2 * Math.PI * 5, 0);
  });

  it('orients edges with rock on the left', () => {
    const t = new Terrain(20, 20, 0);
    t.addDisc(10, 10, 5);
    const { edges } = contourRegion(t.field, t.nx, 0, 0, t.nx - 1, t.ny - 1);
    for (let k = 0; k < edges.length; k += 4) {
      const mx = (edges[k] + edges[k + 2]) / 2;
      const my = (edges[k + 1] + edges[k + 3]) / 2;
      const dx = edges[k + 2] - edges[k];
      const dy = edges[k + 3] - edges[k + 1];
      const len = Math.hypot(dx, dy);
      expect(t.isSolid(mx - (dy / len) * CELL, my + (dx / len) * CELL)).toBe(true);
    }
  });
});
