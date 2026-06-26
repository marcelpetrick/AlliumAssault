import { AlliumDB, type MatchSummaryRecord, type RecentSeedRecord } from './db';

const MAX_RECENT_SEEDS = 20;

export class MatchRepo {
  private readonly db: AlliumDB;

  constructor(db: AlliumDB) {
    this.db = db;
  }

  async recordMatch(summary: MatchSummaryRecord): Promise<void> {
    await this.db.matchSummaries.put(summary);
  }

  async getRecent(limit = 20): Promise<MatchSummaryRecord[]> {
    const all = await this.db.matchSummaries.orderBy('startedAt').reverse().toArray();
    return all.slice(0, limit);
  }

  async addRecentSeed(seed: string, generatorVersion: number): Promise<void> {
    const record: RecentSeedRecord = {
      seed,
      generatorVersion,
      playedAt: new Date().toISOString(),
    };
    await this.db.recentSeeds.put(record);

    // Trim to max
    const all = await this.db.recentSeeds.orderBy('playedAt').toArray();
    if (all.length > MAX_RECENT_SEEDS) {
      const toDelete = all.slice(0, all.length - MAX_RECENT_SEEDS);
      for (const r of toDelete) await this.db.recentSeeds.delete(r.seed);
    }
  }

  async getRecentSeeds(limit = MAX_RECENT_SEEDS): Promise<RecentSeedRecord[]> {
    const all = await this.db.recentSeeds.orderBy('playedAt').reverse().toArray();
    return all.slice(0, limit);
  }
}
