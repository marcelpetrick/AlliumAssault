import { DynamicTexture, Texture, type Scene } from '@babylonjs/core';
import { mulberry32 } from '../core/rng';

/** Tileable value noise on a size×size grid of random lattice values. */
function tileNoise(size: number, cells: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const lattice = Float32Array.from({ length: cells * cells }, () => rng());
  const out = new Float32Array(size * size);
  const at = (i: number, j: number) => lattice[((j + cells) % cells) * cells + ((i + cells) % cells)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const fy = (y / size) * cells;
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const tx = (fx - i) ** 2 * (3 - 2 * (fx - i));
      const ty = (fy - j) ** 2 * (3 - 2 * (fy - j));
      const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
      const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
      out[y * size + x] = top + (bottom - top) * ty;
    }
  }
  return out;
}

function layeredNoise(size: number): Float32Array {
  const layers = [
    [4, 0.5],
    [8, 0.25],
    [16, 0.15],
    [64, 0.1],
  ] as const;
  const out = new Float32Array(size * size);
  layers.forEach(([cells, weight], n) => {
    const layer = tileNoise(size, cells, 17 + n);
    for (let k = 0; k < out.length; k++) out[k] += layer[k] * weight;
  });
  return out;
}

/** Light grey grain that multiplies vertex colours for a rocky, painted texture. */
export function createGrainTexture(scene: Scene): Texture {
  const size = 256;
  const noise = layeredNoise(size);
  const tex = new DynamicTexture('grain', size, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  for (let k = 0; k < noise.length; k++) {
    const v = Math.round(190 + noise[k] * 65);
    img.data.set([v, v, v, 255], k * 4);
  }
  ctx.putImageData(img, 0, 0);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Normal map derived from the same noise, giving surfaces bumpy detail under lighting. */
export function createRockNormalTexture(scene: Scene): Texture {
  const size = 256;
  const h = layeredNoise(size);
  const tex = new DynamicTexture('rockNormal', size, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  const strength = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      img.data.set([((-dx / len) * 0.5 + 0.5) * 255, ((-dy / len) * 0.5 + 0.5) * 255, (1 / len) * 255, 255], (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Soft round sprite for particles. */
export function createSoftDotTexture(scene: Scene): Texture {
  const size = 64;
  const tex = new DynamicTexture('softDot', size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}
