# Allium Assault — Architecture (C4)

This document describes the architecture of Allium Assault using the [C4 model](https://c4model.com/):
system context, containers, components, and the dynamic flows that matter most. Diagrams are
[Mermaid](https://mermaid.js.org/) and render directly on GitHub.

## 1. Goals and constraints

| Goal | Consequence in the design |
|---|---|
| Looks good in 3D, no pixel/voxel art | Babylon.js scene with PBR-style lighting, shadows, post-processing; smooth meshes from a density field |
| Plays like Worms | Explicit match state machine, fixed 60 Hz simulation, arbitrarily destructible terrain |
| Browser only, no backend | Static Vite build; all state lives in the tab (mute flag in `localStorage`) |
| Testable | Rules in a headless core with no Babylon/DOM imports; `window.__allium` hook for Playwright |

## 2. Level 1 — System context

```mermaid
C4Context
  title System context — Allium Assault

  Person(player, "Player", "Plays hot-seat or against the AI with keyboard and mouse")
  Person(dev, "Developer", "Changes code, pushes commits and release tags")

  System(game, "Allium Assault", "Static browser game: TypeScript, Babylon.js, Web Audio")

  System_Ext(host, "Static web host", "Any HTTP file server serving the build or unzipped release")
  System_Ext(fonts, "Google Fonts", "Optional Fredoka web font; system fonts are the fallback")
  System_Ext(github, "GitHub", "Repository, Actions CI, Releases")

  Rel(player, game, "Plays in", "Modern browser, WebGL2")
  Rel(host, game, "Serves static files", "HTTP")
  Rel(game, fonts, "Loads font stylesheet", "HTTPS")
  Rel(dev, github, "Pushes commits and release tags vX.Y.Z")
  Rel(github, host, "Provides zipped web build", "Release asset")
```

There is no server-side component: once the files are delivered, the game runs entirely in the
player's browser tab.

## 3. Level 2 — Containers

```mermaid
C4Container
  title Containers — inside the browser tab

  Person(player, "Player")

  System_Boundary(tab, "Allium Assault (browser tab)") {
    Container(ui, "UI overlay", "HTML, CSS, TypeScript", "Title, match setup, HUD, pause, help, victory — src/ui")
    Container(app, "App shell", "TypeScript", "Engine lifetime, fixed 60 Hz loop, input, event routing — src/app.ts")
    Container(core, "Game core", "Pure TypeScript", "Rules, terrain, physics, weapons, AI — src/core")
    Container(render, "3D renderer", "Babylon.js 9", "Scene, meshes, effects, camera — src/render")
    Container(audio, "Sound synthesizer", "Web Audio API", "Generated sound effects — src/audio.ts")
  }

  System_Ext(gpu, "WebGL2", "GPU via the browser")
  System_Ext(webaudio, "Web Audio", "Browser audio output")

  Rel(player, ui, "Clicks menus and weapon slots")
  Rel(player, app, "Keyboard, mouse wheel, drag")
  Rel(app, core, "Commands, step(1/60)")
  Rel(core, app, "GameEvent[] via drainEvents()")
  Rel(app, render, "handleEvents, update, render")
  Rel(app, ui, "handleEvents, update, menu actions")
  Rel(app, audio, "play(sfx)")
  Rel(render, core, "Reads match state")
  Rel(render, gpu, "Draws frames")
  Rel(audio, webaudio, "Oscillators and filtered noise")
```

| Container | Path | May import |
|---|---|---|
| Game core | `src/core/` | only other core modules and `simplex-noise` — **no Babylon, no DOM** |
| 3D renderer | `src/render/` | core (read-only), Babylon.js |
| UI overlay | `src/ui/` | core types, render themes, DOM |
| App shell | `src/app.ts`, `src/main.ts` | everything |
| Sound | `src/audio.ts` | Web Audio only |

## 4. Level 3 — Components

### 4.1 Game core

```mermaid
C4Component
  title Components — game core (src/core)

  Container_Boundary(core, "Game core") {
    Component(game, "Game", "game.ts", "Match state machine, commands, weapon execution, damage, events")
    Component(ai, "AiDriver and planAttack", "ai.ts", "Samples trajectories, scores blasts, drives Game commands")
    Component(terrain, "Terrain", "terrain.ts", "Density field, seeded generation, carve, spawn search, dirty chunks")
    Component(contour, "contourRegion", "contour.ts", "Marching squares: fill triangles and oriented edges")
    Component(physics, "Physics", "physics.ts", "stepBody for buddies, stepProjectile for shells")
    Component(weapons, "Weapon table", "weapons.ts", "Fifteen weapon definitions by kind, fragments, hotkey mapping")
    Component(actors, "Weapon actors", "sheep.ts, flyer.ts, strike.ts", "Hopping sheep, steerable flyer, strike drop planning")
    Component(crates, "Crates", "crates.ts", "Seeded crate contents and free land spots")
    Component(support, "rng, math, constants", "rng.ts, math.ts, constants.ts", "Seeded streams, helpers, tuning values")
  }

  Rel(game, terrain, "Generates, carves, queries")
  Rel(game, physics, "Steps bodies and projectiles")
  Rel(game, weapons, "Reads definitions")
  Rel(game, actors, "Steps sheep and flyers, plans strikes")
  Rel(game, crates, "Rolls crates at turn starts")
  Rel(game, ai, "update() during AI turns")
  Rel(ai, game, "selectWeapon, face, pressFire, releaseFire")
  Rel(ai, physics, "Simulates candidate shots")
  Rel(physics, terrain, "sample, distance, normal")
  Rel(terrain, support, "Seeded noise streams")
```

**Terrain model.** A `Float32Array` of 513 × 257 nodes (world 128 × 64 units, one node every
0.25 units). Values above zero are rock and approximate the distance to the surface, clamped to
±4. This single field serves every consumer:

- physics derives smooth collision normals from its gradient,
- explosions subtract a disc with `min(field, distance − radius)`,
- the renderer extracts the surface with marching squares.

**Match state.** `Game` is the only place that mutates match state. Input arrives as commands
(`jump`, `selectWeapon`, `pressFire`, …) or as the held `input` flags; results leave as typed
`GameEvent`s.

### 4.2 Renderer and UI

```mermaid
C4Component
  title Components — renderer (src/render) and UI (src/ui)

  Container_Boundary(render, "3D renderer") {
    Component(world, "World", "world.ts", "Scene, lights, cascaded shadows, post-processing, camera director, event routing")
    Component(tv, "TerrainView", "terrainView.ts", "Rebuilds dirty 32×32-cell chunks into bevelled slabs")
    Component(env, "Environment", "environment.ts", "Sky and water shaders, hills, thin-instanced forests, clouds")
    Component(deco, "Decorations", "decorations.ts", "Thin-instanced grass, flowers, pebbles, mushrooms")
    Component(buddy, "BuddyView and BuddyKit", "buddyView.ts", "Lathe garlic models, faces, squash and stretch, weapons")
    Component(fx, "Effects", "effects.ts", "Particles, shockwave, flash light, tracers, projectiles, reticle")
    Component(themes, "Themes and textures", "themes.ts, textures.ts", "Palettes and procedural grain and normal maps")
  }

  Container_Boundary(ui, "UI overlay") {
    Component(hud, "Hud", "hud.ts", "Turn card, timer, wind, weapon bar, team bars, name tags, floaters")
    Component(menu, "Menu", "menu.ts, presets.ts", "Title, custom setup, help, pause, victory")
  }

  Container(core, "Game core", "src/core")

  Rel(world, tv, "update()")
  Rel(world, env, "update(time, eye)")
  Rel(world, deco, "clearAround() on explosions")
  Rel(world, buddy, "update() per buddy")
  Rel(world, fx, "explosion, splash, tracer, syncProjectiles")
  Rel(tv, core, "contourRegion, Terrain.sample")
  Rel(world, themes, "Palette and lighting")
  Rel(hud, world, "project() world to screen")
  Rel(hud, core, "Reads phase, timers, ammo, HP")
```

## 5. Dynamic view — one frame

```mermaid
sequenceDiagram
  autonumber
  participant R as Browser render loop
  participant A as App
  participant G as Game
  participant W as World
  participant H as Hud
  participant S as Audio

  R->>A: advance(dt)
  loop while accumulator ≥ 1/60 s (at most 8 steps)
    A->>G: syncInput() — human turns only
    A->>G: step(1/60)
    Note over G: AI update → aim and charge → buddies → projectiles → phase
  end
  A->>G: drainEvents()
  A->>W: handleEvents(events)
  A->>H: handleEvents(events)
  A->>S: play(sfx) per event
  A->>W: update(dt) — rebuild dirty terrain, animate, move camera
  A->>W: render()
  A->>H: update(dt) — project name tags and floaters
```

The simulation runs at a fixed step, independent of the frame rate. `stepFrames(n, dt)` on the
test hook swaps the real-time loop for exact frames, which is how the README GIF was recorded.

## 6. Dynamic view — turn state machine

```mermaid
stateDiagram-v2
  [*] --> turnStart: beginTurn()
  turnStart --> aiming: after 1.2 s
  aiming --> retreat: last shot of the weapon fired, strike called, self-destruct settles
  aiming --> guiding: sheep or flying sheep released
  guiding --> retreat: Space, impact, fuse or turn time detonates it
  aiming --> torching: blowtorch lit
  torching --> retreat: after 3 s
  aiming --> firing: minigun burst
  firing --> retreat: last bullet
  aiming --> settling: timer runs out, active buddy hurt or drowned, skipTurn()
  retreat --> settling: retreat timer ends or active buddy hurt
  settling --> deaths: everything at rest for 0.6 s (15 s cap)
  deaths --> settling: a buddy at 0 HP explodes
  deaths --> turnStart: two or more teams alive
  deaths --> gameOver: one or no team alive
  gameOver --> [*]
```

Rules enforced here:

- ammo is consumed on a weapon's first shot,
- in `guiding`, `torching` and `firing` the buddy cannot move; the turn timer keeps running in
  `guiding` and `torching`,
- crates teleport in at turn starts from a seeded stream, so maps replay identically,
- the turn only ends once the world has settled,
- death explosions are queued one at a time, so chain reactions resolve deterministically.

## 7. Dynamic view — an explosion

```mermaid
flowchart LR
  hit["Projectile hits or fuse ends"] --> explode["Game.explode()"]
  explode --> carve["Terrain.carve()<br/>field = min(field, d − r)<br/>scorch rim, mark dirty chunks"]
  explode --> dmg["Radial damage and knockback"]
  explode --> evt["explosion event"]
  evt --> fx["World: particles, shockwave, flash, camera hold"]
  evt --> deco["Decorations.clearAround()"]
  carve -. next frame .-> mesh["TerrainView.update()<br/>contourRegion() per dirty chunk → VertexData"]
  dmg --> bodies["Physics: flight, fall damage, drowning"]
```

## 8. Dynamic view — AI turn

```mermaid
flowchart TD
  think["AiDriver: think delay"] --> plan["planAttack()"]
  plan --> sample["Every projectile weapon, both facings:<br/>sample aim × power, simulateShot()<br/>(coarser grid for limited ammo)"]
  plan --> special["Replay sheep hops, check flying sheep launch,<br/>score strike targets, torch through walls, self-destruct"]
  plan --> melee["Punch or bat if adjacent (simulated knock-outs),<br/>shotgun or minigun in line of sight"]
  special --> score
  sample --> score["scoreBlast(): enemy damage + kill bonus<br/>− weighted friendly and self damage"]
  melee --> score
  score --> noise["Add aim and power error by difficulty"]
  noise --> act["selectWeapon, face, aim via input,<br/>pressFire, releaseFire at planned power"]
  act --> more{"Weapon has shots left?"}
  more -- yes --> replan["Re-plan restricted to the current weapon"] --> act
  more -- no --> retreat["Walk away during retreat"]
```

Planning runs on the main thread. With the full arsenal a hard AI decision takes about 35–50 ms
in the Node benchmark, a short hitch once per AI turn (see `review.md`, finding 1). The AI can
also detour to a nearby crate when it has no good shot, and steers flying sheep while guiding.

## 9. Deployment and delivery

```mermaid
flowchart LR
  dev["Developer"] -- "push master / pull request" --> ci["CI workflow<br/>lint, typecheck, Vitest, build,<br/>Playwright in Google Chrome"]
  dev -- "push tag vX.Y.Z" --> rel["Release workflow<br/>verify, build, zip + SHA-256,<br/>notes from CHANGELOG"]
  dev -- "push tag vX.Y.Z" --> pages["Pages workflow<br/>build, deploy dist/"]
  pages --> site[("GitHub Pages<br/>marcelpetrick.github.io/AlliumAssault")]
  rel --> release[("GitHub Release")]
  release --> host["Any static web server"]
  host --> browser["Player's browser"]
  site --> browser
```

Every commit on `master` carries its own SemVer version in `package.json` and a `CHANGELOG.md`
entry; only releases get a `vX.Y.Z` tag. See the Versioning section of the README and `AGENTS.md`.

## 10. Key decisions

| Decision | Alternatives considered | Why |
|---|---|---|
| Custom density-field terrain and physics | Physics engines (Havok, Box2D, Planck) | General engines handle arbitrarily destructible terrain poorly; one field keeps physics and rendering consistent |
| Babylon.js | Three.js, Phaser, Unity WebGL | Complete engine (shadows, post-processing, particles, glow) with a small integration surface; 3D was a hard requirement |
| Gameplay on a 2D plane, rendered in 3D | Full 3D gameplay | Keeps Worms-style aiming and tactics while the presentation is fully 3D |
| HTML/CSS overlay for UI | Babylon GUI | Crisp text, standard layout and styling, easy Playwright selectors |
| Events out of the core | Renderer polling diffs | Effects, sound and HUD react to exactly what happened, in order |
| Synthesized audio | Sample files | No asset pipeline or licensing; tiny build |

## 11. Quality and testing map

| Level | Tooling | Covers |
|---|---|---|
| Unit | Vitest (`tests/`) | RNG, terrain generation, craters, contouring, body and projectile physics, turns, weapons, deaths, AI plans, a full AI-vs-AI match |
| End-to-end | Playwright + Google Chrome (`e2e/`) | Title demo, a human turn with real keys, AI match to victory, custom setup, pause menu; every weapon with real keys and clicks (`weapons.spec.ts`); crates, audio cues, movement sounds and weapon bar (`features.spec.ts`) — sounds are checked through the synthesizer's play counters |
| Static | ESLint, TypeScript strict | Whole codebase |
| Pipeline | `npm run verify`, GitHub Actions | All of the above on every push; releases and GitHub Pages deployment on tags |
