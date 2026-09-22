// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { dryScatter, drownedBy, gridSurface, onViewRay } from '../src/render/geometry';
import { mulberry32 } from '../src/core/rng';
import { createNoise2D } from 'simplex-noise';

/** The profile of a background hill band, as `Environment.buildHills()` builds it. */
function band(waterLevel: number, height: number) {
  return (t: number) => waterLevel - 2 + Math.sin(t * Math.PI) ** 0.8 * (height + height * 0.25);
}

describe('dryScatter', () => {
  it('takes the first candidate that clears the water', () => {
    const height = (t: number) => t * 10;
    expect(dryScatter(height, 0, 1, [0.05, 0.5, 0.9])).toBe(0.5);
  });

  it('refuses a band with no dry spot rather than returning a wet one', () => {
    expect(dryScatter(() => -5, 0, 0.6, [0.2, 0.4, 0.6])).toBeNull();
  });

  it('honours the margin, so a decoration sunk into the ground still stands clear', () => {
    const height = (t: number) => t; // 0.5 above the waterline at t = 0.5
    expect(dryScatter(height, 0, 0.2, [0.5])).toBe(0.5);
    expect(dryScatter(height, 0, 0.8, [0.5])).toBeNull();
  });

  it('never places a tree in the sea across a whole band of the real hill profile', () => {
    const waterLevel = 6;
    const height = band(waterLevel, 11);
    const rng = mulberry32(99);
    let placed = 0;
    for (let n = 0; n < 2000; n++) {
      const t = dryScatter(height, waterLevel, 0.6, [0.2 + rng() * 0.45, 0.35 + rng() * 0.3, 0.5]);
      if (t === null) continue;
      placed++;
      // The trunk is sunk 0.3 into the hill; even its base has to stay above the water.
      expect(height(t) - 0.3).toBeGreaterThan(waterLevel);
    }
    expect(placed).toBeGreaterThan(1900);
  });

  it('rejects the band edges, which is where the old scatter drowned its trees', () => {
    const waterLevel = 6;
    const height = band(waterLevel, 11);
    // t = 0.02 sits on the fade-out: the old code scattered there without asking.
    expect(height(0.02)).toBeLessThan(waterLevel);
    expect(dryScatter(height, waterLevel, 0.6, [0.02])).toBeNull();
  });
});

describe('onViewRay', () => {
  const eye = { x: 64, y: 30, z: -60 };

  it('leaves a point on the gameplay plane exactly where it was', () => {
    const p = onViewRay(eye, { x: 20, y: 5 }, 0);
    expect(p.x).toBeCloseTo(20, 10);
    expect(p.y).toBeCloseTo(5, 10);
  });

  it('pulls a marker towards the eye in step with how far forward it is drawn', () => {
    const p = onViewRay(eye, { x: 20, y: 5 }, -0.8);
    // 0.8 of the way along a 60-unit view: the marker moves 1/75th of the way to the eye.
    expect(p.x).toBeCloseTo(20 + (64 - 20) / 75, 10);
    expect(p.y).toBeCloseTo(5 + (30 - 5) / 75, 10);
  });

  it('keeps the marker on the ray, so it projects to the same pixel as the picked point', () => {
    // Anything on the ray satisfies (p - eye) parallel to (onPlane - eye); check the cross product.
    const onPlane = { x: 100, y: -12 };
    for (const z of [-0.6, -0.8, -3, 2]) {
      const p = onViewRay(eye, onPlane, z);
      const a = { x: onPlane.x - eye.x, y: onPlane.y - eye.y, z: 0 - eye.z };
      const b = { x: p.x - eye.x, y: p.y - eye.y, z: z - eye.z };
      expect(a.x * b.y - a.y * b.x).toBeCloseTo(0, 9);
      expect(a.x * b.z - a.z * b.x).toBeCloseTo(0, 9);
    }
  });

  it('does not move a marker that is nowhere near the centre of the screen any further than one at it', () => {
    const centre = onViewRay(eye, { x: eye.x, y: eye.y }, -0.8);
    expect(centre.x).toBeCloseTo(eye.x, 10);
    expect(centre.y).toBeCloseTo(eye.y, 10);
  });

  it('falls back to the plane point when the camera sits on it, rather than dividing by zero', () => {
    expect(onViewRay({ x: 0, y: 0, z: 0 }, { x: 7, y: 8 }, -1)).toEqual({ x: 7, y: 8 });
  });
});

describe('gridSurface', () => {
  const xs = [0, 10, 20];
  const ts = [0, 0.5, 1];

  it('returns the sampled value exactly on a grid point', () => {
    const at = (x: number, t: number) => x + t * 100;
    expect(gridSurface(xs, ts, at, 10, 0.5)).toBeCloseTo(60, 10);
    expect(gridSurface(xs, ts, at, 20, 1)).toBeCloseTo(120, 10);
  });

  it('interpolates linearly between them, which is what the triangles do', () => {
    const at = (x: number) => x;
    expect(gridSurface(xs, ts, at, 5, 0)).toBeCloseTo(5, 10);
    expect(gridSurface(xs, ts, at, 15, 0)).toBeCloseTo(15, 10);
  });

  it('reads below a curve that bulges between samples — the gap that floated the trees', () => {
    // sin over half a period: the chord between two samples sits under the arc.
    const at = (_x: number, t: number) => Math.sin(t * Math.PI);
    const curve = at(0, 0.25);
    const drawn = gridSurface(xs, ts, at, 0, 0.25);
    expect(drawn).toBeLessThan(curve);
    expect(curve - drawn).toBeGreaterThan(0.1);
  });

  it('clamps to the last cell rather than running off the end of the grid', () => {
    const at = (x: number) => x;
    expect(gridSurface(xs, ts, at, 20, 1)).toBeCloseTo(20, 10);
    expect(Number.isFinite(gridSurface(xs, ts, at, 0, 0))).toBe(true);
  });
});

describe('drownedBy', () => {
  it('takes everything at or under the surface, and leaves the rest standing', () => {
    expect(drownedBy([1, 3, 5, 7], 4)).toEqual([true, true, false, false]);
  });

  it('gives back nothing when the sea is below all of it', () => {
    expect(drownedBy([1, 2, 3], 0)).toEqual([false, false, false]);
  });

  it('swallows a tree standing exactly at the waterline, because that is a tree in the water', () => {
    expect(drownedBy([5], 5)).toEqual([true]);
  });

  it('follows the sea back down if it ever falls', () => {
    const bases = [2, 6];
    expect(drownedBy(bases, 4)).toEqual([true, false]);
    expect(drownedBy(bases, 1)).toEqual([false, false]);
  });
});

describe('the scattered trees, on the surface the hill is actually drawn with', () => {
  const waterLevel = 3;
  const CLEARANCE = 1.2;
  const SINK = 0.3;

  /** One hill band, exactly as Environment.buildHills builds it. */
  function band(height: number, step: number, index: number) {
    const rng = mulberry32(99);
    const noise = createNoise2D(rng);
    const xs: number[] = [];
    for (let x = 64 - 420; x <= 64 + 420; x += step) xs.push(x);
    const ts = [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1];
    const at = (x: number, t: number) => {
      const ridge = Math.sin(t * Math.PI) ** 0.8;
      const h = (noise((x * 0.012) / (index + 1), index * 10) * 0.5 + 0.5) * height + noise(x * 0.05, index * 20 + t) * height * 0.12;
      return waterLevel - 2 + ridge * (h + height * 0.25);
    };
    return { xs, ts, at, rng };
  }

  it('stands every tree on dry ground, measured against the drawn surface', () => {
    for (const [height, step, index] of [
      [11, 2.5, 0],
      [22, 4, 1],
    ] as const) {
      const { xs, ts, at, rng } = band(height, step, index);
      const surface = (x: number, t: number) => gridSurface(xs, ts, at, x, t);
      let placed = 0;
      for (let n = 0; n < 400; n++) {
        const x = xs[0] + rng() * (xs[xs.length - 1] - xs[0]);
        const t = dryScatter((a) => surface(x, a), waterLevel, CLEARANCE, [0.2 + rng() * 0.45, 0.35 + rng() * 0.3, 0.5]);
        if (t === null) continue;
        placed++;
        // The ground the player sees is clear of the sea, and so is the foot of the trunk.
        expect(surface(x, t)).toBeGreaterThan(waterLevel + CLEARANCE);
        expect(surface(x, t) - SINK).toBeGreaterThan(waterLevel);
      }
      // The check must not be so strict that the hills come out bare.
      expect(placed).toBeGreaterThan(350);
    }
  });
});
