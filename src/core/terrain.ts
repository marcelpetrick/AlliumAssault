// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { createNoise2D } from 'simplex-noise';
import { clamp, smoothstep, type Point } from './math';
import { rngFor, shuffle, type Rng } from './rng';

/** Spacing of density-field nodes in world units. */
export const CELL = 0.25;
/** Cells per render chunk side. */
export const CHUNK_CELLS = 32;
/** Field values are clamped to ±MAX_DIST (approximate distance to the surface). */
export const MAX_DIST = 4;

/**
 * Destructible terrain as a scalar density field sampled on a regular grid.
 * value > 0 is rock, value <= 0 is air; near the surface the value approximates
 * the distance to it, which keeps craters round and collision normals smooth.
 */
export class Terrain {
  readonly nx: number;
  readonly ny: number;
  readonly field: Float32Array;
  /** 0..1 burn intensity per node, painted around craters. */
  readonly scorch: Float32Array;
  readonly chunksX: number;
  readonly chunksY: number;
  readonly dirty = new Set<number>();
  revision = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    public waterLevel: number,
  ) {
    this.nx = Math.round(width / CELL) + 1;
    this.ny = Math.round(height / CELL) + 1;
    this.field = new Float32Array(this.nx * this.ny).fill(-MAX_DIST);
    this.scorch = new Float32Array(this.nx * this.ny);
    this.chunksX = Math.ceil((this.nx - 1) / CHUNK_CELLS);
    this.chunksY = Math.ceil((this.ny - 1) / CHUNK_CELLS);
    this.markAllDirty();
  }

  /** Bilinear field sample; everything outside the grid is air. */
  sample(x: number, y: number): number {
    return this.bilinear(this.field, x, y, -MAX_DIST);
  }

  scorchAt(x: number, y: number): number {
    return this.bilinear(this.scorch, x, y, 0);
  }

  private bilinear(f: Float32Array, x: number, y: number, outside: number): number {
    const fx = x / CELL;
    const fy = y / CELL;
    if (!(fx >= 0 && fy >= 0 && fx < this.nx - 1 && fy < this.ny - 1)) return outside;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const k = j * this.nx + i;
    const a = f[k];
    const b = f[k + 1];
    const c = f[k + this.nx];
    const d = f[k + this.nx + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }

  isSolid(x: number, y: number): boolean {
    return this.sample(x, y) > 0;
  }

  gradient(x: number, y: number): Point {
    const h = CELL * 0.5;
    return {
      x: (this.sample(x + h, y) - this.sample(x - h, y)) / (2 * h),
      y: (this.sample(x, y + h) - this.sample(x, y - h)) / (2 * h),
    };
  }

  /** Unit normal pointing out of the rock (towards air). */
  normal(x: number, y: number): Point {
    const g = this.gradient(x, y);
    const len = Math.hypot(g.x, g.y);
    return len < 1e-5 ? { x: 0, y: 1 } : { x: -g.x / len, y: -g.y / len };
  }

  /** Approximate signed distance to the surface: positive in air, negative in rock. */
  distance(x: number, y: number): number {
    const v = this.sample(x, y);
    const g = this.gradient(x, y);
    return -v / Math.max(Math.hypot(g.x, g.y), 0.35);
  }

  /** Remove a disc of terrain and scorch its rim. */
  carve(cx: number, cy: number, radius: number): void {
    const burn = 1.6;
    const reach = radius + MAX_DIST;
    this.forNodes(cx - reach, cy - reach, cx + reach, cy + reach, (k, x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      const cut = d - radius;
      if (cut < this.field[k]) this.field[k] = cut;
      if (d < radius + burn) {
        this.scorch[k] = Math.max(this.scorch[k], clamp(1 - (d - radius) / burn, 0, 1));
      }
    });
    this.markDirtyRect(cx - reach, cy - reach, cx + reach, cy + reach);
    this.revision++;
  }

  /** Add a disc of terrain (used by generation and tests). */
  addDisc(cx: number, cy: number, radius: number): void {
    const reach = radius + MAX_DIST;
    this.forNodes(cx - reach, cy - reach, cx + reach, cy + reach, (k, x, y) => {
      const v = radius - Math.hypot(x - cx, y - cy);
      if (v > this.field[k]) this.field[k] = Math.min(v, MAX_DIST);
    });
    this.markDirtyRect(cx - reach, cy - reach, cx + reach, cy + reach);
    this.revision++;
  }

  /** Overwrite every node from a function of world position. */
  fill(fn: (x: number, y: number) => number): void {
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        this.field[j * this.nx + i] = clamp(fn(i * CELL, j * CELL), -MAX_DIST, MAX_DIST);
      }
    }
    this.markAllDirty();
    this.revision++;
  }

  forNodes(x0: number, y0: number, x1: number, y1: number, fn: (k: number, x: number, y: number) => void): void {
    const i0 = clamp(Math.floor(x0 / CELL), 0, this.nx - 1);
    const i1 = clamp(Math.ceil(x1 / CELL), 0, this.nx - 1);
    const j0 = clamp(Math.floor(y0 / CELL), 0, this.ny - 1);
    const j1 = clamp(Math.ceil(y1 / CELL), 0, this.ny - 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) fn(j * this.nx + i, i * CELL, j * CELL);
    }
  }

  solidFraction(): number {
    let solid = 0;
    for (const v of this.field) if (v > 0) solid++;
    return solid / this.field.length;
  }

  markAllDirty(): void {
    for (let c = 0; c < this.chunksX * this.chunksY; c++) this.dirty.add(c);
  }

  private markDirtyRect(x0: number, y0: number, x1: number, y1: number): void {
    const cx0 = clamp(Math.floor((x0 / CELL - 1) / CHUNK_CELLS), 0, this.chunksX - 1);
    const cx1 = clamp(Math.floor((x1 / CELL + 1) / CHUNK_CELLS), 0, this.chunksX - 1);
    const cy0 = clamp(Math.floor((y0 / CELL - 1) / CHUNK_CELLS), 0, this.chunksY - 1);
    const cy1 = clamp(Math.floor((y1 / CELL + 1) / CHUNK_CELLS), 0, this.chunksY - 1);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) this.dirty.add(cy * this.chunksX + cx);
    }
  }

  /** Delete rock fragments smaller than `minNodes` connected nodes. */
  removeSpecks(minNodes: number): void {
    const { nx, ny, field } = this;
    const seen = new Uint8Array(field.length);
    const stack: number[] = [];
    const component: number[] = [];
    for (let start = 0; start < field.length; start++) {
      if (seen[start] || field[start] <= 0) continue;
      component.length = 0;
      stack.push(start);
      seen[start] = 1;
      for (let k = stack.pop(); k !== undefined; k = stack.pop()) {
        component.push(k);
        const i = k % nx;
        const neighbours = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k < nx * (ny - 1) ? k + nx : -1];
        for (const n of neighbours) {
          if (n >= 0 && !seen[n] && field[n] > 0) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
      if (component.length < minNodes) for (const k of component) field[k] = -CELL;
    }
    this.markAllDirty();
  }
}

export interface TerrainSpec {
  seed: string;
  width: number;
  height: number;
  waterLevel: number;
}

/** Seeded island landscape: rolling hills, overhangs, caves and floating ledges. */
export function generateTerrain({ seed, width, height, waterLevel }: TerrainSpec): Terrain {
  const terrain = new Terrain(width, height, waterLevel);
  const shapeRng = rngFor(seed, 'shape');
  const hills = createNoise2D(shapeRng);
  const rock = createNoise2D(shapeRng);
  const detail = createNoise2D(shapeRng);

  const base = waterLevel + height * 0.3;
  const profile = (x: number) => base + hills(x * 0.016, 0.37) * height * 0.12 + hills(x * 0.055, 4.1) * height * 0.045 + hills(x * 0.14, 9.7) * 0.8;
  const shore = (x: number) => 2 - smoothstep(3, 16, x) - smoothstep(3, 16, width - x);

  terrain.fill((x, y) => {
    let v = profile(x) - y;
    if (v > -MAX_DIST * 2 && v < MAX_DIST * 3) v += rock(x * 0.06, y * 0.06) * 2.4 + detail(x * 0.18, y * 0.18) * 0.6;
    v -= shore(x) * 30;
    return Math.min(v, height - 3 - y);
  });

  const features = rngFor(seed, 'features');
  const caveCount = 4 + Math.floor(features() * 4);
  for (let c = 0; c < caveCount; c++) {
    const cx = 16 + features() * (width - 32);
    const top = profile(cx);
    const r = 1.8 + features() * 2.4;
    const stretch = 1 + features() * 1.3;
    const room = top - waterLevel - 9;
    if (room <= 0) continue;
    const cy = waterLevel + 4.5 + features() * room;
    stamp(terrain, cx, cy, r * stretch + 1, (x, y, v) => {
      const d = Math.hypot((x - cx) / stretch, y - cy) - r + detail(x * 0.35, y * 0.35) * 0.45;
      return Math.min(v, d);
    });
  }

  const islandCount = 2 + Math.floor(features() * 3);
  for (let c = 0; c < islandCount; c++) {
    const cx = 14 + features() * (width - 28);
    const cy = Math.min(profile(cx) + 9 + features() * 8, height - 9);
    const rx = 3.5 + features() * 5;
    const ry = 1.1 + features() * 0.8;
    stamp(terrain, cx, cy, rx + 3, (x, y, v) => {
      const sy = y < cy ? ry * 2 : ry;
      const d = (Math.hypot((x - cx) / rx, (y - cy) / sy) - 1) * Math.min(rx, sy) + detail(x * 0.3, y * 0.3) * 0.35;
      return Math.max(v, -d);
    });
  }

  terrain.removeSpecks(80);
  terrain.revision++;
  return terrain;
}

function stamp(t: Terrain, cx: number, cy: number, reach: number, fn: (x: number, y: number, v: number) => number): void {
  const r = reach + MAX_DIST;
  t.forNodes(cx - r, cy - r, cx + r, cy + r, (k, x, y) => {
    t.field[k] = clamp(fn(x, y, t.field[k]), -MAX_DIST, MAX_DIST);
  });
}

/** Standing positions (body centres) on flat-enough, open ground above the water. */
export function findSpawnCandidates(t: Terrain, radius: number): Point[] {
  const out: Point[] = [];
  for (let x = 6; x <= t.width - 6; x += 0.75) {
    for (let y = t.height - 2; y > t.waterLevel + 2.5; y -= CELL) {
      const above = t.sample(x, y);
      const below = t.sample(x, y - CELL);
      if (above > 0 || below <= 0) continue;
      const sy = y - CELL + CELL * (below / (below - above));
      const n = t.normal(x, sy);
      const py = sy + radius + 0.05;
      const open = t.distance(x, py) > radius * 0.8 && t.sample(x, sy + 3) < 0 && t.sample(x - 1, py + 0.4) < 0 && t.sample(x + 1, py + 0.4) < 0;
      if (n.y > 0.8 && open) out.push({ x, y: py });
    }
  }
  return out;
}

/** Choose well-separated spawns, relaxing the separation when the map is crowded. */
export function pickSpawns(candidates: readonly Point[], count: number, rng: Rng, minSeparation = 7): Point[] {
  const pool = shuffle(candidates, rng);
  let chosen: Point[] = [];
  for (let sep = minSeparation; sep >= 1.5; sep -= 1) {
    chosen = [];
    for (const c of pool) {
      if (chosen.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= sep)) chosen.push(c);
      if (chosen.length === count) return chosen;
    }
  }
  return chosen;
}
