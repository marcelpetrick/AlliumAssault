# Allium Assault v2 — Plan

## 1. What happened before (history mapping)

| Period | Ref | What was done | Verdict for v2 |
|---|---|---|---|
| 2026-06-26 | `3f0d881` | Vision from a ChatGPT research session: Worms Armageddon rules, garlic theme, browser-only, hot-seat + AI, seeded terrain, bazooka / grenade / punch, 5 s retreat | **Kept** — rules and theme carried into `docs/VISION.md` |
| 2026-06-26 | `f98f673`, `66783e2` | 12-phase plan; "full MVP" in Phaser 4 (FSM, AI worker, Dexie, PWA, 80 tests) | **Replaced** — author stopped: "Don't like the way this went" |
| 2026-06-27 | `d9cb274`…`d2515ab` | Visual fixes on 2D pixel terrain: themes, bigger sprites, trajectory arc, zoom | **Lesson:** fixing 2D pixel visuals after the fact did not produce a pretty game |
| 2026-07-09 | branch `mpe/secondTry_landscape` (14 commits, since deleted) | Restart phase by phase: terrain mask, chunk renderer, physics, 1 worm, bazooka/grenade/shotgun, Enter=jump, Space=charge | **Kept ideas:** controls, fixed-step physics, swept projectiles, charge bar |
| 2026-09-14 | this plan | Rewrite in 3D with Babylon.js | — |

The old code and branch have been removed; only `master` remains.

## 2. Requirements mapping

| Requirement (user) | Implementation |
|---|---|
| Worms clone in the browser | Babylon.js + Vite static site |
| Really 3D, pretty, no pixel/voxel | SDF terrain → marching squares → extruded smooth mesh, PBR-ish lighting, shadows, bloom |
| Team of buddies, move them around | `core/match` teams + turn rotation; `core/physics` walking/jumping |
| Bazooka, grenade, punch (+ similar) | `core/weapons`: bazooka, grenade, punch, shotgun |
| Nice-looking settings | HTML/CSS match setup screen |
| Testable, play it in Chrome | Vitest core tests + Playwright E2E on Google Chrome; `window.__allium` test hook |
| Version bumps, atomic commits | SemVer in `package.json`, `CHANGELOG.md`, tag per milestone |
| One clean branch | Old code removed, old branch deleted |

## 3. Architecture

```
src/
├── core/            pure TypeScript, no Babylon/DOM — unit tested
│   ├── rng.ts           seeded PRNG + string hash
│   ├── vec.ts           2D vector helpers
│   ├── terrain.ts       density field, generation, craters, sampling
│   ├── contour.ts       marching squares (cells → polygons/edges)
│   ├── physics.ts       circle bodies vs field, projectiles
│   ├── weapons.ts       weapon definitions
│   ├── game.ts          match state machine, turns, damage, wind, commands
│   └── ai.ts            trajectory-search AI
├── render/          Babylon.js presentation
│   ├── stage.ts         engine, scene, lights, post-processing, camera
│   ├── terrainMesh.ts   chunked extruded terrain mesh
│   ├── buddy.ts         garlic buddy model + animation
│   ├── environment.ts   sky, hills, trees, water, clouds
│   └── effects.ts       explosions, particles, trajectory preview
├── ui/              HTML/CSS overlay: menu, setup, HUD, pause, victory
├── audio.ts         synthesized Web Audio sound effects
└── main.ts          wiring, input, fixed-step loop, test hook
tests/               Vitest (core)
e2e/                 Playwright (Chrome)
```

Coordinate system: world units, x right, y up, gameplay plane z = 0.
World 128 × 64 units, density grid 0.25 units, water surface y = 3.

## 4. Milestones (each = tagged version, atomic commits inside)

| Version | Milestone | Done when | Status |
|---|---|---|---|
| 0.2.0 | Scaffold: Vite, TS, Babylon, Vitest, Playwright, docs | `npm run verify` green, blank 3D scene in Chrome | ✅ |
| 0.3.0 | Core simulation: terrain, contour, physics, weapons, match FSM, AI | Unit tests cover generation, craters, collision, turns, damage, victory, AI match | ✅ |
| 0.4.0 | 3D rendering: terrain mesh, environment, buddies, effects | Screenshot shows good-looking world | ✅ |
| 0.5.0 | Playable: input, camera, HUD, menus, setup, victory, audio | Full hot-seat / vs-AI match playable in Chrome | ✅ |
| 1.0.0 | E2E suite, README, screenshots | E2E plays in Chrome, all checks green | ✅ |

The AI moved into 0.3.0 because the headless AI-vs-AI match is the strongest core test.

## 5. Verification

- `npm run typecheck` — TypeScript strict
- `npm test` — Vitest core suite
- `npm run build` — production bundle
- `npm run e2e` — Playwright in Google Chrome: menu → setup → match, firing destroys terrain,
  turns advance, AI vs AI match ends with a winner, no console errors, screenshots saved
- `npm run verify` — all of the above

## 6. Current work

Every request, its status, design notes and the version that delivered it are tracked in
[`tasks.md`](../tasks.md), updated with every commit. This section is the plan for the batch in
progress.

### 6.1 Open requests (batch after v1.17.5)

| # | Request | Plan | Status |
|---|---|---|---|
| T27 | Flying sheep steerable with the arrow keys until it explodes | Screen-relative steering with all four arrows, slower flight, longer fuse, AI uses the keys | ✅ 1.18.0 |
| T37 | Play link at the top of the README | GitHub Pages link above the fold | ✅ 1.18.1 |
| T36 | Banana bomb only throws a short distance | Reproduce in the core and in Chrome with real keys; compare with the grenade; fix the cause | 🔍 not reproduced (both fly 63 units at full charge); waiting for details |
| T28 | Sounds louder | Master gain up behind a compressor so big blasts do not clip; raise quiet effects | ☐ |
| T29 | Arsenal option "Infinite supplies" | Third arsenal value: every weapon unlimited; setup option; tests | ☐ |
| T35 | Crate drops noticeable | Teleport sound on spawn (exists, make it louder) plus a short camera pan to the crate at the turn start | ☐ |
| T31 | Comic tombstones for dead buddies | Physics tombstone per death (not drowning), knocked by blasts, sinks; RIP model with name and team ribbon | ☐ |
| T30 | More sceneries, e.g. a candy shop | Candy Shop (lollipop trees, gumdrops, frosting) and Frosty Peaks themes; theme-specific props | ☐ |
| T34 | More README badges like Cullendula | Badges for Pages, Babylon.js, TypeScript, Vite, Vitest, Playwright versions | ☐ |
| T33 | New screenshots and screen recordings in the README | Capture with Playwright in Chrome: weapons, crates, sceneries; GIF recording of a battle | ☐ |
| T32 | Review and update all documents | README, AGENTS, VISION, ARCHITECTURE, PLAN, CHANGELOG consistency with the code | ☐ |
| T12b | Review the batch and test | `/reviewBranch`-style review of the batch into `review.md`, fix findings, full `npm run verify` | ☐ |
| T13b | Publish | Push, release tag, Pages deployment, confirm live | ☐ |

### 6.2 Execution order

1. Gameplay fixes first: T28 volume, T35 crate camera, T29 infinite supplies.
2. New content: T31 tombstones, T30 sceneries.
3. Presentation: T34 badges, T33 screenshots and recordings (after the content they show).
4. T32 documentation pass over every Markdown file.
5. T12b review of the whole batch, fix findings, full verification.
6. T13b push, tag and release; confirm the Pages build is live.

Each task is one atomic commit with its own version bump, tests and a `tasks.md` update.
