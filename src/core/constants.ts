export const WORLD_WIDTH = 128;
export const WORLD_HEIGHT = 64;
export const WATER_LEVEL = 3;

export const BUDDY_RADIUS = 0.6;
export const MUZZLE_OFFSET = BUDDY_RADIUS + 0.45;
export const START_HP = 100;

export const WALK_SPEED = 3.2;
/** Walking speed while burning through rock with the blowtorch. */
export const TORCH_SPEED = 1.9;
export const JUMP = { vx: 5.5, vy: 9 };
export const BACKFLIP = { vx: -2.2, vy: 13 };
export const AIM_SPEED = 1.6;
export const AIM_MIN = -1.45;
export const AIM_MAX = 1.45;
export const CHARGE_TIME = 1.5;

/** Horizontal acceleration at wind = ±1, scaled by each weapon's wind influence. */
export const WIND_ACCEL = 12;

export const INTRO_TIME = 1.2;
export const DEATH_DELAY = 0.7;
export const SETTLE_MIN = 0.6;
export const SETTLE_MAX = 15;
export const SAFE_FALL_SPEED = 17;
export const FALL_DAMAGE_PER_SPEED = 2.2;
export const DEATH_BLAST = { radius: 2.2, damage: 20, force: 9 };
