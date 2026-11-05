// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { clamp } from './math';
import { stepFree, touchingGround, type Body } from './physics';
import type { Terrain } from './terrain';

export const JETPACK_TIME = 6;
export const JETPACK_ACCEL = 20;
export const JETPACK_SPEED = 10;
export const JETPACK_DESCENT = 3;
export const JETPACK_FALL_ACCEL = 8;
export const JETPACK_FALL_LIMIT = 24;

export interface JetpackAction {
  kind: 'jetpack';
  left: number;
  airborne: boolean;
  thrust: boolean;
  coasting: boolean;
}

/** Powered flight is controlled; after cutoff a gentle start accelerates under reduced gravity. */
export function stepJetpack(t: Terrain, b: Body, pack: JetpackAction, dt: number, x: number, y: number): boolean {
  const powered = pack.left > 0;
  if (!powered && !pack.coasting) {
    b.vy = Math.max(b.vy, -JETPACK_DESCENT);
    pack.coasting = true;
  }
  pack.thrust = powered && y > 0;
  pack.left = Math.max(0, pack.left - dt);
  b.vx *= Math.exp(-dt * (powered ? 1.2 : 3));
  b.vx = clamp(b.vx + (powered ? x * JETPACK_ACCEL * dt : 0), -JETPACK_SPEED, JETPACK_SPEED);
  const acceleration = powered ? (pack.thrust ? JETPACK_ACCEL : y < 0 ? -14 : -8) : -JETPACK_FALL_ACCEL * t.gravityScale;
  b.vy = clamp(b.vy + acceleration * dt, powered ? -JETPACK_DESCENT : -JETPACK_FALL_LIMIT, JETPACK_SPEED);
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
