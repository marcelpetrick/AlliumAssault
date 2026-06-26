import { describe, it, expect } from 'vitest';
import { SeededNoise2D } from '@core/noise/SeededNoise2D';
import { mulberry32 } from '@core/rng/mulberry32';

describe('SeededNoise2D', () => {
  it('returns values in [-1, 1]', () => {
    const noise = new SeededNoise2D(mulberry32(42));
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const v = noise.sample(x * 0.1, y * 0.1);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('same seed produces the same values', () => {
    const n1 = new SeededNoise2D(mulberry32(7));
    const n2 = new SeededNoise2D(mulberry32(7));
    for (let i = 0; i < 50; i++) {
      expect(n1.sample(i * 0.05, i * 0.03)).toBeCloseTo(n2.sample(i * 0.05, i * 0.03), 8);
    }
  });

  it('different seeds produce different outputs', () => {
    const n1 = new SeededNoise2D(mulberry32(1));
    const n2 = new SeededNoise2D(mulberry32(9999));
    let differ = false;
    for (let i = 0; i < 20; i++) {
      if (Math.abs(n1.sample(i * 0.1, i * 0.1) - n2.sample(i * 0.1, i * 0.1)) > 0.001) {
        differ = true;
        break;
      }
    }
    expect(differ).toBe(true);
  });

  it('is smooth — nearby samples are close', () => {
    const noise = new SeededNoise2D(mulberry32(100));
    const a = noise.sample(0, 0);
    const b = noise.sample(0.001, 0.001);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});
