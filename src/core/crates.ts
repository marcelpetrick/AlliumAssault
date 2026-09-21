// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { createBody, type Body } from './physics';
import type { Rng } from './rng';
import { findSpawnCandidates, type Terrain } from './terrain';
import { SPECIAL_WEAPONS, type WeaponId } from './weapons';

export const CRATE_RADIUS = 0.45;
export const MAX_CRATES = 4;
/**
 * Crates a turn brings, from the match setting: below 1 it is the chance of a single crate, from 1
 * upwards it is a guaranteed number of them ("crate craziness").
 */
export function cratesPerTurn(rate: number, roll: () => number): number {
  if (rate <= 0) return 0;
  if (rate >= 1) return Math.floor(rate);
  return roll() < rate ? 1 : 0;
}

/**
 * How many crates may lie on the map at once: four per crate a turn brings, so "crate craziness"
 * really fills the island while the ordinary settings keep the map tidy.
 */
export function crateLimit(rate: number): number {
  return MAX_CRATES * Math.max(1, Math.floor(rate));
}
export const CRATE_HEAL = 25;
/** Crate chance used when special weapons can only come from crates but none was configured. */
export const DEFAULT_CRATE_CHANCE = 0.35;
/** Weapons a weapon crate can contain: every special weapon. */
export const CRATE_WEAPONS: readonly WeaponId[] = SPECIAL_WEAPONS;
/** Share of crates that are health crates, and of the rest, the share that are mystery boxes. */
const HEALTH_SHARE = 0.4;
const MYSTERY_SHARE = 0.25;
/**
 * What a mystery box turns out to hold, once somebody is rash enough to open it. The odds are
 * deliberately in the player's favour: three quarters of the time it is worth having, and the
 * quarter that is not is what makes the other three interesting.
 */
export const MYSTERY_ODDS = { health: 0.35, weapon: 0.4, mine: 0.25 };
/** Crates do not appear right next to a buddy. */
const MIN_BUDDY_DISTANCE = 3;
/** A crate caught in an explosion blows up with this blast. */
export const CRATE_BLAST = { radius: 1.8, damage: 10, force: 6 };
/**
 * And leaves its contents burning: a couple of flames for a couple of seconds, so the spot is
 * worth stepping around on the way past without being a napalm strike in disguise.
 */
export const CRATE_FIRE = { flames: 3, duration: 2.5 };

/**
 * `mystery` is a clown box with a question mark on its side: what is in it is rolled when it is
 * opened, not when it drops, so nothing about the box on the map gives the answer away.
 */
export type CrateKind = 'health' | 'weapon' | 'mystery';

/** What a mystery box turned out to be. */
export type MysteryPrize = { kind: 'health' } | { kind: 'weapon'; weapon: WeaponId } | { kind: 'mine' };

export interface Crate {
  id: number;
  kind: CrateKind;
  /** Weapon crates only. */
  weapon: WeaponId | null;
  body: Body;
}

/**
 * Open a mystery box. Rolled at the moment of opening, from the match's own crate stream, so the
 * same seed plays out the same way twice and no amount of looking at the box helps.
 */
export function openMystery(rng: Rng): MysteryPrize {
  const roll = rng();
  if (roll < MYSTERY_ODDS.health) return { kind: 'health' };
  if (roll < MYSTERY_ODDS.health + MYSTERY_ODDS.weapon) {
    return { kind: 'weapon', weapon: CRATE_WEAPONS[Math.floor(rng() * CRATE_WEAPONS.length)] };
  }
  return { kind: 'mine' };
}

/** Pick contents and a free land spot for a new crate, or null when there is no room. */
export function rollCrate(t: Terrain, rng: Rng, id: number, occupied: readonly { x: number; y: number }[]): Crate | null {
  const spots = findSpawnCandidates(t, CRATE_RADIUS).filter((p) => occupied.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= MIN_BUDDY_DISTANCE));
  if (!spots.length) return null;
  const spot = spots[Math.floor(rng() * spots.length)];
  const body = createBody(spot.x, spot.y, CRATE_RADIUS);
  if (rng() < HEALTH_SHARE) return { id, kind: 'health', weapon: null, body };
  // A mystery box has no contents yet: they are rolled when somebody opens it.
  if (rng() < MYSTERY_SHARE) return { id, kind: 'mystery', weapon: null, body };
  return { id, kind: 'weapon', weapon: CRATE_WEAPONS[Math.floor(rng() * CRATE_WEAPONS.length)], body };
}
