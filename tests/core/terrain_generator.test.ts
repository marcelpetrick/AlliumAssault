import { describe, it, expect } from 'vitest';
import { generateTerrain, type TerrainOptions } from '@core/terrain/TerrainGenerator';

const BASE_OPTIONS: TerrainOptions = {
  seed: 'test-seed-42',
  generatorVersion: 1,
  width: 500, // use smaller dimensions in tests for speed
  height: 200,
  themeId: 'forest',
  terrainDensity: 0.5,
  caveDensity: 0.3,
  islandDensity: 0.2,
  roughness: 0.5,
  waterLevel: 187,
};

describe('TerrainGenerator', () => {
  it('generates a result without throwing', () => {
    expect(() => generateTerrain(BASE_OPTIONS, 4)).not.toThrow();
  });

  it('result mask has correct dimensions', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    expect(result.mask.getWidth()).toBe(500);
    expect(result.mask.getHeight()).toBe(200);
  });

  it('has terrain — not entirely empty', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    // At least 5% solid (small maps have less terrain than full 5000×2000)
    expect(result.mask.solidPixelCount()).toBeGreaterThan(500 * 200 * 0.05);
  });

  it('has air — not entirely solid', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    expect(result.mask.solidPixelCount()).toBeLessThan(500 * 200 * 0.9);
  });

  it('foundation is solid at the bottom', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    const mask = result.mask;
    // Bottom 8% must be solid
    const foundationY = Math.floor(200 * 0.92);
    let solidCount = 0;
    for (let x = 50; x < 450; x++) {
      if (mask.isSolid(x, foundationY + 5)) solidCount++;
    }
    expect(solidCount).toBeGreaterThan(200); // most of the foundation row is solid
  });

  it('provides spawn points when requested', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    expect(result.spawnPoints.length).toBeGreaterThanOrEqual(1);
  });

  it('spawn points are on solid ground', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    for (const sp of result.spawnPoints) {
      // The tile directly below a spawn point should be solid
      expect(result.mask.isSolid(sp.x, sp.y + 1)).toBe(true);
      // The tile at the spawn point should be empty (character stands on top)
      expect(result.mask.isSolid(sp.x, sp.y - 1)).toBe(false);
    }
  });

  it('same seed + options always produces identical solid pixel count', () => {
    const r1 = generateTerrain(BASE_OPTIONS, 4);
    const r2 = generateTerrain(BASE_OPTIONS, 4);
    expect(r1.mask.solidPixelCount()).toBe(r2.mask.solidPixelCount());
  });

  it('different seeds produce different terrain', () => {
    const r1 = generateTerrain(BASE_OPTIONS, 4);
    const r2 = generateTerrain({ ...BASE_OPTIONS, seed: 'totally-different' }, 4);
    expect(r1.mask.solidPixelCount()).not.toBe(r2.mask.solidPixelCount());
  });

  it('includes correct seed and version in result', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    expect(result.seed).toBe('test-seed-42');
    expect(result.generatorVersion).toBe(1);
  });

  it('waterLevel is preserved in result', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    expect(result.waterLevel).toBe(187);
  });

  it('spawn points are above water', () => {
    const result = generateTerrain(BASE_OPTIONS, 4);
    for (const sp of result.spawnPoints) {
      expect(sp.y).toBeLessThan(result.waterLevel - 10);
    }
  });
});
