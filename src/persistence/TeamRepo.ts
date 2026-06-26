import { AlliumDB, type TeamRecord, type TeamStatisticsRecord } from './db';

const ZERO_STATS = (teamId: string): TeamStatisticsRecord => ({
  teamId,
  matchesPlayed: 0,
  matchesWon: 0,
  enemiesDefeated: 0,
  garlicsLost: 0,
  damageDealt: 0,
  damageReceived: 0,
});

export class TeamRepo {
  private readonly db: AlliumDB;

  constructor(db: AlliumDB) {
    this.db = db;
  }

  async getAll(): Promise<TeamRecord[]> {
    return this.db.teams.toArray();
  }

  async get(id: string): Promise<TeamRecord | undefined> {
    return this.db.teams.get(id);
  }

  async save(team: TeamRecord): Promise<void> {
    await this.db.teams.put(team);
  }

  async delete(id: string): Promise<void> {
    await this.db.teams.delete(id);
  }

  async getStatistics(teamId: string): Promise<TeamStatisticsRecord> {
    return (await this.db.teamStatistics.get(teamId)) ?? ZERO_STATS(teamId);
  }

  async updateStatistics(
    teamId: string,
    delta: Partial<Omit<TeamStatisticsRecord, 'teamId'>>,
  ): Promise<void> {
    const current = await this.getStatistics(teamId);
    await this.db.teamStatistics.put({
      ...current,
      matchesPlayed: current.matchesPlayed + (delta.matchesPlayed ?? 0),
      matchesWon: current.matchesWon + (delta.matchesWon ?? 0),
      enemiesDefeated: current.enemiesDefeated + (delta.enemiesDefeated ?? 0),
      garlicsLost: current.garlicsLost + (delta.garlicsLost ?? 0),
      damageDealt: current.damageDealt + (delta.damageDealt ?? 0),
      damageReceived: current.damageReceived + (delta.damageReceived ?? 0),
    });
  }
}
