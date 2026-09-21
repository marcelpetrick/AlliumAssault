// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * What the rules core costs, stage by stage, away from the GPU.
 *
 * The browser tells you how a frame feels; this tells you what the simulation underneath it costs,
 * which is the half a test suite can hold still. Every benchmark advances one fixed 60 Hz step, so
 * the mean time is microseconds per step against a 16,667 µs frame budget.
 *
 *   npm run profile
 *
 * For the function-level picture, run it under a profiler and open the result in Chrome DevTools:
 *   node --cpu-prof --cpu-prof-dir=.profile ./node_modules/vitest/vitest.mjs run --config vitest.profile.config.ts
 */

import { it } from 'vitest';
import { WATER_LEVEL, WORLD_HEIGHT, WORLD_WIDTH } from '../src/core/constants';
import { contourRegion } from '../src/core/contour';
import { FLAME_BITE_INTERVAL, FLAME_BITES } from '../src/core/fire';
import { Game, type MatchConfig, type TeamConfig } from '../src/core/game';
import { placeMine } from '../src/core/mines';
import { createBody } from '../src/core/physics';
import { generateTerrain, Terrain } from '../src/core/terrain';

const STEP = 1 / 60;

function team(name: string, buddies: number, controller: TeamConfig['controller'] = 'human'): TeamConfig {
  return { name, color: '#ef4b3c', controller, aiLevel: 'hard', buddyNames: Array.from({ length: buddies }, (_, k) => `${name}${k + 1}`) };
}

/** A match already past its turn intro, so the benchmarks measure play rather than the banner. */
function match(teams: TeamConfig[], overrides: Partial<MatchConfig> = {}): Game {
  const config: MatchConfig = { seed: 'profile', teams, turnTime: 90, retreatTime: 5, windMax: 0.7, theme: 'meadow', ...overrides };
  const terrain = generateTerrain({ seed: config.seed, width: WORLD_WIDTH, height: WORLD_HEIGHT, waterLevel: WATER_LEVEL });
  const game = new Game(config, { terrain });
  for (let k = 0; k < 240 && game.phase !== 'aiming'; k++) game.step(STEP);
  return game;
}

/** Run `work` for `seconds` and report the average microseconds one call took. */
function measure(name: string, work: () => void, seconds = 1): { name: string; us: number; frame: string } {
  for (let k = 0; k < 200; k++) work();
  let calls = 0;
  const started = performance.now();
  while (performance.now() - started < seconds * 1000) {
    for (let k = 0; k < 50; k++) work();
    calls += 50;
  }
  const us = ((performance.now() - started) * 1000) / calls;
  return { name, us: Math.round(us * 10) / 10, frame: `${((us / (STEP * 1e6)) * 100).toFixed(2)}%` };
}

it('profiles one simulation step, stage by stage', () => {
  const rows: { name: string; us: number; frame: string }[] = [];

  const idle = match([team('A', 4), team('B', 4)]);
  rows.push(
    measure('idle turn, 8 buddies', () => {
      idle.step(STEP);
    }),
  );

  const walking = match([team('A', 4), team('B', 4)]);
  walking.input.right = true;
  rows.push(
    measure('walking buddy', () => {
      walking.step(STEP);
    }),
  );

  const flying = match([team('A', 4), team('B', 4)]);
  rows.push(
    measure('12 projectiles in flight', () => {
      while (flying.projectiles.length < 12) {
        flying.projectiles.push({
          id: 10_000 + flying.projectiles.length,
          weapon: 'bazooka',
          x: 10 + flying.projectiles.length * 9,
          y: 40,
          vx: 18,
          vy: 4,
          radius: 0.15,
          bounces: 0,
          fuse: 0,
          age: 0,
          owner: -1,
        });
      }
      flying.step(STEP);
    }),
  );

  const burning = match([team('A', 4), team('B', 4)]);
  rows.push(
    measure('20 napalm patches burning', () => {
      while (burning.flames.length < 20) {
        burning.flames.push({
          id: 90_000 + burning.flames.length,
          x: 20 + burning.flames.length * 4,
          y: 30,
          life: 9,
          bite: FLAME_BITE_INTERVAL,
          bitesLeft: FLAME_BITES,
        });
      }
      burning.step(STEP);
    }),
  );

  const crowded = match([team('A', 4), team('B', 4), team('C', 4), team('D', 4)], { crates: 2 });
  for (let k = 0; k < 8; k++) {
    crowded.crates.push({ id: 5000 + k, kind: 'health', weapon: null, body: createBody(12 + k * 13, 40, 0.45) });
    crowded.mines.push(placeMine(6000 + k, 0, 0, 15 + k * 12, 40));
    crowded.graves.push({ id: 7000 + k, buddy: k, team: 0, name: 'X', body: createBody(18 + k * 11, 40, 0.45) });
  }
  rows.push(
    measure('16 buddies, 8 crates, mines, graves', () => {
      crowded.step(STEP);
    }),
  );

  const flooding = match([team('A', 4), team('B', 4)], { suddenDeath: 1 });
  flooding.waterRising = true;
  rows.push(
    measure('sudden death, water rising', () => {
      flooding.step(STEP);
    }),
  );

  const thinking = match([team('A', 4, 'ai'), team('B', 4)]);
  rows.push(
    measure('AI turn', () => {
      thinking.step(STEP);
    }),
  );

  const terrain = generateTerrain({ seed: 'profile', width: WORLD_WIDTH, height: WORLD_HEIGHT, waterLevel: WATER_LEVEL });
  let at = 20;
  rows.push(
    measure('carve a crater + contour its chunk', () => {
      at = (at + 7) % 100;
      terrain.carve(at, 24, 3);
      contourRegion(terrain.field, terrain.nx, 0, 0, 32, 32);
    }),
  );

  const flat = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
  flat.fill((_x, y) => 24 - y);
  rows.push(
    measure('1000 terrain samples', () => {
      for (let k = 0; k < 1000; k++) flat.sample(10 + (k % 100), 20 + (k % 17) * 0.3);
    }),
  );

  const withBoards = new Terrain(WORLD_WIDTH, WORLD_HEIGHT, WATER_LEVEL);
  withBoards.fill((_x, y) => 24 - y);
  for (let k = 0; k < 8; k++) withBoards.addPlatform({ x: 20 + k * 12, y: 30, angle: 0.1 });
  rows.push(
    measure('1000 samples with 8 platforms', () => {
      for (let k = 0; k < 1000; k++) withBoards.sample(10 + (k % 100), 20 + (k % 17) * 0.3);
    }),
  );

  console.log('\nRules core — µs per call (a whole frame is 16,667 µs)\n');
  console.log(`${'scenario'.padEnd(38)}${'µs'.padStart(10)}${'frame'.padStart(10)}`);
  for (const row of rows) console.log(`${row.name.padEnd(38)}${row.us.toFixed(1).padStart(10)}${row.frame.padStart(10)}`);
  console.log('');
});
