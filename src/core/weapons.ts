export type WeaponId = 'bazooka' | 'grenade' | 'shotgun' | 'punch' | 'cluster' | 'bomblet';
export type WeaponKind = 'projectile' | 'hitscan' | 'melee';

export interface WeaponDef {
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
  /** Seconds until detonation; 0 = no fuse. */
  fuse: number;
  radius: number;
  damage: number;
  force: number;
  range: number;
  /** Every buddy inside the blast takes the full damage instead of less towards the edge. */
  flatDamage?: boolean;
  /** Fragments released when this projectile explodes. */
  cluster?: { weapon: WeaponId; count: number; speed: number };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bazooka: {
    id: 'bazooka',
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
    name: 'Shotgun',
    icon: '🔫',
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
  },
  punch: {
    id: 'punch',
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
  },
  cluster: {
    id: 'cluster',
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
  bomblet: {
    id: 'bomblet',
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
};

/** Weapons a player can select, in hotkey order (1, 2, 3, …). Fragments are not listed. */
export const WEAPON_ORDER: readonly WeaponId[] = ['bazooka', 'grenade', 'shotgun', 'punch', 'cluster'];
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
