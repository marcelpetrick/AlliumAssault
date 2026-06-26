# Allium Assault — Agent Coordination Guide

This file describes how to split, delegate, and coordinate implementation work across multiple AI agent sessions for the Allium Assault project.

---

## Separation contract

The codebase is split into two halves with a hard import boundary:

```
src/core/          ← SIMULATION — NO Phaser, NO DOM, NO audio
src/presentation/  ← PRESENTATION — may import from core, may use Phaser
src/persistence/   ← PERSISTENCE — Dexie only, no Phaser
src/workers/       ← WEB WORKERS — may import from core, no DOM
```

Any agent working inside `src/core/` must never import from `phaser`, `phaser/`, or any browser API (`window`, `document`, `canvas`). Violations will break Vitest node-environment tests.

---

## Module ownership map

| Module | Path | Depends on |
|---|---|---|
| Types & Vec2 | `src/core/types.ts` | — |
| Seeded RNG | `src/core/rng/` | types |
| Noise | `src/core/noise/` | rng |
| Terrain generation | `src/core/terrain/TerrainGenerator.ts` | rng, noise |
| Collision mask | `src/core/terrain/CollisionMask.ts` | types |
| Character physics | `src/core/physics/` | types, terrain |
| Weapon definitions | `src/core/weapons/` | types |
| Explosion system | `src/core/physics/ExplosionSystem.ts` | terrain, weapons |
| Match FSM | `src/core/state/MatchStateMachine.ts` | types, entities |
| Simulation core | `src/core/simulation/SimulationCore.ts` | all core |
| AI worker | `src/workers/ai.worker.ts` | core (via snapshot) |
| Phaser scenes | `src/presentation/scenes/` | core (events only) |
| Terrain renderer | `src/presentation/renderers/TerrainRenderer.ts` | core terrain |
| HUD | `src/presentation/hud/` | core types |
| Persistence | `src/persistence/` | core types |

---

## Agent task assignments

### Agent A — Core Simulation (headless, fully tested)
Implements everything under `src/core/` and `src/workers/ai.worker.ts`.
Must not touch `src/presentation/` or `src/persistence/`.
Every public function needs a Vitest test under `tests/core/`.

Deliverables:
- `src/core/types.ts`
- `src/core/rng/` (SeedManager + mulberry32)
- `src/core/noise/` (SeededNoise2D wrapping simplex-noise)
- `src/core/terrain/CollisionMask.ts`
- `src/core/terrain/TerrainGenerator.ts` (full 9-step pipeline)
- `src/core/terrain/SurfaceAnalyzer.ts`
- `src/core/physics/CharacterPhysics.ts`
- `src/core/physics/ProjectilePhysics.ts`
- `src/core/physics/ExplosionSystem.ts`
- `src/core/weapons/WeaponDefinition.ts` + `WeaponRegistry.ts`
- `src/core/entities/` (Character, Team, Projectile)
- `src/core/state/MatchStateMachine.ts`
- `src/core/simulation/SimulationCore.ts` (commands, events, step loop)

### Agent B — Presentation Layer (Phaser scenes)
Implements everything under `src/presentation/`.
Reads from `src/core/` types and events — never modifies core files.

Deliverables:
- `src/presentation/scenes/BootScene.ts`
- `src/presentation/scenes/MainMenuScene.ts`
- `src/presentation/scenes/TerrainLabScene.ts` (Milestone 1 verification)
- `src/presentation/scenes/GameScene.ts`
- `src/presentation/renderers/TerrainRenderer.ts`
- `src/presentation/hud/HUD.ts`
- `src/presentation/audio/AudioManager.ts`
- `src/main.ts`

### Agent C — Persistence Layer
Implements `src/persistence/`.

Deliverables:
- `src/persistence/db.ts` (Dexie schema)
- `src/persistence/SettingsRepo.ts`
- `src/persistence/TeamRepo.ts`
- `src/persistence/MatchRepo.ts`

### Agent D — Config & CI
Sets up project config, scripts, and pipeline.

Deliverables:
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `.eslintrc.cjs`
- `.prettierrc`
- `localPipeline.sh`
- `README.md`

---

## Integration protocol

1. Agent D runs first to produce the project scaffold.
2. Agents A, B, C may run in parallel after the scaffold exists.
3. Agent A must finish before Agent B runs `GameScene.ts` (GameScene wires SimulationCore events to Phaser sprites).
4. Any agent that adds a new exported type to `src/core/types.ts` must note it in a comment at the top of that file.
5. No agent may change another agent's files without a note in the commit message.

---

## Naming conventions

- Files: `PascalCase.ts` for classes, `camelCase.ts` for pure functions/modules
- Classes: PascalCase
- Interfaces: PascalCase with no `I` prefix
- Event names: SCREAMING_SNAKE_CASE string literals
- Command names: PascalCase (e.g., `MoveLeft`, `Fire`)
- Test files: `*.test.ts` co-located with source or under `tests/`

---

## Key invariants to preserve

1. `SimulationCore.step()` is the only entry point for advancing game state. Nothing else may mutate game state directly.
2. `CollisionMask.carveCircle()` is the only entry point for terrain destruction. Always marks dirty chunks.
3. Weapon ammo is consumed exactly once, at the commit point in `WeaponExecution` state. Never in `AIMING`.
4. The `WORLD_SETTLING` state always runs after any weapon or character motion — it must never be skipped.
5. Dead characters are never included in turn rotation.
6. The terrain generation seed produces identical results for the same `(seed, generatorVersion, width, height, themeId)` tuple on any platform.
