// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/** Measure individual attack searches, which an amortized step benchmark can hide. */
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
});

const { Game } = await import('../src/core/game.ts');
const { planAttack } = await import('../src/core/ai.ts');
const { rngFor } = await import('../src/core/rng.ts');
const team = (count, index) => ({
  name: `Team ${index}`,
  color: '#ff0000',
  controller: index ? 'human' : 'ai',
  aiLevel: 'normal',
  buddyNames: Array.from({ length: count }, (_, i) => `Buddy ${i}`),
});
const rows = [];
for (const [teamCount, buddyCount] of [
  [2, 1],
  [2, 4],
  [4, 4],
]) {
  const game = new Game({
    seed: 'profile-ai',
    teams: Array.from({ length: teamCount }, (_, i) => team(buddyCount, i)),
    turnTime: 90,
    retreatTime: 5,
    windMax: 0.7,
    theme: 'meadow',
  });
  while (game.phase !== 'aiming') game.step(1 / 60);
  for (const level of ['normal', 'hard']) {
    const samples = [];
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      const plan = planAttack(game, game.activeBuddy, level, rngFor(`sample${i}`, 'ai'));
      if (!Number.isFinite(plan.score)) throw new Error('No attack plan');
      if (i >= 2) samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    rows.push({ teams: teamCount, buddies: game.buddies.length, level, medianMs: +samples[2].toFixed(2), maxMs: +samples[4].toFixed(2) });
  }
}
console.table(rows);
