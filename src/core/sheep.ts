// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { BUDDY_RADIUS } from './constants';
import { createBody, stepBody, type Body } from './physics';
import type { Terrain } from './terrain';

export const SHEEP_RADIUS = 0.4;
/** Launch speed of each hop along both axes: a 45° hop of roughly 1.6 units. */
export const SHEEP_HOP = 4.5;
/** Seconds a sheep rests on the ground between hops. */
const HOP_PAUSE = 0.12;
/** A hop that moved less than this counts as blocked. */
const BLOCKED_DISTANCE = 0.25;

export interface Sheep {
  id: number;
  owner: number;
  body: Body;
  facing: 1 | -1;
  age: number;
  /** Seconds spent on the ground since the last landing. */
  grounded: number;
  /** x position where the current hop started. */
  hopFrom: number;
  blocked: number;
}

export type SheepStep = 'none' | 'hop' | 'water' | 'out';

export function createSheep(id: number, owner: number, x: number, y: number, facing: 1 | -1): Sheep {
  return { id, owner, body: createBody(x, y, SHEEP_RADIUS), facing, age: 0, grounded: 0, hopFrom: x, blocked: 0 };
}

/** A sheep released by a buddy standing at (x, y), placed just in front of it. */
export function releaseSheep(id: number, owner: number, x: number, y: number, facing: 1 | -1): Sheep {
  return createSheep(id, owner, x + facing * (BUDDY_RADIUS + SHEEP_RADIUS + 0.1), y + 0.2, facing);
}

/** Advance a sheep: hop forwards whenever it stands, turning around after repeated blocked hops. */
export function stepSheep(t: Terrain, s: Sheep, dt: number): SheepStep {
  s.age += dt;
  let result: SheepStep = 'none';
  if (s.body.grounded) {
    s.grounded += dt;
    if (s.grounded >= HOP_PAUSE) {
      s.blocked = Math.abs(s.body.x - s.hopFrom) < BLOCKED_DISTANCE ? s.blocked + 1 : 0;
      if (s.blocked >= 2) {
        s.facing = s.facing > 0 ? -1 : 1;
        s.blocked = 0;
      }
      s.hopFrom = s.body.x;
      s.body.vx = s.facing * SHEEP_HOP;
      s.body.vy = SHEEP_HOP;
      s.body.grounded = false;
      s.grounded = 0;
      result = 'hop';
    }
  }
  stepBody(t, s.body, dt, null);
  if (s.body.y < t.waterLevel - 0.2) return 'water';
  if (s.body.x < -30 || s.body.x > t.width + 30) return 'out';
  return result;
}
