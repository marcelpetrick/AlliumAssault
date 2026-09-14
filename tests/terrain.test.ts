import { describe, expect, it } from 'vitest';
import { contourRegion } from '../src/core/contour';
import { mulberry32, hashString } from '../src/core/rng';
import { CELL, findSpawnCandidates, generateTerrain, pickSpawns, Terrain } from '../src/core/terrain';

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

describe('marching squares contour', () => {
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
