import { AIM_MAX, AIM_MIN, BUDDY_RADIUS, MUZZLE_OFFSET, WIND_ACCEL } from './constants';
import type { AiLevel, Buddy, Game } from './game';
import { clamp, lerp } from './math';
import { GRAVITY, stepProjectile } from './physics';
import { gaussian, type Rng } from './rng';
import { releaseSheep, stepSheep } from './sheep';
import { groundBelow } from './strike';
import { WEAPONS, type WeaponDef, type WeaponId } from './weapons';

export interface AttackPlan {
  weapon: WeaponId;
  facing: 1 | -1;
  aim: number;
  power: number;
  score: number;
  /** Walkers: seconds after release to detonate. */
  delay?: number;
  /** Air strikes: world x to bomb. */
  target?: number;
}

const LEVELS: Record<AiLevel, { angles: number; powers: number; aimError: number; powerError: number; think: number }> = {
  easy: { angles: 10, powers: 5, aimError: 0.12, powerError: 0.1, think: 1.2 },
  normal: { angles: 18, powers: 8, aimError: 0.045, powerError: 0.04, think: 0.9 },
  hard: { angles: 28, powers: 11, aimError: 0.012, powerError: 0.012, think: 0.6 },
};

/** Simulate a shot without touching game state; returns where it detonates. */
export function simulateShot(game: Game, me: Buddy, weapon: WeaponId, facing: 1 | -1, aim: number, power: number): { x: number; y: number } | null {
  const def = WEAPONS[weapon];
  const dx = Math.cos(aim) * facing;
  const dy = Math.sin(aim);
  const speed = lerp(def.minSpeed, def.maxSpeed, power);
  const p = { x: me.body.x + dx * MUZZLE_OFFSET, y: me.body.y + dy * MUZZLE_OFFSET, vx: dx * speed, vy: dy * speed, radius: 0.15, bounces: 0 };
  const hitTest =
    def.restitution === null
      ? (x: number, y: number) => game.buddies.some((b) => b.alive && b !== me && Math.hypot(b.body.x - x, b.body.y - y) < BUDDY_RADIUS + 0.15)
      : undefined;
  const dt = 1 / 20;
  const ax = game.wind * WIND_ACCEL * def.windInfluence;
  for (let t = 0; t < 7; t += dt) {
    const hit = stepProjectile(game.terrain, p, dt, ax, -GRAVITY * def.gravityScale, def.restitution, hitTest, 0.3);
    if (hit === 'terrain' || hit === 'target') return { x: p.x, y: p.y };
    if (hit === 'water' || hit === 'out') return null;
    if (def.fuse > 0 && t + dt >= def.fuse) return { x: p.x, y: p.y };
  }
  return null;
}

/** Replay a sheep's hops without touching game state; returns the best moment to detonate. */
export function simulateSheep(game: Game, me: Buddy, facing: 1 | -1, maxTime: number): { score: number; time: number } {
  const def = WEAPONS.sheep;
  const sheep = releaseSheep(0, me.id, me.body.x, me.body.y, facing);
  const dt = 1 / 60;
  let best = { score: -Infinity, time: 0 };
  for (let step = 1; step * dt <= Math.min(maxTime, def.fuse); step++) {
    const result = stepSheep(game.terrain, sheep, dt);
    if (result === 'water' || result === 'out') break;
    if (step % 6) continue;
    const score = scoreBlast(game, me, sheep.body.x, sheep.body.y, def);
    if (score > best.score) best = { score, time: step * dt };
  }
  return best;
}

/** Blast score plus a rough estimate for cluster fragments raining down around the impact. */
export function scoreWeapon(game: Game, me: Buddy, x: number, y: number, def: WeaponDef): number {
  let score = scoreBlast(game, me, x, y, def);
  if (def.cluster) {
    const fragment = WEAPONS[def.cluster.weapon];
    const spread = { ...fragment, radius: 4.5, damage: fragment.damage * def.cluster.count * 0.4 };
    score += Math.max(scoreBlast(game, me, x, y + 1, spread), -spread.damage * 3);
  }
  return score;
}

/** Expected value of a blast at (x, y): enemy damage minus weighted friendly/self damage. */
export function scoreBlast(game: Game, me: Buddy, x: number, y: number, def: WeaponDef): number {
  let gain = 0;
  let loss = 0;
  let nearestEnemy = Infinity;
  for (const b of game.buddies) {
    if (!b.alive) continue;
    const reach = Math.max(0, Math.hypot(b.body.x - x, b.body.y - y) - BUDDY_RADIUS * 0.5);
    if (b.team !== me.team) nearestEnemy = Math.min(nearestEnemy, reach);
    if (reach >= def.radius) continue;
    const dmg = def.damage * (1 - reach / def.radius);
    if (b.team === me.team) loss += dmg * (b === me ? 2.5 : 1.5);
    else gain += dmg + (dmg >= b.hp ? 40 : 0);
  }
  return gain > 0 ? gain - loss : -loss * 5 - nearestEnemy;
}

/**
 * Choose the best attack for `me`. With `only` set, just that weapon is considered — used when a
 * multi-shot weapon is already in use and cannot be switched.
 */
export function planAttack(game: Game, me: Buddy, level: AiLevel, rng: Rng, only?: WeaponId): AttackPlan {
  const cfg = LEVELS[level];
  const team = game.teams[me.team];
  const allowed = (weapon: WeaponId) => (only ? weapon === only : team.ammo[weapon] > 0);
  const enemies = game.buddies.filter((b) => b.alive && b.team !== me.team);
  const nearest = enemies.reduce<Buddy | null>((best, b) => (!best || Math.abs(b.body.x - me.body.x) < Math.abs(best.body.x - me.body.x) ? b : best), null);
  const directAim = (target: Buddy) => clamp(Math.atan2(target.body.y - me.body.y, Math.abs(target.body.x - me.body.x)), AIM_MIN, AIM_MAX);
  let best: AttackPlan = {
    weapon: only ?? 'bazooka',
    facing: nearest && nearest.body.x < me.body.x ? -1 : 1,
    aim: only === 'shotgun' && nearest ? directAim(nearest) : 0.8,
    power: 0.7,
    score: -Infinity,
  };

  for (const weapon of ['bazooka', 'grenade', 'cluster'] as const) {
    if (!allowed(weapon)) continue;
    // Spending limited ammo needs a clearly better shot than an unlimited weapon.
    const cost = team.ammo[weapon] === Infinity ? 0 : 12;
    for (const facing of [1, -1] as const) {
      for (let a = 0; a < cfg.angles; a++) {
        const aim = lerp(-0.35, 1.4, a / (cfg.angles - 1));
        for (let s = 0; s < cfg.powers; s++) {
          const power = lerp(0.3, 1, s / (cfg.powers - 1));
          const impact = simulateShot(game, me, weapon, facing, aim, power);
          if (!impact) continue;
          const score = scoreWeapon(game, me, impact.x, impact.y, WEAPONS[weapon]) - cost;
          if (score > best.score) best = { weapon, facing, aim, power, score };
        }
      }
    }
  }

  if (allowed('sheep') && enemies.length) {
    // Keep a margin so the sheep still detonates in time with think and aim delays.
    const budget = game.turnTimeLeft - cfg.think - 1.5;
    for (const facing of [1, -1] as const) {
      const run = simulateSheep(game, me, facing, budget);
      const score = run.score - 15;
      if (score > best.score) best = { weapon: 'sheep', facing, aim: me.aim, power: 1, score, delay: run.time };
    }
  }

  if (allowed('airstrike')) {
    const def = WEAPONS.airstrike;
    const { count, spacing, weapon } = def.strike!;
    for (const enemy of enemies) {
      for (const shift of [-spacing, 0, spacing]) {
        const target = clamp(enemy.body.x + shift, 0, game.terrain.width);
        let score = -20;
        for (let k = 0; k < count; k++) {
          const x = target + (k - (count - 1) / 2) * spacing;
          score += scoreBlast(game, me, x, groundBelow(game.terrain, x), WEAPONS[weapon]);
        }
        const facing: 1 | -1 = target < me.body.x ? -1 : 1;
        if (score > best.score) best = { weapon: 'airstrike', facing, aim: me.aim, power: 1, score, target };
      }
    }
  }

  for (const enemy of enemies) {
    const dx = enemy.body.x - me.body.x;
    const dy = enemy.body.y - me.body.y;
    const facing: 1 | -1 = dx < 0 ? -1 : 1;
    const dist = Math.hypot(dx, dy);
    if (allowed('punch') && dist < WEAPONS.punch.range + BUDDY_RADIUS * 1.5) {
      const score = WEAPONS.punch.damage + (enemy.hp <= WEAPONS.punch.damage ? 40 : 0) + 5;
      if (score > best.score) best = { weapon: 'punch', facing, aim: directAim(enemy), power: 1, score };
    }
    if (allowed('shotgun') && dist < WEAPONS.shotgun.range && lineOfSight(game, me, enemy)) {
      const damage = WEAPONS.shotgun.damage * 2;
      const score = damage * 0.9 + (enemy.hp <= damage ? 40 : 0);
      if (score > best.score) best = { weapon: 'shotgun', facing, aim: directAim(enemy), power: 1, score };
    }
  }

  return {
    ...best,
    aim: clamp(best.aim + gaussian(rng) * cfg.aimError, AIM_MIN, AIM_MAX),
    power: clamp(best.power + gaussian(rng) * cfg.powerError, 0.05, 1),
    delay: best.delay === undefined ? undefined : Math.max(0.2, best.delay + gaussian(rng) * cfg.powerError * 5),
  };
}

function lineOfSight(game: Game, me: Buddy, target: Buddy): boolean {
  const dx = target.body.x - me.body.x;
  const dy = target.body.y - me.body.y;
  const dist = Math.hypot(dx, dy);
  for (let d = MUZZLE_OFFSET; d < dist - BUDDY_RADIUS; d += 0.2) {
    if (game.terrain.isSolid(me.body.x + (dx / dist) * d, me.body.y + (dy / dist) * d)) return false;
  }
  return true;
}

/** Drives an AI team through the same commands a human uses. */
export class AiDriver {
  private stage: 'think' | 'aim' | 'fire' | 'wait' = 'think';
  private timer = 0;
  private plan: AttackPlan | null = null;

  constructor(
    private readonly level: AiLevel,
    private readonly rng: Rng,
  ) {}

  reset(): void {
    this.stage = 'think';
    this.timer = 0;
    this.plan = null;
  }

  update(game: Game, dt: number): void {
    const me = game.activeBuddy;
    if (!me) return;
    this.timer += dt;
    const input = game.input;
    input.left = input.right = input.up = input.down = false;

    if (game.phase === 'retreat') {
      // Scurry away from the target for a moment.
      if (this.plan && WEAPONS[this.plan.weapon].restitution === null && game.retreatLeft > game.config.retreatTime - 1) {
        if (this.plan.facing > 0) input.left = true;
        else input.right = true;
      }
      return;
    }
    if (game.phase === 'guiding') {
      if (this.timer >= (this.plan?.delay ?? 0)) game.pressFire();
      return;
    }
    if (game.phase !== 'aiming') return;

    switch (this.stage) {
      case 'think': {
        if (this.timer < LEVELS[this.level].think) return;
        const midUse = game.shotsLeft < WEAPONS[game.weapon].shots;
        const plan = planAttack(game, me, this.level, this.rng, midUse ? game.weapon : undefined);
        this.plan = plan;
        game.selectWeapon(plan.weapon);
        game.face(plan.facing);
        this.stage = 'aim';
        this.timer = 0;
        return;
      }
      case 'aim': {
        const plan = this.plan!;
        const diff = plan.aim - me.aim;
        if (Math.abs(diff) > 0.03) {
          if (diff > 0) input.up = true;
          else input.down = true;
          return;
        }
        me.aim = plan.aim;
        if (this.timer < 0.35) return;
        if (plan.target !== undefined) game.strike(plan.target);
        else game.pressFire();
        this.stage = WEAPONS[plan.weapon].charge ? 'fire' : 'wait';
        this.timer = 0;
        return;
      }
      case 'fire':
        if ((game.charge ?? 1) >= this.plan!.power) game.releaseFire();
        if (game.charge === null) {
          this.stage = 'wait';
          this.timer = 0;
        }
        return;
      case 'wait':
        if (game.shotsLeft > 0 && this.timer > 0.8) {
          this.stage = 'think';
          this.timer = LEVELS[this.level].think;
        }
        return;
    }
  }
}
