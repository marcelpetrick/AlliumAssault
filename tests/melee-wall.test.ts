// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { flatGame, runUntil, team } from './helpers';

describe('melee terrain damage', () => {
  it.each(['punch', 'bat'] as const)('%s carves a destructible wall, while an empty swing leaves distant terrain intact', (weapon) => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)]);
    runUntil(g, () => g.phase === 'aiming', 5);
    const b = g.activeBuddy!;
    g.terrain.addDisc(41.4, b.body.y, 0.8);
    expect(g.terrain.isSolid(41.4, b.body.y)).toBe(true);
    g.selectWeapon(weapon);
    b.aim = 0;
    g.pressFire();
    expect(g.terrain.isSolid(41.4, b.body.y)).toBe(false);
    expect(g.terrain.isSolid(90, 19)).toBe(true);
    expect(g.buddies[1].hp).toBe(100);
  });

  it.each(['punch', 'bat'] as const)('%s leaves an indestructible arena border intact', (weapon) => {
    const g = flatGame([2, 90], [team('A', 1), team('B', 1)], { walled: true });
    runUntil(g, () => g.phase === 'aiming', 5);
    g.selectWeapon(weapon);
    g.face(-1);
    g.activeBuddy!.aim = 0;
    g.pressFire();
    expect(g.terrain.isSolid(-0.1, 20.65)).toBe(true);
  });
});
