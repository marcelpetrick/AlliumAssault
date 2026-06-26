import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@core/rng/mulberry32';
import { SeedManager } from '@core/rng/SeedManager';

describe('mulberry32', () => {
  it('returns values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBeCloseTo(b(), 10);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let differs = false;
    for (let i = 0; i < 20; i++) {
      if (Math.abs(a() - b()) > 0.0001) differs = true;
    }
    expect(differs).toBe(true);
  });
});

describe('SeedManager', () => {
  it('same named stream always returns the same sequence', () => {
    const mgr = new SeedManager('test-root');
    const s1 = mgr.getStream('shape');
    const vals1 = Array.from({ length: 20 }, () => s1());

    // new manager, same root seed
    const mgr2 = new SeedManager('test-root');
    const s2 = mgr2.getStream('shape');
    const vals2 = Array.from({ length: 20 }, () => s2());

    expect(vals1).toEqual(vals2);
  });

  it('different stream names produce independent sequences', () => {
    const mgr = new SeedManager('hello');
    const shapeVals = Array.from({ length: 20 }, () => mgr.getStream('shape')());
    const caveVals = Array.from({ length: 20 }, () => mgr.getStream('cave')());
    expect(shapeVals).not.toEqual(caveVals);
  });

  it('memoizes streams — same name returns same object', () => {
    const mgr = new SeedManager('abc');
    const a = mgr.getStream('wind');
    const b = mgr.getStream('wind');
    expect(a).toBe(b);
  });

  it('different root seeds produce different streams', () => {
    const mgr1 = new SeedManager('seed-A');
    const mgr2 = new SeedManager('seed-B');
    const v1 = Array.from({ length: 10 }, () => mgr1.getStream('spawn')());
    const v2 = Array.from({ length: 10 }, () => mgr2.getStream('spawn')());
    expect(v1).not.toEqual(v2);
  });
});
