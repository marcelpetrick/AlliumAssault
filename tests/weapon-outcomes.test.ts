// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/game';
import { WEAPONS, WEAPON_ORDER } from '../src/core/weapons';
import { flatGame, runUntil, team } from './helpers';

/** Authored arenas exercise actual actions and physics, including the non-damaging tools. */
describe('the complete selectable arsenal', () => {
  it.each(WEAPON_ORDER)('%s produces its intended physical outcome', (id) => {
    const def = WEAPONS[id];
    const close = ['grenade', 'cluster', 'banana', 'holy', 'ming', 'mine', 'selfdestruct'].includes(id);
    const enemyX = def.kind === 'melee' ? 41.2 : close ? 42.2 : ['bazooka', 'shotgun', 'minigun', 'flamer', 'flysheep', 'sheep'].includes(id) ? 49 : 80;
    const g = flatGame([40, enemyX], [team('A', 1), team('B', 1)], { turnTime: 120, retreatTime: 3, crates: 0 });
    if (id === 'drill') g.terrain.fill((x, y) => Math.max(8 - y, Math.min(2 - Math.abs(x - 40), 20 - y, y - 17)));
    if (id === 'torch') g.terrain.fill((x, y) => Math.max(20 - y, Math.min(1 - Math.abs(x - 44), 24 - y)));
    if (id === 'rope') for (let x = 30; x <= 65; x++) g.terrain.addDisc(x, 26, 1.5);
    expect(runUntil(g, () => g.phase === 'aiming', 5)).toBe(true);
    const [me, enemy] = g.buddies;
    Object.assign(me.body, { x: 40, y: 20.65, vx: 0, vy: 0, grounded: true });
    Object.assign(enemy.body, { x: id === 'drill' ? 40 : id === 'torch' ? 46.6 : enemyX, y: id === 'drill' ? 8.65 : 20.65, vx: 0, vy: 0, grounded: true });
    me.hp = id === 'selfdestruct' ? 100 : 1000;
    enemy.hp = 1000;
    const ownerHealth = me.hp;
    const start = { x: enemy.body.x, y: enemy.body.y };
    g.teams[0].ammo[id] = 1;
    g.selectWeapon(id);
    me.facing = 1;
    me.aim = def.kind === 'projectile' && !['bazooka', 'homing'].includes(id) ? 1.45 : id === 'homing' ? 0.5 : id === 'rope' ? 1.45 : 0;
    const ground = g.terrain.solidFraction();
    g.drainEvents();
    if (id === 'homing') expect(g.targetBuddy(enemy.id)).toBe(true);
    if (def.kind === 'strike') g.strike(enemy.body.x);
    else if (id === 'platform') expect(g.placePlatform({ x: 45, y: 21.3, angle: 0 })).toBe(true);
    else if (id === 'teleport') expect(g.teleportTo(50, 24)).toBe(true);
    else {
      g.pressFire();
      if (def.charge) {
        g.charge = ['bazooka', 'homing'].includes(id) ? 1 : 0;
        g.releaseFire();
      }
    }
    const events: GameEvent[] = [];
    let secondShot = false,
      detonated = false,
      released = false,
      boardLanding = false;
    let speed = 0,
      travel = 0,
      altitude = me.body.y,
      flames = 0;
    for (let k = 0; k < (id === 'jetpack' ? 3600 : 1500); k++) {
      const seconds = k / 60;
      Object.assign(g.input, { left: false, right: false, up: false, down: false });
      if (id === 'shotgun' && seconds > 0.6 && !secondShot) {
        g.pressFire();
        secondShot = true;
      }
      if (id === 'mine' && g.activeTeam === 0) g.input.left = seconds < 2;
      if (id === 'flysheep' && g.flyer) {
        g.input.right = true;
        if (g.flyer.x >= enemyX - 1 && !detonated) {
          g.pressFire();
          detonated = true;
        }
      }
      if (id === 'sheep' && g.sheep && g.sheep.body.x >= enemyX - 1 && !detonated) {
        g.pressFire();
        detonated = true;
      }
      if (id === 'rope' && g.rope) {
        g.input.right = seconds < 1.2;
        g.input.up = seconds < 0.6;
        if (seconds > 1.2 && g.rope.state === 'attached' && !released) {
          g.pressFire();
          released = true;
        }
      }
      if (id === 'jetpack') g.input.up = seconds < 6 && g.phase === 'jetpacking';
      if (id === 'platform' && g.activeTeam === 0) {
        g.input.right = seconds < 0.8;
        if (k === 0) g.jump();
      }
      g.step(1 / 60);
      events.push(...g.drainEvents());
      speed = Math.max(speed, Math.hypot(enemy.body.vx, enemy.body.vy));
      travel = Math.max(travel, Math.hypot(enemy.body.x - start.x, enemy.body.y - start.y));
      altitude = Math.max(altitude, me.body.y);
      flames = Math.max(flames, g.flames.length);
      boardLanding ||= id === 'platform' && me.body.grounded && me.body.y > 21;
    }
    const utility = ['rope', 'platform', 'surrender', 'teleport', 'jetpack'].includes(id);
    expect(g.teams[0].ammo[id]).toBe(0);
    if (!utility) {
      expect(enemy.hp, 'the actual action must damage a victim').toBeLessThan(1000);
      expect(speed, 'damage must impart physical motion').toBeGreaterThan(2);
      expect(travel, 'the victim must really move').toBeGreaterThan(0.1);
    } else {
      expect(enemy.hp).toBe(1000);
      if (id === 'jetpack') expect(me.hp).toBeGreaterThan(ownerHealth - 20);
      else expect(me.hp).toBe(ownerHealth);
    }
    const hits = events.flatMap((e) => (e.type === 'damage' && e.buddy === enemy.id ? [e.amount] : []));
    if (id === 'punch' || id === 'bat' || id === 'torch' || id === 'drill') expect(hits).toEqual([def.damage]);
    if (id === 'shotgun') expect(hits).toEqual([22, 22]);
    if (id === 'minigun') {
      expect(events.filter((e) => e.type === 'shot')).toHaveLength(14);
      expect(hits.every((n) => n === 5)).toBe(true);
    }
    if (id === 'napalm' || id === 'flamer') {
      expect(flames).toBeGreaterThan(0);
      expect(g.flames).toHaveLength(0);
    }
    if (def.cluster || id === 'mule') expect(events.filter((e) => e.type === 'explosion').length).toBeGreaterThan(1);
    if (id === 'torch' || id === 'drill') expect(g.terrain.solidFraction()).toBeLessThan(ground);
    if (id === 'drill') expect(me.hp).toBe(ownerHealth);
    if (id === 'rope') {
      expect(events.some((e) => e.type === 'ropeBite')).toBe(true);
      expect(events.some((e) => e.type === 'ropeRelease')).toBe(true);
      expect(g.phase).toBe('aiming');
      expect(Math.abs(me.body.x - 40)).toBeGreaterThan(0.5);
    }
    if (id === 'platform') {
      expect(boardLanding).toBe(true);
      expect(g.terrain.platforms).toHaveLength(1);
      expect(me.body.grounded).toBe(true);
      expect(me.body.y).toBeGreaterThan(21);
    }
    if (id === 'teleport') expect(me.body.x).toBeCloseTo(50);
    if (id === 'jetpack') {
      expect(altitude).toBeGreaterThan(26);
      expect(me.body.grounded).toBe(true);
      expect(g.phase).toBe('aiming');
    }
    if (id === 'selfdestruct') {
      expect(me.hp).toBe(0);
      expect(me.alive).toBe(false);
    }
  });
});
