// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

export type WeaponId =
  | 'bazooka'
  | 'grenade'
  | 'shotgun'
  | 'punch'
  | 'cluster'
  | 'bomblet'
  | 'sheep'
  | 'airstrike'
  | 'airbomb'
  | 'bat'
  | 'selfdestruct'
  | 'torch'
  | 'minigun'
  | 'holy'
  | 'banana'
  | 'bananalet'
  | 'flysheep'
  | 'mule'
  | 'mulebody'
  | 'drill'
  | 'mine'
  | 'rope'
  | 'napalm'
  | 'napalmbomb'
  | 'platform'
  | 'teleport'
  | 'ming'
  | 'shard';
export type WeaponKind =
  'projectile' | 'hitscan' | 'melee' | 'walker' | 'strike' | 'self' | 'torch' | 'flyer' | 'drill' | 'mine' | 'rope' | 'platform' | 'teleport';

/**
 * How a weapon looks and sounds. Plain keys that the renderer and the synthesizer map to models and
 * sounds, so presentation never switches on weapon ids.
 */
export interface WeaponLook {
  /** Model of the projectile in flight: rockets and bombs point along their flight, the rest tumble. */
  projectile?: 'rocket' | 'bomb' | 'grenade' | 'redGrenade' | 'holyGrenade' | 'banana' | 'smallBanana' | 'bomblet' | 'mule' | 'vase' | 'shard';
  /** Sound while in flight: rockets whistle, lobbed things whoosh. */
  flight?: 'rocket' | 'lob';
  /** Sound when the weapon is used. */
  fireSound?: 'fire' | 'throw' | 'shot' | 'spinup' | 'baa' | 'alarm' | 'clunk' | 'hookShot' | 'warp' | 'build' | 'torchLight';
  /** Sound of each hitscan bullet. */
  shotSound?: 'bullet';
  /** Sound when a melee weapon connects. */
  hitSound?: 'punch' | 'bat';
  /** A connecting swing brings the stadium with it. Presentation never switches on weapon ids. */
  homerun?: boolean;
  /** Muzzle flash when used, and on every bullet of a burst. */
  muzzle?: boolean;
  muzzleEveryShot?: boolean;
  /** The camera follows the victim's flight after a melee hit. */
  followHit?: boolean;
}

export interface WeaponDef {
  look: WeaponLook;
  id: WeaponId;
  name: string;
  icon: string;
  blurb: string;
  kind: WeaponKind;
  /** Starting ammo per team; Infinity for unlimited. */
  ammo: number;
  /** Hold Space to charge power before firing. */
  charge: boolean;
  /** Shots per use (shotgun fires twice). */
  shots: number;
  minSpeed: number;
  maxSpeed: number;
  windInfluence: number;
  gravityScale: number;
  /** null = explode on contact; otherwise bounce with this restitution. */
  restitution: number | null;
  /** Seconds until detonation; 0 = no fuse. Walkers detonate when it runs out. */
  fuse: number;
  radius: number;
  damage: number;
  force: number;
  range: number;
  /** Melee: 'uppercut' launches victims skywards, 'swing' bats them away along the aim line. */
  knock?: 'uppercut' | 'swing';
  /**
   * Special weapons can be restricted to crates by the match's arsenal setting. The basic ones —
   * bazooka, grenade, shotgun, punch, cluster bomb, baseball bat, blowtorch, drill and rope — are
   * never restricted: every team has them from turn one under every arsenal.
   */
  special?: boolean;
  /** Hitscan bursts: bullets fired one after another, `interval` seconds apart, fanning by `spread` radians. */
  burst?: { count: number; interval: number; spread: number };
  /** Upward kick a hitscan hit adds, on top of the push along the shot. */
  lift?: number;
  /** Seconds between coming to rest and detonating, for projectiles that wait until they stop. */
  restFuse?: number;
  /** Every buddy inside the blast takes the full damage instead of less towards the edge. */
  flatDamage?: boolean;
  /**
   * Strikes: bombs dropped around the clicked target, by a plane or straight from the sky. With
   * `windAimed: false` the release point ignores the wind, so the payload drifts off target.
   */
  strike?: { weapon: WeaponId; count: number; spacing: number; plane: boolean; windAimed?: boolean };
  /** Explosions that set the ground aflame: flames spread around the impact and burn for `duration` seconds. */
  napalm?: { flames: number; duration: number };
  /** Projectiles that explode on every impact and keep smashing downwards this many times. */
  impacts?: number;
  /** Fragments released when this projectile explodes. */
  cluster?: {
    weapon: WeaponId;
    count: number;
    speed: number;
    /** Extra fuse seconds per fragment, so they go off one by one. */
    stagger?: number;
  };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bazooka: {
    id: 'bazooka',
    look: { projectile: 'rocket', flight: 'rocket', fireSound: 'fire', muzzle: true },
    name: 'Bazooka',
    icon: '🚀',
    blurb: 'Hold Space to charge. Wind pushes it hard. Boom on contact.',
    kind: 'projectile',
    ammo: Infinity,
    charge: true,
    shots: 1,
    minSpeed: 10,
    maxSpeed: 42,
    windInfluence: 1,
    gravityScale: 1,
    restitution: null,
    fuse: 0,
    radius: 2.8,
    damage: 50,
    force: 15,
    range: 0,
  },
  grenade: {
    id: 'grenade',
    look: { projectile: 'grenade', flight: 'lob', fireSound: 'throw' },
    name: 'Grenade',
    icon: '💣',
    blurb: 'Bouncy throw with a 3 second fuse. Barely cares about wind.',
    kind: 'projectile',
    ammo: Infinity,
    charge: true,
    shots: 1,
    minSpeed: 6,
    maxSpeed: 30,
    windInfluence: 0.3,
    gravityScale: 1,
    restitution: 0.45,
    fuse: 3,
    radius: 2.8,
    damage: 50,
    force: 15,
    range: 0,
  },
  shotgun: {
    id: 'shotgun',
    look: { fireSound: 'shot', muzzle: true },
    name: 'Shotgun',
    icon: '💥',
    blurb: 'Two instant shots along the aim line.',
    kind: 'hitscan',
    ammo: 2,
    charge: false,
    shots: 2,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 1,
    damage: 22,
    force: 7,
    range: 32,
    lift: 3,
  },
  minigun: {
    id: 'minigun',
    look: { fireSound: 'spinup', shotSound: 'bullet', muzzle: true, muzzleEveryShot: true },
    special: true,
    name: 'Minigun',
    icon: '🔫',
    blurb: 'A long rattling burst of 14 bullets that shoves victims right across the map.',
    kind: 'hitscan',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 0.45,
    damage: 5,
    force: 3.6,
    range: 40,
    // Enough kick to keep the victim airborne, so ground friction cannot soak up the shove.
    lift: 2.2,
    burst: { count: 14, interval: 0.1, spread: 0.05 },
  },
  punch: {
    id: 'punch',
    look: { hitSound: 'punch' },
    name: 'Garlic Punch',
    icon: '👊',
    blurb: 'Close-range uppercut that launches the victim skywards.',
    kind: 'melee',
    ammo: Infinity,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 0.7,
    damage: 45,
    force: 15,
    range: 1.3,
    knock: 'uppercut',
  },
  bat: {
    id: 'bat',
    look: { hitSound: 'bat', followHit: true, homerun: true },
    name: 'Baseball Bat',
    icon: '🏏',
    blurb: 'Home run! Less damage than a punch, but swats the victim far along the aim line.',
    kind: 'melee',
    ammo: 2,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 0,
    damage: 25,
    force: 26,
    range: 1.4,
    knock: 'swing',
  },
  cluster: {
    id: 'cluster',
    look: { projectile: 'redGrenade', flight: 'lob', fireSound: 'throw' },
    name: 'Cluster Bomb',
    icon: '🧨',
    blurb: 'Red grenade with a 3 second fuse. Bursts into five bomblets of 10 damage each.',
    kind: 'projectile',
    ammo: 3,
    charge: true,
    shots: 1,
    minSpeed: 6,
    maxSpeed: 30,
    windInfluence: 0.3,
    gravityScale: 1,
    restitution: 0.45,
    fuse: 3,
    radius: 2.2,
    damage: 25,
    force: 11,
    range: 0,
    cluster: { weapon: 'bomblet', count: 5, speed: 9 },
  },
  holy: {
    id: 'holy',
    look: { projectile: 'holyGrenade', flight: 'lob', fireSound: 'throw' },
    special: true,
    name: 'Holy Garlic Grenade',
    icon: '✨',
    blurb: 'Rolls to a stop, sings Hallelujah, then erupts in an enormous blast.',
    kind: 'projectile',
    ammo: 1,
    charge: true,
    shots: 1,
    minSpeed: 6,
    maxSpeed: 28,
    windInfluence: 0.3,
    gravityScale: 1,
    restitution: 0.25,
    fuse: 0,
    restFuse: 1.6,
    radius: 7,
    damage: 100,
    force: 24,
    range: 0,
  },
  banana: {
    id: 'banana',
    look: { projectile: 'banana', flight: 'lob', fireSound: 'throw' },
    special: true,
    name: 'Banana Bomb',
    icon: '🍌',
    blurb: '3 second fuse, then five explosive bananas bounce everywhere and go off one by one.',
    kind: 'projectile',
    ammo: 1,
    charge: true,
    shots: 1,
    minSpeed: 6,
    maxSpeed: 30,
    windInfluence: 0.3,
    gravityScale: 1,
    restitution: 0.5,
    fuse: 3,
    radius: 3,
    damage: 40,
    force: 13,
    range: 0,
    cluster: { weapon: 'bananalet', count: 5, speed: 12, stagger: 0.25 },
  },
  ming: {
    id: 'ming',
    look: { projectile: 'vase', flight: 'lob', fireSound: 'throw' },
    special: true,
    name: 'Ming Vase',
    icon: '🏺',
    blurb: 'One per match. Six hundred years of porcelain, thrown once: an enormous blast and eight shards that each hit like a grenade.',
    kind: 'projectile',
    ammo: 1,
    charge: true,
    shots: 1,
    minSpeed: 6,
    maxSpeed: 28,
    windInfluence: 0.28,
    gravityScale: 1,
    restitution: 0.25,
    fuse: 2.6,
    radius: 5,
    damage: 70,
    force: 20,
    range: 0,
    cluster: { weapon: 'shard', count: 8, speed: 15, stagger: 0.18 },
  },
  shard: {
    id: 'shard',
    look: { projectile: 'shard', flight: 'lob' },
    name: 'Porcelain Shard',
    icon: '🏺',
    blurb: 'Ming vase fragment; razor-edged porcelain that goes off where it lands.',
    kind: 'projectile',
    ammo: 0,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0.22,
    gravityScale: 1,
    restitution: 0.2,
    fuse: 1.2,
    radius: 3.2,
    damage: 38,
    force: 13,
    range: 0,
  },
  bananalet: {
    id: 'bananalet',
    look: { projectile: 'smallBanana', flight: 'lob' },
    name: 'Banana',
    icon: '🍌',
    blurb: 'Banana bomb fragment; bounces, then explodes.',
    kind: 'projectile',
    ammo: 0,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0.2,
    gravityScale: 1,
    restitution: 0.5,
    fuse: 1.4,
    radius: 2.8,
    damage: 30,
    force: 11,
    range: 0,
  },
  bomblet: {
    id: 'bomblet',
    look: { projectile: 'bomblet', flight: 'lob' },
    name: 'Bomblet',
    icon: '•',
    blurb: 'Cluster fragment; explodes on contact.',
    kind: 'projectile',
    ammo: 0,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0.2,
    gravityScale: 1,
    restitution: null,
    fuse: 0,
    radius: 1.4,
    damage: 10,
    force: 6,
    range: 0,
    flatDamage: true,
  },
  sheep: {
    id: 'sheep',
    look: { fireSound: 'baa' },
    special: true,
    name: 'Sheep',
    icon: '🐑',
    blurb: 'Space lets it hop off in small leaps; press Space again to blow it up.',
    kind: 'walker',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 1,
    restitution: null,
    fuse: 10,
    radius: 4,
    damage: 75,
    force: 17,
    range: 0,
  },
  airstrike: {
    id: 'airstrike',
    look: {},
    special: true,
    name: 'Air Strike',
    icon: '✈️',
    blurb: 'Click on the map: a plane flies over and drops five bombs around that spot.',
    kind: 'strike',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 2.4,
    damage: 25,
    force: 10,
    range: 0,
    strike: { weapon: 'airbomb', count: 5, spacing: 1.7, plane: true },
  },
  mule: {
    id: 'mule',
    look: {},
    special: true,
    name: 'Concrete Mule',
    icon: '🫏',
    blurb: 'Click on the map: a giant concrete mule drops from the sky and smashes down again and again.',
    kind: 'strike',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 3.2,
    damage: 35,
    force: 14,
    range: 0,
    strike: { weapon: 'mulebody', count: 1, spacing: 0, plane: false },
  },
  mulebody: {
    id: 'mulebody',
    look: { projectile: 'mule', flight: 'rocket' },
    name: 'Concrete Mule',
    icon: '🫏',
    blurb: 'Falling concrete mule; explodes on every impact.',
    kind: 'projectile',
    ammo: 0,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 1.2,
    restitution: null,
    fuse: 0,
    radius: 3.2,
    damage: 35,
    force: 14,
    range: 0,
    impacts: 6,
  },
  napalm: {
    id: 'napalm',
    look: {},
    special: true,
    name: 'Napalm Strike',
    icon: '🌋',
    blurb: 'Click on the map: a plane drops napalm that the wind carries far; the ground burns for about nine seconds, eating into it.',
    kind: 'strike',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 1,
    damage: 3,
    force: 3,
    range: 0,
    strike: { weapon: 'napalmbomb', count: 4, spacing: 2.4, plane: true, windAimed: false },
  },
  napalmbomb: {
    id: 'napalmbomb',
    look: { projectile: 'redGrenade', flight: 'lob' },
    name: 'Napalm',
    icon: '🔥',
    blurb: 'Napalm canister; bursts into flames on contact.',
    kind: 'projectile',
    ammo: 0,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    // Light canisters: blown far by the wind and slow to fall.
    windInfluence: 1.8,
    gravityScale: 0.6,
    restitution: null,
    fuse: 0,
    // Big enough to be heard and seen bursting; the damage stays in the fire it leaves behind.
    radius: 1.3,
    damage: 5,
    force: 3,
    range: 0,
    napalm: { flames: 10, duration: 9 },
  },
  airbomb: {
    id: 'airbomb',
    look: { projectile: 'bomb', flight: 'rocket' },
    name: 'Air Bomb',
    icon: '•',
    blurb: 'Air strike bomb; explodes on contact.',
    kind: 'projectile',
    ammo: 0,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0.15,
    gravityScale: 1,
    restitution: null,
    fuse: 0,
    radius: 2.4,
    damage: 25,
    force: 10,
    range: 0,
  },
  flysheep: {
    id: 'flysheep',
    look: { fireSound: 'baa' },
    special: true,
    name: 'Flying Sheep',
    icon: '🦸',
    blurb: 'Takes off in the aim direction; steer it with the arrow keys, Space to detonate (or it hits something).',
    kind: 'flyer',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 15,
    radius: 4,
    damage: 75,
    force: 17,
    range: 0,
  },
  torch: {
    id: 'torch',
    look: { fireSound: 'torchLight' },
    name: 'Blowtorch',
    icon: '🔥',
    blurb: 'Burns a tunnel along the aim line for 3 seconds and rides it — aim up to climb, down to dig in.',
    kind: 'torch',
    ammo: 2,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    // Burn duration in seconds.
    fuse: 3,
    // Tunnel radius.
    radius: 0.8,
    damage: 15,
    force: 7,
    range: 0.9,
  },
  drill: {
    id: 'drill',
    look: {},
    name: 'Drill',
    icon: '⛏️',
    blurb: 'Drills straight down for 3 seconds. No fall damage while drilling.',
    kind: 'drill',
    ammo: 2,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    // Drilling time in seconds.
    fuse: 3,
    // Shaft radius.
    radius: 0.8,
    damage: 15,
    force: 7,
    range: 0,
  },
  mine: {
    id: 'mine',
    look: { fireSound: 'clunk' },
    special: true,
    name: 'Proximity Mine',
    icon: '🛞',
    blurb: 'Space drops it at your feet. It arms while you run, then goes off for anyone who comes near — friend or foe.',
    kind: 'mine',
    ammo: 2,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 1,
    restitution: null,
    fuse: 0,
    radius: 3,
    damage: 40,
    force: 12,
    range: 0,
  },
  rope: {
    id: 'rope',
    look: { fireSound: 'hookShot' },
    name: 'Rope',
    icon: '🪝',
    blurb: 'Space shoots the hook; hang, ↑↓ reel, ←→ swing, Space lets go. Land, then fire a weapon.',
    kind: 'rope',
    ammo: 3,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 1,
    restitution: null,
    fuse: 0,
    radius: 0,
    damage: 0,
    force: 0,
    range: 24,
  },
  selfdestruct: {
    id: 'selfdestruct',
    look: { fireSound: 'alarm' },
    special: true,
    name: 'Self-Destruct',
    icon: '☠️',
    blurb: 'The buddy blows itself up: damage equals its health, and the blast grows with it.',
    kind: 'self',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    // Scaled by the buddy's health when used: radius = hp / 10, damage = hp.
    radius: 10,
    damage: 100,
    force: 22,
    range: 0,
  },
  teleport: {
    id: 'teleport',
    look: { fireSound: 'warp' },
    special: true,
    name: 'Teleport',
    icon: '🌀',
    blurb: 'Click anywhere on the map to appear there — and then fall, land or drown like anybody else. One per match.',
    kind: 'teleport',
    ammo: 1,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 0,
    damage: 0,
    force: 0,
    range: 0,
  },
  platform: {
    id: 'platform',
    look: { fireSound: 'build' },
    name: 'Platform',
    icon: '🪵',
    blurb: 'Move the mouse to place a five-unit board, wheel to tilt it, left-click to set it. No damage.',
    kind: 'platform',
    ammo: 2,
    charge: false,
    shots: 1,
    minSpeed: 0,
    maxSpeed: 0,
    windInfluence: 0,
    gravityScale: 0,
    restitution: null,
    fuse: 0,
    radius: 0,
    damage: 0,
    force: 0,
    range: 0,
  },
};

/**
 * Weapons a player can select, grouped by what they are rather than by the order they were built:
 * the launcher and the thrown family first, then the guns, the melee pair, the sheep, the three
 * things called in from the sky, the two digging tools, getting about, building, and the two ways
 * of blowing yourself up. Hotkeys follow the order — 1–9, 0, then Shift+1–9, Shift+0 — so this list
 * is the one place where the order really is the user interface.
 */
export const WEAPON_ORDER: readonly WeaponId[] = [
  // Launcher and the thrown family.
  'bazooka',
  'grenade',
  'cluster',
  'banana',
  'holy',
  // Firearms.
  'shotgun',
  'minigun',
  // Melee.
  'punch',
  'bat',
  // Sheep.
  'sheep',
  'flysheep',
  // Called in from the sky.
  'airstrike',
  'napalm',
  'mule',
  // Digging.
  'torch',
  'drill',
  // Getting about and building.
  'rope',
  'platform',
  // Traps and last resorts.
  'mine',
  'selfdestruct',
  'teleport',
  // The heirloom, and last: the rarest thing in the arsenal.
  'ming',
];
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
/** Selectable weapons that crates can contain. */
export const SPECIAL_WEAPONS: readonly WeaponId[] = WEAPON_ORDER.filter((id) => WEAPONS[id].special);

/** Weapons past the twenty digit slots carry a letter key of their own. */
export const LETTER_KEYS: Readonly<Partial<Record<string, WeaponId>>> = { KeyT: 'teleport', KeyV: 'ming' };

/**
 * Hotkeys: 1–9 and 0 select the first ten weapons in WEAPON_ORDER, Shift+1–9 and Shift+0 the ten
 * after them. Returns the weapon for a digit key, or null when that key is unused.
 */
export function weaponForKey(digit: number, shift: boolean): WeaponId | null {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
  const index = shift ? (digit === 0 ? 19 : 9 + digit) : digit === 0 ? 9 : digit - 1;
  return WEAPON_ORDER[index] ?? null;
}

/** Label of the hotkey for the weapon at `index` in WEAPON_ORDER. */
export function hotkeyLabel(index: number): string {
  if (index < 9) return String(index + 1);
  if (index === 9) return '0';
  if (index === 19) return '⇧0';
  if (index < 19) return `⇧${index - 9}`;
  // Past the digits: whatever letter key the weapon was given, or nothing but Tab.
  const id = WEAPON_ORDER[index];
  const letter = Object.entries(LETTER_KEYS).find(([, weapon]) => weapon === id)?.[0];
  return letter ? letter.slice(3) : '·';
}
