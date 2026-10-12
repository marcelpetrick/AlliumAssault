// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { JETPACK_DESCENT, JETPACK_SPEED, JETPACK_TIME, stepJetpack, type JetpackAction } from '../src/core/jetpack';
import { createBody } from '../src/core/physics';
import { flatGame, flatTerrain, runUntil, team } from './helpers';

const flyingGame = (overrides = {}) => {
  const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { arsenal: 'crates', ...overrides });
  runUntil(g, () => g.phase === 'aiming', 5);
  g.selectWeapon('jetpack');
  g.pressFire();
  return g;
};

describe('jetpack', () => {
  it('has default supplies, accelerates for six seconds, then lands gently and permits an attack', () => {
    const g = flyingGame();
    const b = g.activeBuddy!;
    const start = b.body.y;
    expect(g.phase).toBe('jetpacking');
    expect(g.teams[0].ammo.jetpack).toBe(1);
    expect(g.countingDown).toBe(true);
    g.input.up = true;
    g.input.right = true;
    g.simulate(1);
    expect(b.body.y).toBeGreaterThan(start + 5);
    expect(b.body.x).toBeGreaterThan(44);
    expect(b.body.vy).toBeLessThanOrEqual(JETPACK_SPEED);
    g.input.right = false;
    g.simulate(5);
    expect(g.action?.kind).toBe('jetpack');
    if (g.action?.kind === 'jetpack') expect(g.action.left).toBeCloseTo(0, 8);
    g.simulate(1);
    expect(b.body.vy).toBeLessThan(5);
    g.input.up = false;
    expect(runUntil(g, () => g.phase === 'aiming', 25)).toBe(true);
    expect(b.hp).toBe(100);
    expect(g.action).toBeNull();
    g.selectWeapon('bazooka');
    g.pressFire();
    g.simulate(0.2);
    g.releaseFire();
    expect(g.projectiles).toHaveLength(1);
  });

  it('stops thrust early, allows controlled downward acceleration, and never exceeds descent speed', () => {
    const t = flatTerrain();
    const b = createBody(40, 45, 0.6);
    const pack: JetpackAction = { kind: 'jetpack', left: JETPACK_TIME, airborne: true, thrust: false };
    b.vx = -100;
    b.vy = -100;
    stepJetpack(t, b, pack, 1 / 60, -1, -1);
    expect(b.vx).toBe(-JETPACK_SPEED);
    expect(b.vy).toBe(-JETPACK_DESCENT);
    pack.left = 0;
    stepJetpack(t, b, pack, 1 / 60, 1, 1);
    expect(pack.thrust).toBe(false);
    expect(b.vy).toBe(-JETPACK_DESCENT);
    const g = flyingGame();
    g.input.up = true;
    g.simulate(1);
    g.pressFire();
    expect(g.action).toMatchObject({ kind: 'jetpack', left: 0 });
    g.input.up = false;
    expect(runUntil(g, () => g.phase === 'aiming', 8)).toBe(true);
  });

  it.each([0.5, 1, 2.5])('respects terrain, headroom and safe landing at gravity %s', (gravity) => {
    const g = flyingGame({ gravity });
    const b = g.activeBuddy!;
    g.input.up = true;
    g.input.left = true;
    for (let y = 20; y < 62; y++) g.terrain.addDisc(36, y, 1);
    g.simulate(2);
    expect(b.body.x).toBeGreaterThan(37);
    g.input.left = false;
    g.simulate(3);
    expect(b.body.y).toBeLessThanOrEqual(g.terrain.height - b.body.radius);
    g.pressFire();
    g.input.left = g.input.up = false;
    expect(runUntil(g, () => g.phase === 'aiming', 25)).toBe(true);
    expect(b.hp).toBe(100);
  });

  it('preserves gentle descent after turn timeout, and advances once the buddy lands', () => {
    const g = flyingGame({ turnTime: 3 });
    const b = g.activeBuddy!;
    g.input.up = true;
    g.simulate(3.2);
    expect(g.phase).toBe('settling');
    expect(g.action).toMatchObject({ kind: 'jetpack', left: 0 });
    g.simulate(9);
    expect(b.hp).toBe(100);
    expect(g.activeTeam).toBe(0);
    expect(runUntil(g, () => g.activeTeam === 1, 15)).toBe(true);
  });

  it('cuts thrust after an enemy hit, keeps a wounded buddy descending safely and clears a lethal flight', () => {
    const g = flyingGame();
    const b = g.activeBuddy!;
    g.input.up = true;
    g.simulate(1);
    g.explode(b.body.x, b.body.y, 1, 5, 0, true, { buddy: g.buddies[1].id, weapon: 'bazooka' });
    expect(b.hp).toBe(95);
    expect(g.phase).toBe('settling');
    expect(g.action).toMatchObject({ kind: 'jetpack', left: 0 });
    expect(runUntil(g, () => g.activeTeam === 1, 15)).toBe(true);
    expect(b.hp).toBe(95);
    const lethal = flyingGame();
    const victim = lethal.activeBuddy!;
    lethal.input.up = true;
    lethal.simulate(1);
    lethal.explode(victim.body.x, victim.body.y, 1, 150, 0, true);
    expect(victim.hp).toBe(0);
    expect(lethal.action).toBeNull();
    expect(runUntil(lethal, () => !victim.alive, 10)).toBe(true);
  });

  it('drowns over open water, clears dead owners, and collects a crate in flight', () => {
    const g = flyingGame();
    const b = g.activeBuddy!;
    g.crates.push({ id: 999, kind: 'health', weapon: null, body: createBody(b.body.x, b.body.y + 1.5, 0.45) });
    g.input.up = true;
    g.simulate(0.3);
    expect(g.crates).toHaveLength(0);
    expect(b.hp).toBe(125);
    g.terrain.fill(() => -4);
    g.pressFire();
    g.input.up = false;
    expect(runUntil(g, () => !b.alive, 12)).toBe(true);
    expect(g.action).toBeNull();
    const dead = flyingGame();
    dead.activeBuddy!.alive = false;
    dead.step();
    expect(dead.action).toBeNull();
  });
});
