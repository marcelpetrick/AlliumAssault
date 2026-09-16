// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Terrain } from './terrain';

/** Flight speed of the flying sheep, units per second: slow enough to steer around obstacles. */
export const FLYER_SPEED = 9;
/** Steering rate, radians per second. */
export const FLYER_TURN_RATE = 3.2;
/** Distance covered per collision sub-step. */
const SUB_STEP = 0.1;

export interface Flyer {
  id: number;
  owner: number;
  x: number;
  y: number;
  /** Flight direction in radians (0 = right, π/2 = up). */
  angle: number;
  age: number;
}

export type FlyerStep = 'none' | 'hit' | 'water' | 'out';

/** Screen-relative steering from arrow keys: each axis -1, 0 or 1 (x right, y up). */
export interface Steer {
  x: number;
  y: number;
}

/**
 * Advance a flyer: turn towards the `steer` direction (if any) at the turn rate and move forward,
 * stopping at the first contact with rock or with something `hits` reports.
 */
export function stepFlyer(t: Terrain, f: Flyer, dt: number, steer: Steer, hits: (x: number, y: number) => boolean): FlyerStep {
  f.age += dt;
  if (steer.x !== 0 || steer.y !== 0) {
    const wanted = Math.atan2(steer.y, steer.x);
    const diff = Math.atan2(Math.sin(wanted - f.angle), Math.cos(wanted - f.angle));
    const turn = FLYER_TURN_RATE * dt;
    f.angle += Math.max(-turn, Math.min(turn, diff));
  }
  const distance = FLYER_SPEED * dt;
  const steps = Math.max(1, Math.ceil(distance / SUB_STEP));
  for (let s = 0; s < steps; s++) {
    f.x += (Math.cos(f.angle) * distance) / steps;
    f.y += (Math.sin(f.angle) * distance) / steps;
    if (t.isSolid(f.x, f.y) || hits(f.x, f.y)) return 'hit';
    if (f.y < t.waterLevel) return 'water';
    if (f.x < -30 || f.x > t.width + 30 || f.y > t.height + 40) return 'out';
  }
  return 'none';
}
