import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionMask } from '@core/terrain/CollisionMask';
import { createCharacter } from '@core/entities/Character';
import { stepCharacter, type PhysicsInput, CHARACTER_HEIGHT } from '@core/physics/CharacterPhysics';

function makeGroundedMask(width = 200, height = 100, groundY = 80): CollisionMask {
  const mask = new CollisionMask(width, height);
  for (let x = 0; x < width; x++) {
    for (let y = groundY; y < height; y++) {
      mask.setSolid(x, y, true);
    }
  }
  return mask;
}

describe('CharacterPhysics — grounded character', () => {
  let mask: CollisionMask;

  beforeEach(() => {
    mask = makeGroundedMask(200, 100, 80);
  });

  it('character standing on ground remains on ground with no input', () => {
    // groundY=80: solid at y=80+. Character feet (pos.y+1) must be at y=80, so pos.y=79.
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 79 });
    char.onGround = true;

    const input: PhysicsInput = { moveLeft: false, moveRight: false, jump: false };
    stepCharacter(char, input, mask, 200, 1 / 60);

    expect(char.onGround).toBe(true);
    expect(char.velocity.y).toBeLessThanOrEqual(0);
  });

  it('character moves right when moveRight = true', () => {
    const char = createCharacter('c1', 't1', 'Clove', { x: 50, y: 79 });
    char.onGround = true;

    const input: PhysicsInput = { moveLeft: false, moveRight: true, jump: false };
    const before = char.position.x;
    stepCharacter(char, input, mask, 200, 1 / 60);

    expect(char.position.x).toBeGreaterThan(before);
    expect(char.facing).toBe('right');
  });

  it('character moves left when moveLeft = true', () => {
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 79 });
    char.onGround = true;

    const input: PhysicsInput = { moveLeft: true, moveRight: false, jump: false };
    const before = char.position.x;
    stepCharacter(char, input, mask, 200, 1 / 60);

    expect(char.position.x).toBeLessThan(before);
    expect(char.facing).toBe('left');
  });

  it('jump applies upward velocity', () => {
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 79 });
    char.onGround = true;

    const input: PhysicsInput = { moveLeft: false, moveRight: false, jump: true };
    stepCharacter(char, input, mask, 200, 1 / 60);

    expect(char.velocity.y).toBeLessThan(0); // negative = upward
    expect(char.onGround).toBe(false);
  });

  it('jump is ignored when already airborne', () => {
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 50 });
    char.onGround = false;
    char.velocity.y = -200;

    const input: PhysicsInput = { moveLeft: false, moveRight: false, jump: true };
    const velBefore = char.velocity.y;
    stepCharacter(char, input, mask, 200, 1 / 60);

    // velocity should not have jumped again (y should be less negative or same, not more negative)
    expect(char.velocity.y).toBeGreaterThan(velBefore - 50);
  });
});

describe('CharacterPhysics — falling and fall damage', () => {
  it('character accumulates fall distance when airborne', () => {
    const mask = makeGroundedMask(200, 200, 180);
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 50 });
    char.onGround = false;
    char.velocity.y = 0;
    char.airborneDistance = 0;

    const input: PhysicsInput = { moveLeft: false, moveRight: false, jump: false };

    // Step multiple frames while falling
    for (let i = 0; i < 10; i++) {
      stepCharacter(char, input, mask, 300, 1 / 60);
    }

    expect(char.airborneDistance).toBeGreaterThan(0);
  });

  it('character takes fall damage after large fall', () => {
    const mask = makeGroundedMask(200, 200, 180);
    // Place character high up
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 50 });
    char.onGround = false;
    char.velocity.y = 0;
    char.airborneDistance = 0;

    const input: PhysicsInput = { moveLeft: false, moveRight: false, jump: false };
    const events: ReturnType<typeof stepCharacter> = [];

    // Run until character lands
    for (let i = 0; i < 200; i++) {
      const e = stepCharacter(char, input, mask, 300, 1 / 60);
      events.push(...e);
      if (char.onGround) break;
    }

    const fallEvent = events.find((e) => e.type === 'fell');
    expect(fallEvent).toBeDefined();
    if (fallEvent && fallEvent.type === 'fell') {
      expect(fallEvent.damage).toBeGreaterThan(0);
    }
  });
});

describe('CharacterPhysics — drowning', () => {
  it('character takes drown damage when below water level', () => {
    const mask = new CollisionMask(200, 200);
    // no solid ground — character sinks into water
    const char = createCharacter('c1', 't1', 'Clove', { x: 100, y: 160 });
    char.onGround = false;
    char.velocity.y = 50;
    char.health = 100;

    const input: PhysicsInput = { moveLeft: false, moveRight: false, jump: false };
    const events = stepCharacter(char, input, mask, 150, 1 / 60);

    expect(char.health).toBeLessThan(100);
    const drownEvent = events.find((e) => e.type === 'drowned');
    // May or may not have drowned in one tick — just confirm health decreased
    expect(char.health).toBeLessThan(100);
    void drownEvent; // might not fire yet in 1 tick
  });
});
