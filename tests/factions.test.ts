// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { planAttack, scoreBlast } from '../src/core/ai';
import { mulberry32 } from '../src/core/rng';
import { WEAPONS } from '../src/core/weapons';
import { config, flatGame, runUntil, team } from './helpers';
import { Game } from '../src/core/game';
import { parseSettings } from '../src/ui/settings';

const teams = () => [team('A', 1), team('B', 1), team('C', 1)].map((t, i) => ({ ...t, faction: i === 2 ? 1 : 0 }));
const match = (tagTeams = true) => {
  const g = flatGame([40, 41.3, 100], teams(), { tagTeams, factions: ['Bulb Alliance', 'Opposition'], crates: 0 });
  runUntil(g, () => g.phase === 'aiming', 5);
  return g;
};

describe('tag-team factions', () => {
  it('shares victory with allied teams, including an ally eliminated earlier', () => {
    const g = match();
    expect(g.allied(0, 1)).toBe(true);
    expect(g.allied(0, 2)).toBe(false);
    g.buddies[1].alive = false;
    g.buddies[2].alive = false;
    g.skipTurn();
    expect(runUntil(g, () => g.phase === 'gameOver', 8)).toBe(true);
    expect(g.winner).toBe(0);
    expect(g.winnerTeams).toEqual([0, 1]);
  });

  it('retains separate team turns and inventories, and allows friendly fire between allies', () => {
    const g = match();
    const ally = g.buddies[1];
    g.selectWeapon('punch');
    g.buddies[0].aim = 0;
    g.pressFire();
    expect(ally.hp).toBe(55);
    const summary = g.summary();
    expect(summary.teams[0].friendly).toBe(45);
    expect(summary.teams[0].dealt).toBe(0);
    expect(g.teams[1].ammo.bat).toBe(2);
    expect(runUntil(g, () => g.activeTeam === 1 && g.phase === 'aiming', 15)).toBe(true);
    g.selectWeapon('bat');
    g.pressFire();
    expect(g.teams[1].ammo.bat).toBe(1);
    expect(g.teams[0].ammo.bat).toBe(2);
  });

  it('records lethal allied damage as friendly fire without awarding an enemy kill', () => {
    const g = match();
    const ally = g.buddies[1];
    ally.hp = 10;
    g.selectWeapon('punch');
    g.buddies[0].aim = 0;
    g.pressFire();
    expect(runUntil(g, () => !ally.alive, 8)).toBe(true);
    const attacker = g.summary().buddies.find((b) => b.id === g.buddies[0].id)!;
    expect(attacker.friendly).toBe(45);
    expect(attacker.kills).toBe(0);
  });

  it('is off by default; each team may also remain a faction of its own', () => {
    const g = match(false);
    expect(g.allied(0, 1)).toBe(false);
    g.buddies[2].alive = false;
    g.skipTurn();
    runUntil(g, () => g.activeTeam === 1, 10);
    expect(g.phase).not.toBe('gameOver');
    const solo = new Game(
      config(
        teams().map((t, i) => ({ ...t, faction: i })),
        { tagTeams: true },
      ),
    );
    expect(solo.allied(0, 1)).toBe(false);
    const invalid = new Game(
      config(
        teams().map((t, i) => ({ ...t, faction: [NaN, -1, 99][i] })),
        { tagTeams: true },
      ),
    );
    expect([0, 1, 2].map((i) => invalid.factionOf(i))).toEqual([0, 1, 2]);
  });

  it('ends in a draw when every faction is gone', () => {
    const g = match();
    for (const b of g.buddies) b.alive = false;
    g.skipTurn();
    expect(runUntil(g, () => g.phase === 'gameOver', 8)).toBe(true);
    expect(g.winner).toBeNull();
    expect(g.winnerTeams).toEqual([]);
  });

  it('AI treats other allied teams as friends and never locks a homing rocket on them', () => {
    const g = match();
    const me = g.buddies[0];
    const ally = g.buddies[1];
    expect(scoreBlast(g, me, ally.body.x, ally.body.y, WEAPONS.bazooka)).toBeLessThan(0);
    const plan = planAttack(g, me, 'normal', mulberry32(2), 'shotgun');
    expect(plan.facing).toBe(1);
    expect(plan.score).toBeLessThan(100);
    g.teams[0].ammo.homing = 1;
    g.selectWeapon('homing');
    expect(g.targetBuddy(ally.id)).toBe(false);
    expect(g.targetBuddy(g.buddies[2].id)).toBe(true);
  });

  it('does not aim a direct gun through an ally from a different team', () => {
    const g = match();
    g.buddies[1].body.x = 46;
    g.buddies[2].body.x = 52;
    for (const weapon of ['shotgun', 'minigun'] as const) {
      const blocked = planAttack(g, g.buddies[0], 'normal', mulberry32(2), weapon);
      expect(blocked.score).toBe(-Infinity);
      g.buddies[1].body.y += 4;
      expect(planAttack(g, g.buddies[0], 'normal', mulberry32(2), weapon).score).toBeGreaterThan(0);
      g.buddies[1].body.y -= 4;
    }
  });

  it('loads old settings with factions disabled and validates new names and assignments', () => {
    expect(parseSettings(JSON.stringify({ match: config(teams()) }))?.match.tagTeams).toBe(false);
    const loaded = parseSettings(JSON.stringify({ match: config(teams(), { tagTeams: true, factions: ['Bulb Alliance', '<Friends>', '', 'x'.repeat(50)] }) }))!;
    expect(loaded.match.tagTeams).toBe(true);
    expect(loaded.match.teams.map((t) => t.faction)).toEqual([0, 0, 1]);
    expect(loaded.match.factions?.[3]).toHaveLength(24);
    expect(
      parseSettings(
        JSON.stringify({
          match: config(
            teams().map((t) => ({ ...t, faction: 6 })),
            { tagTeams: true, factions: [9] as unknown as string[] },
          ),
        }),
      )?.match.teams[0].faction,
    ).toBeUndefined();
  });
});
