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

import { WEAPONS, type WeaponId, type WeaponKind } from './weapons';

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
  /** It pressed its own detonator, which is a different kind of gone from being blown up.  */
  selfDestructed: boolean;
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

/**
 * Every award the match can hand out. Named rather than free-form so the interface can be held to
 * having words for all of them: a `t()` call built from an id nobody translated would otherwise
 * blank the whole scoreboard at the moment somebody finally won a match.
 */
export const AWARD_IDS = [
  'mvp',
  'biggest',
  'kills',
  'owngoal',
  'deadeye',
  'butterfingers',
  'crates',
  'swim',
  'blasted',
  'martyr',
  'untouched',
  'pacifist',
  'worst',
  'favourite',
  'handy',
  'ground',
  'length',
] as const;
export type AwardId = (typeof AWARD_IDS)[number];

/** Whether an award is something to be pleased about, to regret, or merely a fact of the match. */
export type Tone = 'good' | 'bad' | 'neutral';

/**
 * One line of the honours board. Deliberately wordless: the id says which award it is and `values`
 * carries the numbers behind it, and the interface turns the two into a sentence in whichever
 * language it is speaking. The core has no business holding English.
 */
export interface Award {
  id: AwardId;
  icon: string;
  /**
   * Who earned it — names as the roster spells them, joined for a shared award. For an award about
   * a weapon it is the weapon's id, because only the interface knows what to call one.
   */
  who: string;
  /** The numbers the sentence needs, by name. */
  values: Readonly<Record<string, number | string>>;
  tone: Tone;
}

/** How the buddies that are gone came to be gone. */
export interface Deaths {
  drowned: number;
  blasted: number;
  selfDestructed: number;
}

/** A weapon and how often it was used. */
export interface WeaponUse {
  weapon: WeaponId;
  uses: number;
}

export interface MatchSummary {
  teams: TeamRecord[];
  buddies: BuddyRecord[];
  /** Everything worth celebrating or noting, most interesting first. */
  awards: Award[];
  /** And the ones worth laughing at, kept apart so the honours board stays an honours board. */
  blunders: Award[];
  turns: number;
  /** Seconds of simulated play. */
  seconds: number;
  /** Share of the island blasted away, 0..1. */
  groundLost: number;
  /** Every weapon that was used, most-used first. */
  favourites: WeaponUse[];
  /** The tools among them — the rope, the torch, the drill and the rest that dig or carry. */
  tools: WeaponUse[];
  deaths: Deaths;
}

/** Buddies and teams as the recorder needs to know them, without importing the whole Game. */
export interface StatsRoster {
  buddies: { id: number; name: string; team: number; alive: boolean }[];
  teams: { index: number; name: string; colour: string }[];
  turns: number;
  seconds: number;
  groundLost: number;
}

/** Weapon kinds that are tools rather than weapons: they dig, carry or build rather than hurt. */
const TOOL_KINDS = new Set<WeaponKind>(['torch', 'drill', 'rope', 'platform', 'teleport', 'flamer']);

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
  selfDestructed: false,
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
    // Taking yourself with you is its own way to go, and worth counting separately.
    record.selfDestructed = by?.buddy === buddy && by.weapon === 'selfdestruct';
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
    const favourites: WeaponUse[] = [...this.weapons.entries()]
      .map(([weapon, uses]) => ({ weapon, uses }))
      .sort((a, b) => b.uses - a.uses || a.weapon.localeCompare(b.weapon));
    const tools = favourites.filter((u) => TOOL_KINDS.has(WEAPONS[u.weapon].kind));
    const deaths: Deaths = {
      drowned: buddies.filter((b) => b.drowned).length,
      selfDestructed: buddies.filter((b) => b.selfDestructed).length,
      blasted: buddies.filter((b) => !b.alive && !b.drowned && !b.selfDestructed).length,
    };
    const honours = awardsFor(buddies, teams, roster, favourites.at(0) ?? null, deaths, tools);
    return {
      teams,
      buddies: [...buddies].sort((a, b) => b.dealt - a.dealt || a.name.localeCompare(b.name)),
      awards: honours.filter((a) => a.tone !== 'bad'),
      blunders: honours.filter((a) => a.tone === 'bad'),
      turns: roster.turns,
      seconds: roster.seconds,
      groundLost: roster.groundLost,
      favourites,
      tools,
      deaths,
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
 * The honours board, as ids and numbers. Every award is skipped when nobody earned it, so a short,
 * quiet match shows three lines rather than a dozen empty ones — an award nobody won is not a fact
 * about the match. The `tone` is what lets the screen colour a triumph green and a blunder red, and
 * what separates the two lists.
 */
function awardsFor(
  buddies: readonly BuddyRecord[],
  teams: readonly TeamRecord[],
  roster: StatsRoster,
  favourite: WeaponUse | null,
  deaths: Deaths,
  tools: readonly WeaponUse[],
): Award[] {
  const out: Award[] = [];
  const add = (id: AwardId, icon: string, who: string | null, values: Record<string, number | string>, tone: Tone): void => {
    if (who) out.push({ id, icon, who, values, tone });
  };

  const mvp = best(buddies, (b) => b.dealt);
  add('mvp', '\u{1f3c5}', mvp?.name ?? null, { damage: mvp?.dealt ?? 0 }, 'good');

  const hardest = best(buddies, (b) => b.best.amount);
  add('biggest', '\u{1f4a5}', hardest?.name ?? null, { damage: hardest?.best.amount ?? 0 }, 'good');

  const killer = best(buddies, (b) => b.kills);
  add('kills', '\u{1f480}', killer?.name ?? null, { kills: killer?.kills ?? 0 }, 'good');

  const ownGoal = best(buddies, (b) => b.friendly);
  add('owngoal', '\u{1f926}', ownGoal?.name ?? null, { damage: ownGoal?.friendly ?? 0 }, 'bad');

  // Accuracy is only a fact about somebody who actually took a few shots.
  const marksmen = buddies.filter((b) => b.shots >= 3);
  const deadeye = best(marksmen, (b) => b.hits / b.shots);
  if (deadeye && deadeye.hits > 0) {
    add('deadeye', '\u{1f3af}', deadeye.name, { percent: percent(deadeye.hits / deadeye.shots), shots: deadeye.shots }, 'good');
  }
  const butter = best(marksmen, (b) => 1 - b.hits / b.shots);
  if (butter && butter !== deadeye && butter.hits < butter.shots) {
    add('butterfingers', '\u{1f9e4}', butter.name, { missed: butter.shots - butter.hits, shots: butter.shots }, 'bad');
  }

  const collector = best(buddies, (b) => b.crates);
  add('crates', '\u{1f4e6}', collector?.name ?? null, { crates: collector?.crates ?? 0 }, 'good');

  const drowned = buddies.filter((b) => b.drowned);
  if (drowned.length) add('swim', '\u{1f30a}', names(drowned), { count: drowned.length }, 'bad');

  const blownUp = buddies.filter((b) => !b.alive && !b.drowned && !b.selfDestructed);
  if (blownUp.length) add('blasted', '\u{1f4a3}', names(blownUp), { count: deaths.blasted }, 'neutral');

  const martyrs = buddies.filter((b) => b.selfDestructed);
  if (martyrs.length) add('martyr', '\u{1f92f}', names(martyrs), { count: deaths.selfDestructed }, 'bad');

  const untouched = buddies.filter((b) => b.alive && b.taken === 0);
  if (untouched.length) add('untouched', '\u{1f9c4}', names(untouched), { count: untouched.length }, 'good');

  const pacifists = buddies.filter((b) => b.shots === 0 && b.alive);
  if (pacifists.length) add('pacifist', '\u{1f54a}', names(pacifists), { count: pacifists.length }, 'bad');

  const worst = best(teams, (t) => t.taken - t.dealt);
  if (worst && teams.length > 1) add('worst', '\u{1f4c9}', worst.name, { taken: worst.taken, dealt: worst.dealt }, 'bad');

  if (favourite) add('favourite', WEAPONS[favourite.weapon].icon, favourite.weapon, { uses: favourite.uses, weapon: favourite.weapon }, 'neutral');

  const handiest = tools.at(0);
  if (handiest) add('handy', WEAPONS[handiest.weapon].icon, handiest.weapon, { uses: handiest.uses, weapon: handiest.weapon }, 'neutral');

  if (roster.groundLost > 0.001) add('ground', '\u{1f5ff}', percent(roster.groundLost), { percent: percent(roster.groundLost) }, 'neutral');

  add(
    'length',
    '\u23f1',
    String(roster.turns),
    { turns: roster.turns, minutes: Math.floor(roster.seconds / 60), seconds: Math.round(roster.seconds % 60) },
    'neutral',
  );
  return out;
}

/** Names of a group of buddies, in the order the roster gives them. */
const names = (group: readonly BuddyRecord[]): string => group.map((b) => b.name).join(', ');
