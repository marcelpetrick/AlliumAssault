# Allium Assault

‼️ **NOTE: stopped development, Don't like the way this went.** ‼️

A turn-based 2D artillery game starring garlic clove characters — think Worms Armageddon but cuter, smellier, and entirely browser-native.

Play locally in Firefox, Chromium, or Safari. No account, no server, no internet required after the first load.

**Author: Marcel Petrick <mail@marcelpetrick.it>**

**Note: projected is generated with AI.**

**License: GPLv3 or later. See `LICENSE`.**

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:5173
```

## Full validation pipeline

Runs format check → typecheck → lint → tests → production build:

```bash
bash localPipeline.sh
```

---

## What it is

- **Turn-based hot-seat**: 2–4 teams of 1–4 garlic characters each.
- **Human vs AI**: any team slot can be set to an AI controller (Easy / Normal / Hard / Expert).
- **Destructible pixel terrain**: every explosion permanently carves the landscape.
- **Physics**: ballistic projectiles with gravity and per-weapon wind influence.
- **Three launch weapons**: Bazooka, Impact Clove (contact grenade), Garlic Uppercut (melee punch).
- **No backend**: all data stored in IndexedDB — teams, settings, match history.
- **PWA**: installable offline after first load.

---

## Controls

| Action | Key |
|---|---|
| Move | ← → |
| Jump forward | Space |
| Jump backward | Shift + Space |
| Select weapon | 1–9 or Tab |
| Adjust aim | ↑ ↓ |
| Charge power | hold Space |
| Fire | release Space |
| Cancel aim | Escape |
| End turn | Backspace |
| Pan camera | Mouse drag or hold mouse at screen edge |
| Zoom | Mouse wheel |

---

## Project layout

```
src/
├── core/          Simulation — zero Phaser imports, pure TypeScript
│   ├── rng/       Seeded PRNG (mulberry32 + SeedManager)
│   ├── noise/     simplex-noise wrapper (SeededNoise2D)
│   ├── terrain/   CollisionMask, TerrainGenerator, SurfaceAnalyzer
│   ├── physics/   CharacterPhysics, ProjectilePhysics, ExplosionSystem
│   ├── weapons/   WeaponDefinition, WeaponRegistry
│   ├── entities/  Character, Team, Projectile
│   ├── state/     MatchStateMachine (explicit FSM)
│   └── simulation/SimulationCore (command/event bus, fixed-step loop)
├── presentation/  Phaser scenes, renderers, HUD, audio
│   ├── scenes/    BootScene, MainMenuScene, MatchSetupScene, GameScene
│   ├── renderers/ TerrainRenderer (chunked, dirty-tracking)
│   ├── hud/       HUD (health bars, timers, wind, weapon panel)
│   └── audio/     AudioManager (Web Audio, per-bus volume)
├── persistence/   Dexie IndexedDB layer
│   ├── db.ts      Schema (settings, teams, statistics, match history)
│   ├── SettingsRepo.ts
│   ├── TeamRepo.ts
│   └── MatchRepo.ts
└── workers/       Web Worker entry points
    └── ai.worker.ts  Trajectory-search AI (off main thread)

data/
└── weapons.json   Weapon definition data (loaded by WeaponRegistry)

tests/
├── core/          Headless unit tests (node environment)
└── persistence/   IndexedDB tests (fake-indexeddb)

documents/
├── 00_VISION.md         Full design specification
├── 01_Development_plan.md  Phased implementation plan with checkboxes
└── AGENTS.md            Agent coordination guide
```

---

## Architecture principles

**Simulation/presentation separation**: `src/core/` never imports Phaser or DOM APIs. The simulation is a pure input→event machine that runs identically in Node (for tests) and in the browser. `src/presentation/` drives Phaser from the event stream.

**Command/event protocol**:

```
Keyboard input
    ↓
Command[]  (MoveLeft, Jump, SelectWeapon, ReleaseCharge …)
    ↓
SimulationCore.step(dt, commands)
    ↓
SimEvent[] (TurnStarted, ProjectileSpawned, TerrainModified, CharacterKilled …)
    ↓
Phaser sprites / sounds / camera / HUD
```

**Destructible terrain**: a `Uint8Array` collision mask owns the physics truth. The `TerrainRenderer` holds 256×256 px chunk textures that are repainted only when marked dirty by `carveCircle`. The visual layer never affects collision.

**Seeded determinism**: a `SeedManager` derives independent named PRNG streams from a root seed. Adding a decoration stream never changes spawn positions. The same seed always produces the same terrain across platforms.

**AI off the main thread**: the AI controller runs in a Vite Web Worker. It receives a serialised `WorldSnapshot` each turn, runs trajectory sampling, and posts back a `Command[]`. The rendering thread never blocks.

---

## Tech stack

| Role | Package | Version |
|---|---|---|
| Game engine | phaser | 4.2.0 (pinned) |
| Bundler | vite | ^5 |
| Language | typescript | ^5.5 |
| Noise | simplex-noise | ^4 |
| IndexedDB | dexie | ^4 |
| PWA | vite-plugin-pwa | ^0.20 |
| Tests | vitest | ^2 |

---

## Weapon definitions

Weapons are data-driven via `data/weapons.json`. Every `WeaponDefinition` field is documented in `src/core/weapons/WeaponDefinition.ts`. Adding a new weapon requires only a JSON entry — no code changes.

Default inventory per team:

| Weapon | Ammo | Notes |
|---|---|---|
| Bazooka | Unlimited | Ballistic, strong wind influence |
| Impact Clove | 5 | Contact-detonating thrown arc |
| Garlic Uppercut | Unlimited | Melee punch, strong launch impulse |
| Classic Grenade | 3 (dev) | Fuse-based, bouncing; hidden from normal UI |

---

## Terrain generation

Terrain is procedurally generated from a string seed in nine steps:

1. **Base envelope** — low-frequency 1D height curve
2. **2D rock fill** — layered simplex noise blended with the height bias
3. **Feature stamps** — deterministic brushes (caves, arches, islands)
4. **Morphological cleanup** — remove noise artefacts, enforce platform thickness
5. **Foundation guarantee** — solid bottom 8% of the world
6. **Surface analysis** — extract walkable positions
7. **Fair team placement** — interleaved horizontal sectors, minimum separation
8. **Terrain painting** — visual-only, handled by `TerrainRenderer`
9. **Validation** — retry with derived seed if spawn requirements fail

The same `(seed, generatorVersion, width, height, themeId)` always produces the same result.

---

## Development scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | Type check without emitting |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `bash localPipeline.sh` | Full CI pipeline |

---

## Adding content

### New weapon
1. Add a JSON object to `data/weapons.json` following the `WeaponDefinition` schema.
2. Add the weapon to the default team inventory in `src/core/entities/Team.ts` if desired.
3. Add a weapon case in `src/presentation/audio/AudioManager.ts` for sound feedback.
4. No other code changes required.

### New terrain theme
1. Add a `themeId` branch in `src/core/terrain/TerrainGenerator.ts` for generation parameters.
2. Add a matching paint function in `src/presentation/renderers/TerrainRenderer.ts`.

### New AI behavior
All AI runs in `src/workers/ai.worker.ts`. The worker receives a `WorldSnapshot` and returns `Command[]`. It shares no state with the main thread.

---

## Browser requirements

- WebGL 2 (required — Canvas 2D fallback not supported)
- IndexedDB (required — all persistence)
- Web Workers (required — AI controller)
- Web Audio API (required — sound effects)

Tested targets: Firefox 130+, Chromium 127+, Safari 18+.

---

## License

See `LICENSE`. Game mechanics are inspired by Team17's Worms series but all design, art, and code are original.
