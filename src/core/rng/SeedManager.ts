import { mulberry32 } from './mulberry32';

// FNV-1a 32-bit hash for deterministic seed derivation
function fnv1a32(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeedManager {
  private readonly rootSeed: string;
  private readonly streams = new Map<string, () => number>();

  constructor(rootSeed: string) {
    this.rootSeed = rootSeed;
  }

  // Returns a memoized named PRNG stream derived from the root seed.
  // Each stream name produces an independent sequence; adding a new stream
  // never shifts the values of existing streams.
  getStream(name: string): () => number {
    const existing = this.streams.get(name);
    if (existing) return existing;
    const derivedSeed = fnv1a32(this.rootSeed + ':' + name);
    const rng = mulberry32(derivedSeed);
    this.streams.set(name, rng);
    return rng;
  }

  // Exposed for tests — same logic as stream derivation
  static hash(s: string): number {
    return fnv1a32(s);
  }
}
