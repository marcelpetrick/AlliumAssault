import { describe, expect, it } from 'vitest';
import { planAttack } from '../src/core/ai';
import { Game, type GameEvent } from '../src/core/game';
import { createBody } from '../src/core/physics';
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

  it('sheep hops forwards and explodes on the second Space press', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const me = g.buddies[0];
    me.facing = 1;
    g.selectWeapon('sheep');
    g.pressFire();
    expect(g.phase).toBe('guiding');
    expect(g.teams[0].ammo.sheep).toBe(0);
    g.simulate(2);
    const sheep = g.sheep!;
    expect(sheep.body.x).toBeGreaterThan(me.body.x + 4);
    expect(sheep.body.y).toBeLessThan(23);
    const x = me.body.x;
    g.input.right = true;
    g.simulate(0.3);
    expect(me.body.x).toBeCloseTo(x, 3);
    g.input.right = false;
    const revision = g.terrain.revision;
    g.pressFire();
    expect(g.sheep).toBeNull();
    expect(g.terrain.revision).toBeGreaterThan(revision);
    expect(g.phase).toBe('retreat');
  });

  it('sheep damages an enemy it reaches and turns around at walls', () => {
    const g = flatGame([40, 47], [team('A', 1), team('B', 1)]);
    toAiming(g);
    for (let y = 20; y <= 30; y += 1) g.terrain.addDisc(34, y, 1.5);
    g.buddies[0].facing = -1;
    g.selectWeapon('sheep');
    g.pressFire();
    runUntil(g, () => (g.sheep?.body.x ?? 0) > 46, 8);
    expect(g.sheep!.facing).toBe(1);
    g.pressFire();
    g.simulate(0.2);
    expect(g.buddies[1].hp).toBeLessThan(60);
  });

  it('sheep detonates by itself when the turn time runs out', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)], { turnTime: 3 });
    toAiming(g);
    g.selectWeapon('sheep');
    g.pressFire();
    runUntil(g, () => g.phase !== 'guiding', 5);
    expect(g.sheep).toBeNull();
    expect(g.phase).toBe('retreat');
  });

  it('air strike drops five bombs around the target and damages an enemy there', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('airstrike');
    g.pressFire();
    expect(g.phase).toBe('aiming');
    const events: GameEvent[] = [];
    const craters: number[] = [];
    g.strike(70);
    expect(g.teams[0].ammo.airstrike).toBe(0);
    expect(g.phase).toBe('retreat');
    expect(g.drops).toHaveLength(5);
    runUntil(g, () => {
      for (const e of g.drainEvents()) {
        events.push(e);
        if (e.type === 'explosion') craters.push(e.x);
      }
      return craters.length >= 5;
    }, 8);
    expect(events.some((e) => e.type === 'airstrike')).toBe(true);
    expect(craters).toHaveLength(5);
    const center = craters.reduce((a, b) => a + b, 0) / craters.length;
    expect(Math.abs(center - 70)).toBeLessThan(1.5);
    expect(Math.max(...craters) - Math.min(...craters)).toBeGreaterThan(4);
    expect(g.buddies[1].hp).toBeLessThan(70);
    expect(g.buddies[0].hp).toBe(100);
  });

  it('air strike allows for wind', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)], { windMax: 1 });
    toAiming(g);
    g.wind = -1;
    g.selectWeapon('airstrike');
    g.buddies[0].facing = 1;
    g.strike(60);
    const craters: number[] = [];
    runUntil(g, () => {
      for (const e of g.drainEvents()) if (e.type === 'explosion') craters.push(e.x);
      return craters.length >= 5;
    }, 8);
    const center = craters.reduce((a, b) => a + b, 0) / craters.length;
    expect(Math.abs(center - 60)).toBeLessThan(1.5);
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

describe('crates', () => {
  const crateGame = (crates: number) => flatGame([20, 100], [team('A', 1), team('B', 1)], { crates, turnTime: 1 });
  const nextTurn = (g: Game) => {
    g.skipTurn();
    runUntil(g, () => g.phase === 'aiming', 20);
  };

  it('teleport onto free land from the second turn on, at most four, never with crates off', () => {
    const off = crateGame(0);
    for (let k = 0; k < 6; k++) nextTurn(off);
    expect(off.crates).toHaveLength(0);

    const g = crateGame(1);
    toAiming(g);
    expect(g.crates).toHaveLength(0);
    for (let k = 0; k < 8; k++) nextTurn(g);
    expect(g.crates).toHaveLength(4);
    for (const c of g.crates) {
      expect(c.body.y).toBeCloseTo(20.45, 0);
      for (const b of g.buddies) expect(Math.abs(b.body.x - c.body.x)).toBeGreaterThan(2);
    }
  });

  it('are placed the same way for the same seed', () => {
    const a = crateGame(0.5);
    const b = crateGame(0.5);
    for (let k = 0; k < 8; k++) {
      nextTurn(a);
      nextTurn(b);
    }
    expect(a.crates.map((c) => [c.kind, c.weapon, c.body.x])).toEqual(b.crates.map((c) => [c.kind, c.weapon, c.body.x]));
  });

  it('health crate heals the buddy who touches it; weapon crate adds team ammo', () => {
    const g = crateGame(0);
    toAiming(g);
    const me = g.buddies[0];
    me.hp = 40;
    g.crates.push({ id: 900, kind: 'health', weapon: null, body: createBody(me.body.x + 0.9, me.body.y, 0.45) });
    g.step();
    expect(g.crates).toHaveLength(0);
    expect(me.hp).toBe(65);
    g.crates.push({ id: 901, kind: 'weapon', weapon: 'sheep', body: createBody(me.body.x - 0.9, me.body.y, 0.45) });
    g.step();
    expect(g.teams[0].ammo.sheep).toBe(2);
    expect(g.drainEvents().filter((e) => e.type === 'cratePickup')).toHaveLength(2);
  });

  it('blow up when caught in an explosion', () => {
    const g = crateGame(0);
    toAiming(g);
    g.crates.push({ id: 902, kind: 'weapon', weapon: 'airstrike', body: createBody(60, 20.45, 0.45) });
    g.crates.push({ id: 903, kind: 'health', weapon: null, body: createBody(61.5, 20.45, 0.45) });
    g.explode(59, 20, 2, 20, 5);
    expect(g.crates).toHaveLength(0);
    expect(g.drainEvents().filter((e) => e.type === 'explosion')).toHaveLength(3);
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

  it('guides a sheep to the enemy and detonates it there', () => {
    const g = flatGame([40, 52], [team('A', 1, 'ai'), team('B', 1)]);
    const ammo = g.teams[0].ammo;
    ammo.bazooka = ammo.grenade = ammo.shotgun = ammo.punch = ammo.cluster = 0;
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(9));
    expect(plan.weapon).toBe('sheep');
    expect(plan.facing).toBe(1);
    expect(plan.delay).toBeGreaterThan(2);
    runUntil(g, () => g.phase === 'guiding', 10);
    runUntil(g, () => g.phase !== 'guiding', 15);
    expect(g.buddies[1].hp).toBeLessThan(50);
    expect(g.buddies[0].hp).toBe(100);
  });

  it('calls an air strike onto an enemy', () => {
    const g = flatGame([30, 80], [team('A', 1, 'ai'), team('B', 1)]);
    const ammo = g.teams[0].ammo;
    ammo.bazooka = ammo.grenade = ammo.shotgun = ammo.punch = ammo.cluster = ammo.sheep = 0;
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(4));
    expect(plan.weapon).toBe('airstrike');
    expect(Math.abs(plan.target! - 80)).toBeLessThan(2);
    runUntil(g, () => g.drops.length > 0, 10);
    runUntil(g, () => g.phase === 'turnStart', 20);
    expect(g.buddies[1].hp).toBeLessThan(70);
  });

  it('walks to a nearby crate when it has no good shot', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
    for (let y = 20; y <= 64; y += 2) g.terrain.addDisc(75, y, 3);
    g.crates.push({ id: 950, kind: 'health', weapon: null, body: createBody(47, 20.45, 0.45) });
    runUntil(g, () => g.crates.length === 0 || g.phase !== 'aiming' && g.phase !== 'turnStart', 20);
    expect(g.crates).toHaveLength(0);
    expect(g.buddies[0].hp).toBe(125);
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
