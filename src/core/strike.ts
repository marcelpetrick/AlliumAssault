import { WIND_ACCEL, WORLD_HEIGHT } from './constants';
import { GRAVITY } from './physics';
import type { Terrain } from './terrain';
import { WEAPONS, type WeaponDef } from './weapons';

/** Plane speed in units per second. */
export const PLANE_SPEED = 26;
/** Seconds from calling the strike until the plane is over the target. */
export const PLANE_APPROACH = 1.8;
/** Bombs keep this share of the plane's speed when released. */
const BOMB_CARRY = 0.35;
const CLEARANCE = 22;
/** Plane-less strikes fall from this far above the ground, after a short delay. */
const DROP_HEIGHT = 30;
const DROP_DELAY = 0.5;

export interface StrikeDrop {
  x: number;
  /** Seconds after the strike was called. */
  delay: number;
}

export interface StrikePlan {
  target: number;
  dir: 1 | -1;
  /** Ground height below the target. */
  ground: number;
  altitude: number;
  /** Plane x position at the moment the strike is called. */
  startX: number;
  bombVx: number;
  drops: StrikeDrop[];
}

/** Height of the first rock below the sky at x, or the water surface. */
export function groundBelow(t: Terrain, x: number): number {
  for (let y = t.height; y > t.waterLevel; y -= 0.25) {
    if (t.isSolid(x, y)) return y;
  }
  return t.waterLevel;
}

/**
 * Where and when the plane releases its bombs so they land spaced around `target`, allowing for
 * the fall time, the bombs' forward speed and the wind.
 */
export function planStrike(t: Terrain, def: WeaponDef, target: number, dir: 1 | -1, wind: number): StrikePlan {
  const { count, spacing, weapon, plane } = def.strike!;
  const bomb = WEAPONS[weapon];
  const ground = groundBelow(t, target);
  if (!plane) {
    // Dropped straight down from high above the target.
    const altitude = Math.min(WORLD_HEIGHT + 10, ground + DROP_HEIGHT);
    const drops = Array.from({ length: count }, (_, k) => ({ x: target + (k - (count - 1) / 2) * spacing, delay: DROP_DELAY + k * 0.3 }));
    return { target, dir, ground, altitude, startX: target, bombVx: 0, drops };
  }
  const altitude = Math.min(WORLD_HEIGHT + 4, ground + CLEARANCE);
  const bombVx = dir * PLANE_SPEED * BOMB_CARRY;
  const ax = wind * WIND_ACCEL * bomb.windInfluence;
  const fall = Math.sqrt((2 * (altitude - ground)) / (GRAVITY * bomb.gravityScale));
  const drift = bombVx * fall + 0.5 * ax * fall * fall;
  const center = target - drift;
  const drops: StrikeDrop[] = [];
  for (let k = 0; k < count; k++) {
    const x = center + dir * (k - (count - 1) / 2) * spacing;
    drops.push({ x, delay: PLANE_APPROACH + ((x - center) * dir) / PLANE_SPEED });
  }
  return { target, dir, ground, altitude, startX: center - dir * PLANE_SPEED * PLANE_APPROACH, bombVx, drops };
}
