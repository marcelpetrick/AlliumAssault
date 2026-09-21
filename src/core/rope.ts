// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { clamp, type Point } from './math';
import { GRAVITY, stepFree, type Body } from './physics';
import type { Terrain } from './terrain';

/** How fast the hook flies, in world units per second. */
export const HOOK_SPEED = 40;
/** Longest rope the hook can still bite at, and the longest the buddy can pay out. */
export const ROPE_MAX = 24;
/** Shortest the rope can be reeled in to; a positive minimum keeps the buddy off its own anchor. */
export const ROPE_MIN = 1.2;
/** How fast Up and Down shorten and lengthen the rope. */
export const REEL_SPEED = 6;
/** Sideways acceleration Left and Right add while hanging. */
export const SWING_ACCEL = 26;
/** Gentle drag, so a passive swing loses a little rather than gaining any. */
const SWING_DRAG = 0.25;
/** Substeps per frame for the constraint solver. */
const SUBSTEPS = 4;
/** Sampling step for the swept hook flight and for line-of-sight tests. */
const SIGHT_STEP = 0.12;
/** A rope path that needs more corners than this is given up on rather than solved badly. */
const MAX_PIVOTS = 8;
/** How far a wrap pivot sits off the rock it bends around. */
const PIVOT_CLEARANCE = 0.12;
/** Extra clearance an unwrap test needs, so a corner cannot chatter on and off. */
const UNWRAP_MARGIN = 0.18;
/** Seconds a hook may fly before it is given up as a miss. */
export const HOOK_MAX_TIME = (ROPE_MAX / HOOK_SPEED) * 1.6;

export interface Rope {
  owner: number;
  /** The hook is still in the air, or it has bitten and the buddy hangs from it. */
  state: 'flying' | 'attached';
  hook: Point;
  /** Hook velocity while flying. */
  vx: number;
  vy: number;
  /**
   * The anchor first, then every corner the rope bends around, in order. The buddy swings around
   * the last one; the segments before it are pinned and count against the paid-out length.
   */
  pivots: Point[];
  /** Total rope paid out: the whole path from the anchor to the buddy when taut. */
  length: number;
  /** Seconds since the hook was fired. */
  age: number;
  /** Set once this traversal has cost the team a use, so re-shooting mid-flight is free. */
  paid: boolean;
}

export type RopeStep = 'flying' | 'attached' | 'missed' | 'detached';

/** Fire a hook from (x, y) along a unit direction. */
export function shootRope(owner: number, x: number, y: number, dx: number, dy: number, paid: boolean): Rope {
  return { owner, state: 'flying', hook: { x, y }, vx: dx * HOOK_SPEED, vy: dy * HOOK_SPEED, pivots: [], length: 0, age: 0, paid };
}

/** Nothing solid between a and b? The endpoints themselves are not tested. */
export function clearLine(t: Terrain, a: Point, b: Point, from = SIGHT_STEP): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return true;
  for (let d = from; d < dist; d += SIGHT_STEP) {
    if (t.isSolid(a.x + (dx / dist) * d, a.y + (dy / dist) * d)) return false;
  }
  return true;
}

/** Length of the pinned part of the path: the anchor up to the pivot the buddy swings around. */
export function pinnedLength(rope: Rope): number {
  let sum = 0;
  for (let k = 0; k + 1 < rope.pivots.length; k++) sum += Math.hypot(rope.pivots[k + 1].x - rope.pivots[k].x, rope.pivots[k + 1].y - rope.pivots[k].y);
  return sum;
}

/** How much rope is left to swing on, between the last pivot and the buddy. */
export function freeLength(rope: Rope): number {
  return Math.max(ROPE_MIN, rope.length - pinnedLength(rope));
}

/**
 * Advance a hook in flight. It sweeps to the first rock it meets and bites there, gives up beyond
 * `ROPE_MAX` from the buddy, and is a clean miss when it runs out of time or leaves the map.
 */
function stepHook(t: Terrain, rope: Rope, b: Body, dt: number): RopeStep {
  rope.age += dt;
  const travel = Math.hypot(rope.vx, rope.vy) * dt;
  const steps = Math.max(1, Math.ceil(travel / SIGHT_STEP));
  for (let s = 0; s < steps; s++) {
    rope.hook.x += (rope.vx * dt) / steps;
    rope.hook.y += (rope.vy * dt) / steps;
    const reach = Math.hypot(rope.hook.x - b.x, rope.hook.y - b.y);
    if (reach > ROPE_MAX || rope.hook.y < t.waterLevel || rope.hook.x < 0 || rope.hook.x > t.width || rope.hook.y > t.height) return 'missed';
    if (!t.isSolid(rope.hook.x, rope.hook.y)) continue;
    // Bite here, and start with exactly the rope that is already paid out.
    rope.state = 'attached';
    rope.pivots = [{ x: rope.hook.x, y: rope.hook.y }];
    rope.length = clamp(reach, ROPE_MIN, ROPE_MAX);
    return 'attached';
  }
  return rope.age > HOOK_MAX_TIME ? 'missed' : 'flying';
}

/** Add the corner the rope has to bend around, or take one away once the path is straight again. */
function updatePivots(t: Terrain, rope: Rope, b: Body): boolean {
  const last = rope.pivots[rope.pivots.length - 1];
  const buddy = { x: b.x, y: b.y };
  if (!clearLine(t, last, buddy)) {
    if (rope.pivots.length >= MAX_PIVOTS) return false;
    // Walk out from the pivot to the last point that still had a clear view, and bend there.
    const dx = buddy.x - last.x;
    const dy = buddy.y - last.y;
    const dist = Math.hypot(dx, dy);
    let corner: Point | null = null;
    for (let d = SIGHT_STEP; d < dist; d += SIGHT_STEP) {
      const x = last.x + (dx / dist) * d;
      const y = last.y + (dy / dist) * d;
      if (!t.isSolid(x, y)) {
        corner = { x, y };
        continue;
      }
      break;
    }
    if (!corner) return true;
    const n = t.normal(corner.x, corner.y);
    rope.pivots.push({ x: corner.x + n.x * PIVOT_CLEARANCE, y: corner.y + n.y * PIVOT_CLEARANCE });
    return true;
  }
  // Straight again: drop the corner, but only with room to spare so it cannot chatter.
  if (rope.pivots.length > 1) {
    const previous = rope.pivots[rope.pivots.length - 2];
    if (clearLine(t, previous, buddy, SIGHT_STEP + UNWRAP_MARGIN)) rope.pivots.pop();
  }
  return true;
}

/**
 * One frame of hanging: gravity and the player's swing, then the length constraint around the last
 * pivot, then terrain contacts, then the corners the rope wraps and unwraps.
 *
 * `reel` is -1 to shorten, 1 to lengthen, 0 to hold; `swing` is -1, 0 or 1.
 */
function stepAttached(t: Terrain, rope: Rope, b: Body, dt: number, reel: number, swing: number): RopeStep {
  const anchor = rope.pivots[0];
  // The rock it bit into can be blasted away; then the rope simply lets go.
  if (!t.isSolid(anchor.x, anchor.y)) return 'detached';
  const h = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    const before = freeLength(rope);
    rope.length = clamp(rope.length + reel * REEL_SPEED * h, pinnedLength(rope) + ROPE_MIN, ROPE_MAX);
    const allowance = freeLength(rope);
    // How fast the buddy is allowed to move away from the pivot right now.
    const payOut = (allowance - before) / h;

    stepFree(t, b, h, swing * SWING_ACCEL, -GRAVITY * t.gravityScale);
    b.vx *= Math.exp(-SWING_DRAG * h);
    b.vy *= Math.exp(-SWING_DRAG * h);

    const pivot = rope.pivots[rope.pivots.length - 1];
    let dx = b.x - pivot.x;
    let dy = b.y - pivot.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1e-4) {
      dx = 0;
      dy = -1;
      dist = 1;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    if (dist > allowance) {
      // Taut: pull the buddy back onto the circle and take away only the radial speed it is not
      // allowed to have. The tangential part is untouched, so a swing keeps its momentum.
      b.x = pivot.x + nx * allowance;
      b.y = pivot.y + ny * allowance;
      const radial = b.vx * nx + b.vy * ny;
      if (radial > payOut) {
        b.vx -= (radial - payOut) * nx;
        b.vy -= (radial - payOut) * ny;
      }
    } else if (dist < ROPE_MIN) {
      // Reeled all the way in: hold it off its own anchor rather than letting it pass through.
      b.x = pivot.x + nx * ROPE_MIN;
      b.y = pivot.y + ny * ROPE_MIN;
      const radial = b.vx * nx + b.vy * ny;
      if (radial < 0) {
        b.vx -= radial * nx;
        b.vy -= radial * ny;
      }
    }
    if (!updatePivots(t, rope, b)) return 'detached';
  }
  b.grounded = false;
  b.restTime = 0;
  return 'attached';
}

/** Advance the rope, whichever state it is in. */
export function stepRope(t: Terrain, rope: Rope, b: Body, dt: number, reel: number, swing: number): RopeStep {
  return rope.state === 'flying' ? stepHook(t, rope, b, dt) : stepAttached(t, rope, b, dt, reel, swing);
}

/** The whole rope path, anchor first and the buddy last — what the renderer draws. */
export function ropePath(rope: Rope, b: Body): Point[] {
  return rope.state === 'flying' ? [{ x: b.x, y: b.y }, rope.hook] : [...rope.pivots, { x: b.x, y: b.y }];
}
