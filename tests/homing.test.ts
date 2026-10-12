// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { AiDriver, planAttack, simulateShot } from '../src/core/ai';
import { CRATE_WEAPONS } from '../src/core/crates';
import { steerHoming } from '../src/core/homing';
import { createBody } from '../src/core/physics';
import { mulberry32 } from '../src/core/rng';
import { WEAPONS } from '../src/core/weapons';
import { flatGame, onlyWeapon, runUntil, team } from './helpers';

const launcher = () => {
  const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
  runUntil(g, () => g.phase === 'aiming', 5);
  expect(g.teams[0].ammo.homing).toBe(0);
  g.crates.push({ id: 990, kind: 'weapon', weapon: 'homing', body: createBody(40, 20.65, 0.45) });
  g.step();
  g.selectWeapon('homing');
  return g;
};

describe('homing rocket', () => {
  it('comes from crates and requires a living enemy lock before charging', () => {
    const g = launcher();
    expect(CRATE_WEAPONS).toContain('homing');
    expect(g.teams[0].ammo.homing).toBe(1);
    g.pressFire();
    expect(g.charge).toBeNull();
    expect(g.targetBuddy(-1)).toBe(false);
    expect(g.targetBuddy(g.buddies[0].id)).toBe(false);
    expect(g.targetBuddy(g.buddies[1].id)).toBe(true);
    g.pressFire();
    expect(g.charge).toBe(0);
    expect(g.targetBuddy(g.buddies[1].id)).toBe(false);
    g.buddies[1].hp = 0;
    g.releaseFire();
    expect(g.projectiles).toHaveLength(0);
    expect(g.teams[0].ammo.homing).toBe(1);
    g.weapon = 'bazooka';
    expect(g.targetBuddy(g.buddies[1].id)).toBe(false);
  });

  it('flies ballistically for three seconds, then directly tracks a moving target and hits it', () => {
    const g = launcher();
    const enemy = g.buddies[1];
    g.targetBuddy(enemy.id);
    g.buddies[0].aim = 1.4;
    g.pressFire();
    g.charge = 1;
    g.releaseFire();
    const rocket = g.projectiles[0];
    expect(rocket.target).toBe(enemy.id);
    g.simulate(2.9);
    const expectedVx = Math.cos(1.4) * WEAPONS.bazooka.maxSpeed;
    expect(rocket.vx).toBeCloseTo(expectedVx, 5);
    enemy.body.x = 90;
    g.simulate(0.15);
    expect(rocket.vx).toBeGreaterThan(expectedVx);
    expect(rocket.vy).toBeLessThan(0);
    expect(Math.hypot(rocket.vx, rocket.vy)).toBeCloseTo(24, 4);
    expect(runUntil(g, () => enemy.hp < 100, 5)).toBe(true);
    expect(enemy.hp).toBeLessThan(100);
  });

  it('hits intervening rock during homing and keeps its last heading when the target disappears', () => {
    const g = launcher();
    const enemy = g.buddies[1];
    g.targetBuddy(enemy.id);
    g.buddies[0].aim = 1.4;
    g.pressFire();
    g.charge = 1;
    g.releaseFire();
    g.simulate(3.05);
    const rocket = g.projectiles[0];
    const vx = rocket.vx;
    const vy = rocket.vy;
    enemy.alive = false;
    g.step();
    expect(rocket.vx).toBe(vx);
    expect(rocket.vy).toBe(vy);
    for (let y = 20; y <= 64; y++) g.terrain.addDisc(rocket.x + 4, y, 1);
    expect(runUntil(g, () => g.projectiles.length === 0, 2)).toBe(true);
    expect(enemy.hp).toBe(100);
    const stationary = { ...rocket, vx: 0, vy: 0 };
    steerHoming(stationary, stationary, 24);
    expect(stationary.vx).toBe(0);
    steerHoming(stationary, undefined, 24);
    expect(stationary.vy).toBe(0);
  });

  it('detonates on an intervening wall while its locked target remains alive', () => {
    const g = launcher();
    g.targetBuddy(g.buddies[1].id);
    g.buddies[0].aim = 1.4;
    g.pressFire();
    g.charge = 1;
    g.releaseFire();
    g.simulate(3.05);
    const rocket = g.projectiles[0];
    const wallX = rocket.x + 4;
    for (let y = 20; y <= 64; y++) g.terrain.addDisc(wallX, y, 1);
    expect(runUntil(g, () => g.projectiles.length === 0, 2)).toBe(true);
    expect(g.buddies[1].hp).toBe(100);
    expect(g.drainEvents().some((e) => e.type === 'explosion' && Math.abs(e.x - wallX) < 4)).toBe(true);
  });

  it('lets the AI select and launch a target-aware rocket using the same collision simulation', () => {
    const g = launcher();
    onlyWeapon(g, 0, 'homing');
    const plan = planAttack(g, g.buddies[0], 'normal', mulberry32(5));
    expect(plan.weapon).toBe('homing');
    expect(plan.buddyTarget).toBe(g.buddies[1].id);
    expect(plan.score).toBeGreaterThan(0);
    expect(simulateShot(g, g.buddies[0], 'homing', 1, 1.4, 1, g.buddies[1].id)).not.toBeNull();
    const driver = new AiDriver('normal', mulberry32(5));
    for (let i = 0; i < 600 && !g.projectiles.length; i++) {
      driver.update(g, 1 / 60);
      g.step();
    }
    expect(g.projectiles[0]?.target).toBe(g.buddies[1].id);
    expect(g.teams[0].ammo.homing).toBe(0);
  });
});
