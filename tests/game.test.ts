import { describe, expect, it } from 'vitest';
import { planAttack } from '../src/core/ai';
import { Game } from '../src/core/game';
import { mulberry32 } from '../src/core/rng';
import { config, flatGame, runUntil, team } from './helpers';

const toAiming = (g: Game) => runUntil(g, () => g.phase === 'aiming', 5);

describe('match flow', () => {
  it('rotates teams and buddies each turn', () => {
    const g = flatGame([20, 40, 60, 80], [team('A', 2), team('B', 2)], { turnTime: 2 });
    const order: string[] = [];
    for (let turn = 0; turn < 5; turn++) {
      toAiming(g);
      order.push(g.activeBuddy!.name);
      g.skipTurn();
      runUntil(g, () => g.phase === 'turnStart', 10);
    }
    expect(order).toEqual(['A1', 'B1', 'A2', 'B2', 'A1']);
  });

  it('remembers the selected weapon per team', () => {
    const g = flatGame([20, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('grenade');
    g.skipTurn();
    runUntil(g, () => g.activeTeam === 1 && g.phase === 'aiming', 10);
    expect(g.weapon).toBe('bazooka');
    g.skipTurn();
    runUntil(g, () => g.activeTeam === 0 && g.phase === 'aiming', 10);
    expect(g.weapon).toBe('grenade');
  });

  it('ends the turn when the timer runs out', () => {
    const g = flatGame([20, 80], [team('A', 1), team('B', 1)], { turnTime: 3 });
    toAiming(g);
    expect(runUntil(g, () => g.activeTeam === 1 && g.phase === 'aiming', 10)).toBe(true);
  });

  it('bazooka shot damages and launches the enemy, then grants retreat time', () => {
    const g = flatGame([40, 50], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const [me, enemy] = g.buddies;
    me.facing = 1;
    me.aim = 0.15;
    g.pressFire();
    g.simulate(0.8);
    g.releaseFire();
    expect(g.phase).toBe('retreat');
    runUntil(g, () => enemy.hp < 100, 3);
    expect(enemy.hp).toBeLessThan(100);
    expect(enemy.hp).toBeGreaterThan(0);
    expect(g.terrain.isSolid(enemy.body.x, 19.9) || enemy.body.y > 20.6).toBe(true);
  });

  it('grenade explodes after its fuse', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('grenade');
    g.buddies[0].aim = 0.8;
    g.pressFire();
    g.simulate(0.2);
    g.releaseFire();
    expect(g.projectiles.length).toBe(1);
    g.simulate(2.5);
    expect(g.projectiles.length).toBe(1);
    g.simulate(0.7);
    expect(g.projectiles.length).toBe(0);
  });

  it('shotgun fires twice and consumes one ammo', () => {
    const g = flatGame([40, 50], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('shotgun');
    g.buddies[0].facing = 1;
    g.buddies[0].aim = 0;
    g.pressFire();
    expect(g.phase).toBe('aiming');
    expect(g.teams[0].ammo.shotgun).toBe(1);
    g.pressFire();
    expect(g.phase).toBe('retreat');
    expect(g.buddies[1].hp).toBeLessThanOrEqual(100 - 44 + 1);
  });

  it('finishes a shotgun turn even when the first shot used the last ammo', () => {
    const g = flatGame([40, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.teams[0].ammo.shotgun = 1;
    g.selectWeapon('shotgun');
    g.pressFire();
    expect(g.teams[0].ammo.shotgun).toBe(0);
    expect(g.phase).toBe('aiming');
    g.pressFire();
    expect(g.phase).toBe('retreat');
  });

  it('punch launches an adjacent enemy upwards', () => {
    const g = flatGame([40, 41.2], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('punch');
    g.buddies[0].facing = 1;
    g.buddies[0].aim = 0.2;
    g.pressFire();
    g.simulate(0.2);
    expect(g.buddies[1].hp).toBe(55);
    expect(g.buddies[1].body.y).toBeGreaterThan(21.5);
  });

  it('kills buddies at 0 hp with a death explosion and declares a winner', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.buddies[1].hp = 5;
    g.explode(g.buddies[1].body.x, g.buddies[1].body.y - 0.5, 2.5, 30, 2);
    g.skipTurn();
    runUntil(g, () => g.phase === 'gameOver', 20);
    expect(g.buddies[1].alive).toBe(false);
    expect(g.winner).toBe(0);
  });

  it('drowns buddies that fall into the water', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.terrain.carve(70, 12, 12);
    runUntil(g, () => !g.buddies[1].alive, 10);
    expect(g.buddies[1].alive).toBe(false);
  });

  it('cancelling a charge fires nothing and keeps the turn', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.pressFire();
    g.simulate(0.4);
    g.cancelCharge();
    g.releaseFire();
    g.simulate(0.2);
    expect(g.charge).toBeNull();
    expect(g.projectiles).toHaveLength(0);
    expect(g.phase).toBe('aiming');
  });

  it('cluster bomb bursts into five bomblets after its fuse and uses limited ammo', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('cluster');
    g.buddies[0].aim = 0.8;
    g.pressFire();
    g.simulate(0.2);
    g.releaseFire();
    expect(g.teams[0].ammo.cluster).toBe(2);
    runUntil(g, () => g.projectiles.length !== 1, 4);
    expect(g.projectiles.map((p) => p.weapon)).toEqual(Array(5).fill('bomblet'));
    runUntil(g, () => g.projectiles.length === 0, 5);
    expect(g.projectiles.length).toBe(0);
  });

  it('a bomblet deals 10 damage on a direct hit', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const enemy = g.buddies[1];
    g.projectiles.push({ id: 999, weapon: 'bomblet', x: enemy.body.x, y: enemy.body.y + 3, vx: 0, vy: -5, radius: 0.15, bounces: 0, fuse: 0, age: 1, owner: g.buddies[0].id });
    runUntil(g, () => g.projectiles.length === 0, 2);
    expect(enemy.hp).toBe(90);
  });

  it('walking is blocked while charging', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const x = g.buddies[0].body.x;
    g.input.right = true;
    g.pressFire();
    g.simulate(0.5);
    expect(g.buddies[0].body.x).toBeCloseTo(x, 3);
  });
});

describe('AI', () => {
  it('finds a damaging bazooka or grenade shot on open ground', () => {
    const g = flatGame([40, 58], [team('A', 1, 'ai'), team('B', 1)]);
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(3));
    expect(plan.score).toBeGreaterThan(20);
    expect(plan.facing).toBe(1);
  });

  it('plans a damaging cluster bomb throw', () => {
    const g = flatGame([40, 58], [team('A', 1, 'ai'), team('B', 1)]);
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(3), 'cluster');
    expect(plan.weapon).toBe('cluster');
    expect(plan.score).toBeGreaterThan(20);
  });

  it('re-plans with the current weapon after the first shotgun shot', () => {
    const g = flatGame([40, 52], [team('A', 1, 'ai'), team('B', 1)]);
    const me = g.buddies[0];
    runUntil(g, () => g.phase === 'aiming', 5);
    g.selectWeapon('shotgun');
    me.facing = -1;
    me.aim = 1;
    g.pressFire();
    expect(g.shotsLeft).toBe(1);
    const plan = planAttack(g, me, 'hard', mulberry32(5), 'shotgun');
    expect(plan.weapon).toBe('shotgun');
    expect(plan.facing).toBe(1);
    expect(Math.abs(plan.aim)).toBeLessThan(0.1);
  });

  it('plays an AI-vs-AI match to the end on a generated map', () => {
    const g = new Game(config([team('A', 2, 'ai'), team('B', 2, 'ai')], { seed: 'duel', turnTime: 25, windMax: 0.3 }));
    g.simulate(60 * 15);
    expect(g.phase).toBe('gameOver');
    expect(g.turn).toBeGreaterThan(2);
  });
});
