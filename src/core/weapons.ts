export type WeaponId = 'bazooka' | 'grenade' | 'shotgun' | 'punch';
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
};

export const WEAPON_ORDER: readonly WeaponId[] = ['bazooka', 'grenade', 'shotgun', 'punch'];
