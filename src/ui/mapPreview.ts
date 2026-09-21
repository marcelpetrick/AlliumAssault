// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { WATER_LEVEL, WORLD_HEIGHT, WORLD_WIDTH } from '../core/constants';
import { defined } from '../core/assert';
import { generateTerrain, type Terrain } from '../core/terrain';
import { THEMES } from '../render/themes';

/**
 * Flat picture of the island a seed produces, drawn on a 2D canvas in the setup screen so a player
 * can see the map before committing to it. It uses the same `generateTerrain` the match uses, so
 * what is drawn is exactly what will be played; only the presentation is simplified — a silhouette
 * in the scenery's colours instead of the 3D scene.
 */

/** Generated maps for seeds already previewed: typing through seeds must not regenerate them twice. */
const cache = new Map<string, Terrain>();
const CACHE_LIMIT = 24;

function terrainFor(seed: string): Terrain {
  const known = cache.get(seed);
  if (known) return known;
  const terrain = generateTerrain({ seed, width: WORLD_WIDTH, height: WORLD_HEIGHT, waterLevel: WATER_LEVEL });
  if (cache.size >= CACHE_LIMIT) cache.delete(defined(cache.keys().next().value, 'cached preview seed'));
  cache.set(seed, terrain);
  return terrain;
}

/** Draw the map for `seed` in the colours of `theme`. */
export function drawMapPreview(canvas: HTMLCanvasElement, seed: string, theme: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const t = terrainFor(seed);
  const palette = THEMES[theme] ?? THEMES.meadow;
  const hex = (color: { toHexString: () => string }) => color.toHexString();

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, hex(palette.skyTop));
  sky.addColorStop(1, hex(palette.skyHorizon));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // One column per pixel: rock is drawn as vertical runs, so caves and overhangs stay visible.
  const rock = hex(palette.rock);
  const grass = hex(palette.grass);
  for (let px = 0; px < width; px++) {
    const x = (px / width) * t.width;
    let runTop: number | null = null;
    for (let py = 0; py <= height; py++) {
      const y = t.height - (py / height) * t.height;
      const solid = py < height && t.isSolid(x, y);
      if (solid && runTop === null) runTop = py;
      if (!solid && runTop !== null) {
        ctx.fillStyle = rock;
        ctx.fillRect(px, runTop, 1, py - runTop);
        // A thin lid of grass on top of every run, as in the match.
        ctx.fillStyle = grass;
        ctx.fillRect(px, runTop, 1, Math.max(1, Math.round(height / 60)));
        runTop = null;
      }
    }
  }

  const waterTop = height - (t.waterLevel / t.height) * height;
  ctx.fillStyle = hex(palette.waterShallow);
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, waterTop, width, height - waterTop);
  ctx.globalAlpha = 1;
}
