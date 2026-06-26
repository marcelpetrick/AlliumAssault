import type { Character } from '../entities/Character';
import type { WeaponDefinition } from '../weapons/WeaponDefinition';
import type { CollisionMask } from '../terrain/CollisionMask';
import { vec2Distance, vec2Normalise, vec2Sub, type Vec2 } from '../types';

export interface ExplosionResult {
  terrainDirtyChunks: Set<number>;
  characterDamages: Array<{ characterId: string; damage: number; impulse: Vec2 }>;
}

export function explode(
  center: Vec2,
  def: WeaponDefinition,
  characters: Character[],
  mask: CollisionMask,
): ExplosionResult {
  const characterDamages: ExplosionResult['characterDamages'] = [];

  // Damage alive characters within radius
  for (const char of characters) {
    if (!char.alive) continue;
    const dist = vec2Distance(center, char.position);
    if (dist >= def.explosionRadius) continue;

    const falloff = 1 - dist / def.explosionRadius;
    const damage = Math.max(1, Math.round(def.maximumDamage * falloff));

    const rawDir = vec2Sub(char.position, center);
    const dir = vec2Normalise(rawDir);
    const impulseMag = def.impulseStrength * falloff;
    const impulse = { x: dir.x * impulseMag, y: dir.y * impulseMag };

    characterDamages.push({ characterId: char.id, damage, impulse });
  }

  // Carve terrain
  const terrainDirtyChunks = mask.carveCircle(center.x, center.y, def.terrainRadius);

  return { terrainDirtyChunks, characterDamages };
}
