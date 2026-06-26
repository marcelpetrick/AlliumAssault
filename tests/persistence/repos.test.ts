import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { AlliumDB } from '@persistence/db';
import { SettingsRepo, DEFAULT_SETTINGS } from '@persistence/SettingsRepo';
import { TeamRepo } from '@persistence/TeamRepo';
import { MatchRepo } from '@persistence/MatchRepo';
import type { TeamRecord, MatchSummaryRecord } from '@persistence/db';

// Each test suite uses a fresh DB instance
function freshDB(): AlliumDB {
  return new AlliumDB();
}

describe('SettingsRepo', () => {
  let repo: SettingsRepo;

  beforeEach(() => {
    repo = new SettingsRepo(freshDB());
  });

  it('get() returns defaults when nothing is stored', async () => {
    const s = await repo.get();
    expect(s.audioMusic).toBe(DEFAULT_SETTINGS.audioMusic);
    expect(s.audioSfx).toBe(DEFAULT_SETTINGS.audioSfx);
    expect(s.screenShake).toBe(DEFAULT_SETTINGS.screenShake);
  });

  it('save() and get() round-trip values', async () => {
    await repo.save({ audioMusic: 0.3, screenShake: false });
    const s = await repo.get();
    expect(s.audioMusic).toBeCloseTo(0.3);
    expect(s.screenShake).toBe(false);
    // Unmodified field stays at default
    expect(s.audioSfx).toBe(DEFAULT_SETTINGS.audioSfx);
  });

  it('saveControlBindings / getControlBindings round-trip', async () => {
    const bindings = { MoveLeft: 'KeyA', MoveRight: 'KeyD', Jump: 'KeyW' };
    await repo.saveControlBindings(bindings);
    const stored = await repo.getControlBindings();
    expect(stored['MoveLeft']).toBe('KeyA');
    expect(stored['MoveRight']).toBe('KeyD');
  });
});

describe('TeamRepo', () => {
  let repo: TeamRepo;

  beforeEach(() => {
    repo = new TeamRepo(freshDB());
  });

  const sampleTeam: TeamRecord = {
    id: 'team-abc',
    name: 'The Stinkies',
    color: 0xff2200,
    emblem: 'skull',
    garlicNames: ['Minty', 'Bud', 'Sprout'],
    cosmetics: { hat: 'tophat' },
  };

  it('save and get round-trip a team', async () => {
    await repo.save(sampleTeam);
    const retrieved = await repo.get('team-abc');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('The Stinkies');
    expect(retrieved?.garlicNames).toEqual(['Minty', 'Bud', 'Sprout']);
  });

  it('getAll returns all saved teams', async () => {
    await repo.save(sampleTeam);
    await repo.save({ ...sampleTeam, id: 'team-xyz', name: 'Odour Squad' });
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
  });

  it('delete removes a team', async () => {
    await repo.save(sampleTeam);
    await repo.delete('team-abc');
    const retrieved = await repo.get('team-abc');
    expect(retrieved).toBeUndefined();
  });

  it('getStatistics returns zeroed record if none exists', async () => {
    const stats = await repo.getStatistics('nonexistent');
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.damageDealt).toBe(0);
  });

  it('updateStatistics increments deltas', async () => {
    await repo.updateStatistics('team-abc', { matchesPlayed: 1, damageDealt: 150 });
    await repo.updateStatistics('team-abc', { matchesPlayed: 1, matchesWon: 1 });
    const stats = await repo.getStatistics('team-abc');
    expect(stats.matchesPlayed).toBe(2);
    expect(stats.matchesWon).toBe(1);
    expect(stats.damageDealt).toBe(150);
  });
});

describe('MatchRepo', () => {
  let repo: MatchRepo;

  beforeEach(() => {
    repo = new MatchRepo(freshDB());
  });

  const sampleMatch: MatchSummaryRecord = {
    id: 'match-001',
    startedAt: '2026-06-26T10:00:00Z',
    completedAt: '2026-06-26T10:15:00Z',
    seed: 'abc123',
    generatorVersion: 1,
    teamIds: ['t1', 't2'],
    winnerTeamId: 't1',
    durationSeconds: 900,
    turnsPlayed: 12,
  };

  it('recordMatch and getRecent round-trip', async () => {
    await repo.recordMatch(sampleMatch);
    const recent = await repo.getRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.id).toBe('match-001');
  });

  it('getRecent respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.recordMatch({
        ...sampleMatch,
        id: `match-${i}`,
        startedAt: `2026-06-26T10:0${i}:00Z`,
      });
    }
    const recent = await repo.getRecent(3);
    expect(recent).toHaveLength(3);
  });

  it('addRecentSeed and getRecentSeeds round-trip', async () => {
    await repo.addRecentSeed('seed-xyz', 1);
    const seeds = await repo.getRecentSeeds();
    expect(seeds.some((s) => s.seed === 'seed-xyz')).toBe(true);
  });
});
