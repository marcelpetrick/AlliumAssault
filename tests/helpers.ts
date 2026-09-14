import { Game, type MatchConfig, type TeamConfig } from '../src/core/game';
import { Terrain } from '../src/core/terrain';
import { WATER_LEVEL, WORLD_HEIGHT, WORLD_WIDTH } from '../src/core/constants';

/** Flat ground with its surface at `groundY`, spanning the whole world. */
export function flatTerrain(groundY = 20): Terrain {
  const t = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
  t.fill((_x, y) => groundY - y);
  return t;
}

export function team(name: string, buddies: number, controller: TeamConfig['controller'] = 'human'): TeamConfig {
  return {
    name,
    color: '#ff0000',
    controller,
    aiLevel: 'normal',
    buddyNames: Array.from({ length: buddies }, (_, i) => `${name}${i + 1}`),
  };
}

export function config(teams: TeamConfig[], overrides: Partial<MatchConfig> = {}): MatchConfig {
  return { seed: 'test', teams, turnTime: 45, retreatTime: 5, windMax: 0, theme: 'meadow', ...overrides };
}

/** A game on flat ground with buddies placed at the given x positions (team order interleaved). */
export function flatGame(xs: number[], teams: TeamConfig[], overrides: Partial<MatchConfig> = {}): Game {
  const ground = 20;
  return new Game(config(teams, overrides), {
    terrain: flatTerrain(ground),
    spawns: xs.map((x) => ({ x, y: ground + 0.65 })),
  });
}

/** Run until the given predicate holds or the time budget is exhausted. */
export function runUntil(game: Game, predicate: () => boolean, seconds = 30): boolean {
  for (let s = 0; s < seconds * 60; s++) {
    if (predicate()) return true;
    game.step(1 / 60);
  }
  return predicate();
}
