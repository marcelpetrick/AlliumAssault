import type { Vec2 } from '../types';

export type SimEvent =
  | {
      type: 'ProjectileSpawned';
      projectileId: string;
      weaponId: string;
      position: Vec2;
      velocity: Vec2;
    }
  | { type: 'ProjectileDetonated'; projectileId: string; position: Vec2 }
  | { type: 'TerrainModified'; dirtyChunkIds: number[] }
  | { type: 'CharacterDamaged'; characterId: string; damage: number; source: string }
  | { type: 'CharacterImpulsed'; characterId: string; impulse: Vec2 }
  | { type: 'CharacterKilled'; characterId: string; cause: string }
  | { type: 'TeamEliminated'; teamId: string }
  | { type: 'TurnStarted'; teamId: string; characterId: string; windX: number; windY: number }
  | { type: 'TurnEnded'; teamId: string }
  | { type: 'RetreatStarted'; seconds: number }
  | { type: 'WorldSettled' }
  | { type: 'MatchEnded'; winnerTeamId: string | null }
  | { type: 'WindChanged'; x: number; y: number };
