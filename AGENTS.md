# AGENTS.md

Guidance for coding agents (and humans) working on Allium Assault.

## Project

Turn-based 3D artillery game in the spirit of Worms Armageddon, starring garlic buddies. Runs
entirely in the browser as a static site: local hot-seat and human-vs-AI.

- Stack: TypeScript (strict), Babylon.js 9 (`@babylonjs/core`), Vite 8, Vitest 5, Playwright on
  Google Chrome. Dependencies are pinned to exact versions.
- Real 3D graphics only — no pixel or voxel art. The earlier 2D prototypes were discarded; do not
  reference or restore them.

## Layout

| Path           | Contents                                                                                                                                                              | Rule                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/core/`    | Game rules: terrain field, marching squares, physics, weapon table, sheep/flyer/strike actors, crates, match state machine, AI                                        | Pure TypeScript — no Babylon, no DOM. Unit tested.               |
| `src/render/`  | Babylon.js scene, terrain mesh, buddies, effects, camera                                                                                                              | Reads core state and events, never changes rules                 |
| `src/ui/`      | HTML/CSS overlay: menus, setup, HUD                                                                                                                                   |                                                                  |
| `src/audio.ts` | Web Audio synthesizer; every sound is generated, no asset files                                                                                                       |                                                                  |
| `src/app.ts`   | Frame loop, input, event dispatch, `window.__allium` test hook                                                                                                        |                                                                  |
| `tests/`       | Vitest core tests                                                                                                                                                     |                                                                  |
| `e2e/`         | Playwright tests in Google Chrome: `game.spec.ts` (flows), `weapons.spec.ts` (one test per weapon), `features.spec.ts` (crates, sounds, HUD), helpers in `support.ts` | Every new weapon or feature gets an E2E test                     |
| `docs/`        | `VISION.md`, `ARCHITECTURE.md` (C4 + Mermaid), `PLAN.md`, `archive/`                                                                                                  |                                                                  |
| `tasks.md`     | Every request with status and version                                                                                                                                 | Update in every commit: add new requests, tick off finished ones |
| `review.md`    | Latest code and architecture review with resolutions                                                                                                                  |                                                                  |

Core emits `GameEvent`s; renderer, HUD and audio consume them. Continuous state (charge level,
projectiles in flight) is read from the game every frame instead.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint       # ESLint (type-checked), Prettier, Stylelint, markdownlint, SPDX check
npm run format     # apply Prettier, Stylelint and markdownlint fixes
npm run typecheck
npm test           # Vitest
npm run e2e        # Playwright, Google Chrome, builds and serves on :4173
npm run verify     # all of the above plus production build
```

## Working rules

- **Controls:** Enter = jump, Backspace = back-flip, Space hold/release = charge and fire (Space
  again detonates sheep), arrows walk, aim and steer the flying sheep, 1–9, 0 and Shift+1–7 /
  Tab select weapons, a click on the map calls strikes.
- **Adding a weapon:** definition in `src/core/weapons.ts` (kind, ammo, `special`), behaviour in
  `Game` for new kinds, held model in `buddyView.ts`, projectile model in `effects.ts`, sounds in
  `app.ts`/`audio.ts`, README and VISION tables, unit test and E2E test. The AI picks up
  projectile, strike and melee weapons from their kind.
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
