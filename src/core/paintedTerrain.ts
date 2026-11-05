// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { WORLD_HEIGHT, WORLD_WIDTH, WATER_LEVEL, BUDDY_RADIUS } from './constants';
import { Terrain, findSpawnCandidates, pickSpawns } from './terrain';
import { rngFor } from './rng';

/** Fixed-size mask; rows run from the top of the world to the bottom. */
export const PAINT_WIDTH = 64;
export const PAINT_HEIGHT = 32;
export const EMPTY_PAINT = '0'.repeat(PAINT_WIDTH * PAINT_HEIGHT);

export function validPaint(value: unknown): value is string {
  return typeof value === 'string' && value.length === PAINT_WIDTH * PAINT_HEIGHT && /^[01]+$/.test(value);
}

/** Bilinear interpolation rounds the hand-painted pixels into an editable density field. */
export function paintedTerrain(mask: string): Terrain {
  const t = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
  const read = (x: number, y: number) => (x >= 0 && y >= 0 && x < PAINT_WIDTH && y < PAINT_HEIGHT && mask[y * PAINT_WIDTH + x] === '1' ? 1 : 0);
  t.fill((x, y) => {
    const px = (x / WORLD_WIDTH) * PAINT_WIDTH - 0.5;
    const py = ((WORLD_HEIGHT - y) / WORLD_HEIGHT) * PAINT_HEIGHT - 0.5;
    const ix = Math.floor(px),
      iy = Math.floor(py),
      fx = px - ix,
      fy = py - iy;
    const a = read(ix, iy),
      b = read(ix + 1, iy),
      c = read(ix, iy + 1),
      d = read(ix + 1, iy + 1);
    return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy - 0.5) * 2;
  });
  return t;
}

/** Test the same spacing and clearance rules the match uses for its chosen team sizes. */
export function paintedPlayable(mask: string, count: number): boolean {
  return validPaint(mask) && pickSpawns(findSpawnCandidates(paintedTerrain(mask), BUDDY_RADIUS), count, rngFor('painted', 'spawns')).length === count;
}
