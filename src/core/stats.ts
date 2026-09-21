// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * What happened over a match, counted while it happens.
 *
 * The scoreboard at the end is only as good as its attribution, and attribution is something only
 * the rules know: a blast carries the buddy that caused it and the weapon that made it, and the
 * damage it deals is credited there rather than to whoever happens to be taking the turn. Keeping
 * the counting here — pure, with no DOM and no renderer — is what makes it testable.
 */

import { WEAPONS, type WeaponId } from './weapons';

/** Who is answerable for a blast: the buddy that caused it, and what they used. */
export interface Blame {
  buddy: number;
  weapon: WeaponId | null;
}

export interface BuddyRecord {
  id: number;
  name: string;
  team: number;
  /** Damage dealt to the other teams. */
  dealt: number;
  /** Damage dealt to its own team, itself included — the own goals. */
  friendly: number;
  taken: number;
  /** Weapons used: every fire command, whether or not it found anything. */
  shots: number;
  /** Shots that hurt somebody on another team. */
  hits: number;
  /** The single hardest blow it landed, and what it landed it with. */
  best: { amount: number; weapon: WeaponId | null };
  crates: number;
  kills: number;
  alive: boolean;
  drowned: boolean;
}

export interface TeamRecord {
  index: number;
  name: string;
  colour: string;
  dealt: number;
  friendly: number;
  taken: number;
  shots: number;
  hits: number;
  lost: number;
  survivors: number;
}

/** One line of the honours board: a title, who earned it, and the number behind it. */
export interface Award {
  id: string;
  icon: string;
  title: string;
  who: string;
  detail: string;
}

export interface MatchSummary {
  teams: TeamRecord[];
  buddies: BuddyRecord[];
  awards: Award[];
  turns: number;
  /** Seconds of simulated play. */
  seconds: number;
  /** Share of the island blasted away, 0..1. */
  groundLost: number;
  favourite: { weapon: WeaponId; uses: number } | null;
}

/** Buddies and teams as the recorder needs to know them, without importing the whole Game. */
export interface StatsRoster {
  buddies: { id: number; name: string; team: number; alive: boolean }[];
  teams: { index: number; name: string; colour: string }[];
  turns: number;
  seconds: number;
  groundLost: number;
}

const blank = (b: StatsRoster['buddies'][number]): BuddyRecord => ({
  id: b.id,
  name: b.name,
  team: b.team,
  dealt: 0,
  friendly: 0,
  taken: 0,
  shots: 0,
  hits: 0,
  best: { amount: 0, weapon: null },
  crates: 0,
  kills: 0,
  alive: b.alive,
  drowned: false,
});

/**
 * Tallies a match as it is played. Every method is a fact the rules already knew; nothing here
 * inspects the world for itself, so the recorder can never disagree with what actually happened.
 */
export class MatchStats {
  private readonly buddies = new Map<number, BuddyRecord>();
  private readonly weapons = new Map<WeaponId, number>();
  /** Shots whose damage has already been counted as a hit, so one blast counts once. */
  private creditedShot: number | null = null;
  private shotSeq = 0;

  /** A weapon was used. Counted on use, not on impact: a miss is still a shot taken. */
  fired(buddy: number, weapon: WeaponId, roster: StatsRoster): void {
    this.record(buddy, roster).shots++;
    this.weapons.set(weapon, (this.weapons.get(weapon) ?? 0) + 1);
    this.shotSeq++;
    this.creditedShot = null;
  }

  /** Damage landed. `by` is null for the world's own doing: a fall, the water, a mine nobody laid. */
  damaged(by: Blame | null, victim: { id: number; team: number }, amount: number, roster: StatsRoster): void {
    const hurt = this.record(victim.id, roster);
    hurt.taken += amount;
    if (!by) return;
    const culprit = this.record(by.buddy, roster);
    const own = this.buddies.get(by.buddy)?.team === victim.team;
    if (own) {
      culprit.friendly += amount;
      return;
    }
    culprit.dealt += amount;
    if (amount > culprit.best.amount) culprit.best = { amount, weapon: by.weapon };
    // One shot counts as one hit however many buddies its blast caught.
    if (this.creditedShot !== this.shotSeq) {
      culprit.hits++;
      this.creditedShot = this.shotSeq;
    }
  }

  collected(buddy: number, roster: StatsRoster): void {
    this.record(buddy, roster).crates++;
  }

  /** A buddy is out. `by` is who is answerable, when anybody is. */
  died(buddy: number, by: Blame | null, drowned: boolean, roster: StatsRoster): void {
    const record = this.record(buddy, roster);
    record.alive = false;
    record.drowned = drowned;
    if (by && by.buddy !== buddy) this.record(by.buddy, roster).kills++;
  }

  /** Everything the scoreboard shows, worked out once when the match is over. */
  summary(roster: StatsRoster): MatchSummary {
    for (const b of roster.buddies) this.record(b.id, roster).alive = b.alive;
    const buddies = [...this.buddies.values()].filter((b) => b.team >= 0);
    const teams = roster.teams.map((t) => {
      const mine = buddies.filter((b) => b.team === t.index);
      return {
        index: t.index,
        name: t.name,
        colour: t.colour,
        dealt: sum(mine, (b) => b.dealt),
        friendly: sum(mine, (b) => b.friendly),
        taken: sum(mine, (b) => b.taken),
        shots: sum(mine, (b) => b.shots),
        hits: sum(mine, (b) => b.hits),
        lost: mine.filter((b) => !b.alive).length,
        survivors: mine.filter((b) => b.alive).length,
      };
    });
    const uses = [...this.weapons.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const favourite = uses[0] ? { weapon: uses[0][0], uses: uses[0][1] } : null;
    return {
      teams,
      buddies: [...buddies].sort((a, b) => b.dealt - a.dealt || a.name.localeCompare(b.name)),
      awards: awardsFor(buddies, teams, roster, favourite),
      turns: roster.turns,
      seconds: roster.seconds,
      groundLost: roster.groundLost,
      favourite,
    };
  }

  private record(id: number, roster: StatsRoster): BuddyRecord {
    let found = this.buddies.get(id);
    if (!found) {
      const b = roster.buddies.find((x) => x.id === id) ?? { id, name: '?', team: -1, alive: false };
      found = blank(b);
      this.buddies.set(id, found);
    }
    return found;
  }
}

const sum = <T>(items: readonly T[], of: (item: T) => number): number => items.reduce((n, item) => n + of(item), 0);

/** The best of a list by some measure, or null when nobody scored on it at all. */
function best<T>(items: readonly T[], by: (item: T) => number, floor = 0): T | null {
  let winner: T | null = null;
  let top = floor;
  for (const item of items) {
    const value = by(item);
    if (value > top) {
      top = value;
      winner = item;
    }
  }
  return winner;
}

const percent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

/**
 * The honours board. Every award is skipped when nobody earned it, so a short, quiet match shows
 * three lines rather than a dozen empty ones — an award nobody won is not a fact about the match.
 */
function awardsFor(
  buddies: readonly BuddyRecord[],
  teams: readonly TeamRecord[],
  roster: StatsRoster,
  favourite: { weapon: WeaponId; uses: number } | null,
): Award[] {
  const out: Award[] = [];
  const add = (id: string, icon: string, title: string, who: string | null, detail: string): void => {
    if (who) out.push({ id, icon, title, who, detail });
  };

  const mvp = best(buddies, (b) => b.dealt);
  add('mvp', '\u{1f3c5}', 'Most Valuable Buddy', mvp?.name ?? null, `${String(mvp?.dealt ?? 0)} damage dealt`);

  const hardest = best(buddies, (b) => b.best.amount);
  add('biggest', '\u{1f4a5}', 'Biggest single hit', hardest?.name ?? null, `${String(hardest?.best.amount ?? 0)} in one blow`);

  const ownGoal = best(buddies, (b) => b.friendly);
  add('owngoal', '\u{1f926}', 'Own goal of the match', ownGoal?.name ?? null, `${String(ownGoal?.friendly ?? 0)} damage to its own side`);

  // Accuracy is only a fact about somebody who actually took a few shots.
  const marksmen = buddies.filter((b) => b.shots >= 3);
  const deadeye = best(marksmen, (b) => b.hits / b.shots);
  if (deadeye && deadeye.hits > 0) {
    add('deadeye', '\u{1f3af}', 'Deadeye', deadeye.name, `${percent(deadeye.hits / deadeye.shots)} of ${String(deadeye.shots)} shots found somebody`);
  }
  const butter = best(marksmen, (b) => 1 - b.hits / b.shots);
  if (butter && butter !== deadeye && butter.hits < butter.shots) {
    add(
      'butterfingers',
      '\u{1f9e4}',
      'Butterfingers',
      butter.name,
      `${String(butter.shots - butter.hits)} of ${String(butter.shots)} shots hit nothing at all`,
    );
  }

  const collector = best(buddies, (b) => b.crates);
  add('crates', '\u{1f4e6}', 'Crate hoarder', collector?.name ?? null, `${String(collector?.crates ?? 0)} collected`);

  const drowned = buddies.filter((b) => b.drowned);
  if (drowned.length) add('swim', '\u{1f30a}', 'Gone swimming', drowned.map((b) => b.name).join(', '), `${String(drowned.length)} went over the side`);

  const untouched = buddies.filter((b) => b.alive && b.taken === 0);
  if (untouched.length) add('untouched', '\u{1f9c4}', 'Not a scratch', untouched.map((b) => b.name).join(', '), 'came through without taking a hit');

  const pacifists = buddies.filter((b) => b.shots === 0 && b.alive);
  if (pacifists.length) add('pacifist', '\u{1f54a}', 'Kept its head down', pacifists.map((b) => b.name).join(', '), 'never fired a shot');

  const worst = best(teams, (t) => t.taken - t.dealt);
  if (worst && teams.length > 1) add('worst', '\u{1f4c9}', 'Worst day out', worst.name, `took ${String(worst.taken)} and gave ${String(worst.dealt)}`);

  if (favourite) {
    add('favourite', WEAPONS[favourite.weapon].icon, 'Weapon of the match', WEAPONS[favourite.weapon].name, `used ${String(favourite.uses)} times`);
  }

  if (roster.groundLost > 0.001) add('ground', '\u{1f5ff}', 'Island demolished', percent(roster.groundLost), 'of the rock is gone');

  const minutes = Math.floor(roster.seconds / 60);
  const seconds = Math.round(roster.seconds % 60);
  add('length', '⏱', 'Time in the field', `${String(roster.turns)} turns`, `${String(minutes)} min ${String(seconds)} s of pungent combat`);
  return out;
}
