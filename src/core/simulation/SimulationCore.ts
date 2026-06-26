import { MatchStateMachine, type MatchState } from '../state/MatchStateMachine';
import { SeedManager } from '../rng/SeedManager';
import { generateTerrain } from '../terrain/TerrainGenerator';
import { createTeam } from '../entities/Team';
import type { Command } from './Commands';
import type { SimEvent } from './Events';
import type { AiDifficulty, ControllerType } from '../types';

export interface TeamConfig {
  id: string;
  name: string;
  color: number;
  controllerType: ControllerType;
  aiDifficulty?: AiDifficulty;
  characterNames: string[];
}

export interface MatchConfig {
  seed: string;
  teams: TeamConfig[];
  worldWidth: number;
  worldHeight: number;
  turnDuration: number;
  retreatDuration: number;
  friendlyFire: boolean;
}

export interface SimulationCoreOptions {
  initialState: MatchState;
  windRng: () => number;
}

export class SimulationCore {
  private readonly fsm: MatchStateMachine;
  private readonly listeners = new Map<string, Set<(e: SimEvent) => void>>();

  constructor(opts: SimulationCoreOptions) {
    this.fsm = new MatchStateMachine(opts.initialState, opts.windRng);
  }

  step(dt: number, commands: Command[]): void {
    const events = this.fsm.update(dt, commands);
    for (const event of events) {
      const handlers = this.listeners.get(event.type);
      if (handlers) {
        for (const h of handlers) h(event);
      }
      // Also dispatch to '*' wildcard listeners
      const all = this.listeners.get('*');
      if (all) {
        for (const h of all) h(event);
      }
    }
  }

  on(eventType: SimEvent['type'] | '*', handler: (e: SimEvent) => void): () => void {
    let set = this.listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.listeners.set(eventType, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  getState(): Readonly<MatchState> {
    return this.fsm.getState();
  }

  static createMatch(config: MatchConfig): SimulationCore {
    const totalChars = config.teams.reduce((sum, t) => sum + t.characterNames.length, 0);
    const seedMgr = new SeedManager(config.seed);
    const windRng = seedMgr.getStream('wind');

    const terrainResult = generateTerrain(
      {
        seed: config.seed,
        generatorVersion: 1,
        width: config.worldWidth,
        height: config.worldHeight,
        themeId: 'forest',
        terrainDensity: 0.5,
        caveDensity: 0.3,
        islandDensity: 0.2,
        roughness: 0.5,
        waterLevel: config.worldHeight * 0.935,
      },
      totalChars,
    );

    // Build teams and assign spawn positions
    const teams = config.teams.map((tc) => {
      return createTeam(
        tc.id,
        tc.name,
        tc.color,
        tc.controllerType,
        tc.aiDifficulty ?? 'normal',
        tc.characterNames,
      );
    });

    // Distribute spawn points across all characters
    let spawnIdx = 0;
    for (const team of teams) {
      for (const char of team.characters) {
        const sp = terrainResult.spawnPoints[spawnIdx % terrainResult.spawnPoints.length];
        if (sp) {
          char.position.x = sp.x;
          char.position.y = sp.y - 14; // stand on surface
        }
        spawnIdx++;
      }
    }

    const windX = (windRng() * 2 - 1) * 4;

    const initialState: MatchState = {
      phase: 'playing',
      turnState: 'TURN_INTRO',
      activeTeamIndex: 0,
      teams,
      projectiles: [],
      terrain: terrainResult.mask,
      waterLevel: terrainResult.waterLevel,
      wind: { x: windX, y: 0 },
      turnDuration: config.turnDuration,
      turnTimeRemaining: config.turnDuration,
      retreatTimeRemaining: config.retreatDuration,
      settlingTicksStable: 0,
      settlingElapsed: 0,
      selectedWeaponId: null,
      aimAngle: 0,
      chargePower: 0,
      isCharging: false,
      pendingDamages: [],
      pendingDeaths: [],
      winnerId: null,
      turnCount: 0,
      stateTimer: 0,
      moveLeft: false,
      moveRight: 0,
      jumpQueued: false,
    };

    return new SimulationCore({ initialState, windRng });
  }
}
