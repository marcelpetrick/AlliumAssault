# Allium Assault — Architecture (C4)

This document describes the architecture of Allium Assault using the [C4 model](https://c4model.com/):
system context, containers, components, and the dynamic flows that matter most. Diagrams are
[Mermaid](https://mermaid.js.org/) and render directly on GitHub.

## 1. Goals and constraints

| Goal                                 | Consequence in the design                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Looks good in 3D, no pixel/voxel art | Babylon.js scene with PBR-style lighting, shadows, post-processing; smooth meshes from a density field |
| Plays like Worms                     | Explicit match state machine, fixed 60 Hz simulation, arbitrarily destructible terrain                 |
| Browser only, no backend             | Static Vite build; all state lives in the tab (settings in `localStorage`, under a schema version)     |
| Testable                             | Rules in a headless core with no Babylon/DOM imports; `window.__allium` hook for Playwright            |
| Readable in four languages           | Every player-facing string comes from a catalogue keyed by language, with English as the fallback      |
| Answers for itself at the end        | The rules count the match as they run it, so the scoreboard credits what actually happened             |

## 2. Level 1 — System context

```mermaid
C4Context
  title System context — Allium Assault

  Person(player, "Player", "Plays hot-seat or against the AI with keyboard and mouse")
  Person(dev, "Developer", "Changes code, pushes commits and release tags")

  System(game, "Allium Assault", "Static browser game: TypeScript, Babylon.js, Web Audio")

  System_Ext(host, "Static web host", "Any HTTP file server serving the build or unzipped release")
  System_Ext(fonts, "Google Fonts", "Optional Fredoka web font; system fonts are the fallback")
  System_Ext(github, "GitHub", "Repository, Actions CI, Releases, Pages hosting")

  Rel(player, game, "Plays in", "Modern browser, WebGL2; its language picks the interface's")
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
    Container(ui, "UI overlay", "HTML, CSS, TypeScript", "Title, match setup, HUD, pause, help, about, victory, statistics; four languages and persisted settings — src/ui")
    Container(app, "App shell", "TypeScript", "Engine lifetime, fixed 60 Hz loop, input, event routing — src/app.ts")
    Container(core, "Game core", "Pure TypeScript", "Rules, terrain, physics, weapons, AI, match statistics — src/core")
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

| Container   | Path                        | May import                                                                    |
| ----------- | --------------------------- | ----------------------------------------------------------------------------- |
| Game core   | `src/core/`                 | only other core modules and `simplex-noise` — **no Babylon, no DOM**          |
| 3D renderer | `src/render/`               | core (read-only), Babylon.js — always per module, never the package root      |
| UI overlay  | `src/ui/`                   | core types, `render/themes` and `render/quality` (both Babylon-free), the DOM |
| App shell   | `src/app.ts`, `src/main.ts` | everything                                                                    |
| Sound       | `src/audio.ts`              | Web Audio only                                                                |

Two import rules are checked rather than trusted. `tests/imports.test.ts` fails on
`from '@babylonjs/core'` anywhere in `src`, because the package root is a barrel that re-exports the
whole engine and takes the bundle from 1.5 MB to 6.9 MB; it also insists that any module building a
picking ray asks for `@babylonjs/core/Culling/ray`, the side-effect module that installs
`createPickingRay` on `Scene.prototype`. Neither mistake shows up in a typecheck.

## 4. Level 3 — Components

### 4.1 Game core

```mermaid
C4Component
  title Components — game core (src/core)

  Container_Boundary(core, "Game core") {
    Component(game, "Game", "game.ts", "Match state machine, commands, weapon execution, damage, events")
    Component(match, "Match vocabulary", "match.ts", "Config, buddies, teams, projectiles, phases, turn actions, events and tuning constants; re-exported by game.ts")
    Component(ai, "AiDriver and planAttack", "ai.ts", "Samples trajectories, scores blasts, drives Game commands")
    Component(terrain, "Terrain", "terrain.ts", "Density field, seeded generation, carve, spawn search, dirty chunks; also the arena: water level, gravity scale and placed platforms")
    Component(contour, "contourRegion", "contour.ts", "Marching squares: fill triangles and oriented edges")
    Component(physics, "Physics", "physics.ts", "stepBody for buddies, stepProjectile for shells")
    Component(weapons, "Weapon table", "weapons.ts", "Twenty-four weapons by kind, grouped thematically; fragments, arsenal flags, digit and letter hotkeys")
    Component(actors, "Weapon actors", "sheep.ts, flyer.ts, strike.ts, fire.ts, rope.ts", "Hopping sheep, steerable flyer, strike drop planning, napalm flames that eat into the ground, rope hook and swing")
    Component(crates, "Crates and mines", "crates.ts, mines.ts", "Health, weapon and mystery crates on seeded free land; mystery contents rolled on opening; mine arming, proximity and fuse")
    Component(stats, "MatchStats", "stats.ts", "Counts the match as it runs: damage by culprit, own goals, shots and hits, crates, kills; the honours board at the end")
    Component(support, "rng, math, constants, assert", "rng.ts, math.ts, constants.ts, assert.ts", "Seeded streams, helpers, tuning values, invariants")
  }

  Rel(game, match, "Is the state machine over")
  Rel(game, stats, "fired, damaged, collected, died; summary() at the end")
  Rel(game, terrain, "Generates, carves, queries")
  Rel(game, physics, "Steps bodies and projectiles")
  Rel(game, weapons, "Reads definitions")
  Rel(game, actors, "Steps sheep, flyers and the rope, plans strikes")
  Rel(game, crates, "Rolls crates at turn starts, steps mines every frame")
  Rel(game, ai, "update() during AI turns")
  Rel(ai, game, "selectWeapon, face, pressFire, releaseFire")
  Rel(ai, physics, "Simulates candidate shots")
  Rel(stats, weapons, "Names the weapon of the match")
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
(`jump`, `selectWeapon`, `pressFire`, `strike`, …) or as the held `input` flags (walking, aiming,
steering the flying sheep, swinging the flamethrower's nozzle); results leave as typed `GameEvent`s.
Besides buddies and projectiles the game owns the weapon action in progress — one `TurnAction`
(hopping or flying sheep, rope, blowtorch, drill, minigun burst, flamethrower or a panicking
self-destruct) stepped by `stepAction` — the pending strike drops, and the persistent world objects
(crates, mines, napalm flames, tombstones). Presentation of each weapon (projectile model, sounds,
muzzle flash, whether a hit brings a stadium with it) is declared in `WeaponDef.look`, so renderer
and app never switch on weapon ids.

**Attribution.** A blast carries a `Blame` — the buddy that caused it and the weapon it used —
through `explode()` and `damage()`, and through the chains a blast sets off, so a crate or a mine
touched off by somebody's grenade is still that grenade's doing. This is the one piece of knowledge
only the rules have: a `damage` event says who was hurt, never by whom. `MatchStats` books it, which
is why the scoreboard can tell a kill from an own goal and the player who earned it from the player
whose turn it happened to be.

### 4.2 Renderer and UI

```mermaid
C4Component
  title Components — renderer (src/render) and UI (src/ui)

  Container_Boundary(render, "3D renderer") {
    Component(world, "World", "world.ts", "Scene, lights, cascaded shadows, post-processing, camera director, event routing")
    Component(tv, "TerrainView", "terrainView.ts", "Rebuilds dirty 32×32-cell chunks into bevelled slabs")
    Component(pv, "PlatformView", "platformView.ts", "Placed boards and the placement preview; the terrain owns their collision")
    Component(env, "Environment", "environment.ts", "Sky and water shaders, hills, thin-instanced pines, lollipops or snowy pines, clouds")
    Component(deco, "Decorations", "decorations.ts", "Thin-instanced ground props per scenery style: flowers, gumdrops, snowballs")
    Component(buddy, "BuddyView and BuddyKit", "buddyView.ts", "Lathe garlic models, faces, squash and stretch, weapons")
    Component(fx, "Effects", "effects.ts", "Particles, shockwave, lights, tracers, projectile models, sheep, plane, crates, tombstones, flames, flying earth, strike reticle and teleport cross; sweeps up one-shot systems")
    Component(themes, "Themes and textures", "themes.ts, textures.ts", "Palettes and procedural grain and normal maps")
    Component(quality, "Quality", "quality.ts", "Full or Low, and what each costs — the one render module with no Babylon in it, so the settings can name it")
  }

  Container_Boundary(ui, "UI overlay") {
    Component(hud, "Hud", "hud.ts", "Turn card, timer, wind, gravity badge, two-row weapon bar, team bars, name tags, floaters")
    Component(menu, "Menu", "menu.ts, presets.ts, mapPreview.ts", "Title, custom setup (gravity, crates, arsenal, graphics, language, seed with a live map preview), help, about, pause, victory and the statistics screen")
    Component(settings, "Settings", "settings.ts", "What the browser remembers, under a schema version, with a migration for anything an older build wrote")
    Component(i18n, "Catalogues", "i18n.ts, i18nWeapons.ts", "English, German, Croatian and Mandarin; English holds every key and is the fallback")
    Component(dom, "dom", "dom.ts", "query() and queryAs(): element lookup that fails loudly instead of returning null")
  }

  Container(core, "Game core", "src/core")

  Rel(world, tv, "update()")
  Rel(world, env, "update(time, eye)")
  Rel(world, deco, "clearAround() on explosions")
  Rel(world, buddy, "update() per buddy")
  Rel(world, fx, "explosion, splash, tracer, syncProjectiles")
  Rel(tv, core, "contourRegion, Terrain.sample")
  Rel(world, themes, "Palette and lighting")
  Rel(world, quality, "Built for Full or Low, once")
  Rel(hud, world, "project() world to screen")
  Rel(hud, core, "Reads phase, timers, ammo, HP")
  Rel(hud, i18n, "t(), weaponName(), weaponBlurb()")
  Rel(menu, i18n, "t() for every screen")
  Rel(menu, settings, "load, save, migrate")
  Rel(menu, core, "Renders the MatchSummary the app hands it")
  Rel(settings, quality, "Validates the stored graphics setting")
  Rel(hud, dom, "Looks its own elements up")
  Rel(menu, dom, "Looks its own elements up")
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
  turnStart --> aiming: after 1.2 s (+1.3 s for a crate, +1.4 s while the Sudden Death water climbs)
  aiming --> retreat: last shot of the weapon fired, strike called, self-destruct settles
  aiming --> guiding: sheep or flying sheep released
  guiding --> retreat: Space, impact, fuse or turn time detonates it
  aiming --> torching: blowtorch lit
  torching --> retreat: after 3 s
  aiming --> drilling: drill started
  drilling --> retreat: after 3 s
  aiming --> firing: minigun burst
  firing --> retreat: last bullet
  aiming --> spraying: flamethrower opened
  spraying --> retreat: after 3 s of fuel
  aiming --> roping: hook fired
  roping --> aiming: landed again — the rope is a utility, not the turn's shot
  roping --> settling: turn time runs out mid-swing
  aiming --> panicking: self-destruct triggered
  panicking --> settling: three seconds of "Oh no!", then the blast
  aiming --> retreat: platform placed or teleport used
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
- in `guiding`, `torching`, `drilling`, `spraying`, `roping` and `firing` the buddy cannot walk; the
  turn timer keeps running in all but `firing` (`COUNTDOWN_PHASES`), and hurting the active buddy in
  any of them ends the turn (`ACTION_PHASES`),
- `roping` is the one action phase that returns to `aiming` rather than ending the turn: the rope
  moves the buddy instead of attacking with it, so once it lands it may still take its shot — and
  the rope is only charged for once its hook actually bites,
- `spraying` still reads the up and down keys, because steering the nozzle mid-burst is the whole
  point of the flamethrower; the nozzle swings past the limits the ordinary aim is held to,
- the active buddy takes no fall damage while drilling,
- crates teleport in at turn starts from a seeded stream, so maps replay identically — one per turn
  by chance, or a fixed number under "Cratyness",
- a mystery crate's contents are rolled from that same stream when somebody opens it, not when it
  drops, so nothing about the box on the map gives the answer away and a seed still replays,
- Sudden Death raises the water one unit per turn start, never by the second, so sitting a turn out
  never floods faster than playing it,
- a buddy that dies during its own turn intro hands the turn straight on,
- the turn only ends once the world has settled — projectiles, sheep, strike drops, crates,
  napalm flames, tombstones and any mine still counting down included,
- death explosions are queued one at a time, so chain reactions resolve deterministically.

## 7. Dynamic view — an explosion

```mermaid
flowchart LR
  hit["Projectile hits or fuse ends"] --> explode["Game.explode(…, blame)"]
  explode --> carve["Terrain.carve()<br/>field = min(field, d − r)<br/>scorch rim, mark dirty chunks"]
  explode --> dmg["Radial damage and knockback"]
  explode --> chain["Crates and mines in reach<br/>explode in turn, same blame"]
  chain --> fire["A burst crate leaves<br/>a few short-lived flames"]
  explode --> evt["explosion event"]
  evt --> fx["World: particles, shockwave, flash, camera hold"]
  evt --> deco["Decorations.clearAround()"]
  carve -. next frame .-> mesh["TerrainView.update()<br/>contourRegion() per dirty chunk → VertexData"]
  dmg --> bodies["Physics: flight, fall damage, drowning"]
  dmg --> stats["MatchStats.damaged(blame, …)"]
```

Each crate and mine is taken out of its list before its own blast, so a chain can never come back
round to it and nothing is counted twice. The blame travels with the chain: the grenade that started
it gets the credit, not the crate it happened to touch.

## 8. Dynamic view — AI turn

```mermaid
flowchart TD
  think["AiDriver: think delay"] --> plan["planAttack()"]
  plan --> sample["Every projectile weapon, both facings:<br/>sample aim × power, simulateShot()<br/>(coarser grid for limited ammo)"]
  plan --> special["Replay sheep hops, check flying sheep launch,<br/>score strike targets, torch through walls,<br/>drill down, self-destruct"]
  plan --> melee["Punch or bat if adjacent (simulated knock-outs),<br/>shotgun or minigun in line of sight"]
  special --> score
  sample --> score["scoreBlast(): enemy damage + kill bonus<br/>− weighted friendly and self damage"]
  melee --> score
  score --> cost["Subtract what reaching for it costs:<br/>limited ammo, uses already spent,<br/>a cluster weapon's whole payload"]
  cost --> noise["Add aim and power error by difficulty"]
  noise --> shop{"Is a crate worth more<br/>than the best shot?"}
  shop -- "walkable" --> walk["Walk to it"]
  shop -- "rope, and rock overhead" --> swing["Fire the hook, swing across,<br/>reel in, let go over the crate<br/>(abandoned after 9 s)"]
  shop -- no --> act["selectWeapon, face, aim via input,<br/>pressFire, releaseFire at planned power"]
  act --> more{"Weapon has shots left?"}
  more -- yes --> replan["Re-plan restricted to the current weapon"] --> act
  more -- no --> retreat["Walk away during retreat"]
```

Planning runs on the main thread. With the full arsenal a hard decision measures about 30 ms on the
development machine — a hitch of a frame or two, once per AI turn, hidden behind the think delay.

Two things keep it from playing the same turn over and over. Reaching for a weapon costs something
before its blast is even scored: a flat charge for anything limited, a share of the weapon's whole
payload divided by how much is left, and a growing penalty for a weapon this team has already leant
on — a little even for one it can never run out of. Without that the AI found the single
highest-scoring weapon and played it until the ammo ran out, which for the concrete mule was almost
anywhere and for the Ming vase was turn one of every match. And Normal and Hard go shopping: they
already valued crates, and now reach the ones walking cannot get to by firing the rope and swinging
across. The swing is abandoned after nine seconds however it is going, because a traversal that is
not working must never eat the turn.

## 9. Deployment and delivery

```mermaid
flowchart LR
  dev["Developer"] -- "push master / pull request" --> ci["CI workflow<br/>linters, typecheck, Vitest, build,<br/>Playwright in Google Chrome,<br/>REUSE check, actionlint"]
  dev -- "push tag vX.Y.Z" --> rel["Release workflow<br/>lint, typecheck, coverage, build,<br/>Playwright, tag = package.json,<br/>zip + SHA-256, notes from CHANGELOG"]
  dev -- "push tag vX.Y.Z" --> pages["Pages workflow<br/>lint, typecheck, coverage, build,<br/>Playwright, then deploy dist/"]
  pages --> site[("GitHub Pages<br/>marcelpetrick.github.io/AlliumAssault")]
  rel --> release[("GitHub Release")]
  release --> host["Any static web server"]
  host --> browser["Player's browser"]
  site --> browser
```

Every commit on `master` carries its own SemVer version in `package.json` and a `CHANGELOG.md`
entry; only releases get a `vX.Y.Z` tag. See the Versioning section of the README and `AGENTS.md`.

All three workflows run the browser suite, the release one included: a tag cannot publish a build
that the only gate watching the renderer actually run has not seen. The release also refuses to
publish unless the tag matches the version in `package.json`.

## 10. Key decisions

| Decision                                    | Alternatives considered                | Why                                                                                                                     |
| ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Custom density-field terrain and physics    | Physics engines (Havok, Box2D, Planck) | General engines handle arbitrarily destructible terrain poorly; one field keeps physics and rendering consistent        |
| Babylon.js                                  | Three.js, Phaser, Unity WebGL          | Complete engine (shadows, post-processing, particles, glow) with a small integration surface; 3D was a hard requirement |
| Gameplay on a 2D plane, rendered in 3D      | Full 3D gameplay                       | Keeps Worms-style aiming and tactics while the presentation is fully 3D                                                 |
| HTML/CSS overlay for UI                     | Babylon GUI                            | Crisp text, standard layout and styling, easy Playwright selectors                                                      |
| Events out of the core                      | Renderer polling diffs                 | Effects, sound and HUD react to exactly what happened, in order                                                         |
| Statistics counted in the core              | Replaying the event log afterwards     | Only the rules know who caused a blast; an event says who was hurt, never by whom                                       |
| Babylon imported per module                 | `from '@babylonjs/core'`               | The package root is a barrel: importing it defeats tree-shaking and quadruples the bundle. Enforced by a unit test      |
| English as the source of truth for text     | A key-per-language catalogue           | Every key exists in one place; other languages are partial and fall back, so a gap shows words rather than an id        |
| Synthesized audio                           | Sample files                           | No asset pipeline or licensing; tiny build                                                                              |
| Type-aware linting, fixes over suppressions | Plain ESLint recommended               | Catches unsafe `any`, unnecessary conditions and non-null misuse in a strict TypeScript codebase                        |
| SPDX headers + REUSE.toml                   | License notice in README only          | Machine-checkable licensing for every file; enforced in CI                                                              |

## 11. Quality and testing map

| Level      | Tooling                                                                                                    | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit       | Vitest (`tests/`)                                                                                          | RNG, terrain generation, craters, contouring, body and projectile physics, turns, every weapon's rules, crates and mystery boxes, flames, tombstones, hotkeys, persisted settings and their migration, the four catalogues, match statistics and the honours board, AI plans and crate-hunting, a full AI-vs-AI match, and the Babylon import rules                                                                                                                                                                      |
| End-to-end | Playwright + Google Chrome (`e2e/`)                                                                        | Title demo, a human turn with real keys, AI match to victory, custom setup, arsenal, settings persistence and Reset all, graphics budget, languages, one text scale across menu and HUD, the pinned Start button, the statistics screen, about screen, pause menu; every weapon with real keys and clicks (`weapons.spec.ts`); crates and mystery boxes, camera pan, tombstones, sceneries, audio cues, movement sounds and weapon bar (`features.spec.ts`) — sounds are checked through the synthesizer's play counters |
| Static     | TypeScript strict; ESLint (type-checked), Prettier, Stylelint, markdownlint; SPDX check, REUSE, actionlint | Whole codebase                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Coverage   | Vitest v8 over `src/core` (`npm run coverage`)                                                             | Thresholds of 98% on statements, branches, functions and lines, enforced in CI and in every release. `src/render`, `src/ui`, `src/app.ts` and `src/audio.ts` need a GPU or the DOM and are covered by the browser suite instead                                                                                                                                                                                                                                                                                          |
| Profiling  | `npm run profile` over `bench/core.bench.ts`                                                               | One fixed step of the rules core, stage by stage, checked against a tenfold ceiling so an order-of-magnitude regression fails rather than merely printing. Numbers and method in `PERFORMANCE.md`                                                                                                                                                                                                                                                                                                                        |
| Pipeline   | `npm run verify`, GitHub Actions                                                                           | All of the above on every push; releases and GitHub Pages deployment on tags, both gated on the browser suite                                                                                                                                                                                                                                                                                                                                                                                                            |
