import type { WeaponDefinition } from './WeaponDefinition';
import weaponsData from '@data/weapons.json';

export class WeaponRegistry {
  private readonly weapons: Map<string, WeaponDefinition>;

  constructor() {
    this.weapons = new Map<string, WeaponDefinition>();
    for (const w of weaponsData as WeaponDefinition[]) {
      this.weapons.set(w.id, w);
    }
  }

  get(id: string): WeaponDefinition | undefined {
    return this.weapons.get(id);
  }

  getAll(): WeaponDefinition[] {
    return [...this.weapons.values()];
  }
}

// Singleton used throughout the codebase
export const weaponRegistry = new WeaponRegistry();
