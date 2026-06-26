// mulberry32 — fast seeded PRNG producing floats in [0, 1)
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0; // ensure 32-bit unsigned
  return (): number => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 4294967296;
  };
}
