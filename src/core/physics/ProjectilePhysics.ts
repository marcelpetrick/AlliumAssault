import type { Projectile } from '../entities/Projectile';
import type { WeaponDefinition } from '../weapons/WeaponDefinition';
import type { CollisionMask } from '../terrain/CollisionMask';
import { vec2, type Vec2 } from '../types';

export const GRAVITY = 980; // px/s²

export type ProjectilePhysicsEvent =
  | { type: 'hit_terrain'; projectileId: string; hitPoint: Vec2; normal: Vec2 }
  | { type: 'fuse_expired'; projectileId: string; position: Vec2 };

export function stepProjectile(
  proj: Projectile,
  def: WeaponDefinition,
  wind: Vec2,
  mask: CollisionMask,
  dt: number,
): ProjectilePhysicsEvent | null {
  if (!proj.active) return null;

  const prevX = proj.position.x;
  const prevY = proj.position.y;

  // Integrate velocity
  proj.velocity.y += GRAVITY * def.gravityScale * dt;
  proj.velocity.x += wind.x * def.windInfluence * dt;

  const newX = proj.position.x + proj.velocity.x * dt;
  const newY = proj.position.y + proj.velocity.y * dt;

  // Swept collision: sample along segment at ~1px intervals
  const dx = newX - prevX;
  const dy = newY - prevY;
  const segLen = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(segLen));

  let hitX = newX;
  let hitY = newY;
  let hit = false;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sx = prevX + dx * t;
    const sy = prevY + dy * t;
    if (mask.isSolid(Math.round(sx), Math.round(sy))) {
      hitX = prevX + dx * (t - 1 / steps);
      hitY = prevY + dy * (t - 1 / steps);
      hit = true;
      break;
    }
  }

  if (hit && def.explodeOnImpact) {
    proj.active = false;
    proj.position.x = hitX;
    proj.position.y = hitY;
    const normal = estimateNormal(mask, hitX, hitY);
    return { type: 'hit_terrain', projectileId: proj.id, hitPoint: vec2(hitX, hitY), normal };
  }

  if (hit && def.restitution > 0) {
    // Bounce — reflect velocity off normal
    const n = estimateNormal(mask, hitX, hitY);
    const dot = proj.velocity.x * n.x + proj.velocity.y * n.y;
    proj.velocity.x = (proj.velocity.x - 2 * dot * n.x) * def.restitution;
    proj.velocity.y = (proj.velocity.y - 2 * dot * n.y) * def.restitution;
    proj.position.x = hitX;
    proj.position.y = hitY;
    proj.bounceCount++;
    // Don't return an event — projectile continues
  } else if (!hit) {
    proj.position.x = newX;
    proj.position.y = newY;
  }

  // Fuse countdown
  if (proj.fuseTimer > 0) {
    proj.fuseTimer -= dt;
    if (proj.fuseTimer <= 0) {
      proj.active = false;
      return {
        type: 'fuse_expired',
        projectileId: proj.id,
        position: vec2(proj.position.x, proj.position.y),
      };
    }
  }

  // Out of world bounds
  const w = mask.getWidth();
  const h = mask.getHeight();
  if (proj.position.x < -100 || proj.position.x > w + 100 || proj.position.y > h * 1.2) {
    proj.active = false;
    return null;
  }

  return null;
}

function estimateNormal(mask: CollisionMask, x: number, y: number): Vec2 {
  const px = Math.round(x);
  const py = Math.round(y);
  let nx = 0;
  let ny = 0;
  const offsets: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [ox, oy] of offsets) {
    if (mask.isSolid(px + ox, py + oy)) {
      nx -= ox;
      ny -= oy;
    }
  }
  const len = Math.sqrt(nx * nx + ny * ny);
  if (len < 0.001) return vec2(0, -1);
  return vec2(nx / len, ny / len);
}
