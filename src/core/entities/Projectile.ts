import type { Vec2 } from '../types';

export interface Projectile {
  id: string;
  weaponId: string;
  instigatorTeamId: string;
  instigatorCharId: string;
  position: Vec2;
  velocity: Vec2;
  active: boolean;
  fuseTimer: number; // seconds; -1 = no fuse
  bounceCount: number;
}

export function createProjectile(
  id: string,
  weaponId: string,
  instigatorTeamId: string,
  instigatorCharId: string,
  position: Vec2,
  velocity: Vec2,
  fuseSeconds: number | null = null,
): Projectile {
  return {
    id,
    weaponId,
    instigatorTeamId,
    instigatorCharId,
    position: { x: position.x, y: position.y },
    velocity: { x: velocity.x, y: velocity.y },
    active: true,
    fuseTimer: fuseSeconds ?? -1,
    bounceCount: 0,
  };
}
