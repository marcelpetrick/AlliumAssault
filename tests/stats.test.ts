// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { defined } from '../src/core/assert';
import { createBody } from '../src/core/physics';
import { CRATE_RADIUS } from '../src/core/crates';
import type { Game } from '../src/core/game';
import { MatchStats, type StatsRoster } from '../src/core/stats';
import { flatGame, runUntil, team } from './helpers';

const toAiming = (g: Game) => runUntil(g, () => g.phase === 'aiming', 5);
const award = (g: Game, id: string) => g.summary().awards.find((a) => a.id === id);

describe('match statistics', () => {
  it('credit damage to the buddy that caused the blast, not to whoever is on turn', () => {
    const g = flatGame([40, 46], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const shooter = defined(g.activeBuddy, 'active buddy');
    const victim = g.buddies[1];
    g.explode(victim.body.x, victim.body.y, 3, 40, 0, false, { buddy: shooter.id, weapon: 'bazooka' });

    const summary = g.summary();
    const me = defined(
      summary.buddies.find((b) => b.id === shooter.id),
      'shooter record',
    );
    const them = defined(
      summary.buddies.find((b) => b.id === victim.id),
      'victim record',
    );
    expect(me.dealt).toBeGreaterThan(0);
    expect(me.friendly).toBe(0);
    expect(them.taken).toBe(me.dealt);
    expect(me.best.weapon).toBe('bazooka');
  });

  it('count damage to your own side separately, so an own goal is never a score', () => {
    const g = flatGame([40, 44, 100], [team('A', 2), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    // Selected by team: the buddies array interleaves the teams across the map.
    const [clumsy, friend] = g.teams[0].buddies;
    expect(friend.team).toBe(clumsy.team);
    g.explode(friend.body.x, friend.body.y, 3, 40, 0, false, { buddy: clumsy.id, weapon: 'grenade' });

    const record = defined(
      g.summary().buddies.find((b) => b.id === clumsy.id),
      'clumsy record',
    );
    expect(record.friendly).toBeGreaterThan(0);
    expect(record.dealt).toBe(0);
    expect(award(g, 'owngoal')?.who).toBe(clumsy.name);
  });

  it('count a use of a weapon once, and a blast that catches two buddies as one hit', () => {
    const g = flatGame([40, 80, 82], [team('A', 1), team('B', 2)], { turnTime: 45 });
    toAiming(g);
    const shooter = defined(g.activeBuddy, 'active buddy');
    g.selectWeapon('bazooka');
    g.buddies[0].aim = 0.8;
    g.pressFire();
    g.releaseFire();
    // One shot, and then one blast that catches both enemies at once.
    const [first, second] = g.teams[1].buddies;
    g.explode(first.body.x + 1, first.body.y, 4, 30, 0, false, { buddy: shooter.id, weapon: 'bazooka' });

    const record = defined(
      g.summary().buddies.find((b) => b.id === shooter.id),
      'shooter record',
    );
    expect(record.shots).toBe(1);
    expect(record.hits).toBe(1);
    expect(first.hp).toBeLessThan(100);
    expect(second.hp).toBeLessThan(100);
  });

  it('roll the per-team totals up out of the per-buddy ones', () => {
    const g = flatGame([40, 44, 90], [team('A', 2), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const enemy = g.teams[1].buddies[0];
    const [one, two] = g.teams[0].buddies;
    g.explode(enemy.body.x, enemy.body.y, 3, 30, 0, false, { buddy: one.id, weapon: 'bazooka' });
    g.explode(enemy.body.x, enemy.body.y, 3, 20, 0, false, { buddy: two.id, weapon: 'grenade' });

    const summary = g.summary();
    const mine = defined(
      summary.teams.find((t) => t.index === 0),
      'team record',
    );
    const theirs = defined(
      summary.teams.find((t) => t.index === 1),
      'enemy team record',
    );
    expect(mine.dealt).toBe(summary.buddies.filter((b) => b.team === 0).reduce((n, b) => n + b.dealt, 0));
    expect(theirs.taken).toBe(mine.dealt);
    expect(mine.taken).toBe(0);
  });

  it('name the weapon of the match and how much of the island went with it', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    g.selectWeapon('grenade');
    for (let k = 0; k < 2; k++) {
      g.buddies[0].aim = 0.7;
      g.pressFire();
      g.releaseFire();
      runUntil(g, () => g.phase === 'aiming' || g.phase === 'retreat', 6);
      if (g.phase !== 'aiming') break;
    }
    expect(g.summary().favourite?.weapon).toBe('grenade');

    // And the island really did lose ground.
    g.explode(60, 20, 8, 0, 0);
    expect(g.summary().groundLost).toBeGreaterThan(0);
    expect(award(g, 'ground')).toBeDefined();
  });

  it('hand out the crate award to whoever actually collected them', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { crates: 0, turnTime: 45 });
    toAiming(g);
    const me = defined(g.activeBuddy, 'active buddy');
    for (let k = 0; k < 2; k++) {
      g.crates.push({ id: 400 + k, kind: 'health', weapon: null, body: createBody(me.body.x, me.body.y, CRATE_RADIUS) });
      g.simulate(1 / 30);
    }
    const record = defined(
      g.summary().buddies.find((b) => b.id === me.id),
      'collector record',
    );
    expect(record.crates).toBe(2);
    expect(award(g, 'crates')).toMatchObject({ who: me.name });
  });

  it('report a drowning, and never award what nobody earned', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const me = defined(g.activeBuddy, 'active buddy');
    // Nothing has happened yet: no damage, so no most-valuable-buddy and no biggest hit.
    const quiet = g.summary();
    expect(quiet.awards.find((a) => a.id === 'mvp')).toBeUndefined();
    expect(quiet.awards.find((a) => a.id === 'biggest')).toBeUndefined();
    // The length of the match is a fact whatever happened, so that one is always there.
    expect(quiet.awards.find((a) => a.id === 'length')).toBeDefined();

    // Straight off the side of the island, which the rules count as going for a swim. Dropping it
    // below the waterline in place would not do: the ground is above the water, and physics simply
    // pushes it back out of the rock.
    me.body.x = -40;
    runUntil(g, () => !me.alive, 4);
    expect(me.alive).toBe(false);
    expect(award(g, 'swim')?.who).toContain(me.name);
    const record = defined(
      g.summary().buddies.find((b) => b.id === me.id),
      'drowned record',
    );
    expect(record.drowned).toBe(true);
    expect(record.alive).toBe(false);
  });

  it('list the buddies hardest hitter first, and every award with something to say', () => {
    const g = flatGame([40, 44, 90], [team('A', 2), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const enemy = g.teams[1].buddies[0];
    const [weak, strong] = g.teams[0].buddies;
    g.explode(enemy.body.x, enemy.body.y, 3, 10, 0, false, { buddy: weak.id, weapon: 'grenade' });
    g.explode(enemy.body.x, enemy.body.y, 3, 40, 0, false, { buddy: strong.id, weapon: 'bazooka' });
    const summary = g.summary();
    expect(summary.buddies[0].id).toBe(strong.id);
    expect(summary.buddies.map((b) => b.dealt)).toEqual([...summary.buddies.map((b) => b.dealt)].sort((a, b) => b - a));
    for (const a of summary.awards) {
      expect(a.who.length, `${a.id} has nobody`).toBeGreaterThan(0);
      expect(a.detail.length, `${a.id} says nothing`).toBeGreaterThan(0);
      expect(a.icon.length, `${a.id} has no icon`).toBeGreaterThan(0);
    }
  });
});

describe('the honours board', () => {
  it('credits a kill to whoever struck the last blow, and never to the victim itself', () => {
    const g = flatGame([40, 46], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const killer = defined(g.activeBuddy, 'active buddy');
    const victim = g.teams[1].buddies[0];
    g.explode(victim.body.x, victim.body.y, 3, 200, 0, false, { buddy: killer.id, weapon: 'bazooka' });
    // A buddy on nil health only falls over in the death phase, which needs the turn to end first.
    g.skipTurn();
    runUntil(g, () => !victim.alive, 30);
    expect(victim.alive).toBe(false);
    const record = defined(
      g.summary().buddies.find((b) => b.id === killer.id),
      'killer record',
    );
    expect(record.kills).toBe(1);
    // The buddy that blew itself up is not credited with killing itself.
    const own = defined(
      g.summary().buddies.find((b) => b.id === victim.id),
      'victim record',
    );
    expect(own.kills).toBe(0);
  });

  it('marks the marksman and the one who hit nothing, once there are shots to judge', () => {
    // Straight at the recorder: a roster of three and a handful of facts, with no match to run.
    const roster: StatsRoster = {
      buddies: [
        { id: 1, name: 'Sharp', team: 0, alive: true },
        { id: 2, name: 'Wild', team: 0, alive: true },
        { id: 3, name: 'Target', team: 1, alive: true },
      ],
      teams: [
        { index: 0, name: 'A', colour: '#ef4b3c' },
        { index: 1, name: 'B', colour: '#3d8bfd' },
      ],
      turns: 9,
      seconds: 210,
      groundLost: 0,
    };
    const stats = new MatchStats();
    const target = { id: 3, team: 1 };
    for (let k = 0; k < 3; k++) {
      stats.fired(1, 'bazooka', roster);
      stats.damaged({ buddy: 1, weapon: 'bazooka' }, target, 10, roster);
      stats.fired(2, 'grenade', roster);
    }
    const awards = stats.summary(roster).awards;
    expect(awards.find((a) => a.id === 'deadeye')?.who).toBe('Sharp');
    expect(awards.find((a) => a.id === 'butterfingers')?.who).toBe('Wild');
    // Three shots each, three hits and none: the detail says which is which.
    expect(awards.find((a) => a.id === 'deadeye')?.detail).toContain('100.0%');
    expect(awards.find((a) => a.id === 'butterfingers')?.detail).toContain('3 of 3');
    // And the length of the match is reported in minutes and seconds.
    expect(awards.find((a) => a.id === 'length')?.detail).toContain('3 min 30 s');
  });

  it('falls back to a placeholder when asked about a buddy no roster knows', () => {
    const roster: StatsRoster = { buddies: [], teams: [], turns: 1, seconds: 1, groundLost: 0 };
    const stats = new MatchStats();
    stats.damaged({ buddy: 99, weapon: null }, { id: 98, team: 0 }, 5, roster);
    // Nobody real was involved, so nobody appears on the board.
    expect(stats.summary(roster).buddies).toEqual([]);
  });

  it('leaves out the awards nobody earned, and keeps the ones that are always true', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const ids = g.summary().awards.map((a) => a.id);
    // Nothing has been fired or collected, so none of these can have a winner.
    for (const id of ['mvp', 'biggest', 'owngoal', 'deadeye', 'butterfingers', 'crates', 'swim', 'ground']) {
      expect(ids, `${id} was awarded for nothing`).not.toContain(id);
    }
    // Everybody is untouched, nobody has fired, and the match has a length.
    expect(ids).toContain('untouched');
    expect(ids).toContain('pacifist');
    expect(ids).toContain('length');
    // Nobody is worse off than anybody at nil-nil, so there is no wooden spoon either.
    expect(ids).not.toContain('worst');
  });

  it('names the favourite weapon only once one has been used', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    expect(g.summary().favourite).toBeNull();
    expect(g.summary().awards.find((a) => a.id === 'favourite')).toBeUndefined();
    g.selectWeapon('grenade');
    g.buddies[0].aim = 0.7;
    g.pressFire();
    g.releaseFire();
    expect(g.summary().favourite?.weapon).toBe('grenade');
  });

  it('counts damage dealt by nobody in particular against the victim alone', () => {
    const g = flatGame([40, 90], [team('A', 1), team('B', 1)], { turnTime: 45 });
    toAiming(g);
    const me = defined(g.activeBuddy, 'active buddy');
    // A blast with no culprit: the world's own doing, like a fall or the water.
    g.explode(me.body.x, me.body.y, 3, 20, 0);
    const record = defined(
      g.summary().buddies.find((b) => b.id === me.id),
      'victim record',
    );
    expect(record.taken).toBeGreaterThan(0);
    for (const b of g.summary().buddies) expect(b.dealt).toBe(0);
    expect(g.summary().awards.find((a) => a.id === 'mvp')).toBeUndefined();
  });
});
