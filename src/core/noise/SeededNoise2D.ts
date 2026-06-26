import { createNoise2D } from 'simplex-noise';

// Thin wrapper around simplex-noise that accepts a mulberry32 PRNG function
// as the entropy source, ensuring deterministic generation from a seed.
export class SeededNoise2D {
  private readonly noise2D: (x: number, y: number) => number;

  constructor(rng: () => number) {
    this.noise2D = createNoise2D(rng);
  }

  // Returns a value in [-1, 1]
  sample(x: number, y: number): number {
    return this.noise2D(x, y);
  }
}
