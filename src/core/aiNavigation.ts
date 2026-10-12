// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { JUMP, MUZZLE_OFFSET, SAFE_FALL_SPEED, WALK_SPEED } from './constants';
import type { Game } from './game';
import type { Point } from './math';
import { mineSees, MINE_TRIGGER_RANGE } from './mines';
import { GRAVITY, stepBody, type Body } from './physics';
import { clearLine, shootRope, stepRope, type Rope } from './rope';

const DT = 1 / 60;
const PICKUP_RANGE = 0.95;
export const ROUTE_TIMEOUT = 7;

/** Shared walking controller: the preview and the real bot make the same simple jump. */
export function walkJump(body: Body, stuck: number, facing: 1 | -1): boolean {
  if (stuck <= 0.3 || !body.grounded) return false;
  body.vx = JUMP.vx * facing;
  body.vy = JUMP.vy;
  body.grounded = false;
  return true;
}

/** Check the body where it really travels, including mines behind floors and ceilings. */
export function safeRouteBody(game: Game, b: Body): boolean {
  return (
    b.x > b.radius &&
    b.x < game.terrain.width - b.radius &&
    b.y > game.terrain.waterLevel + b.radius &&
    b.impact <= SAFE_FALL_SPEED &&
    !game.mines.some((m) => Math.hypot(m.body.x - b.x, m.body.y - b.y) < MINE_TRIGGER_RANGE + 0.2 && mineSees(game.terrain, m, b.x, b.y)) &&
    !game.flames.some((f) => Math.hypot(f.x - b.x, f.y - b.y) < 1.4)
  );
}

/** A short walk on the actual floor, with basic jumps and no changes to the match. */
export function walkingTime(game: Game, from: Body, target: Point, budget: number): number | null {
  if (Math.abs(target.x - from.x) / WALK_SPEED > budget) return null;
  const body = { ...from };
  let stuck = 0;
  for (let time = 0; time < Math.min(budget, ROUTE_TIMEOUT); time += DT) {
    if (Math.hypot(body.x - target.x, body.y - target.y) < PICKUP_RANGE) return time;
    const facing = target.x < body.x ? -1 : 1;
    walkJump(body, stuck, facing);
    const before = body.x;
    stepBody(game.terrain, body, DT, body.grounded ? facing * WALK_SPEED : null);
    if (!safeRouteBody(game, body)) return null;
    stuck = Math.abs(body.x - before) < 0.01 ? stuck + DT : 0;
  }
  return null;
}

/** Brake a swing near the destination; release only over a clear, short, controlled drop. */
export function ropeControls(game: Game, rope: Rope, body: Body, target: Point): { reel: number; swing: number; release: boolean } {
  if (rope.state === 'flying') return { reel: 0, swing: 0, release: false };
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const dropTime = Math.sqrt(Math.max(0, (-2 * dy) / (GRAVITY * game.terrain.gravityScale)));
  const landingX = body.x + body.vx * dropTime;
  const release = dy < 0.5 && dy > -4 && Math.abs(landingX - target.x) < 0.65 && clearLine(game.terrain, body, target);
  const control = dx * 3 - body.vx * 1.8;
  return {
    swing: Math.abs(control) < 0.4 ? 0 : Math.sign(control),
    reel: dy > -0.5 ? -1 : Math.abs(dx) < 2 ? 1 : 0,
    release,
  };
}

export interface RopeRoute {
  aim: number;
  facing: 1 | -1;
  seconds: number;
}

/** Test full traversals. Nearby overhead rock alone never justifies spending a rope. */
export function ropeRoute(game: Game, from: Body, target: Point, budget: number): RopeRoute | null {
  const facing: 1 | -1 = target.x < from.x ? -1 : 1;
  for (const direction of [facing, -facing] as const) {
    for (const aim of [1.15, 1.4, 0.9, 0.65, 0.4]) {
      const body = { ...from };
      const dx = Math.cos(aim) * direction;
      const dy = Math.sin(aim);
      let rope: Rope | null = shootRope(0, body.x + dx * MUZZLE_OFFSET, body.y + dy * MUZZLE_OFFSET, dx, dy, false);
      let attached = false;
      for (let time = 0; time < Math.min(budget, ROUTE_TIMEOUT); time += DT) {
        if (attached && Math.hypot(body.x - target.x, body.y - target.y) < PICKUP_RANGE) return { aim, facing: direction as 1 | -1, seconds: time };
        if (rope) {
          const control = ropeControls(game, rope, body, target);
          if (control.release) rope = null;
          else {
            const result = stepRope(game.terrain, rope, body, DT, control.reel, control.swing);
            attached ||= result === 'attached';
            if (result === 'missed' || result === 'detached') break;
          }
        } else stepBody(game.terrain, body, DT, null);
        if (!safeRouteBody(game, body)) break;
        if (!rope && body.grounded) break;
      }
    }
  }
  return null;
}
