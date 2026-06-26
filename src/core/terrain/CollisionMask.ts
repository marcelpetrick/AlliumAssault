// Binary collision mask — the authoritative physics terrain representation.
// One byte per pixel; 1 = solid, 0 = empty.
// All terrain destruction must go through carveCircle / carveRect so that
// dirty chunks are always tracked correctly.

export class CollisionMask {
  static readonly CHUNK_SIZE = 256;

  private readonly data: Uint8Array;
  private readonly width: number;
  private readonly height: number;
  private readonly hChunks: number;
  private solidCount = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    this.hChunks = Math.ceil(width / CollisionMask.CHUNK_SIZE);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  isSolid(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return (this.data[y * this.width + x] ?? 0) === 1;
  }

  setSolid(x: number, y: number, value: boolean): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = y * this.width + x;
    const current = (this.data[idx] ?? 0) === 1;
    if (current === value) return;
    this.data[idx] = value ? 1 : 0;
    this.solidCount += value ? 1 : -1;
  }

  getChunkId(x: number, y: number): number {
    const cx = Math.floor(x / CollisionMask.CHUNK_SIZE);
    const cy = Math.floor(y / CollisionMask.CHUNK_SIZE);
    return cx + cy * this.hChunks;
  }

  carveCircle(cx: number, cy: number, radius: number): Set<number> {
    const dirty = new Set<number>();
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          if (this.isSolid(x, y)) {
            this.setSolid(x, y, false);
            dirty.add(this.getChunkId(x, y));
          }
        }
      }
    }

    return dirty;
  }

  carveRect(x: number, y: number, w: number, h: number): Set<number> {
    const dirty = new Set<number>();
    for (let py = Math.max(0, y); py < Math.min(this.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(this.width, x + w); px++) {
        if (this.isSolid(px, py)) {
          this.setSolid(px, py, false);
          dirty.add(this.getChunkId(px, py));
        }
      }
    }
    return dirty;
  }

  solidPixelCount(): number {
    return this.solidCount;
  }

  // Bulk-fill a region (used by generator internals only, bypasses dirty tracking)
  fillRect(x: number, y: number, w: number, h: number, value: boolean): void {
    for (let py = Math.max(0, y); py < Math.min(this.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(this.width, x + w); px++) {
        this.setSolid(px, py, value);
      }
    }
  }
}
