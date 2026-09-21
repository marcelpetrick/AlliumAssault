// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * What a match is made of: its configuration, the things in it, the phases it runs through and the
 * events it reports. Split out of `game.ts`, which is the state machine that operates on them —
 * `game.ts` re-exports everything here, so this file is an organising move, not a new API.
 */

import type { Body } from './physics';
import type { Point } from './math';
import type { Flyer } from './flyer';
import type { Rope } from './rope';
import type { Sheep } from './sheep';
import type { Terrain } from './terrain';
import { WEAPON_ORDER, WEAPONS, type WeaponDef, type WeaponId, type WeaponKind } from './weapons';

export type Controller = 'human' | 'ai';
export type Arsenal = 'all' | 'crates' | 'infinite';
export type AiLevel = 'easy' | 'normal' | 'hard';

export interface TeamConfig {
  name: string;
  color: string;
  controller: Controller;
  aiLevel: AiLevel;
  buddyNames: string[];
}

export interface MatchConfig {
  seed: string;
  teams: TeamConfig[];
  turnTime: number;
  retreatTime: number;
  /** Maximum wind strength, 0..1. */
  windMax: number;
  /**
   * Crates per turn: below 1 the chance of one crate teleporting in, from 1 upwards that many
   * crates every turn ("crate craziness"). Missing means no crates.
   */
  crates?: number;
  /**
   * 'all': every weapon with its normal ammo (default); 'crates': special weapons only come from
   * crates; 'infinite': unlimited ammo for every weapon.
   */
  arsenal?: Arsenal;
  /**
   * Turn on which Sudden Death strikes and drops every living buddy to 1 HP; 0 or missing turns it
   * off. Counted in buddy turns, the same unit the victory screen reports.
   */
  suddenDeath?: number;
  /** The arena's pull as a multiple of the standard one; missing or 1 is the ordinary world. */
  gravity?: number;
  theme: string;
}

export interface GameOverrides {
  terrain?: Terrain;
  spawns?: Point[];
}

/**
 * `guiding`: a released sheep is hopping or flying; the turn timer runs and Space detonates it.
 * `torching`: the active buddy walks forward burning a tunnel; no other input.
 * `drilling`: the active buddy drills straight down; no other input, no fall damage.
 * `firing`: a burst weapon is rattling off its bullets; no other input.
 */
export type Phase =
  'turnStart' | 'aiming' | 'guiding' | 'torching' | 'drilling' | 'roping' | 'firing' | 'panicking' | 'retreat' | 'settling' | 'deaths' | 'gameOver';

/** Phases in which the turn timer counts down. */
export const COUNTDOWN_PHASES: readonly Phase[] = ['aiming', 'guiding', 'torching', 'drilling', 'roping'];
/** Seconds a buddy panics with its thumb on the detonator before the blast. */
export const PANIC_TIME = 3;
/** Weapons pointed with the mouse: they are used by clicking the map, never with the fire button. */
export const MAP_WEAPONS: readonly WeaponKind[] = ['strike', 'platform', 'teleport'];

/** Phases in which the active team is still playing its turn, so hurting its buddy ends it. */
export const ACTION_PHASES: readonly Phase[] = ['aiming', 'guiding', 'torching', 'drilling', 'roping', 'firing', 'panicking', 'retreat'];

export interface Buddy {
  id: number;
  team: number;
  name: string;
  body: Body;
  hp: number;
  alive: boolean;
  facing: 1 | -1;
  /** Radians above the horizontal in the facing direction. */
  aim: number;
  walking: boolean;
}

/** A comic tombstone marking where a buddy died; a loose physics body like a crate. */
export interface Grave {
  id: number;
  buddy: number;
  team: number;
  name: string;
  body: Body;
}

export interface Team {
  index: number;
  config: TeamConfig;
  buddies: Buddy[];
  cursor: number;
  ammo: Record<WeaponId, number>;
  /** Weapon this team last selected; restored at the start of its turns. */
  weapon: WeaponId;
}

export interface Projectile {
  id: number;
  weapon: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounces: number;
  fuse: number;
  age: number;
  owner: number;
  /** Seconds spent (almost) motionless, for weapons that detonate after coming to rest. */
  rest?: number;
  /** A rest-fuse weapon has come to rest and its fuse is counting down. */
  armed?: boolean;
}

export type GameEvent =
  | { type: 'turnStart'; team: number; buddy: number }
  | { type: 'weapon'; weapon: WeaponId }
  | { type: 'fire'; weapon: WeaponId; x: number; y: number; dx: number; dy: number; power: number }
  | { type: 'explosion'; x: number; y: number; radius: number }
  | { type: 'shot'; weapon: WeaponId; x0: number; y0: number; x1: number; y1: number }
  | { type: 'punch'; weapon: WeaponId; buddy: number; x: number; y: number; dx: number; dy: number }
  | { type: 'damage'; buddy: number; amount: number }
  | { type: 'death'; buddy: number }
  | { type: 'grave'; grave: number; buddy: number; x: number; y: number }
  | { type: 'drown'; buddy: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'jump'; buddy: number }
  | { type: 'land'; buddy: number; speed: number }
  | { type: 'bounce'; x: number; y: number; speed: number }
  | { type: 'sheepHop'; x: number; y: number }
  | { type: 'hallelujah'; x: number; y: number }
  | { type: 'ignite'; x: number; y: number; flames: number }
  | { type: 'scorch'; buddy: number; x: number; y: number }
  | { type: 'ropeShot'; buddy: number; x: number; y: number }
  | { type: 'ropeBite'; buddy: number; x: number; y: number }
  | { type: 'ropeRelease'; buddy: number }
  | { type: 'mineLaid'; mine: number; buddy: number; x: number; y: number }
  | { type: 'mineArmed'; mine: number; x: number; y: number }
  | { type: 'mineTriggered'; mine: number; x: number; y: number }
  | { type: 'crateSpawn'; crate: number; x: number; y: number }
  | { type: 'cratePickup'; crate: number; buddy: number; kind: 'health' | 'weapon'; weapon: WeaponId | null; amount: number; x: number; y: number }
  | { type: 'airstrike'; weapon: WeaponId; plane: boolean; target: number; ground: number; dir: 1 | -1; altitude: number; startX: number; speed: number }
  | { type: 'suddenDeath'; turn: number }
  | { type: 'panic'; buddy: number; seconds: number }
  | { type: 'waterRise'; level: number; x: number }
  | { type: 'platformPlaced'; weapon: WeaponId; x: number; y: number; angle: number }
  | { type: 'teleport'; weapon: WeaponId; buddy: number; fromX: number; fromY: number; x: number; y: number }
  | { type: 'gameOver'; winner: number | null };

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** Ammo a team starts with for `id` under the given arsenal setting. */
export function startingAmmo(arsenal: Arsenal | undefined, id: WeaponId): number {
  const def = WEAPONS[id];
  if (!WEAPON_ORDER.includes(id)) return def.ammo;
  if (arsenal === 'infinite') return Infinity;
  if (arsenal === 'crates' && def.special) return 0;
  return def.ammo;
}

/** Blast of a self-destructing buddy with `hp` health; scales the weapon's 100 HP values. */
export function selfDestructBlast(def: WeaponDef, hp: number): { radius: number; damage: number; force: number } {
  const k = Math.max(hp, 0) / 100;
  return { radius: Math.max(1.5, def.radius * k), damage: Math.round(def.damage * k), force: def.force * Math.max(k, 0.3) };
}

/** A rest-fuse projectile slower than this for REST_TIME seconds counts as resting. */
export const REST_SPEED = 0.6;
export const REST_TIME = 0.3;
/** Rest-fuse projectiles arm after this long even if they never settle. */
export const REST_MAX_WAIT = 10;

/** Upward speed a smashing projectile rebounds with after each impact. */
export const SMASH_REBOUND = 6;

/** Tombstone collision radius and the upward pop it appears with. */
export const GRAVE_RADIUS = 0.45;
export const GRAVE_POP = 6;

/** Health every living buddy is left with when Sudden Death strikes. */
export const SUDDEN_DEATH_HP = 1;

/** Napalm flames: reach from a flame to a buddy's feet, the hop they cause, its damage and cooldown. */
export const FLAME_REACH = 0.8;
export const FLAME_FALL_SPEED = 8;
export const SCORCH_HOP = { vx: 4, vy: 9 };
export const SCORCH_DAMAGE = 3;
export const SCORCH_COOLDOWN = 0.6;

/** Seconds between two shaft carves of the drill, and how far below the feet each one bites. */
export const DRILL_CARVE_INTERVAL = 0.12;
export const DRILL_BITE = 0.35;

/** Seconds between two tunnel carves of the blowtorch. */
export const TORCH_CARVE_INTERVAL = 0.08;

/** Lowest launch angle of a swing, radians above horizontal. */
export const MIN_SWING_ANGLE = 0.35;

/** Velocity a melee hit gives its victim. */
export function meleeLaunch(def: WeaponDef, facing: 1 | -1, dir: Point): Point {
  if (def.knock === 'swing') {
    // Always a lofted drive: swinging down into the ground would just stop the victim.
    const angle = Math.max(Math.atan2(dir.y, Math.abs(dir.x)), MIN_SWING_ANGLE);
    return { x: facing * Math.cos(angle) * def.force, y: Math.sin(angle) * def.force };
  }
  return { x: facing * def.force * 0.45, y: def.force };
}

/** Blowtorch in use: the burn line, seconds left and buddies already burnt this use. */
export interface TorchAction {
  kind: 'torch';
  /** Unit vector along which the flame cuts; fixed when the torch is lit. */
  dx: number;
  dy: number;
  left: number;
  carveIn: number;
  burnt: number[];
}

/** Drill in use: seconds left and buddies already hit this use. */
export interface DrillAction {
  kind: 'drill';
  left: number;
  carveIn: number;
  hit: number[];
}

/**
 * A buddy that has pressed its own detonator: it panics for a few seconds while a countdown runs
 * over its head, then goes off. Straight out of Lemmings, where "Oh no!" was the last thing a
 * lemming said before it took the wall with it.
 */
export interface PanicAction {
  kind: 'panic';
  buddy: number;
  left: number;
  /** Whole seconds already announced, so each tick is emitted once. */
  ticked: number;
}

/** Burst weapon firing: bullets left and seconds until the next one. */
export interface BurstAction {
  kind: 'burst';
  weapon: WeaponId;
  left: number;
  next: number;
}

/** What a used weapon is doing over time; the game runs at most one. */
export type TurnAction =
  | { kind: 'sheep'; sheep: Sheep }
  | { kind: 'flyer'; flyer: Flyer }
  | { kind: 'rope'; rope: Rope | null; paid: boolean }
  | TorchAction
  | DrillAction
  | BurstAction
  | PanicAction;
