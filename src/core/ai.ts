import { AIM_MAX, AIM_MIN, BUDDY_RADIUS, MUZZLE_OFFSET, TORCH_SPEED, WIND_ACCEL } from './constants';
import { meleeLaunch, REST_SPEED, REST_TIME, selfDestructBlast, type AiLevel, type Buddy, type Game } from './game';
import { clamp, lerp } from './math';
import { createBody, GRAVITY, stepBody, stepProjectile } from './physics';
import { gaussian, type Rng } from './rng';
import type { Crate } from './crates';
import { FLYER_SPEED, stepFlyer } from './flyer';
import { releaseSheep, stepSheep } from './sheep';
import { groundBelow } from './strike';
import { WEAPON_ORDER, WEAPONS, type WeaponDef, type WeaponId } from './weapons';

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
  let rest = 0;
  for (let t = 0; t < 7; t += dt) {
    const hit = stepProjectile(game.terrain, p, dt, ax, -GRAVITY * def.gravityScale, def.restitution, hitTest, 0.3);
    if (hit === 'terrain' || hit === 'target') return { x: p.x, y: p.y };
    if (hit === 'water' || hit === 'out') return null;
    if (def.fuse > 0 && t + dt >= def.fuse) return { x: p.x, y: p.y };
    rest = Math.hypot(p.vx, p.vy) < REST_SPEED ? rest + dt : 0;
    if (def.restFuse !== undefined && rest >= REST_TIME) return { x: p.x, y: p.y };
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

  for (const weapon of WEAPON_ORDER.filter((id) => WEAPONS[id].kind === 'projectile')) {
    if (!allowed(weapon)) continue;
    // Spending limited ammo needs a clearly better shot than an unlimited weapon.
    const limited = team.ammo[weapon] !== Infinity;
    const cost = limited ? 12 : 0;
    // Limited weapons are a rare pick, so search them on a coarser grid to keep thinking fast.
    const stride = limited && !only ? 2 : 1;
    for (const facing of [1, -1] as const) {
      for (let a = 0; a < cfg.angles; a += stride) {
        const aim = lerp(-0.35, 1.4, a / (cfg.angles - 1));
        for (let s = 0; s < cfg.powers; s += stride) {
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

  for (const strike of WEAPON_ORDER.filter((id) => WEAPONS[id].kind === 'strike')) {
    if (!allowed(strike)) continue;
    const { count, spacing, weapon } = WEAPONS[strike].strike!;
    const bomb = WEAPONS[weapon];
    // A smashing projectile hits the same column repeatedly: count each impact.
    const hitsPerBomb = bomb.impacts ? bomb.impacts * 0.5 : 1;
    for (const enemy of enemies) {
      for (const shift of spacing > 0 ? [-spacing, 0, spacing] : [0]) {
        const target = clamp(enemy.body.x + shift, 0, game.terrain.width);
        let score = -20;
        for (let k = 0; k < count; k++) {
          const x = target + (k - (count - 1) / 2) * spacing;
          score += scoreBlast(game, me, x, groundBelow(game.terrain, x), bomb) * hitsPerBomb;
        }
        const facing: 1 | -1 = target < me.body.x ? -1 : 1;
        if (score > best.score) best = { weapon: strike, facing, aim: me.aim, power: 1, score, target };
      }
    }
  }

  if (allowed('flysheep') && nearest) {
    // Hard to predict exactly; valued as a likely, heavy hit that costs a rare weapon.
    const def = WEAPONS.flysheep;
    const score = def.damage * 0.55 + (nearest.hp <= def.damage * 0.55 ? 40 : 0) - 15;
    const facing: 1 | -1 = nearest.body.x < me.body.x ? -1 : 1;
    // Only launch along a clear path: a sheep hitting rock right away explodes next to us.
    const aim = [0.8, 1.2, 0.4, 1.45].find((a) => flyerLaunchClear(game, me, facing, a));
    if (aim !== undefined && score > best.score) best = { weapon: 'flysheep', facing, aim, power: 1, score };
  }

  if (allowed('torch')) {
    // Burn towards an enemy on about the same level behind a wall, if the tunnel can reach it.
    const def = WEAPONS.torch;
    for (const enemy of enemies) {
      const dx = enemy.body.x - me.body.x;
      if (Math.abs(enemy.body.y - me.body.y) > 1 || Math.abs(dx) > TORCH_SPEED * def.fuse + def.range || lineOfSight(game, me, enemy)) continue;
      const score = def.damage + (enemy.hp <= def.damage ? 40 : 0) - 6;
      if (score > best.score) best = { weapon: 'torch', facing: dx < 0 ? -1 : 1, aim: me.aim, power: 1, score };
    }
  }

  if (allowed('drill')) {
    // Drill down onto an enemy buried right below.
    const def = WEAPONS.drill;
    for (const enemy of enemies) {
      const below = me.body.y - enemy.body.y;
      if (Math.abs(enemy.body.x - me.body.x) > def.radius + BUDDY_RADIUS || below < 1 || below > DRILL_REACH || lineOfSight(game, me, enemy)) continue;
      const score = def.damage + (enemy.hp <= def.damage ? 40 : 0) - 6;
      if (score > best.score) best = { weapon: 'drill', facing: best.facing, aim: me.aim, power: 1, score };
    }
  }

  if (allowed('selfdestruct')) {
    // Worth it only when the blast takes out more than the buddy it costs.
    const blast = selfDestructBlast(WEAPONS.selfdestruct, me.hp);
    let score = -me.hp - 30;
    for (const b of game.buddies) {
      if (!b.alive || b === me) continue;
      const reach = Math.max(0, Math.hypot(b.body.x - me.body.x, b.body.y - me.body.y) - BUDDY_RADIUS * 0.5);
      if (reach >= blast.radius) continue;
      const dmg = blast.damage * (1 - reach / blast.radius);
      score += b.team === me.team ? -dmg * 1.5 : dmg + (dmg >= b.hp ? 40 : 0);
    }
    if (score > best.score) best = { weapon: 'selfdestruct', facing: best.facing, aim: me.aim, power: 1, score };
  }

  for (const enemy of enemies) {
    const dx = enemy.body.x - me.body.x;
    const dy = enemy.body.y - me.body.y;
    const facing: 1 | -1 = dx < 0 ? -1 : 1;
    const dist = Math.hypot(dx, dy);
    for (const weapon of WEAPON_ORDER.filter((id) => WEAPONS[id].kind === 'melee')) {
      const def = WEAPONS[weapon];
      if (!allowed(weapon) || dist >= def.range + BUDDY_RADIUS * 1.5) continue;
      const aim = directAim(enemy);
      const launch = meleeLaunch(def, facing, { x: Math.cos(aim) * facing, y: Math.sin(aim) });
      const lethal = enemy.hp <= def.damage || knockedOut(game, enemy, launch.x, launch.y);
      const score = def.damage + (lethal ? enemy.hp + 40 : 0) + 5 - (team.ammo[weapon] === Infinity ? 0 : 8);
      if (score > best.score) best = { weapon, facing, aim, power: 1, score };
    }
    if (allowed('minigun') && dist < WEAPONS.minigun.range && lineOfSight(game, me, enemy)) {
      const def = WEAPONS.minigun;
      const { count } = def.burst!;
      const aim = directAim(enemy);
      // Most bullets hit; their combined shove may knock the victim out.
      const hits = count * 0.7;
      const shove = { x: Math.cos(aim) * facing * def.force * hits, y: Math.sin(aim) * def.force * hits + (def.lift ?? 0) * hits };
      const lethal = enemy.hp <= def.damage * hits || knockedOut(game, enemy, shove.x, shove.y);
      const score = def.damage * hits + (lethal ? enemy.hp + 40 : 0) - 10;
      if (score > best.score) best = { weapon: 'minigun', facing, aim, power: 1, score };
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

/** Does a flying sheep launched at `aim` get clear of the rock around the buddy before it can be steered? */
function flyerLaunchClear(game: Game, me: Buddy, facing: 1 | -1, aim: number): boolean {
  const dx = Math.cos(aim) * facing;
  const dy = Math.sin(aim);
  const f = { id: 0, owner: me.id, x: me.body.x + dx * MUZZLE_OFFSET, y: me.body.y + dy * MUZZLE_OFFSET, angle: Math.atan2(dy, dx), age: 0 };
  for (let t = 0; t < FLYER_CLEARANCE_TIME; t += 1 / 30) {
    if (stepFlyer(game.terrain, f, 1 / 30, { x: 0, y: 0 }, () => false) !== 'none') return false;
  }
  return true;
}

/** Would a buddy launched with this velocity end up in the water or off the map? */
function knockedOut(game: Game, target: Buddy, vx: number, vy: number): boolean {
  const body = { ...createBody(target.body.x, target.body.y, target.body.radius), vx, vy };
  const t = game.terrain;
  for (let time = 0; time < 5; time += 1 / 30) {
    stepBody(t, body, 1 / 30, null);
    if (body.y < t.waterLevel - 0.4 || body.x < -30 || body.x > t.width + 30) return true;
    if (body.grounded && Math.hypot(body.vx, body.vy) < 0.5) return false;
  }
  return false;
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

/** How deep the drill gets in one use, roughly. */
const DRILL_REACH = 8;

/** Horizontal distance from the target at which a steered flying sheep starts its dive. */
const FLYER_APPROACH = 6;
/** Height above the highest ground on the way that a cruising flying sheep keeps. */
const FLYER_CLEARANCE = 3;

/** Seconds of straight flight a launch must survive: about the blast radius plus a margin. */
const FLYER_CLEARANCE_TIME = (WEAPONS.flysheep.radius + 2) / FLYER_SPEED;

/** Attacks scoring below this are worth skipping for a crate within reach. */
const CRATE_WORTH = 15;

/** Closest crate the buddy can plausibly walk to this turn. */
function nearbyCrate(game: Game, me: Buddy): Crate | null {
  let best: Crate | null = null;
  for (const c of game.crates) {
    const dx = Math.abs(c.body.x - me.body.x);
    if (dx > 12 || Math.abs(c.body.y - me.body.y) > 3 || !c.body.grounded) continue;
    if (!best || dx < Math.abs(best.body.x - me.body.x)) best = c;
  }
  return best;
}

/** Drives an AI team through the same commands a human uses. */
export class AiDriver {
  private stage: 'think' | 'fetch' | 'aim' | 'fire' | 'wait' = 'think';
  /** Crate being walked to, and how often this turn the AI already went for one. */
  private fetch: { crate: number; lastX: number; stuck: number } | null = null;
  private fetches = 0;
  private timer = 0;
  private plan: AttackPlan | null = null;

  constructor(
    private readonly level: AiLevel,
    private readonly rng: Rng,
  ) {}

  reset(): void {
    this.fetch = null;
    this.fetches = 0;
    this.stage = 'think';
    this.timer = 0;
    this.plan = null;
  }

  /** Home the flying sheep in on the nearest enemy: climb over obstacles first, then dive. */
  private steerFlyer(game: Game): void {
    const f = game.flyer!;
    const me = game.activeBuddy!;
    const target = game.buddies
      .filter((b) => b.alive && b.team !== me.team)
      .reduce<Buddy | null>((best, b) => (!best || Math.hypot(b.body.x - f.x, b.body.y - f.y) < Math.hypot(best.body.x - f.x, best.body.y - f.y) ? b : best), null);
    if (!target) return game.pressFire();
    const dx = target.body.x - f.x;
    const dy = target.body.y - f.y;
    if (Math.hypot(dx, dy) < 1.5) return game.pressFire();
    const input = game.input;
    if (Math.abs(dx) > FLYER_APPROACH) {
      // Cruise: head for the target while keeping clear of the highest ground on the way.
      input.right = dx > 0;
      input.left = dx < 0;
      let cruise = target.body.y;
      for (let x = Math.min(f.x, target.body.x); x <= Math.max(f.x, target.body.x); x += 1) cruise = Math.max(cruise, groundBelow(game.terrain, x));
      cruise += FLYER_CLEARANCE;
      input.up = f.y < cruise;
      input.down = f.y > cruise + 2;
      return;
    }
    // Final approach: press the arrow keys (one or two) closest to the direction of the target.
    const len = Math.hypot(dx, dy);
    const axis = Math.sin(Math.PI / 8);
    input.right = dx / len > axis;
    input.left = dx / len < -axis;
    input.up = dy / len > axis;
    input.down = dy / len < -axis;
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
      if (game.flyer) this.steerFlyer(game);
      else if (this.timer >= (this.plan?.delay ?? 0)) game.pressFire();
      return;
    }
    if (game.phase !== 'aiming') return;

    switch (this.stage) {
      case 'think': {
        if (this.timer < LEVELS[this.level].think) return;
        const midUse = game.shotsLeft < WEAPONS[game.weapon].shots;
        const plan = planAttack(game, me, this.level, this.rng, midUse ? game.weapon : undefined);
        const crate = midUse ? null : nearbyCrate(game, me);
        if (crate && plan.score < CRATE_WORTH && this.fetches < 2 && game.turnTimeLeft > 12) {
          this.fetches++;
          this.fetch = { crate: crate.id, lastX: me.body.x, stuck: 0 };
          this.stage = 'fetch';
          this.timer = 0;
          return;
        }
        this.plan = plan;
        game.selectWeapon(plan.weapon);
        game.face(plan.facing);
        this.stage = 'aim';
        this.timer = 0;
        return;
      }
      case 'fetch': {
        const target = game.crates.find((c) => c.id === this.fetch?.crate);
        if (!target || this.timer > 6) {
          // Picked up, destroyed or out of reach: think again from the new position.
          this.stage = 'think';
          this.timer = LEVELS[this.level].think * 0.5;
          return;
        }
        const f = this.fetch!;
        if (target.body.x < me.body.x) input.left = true;
        else input.right = true;
        f.stuck = Math.abs(me.body.x - f.lastX) < 0.01 ? f.stuck + dt : 0;
        f.lastX = me.body.x;
        if (f.stuck > 0.3) game.jump(false);
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
