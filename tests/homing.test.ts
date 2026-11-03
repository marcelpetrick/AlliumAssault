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
  expect(g.teams[0].ammo.homing).toBe(1);
  g.selectWeapon('homing');
  return g;
};

describe('homing rocket', () => {
  it('starts with one rocket and requires a living enemy lock before charging', () => {
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

  it('refills from crates and respects the special-weapons and infinite arsenal settings', () => {
    const g = launcher();
    g.crates.push({ id: 990, kind: 'weapon', weapon: 'homing', body: createBody(40, 20.65, 0.45) });
    g.step();
    expect(g.teams[0].ammo.homing).toBe(2);
    expect(flatGame([40, 80], [team('A', 1), team('B', 1)], { arsenal: 'crates' }).teams[0].ammo.homing).toBe(0);
    expect(flatGame([40, 80], [team('A', 1), team('B', 1)], { arsenal: 'infinite' }).teams[0].ammo.homing).toBe(Infinity);
  });

  it.each([
    { facing: 1 as const, shooter: 40, target: 80 },
    { facing: -1 as const, shooter: 80, target: 40 },
  ])('homes after an ordinary default-angle shot facing $facing', ({ facing, shooter, target }) => {
    const g = flatGame([shooter, target], [team('A', 1), team('B', 1)]);
    runUntil(g, () => g.phase === 'aiming', 5);
    g.selectWeapon('homing');
    g.targetBuddy(g.buddies[1].id);
    g.face(facing);
    // The real initial aim, rather than a nearly vertical trajectory authored to survive 3 seconds.
    expect(g.buddies[0].aim).toBe(0.5);
    g.pressFire();
    g.simulate(1.4);
    g.releaseFire();
    expect(runUntil(g, () => g.buddies[1].hp < 100, 5)).toBe(true);
    expect(g.teams[0].ammo.homing).toBe(0);
  });

  it('flies like a bazooka for one second, then tracks a moving target from an ordinary launch angle', () => {
    const g = launcher();
    const enemy = g.buddies[1];
    g.targetBuddy(enemy.id);
    g.buddies[0].aim = 0.5;
    g.pressFire();
    g.charge = 1;
    g.releaseFire();
    const rocket = g.projectiles[0];
    expect(rocket.target).toBe(enemy.id);
    g.simulate(0.9);
    const expectedVx = Math.cos(0.5) * WEAPONS.bazooka.maxSpeed;
    expect(rocket.vx).toBeCloseTo(expectedVx, 5);
    enemy.body.x = 90;
    g.simulate(0.15);
    expect(rocket.vx).toBeLessThan(expectedVx);
    expect(rocket.vy).toBeLessThan(0);
    expect(Math.hypot(rocket.vx, rocket.vy)).toBeCloseTo(24, 4);
    expect(runUntil(g, () => enemy.hp < 100, 5)).toBe(true);
    expect(enemy.hp).toBeLessThan(100);
  });

  it.each([
    { gravity: 0.5, wind: -0.7 },
    { gravity: 1, wind: 0.7 },
    { gravity: 2.5, wind: 0 },
  ])('matches bazooka launch physics before arming at gravity $gravity and wind $wind', ({ gravity, wind }) => {
    const launch = (weapon: 'homing' | 'bazooka') => {
      const g = flatGame([40, 80], [team('A', 1), team('B', 1)], { gravity });
      runUntil(g, () => g.phase === 'aiming', 5);
      g.wind = wind;
      g.selectWeapon(weapon);
      if (weapon === 'homing') g.targetBuddy(g.buddies[1].id);
      g.buddies[0].aim = 0.9;
      g.face(1);
      g.pressFire();
      g.charge = 0.8;
      g.releaseFire();
      g.simulate(0.5);
      return g.projectiles[0];
    };
    const rocket = launch('homing');
    const bazooka = launch('bazooka');
    for (const key of ['x', 'y', 'vx', 'vy'] as const) expect(rocket[key]).toBeCloseTo(bazooka[key], 5);
  });

  it('hits intervening rock during homing and keeps its last heading when the target disappears', () => {
    const g = launcher();
    const enemy = g.buddies[1];
    g.targetBuddy(enemy.id);
    g.buddies[0].aim = 1.4;
    g.pressFire();
    g.charge = 1;
    g.releaseFire();
    g.simulate(1.05);
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
    g.simulate(1.05);
    const rocket = g.projectiles[0];
    const wallX = rocket.x + 4;
    for (let y = 20; y <= 64; y++) g.terrain.addDisc(wallX, y, 1);
    expect(runUntil(g, () => g.projectiles.length === 0, 2)).toBe(true);
    expect(g.buddies[1].hp).toBe(100);
    expect(g.drainEvents().some((e) => e.type === 'explosion' && Math.abs(e.x - wallX) < 4)).toBe(true);
  });

  it('predicts the owner collision of a returning rocket rather than planning through the shooter', () => {
    const g = flatGame([50, 10], [team('A', 1), team('B', 1)]);
    g.terrain.fill((x, y) => Math.max(12 - y, Math.min(1.5 - Math.abs(x - 50), 20 - y)));
    runUntil(g, () => g.phase === 'aiming', 5);
    const [me, enemy] = g.buddies;
    Object.assign(me.body, { x: 50, y: 20.65, vx: 0, vy: 0, grounded: true });
    Object.assign(enemy.body, { x: 10, y: 12.65, vx: 0, vy: 0, grounded: true });
    me.hp = enemy.hp = 100;
    g.selectWeapon('homing');
    g.targetBuddy(enemy.id);
    me.aim = 0.5;
    g.face(1);
    const predicted = simulateShot(g, me, 'homing', 1, 0.5, 1, enemy.id);
    expect(predicted).not.toBeNull();
    expect(Math.hypot(predicted!.x - me.body.x, predicted!.y - me.body.y)).toBeLessThan(1.5);
    g.pressFire();
    g.charge = 1;
    g.releaseFire();
    const rocket = g.projectiles[0];
    expect(runUntil(g, () => g.projectiles.length === 0, 5)).toBe(true);
    expect(me.hp).toBeLessThan(100);
    expect(enemy.hp).toBe(100);
    expect(Math.hypot(predicted!.x - rocket.x, predicted!.y - rocket.y)).toBeLessThan(0.5);
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
