import type { ControllerType, AiDifficulty } from '../types';
import { createCharacter, type Character } from './Character';

export interface WeaponStock {
  count: number;
  unlimited: boolean;
}

export interface TeamInventory {
  weapons: Map<string, WeaponStock>;
}

export interface Team {
  id: string;
  name: string;
  color: number;
  controllerType: ControllerType;
  aiDifficulty: AiDifficulty;
  characters: Character[];
  inventory: TeamInventory;
  activeCharacterIndex: number;
  alive: boolean;
}

function defaultInventory(): TeamInventory {
  return {
    weapons: new Map([
      ['bazooka', { count: 0, unlimited: true }],
      ['impact_clove', { count: 5, unlimited: false }],
      ['garlic_uppercut', { count: 0, unlimited: true }],
      ['classic_grenade', { count: 3, unlimited: false }],
    ]),
  };
}

export function createTeam(
  id: string,
  name: string,
  color: number,
  controllerType: ControllerType,
  aiDifficulty: AiDifficulty,
  characterNames: string[],
): Team {
  const characters = characterNames.map((n, i) =>
    createCharacter(`${id}_c${i}`, id, n, { x: 0, y: 0 }),
  );
  return {
    id,
    name,
    color,
    controllerType,
    aiDifficulty,
    characters,
    inventory: defaultInventory(),
    activeCharacterIndex: 0,
    alive: true,
  };
}

export function getActiveCharacter(team: Team): Character | undefined {
  const living = team.characters.filter((c) => c.alive);
  if (living.length === 0) return undefined;
  const idx = team.activeCharacterIndex % living.length;
  return living[idx];
}

export function advanceActiveCharacter(team: Team): void {
  const living = team.characters.filter((c) => c.alive);
  if (living.length === 0) return;
  team.activeCharacterIndex = (team.activeCharacterIndex + 1) % living.length;
}

export function consumeWeapon(team: Team, weaponId: string): boolean {
  const stock = team.inventory.weapons.get(weaponId);
  if (!stock) return false;
  if (stock.unlimited) return true;
  if (stock.count <= 0) return false;
  stock.count--;
  return true;
}

export function isTeamAlive(team: Team): boolean {
  return team.characters.some((c) => c.alive);
}
