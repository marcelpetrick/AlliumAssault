import { createBody, type Body } from './physics';
import type { Rng } from './rng';
import { findSpawnCandidates, type Terrain } from './terrain';
import { SPECIAL_WEAPONS, type WeaponId } from './weapons';

export const CRATE_RADIUS = 0.45;
export const MAX_CRATES = 4;
export const CRATE_HEAL = 25;
/** Crate chance used when special weapons can only come from crates but none was configured. */
export const DEFAULT_CRATE_CHANCE = 0.35;
/** Weapons a weapon crate can contain: every special weapon. */
export const CRATE_WEAPONS: readonly WeaponId[] = SPECIAL_WEAPONS;
/** Share of crates that are health crates. */
const HEALTH_SHARE = 0.4;
/** Crates do not appear right next to a buddy. */
const MIN_BUDDY_DISTANCE = 3;
/** A crate caught in an explosion blows up with this blast. */
export const CRATE_BLAST = { radius: 1.8, damage: 10, force: 6 };

export type CrateKind = 'health' | 'weapon';

export interface Crate {
  id: number;
  kind: CrateKind;
  /** Weapon crates only. */
  weapon: WeaponId | null;
  body: Body;
}

/** Pick contents and a free land spot for a new crate, or null when there is no room. */
export function rollCrate(t: Terrain, rng: Rng, id: number, occupied: readonly { x: number; y: number }[]): Crate | null {
  const spots = findSpawnCandidates(t, CRATE_RADIUS).filter((p) => occupied.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= MIN_BUDDY_DISTANCE));
  if (!spots.length) return null;
  const spot = spots[Math.floor(rng() * spots.length)];
  const health = rng() < HEALTH_SHARE;
  const weapon = health ? null : CRATE_WEAPONS[Math.floor(rng() * CRATE_WEAPONS.length)];
  return { id, kind: health ? 'health' : 'weapon', weapon, body: createBody(spot.x, spot.y, CRATE_RADIUS) };
}
