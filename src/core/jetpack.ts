// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { clamp } from './math';
import { stepFree, touchingGround, type Body } from './physics';
import type { Terrain } from './terrain';

export const JETPACK_TIME = 6;
export const JETPACK_ACCEL = 20;
export const JETPACK_SPEED = 10;
export const JETPACK_DESCENT = 3;

export interface JetpackAction {
  kind: 'jetpack';
  left: number;
  airborne: boolean;
  thrust: boolean;
}

/** Directional acceleration while fuel lasts; a governor keeps the subsequent descent safe. */
export function stepJetpack(t: Terrain, b: Body, pack: JetpackAction, dt: number, x: number, y: number): boolean {
  const powered = pack.left > 0;
  pack.thrust = powered && y > 0;
  pack.left = Math.max(0, pack.left - dt);
  b.vx *= Math.exp(-dt * (powered ? 1.2 : 3));
  b.vx = clamp(b.vx + (powered ? x * JETPACK_ACCEL * dt : 0), -JETPACK_SPEED, JETPACK_SPEED);
  b.vy = clamp(b.vy + (pack.thrust ? JETPACK_ACCEL : powered && y < 0 ? -14 : -8) * dt, -JETPACK_DESCENT, JETPACK_SPEED);
  stepFree(t, b, dt, 0, 0);
  // Keep the buddy inside the vertical play space; side walls and ground use ordinary collision.
  if (b.y > t.height - b.radius) {
    b.y = t.height - b.radius;
    b.vy = Math.min(0, b.vy);
  }
  b.grounded = touchingGround(t, b);
  pack.airborne ||= !b.grounded;
  return pack.airborne && b.grounded && b.vy <= 0;
}
