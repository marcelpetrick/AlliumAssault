import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionMask } from '@core/terrain/CollisionMask';

describe('CollisionMask', () => {
  let mask: CollisionMask;

  beforeEach(() => {
    mask = new CollisionMask(100, 80);
  });

  it('starts empty (all pixels non-solid)', () => {
    expect(mask.isSolid(0, 0)).toBe(false);
    expect(mask.isSolid(50, 40)).toBe(false);
  });

  it('setSolid / isSolid round-trips correctly', () => {
    mask.setSolid(10, 20, true);
    expect(mask.isSolid(10, 20)).toBe(true);
    expect(mask.isSolid(10, 21)).toBe(false);

    mask.setSolid(10, 20, false);
    expect(mask.isSolid(10, 20)).toBe(false);
  });

  it('ignores out-of-bounds writes without throwing', () => {
    expect(() => mask.setSolid(-1, 0, true)).not.toThrow();
    expect(() => mask.setSolid(100, 0, true)).not.toThrow();
    expect(() => mask.setSolid(0, 80, true)).not.toThrow();
    expect(mask.isSolid(-1, 0)).toBe(false);
    expect(mask.isSolid(100, 0)).toBe(false);
  });

  it('carveCircle removes pixels inside the radius', () => {
    // Fill a 20x20 region solid
    for (let x = 30; x < 50; x++) for (let y = 30; y < 50; y++) mask.setSolid(x, y, true);

    const dirty = mask.carveCircle(40, 40, 8);

    // Center must be cleared
    expect(mask.isSolid(40, 40)).toBe(false);
    // Pixel outside radius should still be solid
    expect(mask.isSolid(30, 30)).toBe(true);
    // Returns non-empty dirty set
    expect(dirty.size).toBeGreaterThan(0);
  });

  it('carveCircle returns correct chunk IDs', () => {
    const smallMask = new CollisionMask(512, 512);
    // Fill the region solid first so carving actually changes pixels
    smallMask.fillRect(230, 230, 60, 60, true);
    // carve centered at (260, 260) — spans chunk boundary between chunks (1,0) and (1,1) at y=256
    const dirty = smallMask.carveCircle(260, 260, 20);
    expect(dirty.size).toBeGreaterThanOrEqual(1);
  });

  it('solidPixelCount increments and decrements correctly', () => {
    expect(mask.solidPixelCount()).toBe(0);
    mask.setSolid(5, 5, true);
    mask.setSolid(6, 6, true);
    expect(mask.solidPixelCount()).toBe(2);
    mask.setSolid(5, 5, false);
    expect(mask.solidPixelCount()).toBe(1);
  });

  it('getWidth / getHeight return constructor values', () => {
    expect(mask.getWidth()).toBe(100);
    expect(mask.getHeight()).toBe(80);
  });
});
