import { CollisionMask } from './CollisionMask';
import { SeedManager } from '../rng/SeedManager';
import { SeededNoise2D } from '../noise/SeededNoise2D';
import type { Vec2 } from '../types';
import { vec2Normalise, vec2 } from '../types';

export interface TerrainOptions {
  seed: string;
  generatorVersion: number;
  width: number;
  height: number;
  themeId: string;
  terrainDensity: number; // 0–1, default 0.5
  caveDensity: number; // 0–1, default 0.3
  islandDensity: number; // 0–1, default 0.2
  roughness: number; // 0–1, default 0.5
  waterLevel: number; // pixel row of water surface
}

export interface SpawnPoint {
  x: number;
  y: number;
  surfaceNormal: Vec2;
  platformWidth: number;
  clearanceAbove: number;
}

export interface TerrainResult {
  mask: CollisionMask;
  spawnPoints: SpawnPoint[];
  waterLevel: number;
  seed: string;
  generatorVersion: number;
}

export function generateTerrain(options: TerrainOptions, maxCharacters: number): TerrainResult {
  for (let attempt = 0; attempt < 10; attempt++) {
    const effectiveSeed = attempt === 0 ? options.seed : `${options.seed}:retry${attempt}`;
    const result = tryGenerate({ ...options, seed: effectiveSeed }, options, maxCharacters);
    if (result.spawnPoints.length >= maxCharacters) {
      return { ...result, seed: options.seed };
    }
  }
  const final = tryGenerate(options, options, maxCharacters);
  return { ...final, seed: options.seed };
}

function smoothArray(arr: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let d = -radius; d <= radius; d++) {
      const j = Math.max(0, Math.min(arr.length - 1, i + d));
      sum += arr[j] ?? 0;
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

function tryGenerate(
  opts: TerrainOptions,
  originalOpts: TerrainOptions,
  maxCharacters: number,
): TerrainResult {
  const { width, height, waterLevel } = opts;
  const mgr = new SeedManager(opts.seed);
  const shapeNoise = new SeededNoise2D(mgr.getStream('shape'));
  const caveRng = mgr.getStream('cave');
  const spawnRng = mgr.getStream('spawn');

  const mask = new CollisionMask(width, height);

  // ── Step 1: Build rolling-hill surface envelope ─────────────────────────────
  // Only two low-frequency octaves → smooth rolling hills, no jagged spikes.
  // n1: very wide undulation (hills 800px apart)
  // n2: medium variation (bumps 300px apart)
  // No high-freq component — that's what caused the spikes.
  const groundY = new Float32Array(width);
  const envMin = height * 0.30;
  const envRange = height * 0.38; // keeps terrain comfortably above water
  for (let x = 0; x < width; x++) {
    const n1 = shapeNoise.sample(x / 800, 0) * 0.65;
    const n2 = shapeNoise.sample(x / 300, 0.5) * 0.35;
    groundY[x] = envMin + ((n1 + n2 + 1) / 2) * envRange;
  }

  // Smooth the heightmap with a wide box-blur pass to round off any remaining
  // kinks from noise sampling.  Radius 40 = ~80px smoothing window.
  const smoothed = smoothArray(smoothArray(groundY, 40), 20);

  // ── Step 2: Pure heightmap fill ─────────────────────────────────────────────
  // Everything at or below the surface line is solid.
  // This guarantees clean, spike-free rolling hills.
  for (let x = 0; x < width; x++) {
    const gy = Math.round(smoothed[x] ?? height * 0.5);
    for (let y = gy; y < height; y++) {
      mask.setSolid(x, y, true);
    }
  }

  // ── Step 3: Cave blobs carved into the solid mass ───────────────────────────
  const scaleFactor = Math.min(1, (width * height) / (5000 * 2000));
  const numCaves = Math.floor((3 + Math.floor(caveRng() * 5 * opts.caveDensity)) * scaleFactor) + 2;
  const maxCaveR = Math.floor(Math.min(90, width * 0.09) * (0.5 + opts.caveDensity * 0.5));
  for (let i = 0; i < numCaves; i++) {
    const cx = Math.floor(caveRng() * width);
    // Carve only well below the surface so caves don't break the hill shape
    const minCaveY = Math.round(smoothed[cx] ?? height * 0.5) + 60;
    const cy = Math.floor(minCaveY + caveRng() * (height * 0.92 - minCaveY));
    const r = Math.floor(30 + caveRng() * maxCaveR);
    carveCircleInMask(mask, cx, cy, r);
  }

  // ── Step 4: Optional floating islands in upper air ──────────────────────────
  if (opts.islandDensity > 0.3) {
    const numIslands = Math.floor(opts.islandDensity * 5);
    for (let i = 0; i < numIslands; i++) {
      const cx = Math.floor(caveRng() * width);
      const cy = Math.floor(height * 0.08 + caveRng() * height * 0.18);
      const r = 25 + Math.floor(caveRng() * 45);
      addCircleToMask(mask, cx, cy, r);
    }
  }

  // ── Step 5: Guarantee solid foundation (bottom 8%) ──────────────────────────
  const foundationY = Math.floor(height * 0.92);
  mask.fillRect(0, foundationY, width, height - foundationY, true);

  // ── Step 6 & 7: Spawn placement ──────────────────────────────────────────────
  const spawnPoints = collectSpawnPoints(mask, waterLevel, width, height);
  const selected = selectFairSpawns(spawnPoints, maxCharacters, width, spawnRng);

  return {
    mask,
    spawnPoints: selected,
    waterLevel,
    seed: opts.seed,
    generatorVersion: originalOpts.generatorVersion,
  };
}

function carveCircleInMask(mask: CollisionMask, cx: number, cy: number, r: number): void {
  const r2 = r * r;
  for (let y = Math.max(0, cy - r); y <= Math.min(mask.getHeight() - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(mask.getWidth() - 1, cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        mask.setSolid(x, y, false);
      }
    }
  }
}

function addCircleToMask(mask: CollisionMask, cx: number, cy: number, r: number): void {
  const r2 = r * r;
  for (let y = Math.max(0, cy - r); y <= Math.min(mask.getHeight() - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(mask.getWidth() - 1, cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        mask.setSolid(x, y, true);
      }
    }
  }
}

function collectSpawnPoints(
  mask: CollisionMask,
  waterLevel: number,
  width: number,
  height: number,
): SpawnPoint[] {
  const candidates: SpawnPoint[] = [];
  const W = width;
  const H = height;

  for (let x = 10; x < W - 10; x += 4) {
    for (let y = 10; y < H - 10; y++) {
      if (!mask.isSolid(x, y) && mask.isSolid(x, y + 1)) {
        if (y + 1 >= waterLevel - 15) continue;

        let clearance = 0;
        for (let dy = 1; dy <= 60; dy++) {
          if (mask.isSolid(x, y - dy)) break;
          clearance++;
        }
        if (clearance < 30) continue;

        let pw = 1;
        for (let dx = 1; dx <= 30; dx++) {
          if (!mask.isSolid(x + dx, y + 1)) break;
          pw++;
        }
        for (let dx = 1; dx <= 30; dx++) {
          if (!mask.isSolid(x - dx, y + 1)) break;
          pw++;
        }
        if (pw < 20) continue;

        const nx = (mask.isSolid(x - 1, y) ? 1 : 0) - (mask.isSolid(x + 1, y) ? 1 : 0);
        const ny = (mask.isSolid(x, y + 1) ? 1 : 0) - (mask.isSolid(x, y - 1) ? 1 : 0);
        const normal = vec2Normalise(vec2(nx, ny));

        candidates.push({
          x,
          y,
          surfaceNormal: normal,
          platformWidth: pw,
          clearanceAbove: clearance,
        });
        break;
      }
    }
  }

  return candidates;
}

function selectFairSpawns(
  candidates: SpawnPoint[],
  count: number,
  worldWidth: number,
  rng: () => number,
): SpawnPoint[] {
  if (candidates.length === 0) return [];

  const sectors = Math.min(count, 4);
  const sectorWidth = worldWidth / sectors;
  const selected: SpawnPoint[] = [];
  const used = new Set<number>();

  for (let pass = 0; pass < 3 && selected.length < count; pass++) {
    for (let s = 0; s < sectors && selected.length < count; s++) {
      const sectorX = s * sectorWidth;
      const inSector = candidates.filter(
        (c, i) => !used.has(i) && c.x >= sectorX && c.x < sectorX + sectorWidth,
      );
      if (inSector.length === 0) continue;

      const shuffled = [...inSector].sort(() => rng() - 0.5);
      for (const sp of shuffled) {
        const idx = candidates.indexOf(sp);
        const tooClose = selected.some((s2) => Math.abs(s2.x - sp.x) < 150);
        if (!tooClose) {
          selected.push(sp);
          used.add(idx);
          break;
        }
      }
    }
  }

  return selected;
}
