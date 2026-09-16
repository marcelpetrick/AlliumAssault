// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { DEFAULT_CRATE_CHANCE } from '../core/crates';
import type { AiLevel, Arsenal, Controller, MatchConfig, TeamConfig } from '../core/game';
import { shuffle } from '../core/rng';
import { THEME_IDS } from '../render/themes';

export const TEAM_COLORS = ['#ef4b3c', '#3d8bfd', '#2ecc71', '#f5b92e', '#a45ee5', '#ff7eb6'];
export const TEAM_NAMES = ['Garlic Gang', 'Clove Crew', 'Bulb Brigade', 'Stink Squad'];
export const BUDDY_NAMES = [
  'Clovis', 'Allie', 'Sprout', 'Chive', 'Aioli', 'Pesto', 'Toasty', 'Bulby', 'Stinky', 'Peely',
  'Roasty', 'Shallot', 'Leeky', 'Ramson', 'Zesty', 'Garly', 'Crusher', 'Minty', 'Nibbles', 'Pungent',
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
export const CRATE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Normal', value: DEFAULT_CRATE_CHANCE },
  { label: 'Lots', value: 0.7 },
];

export const randomSeed = (): string => Math.random().toString(36).slice(2, 8);

const random = () => Math.random();

export function makeTeam(index: number, controller: Controller, aiLevel: AiLevel, buddies: number, taken: string[] = []): TeamConfig {
  const names = shuffle(BUDDY_NAMES.filter((n) => !taken.includes(n)), random).slice(0, buddies);
  return { name: TEAM_NAMES[index % TEAM_NAMES.length], color: TEAM_COLORS[index % TEAM_COLORS.length], controller, aiLevel, buddyNames: names };
}

/** Resize a team's buddy list, keeping existing names and avoiding duplicates across teams. */
export function setBuddyCount(match: MatchConfig, team: TeamConfig, count: number): void {
  const taken = match.teams.flatMap((t) => t.buddyNames);
  const pool = shuffle(BUDDY_NAMES.filter((n) => !taken.includes(n)), random);
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
    theme: THEME_IDS[Math.floor(Math.random() * THEME_IDS.length)],
  };
}
