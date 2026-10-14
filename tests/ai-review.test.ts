// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, it } from 'vitest';
import { createBody } from '../src/core/physics';
import { flatGame, onlyWeapon, runUntil, team } from './helpers';

it('collects nearby supplies with only an aircraft in stock and still chooses its attack direction', () => {
  const g = flatGame([40, 80], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
  onlyWeapon(g, 0, 'airstrike');
  g.selectWeapon('airstrike');
  g.crates.push({ id: 991, kind: 'health', weapon: null, body: createBody(43, 20.45, 0.45) });
  expect(runUntil(g, () => g.buddies[0].hp === 125, 8)).toBe(true);
  expect(g.buddies[0].body.x).toBeGreaterThan(41);
  expect(g.choosingApproach).toBe(false);
  g.setStrikeDir(-1);
  expect(g.strikeDir).toBe(-1);
  expect(runUntil(g, () => g.drops.length > 0, 8)).toBe(true);
  expect(g.drainEvents().some((e) => e.type === 'airstrike' && e.dir === 1)).toBe(true);
});

it.each([-1, 1] as const)('jumps a low obstacle when repositioning to attack in direction %s', (side) => {
  const g = flatGame([40, 40 + side * 15], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
  g.buddies[0].body.x = 40;
  g.buddies[1].body.x = 40 + side * 15;
  onlyWeapon(g, 0, 'shotgun');
  g.terrain.fill((x, y) => Math.max(20 - y, Math.min(0.6 - Math.abs(x - (40 + side * 2)), 21.2 - y)));
  expect(runUntil(g, () => g.teams[0].ammo.shotgun < 2, 12)).toBe(true);
  expect((g.buddies[0].body.x - 40) * side).toBeGreaterThan(3);
  expect(g.buddies[1].hp).toBeLessThan(100);
  expect(g.drainEvents().some((e) => e.type === 'jump')).toBe(true);
});

it('retreats along safe ground rather than into the water behind it', () => {
  const g = flatGame([40, 43], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
  onlyWeapon(g, 0, 'punch');
  g.terrain.fill((x, y) => Math.min(x - 38, 20 - y));
  expect(runUntil(g, () => g.phase === 'retreat', 8)).toBe(true);
  const x = g.buddies[0].body.x;
  g.simulate(0.9);
  expect(g.buddies[0].alive).toBe(true);
  expect(g.buddies[0].body.x).toBeGreaterThanOrEqual(x);
});

it('stays on its small island when both retreat routes lead off it', () => {
  const g = flatGame([40, 41.3], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
  onlyWeapon(g, 0, 'punch');
  g.terrain.fill((x, y) => Math.min(x - 38.5, 41.5 - x, 20 - y));
  expect(runUntil(g, () => g.phase === 'retreat', 8)).toBe(true);
  g.simulate(0.9);
  expect(g.buddies[0].alive).toBe(true);
  expect(g.buddies[0].body.x).toBeGreaterThan(38.5 + g.buddies[0].body.radius);
  expect(g.buddies[0].body.x).toBeLessThan(41.5 - g.buddies[0].body.radius);
  expect(g.buddies[0].hp).toBe(100);
});

it('executes the jump used to preview a safe retreat over a step', () => {
  const g = flatGame([40, 41.3], [team('A', 1, 'ai'), team('B', 1)], { crates: 0 });
  onlyWeapon(g, 0, 'punch');
  g.terrain.fill((x, y) => Math.max(20 - y, Math.min(0.6 - Math.abs(x - 38), 20.7 - y)));
  expect(runUntil(g, () => g.phase === 'retreat', 8)).toBe(true);
  g.drainEvents();
  g.simulate(1.1);
  expect(g.drainEvents().some((e) => e.type === 'jump')).toBe(true);
  expect(g.buddies[0].body.x).toBeLessThan(38);
  expect(g.buddies[0].hp).toBe(100);
});
