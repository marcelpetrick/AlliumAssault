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
    run(3, () => {
      stepBody(t, b, 1 / 60, null);
    });
    expect(b.grounded).toBe(true);
    expect(b.y).toBeCloseTo(20.6, 1);
    expect(b.restTime).toBeGreaterThan(1);
  });

  it('falls when a crater removes the ground below without touching the body', () => {
    for (const craterY of [17.2, 17.5, 17.8]) {
      const t = flatTerrain(20);
      const b = createBody(50, 20.6, 0.6);
      run(1, () => {
        stepBody(t, b, 1 / 60, null);
      });
      expect(b.grounded).toBe(true);
      t.carve(50, craterY, 2.8);
      run(1.5, () => {
        stepBody(t, b, 1 / 60, null);
      });
      expect(b.y).toBeLessThan(18);
    }
  });

  it('walks horizontally along flat ground', () => {
    const t = flatTerrain(20);
    const b = createBody(50, 20.6, 0.6);
    run(0.5, () => {
      stepBody(t, b, 1 / 60, null);
    });
    run(1, () => {
      stepBody(t, b, 1 / 60, 3);
    });
    expect(b.x).toBeGreaterThan(52.5);
    expect(b.y).toBeCloseTo(20.6, 1);
  });

  it('climbs a gentle slope and is stopped by a wall', () => {
    const slope = new Terrain(60, 40, 1);
    slope.fill((x, y) => 10 + Math.max(0, x - 20) * 0.5 - y);
    const b = createBody(15, 10.6, 0.6);
    run(0.5, () => {
      stepBody(slope, b, 1 / 60, null);
    });
    run(3, () => {
      stepBody(slope, b, 1 / 60, 3);
    });
    expect(b.y).toBeGreaterThan(12);

    const wall = new Terrain(60, 40, 1);
    wall.fill((x, y) => Math.max(10 - y, x - 30));
    const w = createBody(25, 10.6, 0.6);
    run(0.5, () => {
      stepBody(wall, w, 1 / 60, null);
    });
    run(4, () => {
      stepBody(wall, w, 1 / 60, 3);
    });
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

  it('settles on a slope instead of standing still with speed left over', () => {
    for (const slope of [0.1, 0.3, 0.6, 0.8]) {
      const t = new Terrain(128, 64, 3);
      t.fill((x, y) => (28 + slope * (x - 64) - y) / Math.hypot(1, slope));
      const p = { x: 64, y: 28 + 0.15 * Math.hypot(1, slope), vx: 0, vy: 0, radius: 0.15, bounces: 0 };
      run(3, () => stepProjectile(t, p, 1 / 60, 0, -25, 0.25));
      // The stored speed used to settle at a nonzero value while the position never moved, which
      // kept every rest-fused weapon from ever arming on a hillside.
      expect(Math.hypot(p.vx, p.vy)).toBeLessThan(0.6);
      const before = { x: p.x, y: p.y };
      run(1, () => stepProjectile(t, p, 1 / 60, 0, -25, 0.25));
      // Settled means it stays where it is: a slow creep is allowed, sitting still while carrying
      // metres per second of speed is not.
      expect(Math.hypot(p.x - before.x, p.y - before.y)).toBeLessThan(0.1);
    }
  });

  it('rolls down a slope it cannot hold on to, and its speed matches how far it travels', () => {
    const t = new Terrain(128, 64, 3);
    t.fill((x, y) => (28 + 2.5 * (x - 64) - y) / Math.hypot(1, 2.5));
    const p = { x: 64, y: 28 + 0.15 * Math.hypot(1, 2.5), vx: 0, vy: 0, radius: 0.15, bounces: 0 };
    run(2, () => stepProjectile(t, p, 1 / 60, 0, -25, 0.25));
    const before = { x: p.x, y: p.y };
    let speed = 0;
    run(1, () => {
      stepProjectile(t, p, 1 / 60, 0, -25, 0.25);
      speed = Math.hypot(p.vx, p.vy);
    });
    const travelled = Math.hypot(p.x - before.x, p.y - before.y);
    expect(p.x).toBeLessThan(before.x);
    expect(travelled).toBeGreaterThan(0.5);
    expect(travelled).toBeCloseTo(speed, 0);
  });

  it('keeps skittering along flat ground after a shallow bounce', () => {
    const t = flatTerrain(20);
    const p = { x: 30, y: 21, vx: 18, vy: -4, radius: 0.15, bounces: 0 };
    run(1, () => stepProjectile(t, p, 1 / 60, 0, -25, 0.45));
    expect(p.x).toBeGreaterThan(40);
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
