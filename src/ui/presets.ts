// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Quality } from '../render/world';
import { DEFAULT_CRATE_CHANCE } from '../core/crates';
import type { AiLevel, Arsenal, Controller, MatchConfig, TeamConfig } from '../core/game';
import { shuffle } from '../core/rng';
import { THEME_IDS } from '../render/themes';

export const TEAM_COLORS = ['#ef4b3c', '#3d8bfd', '#2ecc71', '#f5b92e', '#a45ee5', '#ff7eb6'];
export const TEAM_NAMES = ['Garlic Gang', 'Clove Crew', 'Bulb Brigade', 'Stink Squad'];
export const BUDDY_NAMES = [
  'Clovis',
  'Allie',
  'Sprout',
  'Chive',
  'Aioli',
  'Pesto',
  'Toasty',
  'Bulby',
  'Stinky',
  'Peely',
  'Roasty',
  'Shallot',
  'Leeky',
  'Ramson',
  'Zesty',
  'Garly',
  'Crusher',
  'Minty',
  'Nibbles',
  'Pungent',
];

export const WIND_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Light', value: 0.35 },
  { label: 'Normal', value: 0.7 },
  { label: 'Strong', value: 1 },
];
export const TURN_OPTIONS = [30, 45, 60, 90];
export const ARSENAL_OPTIONS: { label: string; value: Arsenal }[] = [
  { label: 'All weapons', value: 'all' },
  { label: 'Find in crates', value: 'crates' },
  { label: 'Infinite supplies', value: 'infinite' },
];
/** Turn on which Sudden Death drops everybody to 1 HP and starts the flood; 0 is off. */
export const SUDDEN_DEATH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Turn 10', value: 10 },
  { label: 'Turn 20', value: 20 },
  { label: 'Turn 30', value: 30 },
];
/**
 * The arena's pull as a multiple of the standard one. Normal is the world the game has always had;
 * Moon makes for floaty jumps, long throws and gentle landings, Heavy for the opposite.
 */
export const GRAVITY_OPTIONS = [
  { label: 'Moon', value: 0.55 },
  { label: 'Normal', value: 1 },
  { label: 'Heavy', value: 1.5 },
];
/**
 * How much the renderer is allowed to spend. Full is the default and stays the default: shadows,
 * bloom, antialiasing and the full pixel density, even where that costs frames. Low is for weak
 * GPUs and is what `?quality=low` in the URL selects.
 */
export const QUALITY_OPTIONS: { label: string; value: Quality }[] = [
  { label: 'Full', value: 'high' },
  { label: 'Low (weak GPU)', value: 'low' },
];
export const CRATE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Normal', value: DEFAULT_CRATE_CHANCE },
  { label: 'Lots', value: 0.7 },
  // From 1 upwards the value is a guaranteed number of crates per turn instead of a chance.
  { label: 'Craziness', value: 2 },
];

export const randomSeed = (): string => Math.random().toString(36).slice(2, 8);

const random = () => Math.random();

export function makeTeam(index: number, controller: Controller, aiLevel: AiLevel, buddies: number, taken: string[] = []): TeamConfig {
  const names = shuffle(
    BUDDY_NAMES.filter((n) => !taken.includes(n)),
    random,
  ).slice(0, buddies);
  return { name: TEAM_NAMES[index % TEAM_NAMES.length], color: TEAM_COLORS[index % TEAM_COLORS.length], controller, aiLevel, buddyNames: names };
}

/** Resize a team's buddy list, keeping existing names and avoiding duplicates across teams. */
export function setBuddyCount(match: MatchConfig, team: TeamConfig, count: number): void {
  const taken = match.teams.flatMap((t) => t.buddyNames);
  const pool = shuffle(
    BUDDY_NAMES.filter((n) => !taken.includes(n)),
    random,
  );
  while (team.buddyNames.length < count) team.buddyNames.push(pool.pop() ?? `Clove ${team.buddyNames.length + 1}`);
  team.buddyNames.length = count;
}

export function quickMatch(): MatchConfig {
  const human = makeTeam(0, 'human', 'normal', 3);
  return {
    seed: randomSeed(),
    teams: [human, makeTeam(1, 'ai', 'normal', 3, human.buddyNames)],
    turnTime: 45,
    retreatTime: 5,
    windMax: 0.7,
    crates: 0.35,
    arsenal: 'all',
    suddenDeath: 10,
    theme: 'meadow',
  };
}

export function demoMatch(): MatchConfig {
  const a = makeTeam(0, 'ai', 'hard', 3);
  return {
    seed: randomSeed(),
    teams: [a, makeTeam(1, 'ai', 'normal', 3, a.buddyNames)],
    turnTime: 20,
    retreatTime: 2,
    windMax: 0.5,
    crates: 0.35,
    suddenDeath: 10,
    theme: THEME_IDS[Math.floor(Math.random() * THEME_IDS.length)],
  };
}
