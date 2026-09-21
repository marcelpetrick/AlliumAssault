# Repository review — after v1.53.0

```text
Scope: the whole repository, not a branch diff — master is the only branch.
Base:  v1.53.0 (163 commits, 16.7k lines)      Reviewed: 2026-09-21
Areas: build and CI, architecture and layering, code, tests, documentation, licensing, media.
```

Asked for after the release: what is missing, what is off, and what ordinary industry practice would
add. Ten findings, each checked against the repository rather than assumed. Findings 1 to 8 were
fixed in 1.54.0; the last two are recorded as work with their own scope.

## Findings

### 1 — HIGH · The coverage gate never ran

`npm run verify` and all three workflows ran `npm test`, which does not measure coverage, while the
98% thresholds raised in 1.43.3 live in `vite.config.ts` and are only checked by `npm run coverage`.
So the gate existed on paper and nothing enforced it — and branch coverage had already slipped to
**97.97%**, below the threshold, without a single red run. Fixed: `verify`, CI, Pages and Release
all run `npm run coverage`, and the branches that had slipped are covered again (98.1%).

### 2 — MEDIUM · Browser tests had no retry

Two runs during the session failed on `net::ERR_NETWORK_CHANGED` — the machine's network changed
under the browser — which says nothing about the game. A deterministic suite with `workers: 1` and
no retries turns any such hiccup into a red build. Fixed: `retries: 1`.

### 3 — MEDIUM · No community health files

A public repository was missing `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig` and a Dependabot
configuration. `AGENTS.md` carried the house rules, but only for agents. Fixed: all four added;
`CONTRIBUTING.md` points at `AGENTS.md` rather than repeating it, `SECURITY.md` states the honest
attack surface (a static site, one `localStorage` entry, no backend), and Dependabot proposes pinned
updates weekly with grouped dev tooling.

### 4 — MEDIUM · `docs/ARCHITECTURE.md` had drifted

It still said "nineteen weapon definitions" and knew nothing of the platform, the teleport, gravity,
the Sudden Death flood, the map preview or the particle sweeper; the turn state machine had no
`panicking` state and the intro timing was out of date. Fixed: components, state machine and rules
list brought back in line with the code.

### 5 — LOW · A finished plan was still presented as current

`todo.md` (743 lines) was fully implemented and duplicated `tasks.md`, so two documents claimed to
be the backlog. Fixed: moved to `docs/archive/todo-2026-09.md`, with the links in `tasks.md`
repointed.

### 6 — LOW · A shared link showed nothing

`index.html` had a title and a favicon but no description, no Open Graph tags and no theme colour,
so the Pages link posted anywhere showed a bare URL. Fixed.

### 7 — LOW · Reduced motion was ignored

The overlay pulses, slides and floats; `prefers-reduced-motion` was not honoured anywhere. Fixed for
the overlay's own decoration, deliberately not for the game itself, which is the motion the player
asked for.

### 8 — LOW · A duplicated row in the README

The teleport row appeared twice, from a documentation script that ran twice. Fixed, and the whole
weapon table was regenerated from the weapon order so it cannot drift from the code again.

### 9 — OPEN · `game.ts` (1,571 lines) and `effects.ts` (1,348) are too big

Both are cohesive but well past the size where a reader can hold them in their head, and both grew
another 200 lines today. `game.ts` splits cleanly along the turn state machine, weapon execution,
and the per-actor stepping (crates, mines, flames, graves); `effects.ts` splits into one-shot
particle effects, persistent effects (fire, torch, drill) and the model views. Not done here: it is
a large, mechanical, risky refactor that touches everything and deserves its own session and its own
review, so it is recorded as **T98**.

### 10 — OPEN · The renderer and the UI have no unit tests

`src/render` and `src/ui` are covered only by the browser suite, which is the right call for the
scene and the DOM, but pure helpers inside them — the map preview's terrain sampling, the weapon
bar's hotkey labels, the HUD's formatting — could be unit tested without a GPU. Worth doing when one
of them next changes rather than as a sweep.

## Checked and found sound

- **Layering.** No file in `src/core` imports from `src/render` or `src/ui`; the rules really are
  pure. The renderer reads state and events and never writes to the core.
- **Type safety.** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  type-aware `typescript-eslint` in strict mode. No non-null assertions in `src/`; `defined()` and
  `query()` carry the message instead. No `any`, no `TODO`, no `FIXME` anywhere in the tree.
- **Supply chain.** Every dependency pinned exactly, `npm audit` clean, `overrides` used for a
  patched transitive dependency, REUSE checked in CI by the official tool.
- **Workflows.** Least-privilege `permissions`, `concurrency` groups, pinned Node, timeouts on every
  job, Playwright artefacts uploaded on failure, actionlint on the workflows themselves.
- **Determinism.** Terrain, spawns, crates, wind and AI aim all draw from seeded streams, so a seed
  really does replay; the fixed-step simulation is independent of the frame rate.
- **Build output.** 6.8 MB of JavaScript, 1.5 MB gzipped, which is Babylon.js and is cached after
  the first load; nothing else ships.
