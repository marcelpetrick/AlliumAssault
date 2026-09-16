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

| Path | Contents | Rule |
|---|---|---|
| `src/core/` | Game rules: terrain field, marching squares, physics, weapons, sheep, match state machine, AI | Pure TypeScript — no Babylon, no DOM. Unit tested. |
| `src/render/` | Babylon.js scene, terrain mesh, buddies, effects, camera | Reads core state and events, never changes rules |
| `src/ui/` | HTML/CSS overlay: menus, setup, HUD | |
| `src/audio.ts` | Web Audio synthesizer; every sound is generated, no asset files | |
| `src/app.ts` | Frame loop, input, event dispatch, `window.__allium` test hook | |
| `tests/` | Vitest core tests | |
| `e2e/` | Playwright tests in Google Chrome | |
| `docs/` | `VISION.md`, `ARCHITECTURE.md` (C4 + Mermaid), `PLAN.md`, `archive/` | |
| `tasks.md` | Current task list with status | Tick tasks off in the commit that completes them |

Core emits `GameEvent`s; renderer, HUD and audio consume them. Continuous state (charge level,
projectiles in flight) is read from the game every frame instead.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run typecheck
npm test           # Vitest
npm run e2e        # Playwright, Google Chrome, builds and serves on :4173
npm run verify     # all of the above plus production build
```

## Working rules

- **Controls:** Enter = jump, Backspace = back-flip, Space hold/release = charge and fire, arrows
  walk and aim, 1–9 / Tab select weapons.
- **Verification:** `npm run verify` must be green before every commit. Add or update unit tests
  for rule changes and E2E checks for user-visible flows.
- **E2E in headless Chrome** renders with SwiftShader at about 2 fps: drive tests through
  `window.__allium` (`state()`, `startMatch()`, `fastForward()`, `stepFrames()`) instead of
  waiting on real time.
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
