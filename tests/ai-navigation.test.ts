// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { ropeControls, ropeRoute, safeRouteBody, walkingTime, walkJump } from '../src/core/aiNavigation';
import { createBody } from '../src/core/physics';
import { placeMine } from '../src/core/mines';
import { shootRope } from '../src/core/rope';
import { flatGame, onlyWeapon, runUntil, team } from './helpers';

const arena = () => {
  const g = flatGame([40, 100], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
  runUntil(g, () => g.phase === 'aiming', 5);
  return g;
};

describe('AI navigation uses the real physics', () => {
  it('walks both ways and refuses deadlines, water, steep walls, fire and mines on its actual path', () => {
    const g = arena();
    const b = g.buddies[0].body;
    expect(walkingTime(g, b, { x: 45, y: b.y }, 4)).not.toBeNull();
    expect(walkingTime(g, b, { x: 35, y: b.y }, 4)).not.toBeNull();
    expect(walkingTime(g, b, { x: 45, y: b.y }, 0.1)).toBeNull();
    expect(walkingTime(g, b, { x: 40, y: 50 }, 0)).toBeNull();
    const mine = placeMine(1, 2, 1, 43, 20.28, true);
    g.mines.push(mine);
    expect(walkingTime(g, b, { x: 45, y: b.y }, 4)).toBeNull();
    // A mine in another cavern does not block the floor upstairs.
    mine.body.y = 12;
    expect(walkingTime(g, b, { x: 45, y: b.y }, 4)).not.toBeNull();
    g.flames.push({ id: 1, x: 43, y: 20.1, life: 5, bite: 1, bitesLeft: 0 });
    expect(walkingTime(g, b, { x: 45, y: b.y }, 4)).toBeNull();
    g.flames.length = 0;
    for (let y = 20; y < 40; y++) g.terrain.addDisc(43, y, 1.5);
    expect(walkingTime(g, b, { x: 46, y: b.y }, 4)).toBeNull();
    expect(safeRouteBody(g, { ...b, x: -1 })).toBe(false);
    expect(safeRouteBody(g, { ...b, x: 129 })).toBe(false);
    expect(safeRouteBody(g, { ...b, y: 3 })).toBe(false);
    expect(safeRouteBody(g, { ...b, impact: 50 })).toBe(false);
  });

  it('jumps an ordinary obstacle, including to the left', () => {
    for (const side of [-1, 1] as const) {
      const g = arena();
      const b = g.buddies[0].body;
      g.terrain.addDisc(b.x + side * 2, 20, 1.2);
      expect(walkingTime(g, b, { x: b.x + side * 5, y: b.y }, 5)).not.toBeNull();
      const copy = { ...b };
      expect(walkJump(copy, 0, side)).toBe(false);
      expect(walkJump(copy, 1, side)).toBe(true);
      expect(copy.vx * side).toBeGreaterThan(0);
      expect(walkJump(copy, 1, side)).toBe(false);
    }
  });

  it('rejects empty-sky hooks and unreachable ledges', () => {
    const g = arena();
    const b = g.buddies[0].body;
    expect(ropeRoute(g, b, { x: 49, y: b.y + 6 }, 7)).toBeNull();
    const hook = shootRope(1, b.x, b.y, 0, 1, false);
    expect(ropeControls(g, hook, b, { x: 45, y: 24 })).toEqual({ reel: 0, swing: 0, release: false });
    hook.state = 'attached';
    b.y += 5;
    expect(ropeControls(g, hook, b, { x: b.x, y: b.y - 2 }).release).toBe(true);
    expect(ropeControls(g, hook, b, { x: b.x + 8, y: b.y + 2 })).toMatchObject({ reel: -1, swing: 1, release: false });
    expect(ropeControls(g, hook, b, { x: b.x - 8, y: b.y - 2 })).toMatchObject({ reel: 0, swing: -1 });
    expect(ropeControls(g, hook, b, { x: b.x, y: b.y - 8 })).toMatchObject({ reel: 1, swing: 0, release: false });
  });

  it('plans and completes a rope pickup over a gap rather than merely firing a hook', () => {
    const g = arena();
    onlyWeapon(g, 0, 'rope');
    const b = g.buddies[0].body;
    // An overhead bridge, and a gap too wide/deep to walk across safely.
    for (let x = 35; x <= 65; x += 1) g.terrain.addDisc(x, 32, 1.5);
    g.terrain.carve(47, 15, 8);
    const target = createBody(55, 20.45, 0.45);
    target.grounded = true;
    g.crates.push({ id: 990, kind: 'health', weapon: null, body: target });
    expect(ropeRoute(g, b, target, 7)).not.toBeNull();
    expect(runUntil(g, () => g.crates.length === 0, 15)).toBe(true);
    expect(g.buddies[0].hp).toBe(125);
    expect(runUntil(g, () => g.phase === 'aiming', 7)).toBe(true);
  });
});
