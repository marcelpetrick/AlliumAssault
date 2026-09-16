import { AiDriver } from './ai';
import {
  AIM_MAX,
  AIM_MIN,
  AIM_SPEED,
  BACKFLIP,
  BUDDY_RADIUS,
  CHARGE_TIME,
  DEATH_BLAST,
  DEATH_DELAY,
  FALL_DAMAGE_PER_SPEED,
  INTRO_TIME,
  JUMP,
  MUZZLE_OFFSET,
  SAFE_FALL_SPEED,
  SETTLE_MAX,
  SETTLE_MIN,
  START_HP,
  TORCH_SPEED,
  WALK_SPEED,
  WATER_LEVEL,
  WIND_ACCEL,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { clamp, lerp, type Point } from './math';
import { createBody, GRAVITY, stepBody, stepProjectile, type Body } from './physics';
import { rngFor, type Rng } from './rng';
import { CRATE_BLAST, CRATE_HEAL, MAX_CRATES, rollCrate, type Crate } from './crates';
import { releaseSheep, stepSheep, type Sheep } from './sheep';
import { PLANE_SPEED, planStrike } from './strike';
import { findSpawnCandidates, generateTerrain, pickSpawns, type Terrain } from './terrain';
import { WEAPON_IDS, WEAPON_ORDER, WEAPONS, type WeaponDef, type WeaponId } from './weapons';

export type Controller = 'human' | 'ai';
export type AiLevel = 'easy' | 'normal' | 'hard';

export interface TeamConfig {
  name: string;
  color: string;
  controller: Controller;
  aiLevel: AiLevel;
  buddyNames: string[];
}

export interface MatchConfig {
  seed: string;
  teams: TeamConfig[];
  turnTime: number;
  retreatTime: number;
  /** Maximum wind strength, 0..1. */
  windMax: number;
  /** Chance per turn (0..1) that a crate teleports onto the map; missing means no crates. */
  crates?: number;
  theme: string;
}

export interface GameOverrides {
  terrain?: Terrain;
  spawns?: Point[];
}

/**
 * `guiding`: a released sheep is hopping; the turn timer runs and Space detonates it.
 * `torching`: the active buddy walks forward burning a tunnel; no other input.
 * `firing`: a burst weapon is rattling off its bullets; no other input.
 */
export type Phase = 'turnStart' | 'aiming' | 'guiding' | 'torching' | 'firing' | 'retreat' | 'settling' | 'deaths' | 'gameOver';

export interface Buddy {
  id: number;
  team: number;
  name: string;
  body: Body;
  hp: number;
  alive: boolean;
  facing: 1 | -1;
  /** Radians above the horizontal in the facing direction. */
  aim: number;
  walking: boolean;
}

export interface Team {
  index: number;
  config: TeamConfig;
  buddies: Buddy[];
  cursor: number;
  ammo: Record<WeaponId, number>;
  /** Weapon this team last selected; restored at the start of its turns. */
  weapon: WeaponId;
}

export interface Projectile {
  id: number;
  weapon: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounces: number;
  fuse: number;
  age: number;
  owner: number;
  /** Seconds spent (almost) motionless, for weapons that detonate after coming to rest. */
  rest?: number;
  /** A rest-fuse weapon has come to rest and its fuse is counting down. */
  armed?: boolean;
}

export type GameEvent =
  | { type: 'turnStart'; team: number; buddy: number }
  | { type: 'weapon'; weapon: WeaponId }
  | { type: 'fire'; weapon: WeaponId; x: number; y: number; dx: number; dy: number; power: number }
  | { type: 'explosion'; x: number; y: number; radius: number }
  | { type: 'shot'; weapon: WeaponId; x0: number; y0: number; x1: number; y1: number }
  | { type: 'punch'; weapon: WeaponId; buddy: number; x: number; y: number; dx: number; dy: number }
  | { type: 'damage'; buddy: number; amount: number }
  | { type: 'death'; buddy: number }
  | { type: 'drown'; buddy: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'jump'; buddy: number }
  | { type: 'land'; buddy: number; speed: number }
  | { type: 'bounce'; x: number; y: number; speed: number }
  | { type: 'sheepHop'; x: number; y: number }
  | { type: 'hallelujah'; x: number; y: number }
  | { type: 'crateSpawn'; crate: number; x: number; y: number }
  | { type: 'cratePickup'; crate: number; buddy: number; kind: 'health' | 'weapon'; weapon: WeaponId | null; amount: number }
  | { type: 'airstrike'; target: number; ground: number; dir: 1 | -1; altitude: number; startX: number; speed: number }
  | { type: 'gameOver'; winner: number | null };

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** Blast of a self-destructing buddy with `hp` health; scales the weapon's 100 HP values. */
export function selfDestructBlast(def: WeaponDef, hp: number): { radius: number; damage: number; force: number } {
  const k = Math.max(hp, 0) / 100;
  return { radius: Math.max(1.5, def.radius * k), damage: Math.round(def.damage * k), force: def.force * Math.max(k, 0.3) };
}

/** A rest-fuse projectile slower than this for REST_TIME seconds counts as resting. */
export const REST_SPEED = 0.6;
export const REST_TIME = 0.3;
/** Rest-fuse projectiles arm after this long even if they never settle. */
const REST_MAX_WAIT = 10;

/** Seconds between two tunnel carves of the blowtorch. */
const TORCH_CARVE_INTERVAL = 0.08;

/** Lowest launch angle of a swing, radians above horizontal. */
const MIN_SWING_ANGLE = 0.35;

/** Velocity a melee hit gives its victim. */
export function meleeLaunch(def: WeaponDef, facing: 1 | -1, dir: Point): Point {
  if (def.knock === 'swing') {
    // Always a lofted drive: swinging down into the ground would just stop the victim.
    const angle = Math.max(Math.atan2(dir.y, Math.abs(dir.x)), MIN_SWING_ANGLE);
    return { x: facing * Math.cos(angle) * def.force, y: Math.sin(angle) * def.force };
  }
  return { x: facing * def.force * 0.45, y: def.force };
}

export class Game {
  readonly terrain: Terrain;
  readonly teams: Team[];
  readonly buddies: Buddy[] = [];
  projectiles: Projectile[] = [];
  /** The released sheep, while it hops. */
  sheep: Sheep | null = null;
  crates: Crate[] = [];
  /** Burst weapon firing: bullets left and seconds until the next one. */
  burst: { weapon: WeaponId; left: number; next: number } | null = null;
  /** Blowtorch in use: seconds left and buddies already burnt this use. */
  torch: { left: number; carveIn: number; burnt: number[] } | null = null;
  /** Air strike bombs waiting for the plane to reach their release point. */
  drops: { weapon: WeaponId; x: number; y: number; vx: number; at: number; owner: number }[] = [];
  readonly input: InputState = { left: false, right: false, up: false, down: false };

  phase: Phase = 'turnStart';
  phaseTime = 0;
  time = 0;
  turn = 0;
  turnTimeLeft = 0;
  retreatLeft = 0;
  wind = 0;
  activeTeam = -1;
  activeBuddy: Buddy | null = null;
  weapon: WeaponId = 'bazooka';
  /** Charge level 0..1 while Space is held, otherwise null. */
  charge: number | null = null;
  shotsLeft = 0;
  winner: number | null = null;

  private events: GameEvent[] = [];
  private readonly windRng: Rng;
  private readonly crateRng: Rng;
  private readonly ai = new Map<number, AiDriver>();
  private nextId = 1;

  constructor(
    readonly config: MatchConfig,
    overrides: GameOverrides = {},
  ) {
    const total = config.teams.reduce((n, t) => n + t.buddyNames.length, 0);
    let terrain = overrides.terrain;
    let spawns = overrides.spawns;
    for (let attempt = 0; !terrain || !spawns || spawns.length < total; attempt++) {
      const seed = attempt === 0 ? config.seed : `${config.seed}#${attempt}`;
      terrain = overrides.terrain ?? generateTerrain({ seed, width: WORLD_WIDTH, height: WORLD_HEIGHT, waterLevel: WATER_LEVEL });
      spawns = pickSpawns(findSpawnCandidates(terrain, BUDDY_RADIUS), total, rngFor(seed, 'spawns'));
      if (attempt >= 8 || overrides.terrain) break;
    }
    this.terrain = terrain!;
    this.windRng = rngFor(config.seed, 'wind');
    this.crateRng = rngFor(config.seed, 'crates');

    // Interleave teams from left to right: A B C D A B C D ...
    const ordered = [...spawns!].sort((a, b) => a.x - b.x);
    this.teams = config.teams.map((cfg, index) => ({
      index,
      config: cfg,
      buddies: [],
      cursor: 0,
      ammo: Object.fromEntries(WEAPON_IDS.map((id) => [id, WEAPONS[id].ammo])) as Record<WeaponId, number>,
      weapon: 'bazooka' as WeaponId,
    }));
    let slot = 0;
    const maxPerTeam = Math.max(...config.teams.map((t) => t.buddyNames.length));
    for (let round = 0; round < maxPerTeam; round++) {
      for (const team of this.teams) {
        const name = team.config.buddyNames[round];
        if (name === undefined) continue;
        const spot = ordered[slot++ % Math.max(ordered.length, 1)] ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
        const buddy: Buddy = {
          id: this.nextId++,
          team: team.index,
          name,
          body: createBody(spot.x, spot.y, BUDDY_RADIUS),
          hp: START_HP,
          alive: true,
          facing: spot.x < WORLD_WIDTH / 2 ? 1 : -1,
          aim: 0.5,
          walking: false,
        };
        team.buddies.push(buddy);
        this.buddies.push(buddy);
      }
    }
    for (const team of this.teams) {
      if (team.config.controller === 'ai') this.ai.set(team.index, new AiDriver(team.config.aiLevel, rngFor(config.seed, `ai${team.index}`)));
    }
    this.beginTurn();
  }

  get activeTeamData(): Team | null {
    return this.teams[this.activeTeam] ?? null;
  }

  get isHumanTurn(): boolean {
    return this.activeTeamData?.config.controller === 'human';
  }

  get controllable(): boolean {
    return (this.phase === 'aiming' || this.phase === 'retreat') && !!this.activeBuddy?.alive;
  }

  /** The active team still acts this turn: controlling its buddy or guiding its sheep. */
  get acting(): boolean {
    return this.controllable || this.phase === 'guiding' || this.phase === 'torching';
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  aimDirection(b: Buddy): Point {
    return { x: Math.cos(b.aim) * b.facing, y: Math.sin(b.aim) };
  }

  muzzle(b: Buddy): Point {
    const d = this.aimDirection(b);
    return { x: b.body.x + d.x * MUZZLE_OFFSET, y: b.body.y + d.y * MUZZLE_OFFSET };
  }

  // ── Commands ────────────────────────────────────────────────────────────

  jump(back = false): void {
    const b = this.activeBuddy;
    if (!b || !this.controllable || !b.body.grounded || this.charge !== null) return;
    const j = back ? BACKFLIP : JUMP;
    b.body.vx = j.vx * b.facing;
    b.body.vy = j.vy;
    b.body.grounded = false;
    this.emit({ type: 'jump', buddy: b.id });
  }

  face(dir: 1 | -1): void {
    if (this.activeBuddy && this.controllable) this.activeBuddy.facing = dir;
  }

  selectWeapon(id: WeaponId): void {
    const team = this.activeTeamData;
    if (this.phase !== 'aiming' && this.phase !== 'turnStart') return;
    if (!team || this.charge !== null || this.shotsLeft < WEAPONS[this.weapon].shots || team.ammo[id] <= 0) return;
    this.weapon = id;
    team.weapon = id;
    this.shotsLeft = WEAPONS[id].shots;
    this.emit({ type: 'weapon', weapon: id });
  }

  cycleWeapon(): void {
    const team = this.activeTeamData;
    if (!team) return;
    const start = WEAPON_ORDER.indexOf(this.weapon);
    for (let k = 1; k <= WEAPON_ORDER.length; k++) {
      const id = WEAPON_ORDER[(start + k) % WEAPON_ORDER.length];
      if (team.ammo[id] > 0) return this.selectWeapon(id);
    }
  }

  /** Space pressed: start charging, fire instantly for non-charge weapons, or detonate the sheep. */
  pressFire(): void {
    if (this.phase === 'guiding') return this.detonateSheep();
    const team = this.activeTeamData;
    const def = WEAPONS[this.weapon];
    if (this.phase !== 'aiming' || !this.activeBuddy?.alive || !team || this.charge !== null) return;
    // Ammo is consumed on the first shot, so a multi-shot weapon may finish with zero ammo left.
    const midUse = this.shotsLeft < def.shots;
    if ((team.ammo[this.weapon] <= 0 && !midUse) || def.kind === 'strike') return;
    if (def.charge) this.charge = 0;
    else this.fire(1);
  }

  /** Space released: fire a charging weapon. */
  releaseFire(): void {
    if (this.charge !== null) this.fire(Math.max(this.charge, 0.05));
  }

  /** Drop a charge without firing (pause, lost focus). */
  cancelCharge(): void {
    this.charge = null;
  }

  /** Call the selected air strike onto world position x; the plane flies in the buddy's facing direction. */
  strike(x: number): void {
    const b = this.activeBuddy;
    const team = this.activeTeamData;
    const def = WEAPONS[this.weapon];
    if (this.phase !== 'aiming' || !b?.alive || !team || def.kind !== 'strike' || team.ammo[def.id] <= 0 || this.charge !== null) return;
    const target = clamp(x, 0, this.terrain.width);
    team.ammo[def.id] -= 1;
    this.shotsLeft = 0;
    const plan = planStrike(this.terrain, def, target, b.facing, this.wind);
    for (const d of plan.drops) this.drops.push({ weapon: def.strike!.weapon, x: d.x, y: plan.altitude, vx: plan.bombVx, at: this.time + d.delay, owner: b.id });
    this.emit({ type: 'airstrike', target, ground: plan.ground, dir: plan.dir, altitude: plan.altitude, startX: plan.startX, speed: PLANE_SPEED });
    this.startRetreat();
  }

  skipTurn(): void {
    if (this.phase === 'aiming') this.endTurnEarly();
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  step(dt = 1 / 60): void {
    this.time += dt;
    this.phaseTime += dt;
    const active = this.activeBuddy;

    if (this.acting && !this.isHumanTurn) this.ai.get(this.activeTeam)?.update(this, dt);

    if (active && this.phase === 'aiming' && this.charge === null) {
      const dir = Number(this.input.up) - Number(this.input.down);
      active.aim = clamp(active.aim + dir * AIM_SPEED * dt, AIM_MIN, AIM_MAX);
    }
    if (this.charge !== null) {
      this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
      if (this.charge >= 1) this.fire(1);
    }

    this.stepBuddies(dt);
    this.stepDrops();
    this.stepProjectiles(dt);
    this.stepSheep(dt);
    this.stepTorch(dt);
    this.stepBurst(dt);
    this.stepCrates(dt);
    this.stepPhase(dt);
  }

  /** Advance the simulation by `seconds` at the fixed 60 Hz step. */
  simulate(seconds: number): void {
    const steps = Math.round(seconds * 60);
    for (let s = 0; s < steps && this.phase !== 'gameOver'; s++) this.step(1 / 60);
  }

  isSettled(): boolean {
    return (
      this.projectiles.length === 0 &&
      !this.sheep &&
      this.drops.length === 0 &&
      this.crates.every((c) => c.body.restTime > 0.25) &&
      this.buddies.every((b) => !b.alive || b.body.restTime > 0.25)
    );
  }

  private stepBuddies(dt: number): void {
    const active = this.activeBuddy;
    for (const b of this.buddies) {
      if (!b.alive) continue;
      let walk: number | null = null;
      if (b === active && this.controllable && b.body.grounded && this.charge === null && this.input.left !== this.input.right) {
        b.facing = this.input.left ? -1 : 1;
        walk = b.facing * WALK_SPEED;
      } else if (b === active && this.torch && b.body.grounded) {
        // Only walks with ground underneath: the torch never lifts the buddy.
        walk = b.facing * TORCH_SPEED;
      }
      b.walking = walk !== null;
      stepBody(this.terrain, b.body, dt, walk);
      if (b.body.impact > 4) this.emit({ type: 'land', buddy: b.id, speed: b.body.impact });
      if (b.body.impact > SAFE_FALL_SPEED) this.damage(b, Math.round((b.body.impact - SAFE_FALL_SPEED) * FALL_DAMAGE_PER_SPEED));
      if (b.body.y < this.terrain.waterLevel - 0.4 || b.body.x < -30 || b.body.x > this.terrain.width + 30) this.drown(b);
    }
  }

  private stepProjectiles(dt: number): void {
    for (const p of [...this.projectiles]) {
      const def = WEAPONS[p.weapon];
      p.age += dt;
      const bounces = p.bounces;
      const hitTest =
        def.restitution === null
          ? (x: number, y: number) =>
              this.buddies.some((b) => b.alive && (b.id !== p.owner || p.age > 0.3) && Math.hypot(b.body.x - x, b.body.y - y) < b.body.radius + p.radius)
          : undefined;
      const hit = stepProjectile(this.terrain, p, dt, this.wind * WIND_ACCEL * def.windInfluence, -GRAVITY * def.gravityScale, def.restitution, hitTest);
      if (p.bounces > bounces) this.emit({ type: 'bounce', x: p.x, y: p.y, speed: Math.hypot(p.vx, p.vy) });
      if (def.restFuse !== undefined && !p.armed) {
        p.rest = Math.hypot(p.vx, p.vy) < REST_SPEED ? (p.rest ?? 0) + dt : 0;
        if (p.rest >= REST_TIME || p.age > REST_MAX_WAIT) {
          p.armed = true;
          p.fuse = def.restFuse;
          this.emit({ type: 'hallelujah', x: p.x, y: p.y });
        }
      }
      const ticking = def.fuse > 0 || !!p.armed;
      if (ticking) p.fuse -= dt;
      if (hit === 'terrain' || hit === 'target' || (ticking && p.fuse <= 0)) {
        this.removeProjectile(p);
        this.explode(p.x, p.y, def.radius, def.damage, def.force, def.flatDamage);
        if (def.cluster) this.scatter(p, def.cluster);
      } else if (hit === 'water' || hit === 'out') {
        this.removeProjectile(p);
        if (hit === 'water') this.emit({ type: 'splash', x: p.x, y: this.terrain.waterLevel });
      }
    }
  }

  private stepCrates(dt: number): void {
    for (const crate of [...this.crates]) {
      stepBody(this.terrain, crate.body, dt, null);
      const { x, y } = crate.body;
      if (y < this.terrain.waterLevel - 0.3 || x < -30 || x > this.terrain.width + 30) {
        this.removeCrate(crate);
        if (y < this.terrain.waterLevel) this.emit({ type: 'splash', x, y: this.terrain.waterLevel });
        continue;
      }
      const finder = this.buddies.find((b) => b.alive && Math.hypot(b.body.x - x, b.body.y - y) < b.body.radius + crate.body.radius + 0.1);
      if (finder) this.collectCrate(crate, finder);
    }
  }

  private collectCrate(crate: Crate, b: Buddy): void {
    this.removeCrate(crate);
    let amount = 1;
    if (crate.kind === 'health') {
      amount = CRATE_HEAL;
      b.hp += amount;
    } else if (crate.weapon) {
      this.teams[b.team].ammo[crate.weapon] += amount;
    }
    this.emit({ type: 'cratePickup', crate: crate.id, buddy: b.id, kind: crate.kind, weapon: crate.weapon, amount });
  }

  private removeCrate(crate: Crate): void {
    this.crates = this.crates.filter((c) => c !== crate);
  }

  /** At a turn start, maybe teleport a new crate onto a free land spot. */
  private maybeDropCrate(): void {
    const chance = this.config.crates ?? 0;
    if (chance <= 0 || this.turn <= 1 || this.crates.length >= MAX_CRATES || this.crateRng() >= chance) return;
    const occupied = [...this.buddies.filter((b) => b.alive).map((b) => b.body), ...this.crates.map((c) => c.body)];
    const crate = rollCrate(this.terrain, this.crateRng, this.nextId++, occupied);
    if (!crate) return;
    this.crates.push(crate);
    this.emit({ type: 'crateSpawn', crate: crate.id, x: crate.body.x, y: crate.body.y });
  }

  private stepTorch(dt: number): void {
    const torch = this.torch;
    const b = this.activeBuddy;
    if (!torch) return;
    if (!b?.alive || this.phase !== 'torching') {
      this.torch = null;
      return;
    }
    const def = WEAPONS.torch;
    torch.left -= dt;
    torch.carveIn -= dt;
    if (torch.carveIn <= 0) {
      torch.carveIn = TORCH_CARVE_INTERVAL;
      // Burn a disc ahead whose bottom is level with the feet, so the tunnel stays horizontal.
      this.terrain.carve(b.body.x + b.facing * (def.range - 0.35), b.body.y + (def.radius - b.body.radius), def.radius);
    }
    const fx = b.body.x + b.facing * def.range;
    for (const t of this.buddies) {
      if (!t.alive || t === b || torch.burnt.includes(t.id) || Math.hypot(t.body.x - fx, t.body.y - b.body.y) > def.radius + t.body.radius) continue;
      torch.burnt.push(t.id);
      t.body.vx = b.facing * def.force;
      t.body.vy = def.force * 0.5;
      t.body.grounded = false;
      t.body.restTime = 0;
      this.damage(t, def.damage);
    }
    if (torch.left <= 0) {
      this.torch = null;
      this.startRetreat();
    }
  }

  private stepBurst(dt: number): void {
    const burst = this.burst;
    const b = this.activeBuddy;
    if (!burst) return;
    if (!b?.alive || this.phase !== 'firing') {
      this.burst = null;
      return;
    }
    const def = WEAPONS[burst.weapon];
    const { count, interval, spread } = def.burst!;
    burst.next -= dt;
    while (burst.next <= 0 && burst.left > 0 && this.burst) {
      burst.next += interval;
      // A fixed wobble pattern keeps bursts deterministic.
      const k = count - burst.left;
      const wobble = [0, 1, -1, 0.5, -0.5][k % 5] * spread;
      const angle = b.aim + wobble;
      const dir = { x: Math.cos(angle) * b.facing, y: Math.sin(angle) };
      burst.left--;
      this.shoot(b, def, { x: b.body.x + dir.x * MUZZLE_OFFSET, y: b.body.y + dir.y * MUZZLE_OFFSET }, dir);
    }
    if (this.burst && burst.left <= 0) {
      this.burst = null;
      this.startRetreat();
    }
  }

  private stepDrops(): void {
    if (!this.drops.length) return;
    this.drops = this.drops.filter((d) => {
      if (d.at > this.time) return true;
      this.spawnProjectile(d.weapon, d.x, d.y, d.vx, 0, d.owner);
      return false;
    });
  }

  private stepSheep(dt: number): void {
    const s = this.sheep;
    if (!s) return;
    const result = stepSheep(this.terrain, s, dt);
    if (result === 'hop') this.emit({ type: 'sheepHop', x: s.body.x, y: s.body.y });
    if (result === 'water' || result === 'out') {
      this.sheep = null;
      if (result === 'water') this.emit({ type: 'splash', x: s.body.x, y: this.terrain.waterLevel });
      if (this.phase === 'guiding') this.startRetreat();
    } else if (s.age >= WEAPONS.sheep.fuse) {
      this.detonateSheep();
    }
  }

  private detonateSheep(): void {
    const s = this.sheep;
    if (!s) return;
    this.sheep = null;
    // Enter retreat first: if the blast hurts the active buddy, damage() ends the turn from there.
    if (this.phase === 'guiding') this.startRetreat();
    const def = WEAPONS.sheep;
    this.explode(s.body.x, s.body.y, def.radius, def.damage, def.force);
  }

  private startRetreat(): void {
    this.retreatLeft = this.config.retreatTime;
    this.setPhase('retreat');
  }

  private stepPhase(dt: number): void {
    switch (this.phase) {
      case 'turnStart':
        if (this.phaseTime >= INTRO_TIME) this.setPhase('aiming');
        break;
      case 'aiming':
        this.turnTimeLeft -= dt;
        if (this.turnTimeLeft <= 0) this.endTurnEarly();
        break;
      case 'guiding':
        this.turnTimeLeft -= dt;
        if (this.turnTimeLeft <= 0) this.detonateSheep();
        break;
      case 'torching':
        this.turnTimeLeft -= dt;
        if (this.turnTimeLeft <= 0) this.endTurnEarly();
        break;
      case 'retreat':
        this.retreatLeft -= dt;
        if (this.retreatLeft <= 0) this.setPhase('settling');
        break;
      case 'settling':
        if ((this.phaseTime >= SETTLE_MIN && this.isSettled()) || this.phaseTime >= SETTLE_MAX) this.setPhase('deaths');
        break;
      case 'deaths': {
        const doomed = this.buddies.find((b) => b.alive && b.hp <= 0);
        if (doomed) {
          if (this.phaseTime >= DEATH_DELAY) {
            doomed.alive = false;
            this.emit({ type: 'death', buddy: doomed.id });
            this.explode(doomed.body.x, doomed.body.y, DEATH_BLAST.radius, DEATH_BLAST.damage, DEATH_BLAST.force);
            this.setPhase('settling');
          }
          break;
        }
        const standing = this.teams.filter((t) => t.buddies.some((b) => b.alive));
        if (standing.length <= 1) {
          this.winner = standing[0]?.index ?? null;
          this.setPhase('gameOver');
          this.emit({ type: 'gameOver', winner: this.winner });
        } else {
          this.beginTurn();
        }
        break;
      }
      case 'gameOver':
        break;
    }
  }

  private beginTurn(): void {
    const count = this.teams.length;
    for (let k = 1; k <= count; k++) {
      const team = this.teams[(this.activeTeam + k + count) % count];
      const living = team.buddies.filter((b) => b.alive);
      if (!living.length) continue;
      for (let m = 0; m < team.buddies.length; m++) {
        const idx = (team.cursor + m) % team.buddies.length;
        if (team.buddies[idx].alive) {
          this.activeBuddy = team.buddies[idx];
          team.cursor = idx + 1;
          break;
        }
      }
      this.activeTeam = team.index;
      break;
    }
    this.turn++;
    this.maybeDropCrate();
    this.wind = Math.round((this.windRng() * 2 - 1) * this.config.windMax * 20) / 20;
    this.turnTimeLeft = this.config.turnTime;
    this.charge = null;
    this.sheep = null;
    this.torch = null;
    this.burst = null;
    this.drops = [];
    const team = this.activeTeamData!;
    this.weapon = team.ammo[team.weapon] > 0 ? team.weapon : 'bazooka';
    this.shotsLeft = WEAPONS[this.weapon].shots;
    Object.assign(this.input, { left: false, right: false, up: false, down: false });
    this.ai.get(this.activeTeam)?.reset();
    this.setPhase('turnStart');
    this.emit({ type: 'turnStart', team: this.activeTeam, buddy: this.activeBuddy!.id });
  }

  private fire(power: number): void {
    const b = this.activeBuddy;
    const team = this.activeTeamData;
    this.charge = null;
    if (!b || !team || this.phase !== 'aiming') return;
    const def = WEAPONS[this.weapon];
    if (this.shotsLeft === def.shots) team.ammo[def.id] -= 1;
    this.shotsLeft--;

    const dir = this.aimDirection(b);
    const m = this.muzzle(b);
    this.emit({ type: 'fire', weapon: def.id, x: m.x, y: m.y, dx: dir.x, dy: dir.y, power });

    if (def.kind === 'projectile') {
      const speed = lerp(def.minSpeed, def.maxSpeed, power);
      this.spawnProjectile(def.id, m.x, m.y, dir.x * speed, dir.y * speed, b.id);
    } else if (def.kind === 'walker') {
      this.sheep = releaseSheep(this.nextId++, b.id, b.body.x, b.body.y, b.facing);
      this.setPhase('guiding');
      return;
    } else if (def.burst) {
      this.burst = { weapon: def.id, left: def.burst.count, next: 0 };
      this.setPhase('firing');
      return;
    } else if (def.kind === 'torch') {
      this.torch = { left: def.fuse, carveIn: 0, burnt: [] };
      this.setPhase('torching');
      return;
    } else if (def.kind === 'self') {
      this.selfDestruct(b, def);
      return;
    } else if (def.kind === 'melee') {
      this.melee(b, def, dir);
    } else {
      this.shoot(b, def, m, dir);
    }

    if (this.shotsLeft <= 0) this.startRetreat();
  }

  /** Throw cluster fragments upwards in a fan from an exploded projectile. */
  private scatter(from: Projectile, cluster: NonNullable<WeaponDef['cluster']>): void {
    const { count, speed } = cluster;
    for (let k = 0; k < count; k++) {
      const spread = count > 1 ? k / (count - 1) - 0.5 : 0;
      const angle = Math.PI / 2 + spread * 1.9;
      const v = speed * (0.85 + 0.3 * ((k * 7) % count) / count);
      const p = this.spawnProjectile(cluster.weapon, from.x, from.y + 0.3, Math.cos(angle) * v, Math.sin(angle) * v, from.owner);
      if (p.fuse > 0) p.fuse += k * (cluster.stagger ?? 0);
    }
  }

  private spawnProjectile(weapon: WeaponId, x: number, y: number, vx: number, vy: number, owner: number): Projectile {
    const p: Projectile = { id: this.nextId++, weapon, x, y, vx, vy, radius: 0.15, bounces: 0, fuse: WEAPONS[weapon].fuse, age: 0, owner };
    this.projectiles.push(p);
    return p;
  }

  /** The buddy explodes: damage equals its health and the blast radius grows with it. */
  private selfDestruct(b: Buddy, def: WeaponDef): void {
    const blast = selfDestructBlast(def, b.hp);
    b.alive = false;
    b.hp = 0;
    this.emit({ type: 'death', buddy: b.id });
    this.explode(b.body.x, b.body.y, blast.radius, blast.damage, blast.force);
    this.endTurnEarly();
  }

  private melee(b: Buddy, def: WeaponDef, dir: Point): void {
    const cx = b.body.x + dir.x * def.range;
    const cy = b.body.y + dir.y * def.range;
    this.emit({ type: 'punch', weapon: def.id, buddy: b.id, x: cx, y: cy, dx: dir.x, dy: dir.y });
    for (const t of this.buddies) {
      if (!t.alive || t === b || Math.hypot(t.body.x - cx, t.body.y - cy) > def.range + BUDDY_RADIUS * 0.5) continue;
      const v = meleeLaunch(def, b.facing, dir);
      t.body.vx = v.x;
      t.body.vy = v.y;
      t.body.grounded = false;
      t.body.restTime = 0;
      this.damage(t, def.damage);
    }
    if (def.radius > 0) this.terrain.carve(cx, cy, def.radius);
  }

  private shoot(b: Buddy, def: WeaponDef, from: Point, dir: Point): void {
    for (let d = 0; d <= def.range; d += 0.1) {
      const x = from.x + dir.x * d;
      const y = from.y + dir.y * d;
      const victim = this.buddies.find((t) => t.alive && t !== b && Math.hypot(t.body.x - x, t.body.y - y) < t.body.radius);
      if (victim || this.terrain.isSolid(x, y) || d + 0.1 > def.range) {
        this.emit({ type: 'shot', weapon: def.id, x0: from.x, y0: from.y, x1: x, y1: y });
        if (victim) {
          victim.body.vx += dir.x * def.force;
          victim.body.vy += dir.y * def.force + (def.lift ?? 0);
          victim.body.grounded = false;
          victim.body.restTime = 0;
          this.damage(victim, def.damage);
          this.emit({ type: 'explosion', x, y, radius: Math.min(def.radius, 0.6) });
        } else if (this.terrain.isSolid(x, y)) {
          this.terrain.carve(x, y, def.radius);
          this.emit({ type: 'explosion', x, y, radius: def.radius });
        }
        return;
      }
    }
  }

  explode(x: number, y: number, radius: number, damage: number, force: number, flatDamage = false): void {
    this.terrain.carve(x, y, radius);
    this.emit({ type: 'explosion', x, y, radius });
    for (const b of this.buddies) {
      if (!b.alive) continue;
      const dx = b.body.x - x;
      const dy = b.body.y - y;
      const dist = Math.hypot(dx, dy);
      const reach = Math.max(0, dist - b.body.radius * 0.5);
      if (reach >= radius) continue;
      const f = 1 - reach / radius;
      const nx = dist > 1e-3 ? dx / dist : 0;
      const ny = dist > 1e-3 ? dy / dist : 1;
      b.body.vx += nx * force * f;
      b.body.vy += ny * force * f + force * 0.35 * f;
      b.body.grounded = false;
      b.body.restTime = 0;
      this.damage(b, flatDamage ? damage : Math.round(damage * f));
    }
    for (const crate of this.crates.filter((c) => Math.hypot(c.body.x - x, c.body.y - y) < radius + c.body.radius)) {
      // A chained blast may already have taken it; remove it before its own blast so it cannot recurse.
      if (!this.crates.includes(crate)) continue;
      this.removeCrate(crate);
      this.explode(crate.body.x, crate.body.y, CRATE_BLAST.radius, CRATE_BLAST.damage, CRATE_BLAST.force);
    }
    for (const p of this.projectiles) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < radius * 1.5) {
        p.vx += ((p.x - x) / (dist || 1)) * force * 0.5;
        p.vy += force * 0.4;
      }
    }
  }

  private damage(b: Buddy, amount: number): void {
    if (amount <= 0 || !b.alive) return;
    b.hp = Math.max(0, b.hp - amount);
    this.emit({ type: 'damage', buddy: b.id, amount });
    if (b === this.activeBuddy && (this.phase === 'aiming' || this.phase === 'guiding' || this.phase === 'torching' || this.phase === 'firing' || this.phase === 'retreat')) this.endTurnEarly();
  }

  private drown(b: Buddy): void {
    b.alive = false;
    b.hp = 0;
    this.emit({ type: 'drown', buddy: b.id });
    this.emit({ type: 'splash', x: b.body.x, y: this.terrain.waterLevel });
    if (b === this.activeBuddy && (this.phase === 'aiming' || this.phase === 'guiding' || this.phase === 'torching' || this.phase === 'firing' || this.phase === 'retreat')) this.endTurnEarly();
  }

  private endTurnEarly(): void {
    this.charge = null;
    this.torch = null;
    this.burst = null;
    this.detonateSheep();
    this.setPhase('settling');
  }

  private removeProjectile(p: Projectile): void {
    this.projectiles = this.projectiles.filter((q) => q !== p);
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private emit(e: GameEvent): void {
    this.events.push(e);
  }
}
