// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { createBody, stepBody, stepProjectile } from '../src/core/physics';
import { Terrain } from '../src/core/terrain';
import { flatTerrain } from './helpers';

const run = (seconds: number, fn: () => void) => {
  for (let s = 0; s < seconds * 60; s++) fn();
};

describe('character body', () => {
  it('falls onto flat ground and comes to rest on it', () => {
    const t = flatTerrain(20);
    const b = createBody(50, 30, 0.6);
    run(3, () => stepBody(t, b, 1 / 60, null));
    expect(b.grounded).toBe(true);
    expect(b.y).toBeCloseTo(20.6, 1);
    expect(b.restTime).toBeGreaterThan(1);
  });

  it('falls when a crater removes the ground below without touching the body', () => {
    for (const craterY of [17.2, 17.5, 17.8]) {
      const t = flatTerrain(20);
      const b = createBody(50, 20.6, 0.6);
      run(1, () => stepBody(t, b, 1 / 60, null));
      expect(b.grounded).toBe(true);
      t.carve(50, craterY, 2.8);
      run(1.5, () => stepBody(t, b, 1 / 60, null));
      expect(b.y).toBeLessThan(18);
    }
  });

  it('walks horizontally along flat ground', () => {
    const t = flatTerrain(20);
    const b = createBody(50, 20.6, 0.6);
    run(0.5, () => stepBody(t, b, 1 / 60, null));
    run(1, () => stepBody(t, b, 1 / 60, 3));
    expect(b.x).toBeGreaterThan(52.5);
    expect(b.y).toBeCloseTo(20.6, 1);
  });

  it('climbs a gentle slope and is stopped by a wall', () => {
    const slope = new Terrain(60, 40, 1);
    slope.fill((x, y) => 10 + Math.max(0, x - 20) * 0.5 - y);
    const b = createBody(15, 10.6, 0.6);
    run(0.5, () => stepBody(slope, b, 1 / 60, null));
    run(3, () => stepBody(slope, b, 1 / 60, 3));
    expect(b.y).toBeGreaterThan(12);

    const wall = new Terrain(60, 40, 1);
    wall.fill((x, y) => Math.max(10 - y, x - 30));
    const w = createBody(25, 10.6, 0.6);
    run(0.5, () => stepBody(wall, w, 1 / 60, null));
    run(4, () => stepBody(wall, w, 1 / 60, 3));
    expect(w.x).toBeLessThan(30);
  });

  it('reports a hard impact after a long fall', () => {
    const t = flatTerrain(10);
    const b = createBody(50, 40, 0.6);
    let maxImpact = 0;
    run(3, () => {
      stepBody(t, b, 1 / 60, null);
      maxImpact = Math.max(maxImpact, b.impact);
    });
    expect(maxImpact).toBeGreaterThan(20);
  });
});

describe('projectiles', () => {
  it('stops at a thin wall even at high speed', () => {
    const t = new Terrain(60, 40, 1);
    t.fill((x) => 0.3 - Math.abs(x - 30));
    const p = { x: 10, y: 20, vx: 80, vy: 0, radius: 0.15, bounces: 0 };
    let hit = 'none';
    run(1, () => {
      if (hit === 'none') hit = stepProjectile(t, p, 1 / 60, 0, 0, null);
    });
    expect(hit).toBe('terrain');
    expect(p.x).toBeLessThan(30);
    expect(p.x).toBeGreaterThan(29);
  });

  it('bounces and comes to rest when it has restitution', () => {
    const t = flatTerrain(20);
    const p = { x: 50, y: 30, vx: 5, vy: 0, radius: 0.15, bounces: 0 };
    run(6, () => stepProjectile(t, p, 1 / 60, 0, -25, 0.45));
    expect(p.bounces).toBeGreaterThan(0);
    expect(Math.hypot(p.vx, p.vy)).toBeLessThan(1);
    expect(p.y).toBeGreaterThan(19.8);
  });

  it('is pushed by wind', () => {
    const t = flatTerrain(5);
    const calm = { x: 50, y: 40, vx: 0, vy: 0, radius: 0.15, bounces: 0 };
    const windy = { ...calm };
    run(1, () => {
      stepProjectile(t, calm, 1 / 60, 0, -10, null);
      stepProjectile(t, windy, 1 / 60, 8, -10, null);
    });
    expect(windy.x - calm.x).toBeGreaterThan(3);
  });
});
