import type { Vec2, Facing, AnimationState } from '../types';

export interface Character {
  id: string;
  teamId: string;
  name: string;
  position: Vec2;
  velocity: Vec2;
  health: number;
  maxHealth: number;
  alive: boolean;
  facing: Facing;
  onGround: boolean;
  animationState: AnimationState;
  airborneDistance: number;
}

export function createCharacter(
  id: string,
  teamId: string,
  name: string,
  position: Vec2,
): Character {
  return {
    id,
    teamId,
    name,
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    health: 100,
    maxHealth: 100,
    alive: true,
    facing: 'right',
    onGround: false,
    animationState: 'idle',
    airborneDistance: 0,
  };
}
