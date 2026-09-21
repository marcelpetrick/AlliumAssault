// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { createBody, stepBody, type Body } from './physics';
import type { Terrain } from './terrain';

export const MINE_RADIUS = 0.28;
/** Seconds after being dropped before a mine can go off, so the buddy that laid it can get clear. */
export const MINE_ARM_TIME = 1.5;
/** How close a living buddy's centre has to come to an armed mine to set it off. */
export const MINE_TRIGGER_RANGE = 2;
/** Seconds between being set off and exploding. It goes off even if the buddy runs away again. */
export const MINE_FUSE = 1;

/**
 * Unarmed while the retreat window lasts, armed once it can trigger, triggered while its fuse burns
 * down. There is no dud chance and no expiry: a mine stays where it is, through every turn and
 * round, until something sets it off.
 */
export type MineState = 'unarmed' | 'armed' | 'triggered';

export interface Mine {
  id: number;
  /** The buddy that laid it, and its team — for the kill feed, not for who it hurts. */
  owner: number;
  team: number;
  body: Body;
  state: MineState;
  /** Seconds since it was dropped. */
  age: number;
  /** Seconds left before it goes off; only counts down while triggered. */
  fuse: number;
}

export type MineStep = 'none' | 'armed' | 'triggered' | 'blast' | 'water' | 'out';

/**
 * A mine dropped by a buddy standing at (x, y), placed at its feet. `armed` skips the arming delay,
 * which is what a mystery box does to whoever opened it: no grace, the thing is live already.
 */
export function placeMine(id: number, owner: number, team: number, x: number, y: number, armed = false): Mine {
  return { id, owner, team, body: createBody(x, y, MINE_RADIUS), state: armed ? 'armed' : 'unarmed', age: armed ? MINE_ARM_TIME : 0, fuse: MINE_FUSE };
}

/**
 * Does the mine have a clear line to (x, y)? Rock between them shields a buddy, so a mine cannot
 * reach through a wall or a floor.
 */
export function mineSees(t: Terrain, m: Mine, x: number, y: number): boolean {
  const dx = x - m.body.x;
  const dy = y - m.body.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return true;
  for (let d = MINE_RADIUS; d < dist; d += 0.2) {
    if (t.isSolid(m.body.x + (dx / dist) * d, m.body.y + (dy / dist) * d)) return false;
  }
  return true;
}

/**
 * Advance one mine. It falls and settles like any loose body, arms after its delay, and goes off
 * `MINE_FUSE` seconds after `triggering` first becomes true. Finding what is near it, and blowing
 * anything up, is the game's business.
 */
export function stepMine(t: Terrain, m: Mine, dt: number, triggering: boolean): MineStep {
  m.age += dt;
  stepBody(t, m.body, dt, null);
  if (m.body.y < t.waterLevel - 0.3) return 'water';
  if (m.body.x < -30 || m.body.x > t.width + 30) return 'out';
  if (m.state === 'unarmed') {
    if (m.age < MINE_ARM_TIME) return 'none';
    m.state = 'armed';
    return 'armed';
  }
  if (m.state === 'armed') {
    if (!triggering) return 'none';
    m.state = 'triggered';
    m.fuse = MINE_FUSE;
    return 'triggered';
  }
  m.fuse -= dt;
  return m.fuse <= 0 ? 'blast' : 'none';
}
