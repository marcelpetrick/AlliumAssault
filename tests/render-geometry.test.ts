// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { dryScatter, onViewRay } from '../src/render/geometry';
import { mulberry32 } from '../src/core/rng';

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
