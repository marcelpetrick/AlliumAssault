import type { Terrain } from './terrain';

/** Flight speed of the flying sheep, units per second. */
export const FLYER_SPEED = 13;
/** Steering rate, radians per second. */
export const FLYER_TURN_RATE = 2.8;
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

/**
 * Advance a flyer: turn by `steer` (-1 clockwise … 1 counter-clockwise) and move forward, stopping
 * at the first contact with rock or with something `hits` reports.
 */
export function stepFlyer(t: Terrain, f: Flyer, dt: number, steer: number, hits: (x: number, y: number) => boolean): FlyerStep {
  f.age += dt;
  f.angle += steer * FLYER_TURN_RATE * dt;
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
