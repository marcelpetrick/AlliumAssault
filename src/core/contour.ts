// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { CELL } from './terrain';

export interface ContourGeometry {
  /** Solid-area triangles as flat [x0,y0,x1,y1,x2,y2, ...], counter-clockwise. */
  triangles: number[];
  /** Surface segments as flat [ax,ay,bx,by, ...]; rock lies to the left of a→b. */
  edges: number[];
}

interface RingPoint {
  x: number;
  y: number;
  crossing: boolean;
}

/**
 * Marching squares over the node rectangle [i0..i1] × [j0..j1] of a density field.
 * Produces filled polygons and oriented boundary segments with linear interpolation,
 * so the contour is smooth and identical along shared chunk borders.
 */
export function contourRegion(field: Float32Array, nx: number, i0: number, j0: number, i1: number, j1: number): ContourGeometry {
  const triangles: number[] = [];
  const edges: number[] = [];
  const cx = [0, 1, 1, 0];
  const cy = [0, 0, 1, 1];
  const values = [0, 0, 0, 0];

  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const k = j * nx + i;
      values[0] = field[k];
      values[1] = field[k + 1];
      values[2] = field[k + nx + 1];
      values[3] = field[k + nx];
      const inside = values.map((v) => v > 0);
      const count = inside.filter(Boolean).length;
      if (count === 0) continue;
      const x0 = i * CELL;
      const y0 = j * CELL;
      if (count === 4) {
        triangles.push(x0, y0, x0 + CELL, y0, x0 + CELL, y0 + CELL, x0, y0, x0 + CELL, y0 + CELL, x0, y0 + CELL);
        continue;
      }

      const ring: RingPoint[] = [];
      for (let c = 0; c < 4; c++) {
        const n = (c + 1) % 4;
        if (inside[c]) ring.push({ x: x0 + cx[c] * CELL, y: y0 + cy[c] * CELL, crossing: false });
        if (inside[c] !== inside[n]) {
          const t = values[c] / (values[c] - values[n]);
          ring.push({
            x: x0 + (cx[c] + (cx[n] - cx[c]) * t) * CELL,
            y: y0 + (cy[c] + (cy[n] - cy[c]) * t) * CELL,
            crossing: true,
          });
        }
      }

      const saddle = count === 2 && inside[0] === inside[2];
      const centre = (values[0] + values[1] + values[2] + values[3]) / 4;
      if (saddle && centre <= 0) {
        // Two separate corners: split the hexagon into the two corner triangles.
        const start = inside[0] ? 0 : 1;
        emit([ring[(start + 5) % 6], ring[start], ring[start + 1]], triangles, edges);
        emit([ring[start + 2], ring[start + 3], ring[start + 4]], triangles, edges);
      } else {
        emit(ring, triangles, edges);
      }
    }
  }
  return { triangles, edges };
}

function emit(ring: RingPoint[], triangles: number[], edges: number[]): void {
  for (let r = 1; r < ring.length - 1; r++) {
    triangles.push(ring[0].x, ring[0].y, ring[r].x, ring[r].y, ring[r + 1].x, ring[r + 1].y);
  }
  for (let r = 0; r < ring.length; r++) {
    const a = ring[r];
    const b = ring[(r + 1) % ring.length];
    if (a.crossing && b.crossing && Math.hypot(b.x - a.x, b.y - a.y) > 1e-6) edges.push(a.x, a.y, b.x, b.y);
  }
}
