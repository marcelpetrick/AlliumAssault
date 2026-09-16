// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Terrain } from './terrain';

/** A burning patch of ground left by napalm. */
export interface Flame {
  id: number;
  x: number;
  y: number;
  /** Seconds left before it burns out. */
  life: number;
}

/** Horizontal spacing of the flames a napalm canister spreads. */
const FLAME_SPACING = 0.8;
/** How far above and below the impact the ground is searched for a surface to burn on. */
const SURFACE_SEARCH = 4;

/**
 * Surface point to burn on near (x, y): the first rock below a point slightly above the impact.
 * Null when there is no ground nearby or it lies under water — water puts napalm out.
 */
export function burnSpot(t: Terrain, x: number, y: number): { x: number; y: number } | null {
  if (x < 0 || x > t.width) return null;
  for (let sy = y + SURFACE_SEARCH * 0.5; sy > y - SURFACE_SEARCH; sy -= 0.1) {
    if (t.isSolid(x, sy)) return sy <= t.waterLevel + 0.1 ? null : { x, y: sy + 0.1 };
  }
  return null;
}

/** Flames spread sideways around an impact, each burning for `duration` plus a little variation. */
export function spreadFlames(t: Terrain, x: number, y: number, count: number, duration: number, nextId: () => number): Flame[] {
  const flames: Flame[] = [];
  for (let k = 0; k < count; k++) {
    const spot = burnSpot(t, x + (k - (count - 1) / 2) * FLAME_SPACING, y);
    if (spot) flames.push({ id: nextId(), x: spot.x, y: spot.y, life: duration * (0.75 + 0.25 * (((k * 5) % count) / count)) });
  }
  return flames;
}
