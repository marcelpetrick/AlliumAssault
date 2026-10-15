# Repository review — October 2026

## Current findings and resolutions

Reviewed the v1.78.6 baseline and the completed October changes through v1.83.1: rules, AI,
renderer, setup, tests, documentation and release workflows.

- **High: crate pickups vetoed by unrelated weak enemies.** Reproduced on all difficulties.
  Crate priority now considers actual attack value, health and trip duration; a short pickup wins.
- **High: cave walking tested against the skyline.** Reproduced beneath a low ceiling. Routes now
  run copied bodies through real walking/jump physics, checking water, falls, visible mines and fire.
- **High: rope routes were guesses.** Nearby overhead rock did not mean the chosen hook hit it,
  and releasing after a vanished crate repeatedly fired a new hook. Complete traversals are now
  simulated with the same controller as play; release is single, braking controls overshoot, failed
  crate routes are remembered for the turn. A test verifies a real pickup across a gap and landing.
- **Medium: selected aircraft weapons prevented walking.** Arrow keys selected approach direction.
  Approach arrows now apply only to humans; AI calls `setStrikeDir()` explicitly. A regression
  collects a box with only aircraft ammo, jumps a step and then calls its attack.
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

## Faction review — 1.83.0

Faction membership now drives enemy relationships and the victory condition, while ordinary team
turns and inventories remain separate. Friendly fire stays active. Core tests include an ally
eliminated before victory, independent team ammo, draws and old settings with the mode disabled.
Direct gun planning rejects allied bodies between shooter and target; homing locks reject allies.
The browser checks editing/persisting faction names, friendly damage and the shared victory UI.
Review caught all-one-faction setup silently starting without opponents; Start is now disabled
with a translated explanation until two opposing factions are configured.

A long-name browser case reproduced the timer/pause controls reaching 1177 pixels on a 960-pixel
viewport at Huge text size. Team and buddy labels now wrap unbroken names, keeping every top HUD
control within the viewport; the test measures each control rather than only its fixed parent.

## Final integration review — 1.83.1

- **AI could still fail with only aircraft ammo.** Removed the ordinary-weapon workaround. Human
  approach input is separated from AI movement; real pickup and subsequent aircraft direction are
  checked in core and Chrome. The browser scenario records position at pickup, before a later
  successful retreat moves the buddy back across the arena.
- **Repositioning planned jumps it never executed.** Planning and play now share a proactive jump
  decision. Jump before touching a step so collision cannot erase the horizontal launch velocity.
  Tests require an actual jump and a damaging attack after crossing the obstacle in both directions.
- **Retreating could walk into water.** Preview the real route, require a grounded endpoint, prefer
  the direction away from the target and use the safe opposite direction when needed. Remain on
  small islands when neither route is safe; water, flames and visible mines constrain routes.
- **Allied kills could earn enemy-kill awards.** Faction damage stays active and is recorded as
  friendly; lethal allied damage no longer increments enemy kills.
- **Statistics UI depended on slow rendered time.** Both scoreboard scenarios now freeze the
  automatic loop and explicitly step the victory delay after the AI match ends. This follows the
  same deterministic frame control as the match-completion test.
- **Coverage and test scope.** All core files remain measured. Thresholds are now 98.1% for all
  four metrics. `npm run verify` checks formatting/licensing, strict types, coverage, the production
  build and the complete Chrome suite. Browser outcome tests cover every selectable weapon and
  the requested movement, tools, AI and faction flows; arbitrary combinations are not exhaustive.

### Firefox fire investigation

The current renderer already uses emissive 3D mesh fallbacks alongside particles. Missing fire
could not be reproduced with ordinary headed Firefox WebGL preferences: Low at 1280×720 and
800×600, and Full at 1280×720 show the aimed torch in both facings, ground flames and blast glow.
The browser reports WebGL 2.0 and a masked Intel renderer; no page or console errors were observed.
This evidence does not establish the cause of the user's earlier session or certify every GPU.

Repeat after building and serving a preview:

```bash
npx playwright install firefox
xvfb-run -a node scripts/check-firefox-fire.mjs http://localhost:4173
```

On a desktop with a display, omit `xvfb-run -a`. The audit uses no forced Firefox WebGL preferences.
Assertions check mesh state, direction and errors; inspect the screenshots for visible colour and
placement. It allows the compositor to present frames before capturing.

- [Low, 800×600](screenshots/firefox-low-800.png)
- [Low, 1280×720](screenshots/firefox-low-1280.png)
- [Full, 1280×720](screenshots/firefox-high-1280.png)

Sudden Death still raises water once per turn, ordinary rope stock remains three, platforms remain
two-use, and drilling cushions a fall only while active. Existing browser regressions verify these
rules together with fire cleanup and the newly expanded arsenal.

## Documentation and media review — 1.83.2

- September screenshots and most GIFs showed an older arsenal and terrain. Every media family is
  regenerated; new feature clips demonstrate real flooding, named factions and completed AI
  crate/rope pickups. Captures use authored arenas, assert outcomes and fail on browser errors.
- Eighteen local references still pointed at moved documents, and historical task anchors omitted
  completion suffixes. These are repaired; local file/image references now have a regression test.
- The document index called the active plan historical. Vision still claimed AI never ropes;
  architecture omitted jetpack phases/navigation and described the old crate/rope heuristic.
  Current controls, faction victory, the seven-second route budget and 98.1% thresholds are updated.
- The coverage chart stopped before the latest game changes and still labelled 98%. It now includes
  the verified 1.83.1 gameplay measurement and reads the threshold from the current configuration.
- Security and current contributor prose claimed a clean audit despite the unresolved development
  `braces` advisory. The 14 October audit has eight affected development package entries and no
  production findings; documentation now states that scope. No dependency change is hidden here.
- Social captions/post copy still advertised seventeen weapons, old test counts and unsupported
  phone controls. Refreshed videos/drafts use current facts. Earlier personal post/research copy
  stays explicitly historical; no social post is sent by these scripts.
- The refreshed setup screenshot exposed pale faction-name text on a white default input. These
  fields now have an explicit dark background, readable text and a visible keyboard-focus outline.
  The existing faction browser flow checks the actual text/background contrast before editing.
- The complete refresh exposed a missing JSON coverage reporter hidden by an overly broad catch.
  It now explicitly generates the summary and reports file/JSON errors; only a genuine core diff
  skips the historical cache update. A metadata-only command repeats the corrected final stages.
- The media manifest records hashes, decoded frame counts, dimensions and capture provenance.
  Visual checks supplement these checks; the same frame count alone cannot prove a useful clip.

Performance numbers are dated observations. The current profile smoke run passes its ceilings;
the old before/after import comparison remains labelled historical. Core and browser coverage
continue to describe representative cases rather than every possible match.

## Dependency and release review — 1.83.3

The 15 October npm registry review checked all 16 direct dependencies and both overrides.
Every entry was already pinned exactly. Playwright 1.64.1 and typescript-eslint 8.71.2 are stable,
non-deprecated patch updates; their matching packages account for all 14 lockfile version changes.
No runtime dependency, application rule, linter policy or coverage threshold changes.

TypeScript 7.0.2 is deferred because the current linter declares `typescript >=4.8.4 <6.1.0`.
TypeScript 6.0.3 is the latest compatible stable release. Node typings 24.19.2 are the latest
24.x release and match the configured runtime; the 26.x typings describe a different runtime.
The `braces` advisory remains unresolved in the latest published 3.0.3; the dependency update
retains eight affected development-package entries and zero production audit findings.

The complete repository verification and official REUSE checks gate the release commit.
The authorized v1.83.3 tag runs independent release packaging and Pages verification, publishing
the static archive and SHA-256 checksum alongside the updated playable site. Capture provenance
continues to describe the 1.83.2 recordings rather than relabelling them as freshly captured.
