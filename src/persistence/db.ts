import Dexie, { type Table } from 'dexie';

export interface SettingsRecord {
  id: 1;
  audioMusic: number;
  audioSfx: number;
  audioVoice: number;
  controlBindings: Record<string, string>;
  screenShake: boolean;
  reducedFlash: boolean;
}

export interface TeamRecord {
  id: string;
  name: string;
  color: number;
  emblem: string;
  garlicNames: string[];
  cosmetics: Record<string, string>;
}

export interface TeamStatisticsRecord {
  teamId: string;
  matchesPlayed: number;
  matchesWon: number;
  enemiesDefeated: number;
  garlicsLost: number;
  damageDealt: number;
  damageReceived: number;
}

export interface MatchSummaryRecord {
  id: string;
  startedAt: string;
  completedAt: string;
  seed: string;
  generatorVersion: number;
  teamIds: string[];
  winnerTeamId: string | null;
  durationSeconds: number;
  turnsPlayed: number;
}

export interface RecentSeedRecord {
  seed: string;
  generatorVersion: number;
  playedAt: string;
}

export class AlliumDB extends Dexie {
  settings!: Table<SettingsRecord, number>;
  teams!: Table<TeamRecord, string>;
  teamStatistics!: Table<TeamStatisticsRecord, string>;
  matchSummaries!: Table<MatchSummaryRecord, string>;
  recentSeeds!: Table<RecentSeedRecord, string>;

  constructor() {
    super('AlliumAssault');
    this.version(1).stores({
      settings: 'id',
      teams: 'id',
      teamStatistics: 'teamId',
      matchSummaries: 'id, startedAt',
      recentSeeds: 'seed, playedAt',
    });
  }
}

// Default singleton — swapped out in tests via fake-indexeddb
export const db = new AlliumDB();
