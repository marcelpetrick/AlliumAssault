// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { AiDriver } from './ai';
import { defined } from './assert';
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
  CRATE_INTRO_TIME,
  WATER_INTRO_TIME,
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
  SUDDEN_DEATH_WATER_RISE,
  WIND_ACCEL,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { clamp, lerp, type Point } from './math';
import { createBody, glideBody, GRAVITY, stepBody, stepProjectile } from './physics';
import { rngFor, type Rng } from './rng';
import { CRATE_BLAST, CRATE_FIRE, CRATE_HEAL, crateLimit, openMystery, cratesPerTurn, DEFAULT_CRATE_CHANCE, rollCrate, type Crate } from './crates';
import { mineSees, MINE_TRIGGER_RANGE, placeMine, stepMine, type Mine } from './mines';
import { FLAME_BITE_INTERVAL, FLAME_BITE_RADIUS, spreadFlames, type Flame } from './fire';
import { FLYER_RADIUS, stepFlyer, type Flyer } from './flyer';
import { releaseSheep, stepSheep, type Sheep } from './sheep';
import { ropePath, shootRope, stepRope, type Rope } from './rope';
import { PLANE_SPEED, planStrike } from './strike';
import { findSpawnCandidates, generateTerrain, pickSpawns, type Platform, type Terrain } from './terrain';
import { WEAPON_IDS, WEAPON_ORDER, WEAPONS, type WeaponDef, type WeaponId } from './weapons';

import {
  ACTION_PHASES,
  COUNTDOWN_PHASES,
  DRILL_BITE,
  DRILL_CARVE_INTERVAL,
  FLAME_FALL_SPEED,
  FLAME_REACH,
  GRAVE_POP,
  GRAVE_RADIUS,
  MAP_WEAPONS,
  PANIC_TIME,
  REST_MAX_WAIT,
  REST_SPEED,
  REST_TIME,
  SCORCH_COOLDOWN,
  SCORCH_DAMAGE,
  SCORCH_HOP,
  SMASH_REBOUND,
  NOZZLE_MAX,
  NOZZLE_MIN,
  NOZZLE_SPEED,
  SUDDEN_DEATH_HP,
  TORCH_CARVE_INTERVAL,
  UPPERCUT_MIN_SIN,
  UPPERCUT_REACH,
  meleeLaunch,
  selfDestructBlast,
  startingAmmo,
  type Buddy,
  type BurstAction,
  type DrillAction,
  type FlamerAction,
  type GameEvent,
  type GameOverrides,
  type Grave,
  type InputState,
  type MatchConfig,
  type Phase,
  type Projectile,
  type Team,
  type TorchAction,
  type TurnAction,
} from './match';

/** Everything a match is made of lives in `match.ts`; `game.ts` stays its single entry point. */
export * from './match';

export class Game {
  readonly terrain: Terrain;
  readonly teams: Team[];
  readonly buddies: Buddy[] = [];
  projectiles: Projectile[] = [];
  /**
   * What the active buddy's weapon is doing after use — a hopping or flying sheep, the blowtorch,
   * the drill or a minigun burst. At most one at a time; null when nothing is in progress.
   */
  action: TurnAction | null = null;
  crates: Crate[] = [];
  /**
   * Mines lying on the map. They belong to the match, not to a turn: they survive every team and
   * round change and are only ever removed by exploding, drowning or leaving the map.
   */
  mines: Mine[] = [];
  /** Tombstones left where buddies died. */
  graves: Grave[] = [];
  /** Burning napalm patches. */
  flames: Flame[] = [];
  /** Game time until which each buddy (by id) is immune to flames after being scorched. */
  private readonly scorchedUntil = new Map<number, number>();
  /** Where each buddy stood before this step, so mine detection can sweep the path it took. */
  private readonly lastBuddyPos = new Map<number, Point>();
  /** Air strike bombs waiting for the plane to reach their release point. */
  drops: { weapon: WeaponId; x: number; y: number; vx: number; at: number; owner: number }[] = [];
  readonly input: InputState = { left: false, right: false, up: false, down: false };

  phase: Phase = 'turnStart';
  phaseTime = 0;
  time = 0;
  turn = 0;
  turnTimeLeft = 0;
  /** Length of the current turn intro; longer when a crate just teleported in. */
  introTime = INTRO_TIME;
  retreatLeft = 0;
  wind = 0;
  activeTeam = -1;
  activeBuddy: Buddy | null = null;
  weapon: WeaponId = 'bazooka';
  /**
   * Side the next air-strike plane comes in from: 1 enters on the left and flies right, -1 enters
   * on the right and flies left. Set from the buddy's facing at the start of every turn and then
   * chosen with Left/Right while a plane-based strike is selected.
   */
  strikeDir: 1 | -1 = 1;
  /** Charge level 0..1 while Space is held, otherwise null. */
  charge: number | null = null;
  shotsLeft = 0;
  winner: number | null = null;
  /** Sudden Death keeps flooding the map until the match ends. */
  waterRising = false;

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
    this.terrain = defined(terrain, 'generated terrain');
    this.terrain.gravityScale = config.gravity ?? 1;
    this.windRng = rngFor(config.seed, 'wind');
    this.crateRng = rngFor(config.seed, 'crates');

    // Interleave teams from left to right: A B C D A B C D ...
    const ordered = [...spawns].sort((a, b) => a.x - b.x);
    this.teams = config.teams.map((cfg, index) => ({
      index,
      config: cfg,
      buddies: [],
      cursor: 0,
      ammo: Object.fromEntries(WEAPON_IDS.map((id) => [id, startingAmmo(config.arsenal, id)])) as Record<WeaponId, number>,
      weapon: 'bazooka',
    }));
    let slot = 0;
    const maxPerTeam = Math.max(...config.teams.map((t) => t.buddyNames.length));
    for (let round = 0; round < maxPerTeam; round++) {
      for (const team of this.teams) {
        const name = team.config.buddyNames.at(round);
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

  /** The released sheep, while it hops. */
  get sheep(): Sheep | null {
    return this.action?.kind === 'sheep' ? this.action.sheep : null;
  }

  /** The rope in play, hook in flight or attached; null when the buddy is between hooks. */
  get rope(): Rope | null {
    return this.action?.kind === 'rope' ? this.action.rope : null;
  }

  /** The whole rope path, anchor first and the buddy last, for the renderer. */
  ropeLine(): Point[] | null {
    const rope = this.rope;
    const b = this.activeBuddy;
    return rope && b ? ropePath(rope, b.body) : null;
  }

  /** The flying sheep, while it flies. */
  get flyer(): Flyer | null {
    return this.action?.kind === 'flyer' ? this.action.flyer : null;
  }

  /** The blowtorch while it burns. */
  get torch(): TorchAction | null {
    return this.action?.kind === 'torch' ? this.action : null;
  }

  /** The drill while it runs. */
  get drill(): DrillAction | null {
    return this.action?.kind === 'drill' ? this.action : null;
  }

  /** The flamethrower while it runs, so the renderer can put the flame at the nozzle. */
  get flamer(): FlamerAction | null {
    return this.action?.kind === 'flamer' ? this.action : null;
  }

  /** The minigun burst while it fires. */
  get burst(): BurstAction | null {
    return this.action?.kind === 'burst' ? this.action : null;
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
    return this.controllable || this.phase === 'guiding' || this.phase === 'torching' || this.phase === 'drilling' || this.phase === 'roping';
  }

  /**
   * The player is lining up a plane-based air strike, so Left and Right choose the approach side
   * instead of walking the buddy.
   */
  get choosingApproach(): boolean {
    const def = WEAPONS[this.weapon];
    return this.phase === 'aiming' && !!this.activeBuddy?.alive && def.kind === 'strike' && !!def.strike?.plane;
  }

  /** The turn timer is running. */
  get countingDown(): boolean {
    return COUNTDOWN_PHASES.includes(this.phase);
  }

  /** The active team is still playing its turn. */
  get activeBuddyInPlay(): boolean {
    return ACTION_PHASES.includes(this.phase);
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

  /** Choose which side the strike plane flies in from; ignored unless one is being aimed. */
  setStrikeDir(dir: 1 | -1): void {
    if (this.choosingApproach) this.strikeDir = dir;
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
      if (team.ammo[id] > 0) {
        this.selectWeapon(id);
        return;
      }
    }
  }

  /** Space pressed: start charging, fire instantly for non-charge weapons, or detonate the sheep. */
  pressFire(): void {
    if (this.phase === 'guiding') {
      this.detonateGuided();
      return;
    }
    if (this.phase === 'roping') {
      this.ropeFire();
      return;
    }
    const team = this.activeTeamData;
    const def = WEAPONS[this.weapon];
    if (this.phase !== 'aiming' || !this.activeBuddy?.alive || !team || this.charge !== null) return;
    // Ammo is consumed on the first shot, so a multi-shot weapon may finish with zero ammo left.
    const midUse = this.shotsLeft < def.shots;
    if ((team.ammo[this.weapon] <= 0 && !midUse) || MAP_WEAPONS.includes(def.kind)) return;
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
    const payload = defined(def.strike, `${def.id} strike payload`);
    const plan = planStrike(this.terrain, def, target, payload.plane ? this.strikeDir : b.facing, this.wind);
    for (const d of plan.drops) this.drops.push({ weapon: payload.weapon, x: d.x, y: plan.altitude, vx: plan.bombVx, at: this.time + d.delay, owner: b.id });
    this.emit({
      type: 'airstrike',
      weapon: def.id,
      plane: payload.plane,
      target,
      ground: plan.ground,
      dir: plan.dir,
      altitude: plan.altitude,
      startX: plan.startX,
      speed: PLANE_SPEED,
    });
    this.startRetreat();
  }

  /**
   * Set a board where the player clicked. A rejected spot — buried in rock, under water, off the
   * map, over-tilted or on top of a body — costs neither the turn nor a use, so the player can
   * simply move the mouse and click again. Returns whether the board was placed.
   */
  placePlatform(platform: Platform): boolean {
    const b = this.activeBuddy;
    const team = this.activeTeamData;
    const def = WEAPONS[this.weapon];
    if (this.phase !== 'aiming' || !b?.alive || !team || def.kind !== 'platform' || team.ammo[def.id] <= 0 || this.charge !== null) return false;
    const occupied = [
      ...this.buddies.filter((buddy) => buddy.alive).map((buddy) => buddy.body),
      ...this.crates.map((c) => c.body),
      ...this.mines.map((m) => m.body),
    ];
    if (!this.terrain.canPlacePlatform(platform, occupied)) return false;
    this.terrain.addPlatform(platform);
    team.ammo[def.id] -= 1;
    this.shotsLeft = 0;
    this.emit({ type: 'platformPlaced', weapon: def.id, ...platform });
    this.startRetreat();
    return true;
  }

  /**
   * Beam the active buddy to the clicked spot. It arrives with no speed and no support, so from
   * that moment ordinary physics has it: it falls, lands hard or drowns like anybody else. A spot
   * inside rock or off the map is refused, and refusing costs neither the turn nor the use.
   */
  teleportTo(x: number, y: number): boolean {
    const b = this.activeBuddy;
    const team = this.activeTeamData;
    const def = WEAPONS[this.weapon];
    if (this.phase !== 'aiming' || !b?.alive || !team || def.kind !== 'teleport' || team.ammo[def.id] <= 0 || this.charge !== null) return false;
    if (!this.canTeleportTo(x, y)) return false;
    const from = { x: b.body.x, y: b.body.y };
    b.body.x = x;
    b.body.y = y;
    b.body.vx = 0;
    b.body.vy = 0;
    b.body.grounded = false;
    b.body.restTime = 0;
    b.body.impact = 0;
    team.ammo[def.id] -= 1;
    this.shotsLeft = 0;
    this.emit({ type: 'teleport', weapon: def.id, buddy: b.id, fromX: from.x, fromY: from.y, x, y });
    this.startRetreat();
    return true;
  }

  /**
   * Whether the active buddy would arrive in one piece at (x, y): inside the map, and with room for
   * its own girth in the rock around it. The renderer asks the same question to colour the cursor,
   * so what the player is shown and what the click does can never disagree.
   */
  canTeleportTo(x: number, y: number): boolean {
    const b = this.activeBuddy;
    if (!b?.alive) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 1 || x > this.terrain.width - 1 || y < 0 || y > this.terrain.height - 1) return false;
    return this.terrain.distance(x, y) >= b.body.radius;
  }

  skipTurn(): void {
    if (this.phase === 'aiming') this.endTurnEarly();
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  step(dt = 1 / 60): void {
    this.time += dt;
    this.phaseTime += dt;
    const active = this.activeBuddy;
    // A buddy that dies during its own turn intro — drowned by the water that just rose, blown up
    // by a mine it was standing on — must not hold the match up: later phases already end the turn
    // through damage() and drown(), but the intro is not one of them.
    if (active && !active.alive && this.phase === 'turnStart') this.endTurnEarly();

    if (this.acting && !this.isHumanTurn) this.ai.get(this.activeTeam)?.update(this, dt);

    if (active && this.phase === 'aiming' && this.charge === null) {
      const dir = Number(this.input.up) - Number(this.input.down);
      active.aim = clamp(active.aim + dir * AIM_SPEED * dt, AIM_MIN, AIM_MAX);
      // Holding both keys leaves the chosen side alone, like holding both walk keys stands still.
      if (this.choosingApproach && this.input.left !== this.input.right) this.strikeDir = this.input.left ? 1 : -1;
    }
    if (this.charge !== null) {
      this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
      if (this.charge >= 1) this.fire(1);
    }

    this.stepBuddies(dt);
    this.stepDrops();
    this.stepProjectiles(dt);
    this.stepAction(dt);
    this.stepCrates(dt);
    this.stepMines(dt);
    this.stepFlames(dt);
    this.stepGraves(dt);
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
      !this.action &&
      this.flames.length === 0 &&
      this.drops.length === 0 &&
      this.crates.every((c) => c.body.restTime > 0.25) &&
      // A mine counting down has to go off first; one lying dormant never holds up a turn.
      this.mines.every((m) => m.state !== 'triggered' && m.body.restTime > 0.25) &&
      this.graves.every((g) => g.body.restTime > 0.25) &&
      this.buddies.every((b) => !b.alive || b.body.restTime > 0.25)
    );
  }

  private stepBuddies(dt: number): void {
    const active = this.activeBuddy;
    for (const b of this.buddies) {
      if (!b.alive) continue;
      // Kept for the mine sweep: where this buddy was before it moved.
      this.lastBuddyPos.set(b.id, { x: b.body.x, y: b.body.y });
      // The rope moves its buddy itself, so the ordinary step would apply gravity a second time.
      if (b === active && this.action?.kind === 'rope' && this.phase === 'roping') continue;
      let walk: number | null = null;
      const torch = b === active ? this.torch : null;
      // Rock ahead of the flame is what the torch pulls itself along; in open air it only walks.
      const biting = torch !== null && this.torchBiting(b, torch);
      if (b === active && this.controllable && !this.choosingApproach && b.body.grounded && this.charge === null && this.input.left !== this.input.right) {
        b.facing = this.input.left ? -1 : 1;
        walk = b.facing * WALK_SPEED;
      } else if (torch && !biting && b.body.grounded) {
        walk = torch.dx * TORCH_SPEED;
      }
      b.walking = walk !== null || biting;
      if (torch && biting) glideBody(this.terrain, b.body, dt, torch.dx * TORCH_SPEED, torch.dy * TORCH_SPEED);
      else stepBody(this.terrain, b.body, dt, walk);
      const cushioned = (b === active && this.drill !== null) || biting;
      this.landing(b, cushioned);
      if (b.body.y < this.terrain.waterLevel - 0.4 || b.body.x < -30 || b.body.x > this.terrain.width + 30) this.drown(b);
    }
  }

  /** Announce a hard landing and hurt the buddy for it, unless whatever it was doing cushions it. */
  private landing(b: Buddy, cushioned: boolean): void {
    if (b.body.impact > 4) this.emit({ type: 'land', buddy: b.id, speed: b.body.impact });
    if (b.body.impact > SAFE_FALL_SPEED && !cushioned) this.damage(b, Math.round((b.body.impact - SAFE_FALL_SPEED) * FALL_DAMAGE_PER_SPEED));
  }

  private stepProjectiles(dt: number): void {
    for (const p of [...this.projectiles]) {
      const def = WEAPONS[p.weapon];
      p.age += dt;
      const bounces = p.bounces;
      // Contact fuses go off on the first thing they touch: a buddy or a supply crate, not just rock.
      const hitTest =
        def.restitution === null
          ? (x: number, y: number) =>
              this.buddies.some((b) => b.alive && (b.id !== p.owner || p.age > 0.3) && Math.hypot(b.body.x - x, b.body.y - y) < b.body.radius + p.radius) ||
              this.crates.some((c) => Math.hypot(c.body.x - x, c.body.y - y) < c.body.radius + p.radius)
          : undefined;
      const pull = -GRAVITY * this.terrain.gravityScale * def.gravityScale;
      const hit = stepProjectile(this.terrain, p, dt, this.wind * WIND_ACCEL * def.windInfluence, pull, def.restitution, hitTest);
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
      if ((hit === 'terrain' || hit === 'target') && def.impacts && p.bounces < def.impacts - 1) {
        // Smash, then keep crashing down through the crater.
        p.bounces++;
        this.explode(p.x, p.y, def.radius, def.damage, def.force);
        p.vx *= 0.3;
        p.vy = SMASH_REBOUND;
      } else if (hit === 'terrain' || hit === 'target' || (ticking && p.fuse <= 0)) {
        this.removeProjectile(p);
        this.explode(p.x, p.y, def.radius, def.damage, def.force, def.flatDamage);
        if (def.cluster) this.scatter(p, def.cluster);
        if (def.napalm) this.ignite(p.x, p.y, def.napalm);
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

  /**
   * A buddy that may still be rewarded: it must exist, be alive and have health left. Deaths are
   * deferred to the death phase, so a buddy already on 0 HP must not be healed back into the match.
   */
  private rewardee(owner: number): Buddy | null {
    return this.buddies.find((b) => b.id === owner && b.alive && b.hp > 0) ?? null;
  }

  /**
   * Collect every crate a sheep swept over on its way from `from` to `to`, in travel order, and
   * credit them to the buddy that launched it. The whole segment is tested rather than the end
   * position alone, so a fast flying sheep cannot cross a crate without touching it. Crates past
   * the point where the sheep stopped are not on the segment, so an earlier terrain hit shields them.
   */
  private sweepCrates(owner: number, from: Point, to: Point, radius: number): void {
    if (!this.crates.length) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    const along = (c: Crate) => (lengthSq === 0 ? 0 : clamp(((c.body.x - from.x) * dx + (c.body.y - from.y) * dy) / lengthSq, 0, 1));
    const touched = this.crates
      .filter((c) => {
        const t = along(c);
        return Math.hypot(from.x + dx * t - c.body.x, from.y + dy * t - c.body.y) < radius + c.body.radius;
      })
      // Travel order, with the crate id breaking ties so the result never depends on array order.
      .sort((a, b) => along(a) - along(b) || a.id - b.id);
    for (const crate of touched) {
      // Re-check: an earlier pickup in this sweep cannot have taken it, but a chain blast can.
      if (!this.crates.includes(crate)) continue;
      const winner = this.rewardee(owner);
      if (!winner) return;
      this.collectCrate(crate, winner);
    }
  }

  /**
   * Mines fall, arm and go off. An armed mine triggers on any living buddy with health left that
   * comes within range and that it has a clear line to — its own team and the buddy that laid it
   * included, once the arming delay is over. Corpses, crates, sheep and tombstones are ignored.
   * Buddy movement is swept, so a fast fall past a mine cannot slip between two frames.
   */
  private stepMines(dt: number): void {
    if (!this.mines.length) return;
    for (const mine of [...this.mines]) {
      if (!this.mines.includes(mine)) continue;
      const triggering = mine.state === 'armed' && this.buddies.some((b) => b.alive && b.hp > 0 && this.nearMine(mine, b));
      const result = stepMine(this.terrain, mine, dt, triggering);
      if (result === 'armed') this.emit({ type: 'mineArmed', mine: mine.id, x: mine.body.x, y: mine.body.y });
      else if (result === 'triggered') this.emit({ type: 'mineTriggered', mine: mine.id, x: mine.body.x, y: mine.body.y });
      else if (result === 'water' || result === 'out') {
        this.removeMine(mine);
        if (result === 'water') this.emit({ type: 'splash', x: mine.body.x, y: this.terrain.waterLevel });
      } else if (result === 'blast') {
        const def = WEAPONS.mine;
        // Out of the list before its own blast, so a chain can never come back round to it.
        this.removeMine(mine);
        this.explode(mine.body.x, mine.body.y, def.radius, def.damage, def.force);
      }
    }
  }

  /** Did this buddy come within trigger range of the mine during the step it just took? */
  private nearMine(mine: Mine, b: Buddy): boolean {
    const from = this.lastBuddyPos.get(b.id) ?? { x: b.body.x, y: b.body.y };
    const dx = b.body.x - from.x;
    const dy = b.body.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : clamp(((mine.body.x - from.x) * dx + (mine.body.y - from.y) * dy) / lengthSq, 0, 1);
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    return Math.hypot(mine.body.x - x, mine.body.y - y) < MINE_TRIGGER_RANGE && mineSees(this.terrain, mine, x, y);
  }

  private removeMine(mine: Mine): void {
    this.mines = this.mines.filter((m) => m !== mine);
  }

  private ignite(x: number, y: number, napalm: NonNullable<WeaponDef['napalm']>): void {
    const flames = spreadFlames(this.terrain, x, y, napalm.flames, napalm.duration, () => this.nextId++);
    this.flames.push(...flames);
    this.emit({ type: 'ignite', x, y, flames: flames.length });
  }

  /** Flames burn down; a buddy touching one takes a little damage and hops away from it. */
  private stepFlames(dt: number): void {
    if (!this.flames.length) return;
    for (const f of this.flames) {
      f.life -= dt;
      // Napalm eats into what it burns on: every bite takes a little rock and the flame sinks
      // into the hollow it made, so a long burn leaves a charred dent rather than a clean surface.
      f.bite -= dt;
      if (f.bite <= 0 && f.bitesLeft > 0) {
        f.bite = FLAME_BITE_INTERVAL;
        f.bitesLeft--;
        this.terrain.carve(f.x, f.y - FLAME_BITE_RADIUS * 0.6, FLAME_BITE_RADIUS);
      }
      // Burning napalm sinks after its ground when that is blasted away.
      if (!this.terrain.isSolid(f.x, f.y - 0.15)) f.y -= FLAME_FALL_SPEED * dt;
    }
    // Burnt-out flames, and flames that sank into the water, go out.
    this.flames = this.flames.filter((f) => f.life > 0 && f.y > this.terrain.waterLevel + 0.1);
    for (const b of this.buddies) {
      if (!b.alive || (this.scorchedUntil.get(b.id) ?? 0) > this.time) continue;
      const flame = this.flames.find((f) => Math.abs(f.x - b.body.x) < FLAME_REACH && Math.abs(f.y - (b.body.y - b.body.radius)) < FLAME_REACH);
      if (!flame) continue;
      this.scorchedUntil.set(b.id, this.time + SCORCH_COOLDOWN);
      const away = b.body.x >= flame.x ? 1 : -1;
      b.body.vx = away * SCORCH_HOP.vx;
      b.body.vy = SCORCH_HOP.vy;
      b.body.grounded = false;
      b.body.restTime = 0;
      this.emit({ type: 'scorch', buddy: b.id, x: b.body.x, y: b.body.y });
      this.damage(b, SCORCH_DAMAGE);
    }
  }

  /**
   * Hand a crate to `b`. The recipient is whoever earned it — a buddy that walked into it, or the
   * buddy that launched the sheep which ran over it, never whichever buddy happens to be active.
   */
  private collectCrate(crate: Crate, b: Buddy): void {
    this.removeCrate(crate);
    const { x, y } = crate.body;
    // A mystery box is opened here, not when it dropped: nothing about the box on the map told
    // anybody what was in it, and the roll comes from the match's own crate stream so a given seed
    // always plays the same joke.
    const prize = crate.kind === 'mystery' ? openMystery(this.crateRng) : null;
    const kind = prize ? prize.kind : crate.kind === 'health' ? 'health' : 'weapon';
    const weapon = prize?.kind === 'weapon' ? prize.weapon : crate.weapon;
    let amount = 1;
    if (kind === 'health') {
      amount = CRATE_HEAL;
      b.hp += amount;
    } else if (kind === 'mine') {
      // The joke: a live mine, armed where the box stood, and the buddy is standing on it.
      const mine = placeMine(this.nextId++, b.id, b.team, x, y, true);
      this.mines.push(mine);
      this.emit({ type: 'mineArmed', mine: mine.id, x, y });
    } else if (weapon) {
      this.teams[b.team].ammo[weapon] += amount;
    }
    this.emit({ type: 'cratePickup', crate: crate.id, buddy: b.id, kind, weapon, amount, x, y, mystery: crate.kind === 'mystery' });
  }

  private removeCrate(crate: Crate): void {
    this.crates = this.crates.filter((c) => c !== crate);
  }

  /** Crates for the turn that is starting; returns how many actually landed. */
  private dropCrates(): number {
    // Special weapons must be findable when the arsenal restricts them to crates.
    const configured = this.config.crates ?? 0;
    const rate = configured > 0 ? configured : this.config.arsenal === 'crates' ? DEFAULT_CRATE_CHANCE : 0;
    if (rate <= 0 || this.turn <= 1) return 0;
    const wanted = cratesPerTurn(rate, this.crateRng);
    const limit = crateLimit(rate);
    let dropped = 0;
    for (let k = 0; k < wanted && this.crates.length < limit; k++) {
      const occupied = [...this.buddies.filter((b) => b.alive).map((b) => b.body), ...this.crates.map((c) => c.body), ...this.graves.map((g) => g.body)];
      const crate = rollCrate(this.terrain, this.crateRng, this.nextId++, occupied);
      if (!crate) break;
      this.crates.push(crate);
      this.emit({ type: 'crateSpawn', crate: crate.id, x: crate.body.x, y: crate.body.y });
      dropped++;
    }
    return dropped;
  }

  /** Advance the weapon action in progress, dropping it if its buddy or phase is gone. */
  private stepAction(dt: number): void {
    const action = this.action;
    if (!action) return;
    const b = this.activeBuddy;
    switch (action.kind) {
      case 'sheep': {
        this.stepSheep(action.sheep, dt);
        return;
      }
      case 'flyer': {
        this.stepFlyer(action.flyer, dt);
        return;
      }
      case 'torch':
        if (b?.alive && this.phase === 'torching') this.stepTorch(action, b, dt);
        else this.action = null;
        return;
      case 'drill':
        if (b?.alive && this.phase === 'drilling') this.stepDrill(action, b, dt);
        else this.action = null;
        return;
      case 'rope':
        if (b?.alive && this.phase === 'roping') this.stepRoping(action, b, dt);
        else this.action = null;
        return;
      case 'burst':
        if (b?.alive && this.phase === 'firing') this.stepBurst(action, b, dt);
        else this.action = null;
        return;
      case 'flamer':
        if (b?.alive && this.phase === 'spraying') this.stepFlamer(action, b, dt);
        else this.action = null;
        return;
      case 'panic':
        // Nothing can stop it now: even a buddy killed mid-panic still takes the hillside with it.
        if (!b) {
          this.action = null;
          return;
        }
        action.left -= dt;
        {
          const seconds = Math.ceil(Math.max(0, action.left));
          if (seconds < action.ticked || action.ticked === 0) {
            action.ticked = seconds;
            this.emit({ type: 'panic', buddy: b.id, seconds });
          }
        }
        if (action.left <= 0) this.detonateBuddy(b);
        return;
    }
  }

  /** True while the flame still has rock just beyond its tip — there the torch carries the buddy. */
  private torchBiting(b: Buddy, torch: TorchAction): boolean {
    const def = WEAPONS.torch;
    const reach = def.range + def.radius;
    return this.terrain.isSolid(b.body.x + torch.dx * reach, b.body.y + torch.dy * reach);
  }

  private stepTorch(torch: TorchAction, b: Buddy, dt: number): void {
    const def = WEAPONS.torch;
    torch.left -= dt;
    torch.carveIn -= dt;
    if (torch.carveIn <= 0) {
      torch.carveIn = TORCH_CARVE_INTERVAL;
      const ahead = def.range - 0.35;
      // Centred on the burn line. While the buddy walks rather than rides the flame, the disc is
      // lifted so the tunnel floor stays level with the feet instead of digging it into the ground.
      const lift = this.torchBiting(b, torch) ? 0 : def.radius - b.body.radius;
      this.terrain.carve(b.body.x + torch.dx * ahead, b.body.y + torch.dy * ahead + lift, def.radius);
    }
    const fx = b.body.x + torch.dx * def.range;
    const fy = b.body.y + torch.dy * def.range;
    for (const t of this.buddies) {
      if (!t.alive || t === b || torch.burnt.includes(t.id) || Math.hypot(t.body.x - fx, t.body.y - fy) > def.radius + t.body.radius) continue;
      torch.burnt.push(t.id);
      t.body.vx = torch.dx * def.force;
      // Always a lofted shove, so a downward burn does not just press the victim into the ground.
      t.body.vy = Math.max(torch.dy * def.force, def.force * 0.5);
      t.body.grounded = false;
      t.body.restTime = 0;
      this.damage(t, def.damage);
    }
    if (torch.left <= 0) {
      this.action = null;
      this.startRetreat();
    }
  }

  private stepDrill(drill: DrillAction, b: Buddy, dt: number): void {
    const def = WEAPONS.drill;
    drill.left -= dt;
    drill.carveIn -= dt;
    if (drill.carveIn <= 0) {
      drill.carveIn = DRILL_CARVE_INTERVAL;
      // A disc reaching a little below the feet: the buddy sinks into the shaft under gravity.
      this.terrain.carve(b.body.x, b.body.y - b.body.radius - DRILL_BITE + def.radius, def.radius);
    }
    const tipY = b.body.y - b.body.radius - DRILL_BITE;
    for (const t of this.buddies) {
      if (!t.alive || t === b || drill.hit.includes(t.id) || Math.hypot(t.body.x - b.body.x, t.body.y - tipY) > def.radius + t.body.radius) continue;
      drill.hit.push(t.id);
      t.body.vx = (t.body.x < b.body.x ? -1 : 1) * def.force;
      t.body.vy = def.force * 0.4;
      t.body.grounded = false;
      t.body.restTime = 0;
      this.damage(t, def.damage);
    }
    if (drill.left <= 0) {
      this.action = null;
      this.startRetreat();
    }
  }

  private stepBurst(burst: BurstAction, b: Buddy, dt: number): void {
    const def = WEAPONS[burst.weapon];
    const { count, interval, spread } = defined(def.burst, `${def.id} burst`);
    burst.next -= dt;
    // A bullet can end the turn (e.g. knocking the shooter's own buddy), which drops the action.
    while (burst.next <= 0 && burst.left > 0 && this.action === burst) {
      burst.next += interval;
      // A fixed wobble pattern keeps bursts deterministic.
      const k = count - burst.left;
      const wobble = [0, 1, -1, 0.5, -0.5][k % 5] * spread;
      const angle = b.aim + wobble;
      const dir = { x: Math.cos(angle) * b.facing, y: Math.sin(angle) };
      burst.left--;
      this.shoot(b, def, { x: b.body.x + dir.x * MUZZLE_OFFSET, y: b.body.y + dir.y * MUZZLE_OFFSET }, dir);
    }
    if (this.action === burst && burst.left <= 0) {
      this.action = null;
      this.startRetreat();
    }
  }

  /**
   * One frame of the flamethrower. The nozzle swings with up and down while it runs — this is the
   * whole point of the weapon: you sweep it, and the ground it passes over goes on burning. Each
   * gob is an ordinary projectile with a heavy wind influence, so the fuel drifts and falls and the
   * carpet it lays is never quite where the nozzle was pointing.
   */
  private stepFlamer(flamer: FlamerAction, b: Buddy, dt: number): void {
    const def = WEAPONS[flamer.weapon];
    const spray = defined(def.spray, `${def.id} spray`);
    flamer.left -= dt;
    // The nozzle, not the buddy's aim: the aim stays where the shot was taken from.
    const steer = Number(this.input.up) - Number(this.input.down);
    flamer.aim = clamp(flamer.aim + steer * NOZZLE_SPEED * dt, NOZZLE_MIN, NOZZLE_MAX);
    b.aim = clamp(flamer.aim, AIM_MIN, AIM_MAX);
    flamer.next -= dt;
    while (flamer.next <= 0 && flamer.left > 0 && this.action === flamer) {
      flamer.next += spray.interval;
      // A fixed wobble, so a given sweep sprays the same way twice.
      const wobble = [0, 1, -1, 0.6, -0.6, 0.3, -0.3][flamer.emitted % 7] * spray.spread;
      const angle = flamer.aim + wobble;
      const dir = { x: Math.cos(angle) * b.facing, y: Math.sin(angle) };
      flamer.emitted++;
      const from = { x: b.body.x + dir.x * MUZZLE_OFFSET, y: b.body.y + dir.y * MUZZLE_OFFSET };
      this.spawnProjectile(spray.weapon, from.x, from.y, dir.x * spray.speed, dir.y * spray.speed, b.id);
    }
    if (this.action === flamer && flamer.left <= 0) {
      this.action = null;
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

  private stepSheep(s: Sheep, dt: number): void {
    const from = { x: s.body.x, y: s.body.y };
    const result = stepSheep(this.terrain, s, dt);
    // Crates on the way are picked up for the launcher; touching one never sets the sheep off.
    this.sweepCrates(s.owner, from, { x: s.body.x, y: s.body.y }, s.body.radius);
    if (result === 'hop') this.emit({ type: 'sheepHop', x: s.body.x, y: s.body.y });
    if (result === 'water' || result === 'out') {
      this.action = null;
      if (result === 'water') this.emit({ type: 'splash', x: s.body.x, y: this.terrain.waterLevel });
      if (this.phase === 'guiding') this.startRetreat();
    } else if (s.age >= WEAPONS.sheep.fuse) {
      this.detonateGuided();
    }
  }

  private stepFlyer(f: Flyer, dt: number): void {
    // The arrow keys point where the sheep should fly, relative to the screen.
    const i = this.input;
    const steer = this.phase === 'guiding' ? { x: Number(i.right) - Number(i.left), y: Number(i.up) - Number(i.down) } : { x: 0, y: 0 };
    const from = { x: f.x, y: f.y };
    const result = stepFlyer(this.terrain, f, dt, steer, (x, y) =>
      this.buddies.some((b) => b.alive && (b.id !== f.owner || f.age > 0.4) && Math.hypot(b.body.x - x, b.body.y - y) < b.body.radius + FLYER_RADIUS),
    );
    // Along the path it really flew, so a crate it crossed at full speed still counts, and one
    // behind the rock it crashed into does not. A crate never triggers the sheep.
    this.sweepCrates(f.owner, from, { x: f.x, y: f.y }, FLYER_RADIUS);
    if (result === 'water' || result === 'out') {
      this.action = null;
      if (result === 'water') this.emit({ type: 'splash', x: f.x, y: this.terrain.waterLevel });
      if (this.phase === 'guiding') this.startRetreat();
    } else if (result === 'hit' || f.age >= WEAPONS.flysheep.fuse) {
      this.detonateGuided();
    }
  }

  /**
   * Space while roping. Hanging on the rope it lets go, keeping every bit of momentum; between
   * hooks it fires a fresh one along the aim, so a traversal can be strung together in mid-air.
   */
  private ropeFire(): void {
    const action = this.action;
    const b = this.activeBuddy;
    if (action?.kind !== 'rope' || !b?.alive) return;
    if (action.rope) {
      action.rope = null;
      this.emit({ type: 'ropeRelease', buddy: b.id });
      return;
    }
    const dir = this.aimDirection(b);
    const m = this.muzzle(b);
    action.rope = shootRope(b.id, m.x, m.y, dir.x, dir.y, action.paid);
    this.emit({ type: 'ropeShot', buddy: b.id, x: m.x, y: m.y });
  }

  /**
   * One frame of rope traversal. While a hook flies or bites, the rope moves the buddy and the
   * ordinary buddy step leaves it alone, so gravity is never applied twice. Between hooks the buddy
   * simply falls; once it lands the traversal is over and the turn goes back to aiming, with the
   * timer still running, so the player can still take a shot.
   */
  private stepRoping(action: { kind: 'rope'; rope: Rope | null; paid: boolean }, b: Buddy, dt: number): void {
    const rope = action.rope;
    if (!rope) {
      // Let go: an ordinary fall, fall damage and all. The rope itself takes the shock while it is
      // attached, so only what happens after the release hurts.
      stepBody(this.terrain, b.body, dt, null);
      this.landing(b, false);
      if (b.body.grounded && b.body.restTime > 0.2) this.endRoping();
      this.checkRopeBounds(b);
      return;
    }
    const i = this.input;
    const reel = Number(i.down) - Number(i.up);
    const swing = Number(i.right) - Number(i.left);
    const before = rope.state;
    const result = stepRope(this.terrain, rope, b.body, dt, reel, swing);
    if (result === 'attached' && before === 'flying') {
      this.emit({ type: 'ropeBite', buddy: b.id, x: rope.hook.x, y: rope.hook.y });
      // The use is spent now, not when the hook was fired: a miss costs nothing.
      if (!action.paid) {
        action.paid = true;
        rope.paid = true;
        const team = this.activeTeamData;
        if (team) team.ammo.rope = Math.max(0, team.ammo.rope - 1);
      }
    } else if (result === 'missed' || result === 'detached') {
      action.rope = null;
      if (result === 'detached') this.emit({ type: 'ropeRelease', buddy: b.id });
    }
    this.checkRopeBounds(b);
  }

  /**
   * The ordinary buddy step is skipped during a traversal, so the water and the map edges have to
   * be checked here too — otherwise a buddy that let go over the sea would fall for ever.
   */
  private checkRopeBounds(b: Buddy): void {
    if (b.body.y < this.terrain.waterLevel - 0.4 || b.body.x < -30 || b.body.x > this.terrain.width + 30) {
      this.action = null;
      this.drown(b);
    }
  }

  /** Back to ordinary control after a rope traversal, with the turn timer still running. */
  private endRoping(): void {
    this.action = null;
    if (this.phase === 'roping') this.setPhase('aiming');
  }

  /** Blow up whatever is being guided: the hopping or the flying sheep. */
  private detonateGuided(): void {
    const guided = this.action;
    if (guided?.kind !== 'sheep' && guided?.kind !== 'flyer') return;
    this.action = null;
    // Enter retreat first: if the blast hurts the active buddy, damage() ends the turn from there.
    if (this.phase === 'guiding') this.startRetreat();
    const at = guided.kind === 'sheep' ? guided.sheep.body : guided.flyer;
    const def = guided.kind === 'sheep' ? WEAPONS.sheep : WEAPONS.flysheep;
    this.explode(at.x, at.y, def.radius, def.damage, def.force);
  }

  private startRetreat(): void {
    this.retreatLeft = this.config.retreatTime;
    this.setPhase('retreat');
  }

  private stepPhase(dt: number): void {
    switch (this.phase) {
      case 'turnStart':
        if (this.phaseTime >= this.introTime) this.setPhase('aiming');
        break;
      case 'aiming':
        this.turnTimeLeft -= dt;
        if (this.turnTimeLeft <= 0) this.endTurnEarly();
        break;
      case 'guiding':
        this.turnTimeLeft -= dt;
        if (this.turnTimeLeft <= 0) this.detonateGuided();
        break;
      case 'torching':
      case 'drilling':
      case 'spraying':
        this.turnTimeLeft -= dt;
        if (this.turnTimeLeft <= 0) this.endTurnEarly();
        break;
      case 'roping':
        this.turnTimeLeft -= dt;
        // Out of time: the rope lets go and the buddy falls where it is, like any other tool.
        if (this.turnTimeLeft <= 0) {
          this.action = null;
          this.endTurnEarly();
        }
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
            this.raiseGrave(doomed);
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

  /**
   * Sudden Death: on the configured turn every living buddy drops to 1 HP and the water starts
   * climbing. It strikes once per match, and 1 rather than 0 keeps it out of the death phase:
   * nobody dies from the strike itself.
   * Returns true when it struck, so the turn can announce it after the usual turn banner.
   */
  private checkSuddenDeath(): boolean {
    const at = this.config.suddenDeath ?? 0;
    if (at <= 0 || this.turn !== at) return false;
    for (const b of this.buddies) {
      if (b.alive) b.hp = SUDDEN_DEATH_HP;
    }
    this.waterRising = true;
    return true;
  }

  /**
   * The flood climbs one step per turn, not per second: a player who sits out the whole turn timer
   * must not drown the others faster than one who plays it. The strike turn itself stays dry, so
   * the announcement and the first rise do not land together. Returns whether the water moved, so
   * the turn intro can give the camera time to show it.
   */
  private raiseWater(): boolean {
    if (!this.waterRising) return false;
    const before = this.terrain.waterLevel;
    this.terrain.waterLevel = Math.min(this.terrain.height - 1, before + SUDDEN_DEATH_WATER_RISE);
    if (this.terrain.waterLevel === before) return false;
    // Announced at the active buddy, which is where the camera is about to look anyway.
    this.emit({ type: 'waterRise', level: this.terrain.waterLevel, x: this.activeBuddy?.body.x ?? this.terrain.width / 2 });
    return true;
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
    const flooded = this.raiseWater();
    const suddenDeath = this.checkSuddenDeath();
    this.introTime = INTRO_TIME + (this.dropCrates() > 0 ? CRATE_INTRO_TIME : 0) + (flooded ? WATER_INTRO_TIME : 0);
    this.wind = Math.round((this.windRng() * 2 - 1) * this.config.windMax * 20) / 20;
    this.turnTimeLeft = this.config.turnTime;
    this.charge = null;
    this.action = null;
    this.drops = [];
    this.flames = [];
    const team = defined(this.activeTeamData, 'active team');
    this.weapon = team.ammo[team.weapon] > 0 ? team.weapon : 'bazooka';
    this.shotsLeft = WEAPONS[this.weapon].shots;
    this.strikeDir = defined(this.activeBuddy, 'active buddy').facing;
    Object.assign(this.input, { left: false, right: false, up: false, down: false });
    this.ai.get(this.activeTeam)?.reset();
    this.setPhase('turnStart');
    this.emit({ type: 'turnStart', team: this.activeTeam, buddy: defined(this.activeBuddy, 'active buddy').id });
    // Announced after the turn banner so its own banner is the one that stays on screen.
    if (suddenDeath) this.emit({ type: 'suddenDeath', turn: this.turn });
  }

  private fire(power: number): void {
    const b = this.activeBuddy;
    const team = this.activeTeamData;
    this.charge = null;
    if (!b || !team || this.phase !== 'aiming') return;
    const def = WEAPONS[this.weapon];
    // A rope only costs a use once its hook actually bites, so a miss is free.
    if (this.shotsLeft === def.shots && def.kind !== 'rope') team.ammo[def.id] -= 1;
    this.shotsLeft--;

    const dir = this.aimDirection(b);
    const m = this.muzzle(b);
    this.emit({ type: 'fire', weapon: def.id, x: m.x, y: m.y, dx: dir.x, dy: dir.y, power });

    if (def.kind === 'projectile') {
      const speed = lerp(def.minSpeed, def.maxSpeed, power);
      this.spawnProjectile(def.id, m.x, m.y, dir.x * speed, dir.y * speed, b.id);
    } else if (def.kind === 'flyer') {
      this.action = { kind: 'flyer', flyer: { id: this.nextId++, owner: b.id, x: m.x, y: m.y, angle: Math.atan2(dir.y, dir.x), age: 0 } };
      this.setPhase('guiding');
      return;
    } else if (def.kind === 'walker') {
      this.action = { kind: 'sheep', sheep: releaseSheep(this.nextId++, b.id, b.body.x, b.body.y, b.facing) };
      this.setPhase('guiding');
      return;
    } else if (def.burst) {
      this.action = { kind: 'burst', weapon: def.id, left: def.burst.count, next: 0 };
      this.setPhase('firing');
      return;
    } else if (def.kind === 'drill') {
      this.action = { kind: 'drill', left: def.fuse, carveIn: 0, hit: [] };
      this.setPhase('drilling');
      return;
    } else if (def.kind === 'flamer') {
      this.action = { kind: 'flamer', weapon: def.id, left: def.fuse, next: 0, aim: b.aim, emitted: 0 };
      this.setPhase('spraying');
      return;
    } else if (def.kind === 'torch') {
      this.action = { kind: 'torch', dx: dir.x, dy: dir.y, left: def.fuse, carveIn: 0, burnt: [] };
      this.setPhase('torching');
      return;
    } else if (def.kind === 'rope') {
      // A utility, not the turn's shot: the buddy may still fire a weapon once it has landed.
      this.shotsLeft = def.shots;
      this.action = { kind: 'rope', rope: shootRope(b.id, m.x, m.y, dir.x, dir.y, false), paid: false };
      this.emit({ type: 'ropeShot', buddy: b.id, x: m.x, y: m.y });
      this.setPhase('roping');
      return;
    } else if (def.kind === 'mine') {
      const mine = placeMine(this.nextId++, b.id, b.team, b.body.x + b.facing * 0.5, b.body.y);
      this.mines.push(mine);
      this.emit({ type: 'mineLaid', mine: mine.id, buddy: b.id, x: mine.body.x, y: mine.body.y });
      this.startRetreat();
      return;
    } else if (def.kind === 'self') {
      this.selfDestruct(b);
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
      const v = speed * (0.85 + (0.3 * ((k * 7) % count)) / count);
      const p = this.spawnProjectile(cluster.weapon, from.x, from.y + 0.3, Math.cos(angle) * v, Math.sin(angle) * v, from.owner);
      if (p.fuse > 0) p.fuse += k * (cluster.stagger ?? 0);
    }
  }

  private spawnProjectile(weapon: WeaponId, x: number, y: number, vx: number, vy: number, owner: number): Projectile {
    const p: Projectile = { id: this.nextId++, weapon, x, y, vx, vy, radius: 0.15, bounces: 0, fuse: WEAPONS[weapon].fuse, age: 0, owner };
    this.projectiles.push(p);
    return p;
  }

  /** Press the detonator: the buddy panics, and PANIC_TIME later it takes the hillside with it. */
  private selfDestruct(b: Buddy): void {
    this.action = { kind: 'panic', buddy: b.id, left: PANIC_TIME, ticked: 0 };
    this.setPhase('panicking');
    this.emit({ type: 'panic', buddy: b.id, seconds: Math.ceil(PANIC_TIME) });
  }

  /** The blast itself, once the countdown has run out or the buddy was killed mid-panic. */
  private detonateBuddy(b: Buddy): void {
    const blast = selfDestructBlast(WEAPONS.selfdestruct, b.hp);
    b.alive = false;
    b.hp = 0;
    this.action = null;
    this.emit({ type: 'death', buddy: b.id });
    this.explode(b.body.x, b.body.y, blast.radius, blast.damage, blast.force);
    this.raiseGrave(b);
    this.endTurnEarly();
  }

  /** A tombstone pops up where a buddy died (drowned buddies sink without one). */
  private raiseGrave(b: Buddy): void {
    const body = createBody(b.body.x, b.body.y + 0.3, GRAVE_RADIUS);
    body.vy = GRAVE_POP;
    const grave: Grave = { id: this.nextId++, buddy: b.id, team: b.team, name: b.name, body };
    this.graves.push(grave);
    this.emit({ type: 'grave', grave: grave.id, buddy: b.id, x: body.x, y: body.y });
  }

  private stepGraves(dt: number): void {
    if (!this.graves.length) return;
    for (const g of this.graves) stepBody(this.terrain, g.body, dt, null);
    const sunk = this.graves.filter((g) => g.body.y < this.terrain.waterLevel - 0.3 || g.body.x < -30 || g.body.x > this.terrain.width + 30);
    for (const g of sunk) if (g.body.y < this.terrain.waterLevel) this.emit({ type: 'splash', x: g.body.x, y: this.terrain.waterLevel });
    if (sunk.length) this.graves = this.graves.filter((g) => !sunk.includes(g));
  }

  private melee(b: Buddy, def: WeaponDef, dir: Point): void {
    const cx = b.body.x + dir.x * def.range;
    const cy = b.body.y + dir.y * def.range;
    // Who is in reach is decided before anything is announced, so the swing's own event can say
    // whether it connected — the crowd only roars for a bat that actually sent somebody flying.
    const victims = this.buddies.filter((t) => t.alive && t !== b && Math.hypot(t.body.x - cx, t.body.y - cy) <= def.range + BUDDY_RADIUS * 0.5);
    this.emit({ type: 'punch', weapon: def.id, buddy: b.id, x: cx, y: cy, dx: dir.x, dy: dir.y, hit: victims.length > 0 });
    for (const t of victims) {
      const v = meleeLaunch(def, b.facing, dir);
      t.body.vx = v.x;
      t.body.vy = v.y;
      t.body.grounded = false;
      t.body.restTime = 0;
      this.damage(t, def.damage);
    }
    this.meleeCarve(b, def, dir, cx, cy);
  }

  /**
   * What a melee weapon does to the rock. A flat swing takes a bite where it lands; a punch thrown
   * steeply upwards drives a shaft through the ceiling instead, so a buddy boxed in under a ledge
   * can knock its own way out rather than being stuck with a weapon that cannot reach.
   */
  private meleeCarve(b: Buddy, def: WeaponDef, dir: Point, cx: number, cy: number): void {
    if (def.radius <= 0) return;
    if (def.knock === 'uppercut' && dir.y > UPPERCUT_MIN_SIN) {
      // Discs along the aim, from just above the head to the full reach, so the hole is a shaft.
      for (let d = b.body.radius; d <= def.range + UPPERCUT_REACH; d += def.radius * 0.5) {
        this.terrain.carve(b.body.x + dir.x * d, b.body.y + dir.y * d, def.radius * 0.8);
      }
      return;
    }
    this.terrain.carve(cx, cy, def.radius);
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
    // Tombstones get knocked around like buddies, without taking damage.
    for (const g of this.graves) {
      const dx = g.body.x - x;
      const dy = g.body.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist >= radius + g.body.radius) continue;
      const f = 1 - Math.max(0, dist - g.body.radius) / radius;
      g.body.vx += (dist > 1e-3 ? dx / dist : 0) * force * f;
      g.body.vy += (dist > 1e-3 ? dy / dist : 1) * force * f + force * 0.35 * f;
      g.body.grounded = false;
      g.body.restTime = 0;
    }
    for (const crate of this.crates.filter((c) => Math.hypot(c.body.x - x, c.body.y - y) < radius + c.body.radius)) {
      // A chained blast may already have taken it; remove it before its own blast so it cannot recurse.
      if (!this.crates.includes(crate)) continue;
      const { x: cx, y: cy } = crate.body;
      this.removeCrate(crate);
      this.explode(cx, cy, CRATE_BLAST.radius, CRATE_BLAST.damage, CRATE_BLAST.force);
      // Whatever was in it is burning now — briefly, and only where there is ground to burn on.
      this.ignite(cx, cy, CRATE_FIRE);
    }
    // Mines go off the same way, in id order, each one out of the list before its own blast.
    for (const mine of [...this.mines].sort((a, b) => a.id - b.id)) {
      if (!this.mines.includes(mine) || Math.hypot(mine.body.x - x, mine.body.y - y) >= radius + mine.body.radius) continue;
      const def = WEAPONS.mine;
      this.removeMine(mine);
      this.explode(mine.body.x, mine.body.y, def.radius, def.damage, def.force);
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
    if (b === this.activeBuddy && this.activeBuddyInPlay) this.endTurnEarly();
  }

  private drown(b: Buddy): void {
    b.alive = false;
    b.hp = 0;
    this.emit({ type: 'drown', buddy: b.id });
    this.emit({ type: 'splash', x: b.body.x, y: this.terrain.waterLevel });
    if (b === this.activeBuddy && this.activeBuddyInPlay) this.endTurnEarly();
  }

  private endTurnEarly(): void {
    this.charge = null;
    // A guided sheep goes off; torch, drill and bursts simply stop.
    this.detonateGuided();
    this.action = null;
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
