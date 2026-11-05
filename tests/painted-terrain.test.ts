// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { EMPTY_PAINT, PAINT_HEIGHT, PAINT_WIDTH, paintedPlayable, paintedTerrain, validPaint } from '../src/core/paintedTerrain';
import { Game } from '../src/core/game';
import { config, team } from './helpers';

function landscape(): string {
  const cells = EMPTY_PAINT.split('');
  for (let y = 20; y < 27; y++) for (let x = 4; x < 60; x++) cells[y * PAINT_WIDTH + x] = '1';
  for (let y = 9; y < 13; y++) for (let x = 20; x < 30; x++) cells[y * PAINT_WIDTH + x] = '1';
  return cells.join('');
}

describe('painted landscapes', () => {
  it('rejects malformed and empty sketches', () => {
    expect(validPaint('1')).toBe(false);
    expect(validPaint('x'.repeat(PAINT_WIDTH * PAINT_HEIGHT))).toBe(false);
    expect(validPaint(EMPTY_PAINT)).toBe(true);
    expect(paintedPlayable(EMPTY_PAINT, 6)).toBe(false);
  });

  it('preserves a main island and a separate floating island with safe spawn positions', () => {
    const mask = landscape();
    const t = paintedTerrain(mask);
    expect(t.isSolid(40, 20)).toBe(true);
    expect(t.isSolid(50, 42)).toBe(true);
    expect(t.isSolid(50, 33)).toBe(false);
    expect(paintedPlayable(mask, 6)).toBe(true);
    expect([...paintedTerrain(mask).field]).toEqual([...t.field]);
    const game = new Game(config([team('A', 3), team('B', 3)], { painted: mask }));
    expect([...game.terrain.field]).toEqual([...t.field]);
    expect(game.buddies).toHaveLength(6);
    const rematch = new Game(config([team('A', 3), team('B', 3)], { seed: 'another-seed', painted: mask }));
    expect(rematch.buddies.map((b) => [b.body.x, b.body.y])).toEqual(game.buddies.map((b) => [b.body.x, b.body.y]));
    game.simulate(3);
    expect(game.buddies.every((b) => b.alive && b.body.grounded)).toBe(true);
    const buddy = game.activeBuddy!;
    const startX = buddy.body.x;
    game.input.right = true;
    game.simulate(0.5);
    game.input.right = false;
    expect(buddy.body.x).toBeGreaterThan(startX + 0.5);
    const startY = buddy.body.y;
    game.jump();
    game.simulate(0.1);
    expect(buddy.body.y).toBeGreaterThan(startY + 0.3);
  });

  it('does not silently spawn a match on an unplayable painting', () => {
    expect(() => new Game(config([team('A', 1), team('B', 1)], { painted: EMPTY_PAINT }))).toThrow('insufficient safe spawn positions');
  });
});
