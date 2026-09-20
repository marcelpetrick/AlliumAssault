// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Terrain } from './terrain';

export const GRAVITY = 25;
/** A contact counts as ground when its normal points at least this much upwards. */
const GROUND_NORMAL_Y = 0.5;
/**
 * Coulomb friction between a bouncing projectile and the rock it slides on. A slope holds a
 * resting projectile while `tan(angle) <= FRICTION * (1 + restitution)`, which at 0.6 covers
 * every hillside a normal-strength normal still points upwards on.
 */
const FRICTION = 0.9;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  grounded: boolean;
  /** Largest speed into a surface during the last step. */
  impact: number;
  /** Seconds the body has been (almost) motionless. */
  restTime: number;
}

export const createBody = (x: number, y: number, radius: number): Body => ({
  x,
  y,
  vx: 0,
  vy: 0,
  radius,
  grounded: false,
  impact: 0,
  restTime: 0,
});

/**
 * Advance a circular character body against the terrain.
 * `walk` is the desired horizontal speed while grounded, or null when not walking.
 */
export function stepBody(t: Terrain, b: Body, dt: number, walk: number | null): void {
  b.impact = 0;
  const wasGrounded = b.grounded;
  if (wasGrounded) {
    if (walk !== null) {
      b.vx = walk;
    } else {
      b.vx *= Math.exp(-16 * dt);
      if (Math.abs(b.vx) < 0.05) b.vx = 0;
    }
  }
  const stick = wasGrounded && walk === null && Math.hypot(b.vx, b.vy) < 1.5;
  if (stick) b.vy = Math.max(b.vy, 0);
  else b.vy -= GRAVITY * dt;

  const travel = Math.hypot(b.vx, b.vy) * dt;
  const steps = Math.max(1, Math.ceil(travel / (b.radius * 0.4)));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    resolve(t, b);
  }

  let grounded = touchingGround(t, b);
  if (!grounded && wasGrounded && walk !== null && b.vy <= 0.1) {
    // Follow the ground when walking down a slope instead of hopping off it.
    for (let d = 0.05; d <= 0.45; d += 0.05) {
      if (contactDistance(t, b.x, b.y - d) < b.radius + 0.02) {
        b.y -= d;
        resolve(t, b);
        grounded = touchingGround(t, b);
        break;
      }
    }
  }
  b.grounded = grounded;
  b.restTime = Math.hypot(b.vx, b.vy) < 0.3 ? b.restTime + dt : 0;
}

/**
 * Carry a body along a fixed velocity, ignoring gravity and footing but still resolving terrain
 * contacts. Tools that cut their own path drag their buddy with them this way; the velocity is
 * left on the body so it keeps that momentum once the tool stops.
 */
export function glideBody(t: Terrain, b: Body, dt: number, vx: number, vy: number): void {
  b.impact = 0;
  const travel = Math.hypot(vx, vy) * dt;
  const steps = Math.max(1, Math.ceil(travel / (b.radius * 0.4)));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    b.x += vx * h;
    b.y += vy * h;
    resolve(t, b);
  }
  b.vx = vx;
  b.vy = vy;
  b.grounded = touchingGround(t, b);
  b.restTime = 0;
}

function resolve(t: Terrain, b: Body): void {
  for (let iter = 0; iter < 4; iter++) {
    const d = contactDistance(t, b.x, b.y);
    if (d >= b.radius) return;
    const n = t.normal(b.x, b.y);
    const push = b.radius - d;
    b.x += n.x * push;
    b.y += n.y * push;
    const vn = b.vx * n.x + b.vy * n.y;
    if (vn < 0) {
      b.impact = Math.max(b.impact, -vn);
      const bounce = -vn > 10 ? 0.3 : 0;
      b.vx -= (1 + bounce) * vn * n.x;
      b.vy -= (1 + bounce) * vn * n.y;
      if (bounce > 0 && n.y > GROUND_NORMAL_Y) b.vx *= 0.6;
    }
  }
}

function touchingGround(t: Terrain, b: Body): boolean {
  return contactDistance(t, b.x, b.y - 0.08) < b.radius && t.normal(b.x, b.y).y > GROUND_NORMAL_Y;
}

/**
 * Distance to the surface, or Infinity when no rock backs it. The field is only an approximate
 * distance: a crater lowers it inside its disc but leaves the field above untouched, which then
 * still extrapolates to the blasted-away surface. Checking for rock just behind the estimated
 * surface point rejects those phantom contacts.
 */
function contactDistance(t: Terrain, x: number, y: number): number {
  const d = t.distance(x, y);
  if (d > 1.5 || t.isSolid(x, y)) return d;
  const n = t.normal(x, y);
  for (const depth of [0.06, 0.2]) {
    if (t.isSolid(x - n.x * (d + depth), y - n.y * (d + depth))) return d;
  }
  return Infinity;
}

export interface ProjectileBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounces: number;
}

export type ProjectileHit = 'none' | 'terrain' | 'target' | 'water' | 'out';

/**
 * Swept ballistic step. With `restitution === null` the projectile stops at the first
 * terrain contact; otherwise it bounces and eventually comes to rest.
 */
export function stepProjectile(
  t: Terrain,
  p: ProjectileBody,
  dt: number,
  ax: number,
  ay: number,
  restitution: number | null,
  hitTest?: (x: number, y: number) => boolean,
  maxStep = 0.12,
): ProjectileHit {
  const travel = (Math.hypot(p.vx, p.vy) + Math.hypot(ax, ay) * dt) * dt;
  const steps = Math.max(1, Math.ceil(travel / maxStep));
  const h = dt / steps;
  /** Speed gravity and wind press into a resting surface during one substep. */
  const load = Math.hypot(ax, ay) * h;
  for (let s = 0; s < steps; s++) {
    p.vx += ax * h;
    p.vy += ay * h;
    const nx = p.x + p.vx * h;
    const ny = p.y + p.vy * h;
    if (hitTest?.(nx, ny)) {
      p.x = nx;
      p.y = ny;
      return 'target';
    }
    if (t.sample(nx, ny) > -p.radius) {
      if (restitution === null) {
        p.x = nx;
        p.y = ny;
        return 'terrain';
      }
      const n = t.normal(nx, ny);
      const vn = p.vx * n.x + p.vy * n.y;
      if (vn < 0) {
        if (-vn > 2.5) p.bounces++;
        // Split the contact into a damped bounce along the normal and sliding along the surface,
        // then let friction eat into the sliding part. Without that friction, gravity keeps
        // refilling the tangential speed on a slope and the projectile never counts as resting.
        const tx = p.vx - vn * n.x;
        const ty = p.vy - vn * n.y;
        const tangent = Math.hypot(tx, ty);
        // Only the load the surface actually carries for one substep can rub speed off. A hard
        // bounce is over in an instant, so it keeps skittering; a body merely lying there feels
        // its whole weight and stops.
        const bite = FRICTION * (1 + restitution) * Math.min(-vn, load);
        const grip = tangent > 0 ? Math.max(0, tangent - bite) / tangent : 0;
        const out = -vn * restitution;
        p.vx = (tx * grip + n.x * out) * 0.92;
        p.vy = (ty * grip + n.y * out) * 0.92;
      }
      // Slide on with whatever survived the contact: a blocked step used to leave the projectile
      // standing still while still carrying that velocity, which looks settled but never rests.
      const sx = p.x + p.vx * h;
      const sy = p.y + p.vy * h;
      if (t.sample(sx, sy) <= -p.radius) {
        p.x = sx;
        p.y = sy;
      } else {
        // Wedged: the surface blocks the response too, so that velocity cannot be real.
        p.vx = 0;
        p.vy = 0;
      }
      if (t.sample(p.x, p.y) > -p.radius) {
        p.x += n.x * 0.05;
        p.y += n.y * 0.05;
      }
      if (Math.hypot(p.vx, p.vy) < 0.8 && n.y > 0.5) {
        p.vx = 0;
        p.vy = 0;
      }
      continue;
    }
    p.x = nx;
    p.y = ny;
    if (p.y < t.waterLevel) return 'water';
    if (p.x < -40 || p.x > t.width + 40) return 'out';
  }
  return 'none';
}
