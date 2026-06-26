import { describe, it, expect } from 'vitest';
import { CollisionMask } from '@core/terrain/CollisionMask';
import { createProjectile } from '@core/entities/Projectile';
import { stepProjectile } from '@core/physics/ProjectilePhysics';
import { weaponRegistry } from '@core/weapons/WeaponRegistry';

describe('ProjectilePhysics', () => {
  it('projectile moves forward with no terrain', () => {
    const mask = new CollisionMask(500, 500);
    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka missing');

    const proj = createProjectile(
      'p1',
      'bazooka',
      't1',
      'c1',
      { x: 100, y: 100 },
      { x: 200, y: 0 },
    );
    const before = { x: proj.position.x, y: proj.position.y };

    stepProjectile(proj, def, { x: 0, y: 0 }, mask, 1 / 60);

    expect(proj.position.x).toBeGreaterThan(before.x);
  });

  it('gravity pulls projectile downward', () => {
    const mask = new CollisionMask(500, 500);
    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka missing');

    const proj = createProjectile(
      'p1',
      'bazooka',
      't1',
      'c1',
      { x: 100, y: 100 },
      { x: 300, y: 0 },
    );

    // Run for half a second
    for (let i = 0; i < 30; i++) {
      stepProjectile(proj, def, { x: 0, y: 0 }, mask, 1 / 60);
    }

    expect(proj.velocity.y).toBeGreaterThan(0); // falling
    expect(proj.position.y).toBeGreaterThan(100);
  });

  it('wind affects horizontal velocity', () => {
    const mask = new CollisionMask(2000, 500);
    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka missing');

    const projNoWind = createProjectile(
      'p1',
      'bazooka',
      't1',
      'c1',
      { x: 100, y: 100 },
      { x: 300, y: 0 },
    );
    const projWithWind = createProjectile(
      'p2',
      'bazooka',
      't1',
      'c1',
      { x: 100, y: 100 },
      { x: 300, y: 0 },
    );

    for (let i = 0; i < 60; i++) {
      stepProjectile(projNoWind, def, { x: 0, y: 0 }, mask, 1 / 60);
      stepProjectile(projWithWind, def, { x: 3, y: 0 }, mask, 1 / 60);
    }

    expect(projWithWind.position.x).toBeGreaterThan(projNoWind.position.x);
  });

  it('detects terrain hit and returns hit_terrain event', () => {
    const mask = new CollisionMask(500, 500);
    // Place a wall at x=150
    for (let y = 0; y < 500; y++) mask.setSolid(150, y, true);

    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka missing');

    const proj = createProjectile(
      'p1',
      'bazooka',
      't1',
      'c1',
      { x: 100, y: 100 },
      { x: 600, y: 0 },
    );
    let event = null;
    for (let i = 0; i < 120; i++) {
      event = stepProjectile(proj, def, { x: 0, y: 0 }, mask, 1 / 60);
      if (event) break;
    }

    expect(event).not.toBeNull();
    expect(event?.type).toBe('hit_terrain');
  });

  it('grenade with fuse expires after fuseSeconds', () => {
    // Use a very tall mask so gravity doesn't carry the grenade out of bounds
    // before the fuse fires
    const mask = new CollisionMask(500, 8000);
    const def = weaponRegistry.get('classic_grenade');
    if (!def) throw new Error('classic_grenade missing');

    const proj = createProjectile(
      'p1',
      'classic_grenade',
      't1',
      'c1',
      { x: 250, y: 100 },
      { x: 10, y: 0 },
    );
    proj.fuseTimer = 1.0; // 1-second fuse

    let event = null;
    for (let i = 0; i < 120; i++) {
      event = stepProjectile(proj, def, { x: 0, y: 0 }, mask, 1 / 60);
      if (event?.type === 'fuse_expired') break;
    }

    expect(event?.type).toBe('fuse_expired');
  });

  it('grenade bounces on terrain with restitution', () => {
    const mask = new CollisionMask(500, 500);
    for (let x = 0; x < 500; x++) mask.setSolid(x, 200, true);

    const def = weaponRegistry.get('classic_grenade');
    if (!def) throw new Error('classic_grenade missing');

    const proj = createProjectile(
      'p1',
      'classic_grenade',
      't1',
      'c1',
      { x: 100, y: 150 },
      { x: 50, y: 200 },
    );
    proj.fuseTimer = 999;

    let bounced = false;
    for (let i = 0; i < 120; i++) {
      const e = stepProjectile(proj, def, { x: 0, y: 0 }, mask, 1 / 60);
      if (e === null && proj.bounceCount > 0) {
        bounced = true;
        break;
      }
    }

    expect(bounced).toBe(true);
    expect(proj.bounceCount).toBeGreaterThan(0);
  });
});
