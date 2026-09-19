# LinkedIn post research — Allium Assault, five days from four weapons to seventeen

Notes collected from the git history (118 commits) and `CHANGELOG.md` for a later LinkedIn post.

## Where it started — v0.3.0, 14 September 2026

- Headless TypeScript core: seeded destructible density-field terrain with marching-squares
  contouring, circle-vs-field physics, swept projectiles and wind.
- Four weapons — bazooka, grenade, shotgun, garlic punch — plus a turn state machine and a
  trajectory-search AI with three difficulty levels.

A discarded Phaser 2D prototype from June 2026 came before that; the 3D rewrite is what this
timeline counts.

## Headline improvements since

### Presentation and playability

- Babylon.js 3D layer (v0.4.0): bevelled extruded terrain, animated garlic buddies with facial
  animation and squash & stretch, sky shader, water, shadows, bloom and tone mapping.
- Full game shell (v0.5.0–1.0.0): title screen with a live AI demo battle, match setup, HUD, and
  pause, help and victory screens with camera pan and zoom.
- Everything you hear is synthesized in Web Audio at runtime — no audio assets in the repo — later
  extended with charge whoosh, flight sounds, footsteps, jump and landing cues and a
  compressor-backed volume lift.
- Three original sceneries added on top of the starting themes: Candy Shop and Frosty Peaks join
  Garlic Meadow, Golden Sunset and Moonlit Grove.

### Arsenal: 4 → 17 weapons

- Thirteen new weapons in roughly two days: cluster bomb, sheep, air strike, baseball bat,
  self-destruct, blowtorch, minigun, holy garlic grenade, banana bomb, flying sheep, concrete mule,
  drill and napalm strike.
- The AI learned every one of them generically — it picks up projectile, strike and melee weapons
  straight from the weapon table, so a new weapon is used by the AI without touching AI code.
- Weapon presentation (projectile model, sounds, muzzle flash, camera follow) was refactored into
  declarative `look` data in the weapon table instead of `switch` statements on weapon ids across
  three modules.
- The five concurrent "action in progress" fields collapsed into a single `TurnAction` union, making
  two simultaneous actions structurally impossible.

### Systems and match design

- Random supply crates that teleport in mid-match, with a camera pan so nobody misses the drop, plus
  health and weapon pickups.
- Arsenal settings: _All weapons_, _Find in crates_ (specials start empty) and _Infinite supplies_.
- Sudden Death — an optional turn 10/20/30 trigger that now drops every living buddy to 1 HP, so the
  lightest scratch ends the match.
- Comic tombstones with a springy wobble and a sad trombone, which get knocked around by explosions
  and sink in water.
- The blowtorch became directional (burn along the aim line, up or down through a hillside) and the
  cluster bomb was promoted into the basic loadout.

### Engineering and delivery

- Playwright E2E suite on real Chrome with one test per weapon, driven through a `window.__allium`
  test hook because headless SwiftShader renders at about 2 fps.
- GitHub Actions CI plus GitHub Pages deployment on every release tag — the game is playable in the
  browser, and the E2E suite gates the deploy.
- Full linting pipeline: type-aware ESLint, Prettier, Stylelint, markdownlint and actionlint, with a
  project invariant banning non-null assertions in `src/`.
- SPDX headers and REUSE 3.3 compliance across every file, verified by the official REUSE tool in
  CI.
- A scripted media capture (`scripts/capture-media.mjs`) regenerates all README screenshots and the
  animated GIF from a real preview build.
- About 40 % cheaper frames by dropping redundant 4× multisampling behind an existing FXAA pass,
  capping at 60 fps (20 with a menu open) and limiting the drawing buffer to 4 megapixels.
- Two full code and architecture reviews (`review.md`) with every finding fixed and recorded, plus
  C4 and Mermaid architecture docs.

## Stats for the post

- 99 commits in 5 days, from the four-weapon core to v1.33.1.
- 17 weapons, about 10 600 lines of TypeScript, 82 unit tests and three E2E specs.
- 95.9 % line and 94.7 % statement coverage of `src/core` (the game rules), measured with
  `npm run coverage`; the render, UI and audio layers are covered by the Playwright suite instead.
- GPL-3.0-or-later, playable at <https://marcelpetrick.github.io/AlliumAssault/>.
