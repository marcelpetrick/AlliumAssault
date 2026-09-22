// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { NO_KNOWLEDGE, planAttack, scoreBlast, simulateShot } from '../src/core/ai';
import { Game, REST_SPEED, type GameEvent } from '../src/core/game';
import { createBody } from '../src/core/physics';
import { crateLimit, CRATE_FIRE, CRATE_RADIUS, CRATE_WEAPONS, MAX_CRATES, MYSTERY_ODDS, openMystery } from '../src/core/crates';
import { hotkeyLabel, LETTER_KEYS, SPECIAL_WEAPONS, WEAPON_IDS, WEAPON_ORDER, WEAPONS, weaponForKey, type WeaponId } from '../src/core/weapons';
import { mulberry32 } from '../src/core/rng';
import { defined } from '../src/core/assert';
import { FLAME_BITE_INTERVAL, FLAME_BITES } from '../src/core/fire';
import { SUDDEN_DEATH_WATER_RISE } from '../src/core/constants';
import { MINE_ARM_TIME, MINE_FUSE, MINE_TRIGGER_RANGE, placeMine } from '../src/core/mines';
import { config, flatGame, onlyWeapon, runUntil, slopeGame, team } from './helpers';

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
    runUntil(
      g,
      () => {
        events.push(...g.drainEvents());
        return events.some((e) => e.type === 'hallelujah');
      },
      8,
    );
    const song = events.find((e) => e.type === 'hallelujah')!;
    expect(g.projectiles).toHaveLength(1);
    expect(g.projectiles[0].vx ** 2 + g.projectiles[0].vy ** 2).toBeLessThan(1);
    g.simulate(1.4);
    expect(g.projectiles).toHaveLength(1);
    g.simulate(0.3);
    expect(g.projectiles).toHaveLength(0);
    expect(g.terrain.isSolid(song.x, song.y - 5.5)).toBe(false);
  });

  it('holy garlic grenade on a slope arms from rest, long before the emergency fuse', () => {
    for (const slope of [-0.6, -0.3, 0.3, 0.6]) {
      const g = slopeGame(slope, [60, 68], [team('A', 1), team('B', 1)]);
      toAiming(g);
      // A contact that rejected its own step used to leave the grenade standing on a hillside with
      // metres per second of stored speed, so it only ever armed on the 10-second fallback.
      g.selectWeapon('holy');
      g.buddies[0].facing = 1;
      g.buddies[0].aim = 0.6;
      g.pressFire();
      g.simulate(0.3);
      g.releaseFire();
      const shot = g.projectiles[0];
      expect(shot).toBeDefined();
      runUntil(g, () => !!shot.armed, 9);
      expect(shot.armed).toBe(true);
      expect(shot.age).toBeLessThan(6);
      expect(Math.hypot(shot.vx, shot.vy)).toBeLessThan(REST_SPEED);
    }
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

  it('a swing says whether it connected, so only a real hit brings the crowd', () => {
    const swing = (enemyX: number) => {
      const g = flatGame([40, enemyX], [team('A', 1), team('B', 1)]);
      toAiming(g);
      g.selectWeapon('bat');
      g.buddies[0].facing = 1;
      g.buddies[0].aim = 0.3;
      g.pressFire();
      return g.drainEvents().find((e) => e.type === 'punch');
    };
    expect(swing(41.2)).toMatchObject({ weapon: 'bat', hit: true });
    // Thin air across the island: the same swing, and nothing to cheer about.
    expect(swing(90)).toMatchObject({ weapon: 'bat', hit: false });
  });

  it('an uppercut aimed at the ceiling punches a shaft through it', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const b = g.buddies[0];
    // A slab of rock hanging over the buddy's head, with clear air between.
    g.terrain.addDisc(b.body.x, b.body.y + 3.2, 1.6);
    expect(g.terrain.isSolid(b.body.x, b.body.y + 3.2)).toBe(true);
    g.selectWeapon('punch');
    b.aim = Math.PI / 2 - 0.05;
    g.pressFire();
    // The ceiling above it is gone, in a shaft the buddy could climb through.
    expect(g.terrain.isSolid(b.body.x, b.body.y + 1.6)).toBe(false);
    expect(g.terrain.isSolid(b.body.x, b.body.y + 2.4)).toBe(false);
  });

  it('a punch thrown flat still only dents what is in front of the buddy', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const b = g.buddies[0];
    g.terrain.addDisc(b.body.x, b.body.y + 3.2, 1.6);
    g.selectWeapon('punch');
    b.facing = 1;
    b.aim = 0.2;
    g.pressFire();
    // The ceiling is untouched: only a steep uppercut reaches it.
    expect(g.terrain.isSolid(b.body.x, b.body.y + 3.2)).toBe(true);
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

  it('self-destruct panics first, then kills the buddy with a blast that scales with its health', () => {
    const blast = (hp: number, enemyX: number) => {
      const g = flatGame([40, enemyX], [team('A', 1), team('B', 1)]);
      toAiming(g);
      g.buddies[0].hp = hp;
      g.selectWeapon('selfdestruct');
      g.pressFire();
      // The Lemmings moment: a few seconds of panic with a countdown before anything happens.
      expect(g.phase).toBe('panicking');
      expect(g.buddies[0].alive).toBe(true);
      expect(g.drainEvents().some((e) => e.type === 'panic' && e.seconds === 3)).toBe(true);
      expect(runUntil(g, () => !g.buddies[0].alive, 6)).toBe(true);
      expect(g.phase).toBe('settling');
      return 100 - g.buddies[1].hp;
    };
    expect(blast(100, 42)).toBeGreaterThan(75);
    expect(blast(100, 48)).toBeGreaterThan(15);
    expect(blast(50, 42)).toBeLessThan(50);
    expect(blast(50, 48)).toBe(0);
  });

  it('blowtorch burns a level tunnel through a wall when aimed level', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    for (let y = 20; y <= 30; y += 1) g.terrain.addDisc(44, y, 1.5);
    toAiming(g);
    const me = g.buddies[0];
    me.facing = 1;
    me.aim = 0;
    const startY = me.body.y;
    g.selectWeapon('torch');
    g.pressFire();
    expect(g.phase).toBe('torching');
    let highest = startY;
    runUntil(
      g,
      () => {
        highest = Math.max(highest, me.body.y);
        return g.phase !== 'torching';
      },
      4,
    );
    expect(g.phase).toBe('retreat');
    expect(me.body.x).toBeGreaterThan(45.5);
    expect(highest - startY).toBeLessThan(0.3);
    expect(g.terrain.isSolid(44, 20.8)).toBe(false);
    expect(g.terrain.isSolid(44, 23)).toBe(true);
  });

  it('blowtorch burns along the aim line: up into a hillside, and down into the ground', () => {
    const climb = (aim: number) => {
      const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
      // A solid block of rock to cut through, so the flame always has something to bite into.
      for (let y = 14; y <= 34; y += 0.5) g.terrain.addDisc(45, y, 6);
      toAiming(g);
      const me = g.buddies[0];
      me.facing = 1;
      me.aim = aim;
      const start = { x: me.body.x, y: me.body.y };
      g.selectWeapon('torch');
      g.pressFire();
      expect(g.phase).toBe('torching');
      runUntil(g, () => g.phase !== 'torching', 4);
      return { dx: me.body.x - start.x, dy: me.body.y - start.y };
    };
    const up = climb(0.9);
    expect(up.dy).toBeGreaterThan(2);
    expect(up.dx).toBeGreaterThan(0.5);
    const down = climb(-0.9);
    expect(down.dy).toBeLessThan(-2);
    expect(down.dx).toBeGreaterThan(0.5);
  });

  it('drill digs straight down for three seconds without fall damage and hits a buddy below', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const [me, enemy] = g.buddies;
    // Bury the enemy in a pocket five units under the driller.
    enemy.body.x = 40;
    enemy.body.y = 15;
    g.terrain.carve(40, 15, 0.8);
    const start = { x: me.body.x, y: me.body.y };
    g.selectWeapon('drill');
    g.pressFire();
    expect(g.phase).toBe('drilling');
    let lowest = start.y;
    runUntil(
      g,
      () => {
        lowest = Math.min(lowest, me.body.y);
        return g.phase !== 'drilling';
      },
      4,
    );
    expect(g.phase === 'retreat' || g.phase === 'settling').toBe(true);
    expect(start.y - lowest).toBeGreaterThan(4);
    expect(Math.abs(me.body.x - start.x)).toBeLessThan(0.6);
    expect(me.hp).toBe(100);
    expect(enemy.hp).toBeLessThan(100);
    expect(g.terrain.isSolid(40, start.y - 2)).toBe(false);
    expect(g.terrain.isSolid(42.5, start.y - 2)).toBe(true);
  });

  it('drill cushions falls: drilling through into a cave does not hurt', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    // A tall cave (y 10–18) under a two-unit floor: breaking through means a fall of about eight units.
    g.terrain.carve(40, 14, 4);
    toAiming(g);
    const me = g.buddies[0];
    g.selectWeapon('drill');
    g.pressFire();
    let impact = 0;
    runUntil(
      g,
      () => {
        impact = Math.max(impact, me.body.impact);
        return me.body.y < 12 && me.body.grounded;
      },
      3,
    );
    expect(me.body.y).toBeLessThan(12);
    expect(impact).toBeGreaterThan(17);
    expect(me.hp).toBe(100);
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

  it('blowtorch burns anybody it walks into over the whole three seconds, and shoves them', () => {
    // It carries itself about six units in three seconds; anybody inside that is caught, and
    // anybody past it is not. Aimed level, on flat ground, so only the walk decides.
    const reach = (gap: number) => {
      const g = flatGame([40, 40 + gap], [team('A', 1), team('B', 1)]);
      toAiming(g);
      const [me, victim] = [g.buddies[0], g.buddies[1]];
      me.facing = 1;
      me.aim = 0;
      g.selectWeapon('torch');
      g.pressFire();
      // The shove is only visible in the frame it happens, so it is caught as the damage lands.
      let launched = false;
      runUntil(
        g,
        () => {
          if (victim.hp < 100 && !launched) launched = victim.body.vy > 0;
          return g.phase !== 'torching';
        },
        6,
      );
      return { hp: victim.hp, launched, walked: me.body.x - 40 };
    };
    expect(reach(4).hp).toBe(100 - WEAPONS.torch.damage);
    expect(reach(8).hp).toBe(100 - WEAPONS.torch.damage);
    // The flame shoves as well as burns: always upwards, never straight into the ground.
    expect(reach(4).launched).toBe(true);
    // Out of walking range in three seconds, so untouched.
    expect(reach(12).hp).toBe(100);
    expect(reach(4).walked).toBeGreaterThan(4);
  });

  it('blowtorch does not care whose side it burns', () => {
    const g = flatGame([40, 100, 42.5], [team('A', 2), team('B', 1)]);
    toAiming(g);
    const [torcher, mate] = g.teams[0].buddies;
    mate.body.x = 42.5;
    mate.body.vx = mate.body.vy = 0;
    torcher.facing = 1;
    torcher.aim = 0;
    g.selectWeapon('torch');
    g.pressFire();
    runUntil(g, () => g.phase !== 'torching', 6);
    // A flame is a flame. Burning your own team ends your turn, like any other self-inflicted hurt.
    expect(mate.hp).toBe(100 - WEAPONS.torch.damage);
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
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'shot') shots.push(e.x1);
        return g.phase !== 'firing';
      },
      3,
    );
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

  it('leaves a tombstone where a buddy died, which blasts knock around and water swallows', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 2)]);
    toAiming(g);
    const victim = g.buddies[1];
    victim.hp = 5;
    g.explode(victim.body.x, victim.body.y - 0.5, 2.5, 30, 2);
    g.skipTurn();
    runUntil(g, () => g.graves.length > 0, 10);
    expect(g.graves).toHaveLength(1);
    const grave = g.graves[0];
    expect(grave.name).toBe(victim.name);
    expect(Math.abs(grave.body.x - victim.body.x)).toBeLessThan(1);
    runUntil(g, () => grave.body.grounded && grave.body.restTime > 0.3, 5);
    const x = grave.body.x;
    g.explode(x - 1.5, grave.body.y - 0.3, 3, 20, 10);
    g.simulate(0.5);
    expect(grave.body.x).toBeGreaterThan(x + 0.5);
    g.terrain.carve(grave.body.x, 10, 12);
    runUntil(g, () => g.graves.length === 0, 5);
    expect(g.graves).toHaveLength(0);
  });

  it('leaves no tombstone for a drowned buddy', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 2)]);
    toAiming(g);
    g.terrain.carve(70, 12, 12);
    runUntil(g, () => !g.buddies[1].alive, 10);
    g.simulate(1);
    expect(g.graves).toHaveLength(0);
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

  it('the flamethrower sprays for three seconds, steers with up and down, and lays a carpet', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { turnTime: 45, windMax: 0 });
    toAiming(g);
    const b = g.buddies[0];
    b.facing = 1;
    b.aim = 0.3;
    g.selectWeapon('flamer');
    expect(g.teams[0].ammo.flamer).toBe(2);
    g.pressFire();
    expect(g.phase).toBe('spraying');
    expect(g.teams[0].ammo.flamer).toBe(1);

    // It throws a stream of gobs rather than one shot.
    g.simulate(0.4);
    const flamer = defined(g.flamer, 'flamer running');
    expect(flamer.emitted).toBeGreaterThan(4);

    // Up and down swing the nozzle while it runs, further than the ordinary aim limits allow.
    const started = flamer.aim;
    g.input.up = true;
    g.simulate(0.5);
    expect(defined(g.flamer, 'still spraying').aim).toBeGreaterThan(started);
    g.input.up = false;
    g.input.down = true;
    g.simulate(1.2);
    const lowered = defined(g.flamer, 'still spraying').aim;
    expect(lowered).toBeLessThan(started);

    // Three seconds and it is out, and the turn goes to retreat like any other used weapon.
    runUntil(g, () => g.phase === 'retreat', 6);
    expect(g.phase).toBe('retreat');
    expect(g.action).toBeNull();
    // What it leaves behind is fire on the ground, not a hole in it.
    runUntil(g, () => g.projectiles.length === 0, 6);
    expect(g.flames.length).toBeGreaterThan(3);
  });

  it('the flamethrower burns whoever stands in the stream', () => {
    const g = flatGame([40, 46], [team('A', 1), team('B', 1)], { turnTime: 45, windMax: 0 });
    toAiming(g);
    const victim = g.buddies[1];
    g.buddies[0].facing = 1;
    g.buddies[0].aim = 0.12;
    g.selectWeapon('flamer');
    g.pressFire();
    runUntil(g, () => victim.hp < 100, 4);
    expect(victim.hp).toBeLessThan(100);
    // Mediocre damage on purpose: the point is the ground it leaves burning, not the stream itself.
    expect(victim.hp).toBeGreaterThan(20);
  });

  it('the Ming vase is one per match, bursts enormously and throws eight shards', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)]);
    toAiming(g);
    // The rarest thing in the arsenal: exactly one, and it is a special, so crates can restrict it.
    expect(WEAPONS.ming.ammo).toBe(1);
    expect(WEAPONS.ming.special).toBe(true);
    expect(g.teams[0].ammo.ming).toBe(1);
    g.selectWeapon('ming');
    expect(g.weapon).toBe('ming');
    g.buddies[0].aim = 1;
    g.pressFire();
    g.simulate(0.2);
    g.releaseFire();
    expect(g.teams[0].ammo.ming).toBe(0);

    let shards = 0;
    const blasts: number[] = [];
    runUntil(
      g,
      () => {
        shards = Math.max(shards, g.projectiles.filter((p) => p.weapon === 'shard').length);
        for (const e of g.drainEvents()) if (e.type === 'explosion') blasts.push(e.radius);
        return blasts.length >= 9;
      },
      14,
    );
    // The vase itself, then one shard at a time.
    expect(shards).toBe(8);
    expect(blasts.length).toBeGreaterThanOrEqual(9);
    // Its first blast is the largest thing in the game short of the holy grenade.
    expect(Math.max(...blasts)).toBeGreaterThanOrEqual(WEAPONS.ming.radius);
    expect(WEAPONS.ming.radius).toBeGreaterThan(WEAPONS.banana.radius);
    // And every shard hits appreciably harder than a banana fragment does.
    expect(WEAPONS.shard.damage).toBeGreaterThan(WEAPONS.bananalet.damage);
    expect(WEAPONS.shard.radius).toBeGreaterThan(WEAPONS.bananalet.radius);
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
    runUntil(
      g,
      () => {
        fragments = Math.max(fragments, g.projectiles.filter((p) => p.weapon === 'bananalet').length);
        bounced ||= g.projectiles.some((p) => p.weapon === 'bananalet' && p.bounces > 0);
        for (const e of g.drainEvents()) if (e.type === 'explosion') booms.push(g.time);
        return booms.length >= 6;
      },
      10,
    );
    expect(fragments).toBe(5);
    expect(bounced).toBe(true);
    expect(booms).toHaveLength(6);
    expect(booms[5] - booms[1]).toBeGreaterThan(0.7);
  });

  it('a bomblet deals 10 damage on a direct hit', () => {
    const g = flatGame([40, 80], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const enemy = g.buddies[1];
    g.projectiles.push({
      id: 999,
      weapon: 'bomblet',
      x: enemy.body.x,
      y: enemy.body.y + 3,
      vx: 0,
      vy: -5,
      radius: 0.15,
      bounces: 0,
      fuse: 0,
      age: 1,
      owner: g.buddies[0].id,
    });
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
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) {
          events.push(e);
          if (e.type === 'explosion') craters.push(e.x);
        }
        return craters.length >= 5;
      },
      8,
    );
    expect(events.some((e) => e.type === 'airstrike')).toBe(true);
    expect(craters).toHaveLength(5);
    const center = craters.reduce((a, b) => a + b, 0) / craters.length;
    expect(Math.abs(center - 70)).toBeLessThan(1.5);
    expect(Math.max(...craters) - Math.min(...craters)).toBeGreaterThan(4);
    expect(g.buddies[1].hp).toBeLessThan(70);
    expect(g.buddies[0].hp).toBe(100);
  });

  it('arrow keys choose the side an air strike plane flies in from, without walking the buddy', () => {
    for (const weapon of ['airstrike', 'napalm'] as const) {
      const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
      toAiming(g);
      g.selectWeapon(weapon);
      expect(g.choosingApproach).toBe(true);
      // The default is the side the buddy already faces, so a click alone behaves as before.
      expect(g.strikeDir).toBe(g.buddies[0].facing);

      const startX = g.buddies[0].body.x;
      g.input.right = true;
      g.simulate(0.5);
      expect(g.strikeDir).toBe(-1);
      g.input.left = true;
      g.simulate(0.3);
      expect(g.strikeDir).toBe(-1); // both held: leave the choice alone
      g.input.right = false;
      g.simulate(0.5);
      expect(g.strikeDir).toBe(1);
      g.input.left = false;
      expect(g.buddies[0].body.x).toBeCloseTo(startX, 5);

      const events: GameEvent[] = [];
      g.strike(50);
      for (const e of g.drainEvents()) events.push(e);
      const called = events.find((e) => e.type === 'airstrike');
      expect(called).toBeDefined();
      if (called?.type !== 'airstrike') throw new Error('no strike event');
      expect(called.dir).toBe(1);
      // dir 1 means the plane enters on the left, so it starts well left of where it bombs.
      expect(called.startX).toBeLessThan(called.target - 20);
    }
  });

  it('an air strike called from the right mirrors the approach and still lands on the target', () => {
    const craters: Record<string, number[]> = {};
    for (const dir of [1, -1] as const) {
      const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
      toAiming(g);
      g.selectWeapon('airstrike');
      g.setStrikeDir(dir);
      g.strike(70);
      const hits: number[] = [];
      runUntil(
        g,
        () => {
          for (const e of g.drainEvents()) if (e.type === 'explosion') hits.push(e.x);
          return hits.length >= 5;
        },
        8,
      );
      craters[dir] = hits;
      expect(hits).toHaveLength(5);
      const center = hits.reduce((a, b) => a + b, 0) / hits.length;
      expect(Math.abs(center - 70)).toBeLessThan(1.5);
    }
    // Same pattern either way, only the order the bombs fall in is mirrored.
    const left = [...craters[1]].sort((a, b) => a - b);
    const right = [...craters[-1]].sort((a, b) => a - b);
    for (let k = 0; k < 5; k++) expect(Math.abs(left[k] - right[k])).toBeLessThan(1.5);
    expect(craters[1][0]).toBeLessThan(craters[1][4]);
    expect(craters[-1][0]).toBeGreaterThan(craters[-1][4]);
  });

  it('the concrete mule ignores the approach side, because it has no plane', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('mule');
    expect(g.choosingApproach).toBe(false);
    const startX = g.buddies[0].body.x;
    g.input.right = true;
    g.simulate(0.5);
    // Left and Right still walk while a plane-less strike is selected.
    expect(g.buddies[0].body.x).toBeGreaterThan(startX);
  });

  it('concrete mule drops onto the target and smashes down through the ground several times', () => {
    const g = flatGame([30, 70], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('mule');
    g.strike(70);
    expect(g.teams[0].ammo.mule).toBe(0);
    expect(g.phase).toBe('retreat');
    const craters: { x: number; y: number }[] = [];
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'explosion') craters.push({ x: e.x, y: e.y });
        return g.projectiles.length === 0 && g.drops.length === 0 && craters.length > 0;
      },
      15,
    );
    expect(craters.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(craters[0].x - 70)).toBeLessThan(1);
    expect(craters[craters.length - 1].y).toBeLessThan(craters[0].y - 4);
    expect(g.buddies[1].hp).toBeLessThan(65);
  });

  it('napalm strike sets the ground around the target aflame for several seconds', () => {
    const g = flatGame([30, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('napalm');
    g.strike(70);
    expect(g.drops).toHaveLength(4);
    runUntil(g, () => g.flames.length > 0, 8);
    expect(g.flames.length).toBeGreaterThanOrEqual(8);
    for (const f of g.flames) {
      expect(Math.abs(f.x - 70)).toBeLessThan(10);
      // On the ground: the surface, or the floor of a canister's small crater.
      expect(f.y).toBeGreaterThan(18.5);
      expect(f.y).toBeLessThan(20.5);
    }
    runUntil(g, () => g.drops.length === 0 && g.projectiles.length === 0, 12);
    const burning = g.time;
    const groundBefore = g.terrain.solidFraction();
    runUntil(g, () => g.flames.length === 0, 14);
    expect(g.flames).toHaveLength(0);
    // Nine seconds of napalm, give or take the spread of the individual patches.
    expect(g.time - burning).toBeGreaterThan(5);
    expect(g.time - burning).toBeLessThanOrEqual(9.05);
    // And it ate its way into the ground it burnt on.
    expect(g.terrain.solidFraction()).toBeLessThan(groundBefore);
    expect(g.terrain.isSolid(70, 20)).toBe(false);
  });

  it('a single flame burns a dent into the ground and sinks into it', () => {
    const g = flatGame([30, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const surface = 20;
    g.flames.push({ id: 995, x: 60, y: surface + 0.1, life: 6, bite: FLAME_BITE_INTERVAL, bitesLeft: FLAME_BITES });
    expect(g.terrain.isSolid(60, surface - 0.3)).toBe(true);
    runUntil(g, () => g.flames.length === 0, 10);
    // The rock under it is gone and the flame followed it down — a scorched carpet, not a trench:
    // three shallow bites rather than four deep ones, so what is left is ankle-deep.
    expect(g.terrain.isSolid(60, surface - 0.3)).toBe(false);
    expect(g.terrain.isSolid(60, surface - 0.7)).toBe(false);
    expect(g.terrain.isSolid(60, surface - 1.1)).toBe(true);
  });

  it('napalm is carried far by the wind', () => {
    const land = (wind: number) => {
      const g = flatGame([30, 110], [team('A', 1), team('B', 1)], { windMax: 1 });
      toAiming(g);
      g.wind = wind;
      g.buddies[0].facing = 1;
      g.selectWeapon('napalm');
      g.strike(64);
      let x = 0;
      runUntil(
        g,
        () => {
          const e = g.drainEvents().find((ev) => ev.type === 'ignite');
          if (e?.type === 'ignite') x = e.x;
          return x !== 0;
        },
        10,
      );
      return x;
    };
    expect(land(1) - land(0)).toBeGreaterThan(8);
    expect(land(0) - land(-1)).toBeGreaterThan(8);
  });

  it('flames make a buddy hop away with tiny damage and go out in water', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    const enemy = g.buddies[1];
    g.flames.push({ id: 990, x: enemy.body.x - 0.3, y: 20.05, life: 1.5, bite: FLAME_BITE_INTERVAL, bitesLeft: FLAME_BITES });
    g.step();
    expect(enemy.hp).toBe(97);
    expect(enemy.body.vy).toBeGreaterThan(5);
    expect(enemy.body.vx).toBeGreaterThan(0);
    // A flame over a flooded crater sinks and is put out.
    g.terrain.carve(60, 10, 12);
    g.flames.push({ id: 991, x: 60, y: 20.05, life: 10, bite: FLAME_BITE_INTERVAL, bitesLeft: FLAME_BITES });
    g.simulate(1);
    expect(g.flames.find((f) => f.id === 991)!.y).toBeLessThan(15);
    g.simulate(2);
    expect(g.flames.find((f) => f.id === 991)).toBeUndefined();
  });

  it('air strike allows for wind', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)], { windMax: 1 });
    toAiming(g);
    g.wind = -1;
    g.selectWeapon('airstrike');
    g.buddies[0].facing = 1;
    g.strike(60);
    const craters: number[] = [];
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'explosion') craters.push(e.x);
        return craters.length >= 5;
      },
      8,
    );
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

describe('weapon table', () => {
  it('declares a model and flight sound for every projectile, so none falls back silently', () => {
    for (const id of WEAPON_IDS) {
      const def = WEAPONS[id];
      if (def.kind !== 'projectile') continue;
      expect(def.look.projectile, `${id} projectile model`).toBeDefined();
      expect(def.look.flight, `${id} flight sound`).toBeDefined();
    }
    for (const id of WEAPON_ORDER) {
      const { look, kind } = WEAPONS[id];
      if (kind === 'melee') expect(look.hitSound, `${id} hit sound`).toBeDefined();
      if (kind === 'projectile' || kind === 'hitscan') expect(look.fireSound, `${id} fire sound`).toBeDefined();
    }
  });
});

describe('sudden death', () => {
  const toTurn = (g: Game, turn: number) => {
    for (let k = 0; k < turn * 2; k++) {
      runUntil(g, () => g.phase === 'aiming', 20);
      if (g.turn >= turn) return;
      g.skipTurn();
      runUntil(g, () => g.phase === 'turnStart', 20);
    }
  };

  it('drops every living buddy to 1 HP on the configured turn, once, killing nobody', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { suddenDeath: 4, turnTime: 1 });
    const struck: number[] = [];
    g.buddies[1].hp = 37;
    toTurn(g, 3);
    expect(g.buddies[0].hp).toBe(100);
    toTurn(g, 4);
    for (const e of g.drainEvents()) if (e.type === 'suddenDeath') struck.push(e.turn);
    expect(struck).toEqual([4]);
    expect(g.buddies.map((b) => b.hp)).toEqual([1, 1]);
    // The strike itself finishes nobody off: it leaves 1 HP, not 0.
    expect(g.buddies.every((b) => b.alive)).toBe(true);

    // It strikes once: later turns leave the 1 HP alone rather than striking again.
    toTurn(g, 6);
    expect(g.buddies.map((b) => b.hp)).toEqual([1, 1]);

    // From here on the lightest scratch is lethal.
    g.explode(g.buddies[1].body.x, g.buddies[1].body.y, 3, 10, 5);
    expect(g.buddies[1].hp).toBe(0);
  });

  it('stays out of the way when it is switched off', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { suddenDeath: 0, turnTime: 1 });
    toTurn(g, 6);
    expect(g.buddies[0].hp).toBe(100);
    expect(g.buddies[1].hp).toBe(100);
    expect(g.waterRising).toBe(false);
    expect(g.terrain.waterLevel).toBe(3);
  });

  it('raises the water one step per turn, never by the second', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { suddenDeath: 2, turnTime: 20 });
    const initial = g.terrain.waterLevel;
    toTurn(g, 2);
    expect(g.waterRising).toBe(true);
    // The strike turn itself stays dry, so the announcement and the first rise do not collide.
    expect(g.terrain.waterLevel).toBe(initial);
    // Sitting out the whole turn floods no more than playing it: the level holds until the next turn.
    runUntil(g, () => g.phase === 'aiming', 20);
    for (let s = 0; s < 10 * 60; s++) g.step(1 / 60);
    expect(g.turn).toBe(2);
    expect(g.terrain.waterLevel).toBe(initial);
    toTurn(g, 3);
    expect(g.terrain.waterLevel).toBe(initial + SUDDEN_DEATH_WATER_RISE);
    toTurn(g, 5);
    expect(g.terrain.waterLevel).toBe(initial + 3 * SUDDEN_DEATH_WATER_RISE);
  });

  it('ends the turn at once when the water drowns the buddy whose turn it is', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { suddenDeath: 2, turnTime: 45 });
    toTurn(g, 2);
    // The buddy that plays next sits in a pit; its opponent stays on high ground.
    const victim = g.buddies[0];
    g.terrain.carve(victim.body.x, 18, 3);
    expect(runUntil(g, () => victim.body.grounded && victim.body.y < 17, 5)).toBe(true);
    // One more rise puts the pit under water, the open ground stays dry.
    g.terrain.waterLevel = victim.body.y - SUDDEN_DEATH_WATER_RISE + 0.5;
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 3, 20)).toBe(true);
    expect(g.activeBuddy).toBe(victim);
    // The clock says 45 seconds, but a drowned buddy's turn is over within its intro.
    expect(runUntil(g, () => !victim.alive, 3)).toBe(true);
    expect(g.buddies[1].alive).toBe(true);
    expect(runUntil(g, () => g.phase !== 'turnStart', 3)).toBe(true);
    expect(g.phase).not.toBe('aiming');
    expect(runUntil(g, () => g.phase === 'gameOver', 20)).toBe(true);
  });

  it('announces every rise, so the camera and the HUD can show it', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { suddenDeath: 2, turnTime: 1 });
    toTurn(g, 3);
    const rises = g.drainEvents().filter((e) => e.type === 'waterRise');
    expect(rises).toHaveLength(1);
    expect(rises[0].level).toBe(g.terrain.waterLevel);
  });

  it('drowns a buddy sheltered under a rock roof once the water reaches it', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { suddenDeath: 2, turnTime: 1 });
    const buddy = g.buddies[0];
    // A rock roof over the buddy does not keep the flood out.
    g.terrain.carve(buddy.body.x, 5, 2.5);
    buddy.body.y = 3.3;
    buddy.body.vy = 0;
    buddy.body.grounded = true;
    toTurn(g, 3);
    expect(g.terrain.isSolid(buddy.body.x, 9)).toBe(true);
    expect(buddy.alive).toBe(false);
    expect(g.drainEvents().some((e) => e.type === 'drown' && e.buddy === buddy.id)).toBe(true);
  });
});

describe('starting arsenal', () => {
  const BASIC: WeaponId[] = ['bazooka', 'grenade', 'shotgun', 'punch', 'cluster', 'bat', 'torch', 'drill', 'rope', 'platform'];

  it('hands every team the basic weapons from turn one, under every arsenal setting', () => {
    for (const arsenal of ['all', 'crates', 'infinite'] as const) {
      const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { arsenal, crates: 1 });
      // "Infinite supplies" hands out more, never less, than the weapon's own stock.
      for (const id of BASIC) expect({ arsenal, id, stocked: g.teams[0].ammo[id] >= WEAPONS[id].ammo }).toEqual({ arsenal, id, stocked: true });
    }
  });

  it('never locks a basic weapon away in crates', () => {
    for (const id of BASIC) expect(WEAPONS[id].special).toBeUndefined();
    for (const id of CRATE_WEAPONS) expect(BASIC).not.toContain(id);
  });
});

describe('weapon hotkeys', () => {
  it('map 1–9 and 0 to the first ten weapons and Shift+digits to the rest', () => {
    expect(weaponForKey(1, false)).toBe(WEAPON_ORDER[0]);
    expect(weaponForKey(9, false)).toBe(WEAPON_ORDER[8]);
    expect(weaponForKey(0, false)).toBe(WEAPON_ORDER[9]);
    expect(weaponForKey(1, true)).toBe(WEAPON_ORDER[10]);
    expect(weaponForKey(0, true)).toBe(WEAPON_ORDER[19]);
    expect(weaponForKey(9, true)).toBe(WEAPON_ORDER[18]);
    expect(weaponForKey(11, true)).toBeNull();
    // Past the twenty digit slots a weapon needs a letter key, and every one of them has to exist.
    for (const [code, id] of Object.entries(LETTER_KEYS)) {
      const weapon = defined(id, `letter key ${code}`);
      expect(WEAPON_ORDER).toContain(weapon);
      expect(hotkeyLabel(WEAPON_ORDER.indexOf(weapon))).toBe(code.slice(3));
    }
    expect(WEAPON_ORDER.slice(20).every((id) => Object.values(LETTER_KEYS).includes(id))).toBe(true);
    WEAPON_ORDER.slice(0, 20).forEach((id, k) => {
      const label = hotkeyLabel(k);
      const shift = label.startsWith('⇧');
      expect(weaponForKey(Number(label.replace('⇧', '')), shift)).toBe(id);
    });
  });
});

describe('platform', () => {
  const placing = () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.selectWeapon('platform');
    return g;
  };

  it('sets a tilted board in mid-air, spends one of two uses and ends the turn', () => {
    const g = placing();
    expect(g.teams[0].ammo.platform).toBe(2);
    expect(g.placePlatform({ x: 50, y: 25, angle: 0.15 })).toBe(true);
    expect(g.phase).toBe('retreat');
    expect(g.teams[0].ammo.platform).toBe(1);
    expect(g.terrain.platforms).toEqual([{ x: 50, y: 25, angle: 0.15, cos: Math.cos(0.15), sin: Math.sin(0.15) }]);
    expect(g.drainEvents().some((e) => e.type === 'platformPlaced' && e.weapon === 'platform')).toBe(true);
  });

  it('carries a falling buddy and survives a blast underneath it', () => {
    const g = placing();
    expect(g.placePlatform({ x: 50, y: 25, angle: 0 })).toBe(true);
    const b = g.buddies[1];
    b.body.x = 50;
    b.body.y = 29;
    b.body.vy = 0;
    b.body.grounded = false;
    expect(runUntil(g, () => b.body.grounded, 5)).toBe(true);
    expect(b.body.y).toBeGreaterThan(25);
    expect(b.hp).toBe(100);
    g.explode(50, 24, 6, 0, 0);
    expect(g.terrain.isSolid(50, 25)).toBe(true);
  });

  it('refuses buried, submerged, over-tilted and occupied spots without spending a use', () => {
    const g = placing();
    g.crates.push({ id: 900, kind: 'health', weapon: null, body: createBody(70, 25, CRATE_RADIUS) });
    g.mines.push({ id: 901, owner: 0, team: 0, body: createBody(80, 25, 0.25), state: 'armed', age: 2, fuse: 0 });
    for (const at of [
      { x: 50, y: 20, angle: 0 },
      { x: 50, y: 3, angle: 0 },
      { x: 20, y: 20.6, angle: 0 },
      { x: 70, y: 25, angle: 0 },
      { x: 80, y: 25, angle: 0 },
      { x: 50, y: 25, angle: Math.PI },
    ]) {
      expect({ at, placed: g.placePlatform(at) }).toEqual({ at, placed: false });
    }
    expect(g.teams[0].ammo.platform).toBe(2);
    expect(g.phase).toBe('aiming');
  });

  it('is set by clicking, never by the fire button, and only while the weapon is in stock', () => {
    const g = placing();
    g.pressFire();
    expect(g.charge).toBeNull();
    expect(g.phase).toBe('aiming');
    g.teams[0].ammo.platform = 0;
    expect(g.placePlatform({ x: 50, y: 25, angle: 0 })).toBe(false);
    expect(g.terrain.platforms).toHaveLength(0);
  });
});

describe('gravity setting', () => {
  const apex = (g: Game) => {
    const b = g.buddies[0];
    toAiming(g);
    const start = b.body.y;
    g.jump();
    let top = start;
    for (let k = 0; k < 180; k++) {
      g.step(1 / 60);
      top = Math.max(top, b.body.y);
    }
    return top - start;
  };

  it('defaults to the ordinary world and scales jumps with the setting', () => {
    const normal = flatGame([20, 100], [team('A', 1), team('B', 1)]);
    expect(normal.terrain.gravityScale).toBe(1);
    const moon = flatGame([20, 100], [team('A', 1), team('B', 1)], { gravity: 0.55 });
    const heavy = flatGame([20, 100], [team('A', 1), team('B', 1)], { gravity: 1.5 });
    const jumps = [apex(moon), apex(normal), apex(heavy)];
    expect(jumps[0]).toBeGreaterThan(jumps[1] * 1.4);
    expect(jumps[2]).toBeLessThan(jumps[1]);
  });

  it('throws a grenade further on the moon than in a heavy world', () => {
    // Same buddy, same aim, same full charge: only the pull differs.
    const range = (gravity: number) => {
      const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { gravity });
      toAiming(g);
      g.selectWeapon('grenade');
      g.buddies[0].aim = 0.7;
      g.face(1);
      g.pressFire();
      expect(runUntil(g, () => g.projectiles.length > 0, 3)).toBe(true);
      const from = g.buddies[0].body.x;
      let last = g.projectiles[0].x;
      runUntil(
        g,
        () => {
          last = g.projectiles[0]?.x ?? last;
          return g.projectiles.length === 0;
        },
        20,
      );
      return last - from;
    };
    expect(range(0.55)).toBeGreaterThan(range(1.5) * 1.3);
  });

  it('hurts less on a long fall under low gravity', () => {
    const damage = (gravity: number) => {
      const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { gravity });
      toAiming(g);
      const b = g.buddies[0];
      b.body.y += 18;
      b.body.grounded = false;
      runUntil(g, () => b.body.grounded, 10);
      return 100 - b.hp;
    };
    expect(damage(0.55)).toBeLessThan(damage(1.5));
  });
});

describe('throwing range', () => {
  /** How far the first blast of a charged throw lands from the buddy. */
  const blastRange = (weapon: WeaponId, aim: number) => {
    const g = flatGame([20, 110], [team('A', 1), team('B', 1)], { turnTime: 60 });
    toAiming(g);
    g.selectWeapon(weapon);
    g.buddies[0].aim = aim;
    g.face(1);
    const from = g.buddies[0].body.x;
    g.pressFire();
    expect(runUntil(g, () => g.projectiles.length > 0, 3)).toBe(true);
    let blast = 0;
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'explosion' && !blast) blast = e.x - from;
        return blast !== 0;
      },
      12,
    );
    return blast;
  };

  // Players reported the banana bomb as short-ranged (T36). It shares the grenade's speeds, so a
  // full charge must carry it just as far; this guards that from an accidental nerf.
  it('throws the banana bomb as far as the grenade at the same aim and charge', () => {
    for (const aim of [0.35, 0.6, 0.79]) {
      const banana = blastRange('banana', aim);
      const grenade = blastRange('grenade', aim);
      expect({ aim, short: banana < grenade - 2 }).toEqual({ aim, short: false });
      expect(banana).toBeGreaterThan(40);
    }
  });
});

describe('teleport', () => {
  const ready = () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { arsenal: 'all', turnTime: 45 });
    toAiming(g);
    g.selectWeapon('teleport');
    return g;
  };

  it('beams the buddy to the clicked spot, once per match, and ends the turn', () => {
    const g = ready();
    expect(g.teams[0].ammo.teleport).toBe(1);
    const b = g.buddies[0];
    expect(g.teleportTo(70, 30)).toBe(true);
    expect(b.body.x).toBe(70);
    expect(b.body.y).toBe(30);
    expect(g.teams[0].ammo.teleport).toBe(0);
    expect(g.phase).toBe('retreat');
    const arrival = g.drainEvents().find((e) => e.type === 'teleport');
    expect(arrival).toMatchObject({ buddy: b.id, x: 70, y: 30 });
    // It arrives standing still and unsupported: from here on it is an ordinary falling body.
    expect(b.body.vx).toBe(0);
    expect(b.body.vy).toBe(0);
    expect(b.body.grounded).toBe(false);
  });

  it('answers the same question the cursor asks, so the preview cannot lie', () => {
    const g = ready();
    const b = g.buddies[0];
    // Open air well above the ground: free, and the click agrees.
    expect(g.canTeleportTo(70, 30)).toBe(true);
    // Inside the rock: refused, and refusing costs neither the turn nor the use.
    expect(g.terrain.isSolid(70, 15)).toBe(true);
    expect(g.canTeleportTo(70, 15)).toBe(false);
    expect(g.teleportTo(70, 15)).toBe(false);
    expect(g.teams[0].ammo.teleport).toBe(1);
    expect(g.phase).toBe('aiming');
    // Off the map, and nonsense, are refused the same way.
    expect(g.canTeleportTo(-5, 30)).toBe(false);
    expect(g.canTeleportTo(g.terrain.width + 5, 30)).toBe(false);
    expect(g.canTeleportTo(Number.NaN, 30)).toBe(false);
    // Too tight to stand in: closer to the rock than the buddy is wide.
    expect(g.canTeleportTo(70, 20 + b.body.radius * 0.5)).toBe(false);
  });

  it('lets the buddy fall from where it arrives, with the usual fall damage', () => {
    const g = ready();
    const b = g.buddies[0];
    expect(g.teleportTo(70, 45)).toBe(true);
    expect(runUntil(g, () => b.body.grounded, 10)).toBe(true);
    expect(b.body.y).toBeLessThan(21.5);
    expect(b.hp).toBeLessThan(100);
  });

  it('drowns a buddy that beams itself over the water', () => {
    const g = ready();
    const b = g.buddies[0];
    // A shaft down past the waterline, and a jump straight into it.
    g.terrain.carve(70, 6, 5);
    expect(g.teleportTo(70, 10)).toBe(true);
    expect(runUntil(g, () => !b.alive, 10)).toBe(true);
    expect(g.drainEvents().some((e) => e.type === 'drown' && e.buddy === b.id)).toBe(true);
  });

  it('refuses rock, spots off the map and a second use, and never costs the turn for it', () => {
    const g = ready();
    for (const [x, y] of [
      [70, 10],
      [-5, 30],
      [200, 30],
      [70, Number.NaN],
    ]) {
      expect({ x, y, ok: g.teleportTo(x, y) }).toEqual({ x, y, ok: false });
    }
    expect(g.teams[0].ammo.teleport).toBe(1);
    expect(g.phase).toBe('aiming');
    // The fire button does nothing at all: this one is pointed with the mouse.
    g.pressFire();
    expect(g.charge).toBeNull();
    expect(g.phase).toBe('aiming');
    expect(g.teleportTo(70, 30)).toBe(true);
    expect(g.teleportTo(60, 30)).toBe(false);
  });
});

describe('weapon voices', () => {
  /** What each weapon should sound like when it is used; see docs/SOUND.md for the reasoning. */
  const VOICES: Partial<Record<WeaponId, string | undefined>> = {
    bazooka: 'fire',
    grenade: 'throw',
    cluster: 'throw',
    holy: 'throw',
    banana: 'throw',
    ming: 'throw',
    shotgun: 'shot',
    minigun: 'spinup',
    torch: 'torchLight',
    flamer: 'torchLight',
    sheep: 'baa',
    flysheep: 'baa',
    selfdestruct: 'alarm',
    mine: 'clunk',
    rope: 'hookShot',
    platform: 'build',
    teleport: 'warp',
    punch: undefined,
    bat: undefined,
    drill: undefined,
    airstrike: undefined,
    napalm: undefined,
    mule: undefined,
  };

  it('gives every weapon the voice its action calls for', () => {
    for (const [id, sound] of Object.entries(VOICES)) {
      expect({ id, sound: WEAPONS[id as WeaponId].look.fireSound }).toEqual({ id, sound });
    }
  });

  it('never has a thrown weapon borrow the launcher\u2019s roar, and covers every selectable weapon', () => {
    const throwers = WEAPON_ORDER.filter((id) => WEAPONS[id].look.fireSound === 'throw');
    expect(throwers.length).toBeGreaterThanOrEqual(4);
    for (const id of throwers) expect(WEAPONS[id].look.flight).toBe('lob');
    // Only the bazooka roars, and it is the only weapon that launches something under power.
    expect(WEAPON_ORDER.filter((id) => WEAPONS[id].look.fireSound === 'fire')).toEqual(['bazooka']);
    // Every selectable weapon is accounted for above: no new weapon slips in without a decision.
    for (const id of WEAPON_ORDER) expect({ id, listed: id in VOICES }).toEqual({ id, listed: true });
  });
});

describe('crates', () => {
  const crateGame = (crates: number) => flatGame([20, 100], [team('A', 1), team('B', 1)], { crates, turnTime: 1 });
  const nextTurn = (g: Game) => {
    g.skipTurn();
    runUntil(g, () => g.phase === 'aiming', 20);
  };

  it('mystery boxes roll their contents when they are opened, not when they drop', () => {
    // The odds are a decision, not an accident, and they add up.
    expect(MYSTERY_ODDS.health + MYSTERY_ODDS.weapon + MYSTERY_ODDS.mine).toBeCloseTo(1, 6);
    const prizes = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const prize = openMystery(rng);
      prizes.add(prize.kind);
      if (prize.kind === 'weapon') expect(CRATE_WEAPONS).toContain(prize.weapon);
    }
    // All three outcomes really happen, so no branch is decoration.
    expect([...prizes].sort()).toEqual(['health', 'mine', 'weapon']);
    // And the same seed always tells the same joke.
    expect(openMystery(mulberry32(7))).toEqual(openMystery(mulberry32(7)));
  });

  it('a mystery box that holds a mine arms it under the buddy that opened it', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 40 });
    toAiming(g);
    const b = defined(g.activeBuddy, 'active buddy');
    // Drop a mystery box on the buddy, and keep rolling the crate stream until it hands out a mine.
    let laid = 0;
    for (let k = 0; k < 40 && laid === 0; k++) {
      g.crates.push({ id: 5000 + k, kind: 'mystery', weapon: null, body: createBody(b.body.x, b.body.y, CRATE_RADIUS) });
      g.simulate(1 / 30);
      laid = g.mines.length;
    }
    expect(laid).toBe(1);
    const mine = g.mines[0];
    // Live immediately: no arming grace for whoever was greedy, so it is already counting down
    // under the buddy that opened the box rather than waiting to be walked over later.
    expect(mine.state).not.toBe('unarmed');
    const hp = b.hp;
    runUntil(g, () => g.mines.length === 0, 6);
    expect(b.hp).toBeLessThan(hp);
    const pickup = g
      .drainEvents()
      .filter((e) => e.type === 'cratePickup')
      .at(-1);
    expect(pickup).toMatchObject({ kind: 'mine', mystery: true });
  });

  it('a mystery box that holds a goodie hands it over like any other crate', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 40 });
    toAiming(g);
    const b = defined(g.activeBuddy, 'active buddy');
    const hp = b.hp;
    b.hp = 40;
    let healed = false;
    for (let k = 0; k < 40 && !healed; k++) {
      g.crates.push({ id: 6000 + k, kind: 'mystery', weapon: null, body: createBody(b.body.x, b.body.y, CRATE_RADIUS) });
      g.simulate(1 / 30);
      healed = g.drainEvents().some((e) => e.type === 'cratePickup' && e.kind === 'health' && e.mystery);
      if (!healed) g.mines = [];
    }
    expect(healed).toBe(true);
    expect(b.hp).toBeGreaterThan(40);
    expect(hp).toBe(100);
  });

  it('leave a short-lived fire where a blast bursts them', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 40 });
    toAiming(g);
    // A crate standing on the flat ground, well clear of everybody.
    g.crates.push({ id: 4242, kind: 'health', weapon: null, body: createBody(60, 20 + CRATE_RADIUS, CRATE_RADIUS) });
    g.simulate(0.5);
    g.drainEvents();
    expect(g.flames).toHaveLength(0);
    g.explode(58, 20.5, 2.5, 5, 0);
    expect(g.crates).toHaveLength(0);
    // A couple of flames, not a napalm strike.
    expect(g.flames.length).toBeGreaterThanOrEqual(1);
    expect(g.flames.length).toBeLessThanOrEqual(CRATE_FIRE.flames);
    expect(g.drainEvents().some((e) => e.type === 'ignite')).toBe(true);
    // And they are out again within a few seconds, so they never hold a turn up.
    for (const f of g.flames) expect(f.life).toBeLessThanOrEqual(CRATE_FIRE.duration);
    runUntil(g, () => g.flames.length === 0, 8);
    expect(g.flames).toHaveLength(0);
  });

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

  it('crate craziness brings two crates every turn, up to a bigger cap', () => {
    const g = crateGame(2);
    toAiming(g);
    expect(g.crates).toHaveLength(0);
    nextTurn(g);
    expect(g.crates).toHaveLength(2);
    const spawns = g.drainEvents().filter((e) => e.type === 'crateSpawn');
    expect(spawns).toHaveLength(2);
    nextTurn(g);
    expect(g.crates).toHaveLength(4);
    for (let k = 0; k < 8; k++) nextTurn(g);
    // Four crates per crate a turn brings: twice the usual for craziness, and never more.
    expect(g.crates).toHaveLength(crateLimit(2));
    expect(crateLimit(2)).toBe(2 * MAX_CRATES);
    // Still real crate spots: on the ground and clear of the buddies.
    for (const c of g.crates) {
      expect(c.body.y).toBeCloseTo(20.45, 0);
      for (const b of g.buddies) expect(Math.abs(b.body.x - c.body.x)).toBeGreaterThan(2);
    }
  });

  it('a contact-fused projectile bursts on a crate instead of flying through it', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)]);
    toAiming(g);
    g.crates.push({ id: 900, kind: 'health', weapon: null, body: createBody(60, 20.45, CRATE_RADIUS) });
    g.projectiles.push({ id: 901, weapon: 'bazooka', x: 59, y: 20.45, vx: 20, vy: 0, radius: 0.15, bounces: 0, fuse: 0, age: 1, owner: -1 });
    const craters: number[] = [];
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'explosion') craters.push(e.x);
        return craters.length > 0;
      },
      3,
    );
    expect(craters[0]).toBeGreaterThan(59);
    expect(craters[0]).toBeLessThan(61);
    expect(g.crates).toHaveLength(0);
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

  it('never teleport into a tombstone', () => {
    const g = crateGame(1);
    toAiming(g);
    // Graves on every spot a crate could otherwise use would leave no room at all.
    for (let x = 6; x <= 122; x += 2.5) g.graves.push({ id: 5000 + x, buddy: 0, team: 0, name: 'X', body: createBody(x, 20.45, 0.45) });
    g.skipTurn();
    runUntil(g, () => g.phase === 'aiming', 20);
    expect(g.crates).toHaveLength(0);
    // With one gap left, the crate lands in the gap.
    g.graves = g.graves.filter((grave) => Math.abs(grave.body.x - 60) > 4);
    g.skipTurn();
    runUntil(g, () => g.phase === 'aiming', 20);
    expect(g.crates).toHaveLength(1);
    expect(Math.abs(g.crates[0].body.x - 60)).toBeLessThan(2);
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

  it('arsenal "infinite": every selectable weapon has unlimited ammo and never runs out', () => {
    const g = flatGame([30, 100], [team('A', 1), team('B', 1)], { arsenal: 'infinite' });
    toAiming(g);
    for (const id of WEAPON_ORDER) expect(g.teams[0].ammo[id]).toBe(Infinity);
    expect(g.teams[0].ammo.bomblet).toBe(0);
    g.selectWeapon('airstrike');
    g.strike(90);
    expect(g.teams[0].ammo.airstrike).toBe(Infinity);
  });

  it('a hopping sheep scoops up crates for the buddy that launched it', () => {
    const g = flatGame([20, 100], [team('A', 2), team('B', 1)], { crates: 0, turnTime: 30 });
    toAiming(g);
    const launcher = g.buddies[0];
    const mate = g.buddies.find((b) => b.team === launcher.team && b !== launcher)!;
    launcher.hp = 40;
    mate.hp = 40;
    g.selectWeapon('sheep');
    g.face(1);
    g.crates.push({ id: 910, kind: 'health', weapon: null, body: createBody(launcher.body.x + 4, 20.45, CRATE_RADIUS) });
    g.crates.push({ id: 911, kind: 'weapon', weapon: 'airstrike', body: createBody(launcher.body.x + 7, 20.45, CRATE_RADIUS) });
    const ammoBefore = g.teams[0].ammo.airstrike;
    g.pressFire();
    const picks: { buddy: number; kind: string; x: number }[] = [];
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'cratePickup') picks.push({ buddy: e.buddy, kind: e.kind, x: e.x });
        return picks.length >= 2;
      },
      8,
    );
    // Both crates go to the launcher, in the order the sheep reached them, and the sheep lives on.
    expect(picks.map((p) => p.kind)).toEqual(['health', 'weapon']);
    expect(picks.every((p) => p.buddy === launcher.id)).toBe(true);
    expect(picks[0].x).toBeLessThan(picks[1].x);
    expect(launcher.hp).toBe(65);
    expect(mate.hp).toBe(40);
    expect(g.teams[0].ammo.airstrike).toBe(ammoBefore + 1);
    expect(g.crates).toHaveLength(0);
    // Touching a crate must not have set the sheep off.
    expect(g.action?.kind).toBe('sheep');
  });

  it('a flying sheep sweeps up a crate it crosses at full speed, then still detonates', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 30 });
    toAiming(g);
    const launcher = g.buddies[0];
    launcher.hp = 10;
    g.selectWeapon('flysheep');
    g.face(1);
    launcher.aim = 0;
    g.pressFire();
    const flyer = g.action?.kind === 'flyer' ? g.action.flyer : null;
    expect(flyer).not.toBeNull();
    // Straight ahead of a sheep flying 9 units a second: one frame covers 0.15 units, the crate
    // is 0.75 wide, so an endpoint check would find it too — the sweep is what makes it certain.
    g.crates.push({ id: 912, kind: 'health', weapon: null, body: createBody(flyer!.x + 3, flyer!.y, CRATE_RADIUS) });
    const picks: { buddy: number; x: number }[] = [];
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'cratePickup') picks.push({ buddy: e.buddy, x: e.x });
        return picks.length >= 1;
      },
      5,
    );
    expect(picks).toHaveLength(1);
    expect(picks[0].buddy).toBe(launcher.id);
    expect(launcher.hp).toBe(35);
    expect(g.crates).toHaveLength(0);
    // It flew on and blew up later, rather than exploding on the crate.
    expect(g.action?.kind).toBe('flyer');
    runUntil(g, () => g.action === null, 12);
    expect(g.action).toBeNull();
  });

  it('a sheep whose launcher is already out leaves the crate on the map', () => {
    for (const state of ['dead', 'awaiting death'] as const) {
      const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 30 });
      toAiming(g);
      const launcher = g.buddies[0];
      g.selectWeapon('sheep');
      g.face(1);
      g.crates.push({ id: 913, kind: 'health', weapon: null, body: createBody(launcher.body.x + 4, 20.45, CRATE_RADIUS) });
      g.pressFire();
      // Deaths are deferred, so a buddy on 0 HP is still `alive`; healing it would undo that.
      launcher.hp = 0;
      if (state === 'dead') launcher.alive = false;
      const picks = runUntil(
        g,
        () => {
          return g.drainEvents().some((e) => e.type === 'cratePickup');
        },
        6,
      );
      expect(picks).toBe(false);
      expect(g.crates).toHaveLength(1);
      expect(launcher.hp).toBe(0);
    }
  });

  it('a crate already taken by a buddy is not handed out twice by a passing sheep', () => {
    const g = flatGame([20, 100], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 30 });
    toAiming(g);
    const launcher = g.buddies[0];
    launcher.hp = 50;
    g.selectWeapon('sheep');
    g.face(1);
    // Right where the sheep is released, so the launcher and the sheep race for the same crate.
    g.crates.push({ id: 914, kind: 'health', weapon: null, body: createBody(launcher.body.x + 0.8, launcher.body.y, CRATE_RADIUS) });
    g.pressFire();
    const picks: number[] = [];
    runUntil(
      g,
      () => {
        for (const e of g.drainEvents()) if (e.type === 'cratePickup') picks.push(e.crate);
        return g.crates.length === 0;
      },
      6,
    );
    expect(picks).toEqual([914]);
    expect(launcher.hp).toBe(75);
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

describe('proximity mines', () => {
  /** Lay a mine and walk everybody out of its reach, which is what the retreat window is for. */
  const layMine = (g: Game, clear = true) => {
    toAiming(g);
    g.selectWeapon('mine');
    g.face(1);
    g.pressFire();
    const mine = g.mines[0];
    if (clear) {
      for (const b of g.buddies) {
        b.body.x = 100 + b.id;
        b.body.y = 20.6;
        b.body.vx = b.body.vy = 0;
      }
    }
    return mine;
  };

  it("is laid at the buddy's feet, arms after a delay and costs one ammo", () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { retreatTime: 5 });
    const before = g.teams[0].ammo.mine;
    const where = g.buddies[0].body.x;
    const mine = layMine(g);
    const laidAt = Math.abs(mine.body.x - where);
    expect(mine).toBeDefined();
    const layer = g.buddies.find((b) => b.id === mine.owner)!;
    expect(laidAt).toBeLessThan(1.5);
    expect(g.teams[0].ammo.mine).toBe(before - 1);
    expect(mine.state).toBe('unarmed');
    expect(g.phase).toBe('retreat');
    // Still harmless while the buddy that laid it runs clear.
    g.simulate(MINE_ARM_TIME - 0.2);
    expect(mine.state).toBe('unarmed');
    expect(layer.hp).toBe(100);
    g.simulate(0.4);
    expect(mine.state).toBe('armed');
  });

  it('goes off for anyone who comes close, after its own short fuse', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { retreatTime: 5, turnTime: 40 });
    const mine = layMine(g);
    g.simulate(MINE_ARM_TIME + 0.2);
    expect(mine.state).toBe('armed');
    const victim = g.buddies[1];
    victim.body.x = mine.body.x + MINE_TRIGGER_RANGE + 1;
    victim.body.y = mine.body.y;
    g.step();
    expect(mine.state).toBe('armed');
    victim.body.x = mine.body.x + 1;
    g.step();
    expect(mine.state).toBe('triggered');
    // It goes off even when the victim runs away again.
    victim.body.x = mine.body.x + 25;
    g.simulate(MINE_FUSE - 0.2);
    expect(g.mines).toHaveLength(1);
    g.simulate(0.3);
    expect(g.mines).toHaveLength(0);
  });

  it('hurts its own side just the same, and the buddy that laid it', () => {
    for (const who of ['owner', 'team-mate'] as const) {
      const g = flatGame([40, 44, 100], [team('A', 2), team('B', 1)], { retreatTime: 5, turnTime: 40 });
      const mine = layMine(g);
      expect(mine.state).toBe('unarmed');
      g.simulate(MINE_ARM_TIME + 0.2);
      const target = who === 'owner' ? g.buddies.find((b) => b.id === mine.owner)! : g.buddies.find((b) => b.team === 0 && b.id !== mine.owner)!;
      for (const b of g.buddies) {
        b.body.x = b === target ? mine.body.x + 0.6 : 110;
        b.body.y = 20.6;
      }
      g.simulate(MINE_FUSE + 0.2);
      expect(g.mines).toHaveLength(0);
      expect(target.hp).toBeLessThan(100);
    }
  });

  it('ignores corpses, crates and sheep, and rock between it and a buddy', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { retreatTime: 5, turnTime: 40 });
    const mine = layMine(g);
    g.simulate(MINE_ARM_TIME + 0.2);
    // A crate right on top of it is not something a mine reacts to.
    g.crates.push({ id: 995, kind: 'health', weapon: null, body: createBody(mine.body.x, mine.body.y + 0.5, CRATE_RADIUS) });
    g.step();
    expect(mine.state).toBe('armed');
    // Neither is a dead buddy lying beside it.
    const corpse = g.buddies[1];
    corpse.alive = false;
    corpse.hp = 0;
    corpse.body.x = mine.body.x + 0.5;
    corpse.body.y = mine.body.y;
    g.step();
    expect(mine.state).toBe('armed');
    // A living buddy behind solid rock is shielded from it.
    corpse.alive = true;
    corpse.hp = 100;
    corpse.body.x = mine.body.x + 1.4;
    corpse.body.y = mine.body.y - 1.2;
    for (let y = mine.body.y - 1.6; y <= mine.body.y + 0.4; y += 0.25) g.terrain.addDisc(mine.body.x + 0.7, y, 0.5);
    g.step();
    expect(mine.state).toBe('armed');
  });

  it('survives turn and round changes, and never holds up a turn while it lies there', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { retreatTime: 2, turnTime: 3 });
    const mine = layMine(g);
    const startTurn = g.turn;
    for (let k = 0; k < 4; k++) {
      runUntil(g, () => g.turn > startTurn + k, 25);
      g.skipTurn();
    }
    expect(g.turn).toBeGreaterThan(startTurn + 3);
    expect(g.mines).toHaveLength(1);
    expect(g.mines[0].id).toBe(mine.id);
    expect(mine.state).toBe('armed');
  });

  it('is set off by a blast and chains without hurting anything twice', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { retreatTime: 5, turnTime: 40 });
    const mine = layMine(g);
    g.simulate(MINE_ARM_TIME + 0.2);
    // A second mine close enough for the first one's blast to reach.
    g.mines.push(placeMine(9001, mine.owner, mine.team, mine.body.x + 2.2, mine.body.y));
    g.simulate(0.2);
    const victim = g.buddies[1];
    victim.body.x = mine.body.x + 1.1;
    victim.body.y = mine.body.y;
    victim.body.vx = victim.body.vy = 0;
    const hp = victim.hp;
    g.drainEvents();
    g.explode(mine.body.x - 2, mine.body.y, 2.8, 1, 0);
    const blasts = g.drainEvents().filter((e) => e.type === 'explosion');
    // The trigger blast plus one per mine: each mine goes off exactly once.
    expect(blasts).toHaveLength(3);
    expect(g.mines).toHaveLength(0);
    expect(victim.hp).toBeLessThan(hp);
  });

  it('falls when the ground under it is blasted away, and drowns in the sea', () => {
    const g = flatGame([40, 100], [team('A', 1), team('B', 1)], { retreatTime: 5, turnTime: 40 });
    const mine = layMine(g);
    g.simulate(MINE_ARM_TIME + 0.5);
    const restingY = mine.body.y;
    for (let x = mine.body.x - 3; x <= mine.body.x + 3; x += 1) g.terrain.carve(x, 11, 9);
    g.simulate(3);
    expect(g.mines).toHaveLength(0);
    expect(restingY).toBeGreaterThan(g.terrain.waterLevel);
  });

  it('sits with the other traps in the weapon order and can be selected by its key', () => {
    const slot = WEAPON_ORDER.indexOf('mine');
    expect(slot).toBeGreaterThan(-1);
    expect(weaponForKey(slot === 19 ? 0 : slot - 9, true)).toBe('mine');
    // Traps and last resorts live together at the end of the bar.
    expect(WEAPON_ORDER.slice(slot)).toContain('selfdestruct');
    expect(SPECIAL_WEAPONS).toContain('mine');
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

  it('drills down onto an enemy buried right below', () => {
    const g = flatGame([40, 100], [team('A', 1, 'ai'), team('B', 1)]);
    const enemy = g.buddies[1];
    enemy.body.x = 40.3;
    enemy.body.y = 15;
    g.terrain.carve(40.3, 15, 0.8);
    onlyWeapon(g, 0, 'drill');
    runUntil(g, () => g.phase === 'aiming', 5);
    const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(6));
    expect(plan.weapon).toBe('drill');
    runUntil(g, () => g.phase !== 'aiming' && g.phase !== 'turnStart', 10);
    runUntil(g, () => g.phase !== 'drilling', 5);
    expect(enemy.hp).toBeLessThan(100);
  });

  it('aims the blowtorch level, so the tunnel reaches the enemy it was planned for', () => {
    const g = flatGame([40, 45], [team('A', 1, 'ai'), team('B', 1)]);
    onlyWeapon(g, 0, 'torch');
    runUntil(g, () => g.phase === 'aiming', 5);
    // A wall between them: the torch is only chosen when there is no line of sight.
    for (let y = 20; y <= 30; y += 0.5) g.terrain.addDisc(42.5, y, 1);
    const me = g.buddies[0];
    // A raised aim left over from an earlier turn must not tilt the tunnel.
    me.aim = 0.9;
    const plan = planAttack(g, me, 'hard', mulberry32(3));
    expect(plan.weapon).toBe('torch');
    expect(Math.abs(plan.aim)).toBeLessThan(0.05);
  });

  it('aims a napalm strike upwind so the wind carries it onto the enemy', () => {
    const land = (wind: number) => {
      const g = flatGame([30, 80], [team('A', 1, 'ai'), team('B', 1)], { windMax: 1 });
      onlyWeapon(g, 0, 'napalm');
      runUntil(g, () => g.phase === 'aiming', 5);
      g.wind = wind;
      const plan = planAttack(g, g.buddies[0], 'hard', mulberry32(8));
      expect(plan.weapon).toBe('napalm');
      let fireX: number | null = null;
      runUntil(
        g,
        () => {
          for (const e of g.drainEvents()) if (e.type === 'ignite') fireX ??= e.x;
          return fireX !== null;
        },
        20,
      );
      return { target: plan.target!, fireX: fireX! };
    };
    const calm = land(0);
    const windy = land(1);
    expect(Math.abs(windy.target - calm.target)).toBeGreaterThan(8);
    expect(Math.abs(windy.fireX - 80)).toBeLessThan(5);
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
    runUntil(g, () => g.crates.length === 0 || (g.phase !== 'aiming' && g.phase !== 'turnStart'), 20);
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

  it('counts the chained blast of a crate beside its target, but only from Normal up', () => {
    const arena = () => {
      const g = flatGame([40, 58], [team('A', 1, 'ai'), team('B', 1)]);
      toAiming(g);
      return g;
    };
    const plain = arena();
    const crated = arena();
    // Right beside the enemy: Game.explode() sets it off, for a second blast on the same buddy.
    crated.crates.push({ id: 970, kind: 'weapon', weapon: 'sheep', body: createBody(59.2, 20.45, CRATE_RADIUS) });
    const def = WEAPONS.bazooka;
    const at = { x: 58, y: 20.6 };
    expect(scoreBlast(crated, crated.buddies[0], at.x, at.y, def, { crates: true, knockback: false, focus: false })).toBeGreaterThan(
      scoreBlast(plain, plain.buddies[0], at.x, at.y, def, { crates: true, knockback: false, focus: false }),
    );
    // Easy does not think about crates, so the crate changes nothing for it.
    expect(scoreBlast(crated, crated.buddies[0], at.x, at.y, def, NO_KNOWLEDGE)).toBe(scoreBlast(plain, plain.buddies[0], at.x, at.y, def, NO_KNOWLEDGE));
  });

  it('fears a crate beside its own team-mate', () => {
    const g = flatGame([40, 44, 100], [team('A', 2, 'ai'), team('B', 1)]);
    toAiming(g);
    const mate = g.buddies.find((b) => b.team === 0 && b !== g.buddies[0])!;
    const know = { crates: true, knockback: false, focus: false };
    const clean = scoreBlast(g, g.buddies[0], mate.body.x + 3.2, mate.body.y, WEAPONS.bazooka, know);
    g.crates.push({ id: 971, kind: 'health', weapon: null, body: createBody(mate.body.x + 1, 20.45, CRATE_RADIUS) });
    expect(scoreBlast(g, g.buddies[0], mate.body.x + 3.2, mate.body.y, WEAPONS.bazooka, know)).toBeLessThan(clean);
  });

  it('knows a contact fuse stops at a crate in the way', () => {
    const g = flatGame([40, 90], [team('A', 1, 'ai'), team('B', 1)]);
    toAiming(g);
    const me = g.buddies[0];
    const open = simulateShot(g, me, 'bazooka', 1, 0, 1);
    expect(open).not.toBeNull();
    g.crates.push({ id: 972, kind: 'health', weapon: null, body: createBody(me.body.x + 5, me.body.y, CRATE_RADIUS) });
    const blocked = simulateShot(g, me, 'bazooka', 1, 0, 1);
    expect(blocked).not.toBeNull();
    expect(blocked!.x).toBeLessThan(open!.x);
    expect(Math.abs(blocked!.x - (me.body.x + 5))).toBeLessThan(1.2);
  });

  it('a badly hurt buddy goes for the health crate even with a shot available', () => {
    const fetches = (hp: number) => {
      const g = flatGame([40, 58], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 40 });
      toAiming(g);
      onlyWeapon(g, 0, 'bazooka');
      g.buddies[0].hp = hp;
      g.crates.push({ id: 973, kind: 'health', weapon: null, body: createBody(g.buddies[0].body.x + 5, 20.45, CRATE_RADIUS) });
      runUntil(g, () => g.crates.length === 0 || (g.phase !== 'aiming' && g.phase !== 'turnStart'), 12);
      return g.crates.length === 0;
    };
    // A clean shot at an enemy 18 units away beats a crate when there is nothing to heal.
    expect(fetches(100)).toBe(false);
    expect(fetches(15)).toBe(true);
  });

  it('does not set off for a crate behind a wall it cannot climb', () => {
    const run = (wall: boolean) => {
      const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 40 });
      toAiming(g);
      onlyWeapon(g, 0, 'bazooka');
      const me = g.buddies[0];
      me.hp = 15;
      const startX = me.body.x;
      if (wall) for (let y = 20; y <= 32; y += 0.5) g.terrain.addDisc(startX + 4, y, 1);
      g.crates.push({ id: 974, kind: 'health', weapon: null, body: createBody(startX + 9, 20.45, CRATE_RADIUS) });
      runUntil(g, () => (g.phase !== 'aiming' && g.phase !== 'turnStart') || g.crates.length === 0, 15);
      return { left: g.crates.length, walked: me.body.x - startX };
    };
    // Without the wall a hurt buddy walks over and takes it; with one it stays and shoots instead.
    expect(run(false).left).toBe(0);
    const blocked = run(true);
    expect(blocked.left).toBe(1);
    expect(Math.abs(blocked.walked)).toBeLessThan(3);
  });

  it('presses the enemy team holding the most health, and finishes a team down to one buddy', () => {
    const know = { crates: false, knockback: false, focus: true };
    const arena = () => {
      const g = flatGame([40, 20, 25, 60, 65], [team('A', 1, 'ai'), team('B', 2), team('C', 2)]);
      toAiming(g);
      const me = g.buddies.find((b) => b.team === 0)!;
      const [b1, b2] = g.buddies.filter((b) => b.team === 1);
      const [c1, c2] = g.buddies.filter((b) => b.team === 2);
      // Two targets of identical health, far apart, so each blast only ever catches one of them.
      me.body.x = 40;
      b1.body.x = 20;
      b2.body.x = 24;
      c1.body.x = 60;
      c2.body.x = 64;
      for (const b of [b1, b2, c1, c2]) b.hp = 100;
      return { g, me, b1, b2, c1, c2 };
    };

    // Equal teams: no preference either way.
    const even = arena();
    const hitB = (a: ReturnType<typeof arena>) => scoreBlast(a.g, a.me, a.b1.body.x, a.b1.body.y, WEAPONS.bazooka, know);
    const hitC = (a: ReturnType<typeof arena>) => scoreBlast(a.g, a.me, a.c1.body.x, a.c1.body.y, WEAPONS.bazooka, know);
    expect(hitB(even)).toBeCloseTo(hitC(even), 5);

    // Team B is battered, so team C now holds most of the health left: press C.
    const lopsided = arena();
    lopsided.b2.hp = 10;
    expect(hitC(lopsided)).toBeGreaterThan(hitB(lopsided));

    // Team B down to its last buddy: worth finishing, even though C holds more health.
    const nearlyOut = arena();
    nearlyOut.b2.alive = false;
    nearlyOut.b2.hp = 0;
    expect(hitB(nearlyOut)).toBeGreaterThan(hitC(nearlyOut));

    // A single opponent leaves nothing to choose between, so focus changes nothing.
    const duel = flatGame([40, 58], [team('A', 1, 'ai'), team('B', 1)]);
    toAiming(duel);
    expect(scoreBlast(duel, duel.buddies[0], 58, 20.6, WEAPONS.bazooka, know)).toBe(scoreBlast(duel, duel.buddies[0], 58, 20.6, WEAPONS.bazooka, NO_KNOWLEDGE));
  });

  it('Hard sees that a blast can shove an enemy off the edge; Normal does not', () => {
    const g = flatGame([40, 52], [team('A', 1, 'ai'), team('B', 1)]);
    toAiming(g);
    // The ground ends just past the enemy, so a blast from our side throws it into the water.
    for (let x = 56; x <= 128; x += 3) g.terrain.carve(x, 10, 11);
    const enemy = g.buddies[1];
    enemy.hp = 100;
    const at = { x: enemy.body.x - 1.2, y: enemy.body.y };
    const hard = scoreBlast(g, g.buddies[0], at.x, at.y, WEAPONS.bazooka, { crates: false, knockback: true, focus: false });
    const normal = scoreBlast(g, g.buddies[0], at.x, at.y, WEAPONS.bazooka, { crates: false, knockback: false, focus: false });
    expect(hard).toBeGreaterThan(normal);
    // Over solid ground in the middle of the map the shove changes nothing.
    const inland = flatGame([40, 52], [team('A', 1, 'ai'), team('B', 1)]);
    toAiming(inland);
    expect(scoreBlast(inland, inland.buddies[0], 50.8, 20.6, WEAPONS.bazooka, { crates: false, knockback: true, focus: false })).toBe(
      scoreBlast(inland, inland.buddies[0], 50.8, 20.6, WEAPONS.bazooka, { crates: false, knockback: false, focus: false }),
    );
  });

  it('lays a mine when an enemy is close, and not with a team-mate standing next to it', () => {
    const arena = (mate: boolean) => {
      const g = flatGame([40, 48, 41.5], [team('A', mate ? 2 : 1, 'ai'), team('B', 1)]);
      toAiming(g);
      onlyWeapon(g, 0, 'mine');
      const me = g.buddies.find((b) => b.team === 0)!;
      const enemy = g.buddies.find((b) => b.team === 1)!;
      const friend = g.buddies.find((b) => b.team === 0 && b !== me);
      me.body.x = 40;
      enemy.body.x = 48;
      if (friend) friend.body.x = 41.5;
      for (const b of g.buddies) b.body.y = 20.6;
      return planAttack(g, me, 'hard', mulberry32(3));
    };
    expect(arena(false).weapon).toBe('mine');
    // A mine does not care whose side walks past, so not with one of ours right there.
    expect(arena(true).score).toBeLessThan(0);
  });

  it('will not walk to a crate past a mine', () => {
    const run = (mined: boolean) => {
      const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 40 });
      toAiming(g);
      onlyWeapon(g, 0, 'bazooka');
      const me = g.buddies[0];
      me.hp = 15;
      const startX = me.body.x;
      if (mined) g.mines.push(placeMine(9100, g.buddies[1].id, 1, startX + 5, 20.6));
      g.crates.push({ id: 975, kind: 'health', weapon: null, body: createBody(startX + 9, 20.45, CRATE_RADIUS) });
      runUntil(g, () => (g.phase !== 'aiming' && g.phase !== 'turnStart') || g.crates.length === 0, 15);
      return g.crates.length;
    };
    expect(run(false)).toBe(0);
    expect(run(true)).toBe(1);
  });

  it('every level plays an AI-vs-AI match to the end with crates on the map', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const teams = [team('A', 2, 'ai'), team('B', 2, 'ai')].map((t) => ({ ...t, aiLevel: level }));
      const g = new Game(config(teams, { seed: `levels-${level}`, turnTime: 25, windMax: 0.3, crates: 1 }));
      g.simulate(60 * 20);
      expect(g.phase).toBe('gameOver');
      expect(g.turn).toBeGreaterThan(2);
    }
  });

  it('plays an AI-vs-AI match to the end on a generated map', () => {
    const g = new Game(config([team('A', 2, 'ai'), team('B', 2, 'ai')], { seed: 'duel', turnTime: 25, windMax: 0.3 }));
    g.simulate(60 * 15);
    expect(g.phase).toBe('gameOver');
    expect(g.turn).toBeGreaterThan(2);
  });
});
