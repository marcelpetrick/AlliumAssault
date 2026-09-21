// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { createBody } from '../src/core/physics';
import { WEAPONS } from '../src/core/weapons';
import { Terrain } from '../src/core/terrain';
import { cratesPerTurn } from '../src/core/crates';
import { hotkeyLabel, WEAPON_ORDER, weaponForKey } from '../src/core/weapons';
import { FLAME_BITE_INTERVAL, FLAME_BITES } from '../src/core/fire';
import { flatGame, runUntil, team } from './helpers';

const aiming = (g: Game) => {
  expect(runUntil(g, () => g.phase === 'aiming', 5)).toBe(true);
};

describe('command boundaries', () => {
  it('jumps, backflips and refuses repeated jumps while airborne or charging', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    const b = g.activeBuddy!;
    expect(g.countingDown).toBe(true);
    g.jump();
    expect(b.body.vy).toBeGreaterThan(0);
    const vy = b.body.vy;
    g.jump(true);
    expect(b.body.vy).toBe(vy);
    expect(runUntil(g, () => b.body.grounded, 4)).toBe(true);
    g.face(-1);
    g.jump(true);
    expect(b.body.vx).toBeGreaterThan(0);
    expect(g.drainEvents().filter((e) => e.type === 'jump')).toHaveLength(2);
    expect(runUntil(g, () => b.body.grounded, 4)).toBe(true);
    g.pressFire();
    expect(g.charge).not.toBeNull();
    g.jump();
    expect(b.body.grounded).toBe(true);
    g.cancelCharge();
    expect(g.charge).toBeNull();
    g.releaseFire();
    expect(g.projectiles).toHaveLength(0);
  });

  it('rejects unavailable weapons, cycles to stocked ones and ignores map clicks for other weapons', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)], { arsenal: 'crates' });
    aiming(g);
    expect(g.ropeLine()).toBeNull();
    expect(g.burst).toBeNull();
    g.selectWeapon('sheep');
    expect(g.weapon).toBe('bazooka');
    g.strike(50);
    expect(g.drops).toHaveLength(0);
    expect(g.placePlatform({ x: 50, y: 25, angle: 0 })).toBe(false);
    g.selectWeapon('platform');
    const ammo = g.teams[0].ammo.platform;
    g.pressFire();
    expect(g.teams[0].ammo.platform).toBe(ammo);
    expect(g.placePlatform({ x: 50, y: 19, angle: 0 })).toBe(false);
    expect(g.placePlatform({ x: 50, y: 25, angle: 0 })).toBe(true);
    expect(g.placePlatform({ x: 60, y: 25, angle: 0 })).toBe(false);
    g.selectWeapon('grenade');
    expect(g.weapon).toBe('platform');
    g.face(-1);
    expect(g.activeBuddy!.facing).toBe(-1);
    g.skipTurn();
    expect(g.phase).toBe('retreat');
  });

  it('uses the full inventory when cycling, including a stocked rope in crate-only mode', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)], { arsenal: 'crates' });
    aiming(g);
    for (const id of Object.keys(g.teams[0].ammo) as (keyof typeof WEAPONS)[]) g.teams[0].ammo[id] = id === 'rope' ? 3 : 0;
    g.cycleWeapon();
    expect(g.weapon).toBe('rope');
    expect(g.teams[0].ammo.rope).toBe(3);
    // A missed hook still exposes a path to the renderer, then costs nothing.
    g.activeBuddy!.aim = Math.PI / 2;
    g.pressFire();
    expect(g.ropeLine()).toHaveLength(2);
    expect(runUntil(g, () => g.rope === null, 4)).toBe(true);
    expect(g.teams[0].ammo.rope).toBe(3);
  });
});

describe('world boundaries', () => {
  it('uses fallback spawn positions when a supplied map has no spawn candidates', () => {
    const empty = new Terrain(128, 64, 3);
    const g = new Game(
      { seed: 'empty', teams: [team('A', 1), team('B', 1)], turnTime: 30, retreatTime: 3, windMax: 0, theme: 'meadow' },
      { terrain: empty, spawns: [] },
    );
    expect(g.buddies).toHaveLength(2);
    expect(g.buddies.every((b) => Number.isFinite(b.body.x) && Number.isFinite(b.body.y))).toBe(true);
  });

  it('removes off-map crates, mines and graves without a water splash', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.terrain.fill(() => -4);
    g.crates.push({ id: 510, kind: 'health', weapon: null, body: createBody(160, 30, 0.45) });
    g.mines.push({ id: 511, owner: 0, team: 0, body: createBody(160, 30, 0.25), state: 'armed', age: 2, fuse: 1 });
    g.graves.push({ id: 512, buddy: 1, team: 0, name: 'Lost', body: createBody(160, 30, 0.45) });
    g.step();
    expect(g.crates).toHaveLength(0);
    expect(g.mines).toHaveLength(0);
    expect(g.graves).toHaveLength(0);
    expect(g.drainEvents().some((e) => e.type === 'splash')).toBe(false);
  });

  it('chains nearby triggered mines only once each', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    for (const [id, x] of [
      [520, 50],
      [521, 51],
    ])
      g.mines.push({ id, owner: 1, team: 1, body: createBody(x, 20.6, 0.25), state: 'triggered', age: 3, fuse: 0 });
    g.step();
    expect(g.mines).toHaveLength(0);
    expect(g.drainEvents().filter((e) => e.type === 'explosion')).toHaveLength(2);
  });

  it('gives equally placed crates to the sheep launcher in stable id order', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.terrain.fill(() => -4);
    g.selectWeapon('sheep');
    g.pressFire();
    if (g.action?.kind !== 'sheep') throw new Error('sheep did not launch');
    Object.assign(g.action.sheep.body, { x: 50, y: 30, vx: 5, vy: 0, grounded: false });
    g.crates.push({ id: 531, kind: 'health', weapon: null, body: createBody(50, 30, 0.45) });
    g.crates.push({ id: 530, kind: 'weapon', weapon: 'mine', body: createBody(50, 30, 0.45) });
    g.step();
    expect(g.crates).toHaveLength(0);
    expect(
      g
        .drainEvents()
        .filter((e) => e.type === 'cratePickup')
        .map((e) => e.crate),
    ).toEqual([530, 531]);
  });

  it('scorches a buddy to the left of a flame and knocks a grave vertically from its own centre', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    const b = g.buddies[0];
    b.body.x = 39.5;
    g.flames.push({ id: 540, x: 40, y: 20.1, life: 4, bite: FLAME_BITE_INTERVAL, bitesLeft: FLAME_BITES });
    g.step();
    expect(b.body.vx).toBeLessThan(0);
    expect(b.hp).toBeLessThan(100);
    const grave = { id: 541, buddy: 42, team: 0, name: 'Ash', body: createBody(55, 25, 0.45) };
    g.graves.push(grave);
    g.explode(55, 25, 2, 0, 6);
    expect(grave.body.vx).toBe(0);
    expect(grave.body.vy).toBeGreaterThan(0);
  });

  it('drowns a buddy who lets go of a rope over water', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.selectWeapon('rope');
    g.pressFire();
    if (g.action?.kind !== 'rope') throw new Error('rope did not launch');
    g.action.rope = null;
    g.terrain.fill(() => -4);
    g.activeBuddy!.body.y = 2;
    g.step();
    expect(g.activeBuddy!.alive).toBe(false);
    expect(g.action).toBeNull();
  });

  it('clears an interrupted timed weapon action when its buddy dies', () => {
    for (const weapon of ['torch', 'drill', 'rope', 'minigun'] as const) {
      const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
      aiming(g);
      g.selectWeapon(weapon);
      g.pressFire();
      expect(g.action).not.toBeNull();
      g.activeBuddy!.alive = false;
      g.step();
      expect(g.action).toBeNull();
    }
  });

  it('fires a burst, honors an already-resting holy grenade and refuses invalid commands', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.selectWeapon('minigun');
    g.pressFire();
    expect(g.burst?.weapon).toBe('minigun');
    g.pressFire();
    expect(g.phase).toBe('firing');
    g.activeTeam = -1;
    expect(g.activeTeamData).toBeNull();
    g.cycleWeapon();
    g.activeTeam = 0;
    g.phase = 'turnStart';
    g.face(-1);
    expect(g.activeBuddy!.facing).toBe(1);
    g.phase = 'aiming';
    g.selectWeapon('holy');
    g.terrain.fill(() => -4);
    g.projectiles.push({ id: 630, weapon: 'holy', x: 50, y: 30, vx: 0, vy: 0, radius: 0.15, bounces: 0, fuse: 3, age: 0, owner: 1, rest: 0.2 });
    g.step(0.001);
    expect(g.projectiles[0].rest).toBeGreaterThan(0.2);
    g.projectiles.push({ id: 631, weapon: 'holy', x: 60, y: 30, vx: 0, vy: 0, radius: 0.15, bounces: 0, fuse: 3, age: 0, owner: 1 });
    g.step(0.001);
    expect(g.projectiles[1].rest).toBeGreaterThan(0);
  });

  it('keeps dead buddies dead at Sudden Death while skipping eliminated teams', () => {
    const g = flatGame([20, 40, 60, 80], [team('A', 2), team('B', 1), team('C', 1)], { suddenDeath: 3, turnTime: 1 });
    aiming(g);
    const fallen = g.buddies.find((b) => b.team === 0 && b !== g.activeBuddy)!;
    fallen.alive = false;
    fallen.hp = 0;
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 3, 20)).toBe(true);
    expect(fallen.hp).toBe(0);
    expect(g.waterRising).toBe(true);
    g.buddies
      .filter((b) => b.team === 1)
      .forEach((b) => {
        b.alive = false;
        b.hp = 0;
      });
    expect(runUntil(g, () => g.turn === 4, 20)).toBe(true);
    aiming(g);
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 5, 20)).toBe(true);
    expect(g.activeTeam).toBe(2);
  });

  it('ends a torch turn when its timer expires and discards a charge outside aiming', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.selectWeapon('torch');
    g.pressFire();
    g.turnTimeLeft = 0.01;
    g.step(0.02);
    expect(g.phase).toBe('settling');
    g.charge = 0.4;
    g.releaseFire();
    expect(g.charge).toBeNull();
  });

  it('lets timed-out sheep detonate and an expired rope release its buddy', () => {
    const sheep = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(sheep);
    sheep.selectWeapon('sheep');
    sheep.pressFire();
    expect(sheep.action?.kind).toBe('sheep');
    if (sheep.action?.kind === 'sheep') sheep.action.sheep.age = WEAPONS.sheep.fuse;
    sheep.step();
    expect(sheep.action).toBeNull();
    expect(['retreat', 'settling']).toContain(sheep.phase);

    const rope = flatGame([30, 90], [team('A', 1), team('B', 1)], { turnTime: 1 });
    aiming(rope);
    rope.selectWeapon('rope');
    rope.pressFire();
    expect(rope.phase).toBe('roping');
    rope.turnTimeLeft = 0.01;
    rope.step(0.02);
    expect(rope.phase).toBe('settling');
    expect(rope.action).toBeNull();
  });

  it('falls back to bazooka if a depleted selected weapon starts the next turn', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)], { turnTime: 1 });
    aiming(g);
    g.teams[0].weapon = 'sheep';
    g.teams[0].ammo.sheep = 0;
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 3, 20)).toBe(true);
    expect(g.weapon).toBe('bazooka');
  });

  it('splash-removes projectiles and guided sheep that enter water, and retires ones that leave the map', () => {
    const shot = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(shot);
    shot.terrain.fill(() => -4);
    shot.projectiles.push({ id: 601, weapon: 'bazooka', x: 50, y: 3.05, vx: 0, vy: -10, radius: 0.15, bounces: 0, fuse: 0, age: 0, owner: 1 });
    shot.step(0.1);
    expect(shot.projectiles).toHaveLength(0);
    expect(shot.drainEvents().some((e) => e.type === 'splash')).toBe(true);
    shot.projectiles.push({ id: 602, weapon: 'bazooka', x: 169, y: 30, vx: 20, vy: 0, radius: 0.15, bounces: 0, fuse: 0, age: 0, owner: 1 });
    shot.step(0.1);
    expect(shot.projectiles).toHaveLength(0);

    for (const [weapon, boundary] of [
      ['sheep', 'water'],
      ['sheep', 'out'],
      ['flysheep', 'water'],
      ['flysheep', 'out'],
    ] as const) {
      const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
      aiming(g);
      g.terrain.fill(() => -4);
      g.selectWeapon(weapon);
      g.pressFire();
      expect(g.phase).toBe('guiding');
      if (g.action?.kind === 'sheep') {
        g.action.sheep.body.y = boundary === 'water' ? 2.5 : 30;
        g.action.sheep.body.x = boundary === 'out' ? 159 : 50;
      } else if (g.action?.kind === 'flyer') {
        g.action.flyer.y = boundary === 'water' ? 2.5 : 30;
        g.action.flyer.x = boundary === 'out' ? 159 : 50;
      }
      g.step(0.1);
      expect(g.action).toBeNull();
      expect(g.phase).toBe('retreat');
      expect(g.drainEvents().some((e) => e.type === 'splash')).toBe(boundary === 'water');
    }
  });

  it('removes falling crates and mines in water, with splash events', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.terrain.fill(() => -4);
    g.crates.push({ id: 501, kind: 'health', weapon: null, body: createBody(50, 2, 0.45) });
    g.mines.push({ id: 502, owner: 0, team: 0, body: createBody(55, 2, 0.25), state: 'armed', age: 2, fuse: 1 });
    g.step();
    expect(g.crates).toHaveLength(0);
    expect(g.mines).toHaveLength(0);
    expect(g.drainEvents().filter((e) => e.type === 'splash')).toHaveLength(2);
  });

  it('caps the flood one unit below the world top and stops it when the match is over', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)], { suddenDeath: 2, turnTime: 1 });
    aiming(g);
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 2, 15)).toBe(true);
    expect(g.waterRising).toBe(true);
    // Rock almost to the ceiling, so the buddies stay dry while the water runs into its cap.
    g.terrain.fill((_x, y) => 63 - y);
    for (const b of g.buddies) {
      b.body.y = 63.65;
      b.body.vy = 0;
    }
    g.terrain.waterLevel = g.terrain.height - 1.5;
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 3, 20)).toBe(true);
    expect(g.terrain.waterLevel).toBe(g.terrain.height - 1);
    g.skipTurn();
    expect(runUntil(g, () => g.turn === 4, 20)).toBe(true);
    expect(g.terrain.waterLevel).toBe(g.terrain.height - 1);

    // With one team left the match is over, and a match that is over floods no further.
    const level = g.terrain.waterLevel;
    g.buddies[1].alive = false;
    g.buddies[1].hp = 0;
    g.skipTurn();
    expect(runUntil(g, () => g.phase === 'gameOver', 20)).toBe(true);
    g.step(1);
    expect(g.terrain.waterLevel).toBe(level);
  });
});

describe('match endings', () => {
  it('ends in a draw when the last buddies of both teams die together', () => {
    const g = flatGame([40, 42], [team('A', 1), team('B', 1)]);
    aiming(g);
    for (const b of g.buddies) b.hp = 5;
    g.explode(41, g.buddies[0].body.y, 6, 50, 0);
    expect(runUntil(g, () => g.phase === 'gameOver', 20)).toBe(true);
    expect(g.buddies.every((b) => !b.alive)).toBe(true);
    expect(g.winner).toBeNull();
    expect(g.drainEvents().some((e) => e.type === 'gameOver' && e.winner === null)).toBe(true);
  });

  it('hands out nothing for a weapon crate that holds no weapon', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    const b = g.buddies[0];
    const before = { ...g.teams[0].ammo };
    g.crates.push({ id: 700, kind: 'weapon', weapon: null, body: createBody(b.body.x + 0.2, b.body.y, 0.45) });
    expect(runUntil(g, () => g.crates.length === 0, 5)).toBe(true);
    expect(g.teams[0].ammo).toEqual(before);
    expect(b.hp).toBe(100);
    expect(g.drainEvents().some((e) => e.type === 'cratePickup' && e.weapon === null && e.kind === 'weapon')).toBe(true);
  });
});

describe('small rules with an unused edge', () => {
  it('drops a panicking buddy\u2019s countdown when the buddy is gone from the match', () => {
    const g = flatGame([30, 90], [team('A', 1), team('B', 1)]);
    aiming(g);
    g.selectWeapon('selfdestruct');
    g.pressFire();
    expect(g.phase).toBe('panicking');
    // No active buddy at all (never happens in play, but the step has to cope rather than throw).
    g.activeBuddy = null;
    g.step(1 / 60);
    expect(g.action).toBeNull();
  });

  it('hands out no crates at all when the rate is zero or negative', () => {
    expect(cratesPerTurn(0, () => 0)).toBe(0);
    expect(cratesPerTurn(-1, () => 0)).toBe(0);
    expect(cratesPerTurn(0.5, () => 0.9)).toBe(0);
    expect(cratesPerTurn(0.5, () => 0.1)).toBe(1);
    expect(cratesPerTurn(2, () => 0.9)).toBe(2);
  });

  it('labels a hotkey-less weapon slot and refuses keys that are not digits', () => {
    // Nothing is bound past the letter keys, and the label says so rather than inventing one.
    expect(hotkeyLabel(WEAPON_ORDER.length + 5)).toBe('\u00b7');
    expect(weaponForKey(1.5, false)).toBeNull();
    expect(weaponForKey(-1, true)).toBeNull();
  });
});
