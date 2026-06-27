import Phaser from 'phaser';
import type { CollisionMask } from '@core/terrain/CollisionMask';
import { type TerrainTheme, getTheme, lerpColor } from './TerrainThemes';

const CHUNK_SIZE = 256;
const STRATA_PERIOD = 18;
const DECOR_SPACING = 22;

function brightenColor(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

export class TerrainRenderer {
  private readonly scene: Phaser.Scene;
  private readonly mask: CollisionMask;
  private readonly theme: TerrainTheme;
  private readonly chunkTextures = new Map<number, Phaser.GameObjects.RenderTexture>();
  private readonly dirtyChunks = new Set<number>();
  private readonly hChunks: number;
  private readonly vChunks: number;
  private readonly waterLevel: number;
  private waterGraphics: Phaser.GameObjects.Graphics | null = null;
  private shimmerOffset = 0;

  constructor(scene: Phaser.Scene, mask: CollisionMask, waterLevel: number, themeId = 'forest') {
    this.scene = scene;
    this.mask = mask;
    this.waterLevel = waterLevel;
    this.theme = getTheme(themeId);
    this.hChunks = Math.ceil(mask.getWidth() / CHUNK_SIZE);
    this.vChunks = Math.ceil(mask.getHeight() / CHUNK_SIZE);
  }

  initialise(): void {
    const w = this.mask.getWidth();
    const h = this.mask.getHeight();

    this.paintSky(w, h);

    for (let cy = 0; cy < this.vChunks; cy++) {
      for (let cx = 0; cx < this.hChunks; cx++) {
        const chunkId = cx + cy * this.hChunks;
        const rt = this.scene.add.renderTexture(
          cx * CHUNK_SIZE,
          cy * CHUNK_SIZE,
          CHUNK_SIZE,
          CHUNK_SIZE,
        );
        rt.setOrigin(0, 0);
        rt.setDepth(10);
        this.chunkTextures.set(chunkId, rt);
        this.paintChunk(chunkId);
      }
    }

    this.buildWater(w, h);
  }

  markDirty(chunkIds: number[]): void {
    // Also dirty the 8 neighbours of each chunk so outline pixels that sit
    // just outside the carved area are repainted with the correct edge colour.
    for (const id of chunkIds) {
      const cx = id % this.hChunks;
      const cy = Math.floor(id / this.hChunks);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < this.hChunks && ny >= 0 && ny < this.vChunks) {
            this.dirtyChunks.add(nx + ny * this.hChunks);
          }
        }
      }
    }
  }

  update(time = 0): void {
    for (const id of this.dirtyChunks) this.paintChunk(id);
    this.dirtyChunks.clear();
    // Animate water shimmer every 800ms
    const newOffset = Math.floor(time / 800) % 2;
    if (newOffset !== this.shimmerOffset) {
      this.shimmerOffset = newOffset;
      this.animateWater();
    }
  }

  // ─── Sky & background ───────────────────────────────────────────────────────

  private paintSky(worldW: number, worldH: number): void {
    const t = this.theme;

    // Gradient sky — 32 horizontal strips with mid-colour inflection
    const sky = this.scene.add.graphics();
    sky.setDepth(-10);
    const STEPS = 32;
    // Derive a mid-sky colour: blend top and horizon with slight saturation boost
    const skyMid = lerpColor(t.skyTop, t.skyHorizon, 0.45);
    for (let i = 0; i < STEPS; i++) {
      const frac = i / (STEPS - 1);
      // Two-segment gradient: top→mid (0–0.5) then mid→horizon (0.5–1)
      const color =
        frac < 0.5
          ? lerpColor(t.skyTop, skyMid, frac * 2)
          : lerpColor(skyMid, t.skyHorizon, (frac - 0.5) * 2);
      const y = Math.floor((worldH * i) / STEPS);
      const h = Math.ceil(worldH / STEPS) + 1;
      sky.fillStyle(color);
      sky.fillRect(0, y, worldW, h);
    }
    // Horizon haze — soft bright band just above water level
    sky.fillStyle(brightenColor(t.skyHorizon, 20), 0.18);
    sky.fillRect(0, worldH * 0.8, worldW, worldH * 0.1);

    if (t.hasStars) this.paintStars(sky, worldW, worldH);
    if (t.hasMoon) this.paintMoon(worldW, worldH);
    if (t.hasTreeSilhouettes) this.paintTrees(worldW, worldH);

    // Hell: ember glow at horizon
    if (t.id === 'hell') {
      const glow = this.scene.add.graphics();
      glow.setDepth(-9);
      glow.fillStyle(0x8b0000, 0.18);
      glow.fillRect(0, worldH * 0.45, worldW, worldH * 0.15);
    }

    // Snow: aurora ribbons
    if (t.id === 'snow') {
      const aurora = this.scene.add.graphics();
      aurora.setDepth(-9);
      for (let i = 0; i < 4; i++) {
        const ax = (i * 1300) % worldW;
        aurora.fillStyle(0x00ff88, 0.04 + i * 0.015);
        aurora.fillRect(ax, 0, 800 + i * 200, worldH * 0.18);
      }
    }

    // Cheese: distant planet/star
    if (t.id === 'cheese') {
      const planet = this.scene.add.graphics();
      planet.setDepth(-9);
      planet.fillStyle(0xc0a0ff, 0.5);
      planet.fillCircle(worldW * 0.15, worldH * 0.06, 35);
      planet.fillStyle(0xc0a0ff, 0.12);
      planet.fillCircle(worldW * 0.15, worldH * 0.06, 48);
    }
  }

  private paintStars(g: Phaser.GameObjects.Graphics, worldW: number, worldH: number): void {
    const maxY = worldH * 0.6;
    for (let i = 0; i < 220; i++) {
      const sx = (i * 7919) % worldW;
      const sy = (i * 6131) % maxY;
      const alpha = 0.3 + ((i * 137) % 10) * 0.06;
      const size = i % 15 === 0 ? 1.5 : 1;
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(sx, sy, size);
    }
  }

  private paintMoon(worldW: number, worldH: number): void {
    const mx = worldW * 0.78;
    const my = worldH * 0.07;
    const moonColor = this.theme.id === 'snow' ? 0xddeeff : 0xfffde0;
    const moon = this.scene.add.graphics();
    moon.setDepth(-9);
    moon.fillStyle(moonColor, 0.12);
    moon.fillCircle(mx, my, 70);
    moon.fillStyle(moonColor, 0.9);
    moon.fillCircle(mx, my, 55);
    // Subtle crater
    moon.fillStyle(0x000000, 0.06);
    moon.fillCircle(mx + 18, my - 10, 14);
    moon.fillCircle(mx - 20, my + 15, 9);
  }

  private paintTrees(worldW: number, worldH: number): void {
    const trees = this.scene.add.graphics();
    trees.setDepth(-8);
    trees.setScrollFactor(0.3, 0.3);
    for (let i = 0; i < 50; i++) {
      const tx = (i * 113) % worldW;
      const ty = worldH * 0.52 + ((i * 71) % 120);
      const th = 70 + ((i * 37) % 90);
      const tw = 28 + ((i * 23) % 32);
      trees.fillStyle(0x1a3a22, 0.5);
      trees.fillTriangle(tx, ty, tx - tw / 2, ty + th, tx + tw / 2, ty + th);
      // Second layer (slightly lighter)
      trees.fillStyle(0x234a2c, 0.35);
      trees.fillTriangle(tx, ty + th * 0.3, tx - tw * 0.4, ty + th, tx + tw * 0.4, ty + th);
    }
  }

  // ─── Terrain chunk painting ──────────────────────────────────────────────────

  private paintChunk(chunkId: number): void {
    const rt = this.chunkTextures.get(chunkId);
    if (!rt) return;

    const cx = chunkId % this.hChunks;
    const cy = Math.floor(chunkId / this.hChunks);
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    // Pre-compute surface depth for each pixel column
    // depth[lx][ly] = distance in px from the nearest solid surface above
    //                  0 = IS the surface (solid, air above)
    //                 -1 = air
    const depth = new Int16Array(CHUNK_SIZE * CHUNK_SIZE).fill(-1);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = startX + lx;
      let d = -1;
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const wy = startY + ly;
        if (this.mask.isSolid(wx, wy)) {
          if (!this.mask.isSolid(wx, wy - 1)) {
            d = 0;
          } else {
            d = d < 0 ? 0 : d + 1;
          }
        } else {
          d = -1;
        }
        depth[lx + ly * CHUNK_SIZE] = d;
      }
    }

    const g = this.scene.make.graphics();
    g.clear();

    // Paint by horizontal runs of equal colour (performance optimisation)
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      let runStart = -1;
      let runColor = 0;

      for (let lx = 0; lx <= CHUNK_SIZE; lx++) {
        const d = lx < CHUNK_SIZE ? (depth[lx + ly * CHUNK_SIZE] ?? -1) : -2;
        if (d < 0) {
          if (runStart >= 0) {
            g.fillStyle(runColor);
            g.fillRect(runStart, ly, lx - runStart, 1);
            runStart = -1;
          }
          continue;
        }

        const wx = startX + lx;
        const wy = startY + ly;
        const color = this.pixelColor(wx, wy, d);

        if (runStart >= 0 && color === runColor) {
          // extend run
        } else {
          if (runStart >= 0) {
            g.fillStyle(runColor);
            g.fillRect(runStart, ly, lx - runStart, 1);
          }
          runStart = lx;
          runColor = color;
        }
      }
    }

    rt.clear();
    rt.draw(g, 0, 0);

    // Paint decorations on top of this chunk
    this.paintDecorations(g, startX, startY);
    rt.draw(g, 0, 0);

    g.destroy();
  }

  private pixelColor(wx: number, wy: number, depth: number): number {
    const t = this.theme;

    // Two independent hash streams for richer variation
    const h1 = ((wx * 1597 + wy * 757) ^ (wx * 1217 + wy * 2053)) & 0xff;
    const h2 = ((wx * 3121 + wy * 4283) ^ (wx * 601 + wy * 1447)) & 0xff;

    const hasAirLeft = !this.mask.isSolid(wx - 1, wy);
    const hasAirRight = !this.mask.isSolid(wx + 1, wy);
    const hasAirBelow = !this.mask.isSolid(wx, wy + 1);
    const isSide = hasAirLeft || hasAirRight;
    const isBottom = hasAirBelow;

    // ── Surface gradient (top 4px) ───────────────────────────────────────────
    if (depth === 0) {
      // Brightest top — tiny sparkle variation (+12 on random pixels)
      return h1 < 18 ? brightenColor(t.grassTop, 14) : t.grassTop;
    }
    if (depth === 1) {
      // Side of surface layer = dark outline (cliff face)
      return isSide ? t.outline : t.grassMid;
    }
    if (depth === 2) {
      return isSide ? t.outline : t.grassDark;
    }
    if (depth === 3) {
      return (isSide || isBottom) ? t.outline : lerpColor(t.grassDark, t.soilLight, 0.5);
    }

    // All remaining exposed edges → outline
    if (isSide || isBottom) return t.outline;

    // ── Soil gradient (depth 4–11) ────────────────────────────────────────────
    if (depth <= 11) {
      const frac = Math.min(1, (depth - 4) / 7);
      // Introduce mild per-pixel jitter so transition isn't a hard line
      const jitter = (h1 / 255) * 0.18 - 0.09;
      return lerpColor(t.soilLight, t.soilDark, Math.max(0, Math.min(1, frac + jitter)));
    }

    // ── Deep rock with geological strata ─────────────────────────────────────
    const strataRow = Math.floor(wy / STRATA_PERIOD);
    const strataPhase = strataRow % 3;
    // Smooth blend within each band (0 at top of band → 1 at bottom)
    const bandPos = (wy % STRATA_PERIOD) / STRATA_PERIOD;

    let base: number;
    if (strataPhase === 0) {
      // Main rock, slight highlight at top of band
      base = bandPos < 0.25
        ? lerpColor(t.rockA, t.rockB, bandPos * 4)
        : lerpColor(t.rockB, t.rockA, (bandPos - 0.25) / 0.75);
    } else if (strataPhase === 1) {
      // Dark crevice layer — thin dark stripe in the middle
      base = bandPos < 0.3 || bandPos > 0.7 ? t.rockA : lerpColor(t.rockA, t.rockC, 0.6);
    } else {
      // Lighter rock vein
      base = lerpColor(t.rockA, t.rockB, 0.35);
    }

    // Scatter bright flecks and dark pockets for texture
    if (h2 > 242) return brightenColor(t.rockB, 18); // quartz sparkle
    if (h1 < 10) return t.rockC; // dark mineral pocket

    return base;
  }

  // ─── Decorations ────────────────────────────────────────────────────────────

  private paintDecorations(g: Phaser.GameObjects.Graphics, startX: number, startY: number): void {
    g.clear(); // will be drawn on top of terrain

    const style = this.theme.decorStyle;
    const endX = startX + CHUNK_SIZE;
    const endY = startY + CHUNK_SIZE;

    // Find surface pixels in this chunk for decoration placement
    for (let wx = startX; wx < endX; wx += DECOR_SPACING) {
      // Use a hash to introduce irregularity
      const offset = ((wx * 17 + startX * 3) % DECOR_SPACING) - DECOR_SPACING / 2;
      const checkX = wx + Math.round(offset * 0.4);
      if (checkX < startX || checkX >= endX) continue;

      for (let wy = startY; wy < endY; wy++) {
        if (this.mask.isSolid(checkX, wy) && !this.mask.isSolid(checkX, wy - 1)) {
          const lx = checkX - startX;
          const ly = wy - startY;
          // Only draw if the decoration would be visible in this chunk
          if (ly > 0 && ly < CHUNK_SIZE) {
            const seed = (checkX * 31 + wy * 97) >>> 0;
            this.drawDecoration(g, lx, ly, seed, style);
          }
          break;
        }
      }
    }
  }

  private drawDecoration(
    g: Phaser.GameObjects.Graphics,
    lx: number,
    ly: number,
    seed: number,
    style: TerrainTheme['decorStyle'],
  ): void {
    const variant = seed % 4;

    if (style === 'forest') {
      if (variant === 0) {
        // Grass tuft: 2–3 short spikes
        g.fillStyle(0x78d84a, 0.9);
        g.fillRect(lx - 1, ly - 3, 1, 3);
        g.fillRect(lx + 1, ly - 2, 1, 2);
        g.fillRect(lx - 3, ly - 2, 1, 2);
      } else if (variant === 1) {
        // Daisy: stem + white/yellow dot
        g.fillStyle(0x4ea324, 0.9);
        g.fillRect(lx, ly - 4, 1, 3);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(lx, ly - 5, 2);
        g.fillStyle(0xffdd00, 1.0);
        g.fillCircle(lx, ly - 5, 1);
      } else if (variant === 2) {
        // Mushroom
        g.fillStyle(0xc0522a, 1.0);
        g.fillEllipse(lx, ly - 4, 8, 5);
        g.fillStyle(0xf0e0c0, 1.0);
        g.fillRect(lx - 1, ly - 3, 3, 3);
      } else {
        // Tiny stone
        g.fillStyle(0x8a8a8a, 0.7);
        g.fillEllipse(lx, ly - 1, 5, 3);
      }
    } else if (style === 'beach') {
      if (variant <= 1) {
        // Shell arc
        g.fillStyle(0xf0d8b0, 0.9);
        g.strokeCircle(lx, ly - 2, 3);
      } else if (variant === 2) {
        // Palm leaf sprig
        g.fillStyle(0x3a8a20, 0.85);
        g.fillTriangle(lx, ly - 6, lx - 4, ly - 2, lx + 1, ly - 1);
        g.fillTriangle(lx, ly - 6, lx + 4, ly - 3, lx - 1, ly - 1);
      } else {
        // Seaweed dot
        g.fillStyle(0x207050, 0.7);
        g.fillCircle(lx, ly - 2, 2);
      }
    } else if (style === 'hell') {
      if (variant <= 1) {
        // Flame lick
        g.fillStyle(0xff6600, 0.85);
        g.fillTriangle(lx, ly - 5, lx - 2, ly, lx + 2, ly);
        g.fillStyle(0xffcc00, 0.7);
        g.fillTriangle(lx, ly - 3, lx - 1, ly, lx + 1, ly);
      } else {
        // Bone
        g.fillStyle(0xe0d8c0, 0.8);
        g.fillRect(lx - 3, ly - 1, 6, 1);
        g.fillCircle(lx - 3, ly - 1, 1);
        g.fillCircle(lx + 3, ly - 1, 1);
      }
    } else if (style === 'snow') {
      if (variant <= 2) {
        // Snowflake dot
        g.fillStyle(0xeef4ff, 0.8);
        g.fillCircle(lx, ly - 2, 1);
        g.fillRect(lx - 2, ly - 2, 5, 1);
        g.fillRect(lx, ly - 4, 1, 5);
      } else {
        // Icicle
        g.fillStyle(0xaad4f0, 0.9);
        g.fillTriangle(lx, ly - 4, lx - 1, ly, lx + 1, ly);
      }
    } else if (style === 'cheese') {
      if (variant <= 1) {
        // Cheese hole shadow dot
        g.fillStyle(0x503800, 0.5);
        g.fillCircle(lx, ly - 2, 2);
      } else {
        // Alien antenna
        g.fillStyle(0xaa88ff, 0.85);
        g.fillRect(lx, ly - 4, 1, 3);
        g.fillCircle(lx, ly - 5, 1);
        g.fillRect(lx + 2, ly - 3, 1, 2);
        g.fillCircle(lx + 2, ly - 4, 1);
      }
    }
  }

  // ─── Water ──────────────────────────────────────────────────────────────────

  private buildWater(worldW: number, worldH: number): void {
    const wg = this.scene.add.graphics();
    wg.setDepth(8);
    this.waterGraphics = wg;
    this.drawWater(wg, worldW, worldH, 0);
  }

  private drawWater(
    g: Phaser.GameObjects.Graphics,
    worldW: number,
    worldH: number,
    shimmerPhase: number,
  ): void {
    const t = this.theme;
    const wl = this.waterLevel;
    const depth = worldH - wl;

    g.clear();

    // Layer 1: deep fill
    g.fillStyle(t.waterDeep, 0.92);
    g.fillRect(0, wl, worldW, depth);

    // Layer 2: mid band — upper 80px fades from mid to deep
    g.fillStyle(t.waterMid, 0.45);
    g.fillRect(0, wl, worldW, Math.min(80, depth));

    // Layer 3: near-surface lighter band
    g.fillStyle(brightenColor(t.waterMid, 15), 0.3);
    g.fillRect(0, wl, worldW, Math.min(30, depth));

    // Layer 4: animated shimmer strips (horizontal bands shift phase each tick)
    const stripH = 3;
    const stripGap = 16;
    const baseOffset = shimmerPhase * 8;
    g.fillStyle(t.waterShimmer, 0.18);
    for (let y = wl + baseOffset; y < wl + 70; y += stripH + stripGap) {
      g.fillRect(0, y, worldW, stripH);
    }
    // Second shimmer layer offset by half-gap for a cross-hatch sparkle
    g.fillStyle(t.waterShimmer, 0.1);
    for (let y = wl + baseOffset + (stripH + stripGap) / 2; y < wl + 70; y += stripH + stripGap) {
      g.fillRect(0, y, worldW, stripH);
    }

    // Surface line — bright shimmer
    g.lineStyle(3, t.waterShimmer, 0.85);
    g.lineBetween(0, wl, worldW, wl);
    g.lineStyle(1, brightenColor(t.waterShimmer, 40), 0.6);
    g.lineBetween(0, wl - 1, worldW, wl - 1);

    // Foam dots drifting across the surface
    g.fillStyle(0xffffff, 0.3);
    for (let i = 0; i < 40; i++) {
      const fx = (i * 7919 + shimmerPhase * 340) % worldW;
      g.fillCircle(fx, wl - 1, 1.5);
    }
  }

  private animateWater(): void {
    if (!this.waterGraphics) return;
    this.drawWater(
      this.waterGraphics,
      this.mask.getWidth(),
      this.mask.getHeight(),
      this.shimmerOffset,
    );
  }

  destroy(): void {
    for (const rt of this.chunkTextures.values()) rt.destroy();
    this.chunkTextures.clear();
    this.waterGraphics?.destroy();
  }
}
