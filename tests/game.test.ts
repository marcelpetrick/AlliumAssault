import { describe, expect, it } from 'vitest';
import { planAttack } from '../src/core/ai';
import { Game, type GameEvent } from '../src/core/game';
import { createBody } from '../src/core/physics';
import { CRATE_WEAPONS } from '../src/core/crates';
import { hotkeyLabel, SPECIAL_WEAPONS, WEAPON_ORDER, weaponForKey } from '../src/core/weapons';
import { mulberry32 } from '../src/core/rng';
import { config, flatGame, onlyWeapon, runUntil, team } from './helpers';

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

  it('holy garlic grenade waits until it rests, sings, then blows a huge crater', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('holy');
    g.buddies[0].aim = 0.6;
    g.pressFire();
    g.simulate(0.3);
    g.releaseFire();
    const events: GameEvent[] = [];
    runUntil(g, () => {
      events.push(...g.drainEvents());
      return events.some((e) => e.type === 'hallelujah');
    }, 8);
    const song = events.find((e) => e.type === 'hallelujah')!;
    expect(g.projectiles).toHaveLength(1);
    expect(g.projectiles[0].vx ** 2 + g.projectiles[0].vy ** 2).toBeLessThan(1);
    g.simulate(1.4);
    expect(g.projectiles).toHaveLength(1);
    g.simulate(0.3);
    expect(g.projectiles).toHaveLength(0);
    if (song.type === 'hallelujah') expect(g.terrain.isSolid(song.x, song.y - 5.5)).toBe(false);
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

  it('baseball bat does less damage than the punch but knocks the enemy much further', () => {
    const hit = (weapon: 'punch' | 'bat') => {
      const g = flatGame([40, 41.2], [team('A', 1), team('B', 1)]);
      toAiming(g);
      g.selectWeapon(weapon);
      g.buddies[0].facing = 1;
      g.buddies[0].aim = 0.3;
      g.pressFire();
      const enemy = g.buddies[1];
      const damage = 100 - enemy.hp;
      runUntil(g, () => enemy.body.grounded && enemy.body.restTime > 0.2, 8);
      return { damage, distance: enemy.body.x - 41.2 };
    };
    const punch = hit('punch');
    const bat = hit('bat');
    expect(bat.damage).toBe(25);
    expect(bat.damage).toBeLessThan(punch.damage);
    expect(bat.distance).toBeGreaterThan(punch.distance * 2);
    expect(bat.distance).toBeGreaterThan(12);
  });

  it('self-destruct kills the buddy with a blast that scales with its health', () => {
    const blast = (hp: number, enemyX: number) => {
      const g = flatGame([40, enemyX], [team('A', 1), team('B', 1)]);
      toAiming(g);
      g.buddies[0].hp = hp;
      g.selectWeapon('selfdestruct');
      g.pressFire();
      expect(g.buddies[0].alive).toBe(false);
      expect(g.phase).toBe('settling');
      return 100 - g.buddies[1].hp;
    };
    expect(blast(100, 42)).toBeGreaterThan(75);
    expect(blast(100, 48)).toBeGreaterThan(15);
    expect(blast(50, 42)).toBeLessThan(50);
    expect(blast(50, 48)).toBe(0);
  });

  it('blowtorch walks forward for three seconds and burns a level tunnel through a wall', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    for (let y = 20; y <= 30; y += 1) g.terrain.addDisc(44, y, 1.5);
    toAiming(g);
    const me = g.buddies[0];
    me.facing = 1;
    const startY = me.body.y;
    g.selectWeapon('torch');
    g.pressFire();
    expect(g.phase).toBe('torching');
    let highest = startY;
    runUntil(g, () => {
      highest = Math.max(highest, me.body.y);
      return g.phase !== 'torching';
    }, 4);
    expect(g.phase).toBe('retreat');
    expect(me.body.x).toBeGreaterThan(45.5);
    expect(highest - startY).toBeLessThan(0.3);
    expect(g.terrain.isSolid(44, 20.8)).toBe(false);
    expect(g.terrain.isSolid(44, 23)).toBe(true);
  });

  it('blowtorch does not carry the buddy over a gap: it falls', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    g.terrain.carve(47, 17, 4.5);
    toAiming(g);
    const me = g.buddies[0];
    me.facing = 1;
    g.selectWeapon('torch');
    g.pressFire();
    runUntil(g, () => g.phase !== 'torching', 4);
    expect(me.body.y).toBeLessThan(19);
  });

  it('blowtorch burns an enemy in its way once', () => {
    const g = flatGame([40, 42.5], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.buddies[0].facing = 1;
    g.selectWeapon('torch');
    g.pressFire();
    runUntil(g, () => g.phase !== 'torching', 4);
    expect(g.buddies[1].hp).toBe(85);
  });

  it('minigun fires a 14-bullet burst that damages and shoves the enemy far away', () => {
    const g = flatGame([40, 48], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const [me, enemy] = g.buddies;
    me.facing = 1;
    me.aim = 0.03;
    g.selectWeapon('minigun');
    g.pressFire();
    expect(g.phase).toBe('firing');
    const x = me.body.x;
    g.input.left = true;
    const shots: number[] = [];
    runUntil(g, () => {
      for (const e of g.drainEvents()) if (e.type === 'shot') shots.push(e.x1);
      return g.phase !== 'firing';
    }, 3);
    expect(shots).toHaveLength(14);
    expect(me.body.x).toBeCloseTo(x, 3);
    expect(g.phase).toBe('retreat');
    expect(enemy.hp).toBeLessThanOrEqual(100 - 5 * 8);
    runUntil(g, () => enemy.body.grounded && enemy.body.restTime > 0.2, 8);
    expect(!enemy.alive || enemy.body.x > 60).toBe(true);
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

  it('banana bomb bursts into five bouncing bananas that explode one by one', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('banana');
    g.buddies[0].aim = 1;
    g.pressFire();
    g.simulate(0.2);
    g.releaseFire();
    const booms: number[] = [];
    let fragments = 0;
    let bounced = false;
    runUntil(g, () => {
      fragments = Math.max(fragments, g.projectiles.filter((p) => p.weapon === 'bananalet').length);
      bounced ||= g.projectiles.some((p) => p.weapon === 'bananalet' && p.bounces > 0);
      for (const e of g.drainEvents()) if (e.type === 'explosion') booms.push(g.time);
      return booms.length >= 6;
    }, 10);
    expect(fragments).toBe(5);
    expect(bounced).toBe(true);
    expect(booms).toHaveLength(6);
    expect(booms[5] - booms[1]).toBeGreaterThan(0.7);
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

  it('flying sheep flies straight, steers with the arrow keys the whole flight and explodes on impact', () => {
    const g = flatGame([30, 110], [team('A', 1), team('B', 1)]);
    for (let y = 20; y <= 64; y += 2) g.terrain.addDisc(90, y, 2);
    toAiming(g);
    const me = g.buddies[0];
    me.facing = 1;
    me.aim = 1.2;
    g.selectWeapon('flysheep');
    g.pressFire();
    expect(g.phase).toBe('guiding');
    g.simulate(0.5);
    const straight = g.flyer!.angle;
    g.simulate(0.5);
    expect(g.flyer!.angle).toBeCloseTo(straight, 5);
    // Each held arrow turns the sheep towards that screen direction and holds it there.
    const hold = (keys: Partial<typeof g.input>, seconds: number) => {
      Object.assign(g.input, { left: false, right: false, up: false, down: false }, keys);
      g.simulate(seconds);
      Object.assign(g.input, { left: false, right: false, up: false, down: false });
    };
    const heading = () => ({ x: Math.cos(g.flyer!.angle), y: Math.sin(g.flyer!.angle) });
    hold({ right: true }, 1);
    expect(heading().x).toBeGreaterThan(0.99);
    hold({ up: true }, 1);
    expect(heading().y).toBeGreaterThan(0.99);
    hold({ right: true, down: true }, 1.2);
    expect(heading().x).toBeGreaterThan(0.65);
    expect(heading().y).toBeLessThan(-0.65);
    hold({ right: true }, 0.8);
    expect(heading().x).toBeGreaterThan(0.99);
    expect(g.phase).toBe('guiding');
    const revision = g.terrain.revision;
    runUntil(g, () => g.phase !== 'guiding', 10);
    expect(g.flyer).toBeNull();
    expect(g.terrain.revision).toBeGreaterThan(revision);
    expect(g.phase).toBe('retreat');
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

  it('concrete mule drops onto the target and smashes down through the ground several times', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('mule');
    g.strike(70);
    expect(g.teams[0].ammo.mule).toBe(0);
    expect(g.phase).toBe('retreat');
    const craters: { x: number; y: number }[] = [];
    runUntil(g, () => {
      for (const e of g.drainEvents()) if (e.type === 'explosion') craters.push({ x: e.x, y: e.y });
      return g.projectiles.length === 0 && g.drops.length === 0 && craters.length > 0;
    }, 15);
    expect(craters.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(craters[0].x - 70)).toBeLessThan(1);
    expect(craters[craters.length - 1].y).toBeLessThan(craters[0].y - 4);
    expect(g.buddies[1].hp).toBeLessThan(65);
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

describe('weapon hotkeys', () => {
  it('map 1–9 and 0 to the first ten weapons and Shift+digits to the rest', () => {
    expect(weaponForKey(1, false)).toBe(WEAPON_ORDER[0]);
    expect(weaponForKey(9, false)).toBe(WEAPON_ORDER[8]);
    expect(weaponForKey(0, false)).toBe(WEAPON_ORDER[9]);
    expect(weaponForKey(1, true)).toBe(WEAPON_ORDER[10]);
    expect(weaponForKey(0, true)).toBeNull();
    expect(weaponForKey(9, true)).toBeNull();
    WEAPON_ORDER.forEach((id, k) => {
      const label = hotkeyLabel(k);
      const shift = label.startsWith('⇧');
      expect(weaponForKey(Number(label.replace('⇧', '')), shift)).toBe(id);
    });
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

  it('lengthen the turn intro when one teleports in, so players notice it', () => {
    const g = crateGame(1);
    toAiming(g);
    g.skipTurn();
    runUntil(g, () => g.phase === 'turnStart', 20);
    expect(g.crates).toHaveLength(1);
    expect(g.introTime).toBeGreaterThan(2);
    g.simulate(1.5);
    expect(g.phase).toBe('turnStart');
    runUntil(g, () => g.phase === 'aiming', 3);
    expect(g.turnTimeLeft).toBeCloseTo(1, 1);
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

  it('arsenal "crates": special weapons start empty and each weapon crate adds one more', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { arsenal: 'crates' });
    toAiming(g);
    const ammo = g.teams[0].ammo;
    expect(ammo.bazooka).toBe(Infinity);
    expect(ammo.bat).toBe(2);
    for (const id of SPECIAL_WEAPONS) expect(ammo[id]).toBe(0);
    g.selectWeapon('sheep');
    expect(g.weapon).toBe('bazooka');
    const me = g.buddies[0];
    for (const id of [900, 901]) g.crates.push({ id, kind: 'weapon', weapon: 'sheep', body: createBody(me.body.x + 0.9, me.body.y, 0.45) });
    g.step();
    g.step();
    expect(ammo.sheep).toBe(2);
    g.selectWeapon('sheep');
    expect(g.weapon).toBe('sheep');
    expect(flatGame([20, 100], [team('A', 1), team('B', 1)]).teams[0].ammo.sheep).toBe(1);
    expect(CRATE_WEAPONS).toEqual(SPECIAL_WEAPONS);

    // Even without a crate setting, crates-only special weapons keep crates dropping.
    const noCrates = flatGame([20, 100], [team('A', 1), team('B', 1)], { arsenal: 'crates', turnTime: 1 });
    for (let k = 0; k < 12; k++) {
      noCrates.skipTurn();
      runUntil(noCrates, () => noCrates.phase === 'aiming', 20);
    }
    expect(noCrates.crates.length).toBeGreaterThan(0);
    expect(SPECIAL_WEAPONS.length).toBeGreaterThanOrEqual(9);
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
    onlyWeapon(g, 0, 'sheep');
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(9));
    expect(plan.weapon).toBe('sheep');
    expect(plan.facing).toBe(1);
    expect(plan.delay).toBeGreaterThan(2);
    runUntil(g, () => g.phase === 'guiding', 10);
    runUntil(g, () => g.phase !== 'guiding', 15);
    expect(g.buddies[1].hp).toBeLessThan(50);
    expect(g.buddies[0].hp).toBe(100);
  });

  it('steers a flying sheep into the enemy', () => {
    const g = flatGame([30, 60], [team('A', 1, 'ai'), team('B', 1)]);
    g.terrain.addDisc(45, 20, 5);
    onlyWeapon(g, 0, 'flysheep');
    runUntil(g, () => g.flyer !== null, 10);
    runUntil(g, () => g.phase !== 'guiding', 12);
    expect(g.buddies[1].hp).toBeLessThan(60);
    expect(g.buddies[0].hp).toBe(100);
  });

  it('never launches a flying sheep into the rock right around it', () => {
    const setup = (ceiling: boolean) => {
      const g = flatGame([30, 60], [team('A', 1, 'ai'), team('B', 1)]);
      // A low ceiling over the AI buddy blocks every launch angle.
      if (ceiling) for (let x = 18; x <= 42; x += 1) g.terrain.addDisc(x, 23.5, 1.2);
      onlyWeapon(g, 0, 'flysheep');
      runUntil(g, () => g.phase === 'aiming', 5);
      return planAttack(g, g.buddies[0], 'hard', mulberry32(3));
    };
    expect(setup(false).weapon).toBe('flysheep');
    expect(setup(true).weapon).not.toBe('flysheep');
  });

  it('calls an air strike onto an enemy', () => {
    const g = flatGame([30, 80], [team('A', 1, 'ai'), team('B', 1)]);
    onlyWeapon(g, 0, 'airstrike');
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
    onlyWeapon(g, 0, 'bazooka');
    g.crates.push({ id: 950, kind: 'health', weapon: null, body: createBody(47, 20.45, 0.45) });
    runUntil(g, () => g.crates.length === 0 || g.phase !== 'aiming' && g.phase !== 'turnStart', 20);
    expect(g.crates).toHaveLength(0);
    expect(g.buddies[0].hp).toBe(125);
  });

  it('bats an enemy standing near a cliff into the water', () => {
    const g = flatGame([40, 41.3], [team('A', 1, 'ai'), team('B', 1)]);
    g.teams[0].ammo.minigun = 0;
    // The ground ends at about x = 55: beyond a punch's reach, but not a bat's.
    for (let x = 60; x <= 128; x += 3) g.terrain.carve(x, 10, 11);
    runUntil(g, () => g.phase === 'aiming', 5);
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(2));
    expect(plan.weapon).toBe('bat');
    runUntil(g, () => !g.buddies[1].alive, 15);
    expect(g.buddies[1].alive).toBe(false);
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
