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
      // Return with the original seed in the result so the caller always sees the input seed
      return { ...result, seed: options.seed };
    }
  }
  // Return last attempt regardless of spawn count
  const final = tryGenerate(options, options, maxCharacters);
  return { ...final, seed: options.seed };
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

  // Step 1: Base ground envelope
  const groundY = new Float32Array(width);
  const envMin = height * 0.325;
  const envRange = height * 0.325; // min + range = 0.65 * height
  for (let x = 0; x < width; x++) {
    const n1 = shapeNoise.sample(x / 800, 0) * 0.5;
    const n2 = shapeNoise.sample(x / 300, 0.5) * 0.3;
    const n3 = shapeNoise.sample(x / 100, 1.0) * 0.2 * opts.roughness;
    groundY[x] = envMin + ((n1 + n2 + n3 + 1) / 2) * envRange;
  }

  // Step 2: 2D rock fill
  const threshold = 0.15 - opts.terrainDensity * 0.3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gy = groundY[x] ?? height * 0.5;
      const bias = (y - gy) / (height * 0.3);
      const broad = shapeNoise.sample(x / 400, y / 400) * 0.5;
      const med = shapeNoise.sample(x / 120, y / 120) * 0.3;
      const local = shapeNoise.sample(x / 40, y / 40) * 0.2;
      const density = bias + broad + med + local;
      if (density > threshold) {
        mask.setSolid(x, y, true);
      }
    }
  }

  // Step 3: Feature stamps — cave blobs (sizes scaled to map dimensions)
  const scaleFactor = Math.min(1, (width * height) / (5000 * 2000));
  const numCaves = Math.floor((4 + Math.floor(caveRng() * 6 * opts.caveDensity)) * scaleFactor) + 2;
  const maxCaveR = Math.floor(Math.min(80, width * 0.08) * (0.5 + opts.caveDensity * 0.5));
  for (let i = 0; i < numCaves; i++) {
    const cx = Math.floor(caveRng() * width);
    const cy = Math.floor(height * 0.35 + caveRng() * height * 0.5);
    const r = Math.floor(20 + caveRng() * maxCaveR);
    carveCircleInMask(mask, cx, cy, r);
  }

  // Step 3b: Island stamps in upper air
  if (opts.islandDensity > 0.3) {
    const numIslands = Math.floor(opts.islandDensity * 6);
    for (let i = 0; i < numIslands; i++) {
      const cx = Math.floor(caveRng() * width);
      const cy = Math.floor(height * 0.1 + caveRng() * height * 0.25);
      const r = 30 + Math.floor(caveRng() * 50);
      addCircleToMask(mask, cx, cy, r);
    }
  }

  // Step 4: Morphological cleanup (simplified — remove tiny floaters)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (mask.isSolid(x, y)) {
        const neighbours =
          (mask.isSolid(x - 1, y) ? 1 : 0) +
          (mask.isSolid(x + 1, y) ? 1 : 0) +
          (mask.isSolid(x, y - 1) ? 1 : 0) +
          (mask.isSolid(x, y + 1) ? 1 : 0);
        if (neighbours < 2) mask.setSolid(x, y, false);
      }
    }
  }

  // Step 5: Guarantee foundation — bottom 8% always solid
  const foundationY = Math.floor(height * 0.92);
  mask.fillRect(0, foundationY, width, height - foundationY, true);

  // Step 6 + 7: Surface analysis and spawn placement
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
        // This is a surface pixel
        if (y + 1 >= waterLevel - 15) continue; // too close to water

        // Measure clearance above
        let clearance = 0;
        for (let dy = 1; dy <= 40; dy++) {
          if (mask.isSolid(x, y - dy)) break;
          clearance++;
        }
        if (clearance < 20) continue;

        // Measure platform width
        let pw = 1;
        for (let dx = 1; dx <= 20; dx++) {
          if (!mask.isSolid(x + dx, y + 1)) break;
          pw++;
        }
        for (let dx = 1; dx <= 20; dx++) {
          if (!mask.isSolid(x - dx, y + 1)) break;
          pw++;
        }
        if (pw < 12) continue;

        // Approximate surface normal
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
        break; // one spawn per x-column scan
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

  // Divide map into horizontal sectors and pick from each
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

      // Pick random candidate from sector; check min distance from already selected
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
