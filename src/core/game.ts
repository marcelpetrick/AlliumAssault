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
  WALK_SPEED,
  WATER_LEVEL,
  WIND_ACCEL,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { clamp, lerp, type Point } from './math';
import { createBody, GRAVITY, stepBody, stepProjectile, type Body } from './physics';
import { rngFor, type Rng } from './rng';
import { findSpawnCandidates, generateTerrain, pickSpawns, type Terrain } from './terrain';
import { WEAPON_ORDER, WEAPONS, type WeaponId } from './weapons';

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
  theme: string;
}

export interface GameOverrides {
  terrain?: Terrain;
  spawns?: Point[];
}

export type Phase = 'turnStart' | 'aiming' | 'retreat' | 'settling' | 'deaths' | 'gameOver';

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
}

export type GameEvent =
  | { type: 'turnStart'; team: number; buddy: number }
  | { type: 'weapon'; weapon: WeaponId }
  | { type: 'fire'; weapon: WeaponId; x: number; y: number; dx: number; dy: number; power: number }
  | { type: 'explosion'; x: number; y: number; radius: number }
  | { type: 'shot'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'punch'; buddy: number; x: number; y: number }
  | { type: 'damage'; buddy: number; amount: number }
  | { type: 'death'; buddy: number }
  | { type: 'drown'; buddy: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'jump'; buddy: number }
  | { type: 'land'; buddy: number; speed: number }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'gameOver'; winner: number | null };

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export class Game {
  readonly terrain: Terrain;
  readonly teams: Team[];
  readonly buddies: Buddy[] = [];
  projectiles: Projectile[] = [];
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

    // Interleave teams from left to right: A B C D A B C D ...
    const ordered = [...spawns!].sort((a, b) => a.x - b.x);
    this.teams = config.teams.map((cfg, index) => ({
      index,
      config: cfg,
      buddies: [],
      cursor: 0,
      ammo: Object.fromEntries(WEAPON_ORDER.map((id) => [id, WEAPONS[id].ammo])) as Record<WeaponId, number>,
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

  /** Space pressed: start charging, or fire instantly for non-charge weapons. */
  pressFire(): void {
    const team = this.activeTeamData;
    const def = WEAPONS[this.weapon];
    if (this.phase !== 'aiming' || !this.activeBuddy?.alive || !team || this.charge !== null) return;
    // Ammo is consumed on the first shot, so a multi-shot weapon may finish with zero ammo left.
    const midUse = this.shotsLeft < def.shots;
    if (team.ammo[this.weapon] <= 0 && !midUse) return;
    if (def.charge) this.charge = 0;
    else this.fire(1);
  }

  /** Space released: fire a charging weapon. */
  releaseFire(): void {
    if (this.charge !== null) this.fire(Math.max(this.charge, 0.05));
  }

  skipTurn(): void {
    if (this.phase === 'aiming') this.endTurnEarly();
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  step(dt = 1 / 60): void {
    this.time += dt;
    this.phaseTime += dt;
    const active = this.activeBuddy;

    if (this.controllable && !this.isHumanTurn) this.ai.get(this.activeTeam)?.update(this, dt);

    if (active && this.phase === 'aiming' && this.charge === null) {
      const dir = Number(this.input.up) - Number(this.input.down);
      active.aim = clamp(active.aim + dir * AIM_SPEED * dt, AIM_MIN, AIM_MAX);
    }
    if (this.charge !== null) {
      this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
      if (this.charge >= 1) this.fire(1);
    }

    this.stepBuddies(dt);
    this.stepProjectiles(dt);
    this.stepPhase(dt);
  }

  /** Advance the simulation by `seconds` at the fixed 60 Hz step. */
  simulate(seconds: number): void {
    const steps = Math.round(seconds * 60);
    for (let s = 0; s < steps && this.phase !== 'gameOver'; s++) this.step(1 / 60);
  }

  isSettled(): boolean {
    return this.projectiles.length === 0 && this.buddies.every((b) => !b.alive || b.body.restTime > 0.25);
  }

  private stepBuddies(dt: number): void {
    const active = this.activeBuddy;
    for (const b of this.buddies) {
      if (!b.alive) continue;
      let walk: number | null = null;
      if (b === active && this.controllable && b.body.grounded && this.charge === null && this.input.left !== this.input.right) {
        b.facing = this.input.left ? -1 : 1;
        walk = b.facing * WALK_SPEED;
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
      if (p.bounces > bounces) this.emit({ type: 'bounce', x: p.x, y: p.y });
      if (def.fuse > 0) p.fuse -= dt;
      if (hit === 'terrain' || hit === 'target' || (def.fuse > 0 && p.fuse <= 0)) {
        this.removeProjectile(p);
        this.explode(p.x, p.y, def.radius, def.damage, def.force);
      } else if (hit === 'water' || hit === 'out') {
        this.removeProjectile(p);
        if (hit === 'water') this.emit({ type: 'splash', x: p.x, y: this.terrain.waterLevel });
      }
    }
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
    this.wind = Math.round((this.windRng() * 2 - 1) * this.config.windMax * 20) / 20;
    this.turnTimeLeft = this.config.turnTime;
    this.charge = null;
    const team = this.activeTeamData!;
    if (team.ammo[this.weapon] <= 0) this.weapon = 'bazooka';
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
      this.projectiles.push({
        id: this.nextId++,
        weapon: def.id,
        x: m.x,
        y: m.y,
        vx: dir.x * speed,
        vy: dir.y * speed,
        radius: 0.15,
        bounces: 0,
        fuse: def.fuse,
        age: 0,
        owner: b.id,
      });
    } else if (def.kind === 'melee') {
      this.punch(b, dir);
    } else {
      this.shoot(b, m, dir);
    }

    if (this.shotsLeft <= 0) {
      this.retreatLeft = this.config.retreatTime;
      this.setPhase('retreat');
    }
  }

  private punch(b: Buddy, dir: Point): void {
    const def = WEAPONS.punch;
    const cx = b.body.x + dir.x * def.range;
    const cy = b.body.y + dir.y * def.range;
    this.emit({ type: 'punch', buddy: b.id, x: cx, y: cy });
    for (const t of this.buddies) {
      if (!t.alive || t === b || Math.hypot(t.body.x - cx, t.body.y - cy) > def.range + BUDDY_RADIUS * 0.5) continue;
      t.body.vx = b.facing * def.force * 0.45;
      t.body.vy = def.force;
      t.body.grounded = false;
      t.body.restTime = 0;
      this.damage(t, def.damage);
    }
    this.terrain.carve(cx, cy, def.radius);
  }

  private shoot(b: Buddy, from: Point, dir: Point): void {
    const def = WEAPONS.shotgun;
    for (let d = 0; d <= def.range; d += 0.1) {
      const x = from.x + dir.x * d;
      const y = from.y + dir.y * d;
      const victim = this.buddies.find((t) => t.alive && t !== b && Math.hypot(t.body.x - x, t.body.y - y) < t.body.radius);
      if (victim || this.terrain.isSolid(x, y) || d + 0.1 > def.range) {
        this.emit({ type: 'shot', x0: from.x, y0: from.y, x1: x, y1: y });
        if (victim) {
          victim.body.vx += dir.x * def.force;
          victim.body.vy += dir.y * def.force + 3;
          victim.body.grounded = false;
          victim.body.restTime = 0;
          this.damage(victim, def.damage);
          this.emit({ type: 'explosion', x, y, radius: 0.6 });
        } else if (this.terrain.isSolid(x, y)) {
          this.terrain.carve(x, y, def.radius);
          this.emit({ type: 'explosion', x, y, radius: def.radius });
        }
        return;
      }
    }
  }

  explode(x: number, y: number, radius: number, damage: number, force: number): void {
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
      this.damage(b, Math.round(damage * f));
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
    if (b === this.activeBuddy && (this.phase === 'aiming' || this.phase === 'retreat')) this.endTurnEarly();
  }

  private drown(b: Buddy): void {
    b.alive = false;
    b.hp = 0;
    this.emit({ type: 'drown', buddy: b.id });
    this.emit({ type: 'splash', x: b.body.x, y: this.terrain.waterLevel });
    if (b === this.activeBuddy && (this.phase === 'aiming' || this.phase === 'retreat')) this.endTurnEarly();
  }

  private endTurnEarly(): void {
    this.charge = null;
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
