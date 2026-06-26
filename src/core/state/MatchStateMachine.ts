import type { Command } from '../simulation/Commands';
import type { SimEvent } from '../simulation/Events';
import type { Team } from '../entities/Team';
import {
  getActiveCharacter,
  advanceActiveCharacter,
  consumeWeapon,
  isTeamAlive,
} from '../entities/Team';
import type { Projectile } from '../entities/Projectile';
import { createProjectile } from '../entities/Projectile';
import type { CollisionMask } from '../terrain/CollisionMask';
import { stepCharacter, type PhysicsInput } from '../physics/CharacterPhysics';
import { stepProjectile } from '../physics/ProjectilePhysics';
import { explode } from '../physics/ExplosionSystem';
import { weaponRegistry } from '../weapons/WeaponRegistry';
import type { MatchPhase, Vec2 } from '../types';
import { vec2Length } from '../types';

export type TurnState =
  | 'TURN_INTRO'
  | 'MOVEMENT'
  | 'WEAPON_SELECTION'
  | 'AIMING'
  | 'WEAPON_EXECUTION'
  | 'RETREAT'
  | 'WORLD_SETTLING'
  | 'DAMAGE_PRESENTATION'
  | 'DEATH_SEQUENCES'
  | 'VICTORY_CHECK'
  | 'NEXT_TEAM';

export interface MatchState {
  phase: MatchPhase;
  turnState: TurnState;
  activeTeamIndex: number;
  teams: Team[];
  projectiles: Projectile[];
  terrain: CollisionMask;
  waterLevel: number;
  wind: Vec2;
  turnDuration: number;
  turnTimeRemaining: number;
  retreatTimeRemaining: number;
  settlingTicksStable: number;
  settlingElapsed: number;
  selectedWeaponId: string | null;
  aimAngle: number;
  chargePower: number;
  isCharging: boolean;
  pendingDamages: Array<{ characterId: string; damage: number; impulse: Vec2 }>;
  pendingDeaths: string[];
  winnerId: string | null;
  turnCount: number;
  stateTimer: number; // generic timer for pauses
  moveLeft: boolean;
  moveRight: number;
  jumpQueued: boolean;
}

const TURN_INTRO_DURATION = 0.5;
const DAMAGE_PRESENTATION_DURATION = 0.8;
const MAX_SETTLE_TIME = 10;
const SETTLE_STABLE_TICKS = 10;
const MAX_AIM_ANGLE = 1.48; // ~85 degrees
const POWER_CHARGE_RATE = 0.5; // 0→1 in 2 seconds

let projectileIdCounter = 0;
function nextProjectileId(): string {
  return `proj_${++projectileIdCounter}`;
}

export class MatchStateMachine {
  private state: MatchState;
  private readonly windRng: () => number;

  constructor(initialState: MatchState, windRng: () => number) {
    this.state = initialState;
    this.windRng = windRng;
  }

  getState(): Readonly<MatchState> {
    return this.state;
  }

  update(dt: number, commands: Command[]): SimEvent[] {
    const events: SimEvent[] = [];

    switch (this.state.turnState) {
      case 'TURN_INTRO':
        this.updateTurnIntro(dt, events);
        break;
      case 'MOVEMENT':
        this.updateMovement(dt, commands, events);
        break;
      case 'AIMING':
        this.updateAiming(dt, commands, events);
        break;
      case 'WEAPON_EXECUTION':
        this.updateWeaponExecution(dt, events);
        break;
      case 'RETREAT':
        this.updateRetreat(dt, commands, events);
        break;
      case 'WORLD_SETTLING':
        this.updateWorldSettling(dt, events);
        break;
      case 'DAMAGE_PRESENTATION':
        this.updateDamagePresentation(dt, events);
        break;
      case 'DEATH_SEQUENCES':
        this.updateDeathSequences(events);
        break;
      case 'VICTORY_CHECK':
        this.updateVictoryCheck(events);
        break;
      case 'NEXT_TEAM':
        this.updateNextTeam(events);
        break;
    }

    return events;
  }

  private updateTurnIntro(dt: number, events: SimEvent[]): void {
    if (this.state.stateTimer === 0) {
      // Emit TurnStarted on first tick of TURN_INTRO
      this.pickNewWind(events);
      const team = this.getActiveTeam();
      const char = team ? getActiveCharacter(team) : undefined;
      if (team && char) {
        events.push({
          type: 'TurnStarted',
          teamId: team.id,
          characterId: char.id,
          windX: this.state.wind.x,
          windY: this.state.wind.y,
        });
      }
    }
    this.state.stateTimer += dt;
    if (this.state.stateTimer >= TURN_INTRO_DURATION) {
      this.transition('MOVEMENT');
    }
  }

  private updateMovement(dt: number, commands: Command[], events: SimEvent[]): void {
    const team = this.getActiveTeam();
    const char = team ? getActiveCharacter(team) : undefined;

    if (!char || !team) {
      this.transition('NEXT_TEAM');
      return;
    }

    // Process commands
    let input: PhysicsInput = { moveLeft: false, moveRight: false, jump: false };
    for (const cmd of commands) {
      switch (cmd.type) {
        case 'MoveLeft':
          input = { ...input, moveLeft: true };
          break;
        case 'MoveRight':
          input = { ...input, moveRight: true };
          break;
        case 'Jump':
          input = { ...input, jump: true };
          break;
        case 'SelectWeapon': {
          const def = weaponRegistry.get(cmd.weaponId);
          if (def) {
            this.state.selectedWeaponId = cmd.weaponId;
            this.state.aimAngle = 0;
            this.state.chargePower = 0;
            this.state.isCharging = false;
            this.transition('AIMING');
          }
          break;
        }
        case 'EndTurn':
          this.transition('RETREAT');
          return;
      }
    }

    const physEvents = stepCharacter(char, input, this.state.terrain, this.state.waterLevel, dt);
    this.handlePhysicsEvents(physEvents, events);

    // Turn timer
    this.state.turnTimeRemaining -= dt;
    if (this.state.turnTimeRemaining <= 0) {
      this.transition('RETREAT');
      return;
    }
  }

  private updateAiming(dt: number, commands: Command[], events: SimEvent[]): void {
    const team = this.getActiveTeam();
    const char = team ? getActiveCharacter(team) : undefined;
    if (!char || !team) {
      this.transition('MOVEMENT');
      return;
    }

    const def = this.state.selectedWeaponId
      ? weaponRegistry.get(this.state.selectedWeaponId)
      : undefined;

    for (const cmd of commands) {
      switch (cmd.type) {
        case 'AdjustAim':
          this.state.aimAngle = Math.max(
            -MAX_AIM_ANGLE,
            Math.min(MAX_AIM_ANGLE, this.state.aimAngle + cmd.angleDelta),
          );
          break;
        case 'StartCharge':
          if (!this.state.isCharging) this.state.isCharging = true;
          break;
        case 'ReleaseCharge':
          if (def && def.usesPowerMeter) {
            this.fireWeapon(char, team, def, events);
            return;
          }
          break;
        case 'ActivateMelee':
          if (def && def.executionType === 'melee') {
            this.activateMelee(char, team, def, events);
            return;
          }
          break;
        case 'CancelAim':
        case 'EndTurn':
          this.state.selectedWeaponId = null;
          this.transition('MOVEMENT');
          return;
      }
    }

    // Charge power
    if (this.state.isCharging && def?.usesPowerMeter) {
      this.state.chargePower = Math.min(1, this.state.chargePower + POWER_CHARGE_RATE * dt);
    }

    // Turn timer still ticks in aiming
    this.state.turnTimeRemaining -= dt;
    if (this.state.turnTimeRemaining <= 0) {
      this.transition('RETREAT');
    }
  }

  private fireWeapon(
    char: { id: string; position: Vec2; facing: 'left' | 'right'; velocity: Vec2 },
    team: Team,
    def: import('../weapons/WeaponDefinition').WeaponDefinition,
    events: SimEvent[],
  ): void {
    if (!consumeWeapon(team, def.id)) return;

    const facing = char.facing === 'right' ? 1 : -1;
    const angle = this.state.aimAngle * facing;
    const speed =
      def.minimumLaunchSpeed +
      (def.maximumLaunchSpeed - def.minimumLaunchSpeed) * this.state.chargePower;

    const velocity = {
      x: Math.cos(angle) * speed * facing,
      y: Math.sin(angle) * speed,
    };

    const proj = createProjectile(
      nextProjectileId(),
      def.id,
      team.id,
      char.id,
      { x: char.position.x + facing * 12, y: char.position.y - 14 },
      velocity,
      def.fuseSeconds,
    );

    this.state.projectiles.push(proj);
    events.push({
      type: 'ProjectileSpawned',
      projectileId: proj.id,
      weaponId: def.id,
      position: { x: proj.position.x, y: proj.position.y },
      velocity: { x: proj.velocity.x, y: proj.velocity.y },
    });

    this.transition('WEAPON_EXECUTION');
  }

  private activateMelee(
    char: { id: string; position: Vec2; facing: 'left' | 'right' },
    team: Team,
    def: import('../weapons/WeaponDefinition').WeaponDefinition,
    events: SimEvent[],
  ): void {
    if (!consumeWeapon(team, def.id)) return;

    const facing = char.facing === 'right' ? 1 : -1;
    const hitCenter = {
      x: char.position.x + facing * 20,
      y: char.position.y - 14,
    };

    // Punch: instant area effect
    const result = explode(hitCenter, def, this.allCharacters(), this.state.terrain);

    for (const dmg of result.characterDamages) {
      if (dmg.characterId === char.id) continue; // don't knock yourself
      this.state.pendingDamages.push(dmg);
      events.push({
        type: 'CharacterDamaged',
        characterId: dmg.characterId,
        damage: dmg.damage,
        source: def.id,
      });
      events.push({
        type: 'CharacterImpulsed',
        characterId: dmg.characterId,
        impulse: dmg.impulse,
      });
    }
    if (result.terrainDirtyChunks.size > 0) {
      events.push({ type: 'TerrainModified', dirtyChunkIds: [...result.terrainDirtyChunks] });
    }
    events.push({
      type: 'ProjectileDetonated',
      projectileId: `melee_${char.id}`,
      position: hitCenter,
    });

    this.transition('RETREAT');
  }

  private updateWeaponExecution(dt: number, events: SimEvent[]): void {
    const toRemove: string[] = [];

    for (const proj of this.state.projectiles) {
      if (!proj.active) continue;
      const def = weaponRegistry.get(proj.weaponId);
      if (!def) continue;

      const physEvent = stepProjectile(proj, def, this.state.wind, this.state.terrain, dt);

      if (physEvent) {
        const pos = physEvent.type === 'hit_terrain' ? physEvent.hitPoint : physEvent.position;
        const result = explode(pos, def, this.allCharacters(), this.state.terrain);

        events.push({ type: 'ProjectileDetonated', projectileId: proj.id, position: pos });

        if (result.terrainDirtyChunks.size > 0) {
          events.push({ type: 'TerrainModified', dirtyChunkIds: [...result.terrainDirtyChunks] });
        }

        for (const dmg of result.characterDamages) {
          this.state.pendingDamages.push(dmg);
          events.push({
            type: 'CharacterDamaged',
            characterId: dmg.characterId,
            damage: dmg.damage,
            source: proj.weaponId,
          });
          events.push({
            type: 'CharacterImpulsed',
            characterId: dmg.characterId,
            impulse: dmg.impulse,
          });
          // Apply impulse to velocity immediately
          const c = this.findCharacter(dmg.characterId);
          if (c) {
            c.velocity.x += dmg.impulse.x;
            c.velocity.y += dmg.impulse.y;
            c.onGround = false;
          }
        }

        toRemove.push(proj.id);
      }
    }

    for (const id of toRemove) {
      const idx = this.state.projectiles.findIndex((p) => p.id === id);
      if (idx >= 0) this.state.projectiles.splice(idx, 1);
    }

    // All projectiles gone → retreat
    const active = this.state.projectiles.filter((p) => p.active);
    if (active.length === 0) {
      this.transition('RETREAT');
    }
  }

  private updateRetreat(dt: number, commands: Command[], events: SimEvent[]): void {
    if (this.state.stateTimer === 0) {
      events.push({ type: 'RetreatStarted', seconds: this.state.retreatTimeRemaining });
    }
    this.state.stateTimer += dt;

    const team = this.getActiveTeam();
    const char = team ? getActiveCharacter(team) : undefined;
    if (char) {
      let input: PhysicsInput = { moveLeft: false, moveRight: false, jump: false };
      for (const cmd of commands) {
        if (cmd.type === 'MoveLeft') input = { ...input, moveLeft: true };
        if (cmd.type === 'MoveRight') input = { ...input, moveRight: true };
        if (cmd.type === 'Jump') input = { ...input, jump: true };
      }
      const physEvents = stepCharacter(char, input, this.state.terrain, this.state.waterLevel, dt);
      this.handlePhysicsEvents(physEvents, events);
    }

    this.state.retreatTimeRemaining -= dt;
    if (this.state.retreatTimeRemaining <= 0) {
      this.transition('WORLD_SETTLING');
    }
  }

  private updateWorldSettling(dt: number, events: SimEvent[]): void {
    this.state.settlingElapsed += dt;

    // Step all characters (no input)
    for (const team of this.state.teams) {
      for (const char of team.characters) {
        if (!char.alive) continue;
        const physEvents = stepCharacter(
          char,
          { moveLeft: false, moveRight: false, jump: false },
          this.state.terrain,
          this.state.waterLevel,
          dt,
        );
        this.handlePhysicsEvents(physEvents, events);
      }
    }

    // Check settled
    const allSettled =
      this.allCharacters().every((c) => {
        if (!c.alive) return true;
        return c.onGround && vec2Length(c.velocity) < 5;
      }) && this.state.projectiles.filter((p) => p.active).length === 0;

    if (allSettled) {
      this.state.settlingTicksStable++;
    } else {
      this.state.settlingTicksStable = 0;
    }

    if (
      this.state.settlingTicksStable >= SETTLE_STABLE_TICKS ||
      this.state.settlingElapsed >= MAX_SETTLE_TIME
    ) {
      events.push({ type: 'WorldSettled' });
      this.transition('DAMAGE_PRESENTATION');
    }
  }

  private updateDamagePresentation(dt: number, _events: SimEvent[]): void {
    this.state.stateTimer += dt;
    if (this.state.stateTimer >= DAMAGE_PRESENTATION_DURATION) {
      // Apply pending damages now
      for (const dmg of this.state.pendingDamages) {
        const char = this.findCharacter(dmg.characterId);
        if (char && char.alive) {
          char.health = Math.max(0, char.health - dmg.damage);
          if (char.health <= 0) {
            this.state.pendingDeaths.push(char.id);
          }
        }
      }
      this.state.pendingDamages = [];
      this.transition('DEATH_SEQUENCES');
    }
  }

  private updateDeathSequences(events: SimEvent[]): void {
    for (const charId of this.state.pendingDeaths) {
      const char = this.findCharacter(charId);
      if (!char || !char.alive) continue;
      char.alive = false;
      char.animationState = 'death';
      events.push({ type: 'CharacterKilled', characterId: charId, cause: 'combat' });

      // Death explosion (small, cosmetic)
      const bazookaDef = weaponRegistry.get('bazooka');
      if (!bazookaDef) continue;
      const deathDef = {
        ...bazookaDef,
        explosionRadius: 25,
        terrainRadius: 15,
        maximumDamage: 15,
        impulseStrength: 200,
      };
      const result = explode(char.position, deathDef, this.allCharacters(), this.state.terrain);
      if (result.terrainDirtyChunks.size > 0) {
        events.push({ type: 'TerrainModified', dirtyChunkIds: [...result.terrainDirtyChunks] });
      }
    }
    this.state.pendingDeaths = [];
    this.transition('VICTORY_CHECK');
  }

  private updateVictoryCheck(events: SimEvent[]): void {
    // Mark eliminated teams
    for (const team of this.state.teams) {
      if (team.alive && !isTeamAlive(team)) {
        team.alive = false;
        events.push({ type: 'TeamEliminated', teamId: team.id });
      }
    }

    const aliveTeams = this.state.teams.filter((t) => t.alive);
    if (aliveTeams.length === 0) {
      this.state.phase = 'ended';
      this.state.winnerId = null;
      events.push({ type: 'MatchEnded', winnerTeamId: null });
      this.state.turnState = 'VICTORY_CHECK'; // stay here
    } else if (aliveTeams.length === 1) {
      this.state.phase = 'ended';
      this.state.winnerId = aliveTeams[0]?.id ?? null;
      events.push({ type: 'MatchEnded', winnerTeamId: this.state.winnerId });
      this.state.turnState = 'VICTORY_CHECK';
    } else {
      this.transition('NEXT_TEAM');
    }
  }

  private updateNextTeam(events: SimEvent[]): void {
    const team = this.getActiveTeam();
    if (team) {
      events.push({ type: 'TurnEnded', teamId: team.id });
    }

    // Advance to next alive team
    let next = (this.state.activeTeamIndex + 1) % this.state.teams.length;
    for (let attempts = 0; attempts < this.state.teams.length; attempts++) {
      if (this.state.teams[next]?.alive) break;
      next = (next + 1) % this.state.teams.length;
    }
    this.state.activeTeamIndex = next;

    const nextTeam = this.state.teams[next];
    if (nextTeam) {
      advanceActiveCharacter(nextTeam);
    }

    this.state.selectedWeaponId = null;
    this.state.aimAngle = 0;
    this.state.chargePower = 0;
    this.state.isCharging = false;
    this.state.turnTimeRemaining = this.state.turnDuration;
    this.state.retreatTimeRemaining = 5;
    this.state.turnCount++;

    this.transition('TURN_INTRO');
  }

  private transition(newState: TurnState): void {
    this.state.turnState = newState;
    this.state.stateTimer = 0;
    if (newState === 'WORLD_SETTLING') {
      this.state.settlingTicksStable = 0;
      this.state.settlingElapsed = 0;
    }
  }

  private pickNewWind(events: SimEvent[]): void {
    const strength = this.windRng() * 4;
    const angle = this.windRng() * Math.PI * 2;
    this.state.wind = {
      x: Math.cos(angle) * strength,
      y: 0, // horizontal wind only
    };
    events.push({ type: 'WindChanged', x: this.state.wind.x, y: this.state.wind.y });
  }

  private getActiveTeam(): Team | undefined {
    return this.state.teams[this.state.activeTeamIndex];
  }

  private allCharacters(): import('../entities/Character').Character[] {
    return this.state.teams.flatMap((t) => t.characters);
  }

  private findCharacter(id: string): import('../entities/Character').Character | undefined {
    return this.allCharacters().find((c) => c.id === id);
  }

  private handlePhysicsEvents(
    physEvents: import('../physics/CharacterPhysics').CharacterPhysicsEvent[],
    events: SimEvent[],
  ): void {
    for (const pe of physEvents) {
      switch (pe.type) {
        case 'fell':
          events.push({
            type: 'CharacterDamaged',
            characterId: pe.characterId,
            damage: pe.damage,
            source: 'fall',
          });
          break;
        case 'drowned':
          events.push({ type: 'CharacterKilled', characterId: pe.characterId, cause: 'drown' });
          break;
        case 'killed':
          events.push({ type: 'CharacterKilled', characterId: pe.characterId, cause: pe.cause });
          break;
      }
    }
  }
}
