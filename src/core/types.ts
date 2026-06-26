// Shared value types — no class instances, no Phaser, no DOM

export type Vec2 = { x: number; y: number };
export type Facing = 'left' | 'right';
export type ControllerType = 'human' | 'ai';
export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type ExecutionType = 'projectile' | 'throwable' | 'melee';
export type AmmoPolicy = 'finite' | 'unlimited';
export type AnimationState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'fall'
  | 'aim'
  | 'punch'
  | 'hurt'
  | 'death'
  | 'victory';
export type MatchPhase = 'setup' | 'playing' | 'ended';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalise(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function vec2Distance(a: Vec2, b: Vec2): number {
  return vec2Length(vec2Sub(a, b));
}

export function vec2Clone(v: Vec2): Vec2 {
  return { x: v.x, y: v.y };
}
