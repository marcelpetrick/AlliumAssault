// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { AIM_MAX, AIM_MIN, BUDDY_RADIUS, MUZZLE_OFFSET, START_HP, TORCH_SPEED, WALK_SPEED, WIND_ACCEL } from './constants';
import { meleeLaunch, REST_SPEED, REST_TIME, selfDestructBlast, type AiLevel, type Buddy, type Game } from './game';
import { clamp, lerp } from './math';
import { createBody, GRAVITY, stepBody, stepProjectile } from './physics';
import { gaussian, type Rng } from './rng';
import { defined } from './assert';
import { CRATE_BLAST, CRATE_HEAL, CRATE_WEAPONS, type Crate } from './crates';
import { MINE_TRIGGER_RANGE } from './mines';
import { FLYER_SPEED, stepFlyer, type Flyer } from './flyer';
import { releaseSheep, stepSheep } from './sheep';
import { groundBelow, strikeWindShift } from './strike';
import type { Terrain } from './terrain';
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
  /** Air strikes: side the plane comes in from, chosen deliberately rather than inherited. */
  strikeDir?: 1 | -1;
}

const LEVELS: Record<AiLevel, { angles: number; powers: number; aimError: number; powerError: number; think: number }> = {
  easy: { angles: 10, powers: 5, aimError: 0.12, powerError: 0.1, think: 1.2 },
  normal: { angles: 18, powers: 8, aimError: 0.045, powerError: 0.04, think: 0.9 },
  hard: { angles: 28, powers: 11, aimError: 0.012, powerError: 0.012, think: 0.6 },
};

/**
 * What a level understands about the board, on top of how finely it searches and how much its hand
 * shakes. Easy plays the simple game it always did: shoot at whatever is closest and grab a crate
 * when there is nothing better to do.
 */
export interface AiKnowledge {
  /**
   * The loose things lying on the map: what a blast sets off, what a crate is worth walking to,
   * and which ground has a mine on it.
   */
  crates: boolean;
  /** A blast can shove a buddy off the map or into the water, which finishes it. */
  knockback: boolean;
  /** Which enemy team is ahead, and which is one buddy away from being wiped out. */
  focus: boolean;
}

export const NO_KNOWLEDGE: AiKnowledge = { crates: false, knockback: false, focus: false };

const KNOWLEDGE: Record<AiLevel, AiKnowledge> = {
  easy: NO_KNOWLEDGE,
  normal: { crates: true, knockback: false, focus: true },
  hard: { crates: true, knockback: true, focus: true },
};

/** Finishing a buddy is worth more than the damage it took. */
const KILL_BONUS = 40;
/** Hurting a team-mate, and hurting itself, counts against a shot this much. */
const FRIEND_WEIGHT = 1.5;
const SELF_WEIGHT = 2.5;
/**
 * How often a team has already used each weapon this match. The AI leans on whatever scores best
 * from a given spot, which for the concrete mule is almost anywhere, so without a memory it plays
 * the same weapon every turn until the ammo runs out.
 */
export type WeaponHistory = ReadonlyMap<WeaponId, number>;
export const NO_HISTORY: WeaponHistory = new Map<WeaponId, number>();

/**
 * Spending a limited weapon at all, per use already spent, and for holding the last of something.
 * The scarcity term is a share of the weapon's own damage rather than a flat number: the rarer and
 * the heavier a weapon is, the more decisive the shot has to be before it is worth spending. It is
 * what stops the AI opening every match with the biggest thing in its bag and ending it on turn
 * three.
 */
const LIMITED_COST = 12;
const REPEAT_COST = 9;
const FREE_REPEAT_COST = 3.5;
const SCARCITY_SHARE = 0.5;

/**
 * How heavy a weapon is, all in: its own blast plus half of what its fragments add up to. A cluster
 * weapon is worth far more than its first explosion, and scarcity has to price the whole thing or
 * the AI throws its one Ming vase on the opening turn of every match.
 */
function payloadWeight(def: WeaponDef): number {
  const fragments = def.cluster ? def.cluster.count * WEAPONS[def.cluster.weapon].damage * 0.5 : 0;
  const payload = def.strike ? def.strike.count * WEAPONS[def.strike.weapon].damage * 0.5 : 0;
  return def.damage + fragments + payload;
}

/** Supply thrown away when a blast destroys a crate nobody has collected yet. */
const CRATE_LOSS = 4;
/** Extra weight on an enemy team down to its last living buddy. */
const LAST_BUDDY_BONUS = 0.35;
/** Furthest an enemy can be for a mine laid here to be worth the ammo. */
const MINE_BAIT_RANGE = 15;
/** What spending a mine costs, against the damage it might one day do. */
const MINE_COST = 18;
/** A shove smaller than this never throws anybody anywhere. */
const MIN_SHOVE = 2;

/** Simulate a shot without touching game state; returns where it detonates. */
export function simulateShot(game: Game, me: Buddy, weapon: WeaponId, facing: 1 | -1, aim: number, power: number): { x: number; y: number } | null {
  const def = WEAPONS[weapon];
  const dx = Math.cos(aim) * facing;
  const dy = Math.sin(aim);
  const speed = lerp(def.minSpeed, def.maxSpeed, power);
  const p = { x: me.body.x + dx * MUZZLE_OFFSET, y: me.body.y + dy * MUZZLE_OFFSET, vx: dx * speed, vy: dy * speed, radius: 0.15, bounces: 0 };
  // Contact fuses go off on the first thing they touch. Game.stepProjectiles() counts crates as
  // well as buddies, so leaving them out here planned rockets straight through them.
  const hitTest =
    def.restitution === null
      ? (x: number, y: number) =>
          game.buddies.some((b) => b.alive && b !== me && Math.hypot(b.body.x - x, b.body.y - y) < BUDDY_RADIUS + 0.15) ||
          game.crates.some((c) => Math.hypot(c.body.x - x, c.body.y - y) < c.body.radius + 0.15)
      : undefined;
  const dt = 1 / 20;
  const ax = game.wind * WIND_ACCEL * def.windInfluence;
  let rest = 0;
  for (let t = 0; t < 7; t += dt) {
    const hit = stepProjectile(game.terrain, p, dt, ax, -GRAVITY * game.terrain.gravityScale * def.gravityScale, def.restitution, hitTest, 0.3);
    if (hit === 'terrain' || hit === 'target') return { x: p.x, y: p.y };
    if (hit === 'water' || hit === 'out') return null;
    if (def.fuse > 0 && t + dt >= def.fuse) return { x: p.x, y: p.y };
    rest = Math.hypot(p.vx, p.vy) < REST_SPEED ? rest + dt : 0;
    if (def.restFuse !== undefined && rest >= REST_TIME) return { x: p.x, y: p.y };
  }
  return null;
}

/** Replay a sheep's hops without touching game state; returns the best moment to detonate. */
export function simulateSheep(game: Game, me: Buddy, facing: 1 | -1, maxTime: number, know: AiKnowledge = NO_KNOWLEDGE): { score: number; time: number } {
  const def = WEAPONS.sheep;
  const sheep = releaseSheep(0, me.id, me.body.x, me.body.y, facing);
  const dt = 1 / 60;
  let best = { score: -Infinity, time: 0 };
  for (let step = 1; step * dt <= Math.min(maxTime, def.fuse); step++) {
    const result = stepSheep(game.terrain, sheep, dt);
    if (result === 'water' || result === 'out') break;
    if (step % 6) continue;
    const score = scoreBlast(game, me, sheep.body.x, sheep.body.y, def, know);
    if (score > best.score) best = { score, time: step * dt };
  }
  return best;
}

/** Blast score plus a rough estimate for cluster fragments raining down around the impact. */
export function scoreWeapon(game: Game, me: Buddy, x: number, y: number, def: WeaponDef, know: AiKnowledge = NO_KNOWLEDGE): number {
  let score = scoreBlast(game, me, x, y, def, know);
  if (def.cluster) {
    const fragment = WEAPONS[def.cluster.weapon];
    const spread = { ...fragment, radius: 4.5, damage: fragment.damage * def.cluster.count * 0.4 };
    score += Math.max(scoreBlast(game, me, x, y + 1, spread, know), -spread.damage * 3);
  }
  return score;
}

/**
 * How much a hit on this enemy is worth next to a hit on any other. Without `focus` every enemy
 * counts the same, as before. With it, the team holding the most health is the one worth pressing,
 * and a team down to its last buddy is worth finishing off. Only meaningful with several opponents.
 */
function enemyWeight(game: Game, me: Buddy, enemy: Buddy, know: AiKnowledge): number {
  if (!know.focus) return 1;
  const rivals = game.teams.filter((t) => t.index !== me.team && t.buddies.some((b) => b.alive));
  if (rivals.length < 2) return 1;
  const health = (team: (typeof rivals)[number]) => team.buddies.reduce((sum, b) => sum + (b.alive ? Math.max(0, b.hp) : 0), 0);
  const total = rivals.reduce((sum, t) => sum + health(t), 0) || 1;
  const mine = game.teams[enemy.team];
  const lastOne = mine.buddies.filter((b) => b.alive).length === 1;
  return 1 + (health(mine) / total - 1 / rivals.length) + (lastOne ? LAST_BUDDY_BONUS : 0);
}

/**
 * `groundBelow()` scans a whole column of the field, and the inner search asks about the same few
 * positions thousands of times, so remember them until the terrain changes. Half a world unit of
 * precision is plenty for these heuristics.
 */
const surfaceCache = new Map<number, number>();
let surfaceRevision = -1;

function surfaceAt(t: Terrain, x: number): number {
  if (t.revision !== surfaceRevision) {
    surfaceCache.clear();
    surfaceRevision = t.revision;
  }
  const key = Math.round(x * 2);
  const known = surfaceCache.get(key);
  if (known !== undefined) return known;
  const y = groundBelow(t, key / 2);
  surfaceCache.set(key, y);
  return y;
}

/**
 * Rough ballistic answer to "would this shove put them in the water or off the map?". It ignores
 * the rock in between, so it can be optimistic, but it costs nothing — unlike `knockedOut()`,
 * which simulates the whole fall and is far too slow for the inner angle/power search.
 */
function shovedOut(game: Game, target: Buddy, vx: number, vy: number): boolean {
  if (Math.abs(vx) < MIN_SHOVE) return false;
  const t = game.terrain;
  // Time to come down a metre below where it started, which is where the ground normally is.
  const pull = GRAVITY * t.gravityScale;
  const flight = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * pull))) / pull;
  const land = target.body.x + vx * flight;
  if (land < 0 || land > t.width) return true;
  return surfaceAt(t, land) <= t.waterLevel + 0.2;
}

/** Running total of what a blast is worth: damage dealt to enemies against damage taken by us. */
interface Tally {
  gain: number;
  loss: number;
}

/** Add one blast of `radius`/`damage`/`force` centred at (x, y) to the tally. */
function addBlast(game: Game, me: Buddy, tally: Tally, x: number, y: number, radius: number, damage: number, force: number, know: AiKnowledge): void {
  for (const b of game.buddies) {
    if (!b.alive) continue;
    const dx = b.body.x - x;
    const dy = b.body.y - y;
    const dist = Math.hypot(dx, dy);
    const reach = Math.max(0, dist - b.body.radius * 0.5);
    if (reach >= radius) continue;
    const falloff = 1 - reach / radius;
    let value = damage * falloff;
    // The same shove Game.explode() applies: if it throws them out, the whole buddy is the prize.
    if (know.knockback && value < b.hp) {
      const nx = dist > 1e-3 ? dx / dist : 0;
      const ny = dist > 1e-3 ? dy / dist : 1;
      if (shovedOut(game, b, nx * force * falloff, ny * force * falloff + force * 0.35 * falloff)) value = b.hp;
    }
    if (b.team === me.team) tally.loss += value * (b === me ? SELF_WEIGHT : FRIEND_WEIGHT);
    else tally.gain += (value + (value >= b.hp ? KILL_BONUS : 0)) * enemyWeight(game, me, b, know);
  }
}

/** Expected value of a blast at (x, y): enemy damage minus weighted friendly/self damage. */
export function scoreBlast(game: Game, me: Buddy, x: number, y: number, def: WeaponDef, know: AiKnowledge = NO_KNOWLEDGE): number {
  const tally: Tally = { gain: 0, loss: 0 };
  let nearestEnemy = Infinity;
  for (const b of game.buddies) {
    if (!b.alive || b.team === me.team) continue;
    nearestEnemy = Math.min(nearestEnemy, Math.max(0, Math.hypot(b.body.x - x, b.body.y - y) - BUDDY_RADIUS * 0.5));
  }
  addBlast(game, me, tally, x, y, def.radius, def.damage, def.force, know);
  if (know.crates) {
    // Game.explode() sets off every crate it catches, so a crate beside an enemy is a second blast
    // and one beside a friend is a hazard. Only the first link of the chain is estimated.
    for (const c of game.crates) {
      if (Math.hypot(c.body.x - x, c.body.y - y) >= def.radius + c.body.radius) continue;
      addBlast(game, me, tally, c.body.x, c.body.y, CRATE_BLAST.radius, CRATE_BLAST.damage, CRATE_BLAST.force, know);
      tally.loss += CRATE_LOSS;
    }
    // A mine in the blast goes off as well, and its blast is far bigger than a crate's.
    const mine = WEAPONS.mine;
    for (const m of game.mines) {
      if (Math.hypot(m.body.x - x, m.body.y - y) >= def.radius + m.body.radius) continue;
      addBlast(game, me, tally, m.body.x, m.body.y, mine.radius, mine.damage, mine.force, know);
    }
  }
  return tally.gain > 0 ? tally.gain - tally.loss : -tally.loss * 5 - nearestEnemy;
}

/**
 * Choose the best attack for `me`. With `only` set, just that weapon is considered — used when a
 * multi-shot weapon is already in use and cannot be switched.
 *
 * The rope is deliberately absent: rope path planning is its own problem and is not part of this
 * release. Nothing here can pick the `rope` kind up, so an AI never strands itself holding one.
 */
export function planAttack(game: Game, me: Buddy, level: AiLevel, rng: Rng, only?: WeaponId, history: WeaponHistory = NO_HISTORY): AttackPlan {
  const cfg = LEVELS[level];
  const know = KNOWLEDGE[level];
  const team = game.teams[me.team];
  const allowed = (weapon: WeaponId) => (only ? weapon === only : team.ammo[weapon] > 0);
  /**
   * What reaching for this weapon costs before its blast is even considered. Spending a limited
   * weapon has always cost something; on top of that, a weapon this team has already leant on costs
   * more every time, and the last one of anything costs more than the first. Without this the AI
   * finds the single highest-scoring weapon on turn one and then plays it over and over, which is
   * both dull to watch and a worse strategy than spreading the arsenal out.
   */
  const pickCost = (weapon: WeaponId): number => {
    if (only) return 0;
    const repeats = Math.min(history.get(weapon) ?? 0, 4);
    const left = team.ammo[weapon];
    // Even a weapon it can never run out of gets duller the fifth time in a row; a limited one
    // costs the same again for being limited, and more again for being nearly gone.
    if (left === Infinity) return repeats * FREE_REPEAT_COST;
    const scarcity = (payloadWeight(WEAPONS[weapon]) * SCARCITY_SHARE) / Math.max(1, left);
    return LIMITED_COST + scarcity + repeats * REPEAT_COST;
  };
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
    const limited = team.ammo[weapon] !== Infinity;
    const cost = pickCost(weapon);
    // Limited weapons are a rare pick, so search them on a coarser grid to keep thinking fast.
    const stride = limited && !only ? 2 : 1;
    for (const facing of [1, -1] as const) {
      for (let a = 0; a < cfg.angles; a += stride) {
        const aim = lerp(-0.35, 1.4, a / (cfg.angles - 1));
        for (let s = 0; s < cfg.powers; s += stride) {
          const power = lerp(0.3, 1, s / (cfg.powers - 1));
          const impact = simulateShot(game, me, weapon, facing, aim, power);
          if (!impact) continue;
          const score = scoreWeapon(game, me, impact.x, impact.y, WEAPONS[weapon], know) - cost;
          if (score > best.score) best = { weapon, facing, aim, power, score };
        }
      }
    }
  }

  if (allowed('sheep') && enemies.length) {
    // Keep a margin so the sheep still detonates in time with think and aim delays.
    const budget = game.turnTimeLeft - cfg.think - 1.5;
    for (const facing of [1, -1] as const) {
      const run = simulateSheep(game, me, facing, budget, know);
      const score = run.score - pickCost('sheep');
      if (score > best.score) best = { weapon: 'sheep', facing, aim: me.aim, power: 1, score, delay: run.time };
    }
  }

  for (const strike of WEAPON_ORDER.filter((id) => WEAPONS[id].kind === 'strike')) {
    if (!allowed(strike)) continue;
    const { count, spacing, weapon } = defined(WEAPONS[strike].strike, `${strike} strike payload`);
    const bomb = WEAPONS[weapon];
    // A smashing projectile hits the same column repeatedly: count each impact.
    const hitsPerBomb = bomb.impacts ? bomb.impacts * 0.5 : 1;
    for (const enemy of enemies) {
      for (const shift of spacing > 0 ? [-spacing, 0, spacing] : [0]) {
        // Payloads that are not aimed against the wind land downwind: aim upwind by that drift.
        const drift = strikeWindShift(game.terrain, WEAPONS[strike], enemy.body.x, game.wind);
        const target = clamp(enemy.body.x + shift - drift, 0, game.terrain.width);
        const landing = target + drift;
        let score = -20;
        for (let k = 0; k < count; k++) {
          const x = landing + (k - (count - 1) / 2) * spacing;
          score += scoreBlast(game, me, x, groundBelow(game.terrain, x), bomb, know) * hitsPerBomb;
        }
        // Fly in from our own side of the target, as before, but say so explicitly: the human
        // selector must not decide where an AI plane comes from.
        const facing: 1 | -1 = target < me.body.x ? -1 : 1;
        score -= pickCost(strike);
        if (score > best.score) best = { weapon: strike, facing, aim: me.aim, power: 1, score, target, strikeDir: facing };
      }
    }
  }

  if (allowed('flysheep') && nearest) {
    // Hard to predict exactly; valued as a likely, heavy hit that costs a rare weapon.
    const def = WEAPONS.flysheep;
    const score = (def.damage * 0.55 + (nearest.hp <= def.damage * 0.55 ? KILL_BONUS : 0)) * enemyWeight(game, me, nearest, know) - pickCost('flysheep');
    const facing: 1 | -1 = nearest.body.x < me.body.x ? -1 : 1;
    // Only launch along a clear path: a sheep hitting rock right away explodes next to us.
    const aim = [0.8, 1.2, 0.4, 1.45].find((a) => flyerLaunchClear(game, me, facing, a));
    if (aim !== undefined && score > best.score) best = { weapon: 'flysheep', facing, aim, power: 1, score };
  }

  if (allowed('torch')) {
    // Burn towards an enemy on about the same level behind a wall, if the tunnel can reach it.
    // The torch cuts along the aim line, so a level tunnel needs a level aim.
    const def = WEAPONS.torch;
    for (const enemy of enemies) {
      const dx = enemy.body.x - me.body.x;
      if (Math.abs(enemy.body.y - me.body.y) > 1 || Math.abs(dx) > TORCH_SPEED * def.fuse + def.range || lineOfSight(game, me, enemy)) continue;
      const score = (def.damage + (enemy.hp <= def.damage ? KILL_BONUS : 0)) * enemyWeight(game, me, enemy, know) - 6 - pickCost('torch');
      if (score > best.score) best = { weapon: 'torch', facing: dx < 0 ? -1 : 1, aim: 0, power: 1, score };
    }
  }

  if (allowed('drill')) {
    // Drill down onto an enemy buried right below.
    const def = WEAPONS.drill;
    for (const enemy of enemies) {
      const below = me.body.y - enemy.body.y;
      if (Math.abs(enemy.body.x - me.body.x) > def.radius + BUDDY_RADIUS || below < 1 || below > DRILL_REACH || lineOfSight(game, me, enemy)) continue;
      const score = (def.damage + (enemy.hp <= def.damage ? KILL_BONUS : 0)) * enemyWeight(game, me, enemy, know) - 6 - pickCost('drill');
      if (score > best.score) best = { weapon: 'drill', facing: best.facing, aim: me.aim, power: 1, score };
    }
  }

  if (allowed('mine') && nearest) {
    // A trap is worth laying while an enemy is close enough to wander into it, and never right
    // next to one of ours: a mine does not care whose side walks past.
    const def = WEAPONS.mine;
    const reach = Math.hypot(nearest.body.x - me.body.x, nearest.body.y - me.body.y);
    const friendClose = game.buddies.some(
      (b) => b.alive && b !== me && b.team === me.team && Math.hypot(b.body.x - me.body.x, b.body.y - me.body.y) < MINE_TRIGGER_RANGE * 1.5,
    );
    const score = def.damage * Math.max(0, 1 - reach / MINE_BAIT_RANGE) * enemyWeight(game, me, nearest, know) - MINE_COST - (friendClose ? def.damage : 0);
    const facing: 1 | -1 = nearest.body.x < me.body.x ? -1 : 1;
    if (score > best.score) best = { weapon: 'mine', facing, aim: me.aim, power: 1, score };
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
      score += b.team === me.team ? -dmg * FRIEND_WEIGHT : (dmg + (dmg >= b.hp ? KILL_BONUS : 0)) * enemyWeight(game, me, b, know);
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
      const score = (def.damage + (lethal ? enemy.hp + KILL_BONUS : 0)) * enemyWeight(game, me, enemy, know) + 5 - pickCost(weapon);
      if (score > best.score) best = { weapon, facing, aim, power: 1, score };
    }
    if (allowed('minigun') && dist < WEAPONS.minigun.range && lineOfSight(game, me, enemy)) {
      const def = WEAPONS.minigun;
      const { count } = defined(def.burst, 'minigun burst');
      const aim = directAim(enemy);
      // Most bullets hit; their combined shove may knock the victim out.
      const hits = count * 0.7;
      const shove = { x: Math.cos(aim) * facing * def.force * hits, y: Math.sin(aim) * def.force * hits + (def.lift ?? 0) * hits };
      const lethal = enemy.hp <= def.damage * hits || knockedOut(game, enemy, shove.x, shove.y);
      const score = (def.damage * hits + (lethal ? enemy.hp + KILL_BONUS : 0)) * enemyWeight(game, me, enemy, know) - 10 - pickCost('minigun');
      if (score > best.score) best = { weapon: 'minigun', facing, aim, power: 1, score };
    }
    if (allowed('shotgun') && dist < WEAPONS.shotgun.range && lineOfSight(game, me, enemy)) {
      const damage = WEAPONS.shotgun.damage * 2;
      const score = (damage * 0.9 + (enemy.hp <= damage ? KILL_BONUS : 0)) * enemyWeight(game, me, enemy, know) - pickCost('shotgun');
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

/** What a crate is worth to a level that does not look at what is in it. */
const CRATE_WORTH = 15;
/** A health crate for a buddy at full health: over-healing is still a buffer worth having. */
const HEALTH_CRATE_FULL = 10;
/** Extra weight when the heal might be what keeps this buddy in the match. */
const SURVIVAL_BONUS = 25;
/** A weapon crate, plus this much for every special weapon the team has none of. */
const WEAPON_CRATE_BASE = 15;
const WEAPON_CRATE_SHORTAGE = 1.2;
/** Points shaved off per world unit of walking, so a closer crate wins a tie. */
const CRATE_DISTANCE_COST = 0.4;
/** Furthest a crate can be and still be considered. */
const CRATE_REACH = 12;
/** Sampling step and the biggest step up the buddy can walk, for the reachability check. */
const SURFACE_STEP = 0.5;
const MAX_CLIMB = 1;
/** Seconds held back for aiming and firing after a walk. */
const FETCH_MARGIN = 6;
/** Rope fetching: how far it reaches sideways, how far up and down, and how long a trip may take. */
const ROPE_REACH = 26;
const ROPE_CLIMB = 14;
const ROPE_DROP = 10;
const ROPE_ANCHOR_HEIGHT = 16;
const ROPE_FETCH_TIME = 12;
/** What a rope trip costs against simply walking: slower, riskier, and it spends a rope. */
const ROPE_TRIP_COST = 6;
/** A swing is abandoned after this long, whatever it has achieved. */
const SWING_TIMEOUT = 9;
/** Close enough overhead to let go and drop onto the crate. */
const SWING_DROP_RANGE = 1.6;
/** The hook is fired at this angle: steep enough to find a ceiling, flat enough to carry sideways. */
const ROPE_LAUNCH_AIM = 1.15;

/**
 * What walking to this crate is worth. A level without `crates` knowledge treats every crate the
 * same, as before. Otherwise the kind is visible on the map and counts: a health crate is worth
 * most to a buddy that needs the health, and worth a little even at full health because over-healing
 * is allowed. What is inside a weapon crate only shows once it is opened, so it is valued by how
 * thin the team's stock of special weapons is.
 */
function crateValue(game: Game, me: Buddy, crate: Crate, know: AiKnowledge): number {
  if (!know.crates) return CRATE_WORTH;
  if (crate.kind === 'health') {
    const missing = Math.max(0, START_HP - me.hp);
    const heal = HEALTH_CRATE_FULL + (CRATE_HEAL - HEALTH_CRATE_FULL) * Math.min(1, missing / CRATE_HEAL);
    return heal + (me.hp <= CRATE_HEAL ? SURVIVAL_BONUS : 0);
  }
  const stocked = CRATE_WEAPONS.filter((id) => game.teams[me.team].ammo[id] > 0).length;
  return WEAPON_CRATE_BASE + (CRATE_WEAPONS.length - stocked) * WEAPON_CRATE_SHORTAGE;
}

/**
 * Can the buddy walk along the surface from `fromX` to `toX` inside `seconds`? A rough check on the
 * ground profile: no water or empty gap on the way, and no step up too tall to walk. It reads the
 * first rock below the sky, so it does not understand caves; a mistake only costs a wasted walk.
 */
function walkable(game: Game, fromX: number, toX: number, seconds: number): boolean {
  const t = game.terrain;
  if (Math.abs(toX - fromX) / WALK_SPEED > seconds) return false;
  // Never walk into a mine on the way: they set off for their own side just as readily.
  const low = Math.min(fromX, toX) - MINE_TRIGGER_RANGE;
  const high = Math.max(fromX, toX) + MINE_TRIGGER_RANGE;
  if (game.mines.some((m) => m.body.x > low && m.body.x < high)) return false;
  const step = toX > fromX ? SURFACE_STEP : -SURFACE_STEP;
  let y = surfaceAt(t, clamp(fromX, 0, t.width));
  for (let x = fromX + step; (toX - x) * step > 0; x += step) {
    const next = surfaceAt(t, clamp(x, 0, t.width));
    if (next <= t.waterLevel + 0.2 || next - y > MAX_CLIMB) return false;
    y = next;
  }
  return true;
}

/** How a buddy would get to a crate: on its feet, or hanging from the rope. */
export type CrateRoute = 'walk' | 'rope';

/**
 * The crate worth most to this buddy right now, how it would get there, and what the trip is worth.
 *
 * A level that thinks about crates checks it can actually reach one before setting off. Walking is
 * always preferred; where the ground does not allow it — a ledge above, a gap in between, an island
 * of its own — a team with rope left can swing across instead, which is the difference between an
 * AI that collects the crates it happens to be standing next to and one that goes shopping.
 */
function crateGoal(game: Game, me: Buddy, know: AiKnowledge, seconds: number): { crate: Crate; value: number; route: CrateRoute } | null {
  let best: { crate: Crate; value: number; route: CrateRoute } | null = null;
  const roped = know.crates && game.teams[me.team].ammo.rope > 0 && seconds > ROPE_FETCH_TIME;
  for (const c of game.crates) {
    const dx = Math.abs(c.body.x - me.body.x);
    const dy = c.body.y - me.body.y;
    if (!c.body.grounded) continue;
    const onFoot = Math.abs(dy) <= 3 && dx <= CRATE_REACH && (!know.crates || walkable(game, me.body.x, c.body.x, seconds));
    // The rope reaches further and, more to the point, upwards — which walking never does.
    const byRope = !onFoot && roped && dx <= ROPE_REACH && dy > -ROPE_DROP && dy < ROPE_CLIMB && ropeAnchorAbove(game, me, c);
    if (!onFoot && !byRope) continue;
    const route: CrateRoute = onFoot ? 'walk' : 'rope';
    // Swinging is slower and riskier than walking, and it spends a rope.
    const value = crateValue(game, me, c, know) - dx * CRATE_DISTANCE_COST - (route === 'rope' ? ROPE_TRIP_COST : 0);
    if (!best || value > best.value) best = { crate: c, value, route };
  }
  return best;
}

/**
 * Is there rock to hook above the line between the buddy and the crate? A rope needs something
 * overhead to hang from; without this the AI fires hopefully at open sky and falls where it stood.
 */
function ropeAnchorAbove(game: Game, me: Buddy, crate: Crate): boolean {
  const t = game.terrain;
  const midX = (me.body.x + crate.body.x) / 2;
  for (const x of [midX, me.body.x + (crate.body.x - me.body.x) * 0.3, me.body.x]) {
    for (let y = me.body.y + 2; y < me.body.y + ROPE_ANCHOR_HEIGHT; y += 0.5) {
      if (t.isSolid(x, y)) return true;
    }
  }
  return false;
}

/** Drives an AI team through the same commands a human uses. */
export class AiDriver {
  private stage: 'think' | 'fetch' | 'swing' | 'aim' | 'fire' | 'wait' = 'think';
  /** Crate being walked to, and how often this turn the AI already went for one. */
  private fetch: { crate: number; lastX: number; stuck: number } | null = null;
  private fetches = 0;
  private timer = 0;
  private plan: AttackPlan | null = null;
  /** What this team has already used, so the scoring can push it towards something else. */
  private readonly history = new Map<WeaponId, number>();
  /** A crate being swung to on the rope, and the seconds spent trying. */
  private swing: { crate: number; spent: number } | null = null;

  constructor(
    private readonly level: AiLevel,
    private readonly rng: Rng,
  ) {}

  reset(): void {
    this.fetch = null;
    this.swing = null;
    this.fetches = 0;
    this.stage = 'think';
    this.timer = 0;
    this.plan = null;
  }

  /** Home the flying sheep in on the nearest enemy: climb over obstacles first, then dive. */
  private steerFlyer(game: Game, f: Flyer, me: Buddy): void {
    const target = game.buddies
      .filter((b) => b.alive && b.team !== me.team)
      .reduce<Buddy | null>(
        (best, b) => (!best || Math.hypot(b.body.x - f.x, b.body.y - f.y) < Math.hypot(best.body.x - f.x, best.body.y - f.y) ? b : best),
        null,
      );
    if (!target) {
      game.pressFire();
      return;
    }
    const dx = target.body.x - f.x;
    const dy = target.body.y - f.y;
    if (Math.hypot(dx, dy) < 1.5) {
      game.pressFire();
      return;
    }
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

  /**
   * Fly the rope to the crate. Swing towards it, reel in while it is still above, and let go once
   * the buddy is more or less over it so the drop finishes the job. Abandoned after a few seconds
   * however it is going: a traversal that is not working must not eat the turn.
   */
  private steerSwing(game: Game, me: Buddy, dt: number): void {
    const swing = this.swing;
    const crate = swing && game.crates.find((c) => c.id === swing.crate);
    if (!swing || !crate) {
      game.pressFire();
      return;
    }
    swing.spent += dt;
    if (swing.spent > SWING_TIMEOUT) {
      if (game.rope) game.pressFire();
      return;
    }
    const dx = crate.body.x - me.body.x;
    const dy = crate.body.y - me.body.y;
    if (!game.rope) {
      // Between hooks: falling. Let it fall — the crate is collected by touching it.
      return;
    }
    if (Math.abs(dx) < SWING_DROP_RANGE && dy < 0) {
      // Over it and above it: let go and drop onto the crate.
      game.pressFire();
      return;
    }
    const input = game.input;
    input.right = dx > 0;
    input.left = dx < 0;
    // Reel in while the crate is still above, pay out while it is below.
    input.up = dy > 1;
    input.down = dy < -1;
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
      if (game.flyer) this.steerFlyer(game, game.flyer, me);
      else if (this.timer >= (this.plan?.delay ?? 0)) game.pressFire();
      return;
    }
    if (game.phase === 'roping') {
      this.steerSwing(game, me, dt);
      return;
    }
    if (game.phase !== 'aiming') return;

    switch (this.stage) {
      case 'think': {
        if (this.timer < LEVELS[this.level].think) return;
        const midUse = game.shotsLeft < WEAPONS[game.weapon].shots;
        const plan = planAttack(game, me, this.level, this.rng, midUse ? game.weapon : undefined, this.history);
        const goal = midUse ? null : crateGoal(game, me, KNOWLEDGE[this.level], game.turnTimeLeft - FETCH_MARGIN);
        if (goal && goal.value > plan.score && this.fetches < 2 && game.turnTimeLeft > 12) {
          this.fetches++;
          this.timer = 0;
          if (goal.route === 'rope') {
            // Fire the hook up and towards the crate; the swing stage flies the rest of it.
            this.swing = { crate: goal.crate.id, spent: 0 };
            this.stage = 'swing';
            game.selectWeapon('rope');
            game.face(goal.crate.body.x < me.body.x ? -1 : 1);
            me.aim = ROPE_LAUNCH_AIM;
            game.pressFire();
            return;
          }
          this.fetch = { crate: goal.crate.id, lastX: me.body.x, stuck: 0 };
          this.stage = 'fetch';
          return;
        }
        this.plan = plan;
        this.history.set(plan.weapon, (this.history.get(plan.weapon) ?? 0) + 1);
        game.selectWeapon(plan.weapon);
        game.face(plan.facing);
        this.stage = 'aim';
        this.timer = 0;
        return;
      }
      case 'fetch': {
        const f = this.fetch;
        const target = f && game.crates.find((c) => c.id === f.crate);
        if (!f || !target || this.timer > 6) {
          // Picked up, destroyed or out of reach: think again from the new position.
          this.stage = 'think';
          this.timer = LEVELS[this.level].think * 0.5;
          return;
        }
        if (target.body.x < me.body.x) input.left = true;
        else input.right = true;
        f.stuck = Math.abs(me.body.x - f.lastX) < 0.01 ? f.stuck + dt : 0;
        f.lastX = me.body.x;
        if (f.stuck > 0.3) game.jump(false);
        return;
      }
      case 'swing':
        // The hook never bit, or the traversal is over and we are standing again: think afresh.
        this.stage = 'think';
        this.timer = LEVELS[this.level].think * 0.5;
        this.swing = null;
        return;
      case 'aim': {
        const plan = this.plan;
        if (!plan) {
          this.stage = 'think';
          return;
        }
        const diff = plan.aim - me.aim;
        if (Math.abs(diff) > 0.03) {
          if (diff > 0) input.up = true;
          else input.down = true;
          return;
        }
        me.aim = plan.aim;
        if (this.timer < 0.35) return;
        if (plan.target !== undefined) {
          game.setStrikeDir(plan.strikeDir ?? plan.facing);
          game.strike(plan.target);
        } else game.pressFire();
        this.stage = WEAPONS[plan.weapon].charge ? 'fire' : 'wait';
        this.timer = 0;
        return;
      }
      case 'fire':
        if ((game.charge ?? 1) >= (this.plan?.power ?? 0)) game.releaseFire();
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
