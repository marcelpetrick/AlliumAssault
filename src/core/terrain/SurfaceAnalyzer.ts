import type { CollisionMask } from './CollisionMask';
import { vec2Normalise, vec2, type Vec2 } from '../types';

export const CHARACTER_HALF_WIDTH = 10; // half of CHARACTER_WIDTH

export function isGrounded(mask: CollisionMask, pos: Vec2, charWidth: number): boolean {
  const hw = charWidth / 4;
  const checkY = Math.round(pos.y) + 1;
  for (let dx = -hw; dx <= hw; dx += hw) {
    if (mask.isSolid(Math.round(pos.x + dx), checkY)) return true;
  }
  return false;
}

export function headClearance(mask: CollisionMask, pos: Vec2): number {
  for (let dy = 1; dy <= 64; dy++) {
    if (mask.isSolid(Math.round(pos.x), Math.round(pos.y) - dy)) return dy - 1;
  }
  return 64;
}

export function sideObstructed(
  mask: CollisionMask,
  pos: Vec2,
  dx: number,
  charHeight: number,
): boolean {
  const checkX = Math.round(pos.x + dx * 4);
  for (let dy = 4; dy < charHeight - 4; dy++) {
    if (mask.isSolid(checkX, Math.round(pos.y) - dy)) return true;
  }
  return false;
}

export function surfaceNormal(mask: CollisionMask, pos: Vec2): Vec2 {
  let nx = 0;
  let ny = 0;
  const px = Math.round(pos.x);
  const py = Math.round(pos.y);
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;
  for (const [ox, oy] of offsets) {
    if (mask.isSolid(px + ox, py + oy)) {
      nx -= ox;
      ny -= oy;
    }
  }
  return vec2Normalise(vec2(nx, ny));
}

export function fallDistance(mask: CollisionMask, pos: Vec2): number {
  const px = Math.round(pos.x);
  const startY = Math.round(pos.y) + 1;
  for (let dy = 0; dy < mask.getHeight(); dy++) {
    if (mask.isSolid(px, startY + dy)) return dy;
  }
  return mask.getHeight();
}
