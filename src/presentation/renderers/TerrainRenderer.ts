import Phaser from 'phaser';
import type { CollisionMask } from '@core/terrain/CollisionMask';

// Chunk-based terrain renderer.
// Each 256×256 chunk is a separate RenderTexture that is only repainted when
// the collision mask marks it dirty via carveCircle / carveRect.
export class TerrainRenderer {
  private readonly scene: Phaser.Scene;
  private readonly mask: CollisionMask;
  private readonly chunkTextures = new Map<number, Phaser.GameObjects.RenderTexture>();
  private readonly dirtyChunks = new Set<number>();
  private readonly hChunks: number;
  private readonly vChunks: number;
  private readonly waterLevel: number;

  static readonly CHUNK_SIZE = 256;

  constructor(scene: Phaser.Scene, mask: CollisionMask, waterLevel: number) {
    this.scene = scene;
    this.mask = mask;
    this.waterLevel = waterLevel;
    this.hChunks = Math.ceil(mask.getWidth() / TerrainRenderer.CHUNK_SIZE);
    this.vChunks = Math.ceil(mask.getHeight() / TerrainRenderer.CHUNK_SIZE);
  }

  initialise(): void {
    for (let cy = 0; cy < this.vChunks; cy++) {
      for (let cx = 0; cx < this.hChunks; cx++) {
        const chunkId = cx + cy * this.hChunks;
        const rt = this.scene.add.renderTexture(
          cx * TerrainRenderer.CHUNK_SIZE,
          cy * TerrainRenderer.CHUNK_SIZE,
          TerrainRenderer.CHUNK_SIZE,
          TerrainRenderer.CHUNK_SIZE,
        );
        rt.setOrigin(0, 0);
        this.chunkTextures.set(chunkId, rt);
        this.paintChunk(chunkId);
      }
    }

    // Water overlay (behind terrain visually but in front of sky)
    const waterG = this.scene.add.graphics();
    waterG.fillStyle(0x1a5fa8, 0.55);
    waterG.fillRect(
      0,
      this.waterLevel,
      this.mask.getWidth(),
      this.mask.getHeight() - this.waterLevel,
    );
    waterG.lineStyle(2, 0x66ccff, 0.7);
    waterG.lineBetween(0, this.waterLevel, this.mask.getWidth(), this.waterLevel);
    waterG.setDepth(5);
  }

  markDirty(chunkIds: number[]): void {
    for (const id of chunkIds) this.dirtyChunks.add(id);
  }

  update(): void {
    for (const id of this.dirtyChunks) {
      this.paintChunk(id);
    }
    this.dirtyChunks.clear();
  }

  private paintChunk(chunkId: number): void {
    const rt = this.chunkTextures.get(chunkId);
    if (!rt) return;

    const cx = chunkId % this.hChunks;
    const cy = Math.floor(chunkId / this.hChunks);
    const startX = cx * TerrainRenderer.CHUNK_SIZE;
    const startY = cy * TerrainRenderer.CHUNK_SIZE;

    // Draw to a temporary graphics object then stamp it
    const g = this.scene.make.graphics();
    g.clear();

    const cs = TerrainRenderer.CHUNK_SIZE;

    for (let localY = 0; localY < cs; localY++) {
      for (let localX = 0; localX < cs; localX++) {
        const wx = startX + localX;
        const wy = startY + localY;

        if (!this.mask.isSolid(wx, wy)) continue;

        const isSurface = !this.mask.isSolid(wx, wy - 1);
        const color = isSurface ? 0x5a8f3c : this.rockColor(wx, wy);

        g.fillStyle(color);
        g.fillRect(localX, localY, 1, 1);
      }
    }

    rt.clear();
    rt.draw(g, 0, 0);
    g.destroy();
  }

  // Deterministic interior rock color based on world position — warm terracotta tones
  private rockColor(wx: number, wy: number): number {
    const v = ((wx * 7 + wy * 13) % 32) / 32;
    const base = 0x8b5e2a;
    const r = ((base >> 16) & 0xff) + Math.floor(v * 20);
    const gv = ((base >> 8) & 0xff) + Math.floor(v * 10);
    const b = (base & 0xff) + Math.floor(v * 8);
    return (Math.min(255, r) << 16) | (Math.min(255, gv) << 8) | Math.min(255, b);
  }

  destroy(): void {
    for (const rt of this.chunkTextures.values()) rt.destroy();
    this.chunkTextures.clear();
  }
}
