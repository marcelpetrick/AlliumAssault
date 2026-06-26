import type { Character } from '../entities/Character';
import type { CollisionMask } from '../terrain/CollisionMask';
import { isGrounded, sideObstructed } from '../terrain/SurfaceAnalyzer';

export const CHARACTER_WIDTH = 20;
export const CHARACTER_HEIGHT = 28;
export const GRAVITY = 980; // px/s²
export const WALK_SPEED = 120; // px/s
export const JUMP_IMPULSE = -480; // px/s (upward)
export const MAX_FALL_SPEED = 800; // px/s
export const SAFE_FALL_HEIGHT = 40; // px below which no fall damage
export const FALL_DAMAGE_SCALE = 0.18; // HP per px above safe height
export const DROWN_DAMAGE_PER_SEC = 5; // HP/s
export const MAX_STEP_HEIGHT = 6; // auto-step up this many px

export interface PhysicsInput {
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
}

export type CharacterPhysicsEvent =
  | { type: 'fell'; characterId: string; damage: number }
  | { type: 'drowned'; characterId: string }
  | { type: 'killed'; characterId: string; cause: 'fall' | 'drown' };

export function stepCharacter(
  char: Character,
  input: PhysicsInput,
  mask: CollisionMask,
  waterLevel: number,
  dt: number,
): CharacterPhysicsEvent[] {
  const events: CharacterPhysicsEvent[] = [];

  if (!char.alive) return events;

  // -- Horizontal movement --
  let vx = char.velocity.x;
  let vy = char.velocity.y;

  if (input.moveLeft) {
    vx = -WALK_SPEED;
    char.facing = 'left';
  } else if (input.moveRight) {
    vx = WALK_SPEED;
    char.facing = 'right';
  } else {
    vx = 0;
  }

  // -- Jump --
  if (input.jump && char.onGround) {
    vy = JUMP_IMPULSE;
    char.onGround = false;
  }

  // -- Gravity --
  if (!char.onGround) {
    vy = Math.min(vy + GRAVITY * dt, MAX_FALL_SPEED);
  }

  // -- Move position --
  const prevY = char.position.y;

  // Horizontal with side obstruction + auto-step
  if (vx !== 0) {
    const dir = vx > 0 ? 1 : -1;
    if (sideObstructed(mask, char.position, dir, CHARACTER_HEIGHT)) {
      // Try to step up
      let stepped = false;
      for (let step = 1; step <= MAX_STEP_HEIGHT; step++) {
        const testPos = { x: char.position.x, y: char.position.y - step };
        if (!sideObstructed(mask, testPos, dir, CHARACTER_HEIGHT)) {
          char.position.y -= step;
          stepped = true;
          break;
        }
      }
      if (!stepped) vx = 0;
    }
    char.position.x += vx * dt;
    // Clamp to world bounds
    char.position.x = Math.max(
      CHARACTER_WIDTH / 2,
      Math.min(mask.getWidth() - CHARACTER_WIDTH / 2, char.position.x),
    );
  }

  // Vertical
  char.position.y += vy * dt;

  // -- Ground resolution --
  const wasAirborne = !char.onGround;
  const grounded = isGrounded(mask, char.position, CHARACTER_WIDTH);

  if (grounded && vy >= 0) {
    // Snap to ground surface
    for (let snap = 0; snap <= 4; snap++) {
      if (mask.isSolid(Math.round(char.position.x), Math.round(char.position.y) + 1 - snap)) {
        char.position.y = Math.round(char.position.y) - snap;
        break;
      }
    }
    char.onGround = true;
    vy = 0;

    if (wasAirborne && char.airborneDistance > SAFE_FALL_HEIGHT) {
      const damage = Math.round((char.airborneDistance - SAFE_FALL_HEIGHT) * FALL_DAMAGE_SCALE);
      char.health = Math.max(0, char.health - damage);
      events.push({ type: 'fell', characterId: char.id, damage });
      if (char.health <= 0) {
        char.alive = false;
        events.push({ type: 'killed', characterId: char.id, cause: 'fall' });
      }
    }
    char.airborneDistance = 0;
  } else {
    char.onGround = false;
    if (vy > 0) {
      // accumulate downward distance only
      char.airborneDistance += char.position.y - prevY;
    }
  }

  // Prevent going above world top
  if (char.position.y < CHARACTER_HEIGHT) {
    char.position.y = CHARACTER_HEIGHT;
    if (vy < 0) vy = 0;
  }

  // -- Drowning --
  if (char.position.y + CHARACTER_HEIGHT / 2 >= waterLevel) {
    const dmg = DROWN_DAMAGE_PER_SEC * dt;
    char.health = Math.max(0, char.health - dmg);
    if (char.health <= 0 && char.alive) {
      char.alive = false;
      events.push({ type: 'drowned', characterId: char.id });
      events.push({ type: 'killed', characterId: char.id, cause: 'drown' });
    }
  }

  char.velocity.x = vx;
  char.velocity.y = vy;

  // -- Animation state --
  if (!char.onGround && vy < 0) char.animationState = 'jump';
  else if (!char.onGround && vy > 0) char.animationState = 'fall';
  else if (Math.abs(vx) > 0) char.animationState = 'walk';
  else char.animationState = 'idle';

  return events;
}
