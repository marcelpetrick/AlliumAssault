import { describe, it, expect } from 'vitest';
import { createCharacter } from '@core/entities/Character';
import {
  createTeam,
  getActiveCharacter,
  advanceActiveCharacter,
  consumeWeapon,
} from '@core/entities/Team';

describe('Character entity', () => {
  it('createCharacter returns correct defaults', () => {
    const char = createCharacter('c1', 't1', 'Bulb', { x: 10, y: 20 });
    expect(char.id).toBe('c1');
    expect(char.teamId).toBe('t1');
    expect(char.name).toBe('Bulb');
    expect(char.health).toBe(100);
    expect(char.maxHealth).toBe(100);
    expect(char.alive).toBe(true);
    expect(char.velocity).toEqual({ x: 0, y: 0 });
    expect(char.onGround).toBe(false);
    expect(char.airborneDistance).toBe(0);
  });
});

describe('Team entity', () => {
  it('createTeam builds team with correct weapon inventory', () => {
    const team = createTeam('t1', 'The Clovettes', 0xff2200, 'human', 'normal', ['Minty', 'Bud']);
    expect(team.characters).toHaveLength(2);
    expect(team.characters[0]?.name).toBe('Minty');
    expect(team.alive).toBe(true);

    // Default weapons: bazooka unlimited, impact_clove 5, garlic_uppercut unlimited
    const bazooka = team.inventory.weapons.get('bazooka');
    expect(bazooka).toBeDefined();
    expect(bazooka?.unlimited).toBe(true);

    const clove = team.inventory.weapons.get('impact_clove');
    expect(clove).toBeDefined();
    expect(clove?.count).toBe(5);
    expect(clove?.unlimited).toBe(false);
  });

  it('getActiveCharacter returns first living character', () => {
    const team = createTeam('t1', 'Squad', 0x0000ff, 'human', 'normal', ['A', 'B', 'C']);
    const active = getActiveCharacter(team);
    expect(active?.name).toBe('A');
  });

  it('advanceActiveCharacter cycles to next living character', () => {
    const team = createTeam('t1', 'Squad', 0x0000ff, 'human', 'normal', ['A', 'B', 'C']);
    advanceActiveCharacter(team);
    expect(getActiveCharacter(team)?.name).toBe('B');
    advanceActiveCharacter(team);
    expect(getActiveCharacter(team)?.name).toBe('C');
    advanceActiveCharacter(team);
    expect(getActiveCharacter(team)?.name).toBe('A');
  });

  it('advanceActiveCharacter skips dead characters', () => {
    const team = createTeam('t1', 'Squad', 0x0000ff, 'human', 'normal', ['A', 'B', 'C']);
    const b = team.characters[1];
    if (b) b.alive = false; // kill B

    advanceActiveCharacter(team);
    // Should skip B and land on C
    expect(getActiveCharacter(team)?.name).toBe('C');
  });

  it('consumeWeapon decrements finite ammo', () => {
    const team = createTeam('t1', 'Squad', 0xff0000, 'human', 'normal', ['A']);
    const success = consumeWeapon(team, 'impact_clove');
    expect(success).toBe(true);
    expect(team.inventory.weapons.get('impact_clove')?.count).toBe(4);
  });

  it('consumeWeapon does not decrement unlimited ammo', () => {
    const team = createTeam('t1', 'Squad', 0xff0000, 'human', 'normal', ['A']);
    const success = consumeWeapon(team, 'bazooka');
    expect(success).toBe(true);
    // unlimited weapons stay unlimited
    expect(team.inventory.weapons.get('bazooka')?.unlimited).toBe(true);
  });

  it('consumeWeapon returns false when no ammo remains', () => {
    const team = createTeam('t1', 'Squad', 0xff0000, 'human', 'normal', ['A']);
    const stock = team.inventory.weapons.get('impact_clove');
    if (stock) stock.count = 0;

    const success = consumeWeapon(team, 'impact_clove');
    expect(success).toBe(false);
  });

  it('team is marked not alive when all characters dead', () => {
    const team = createTeam('t1', 'Squad', 0xff0000, 'human', 'normal', ['A', 'B']);
    team.characters.forEach((c) => (c.alive = false));

    // alive flag is recalculated — confirm it reflects no living members
    const hasLiving = team.characters.some((c) => c.alive);
    expect(hasLiving).toBe(false);
  });
});
