# Allium Assault — Development Plan

Worms Armageddon-inspired, browser-native, turn-based 2D artillery game starring garlic clove characters.
Local hot-seat and human-vs-AI play. No backend required for the MVP.

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.x | Type safety across simulation, rendering, and AI layers |
| Game engine | Phaser 4.2.0 (pinned) | Scenes, camera, input, audio, particles, WebGL 2 renderer |
| Bundler | Vite (latest) | Fast HMR, native Web Worker support, PWA plugin |
| Noise | simplex-noise | Tree-shakeable, ~2 KB, 20 ns/sample, ES module |
| Seeded RNG | mulberry32 (inline or rand-seed) | Fast, deterministic, no external dependency needed |
| IndexedDB | Dexie.js | Schema versioning, typed queries, offline-first |
| PWA | vite-plugin-pwa + Workbox | Zero-config service worker, offline caching |
| Testing | Vitest | Co-located with Vite, 2-5× faster than Jest |
| Linting | ESLint + Prettier | Standard TypeScript project setup |
| Workers | Vite native (`?worker` or `new URL`) | AI trajectory search off the main thread |

---

## Repository Structure (target)

```
AlliumAssault/
├── documents/
│   ├── 00_VISION.md
│   └── 01_Development_plan.md
├── src/
│   ├── core/                  # Simulation — no Phaser imports allowed here
│   │   ├── simulation/        # Fixed-step game loop, command dispatch
│   │   ├── state/             # Match state machine
│   │   ├── entities/          # Teams, characters, projectiles
│   │   ├── weapons/           # WeaponDefinition registry
│   │   ├── terrain/           # Collision mask, generation, destruction
│   │   ├── physics/           # Integrator, swept collision, impulse
│   │   ├── ai/                # AI worker interface + strategy
│   │   └── rng/               # Seeded RNG, multiple independent streams
│   ├── presentation/          # Phaser scenes, sprites, audio, HUD
│   │   ├── scenes/
│   │   ├── renderers/
│   │   ├── audio/
│   │   └── hud/
│   ├── persistence/           # Dexie stores, schema, migration
│   ├── workers/               # Web Worker entry points (AI, noise gen)
│   └── main.ts
├── assets/
│   ├── sprites/
│   ├── audio/
│   └── fonts/
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── tests/
└── vite.config.ts
```

---

## Phase 0 — Project Setup & Tooling

- [ ] Initialise npm project (`package.json`) with `"type": "module"`
- [ ] Install and configure Vite with TypeScript template
- [ ] Pin Phaser to `4.2.0` in `package.json`
- [ ] Install dev dependencies: `typescript`, `eslint`, `prettier`, `vitest`, `@types/node`
- [ ] Install runtime dependencies: `phaser@4.2.0`, `simplex-noise`, `dexie`, `vite-plugin-pwa`
- [ ] Write `tsconfig.json` with `"isolatedModules": true`, strict mode, path aliases (`@core`, `@presentation`, `@persistence`, `@workers`)
- [ ] Write `vite.config.ts`:
  - Configure `worker: { format: "es" }` for Web Worker support
  - Add `vite-plugin-pwa` with a minimal placeholder manifest
  - Set up path alias resolution matching `tsconfig.json`
- [ ] Configure `.eslintrc` with TypeScript plugin and import ordering rules
- [ ] Configure `.prettierrc`
- [ ] Add `vitest.config.ts` (or inline in `vite.config.ts`) with environment `jsdom` for unit tests
- [ ] Create `src/main.ts` that mounts a minimal Phaser scene confirming WebGL 2 is active
- [ ] Confirm the game loads in Firefox with `npm run dev`
- [ ] Add npm scripts: `dev`, `build`, `preview`, `test`, `test:watch`

---

## Phase 1 — Terrain Laboratory (Milestone 1)

The goal is to confirm that terrain generation, chunked rendering, circular destruction, and camera scrolling are stable in a browser before any gameplay logic is added.

### 1.1 Seeded RNG

- [ ] Implement `mulberry32` seeded PRNG as a tiny inline function (no external dependency)
- [ ] Implement `SeedManager` class that accepts a root seed string and derives independent named sub-streams (shape, cave, decoration, spawn, crate, wind) via a `hash(rootSeed, streamName)` step so adding a new stream never shifts existing ones
- [ ] Write unit tests confirming that the same seed always produces the same sequence
- [ ] Write unit tests confirming that two named streams from the same root seed are independent

### 1.2 Noise Integration

- [ ] Wrap `simplex-noise` `createNoise2D()` behind a thin `SeededNoise2D` class that accepts a numeric seed (from `SeedManager`)
- [ ] Confirm the wrapper returns values in `[-1, 1]`
- [ ] Write a Node/Vitest test that renders a 64×64 noise tile to a string and compares it to a snapshot

### 1.3 Terrain Generation Pipeline

Implement in `src/core/terrain/TerrainGenerator.ts`. The generator accepts a `TerrainOptions` object and returns a `Uint8Array` collision mask plus surface metadata.

```ts
interface TerrainOptions {
  seed: string;
  generatorVersion: number;   // bump when algorithm changes
  width: number;              // 5000 nominal
  height: number;             // 2000 nominal
  themeId: string;
  terrainDensity: number;     // 0–1
  caveDensity: number;
  islandDensity: number;
  roughness: number;
  waterLevel: number;         // pixel row of water surface (~1870)
}
```

- [ ] **Step 1 — Base ground envelope**: generate a 1D low-frequency height curve using the shape RNG stream; broad hills from y ≈ 650 to y ≈ 1300; everything below a deep foundation level is solid
- [ ] **Step 2 — 2D rock field**: apply layered 2D simplex noise (broad + medium + local octaves) around the envelope; `solid = verticalBias + broadNoise + mediumNoise + localNoise > threshold`
- [ ] **Step 3 — Feature stamps**: place deterministic brushes using shape RNG — rock columns, rounded outcrops, natural arches, broad bowls, caverns, tunnels, small floating islands, flat shelves, deep valleys; stamps may add or subtract solid pixels
- [ ] **Step 4 — Morphological cleanup**: remove isolated 1-pixel noise, fill tiny holes, remove thin needles, round dangerous hooks, enforce minimum platform thickness (≥ 8 px), remove disconnected fragments smaller than 200 px², smooth surfaces without destroying ledges
- [ ] **Step 5 — Guarantee a foundation**: lower 15% of the world height must remain a sufficiently thick connected mass; enforce a water margin (water at y ≈ 1870, safe terrain ends above y ≈ 1820)
- [ ] **Step 6 — Surface analysis**: scan for walkable positions (solid pixel with open pixel above); record x, y, surface normal, vertical clearance, platform width, distance from water, slope, nearby walls
- [ ] **Step 7 — Fair team placement**: given N characters, divide map horizontally into sectors, interleave spawn positions (A1 C1 B1 D1 A2 …), reject narrow ledges / insufficient clearance / water proximity / enclosed pockets; confirm no immediate melee range between opposing teams
- [ ] **Step 8 — Terrain painting** (visual only, no collision impact): assign interior rock texture coordinates, surface moss on upward normals, dark soil below moss, ambient shadow under overhangs, decoration stream for cracks and embedded stones; return alongside the collision mask as a `TerrainVisualData` structure
- [ ] **Step 9 — Validation**: reject and retry with `attemptSeed = hash(originalSeed, attemptN)` when: too little / too much terrain, insufficient spawn sites, severe height imbalance, inaccessible terrain, map too fragmented; cap retries at 20

### 1.4 Collision Mask

- [ ] Represent as `Uint8Array` of size `width × height`; index formula `y * width + x`
- [ ] Expose `isSolid(x, y): boolean`, `setSolid(x, y, value)`, `carveCircle(cx, cy, radius)` methods
- [ ] Track dirty chunks: define chunk size 256×256; `carveCircle` marks all overlapping chunks dirty

### 1.5 Chunked Terrain Renderer

- [ ] Create `TerrainRenderer` using Phaser `RenderTexture` per chunk (or a custom WebGL approach)
- [ ] On startup, paint all chunks from the `TerrainVisualData`
- [ ] Per frame, regenerate and upload only dirty chunks then clear their dirty flag
- [ ] Verify that a 5000×2000 map with 256×256 chunks (≈ 20×8 = 160 chunks) initialises in < 2 s in Firefox
- [ ] Confirm that carving ten simultaneous circles updates only the affected chunks

### 1.6 Scrolling Camera & Basic Scene

- [ ] Create Phaser scene `TerrainLabScene`
- [ ] Set world bounds to 5000×2000; camera bounded within world
- [ ] Camera pan: mouse drag (middle button) or arrow keys
- [ ] Camera zoom: mouse wheel in range 0.4×–2.0×
- [ ] Place a single static 32×32 placeholder garlic sprite at the first detected spawn point
- [ ] Display current camera position, chunk count, and dirty-chunk count in a debug overlay

### 1.7 Circular Terrain Destruction (Lab Test)

- [ ] Left-click on terrain fires a test explosion at that pixel position with radius 40
- [ ] `carveCircle` updates collision mask and marks dirty chunks
- [ ] Dirty chunks are repainted within the same frame
- [ ] Confirm repeated rapid explosions do not crash or visually corrupt

### 1.8 Seed Persistence (Lab)

- [ ] Save the last-used seed to `localStorage` (not yet Dexie)
- [ ] On startup, restore and regenerate from saved seed
- [ ] Display the active seed string in the debug overlay

---

## Phase 2 — Character Physics (Milestone 2)

### 2.1 Character Entity

- [ ] Define `Character` in `src/core/entities/Character.ts`:
  - `id`, `teamId`, `name`, `position` (Vec2), `velocity` (Vec2), `health`, `alive`, `facing` (left | right), `onGround`, `animationState`
- [ ] Define `Vec2` utility type with basic arithmetic helpers

### 2.2 Terrain Collision Queries

- [ ] `isGrounded(pos, collisionMask): boolean` — sample foot pixels below the character center using a 6-pixel wide foot probe
- [ ] `headClearance(pos, collisionMask): number` — pixels of free space above character
- [ ] `sideObstruction(pos, direction, collisionMask): boolean`
- [ ] `maxStepHeight(pos, direction, collisionMask): number` — how many pixels the character can step up without jumping
- [ ] `surfaceNormal(pos, collisionMask): Vec2` — estimated normal at current foot position
- [ ] `fallDistance(pos, collisionMask): number` — pixels until next solid below

### 2.3 Movement & Physics

Implement in `src/core/physics/CharacterPhysics.ts`. All physics runs at fixed 60 Hz step.

- [ ] Walking: apply horizontal velocity ±120 px/s; stop when side-obstructed unless step height ≤ 4 px (auto-step)
- [ ] Facing direction: update from movement input direction
- [ ] Jumping: apply upward impulse (−420 px/s²·frame equivalent); only allowed when `onGround = true`
  - Forward jump: jump in facing direction
  - Backward jump: jump away from facing direction
- [ ] Gravity: apply 980 px/s² downward acceleration each tick when not grounded
- [ ] Ground detection: set `onGround = true` when foot probe confirms solid within 2 px below
- [ ] Slope handling: slide down slopes steeper than a configured angle
- [ ] Anti-clip: if character is inside solid after terrain destruction, push out using surface normal

### 2.4 Fall Damage

- [ ] Accumulate fall distance during airborne phase
- [ ] Apply damage when landing: `damage = max(0, (fallDistance - safeHeight) * fallDamageScale)`
  - Provisional: `safeHeight = 40 px`, `fallDamageScale` calibrated so a ~200 px fall deals ~25 HP
- [ ] Emit `CharacterDamaged` event with `source = "fall"` and computed damage

### 2.5 Drowning

- [ ] Each tick, if character `position.y > waterLevel`: reduce health by `drowningDamagePerSecond / 60` per tick (provisional: 5 HP/s)
- [ ] Emit `CharacterDrowned` event when `health ≤ 0` from drowning

### 2.6 16-Character Stress Test

- [ ] Spawn 16 characters at valid terrain positions
- [ ] Apply random horizontal input to all simultaneously for 5 s
- [ ] Confirm no character falls through terrain, no character clips into solid permanently
- [ ] Profile: target < 1 ms physics update time for 16 characters per frame

---

## Phase 3 — Simulation Core Architecture

Before adding weapons, establish a clean separation boundary between simulation and rendering.

- [ ] Define command types in `src/core/simulation/Commands.ts`:
  `MoveLeft`, `MoveRight`, `StopMove`, `StartJump`, `SelectWeapon`, `AdjustAim`, `SetPower`, `StartCharge`, `ReleaseCharge` (= Fire), `EndTurn`
- [ ] Define event types in `src/core/simulation/Events.ts`:
  `ProjectileSpawned`, `TerrainRemoved`, `CharacterDamaged`, `CharacterLaunched`, `CharacterDrowned`, `CharacterKilled`, `TeamEliminated`, `TurnAdvanced`, `MatchEnded`, `WindChanged`
- [ ] Implement `SimulationCore` class:
  - Owns all game state (terrain mask, characters, teams, projectiles, match state machine)
  - Exposes `step(dt: number, commands: Command[])` — advances physics by one fixed tick
  - Exposes `on(event, handler)` event bus
  - **Must not import Phaser, DOM APIs, or audio**
- [ ] Implement `GameLoop` in presentation layer:
  - Reads player input, queues commands
  - Calls `SimulationCore.step()` at 60 Hz (via Phaser's `update`)
  - Listens to events and drives Phaser sprites, sounds, and camera

### 3.1 Match State Machine

Implement as an explicit FSM in `src/core/state/MatchStateMachine.ts`.

States:
```
MATCH_SETUP → TURN_INTRO → MOVEMENT → WEAPON_SELECTION →
AIMING → WEAPON_EXECUTION → RETREAT → WORLD_SETTLING →
DAMAGE_PRESENTATION → DEATH_SEQUENCES → VICTORY_CHECK → NEXT_TEAM
```

- [ ] Each state has `enter()`, `update(dt)`, `exit()` methods
- [ ] Transitions are explicit, not inferred from booleans
- [ ] `WORLD_SETTLING` polls for any active projectiles, moving characters, mine countdowns, or fire particles; exits only when all are below a velocity threshold
- [ ] Turn can be force-terminated by: timer expiry, active character death, active character drowning, `EndTurn` command
- [ ] Write unit tests for each state transition using mock game state

---

## Phase 4 — Bazooka Combat (Milestone 3)

### 4.1 Weapon Definition Schema

- [ ] Define `WeaponDefinition` interface in `src/core/weapons/WeaponDefinition.ts` (see VISION.md for full interface)
- [ ] Define `WeaponRegistry` — a `Map<string, WeaponDefinition>` loaded from a JSON data file
- [ ] Create `data/weapons.json` with Bazooka definition:
  - `executionType: "projectile"`, `ammoPolicy: "unlimited"`, `usesPowerMeter: true`
  - `gravityScale: 1.0`, `windInfluence: 0.9`, `restitution: 0.0`, `explodeOnImpact: true`
  - `explosionRadius: 40`, `terrainRadius: 45`, `maximumDamage: 75`, `impulseStrength: 500`

### 4.2 Aim Mode

- [ ] When a weapon is selected, `SimulationCore` transitions to `AIMING` state
- [ ] Aim angle: Up/Down arrow keys rotate aim; range −85°…+85° from horizontal in facing direction
- [ ] Aim indicator: render a dotted line from character muzzle in aim direction (presentation layer only)
- [ ] Power meter: Space held builds power from 0–100 over ~2 s; visual power bar in HUD
- [ ] Escape during aiming cancels weapon selection, returns to `MOVEMENT` without consuming ammo

### 4.3 Projectile Physics Integrator

Implement in `src/core/physics/ProjectilePhysics.ts`. Runs inside `SimulationCore.step()`.

- [ ] Per tick: `velocity += gravity × gravityScale × dt`; `velocity.x += windX × weaponWindFactor × dt`; `position += velocity × dt`
- [ ] Wind: a `Vec2` chosen at turn start from wind RNG stream; magnitude 0–4 px/s²; direction and strength displayed in HUD
- [ ] Each projectile carries a reference to its `WeaponDefinition` for per-weapon parameters
- [ ] Swept collision: between `prevPosition` and `newPosition`, sample along the segment at intervals of 1 px and test `isSolid`; stop at the first solid hit and record the collision point and normal

### 4.4 Explosion System

Implement in `src/core/physics/ExplosionSystem.ts`.

- [ ] `explode(center, definition, instigatorId)`:
  1. Find all characters within `explosionRadius`
  2. Calculate radial damage: `damage = maxDamage × (1 - dist / radius)`; apply line-of-sight check (optionally; for MVP, skip LOS and use pure distance)
  3. Calculate impulse direction (from explosion center outward) and apply `impulseStrength × (1 - dist/radius)` velocity delta
  4. Carve circle of radius `terrainRadius` from collision mask
  5. Mark visual chunks dirty
  6. Emit `TerrainRemoved`, `CharacterDamaged`, and `CharacterLaunched` events
  7. Emit particle/sound hints as events (presentation layer responds to these)
  8. Check for nearby triggered mines (not in MVP, reserve hook)
- [ ] Queue death explosions (do not resolve recursively mid-explosion)
- [ ] Unit test: explosion centered on a known character position produces expected damage and impulse values

### 4.5 World-Settling Detection

- [ ] `WorldSettler` monitors all active `Projectile` objects and all `Character` objects
- [ ] Settled condition: all projectiles inactive AND all characters have `onGround = true` AND all character velocities < 5 px/s for 10 consecutive ticks
- [ ] Emit `WorldSettled` event when condition met; `MatchStateMachine` listens and transitions out of `WORLD_SETTLING`

---

## Phase 5 — Complete Match System (Milestone 4)

### 5.1 Team System

- [ ] Define `Team` in `src/core/entities/Team.ts`:
  `id`, `name`, `color`, `emblem`, `controllerType` ("human" | "ai"), `aiDifficulty`, `characters: Character[]`, `inventory: TeamInventory`, `statistics: TeamStatistics`
- [ ] `TeamInventory`: map of `weaponId → WeaponStock` where `WeaponStock = { count: number | "unlimited"; available: boolean }`
- [ ] Inventory ammo consumption: deducted at commit point (when projectile is launched or melee animation begins); cancelling in aim mode does not consume
- [ ] Weapon hidden from selection UI when `count = 0`

### 5.2 Turn & Character Rotation

- [ ] Teams rotate in fixed order (A → B → C → D → A …)
- [ ] Within a team, living characters rotate in their own fixed index order; dead characters are skipped
- [ ] Active character is highlighted in HUD; camera follows active character on `TURN_INTRO`

### 5.3 Turn Timer

- [ ] Provisional: 45 seconds per turn
- [ ] Timer is displayed in HUD and ticks audibly at ≤ 10 s remaining
- [ ] Timer expiry triggers immediate transition to `RETREAT` (if no weapon committed) or `WORLD_SETTLING` (if weapon already committed)

### 5.4 Retreat Phase

- [ ] 5-second retreat timer after weapon commitment
- [ ] Active character can walk and jump during retreat
- [ ] Weapon selection panel is locked during retreat
- [ ] Retreat ends when timer expires or character falls/drowns/dies

### 5.5 Health & Death

- [ ] Starting health: 100 HP per character
- [ ] Friendly fire enabled; self-damage enabled
- [ ] When `health ≤ 0`: emit `CharacterKilled`; mark character dead; begin death sequence animation; after animation completes, trigger a death explosion with `explosionRadius: 25`, `maximumDamage: 20` (cosmetic / small environmental damage)
- [ ] Dead characters removed from their team's active roster

### 5.6 Team Elimination

- [ ] When all characters in a team are dead: emit `TeamEliminated`; remove team from rotation
- [ ] Match continues until one team remains

### 5.7 Victory Detection

- [ ] After each `TeamEliminated` event, check if only one team has living characters
- [ ] If yes, emit `MatchEnded` with `winnerTeamId`
- [ ] Draw condition: if the last two teams die in the same explosion sequence, emit `MatchEnded` with `winnerTeamId = null`

### 5.8 Match History Persistence

- [ ] On `MatchEnded`, write a `MatchSummary` record to Dexie (see schema in VISION.md)
- [ ] Update `TeamStatistics` for all participating teams

### 5.9 HUD

- [ ] Health bars above each character's head (hidden when full, always visible when damaged)
- [ ] Active character indicator (arrow or ring)
- [ ] Turn timer countdown display
- [ ] Retreat timer countdown display (only during retreat)
- [ ] Wind indicator: direction arrow and numeric strength
- [ ] Weapon panel: shows current weapon icon, ammo count; right-click or Tab to open full weapon list
- [ ] Team panel: mini health bars for all teams, dimmed for dead characters

---

## Phase 6 — Additional Weapons & AI (Milestone 5)

### 6.1 Impact Clove (Contact Grenade)

- [ ] Add to `weapons.json`:
  - `executionType: "throwable"`, `ammoPolicy: "finite"`, initial stock: 5
  - `explodeOnImpact: true` (explodes on first terrain or character contact)
  - Higher arc, reduced wind influence vs bazooka
  - `explosionRadius: 35`, `maximumDamage: 60`
- [ ] Throwing power: same Space-hold power meter as bazooka
- [ ] Aim angle covers above-horizontal arc

### 6.2 Classic Grenade (Fuse-Based)

- [ ] Add to `weapons.json`:
  - `executionType: "throwable"`, `fuseSeconds: 1–5` (player selects before throwing)
  - `restitution: 0.5` (bounces)
  - `explodeOnImpact: false`
  - `maximumDamage: 50`, `explosionRadius: 40`
- [ ] Fuse selection: Up/Down during `WEAPON_SELECTION` cycles 1–5 s; displayed in HUD
- [ ] Grenade continues to bounce after throwing until fuse expires
- [ ] Enable via a dev flag in schemes; hidden from normal weapon panel initially

### 6.3 Garlic Uppercut (Melee Punch)

- [ ] Add to `weapons.json`:
  - `executionType: "melee"`, `ammoPolicy: "unlimited"`, `usesPowerMeter: false`
  - `explosionRadius: 0`, `maximumDamage: 30`
  - `impulseStrength: 900` (strong upward + forward launch)
  - `terrainRadius: 10` (small vertical terrain removal above impact point)
  - `endsTurn: true`
- [ ] Space bar activates immediately in facing direction
- [ ] Hit detection: capsule overlap between character and targets within 28 px
- [ ] Play punch animation; launch victim upward-forward (−60° from horizontal)

### 6.4 AI Controller

Runs in a Vite Web Worker (`src/workers/ai.worker.ts`). Receives a serialised world snapshot; returns a command list.

- [ ] Define serialisable `WorldSnapshot` type (positions, healths, terrain chunk hashes, inventory, wind, state)
- [ ] AI Worker protocol: `postMessage(snapshot)` → worker replies `postMessage(aiCommands)`
- [ ] Implement `NavigationGraph`: nodes = walkable surface positions (from surface analysis); edges = walk, forward jump, backward jump, controlled drop
- [ ] Rebuild only chunks whose hash changed since last turn
- [ ] **Bazooka AI**: for each living enemy, sample 12 aim angles × 5 power levels = 60 trajectories via a lightweight simulation copy; pick the shot with the highest `score = enemyDamage - selfDamage × 2.2 - friendlyDamage × 1.8`
- [ ] **Impact Clove AI**: same as bazooka but heavier gravity, no wind factor, first-impact detonation
- [ ] **Punch AI**: check if any enemy is within movement-reachable range; score by launch direction toward water or into a pit
- [ ] **Movement AI**: move toward best firing position before committing to weapon; retreat after attacking
- [ ] **Difficulty scaling**:
  - Easy: 6 trajectory samples, ±15° aim error, ignores movement optimisation
  - Normal: 20 samples, ±8° aim error, basic movement
  - Hard: 40 samples, ±4° aim error, movement + knockback prediction
  - Expert: 60 samples, ±1° aim error, all scoring terms active
- [ ] AI execution is animated: commands are fed into the normal input system with realistic delays, not applied instantly

---

## Phase 7 — Persistence Layer

- [ ] Install `dexie`; create `src/persistence/db.ts` with `Dexie` subclass
- [ ] Schema version 1 stores:
  - `settings`: `{ id: 1, audioMusic, audioSfx, audioVoice, controlBindings }`
  - `teams`: `TeamRecord[]` (id, name, color, emblem, garlic names, cosmetics)
  - `teamStatistics`: `TeamStatistics[]` (see VISION.md)
  - `matchSummaries`: `MatchSummary[]` (see VISION.md)
  - `recentSeeds`: `{ seed, generatorVersion, playedAt }[]` (last 20 entries)
- [ ] Implement repository classes: `SettingsRepo`, `TeamRepo`, `MatchRepo`
- [ ] Add schema migration hook (bump version number + `upgrade()` when schema changes)
- [ ] Write Vitest tests against an in-memory Dexie instance using `fake-indexeddb`
- [ ] Export/import teams and settings as JSON (button in settings screen)

---

## Phase 8 — Presentation & Polish (Milestone 6)

### 8.1 Garlic Sprite Sheets

- [ ] Design character proportions: garlic clove body, small face, arms, legs (stub feet)
- [ ] Generate or hand-draw per-animation sprite sheets at 64×64 px per frame:
  - Idle (4–6 frames), Walk (6–8 frames), Jump (2–4 frames)
  - Aim (body + separate arm overlay), Punch (5–7 frames)
  - Hurt (3–5 frames), Fall (2–3 frames), Death (6–10 frames), Victory (6–10 frames)
- [ ] Cosmetic layers as separate images: body base, face, team accessory (scarf/headband/leaf), hat, held weapon icon
- [ ] Team color applied via Phaser tint on the accessory layer
- [ ] Phaser `AnimationManager` entries for each animation state

### 8.2 Background Layers (Moonlit Garlic Grove Theme)

Rendered as static or slowly scrolling `TileSprite` or `Image` objects with parallax factors.

- [ ] **Sky layer**: dark blue-to-purple gradient with moon glow and sparse stars (generated texture or asset)
- [ ] **Distant forest layer**: large desaturated conifer/deciduous silhouettes (asset or procedurally drawn)
- [ ] **Near forest layer**: dark trunks, branches, oversized leaves, occasional firefly particles
- [ ] **Atmospheric layer**: slowly drifting particle leaves and pollen (Phaser ParticleEmitter, very low density)
- [ ] **Water layer**: animated water surface with horizontal wave shader or animated sprite strip
- [ ] Parallax scroll speed proportional to camera movement (distant layers scroll slower)

### 8.3 Terrain Visual Polish

- [ ] Warm brown/terracotta base texture for solid terrain interior
- [ ] Bright moss/grass pixel strip on upward-facing surface normals
- [ ] Dark exposed-edge texture around explosion craters (overwrite paint on `carveCircle`)
- [ ] Non-colliding decoration sprites: pale roots, tiny mushrooms, garlic shoots (placed from decoration RNG stream)

### 8.4 Particle Effects

- [ ] Explosion debris: dark rock shards, dust puffs, screen-shake correlated to explosion radius
- [ ] Walking: tiny dirt-puff particles at footfall
- [ ] Drowning: bubbles rising from sunken character
- [ ] Death: character flashes red, explodes into garlic-clove fragments

### 8.5 Audio

- [ ] Set up Phaser `Sound.WebAudioSoundManager`; require initial user interaction before audio context starts
- [ ] Create audio buses (music, sfx, voice) with independent volume controls persisted in settings
- [ ] Sound event list (source assets needed or generated):
  - Walk footstep (2–3 variants), Jump, Land / heavy-land
  - Aim rotation, Power charge, Weapon launch
  - Projectile whistle (bazooka), Grenade bounce
  - Explosion small / medium / large (3 variants)
  - Terrain debris rattle, Fire crackle
  - Character hurt grunt (3–4 garlic-style voices), Death wail
  - Turn start chime, Turn end chime
  - Victory fanfare, Defeat sting
- [ ] Apply random pitch variation (±10%) to repeated one-shot sounds

### 8.6 Camera Effects

- [ ] Screen shake: magnitude proportional to nearest explosion radius / distance
- [ ] Camera lerp: smooth follow of active character and projectiles
- [ ] Cinematic zoom: briefly zoom in on explosion center at turn end
- [ ] Accessibility option: disable screen shake

---

## Phase 9 — Menus & Flow

- [ ] **Main menu scene**: title, "Play", "Teams", "Settings", "How to Play", credits
- [ ] **Match setup scene**: select number of teams (2–4), assign human/AI + difficulty per team, pick or generate map seed, configure weapon scheme (MVP: one default scheme), start match
- [ ] **Team editor scene**: create/rename team, set color, pick garlic names (up to 4), assign emblem; saved via `TeamRepo`
- [ ] **Settings scene**: audio volume sliders (music, SFX, voice), control binding remapper, accessibility toggles (shake, flash), data export/import
- [ ] **In-game pause menu**: resume, quit to main menu, toggle sound
- [ ] **Victory screen**: winning team name and color, final health summary, play-again / main menu buttons, match written to history
- [ ] **Match history screen**: list of recent `MatchSummary` records from Dexie

---

## Phase 10 — Controls Remapping

- [ ] Store default key bindings in `settings` Dexie record
- [ ] Implement `InputManager` that maps logical actions (MoveLeft, Jump, Fire, …) to physical keys; Phaser input reads from `InputManager` not raw keycodes
- [ ] Settings screen allows rebinding any action; validates no duplicate bindings; saves to Dexie

---

## Phase 11 — PWA & Distribution

- [ ] Complete `public/manifest.webmanifest`: `name`, `short_name`, `description`, `icons` at 192, 512 px, `start_url`, `display: standalone`, `theme_color`, `background_color`
- [ ] Generate app icons (512×512 garlic logo)
- [ ] Configure `vite-plugin-pwa` with Workbox `GenerateSW` strategy:
  - Cache all static assets, Phaser bundle, and game assets on install
  - `runtimeCaching` for any fonts or CDN assets
  - Update prompt: banner when a new version is available
- [ ] Confirm offline playability: serve build, disable network in DevTools, reload, play a full match
- [ ] Test in Firefox, Chromium, and Safari (WebKit) for baseline compatibility
- [ ] **Optional**: Tauri wrapper — add `src-tauri/` directory; configure for same Vite build output; package as `.deb` / `.AppImage` / `.exe` / `.dmg`

---

## Phase 12 — Quality & Testing

- [ ] **Simulation unit tests** (Vitest, no browser required):
  - Terrain generation produces valid masks for 20 seeds
  - `carveCircle` correctly clears pixels and marks dirty chunks
  - Character collision queries return correct values for known terrain snapshots
  - Explosion damage formula produces expected values at key distances
  - State machine transitions cover every edge case
  - Seeded RNG produces identical sequences across runs
- [ ] **Integration test**: spawn a full match with 2 teams, simulate 50 turns programmatically, confirm no crashes, health values stay in range
- [ ] **Performance baseline**:
  - Terrain generation (5000×2000, all steps): < 500 ms
  - Per-frame physics update (16 chars, 10 projectiles): < 2 ms
  - Chunk repaint (10 dirty 256×256 chunks): < 4 ms
  - Stable 60 fps in Firefox on a contemporary laptop
- [ ] **Accessibility**: confirm screen shake and flashing effects can be fully disabled

---

## Deferred for Post-MVP

These items are explicitly out of scope for the first playable release:

- [ ] Online multiplayer (requires game-server, shared-protocol packages, WebSocket lobby)
- [ ] Accounts and cloud saves
- [ ] Rope tool (complex constraints, pendulum physics, mid-air detach)
- [ ] Jetpack utility
- [ ] Sudden death / rising water
- [ ] Indestructible terrain material type
- [ ] Map editor
- [ ] Replay viewer (command log is recorded; playback UI deferred)
- [ ] Leaderboards / rankings
- [ ] Mod/content packaging
- [ ] WebGPU renderer (treat as a future optimisation once WebGPU is available in stable Firefox)
- [ ] Mobile / touchscreen controls
- [ ] Best-of-three round structure

---

## Provisional Game Constants

| Constant | Value | Notes |
|---|---|---|
| World width | 5000 px | Nominal; minimum 3500 px |
| World height | 2000 px | Nominal; minimum 1600 px |
| Water level | y = 1870 | Drowning threshold |
| Chunk size | 256 × 256 px | Terrain render chunk |
| Simulation rate | 60 Hz | Fixed timestep |
| Character health | 100 HP | Starting value |
| Turn duration | 45 s | Configurable per scheme |
| Retreat duration | 5 s | After weapon commit |
| Gravity | 980 px/s² | Subject to fall-damage calibration |
| Safe fall height | 40 px | Below this: no fall damage |
| Drowning damage | 5 HP/s | Underwater |
| Teams | 2–4 | |
| Characters per team | 1–4 | |
| Max characters | 16 | |
| Wind max strength | 4 px/s² | New value each turn |
