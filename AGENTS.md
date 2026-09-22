# AGENTS.md

Guidance for coding agents (and humans) working on Allium Assault.

## Project

Turn-based 3D artillery game in the spirit of Worms Armageddon, starring garlic buddies. Runs
entirely in the browser as a static site: local hot-seat and human-vs-AI.

- Stack: TypeScript (strict), Babylon.js 9 (`@babylonjs/core`), Vite 8, Vitest 5, Playwright on
  Google Chrome; ESLint (typescript-eslint type-checked), Prettier, Stylelint, markdownlint.
  Dependencies are pinned to exact versions; `overrides` in `package.json` pins patched transitive
  dependencies.
- Real 3D graphics only — no pixel or voxel art. The earlier 2D prototypes were discarded; do not
  reference or restore them.

## Layout

| Path                      | Contents                                                                                                                                                                                                            | Rule                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/core/`               | Game rules: terrain field, marching squares, physics, weapon table, sheep/flyer/strike actors, napalm flames, crates, match state machine, AI; `match.ts` the vocabulary a match is made of, `assert.ts` invariants | Pure TypeScript — no Babylon, no DOM. Unit tested.               |
| `src/render/`             | Babylon.js scene, terrain mesh, buddies, effects, camera                                                                                                                                                            | Reads core state and events, never changes rules                 |
| `src/ui/`                 | HTML/CSS overlay: menus, setup, about, HUD; `settings.ts` persisted settings, `dom.ts` element lookup                                                                                                               |                                                                  |
| `src/audio.ts`            | Web Audio synthesizer; every sound is generated, no asset files                                                                                                                                                     |                                                                  |
| `src/app.ts`              | Frame loop, input, event dispatch, `window.__allium` test hook                                                                                                                                                      |                                                                  |
| `tests/`                  | Vitest core tests                                                                                                                                                                                                   |                                                                  |
| `bench/`                  | `core.bench.ts`, the stage-by-stage measurement behind `npm run profile`                                                                                                                                            | Numbers and method live in `docs/PERFORMANCE.md`                 |
| `e2e/`                    | Playwright tests in Google Chrome: `game.spec.ts` (flows, settings, about), `weapons.spec.ts` (one test per weapon), `features.spec.ts` (crates, tombstones, sceneries, sounds, HUD), helpers in `support.ts`       | Every new weapon or feature gets an E2E test                     |
| `scripts/`                | `spdx.mjs` (SPDX check and fixer), `capture-media.mjs` (README screenshots and GIF), `history_chart.py` (README growth and coverage chart)                                                                          |                                                                  |
| `.github/`                | Workflows, Dependabot, `CONTRIBUTING.md`, `SECURITY.md` — where GitHub looks for them                                                                                                                               |                                                                  |
| `REUSE.toml`, `LICENSES/` | REUSE annotations for files without headers, license texts                                                                                                                                                          |                                                                  |
| `docs/`                   | `README-index`, `VISION.md`, `ARCHITECTURE.md` (C4 + Mermaid), `PLAN.md`, `PERFORMANCE.md`, `SOUND.md`, `I18N.md`, `archive/`                                                                                       |                                                                  |
| `docs/tasks.md`           | Every request with status and version                                                                                                                                                                               | Update in every commit: add new requests, tick off finished ones |
| `docs/review.md`          | Latest code and architecture review with resolutions                                                                                                                                                                |                                                                  |

Core emits `GameEvent`s; renderer, HUD and audio consume them. Continuous state (charge level,
projectiles in flight) is read from the game every frame instead.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint       # ESLint (type-checked), Prettier, Stylelint, markdownlint, SPDX check
npm run format     # apply Prettier, Stylelint and markdownlint fixes
npm run spdx:fix   # add SPDX headers to new files
npm run lint:reuse # official REUSE check (needs uv)
npm run typecheck
npm test           # Vitest
npm run profile    # measure the rules core stage by stage (bench/, see docs/PERFORMANCE.md)
npm run coverage   # Vitest with v8 coverage of src/core (thresholds enforced), report in coverage/
npm run e2e        # Playwright, Google Chrome, builds and serves on :4173
npm run verify     # lint, typecheck, test, build, e2e
npm run capture-media -- http://localhost:4173   # regenerate README media from a preview build
python3 scripts/history_chart.py                 # redraw the README history chart (needs matplotlib)
```

## Working rules

- **Controls:** Enter = jump, Backspace = back-flip, Space hold/release = charge and fire (Space
  again detonates sheep), arrows walk, aim and steer the flying sheep, Tab cycles; 1–9 and 0 select
  the first ten weapons, Shift+1–9 and Shift+0 the next ten, and anything past those twenty gets a
  letter key of its own in `LETTER_KEYS` (T teleport, V Ming vase, F flamethrower). A click on the
  map calls strikes.
- **Adding a weapon:** definition in `src/core/weapons.ts` (kind, ammo, `special`, and `look`:
  projectile model, flight/fire/hit sounds, muzzle flash — presentation never switches on ids), appended to
  `WEAPON_ORDER` so existing hotkeys stay; behaviour in `Game` for new kinds (a timed action is a new `TurnAction` variant stepped by
  `stepAction`; a new phase goes into `COUNTDOWN_PHASES`/`ACTION_PHASES`); held model in `buddyView.ts`, projectile model in
  `effects.ts`, sounds in `app.ts`/`audio.ts`; README and VISION tables; unit test and E2E test.
  The AI picks up projectile, strike and melee weapons from their kind.
- **Player-facing text:** every string a player reads goes through `t()` from `src/ui/i18n.ts`, and
  every weapon name through `weaponName()`. `src/core` must never hold a sentence: where the rules
  need to say something they emit an id and its numbers, and the interface phrases it. A new key
  goes into all four catalogues — the tests check. See [docs/I18N.md](docs/I18N.md).
- **Invariants:** no non-null assertions in `src` — use `defined()` from `src/core/assert.ts` or
  `query()` from `src/ui/dom.ts`, which fail with a clear message.
- **Babylon imports:** always from the symbol's own module (`@babylonjs/core/Meshes/meshBuilder`),
  never from the package root — the root is a barrel that drags the whole engine into the bundle.
  Parts of Babylon's API are installed on `Scene.prototype` by a side-effect module and must be
  imported by name as well (`import '@babylonjs/core/Culling/ray'` for picking); such a gap builds
  and typechecks fine and only the browser suite catches it.
- **Verification:** `npm run verify` must be green before every commit. Add or update unit tests
  for rule changes and E2E checks for user-visible flows.
- **E2E in headless Chrome** renders with SwiftShader at about 2 fps: drive tests through
  `window.__allium` (`state()`, `startMatch()`, `fastForward()`, `stepFrames()`) instead of
  waiting on real time.
- **Licensing (SPDX / REUSE):** every file carries `SPDX-FileCopyrightText` and
  `SPDX-License-Identifier` headers (GPL-3.0-or-later), or is annotated in `REUSE.toml` (Markdown,
  JSON, images). `npm run spdx:fix` adds headers to new files, `npm run lint:spdx` checks (part of
  `npm run lint`), `npm run lint:reuse` runs the official REUSE tool (needs uv); CI runs it too.
- **Commits:** small and atomic, Conventional Commit messages (`feat(core): …`, `fix(render): …`,
  `docs: …`) with a body explaining why.

## Versioning

[Semantic Versioning](https://semver.org/).

- **Every commit bumps the version** in `package.json` / `package-lock.json`
  (`npm version X.Y.Z --no-git-tag-version`) and adds a matching `CHANGELOG.md` section.
  Patch for fixes, docs, balance and dependency updates; minor for features; major for breaking
  changes.
- **Do not tag commits.** A `vX.Y.Z` tag is created only when a release is published; pushing
  the tag runs `.github/workflows/release.yml` (verify, zip the build, GitHub release). Push at
  most one tag per push — GitHub skips workflows when more than three tags arrive at once.
- Never push, tag or publish without being asked.
