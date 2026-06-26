import { describe, it, expect } from 'vitest';
import { CollisionMask } from '@core/terrain/CollisionMask';
import { createCharacter } from '@core/entities/Character';
import { explode } from '@core/physics/ExplosionSystem';
import { weaponRegistry } from '@core/weapons/WeaponRegistry';

describe('ExplosionSystem', () => {
  it('deals damage to character within radius', () => {
    const mask = new CollisionMask(200, 200);
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 100 });
    char.alive = true;

    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka not in registry');

    const result = explode({ x: 110, y: 100 }, def, [char], mask);

    const dmg = result.characterDamages.find((d) => d.characterId === 'c1');
    expect(dmg).toBeDefined();
    expect(dmg!.damage).toBeGreaterThan(0);
    expect(dmg!.damage).toBeLessThanOrEqual(def.maximumDamage);
  });

  it('does not damage character outside explosion radius', () => {
    const mask = new CollisionMask(400, 400);
    const char = createCharacter('c1', 't1', 'Clove', { x: 300, y: 300 });
    char.alive = true;

    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka not in registry');

    // Explosion center far from character
    const result = explode({ x: 10, y: 10 }, def, [char], mask);

    const dmg = result.characterDamages.find((d) => d.characterId === 'c1');
    expect(dmg).toBeUndefined();
  });

  it('damage is maximum at center and decreases with distance', () => {
    const mask = new CollisionMask(400, 400);
    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka not in registry');

    const charClose = createCharacter('close', 't1', 'A', { x: 102, y: 100 });
    charClose.alive = true;
    const charFar = createCharacter('far', 't1', 'B', { x: 130, y: 100 });
    charFar.alive = true;

    const result = explode({ x: 100, y: 100 }, def, [charClose, charFar], mask);

    const closeHit = result.characterDamages.find((d) => d.characterId === 'close');
    const farHit = result.characterDamages.find((d) => d.characterId === 'far');

    expect(closeHit).toBeDefined();
    expect(farHit).toBeDefined();
    expect(closeHit!.damage).toBeGreaterThan(farHit!.damage);
  });

  it('impulse direction points away from explosion center', () => {
    const mask = new CollisionMask(400, 400);
    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka not in registry');

    // Character to the right of explosion center
    const char = createCharacter('c1', 't1', 'Clove', { x: 110, y: 100 });
    char.alive = true;

    const result = explode({ x: 100, y: 100 }, def, [char], mask);
    const dmg = result.characterDamages.find((d) => d.characterId === 'c1');
    expect(dmg).toBeDefined();
    // Impulse should push rightward (positive x) since char is to the right
    expect(dmg!.impulse.x).toBeGreaterThan(0);
  });

  it('carves terrain and returns dirty chunks', () => {
    const mask = new CollisionMask(400, 400);
    // Fill a region solid
    for (let x = 90; x < 150; x++) for (let y = 90; y < 150; y++) mask.setSolid(x, y, true);

    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka not in registry');

    const result = explode({ x: 120, y: 120 }, def, [], mask);

    // Center should be carved
    expect(mask.isSolid(120, 120)).toBe(false);
    expect(result.terrainDirtyChunks.size).toBeGreaterThan(0);
  });

  it('dead characters are not affected', () => {
    const mask = new CollisionMask(200, 200);
    const def = weaponRegistry.get('bazooka');
    if (!def) throw new Error('bazooka not in registry');

    const char = createCharacter('c1', 't1', 'Clove', { x: 102, y: 100 });
    char.alive = false; // dead

    const result = explode({ x: 100, y: 100 }, def, [char], mask);
    expect(result.characterDamages).toHaveLength(0);
  });
});
