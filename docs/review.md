# Repository review — October 2026

## Current findings and resolutions

Reviewed current v1.78.6 rules, AI, renderer, setup, tests and the requested changes.

- **High: crate pickups vetoed by unrelated weak enemies.** Reproduced on all difficulties.
  Crate priority now considers actual attack value, health and trip duration; a short pickup wins.
- **High: cave walking tested against the skyline.** Reproduced beneath a low ceiling. Routes now
  run copied bodies through real walking/jump physics, checking water, falls, visible mines and fire.
- **High: rope routes were guesses.** Nearby overhead rock did not mean the chosen hook hit it,
  and releasing after a vanished crate repeatedly fired a new hook. Complete traversals are now
  simulated with the same controller as play; release is single, braking controls overshoot, failed
  crate routes are remembered for the turn. A test verifies a real pickup across a gap and landing.
- **Medium: selected aircraft weapons prevented walking.** Arrow keys selected approach direction.
  Fetching now selects an available ordinary weapon before walking; regression test collects the box.
- **Medium: local browser verification could reuse stale output.** The configuration contradicted
  its own comment. Reuse is disabled so each suite builds the source it certifies.
- **Medium: Normal lacked useful repositioning.** It now checks nearby safe positions when the
  current attack is poor, retaining time to attack; lower aim noise improves ordinary shots.

- **Medium: every generated map contained the same cave/ledge recipe.** Seeded layout families now
  include genuinely solid plains and hills, clustered islands with water channels, and caverns.
  Profiles and feature sizes scale to the arena. Tests check full rosters across 24 seeds/sizes,
  body clearance, separation, monotonic solid columns and actual island channels.
- **Medium: wall selection was absent from the preview.** The preview now overlays both arena
  walls immediately; the browser test checks changed edge pixels, stable seed and reversible toggle.

The previous historical review follows for traceability. New feature reviews are appended here
with their verification results as implementation proceeds.

## Historical review — after v1.53.0

```text
Scope: the whole repository, not a branch diff — master is the only branch.
Base:  v1.53.0 (163 commits, 16.7k lines)      Reviewed: 2026-09-21
Areas: build and CI, architecture and layering, code, tests, documentation, licensing, media.
```

Asked for after the release: what is missing, what is off, and what ordinary industry practice would
add. Ten findings, each checked against the repository rather than assumed. Findings 1 to 8 were
fixed in 1.54.0, finding 9 in part in 1.56.0; finding 10 is still recorded as work with its own
scope.

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

### 9 — PARTLY FIXED (1.56.0) · `game.ts` (1,571 lines) and `effects.ts` (1,348) are too big

Both are cohesive but well past the size where a reader can hold them in their head, and both grew
another 200 lines today. `game.ts` splits cleanly along the turn state machine, weapon execution,
and the per-actor stepping (crates, mines, flames, graves); `effects.ts` splits into one-shot
particle effects, persistent effects (fire, torch, drill) and the model views. Not done here: it is
a large, mechanical, risky refactor that touches everything and deserves its own session and its own
review, so it is recorded as **T98**.

**Resolution (1.56.0).** `game.ts` gave up the 250 lines that came before the class — the config,
the things a match contains, the phases, the turn actions, the events and the tuning constants — to
`src/core/match.ts`, and re-exports all of them, so no import in `src`, `tests` or `e2e` changed.
`game.ts` is now 1,392 lines and is only the state machine. `effects.ts` still stands at 1,345 and
is the remaining half of the finding: splitting it is best done the next time it changes, which the
profiling work in 1.56.0 deliberately did not force.

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

## Melee review — 1.80.1

The bat had radius zero, so a swing could damage a buddy but never the wall beside it. Give it a
0.9 unit carve radius, retain the punch carve, and remove the obsolete zero-radius melee guard.
Core and browser scenarios check both tools against rock without a victim, distant misses, and
indestructible arena boundaries. No rule changes to buddy damage or knockback.

## Jetpack review — 1.81.0

The powered action uses acceleration and terrain collision, with six seconds of fuel and a
three-unit descent speed cap. Review caught a timeout/damage path that could hand the turn on
while its owner was airborne: the governor now remains until landing, death or drowning. Landing
restores aiming, preserving a follow-up attack. Real browser input verifies acceleration, fuel,
visible cone exhaust and the subsequent bazooka shot; core scenarios include heavy gravity,
ceilings, enemy damage, lethal damage and supplies collected during flight.

The full jetpack gate also caught the wider weapon bar overflowing at 960 pixels. Compact HUD
breakpoints now account for the expanded arsenal at Normal, Large and Huge text sizes; the
existing viewport browser regression checks all three.

## Homing rocket review — 1.82.0

The projectile stores a buddy id, preserves three seconds of normal ballistic physics and then
steers towards the living target without bypassing ordinary swept collision. A lost target retains
the last heading; invalid locks cannot spend ammo. Tests exercise an actual intervening wall with
a live target, moved/lost targets, crate pickup, AI launch and real mouse locking in the browser.
Review corrected the help stock to one per crate rather than one per team, and authored the
browser camera setup so its click actually reaches the visible enemy. The existing powered-rocket
sounds are reused through presentation metadata. Help now lists the actual digit and letter keys
rather than extending Shift+numbers past nine.
