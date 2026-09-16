# Tasks

All requests and their status. Updated with every commit.

Every commit gets its own SemVer version (`package.json`, `CHANGELOG.md`; no tag — tags only for
releases): patch for fixes/docs/balance/tests, minor for features. Commits are atomic.
`npm run verify` must be green before each commit. See `AGENTS.md`.

Status: ☐ open · ☑ done

## Overview

| # | Task | Status | Version |
|---|---|---|---|
| T0 | Task list in `tasks.md`, kept current with every commit | ☑ | 1.1.12, 1.4.1 |
| T1 | Fix buddies floating after the ground below is blasted away | ☑ | 1.1.13 |
| T2 | Stronger Garlic Punch | ☑ | 1.1.14 |
| T3 | Sound: charge whoosh, flight sounds, louder bounces | ☑ | 1.2.0, 1.3.2 |
| T4 | Cluster bomb | ☑ | 1.3.0 |
| T11 | Versioning: bump every commit, tag only releases; `AGENTS.md` | ☑ | 1.3.1 |
| T5 | Sheep | ☑ | 1.4.0 |
| T6 | Air strike | ☑ | 1.5.0 |
| T7 | Random crates | ☑ | 1.6.0 |
| T10 | End-to-end tests in Chrome for every weapon, crates and sounds | ☑ | 1.6.1 |
| T14 | Blowtorch: dig forward through rock for three seconds | ☑ | 1.10.0 |
| T15 | Baseball bat: less damage than the punch, knocks enemies far away | ☑ | 1.8.0 |
| T16 | Sounds for walking and jumping buddies | ☑ | 1.7.0 |
| T17 | Self-destruct: the buddy blows up with a blast that grows with its health | ☑ | 1.9.0 |
| T18 | Arsenal setting: all weapons from the start, or special weapons only from crates | ☑ | 1.17.0 |
| T19 | Holy Garlic Grenade: waits until it rests, sings, then a huge blast | ☑ | 1.12.0 |
| T20 | Banana Bomb: bursts into bouncing explosive bananas | ☑ | 1.13.0 |
| T21 | Flying Sheep: steer the sheep through the air, detonate on demand | ☑ | 1.14.0 |
| T22 | Concrete Mule: falls from the sky and smashes down through the ground repeatedly | ☑ | 1.15.0 |
| T23 | Minigun: long rapid-fire burst that shoves buddies across the map | ☑ | 1.11.0 |
| T24 | Compact weapon bar and hotkeys for 15 weapons | ☑ | 1.16.0 |
| T25 | Update dependencies (`/updateDependencies`): pinned, latest stable, verify | ☑ | 1.17.1 |
| T26 | Branch review (`/reviewBranch`): ten worst code and architecture issues in `review.md` | ☐ | |
| T8 | GitHub Pages deployment | ☐ | |
| T9 | Docs: README, VISION, ARCHITECTURE | ☐ | |
| T12 | Self-review of all changes, fix findings | ☐ | |
| T13 | Push to GitHub and publish a public release | ☐ | |

## Answered questions

- **How to run locally:** `npm install`, `npm run dev`, open <http://localhost:5173>
  (`?quality=low` for weak GPUs). Production: `npm run build`, `npm run preview`.
- **Versioning scheme starting at 0.1.0?** The project already follows SemVer (it was at 1.1.11);
  decision: keep the existing scheme and numbering.
- **GitHub Pages or own web server?** GitHub Pages works: the game is a static site with relative
  asset paths, so no server is needed (T8).

## Details

### T1 — Buddies float after the ground under them is blasted away ☑
- Cause: `Terrain.distance()` estimates the distance to the surface from the local field value
  and gradient. `carve()` only lowers the field inside the crater disc, so the unchanged field
  above the crater still extrapolates to the old, now removed surface. `touchingGround()` and
  `resolve()` believed that phantom surface, so buddies outside the blast radius kept standing
  on air.
- Fix: only accept a contact when there is real rock just behind the estimated surface point.
- Test: carve the ground away below a resting buddy without touching it — it must fall.

### T2 — Stronger Garlic Punch ☑
Damage 30 → 45, launch force 13 → 15.

### T3 — Sound ☑
- Continuous sounds: charge whoosh while Space is held (pitch/volume rise with the charge,
  stops on fire, pause, focus loss), flight whistle per projectile in the air.
- One-shots: louder impact-scaled grenade bounce, weapon select, last-5-seconds tick.
- Feature sounds ship with their features: sheep baa/hop (T5), airplane (T6), crate teleport,
  pickup and heal (T7).

### T4 — Cluster bomb ☑
- Weapon bar and hotkeys generalised beyond four weapons (1–9), hidden fragment weapons.
- Red grenade, 3 s fuse, 3 per team. Explodes and releases 5 bomblets which explode on contact
  for a flat 10 damage each.
- AI considers it (main blast + estimated bomblet damage).

### T5 — Sheep ☑
- Space releases the sheep; it hops 45° upwards in small hops in the facing direction and turns
  around at walls. Second Space detonates it (75 damage, radius 4). Auto-detonates after 10 s or
  when the turn time runs out; drowns in water.
- New phase `guiding`: turn timer keeps running, buddy cannot move, Space detonates.
- Camera follows the sheep, fuse countdown above it, baa and hop sounds.
- AI replays the sheep's hops for both directions and detonates at the best moment.

### T6 — Air strike ☑
- Select it, click on the map: a plane flies over and drops 5 bomblets around the target.
- Click vs. drag detection, screen → world picking, target cursor, plane sound.
- AI picks the target position that hits the most enemies.
- Bombs land on the highest ground below the target (e.g. a floating island above the clicked
  spot), like in Worms.

### T7 — Random crates ☑
- At a turn start, with a chance (setting Off / Normal / Lots) a crate teleports onto a random
  land spot (seeded, at most 4 on the map). Crates fall and can be destroyed by explosions.
- Health crate: +25 HP for the collecting buddy. Weapon crate: +1 sheep, air strike or cluster
  bomb for the team.
- Crate model, teleport effect, pickup banner and sounds; AI walks to a nearby crate when it has
  no good shot.

### T10 — End-to-end tests for the game and its features ☑
Goal: know that the game and each feature work in a real browser, in addition to unit tests.
- Playwright driving Google Chrome (DevTools protocol), real keyboard and mouse input.
- One E2E test per weapon: bazooka, grenade, shotgun, punch, cluster bomb, sheep, air strike —
  each checks the visible effect (projectile/sheep/plane, crater, damage) through the
  `window.__allium` test hook.
- Crates: spawn, pickup gives HP or ammo.
- Sounds: the audio engine records which sound effects played and which continuous voices run;
  tests assert the expected sounds for charging, flight, bounce, explosion, sheep, plane, crates.
- No console errors in any test.
- Done: `e2e/weapons.spec.ts` (one test per weapon), `e2e/features.spec.ts` (crates, audio cues,
  weapon bar), shared helpers in `e2e/support.ts`; the audio engine counts played effects.

### T14 — Blowtorch ☑
- New weapon: on Space the buddy walks forward for three seconds and burns a tunnel through the
  rock in front of it.
- Works with gravity: without supporting ground the buddy falls; it never tunnels upwards.
- Torch sound, flame particles, AI use when an enemy is behind a wall, unit and E2E tests.

### T15 — Baseball bat ☑
- New melee weapon: less damage than the Garlic Punch but a much stronger, flatter knock-back
  along the aim direction, to swat enemies over edges and into the water.
- Swing sound and bat model, AI use near cliffs and water, unit and E2E tests.

### T17 — Self-destruct ☑
- New weapon: the active buddy explodes on the spot and dies. Damage equals its current health,
  the blast radius grows with it (health ÷ 10 units: 10 units at 100 HP), so a healthy buddy
  takes a big part of the map with it.
- Countdown sound and flash, AI use only when it pays off, unit and E2E tests.

### T18 — Arsenal setting ☑
- Match setup option **Arsenal**: *All weapons* (every weapon with its normal starting ammo) or
  *Find in crates* (special weapons start empty and are only found in weapon crates).
- Picking up a weapon crate adds one more of that weapon to the team's inventory.
- Special weapons: cluster bomb, sheep, air strike, self-destruct, minigun, holy garlic grenade,
  banana bomb, flying sheep, concrete mule. Weapon crates can contain any of them. Choosing
  *Find in crates* switches crates on if they were off.
- Unit and E2E tests.

### Plan for T14, T17–T24

Order: T17 self-destruct → T14 blowtorch → T23 minigun → T19 holy grenade → T20 banana bomb →
T21 flying sheep → T22 concrete mule → T24 weapon bar → T18 arsenal setting (last, so the crate
list covers every special weapon). One minor version per weapon, each with core rules, model,
effects, sound, AI use, unit tests and an E2E test.

Names: mechanics follow the requested Worms 2 weapons; Worms-specific names are replaced by
garlic-flavoured ones (Holy Garlic Grenade, Flying Sheep, Concrete Mule) because the project's
design is original. Renaming is a one-line change in `src/core/weapons.ts`.

### T19 — Holy Garlic Grenade ☑
- Thrown like a grenade but with little bounce and no timer: once it has come to rest it sings a
  "Hallelujah" chord and explodes 1.6 s later — enormous blast (radius 7, 100 damage). 1 per team.
- Core: `restFuse` on the weapon definition; golden grenade model with a cross; choir sound.

### T20 — Banana Bomb ☑
- Thrown with a 3 s fuse; bursts into five bananas that bounce around and explode after
  staggered short fuses (30 damage each), wrecking a large area. 1 per team.
- Core: cluster fragments with bounce and their own fuses; yellow banana models.

### T21 — Flying Sheep ☑
- Space releases it; it flies at constant speed, ← → steer it, Space detonates (75 damage). Hits
  on terrain or buddies detonate it; 10 s flight time. 1 per team.
- Core: steerable flyer in the `guiding` phase; sheep model with a cape; AI steers towards the
  nearest enemy.

### T22 — Concrete Mule ☑
- Click a target: a giant concrete mule drops from the sky and smashes down, exploding on each
  of up to six impacts as it bounces and crushes its way through the ground. 1 per team.
- Core: strike weapon without a plane; heavy projectile that survives impacts.

### T23 — Minigun ☑
- Instant long burst: 14 bullets over 1.4 s along the (slightly spreading) aim line, 5 damage and
  a strong shove each, so a full hit pushes a buddy far (about 20 units on flat ground). 1 per
  team.
- Core: `burst` on hitscan weapons, a locked `firing` phase while it rattles; rapid-fire sound.

### T25 — Dependency update ☑
- All dependencies were already pinned to exact versions.
- `@babylonjs/core` 9.26.1 → 9.26.2.
- `typescript` stays at 6.0.3: 7.0.2 is out, but the latest `typescript-eslint` (8.70.0) only
  supports TypeScript < 6.1. Revisit when typescript-eslint supports TypeScript 7.
- Everything else was already on its latest stable release.

### T24 — Compact weapon bar ☑
- Icon slots with ammo badges and the selected weapon's name in the hint; fits 15 weapons at
  1280 px and wraps on narrow screens. Hotkeys 1–9 and 0 for the first ten, Shift+1–5 for the
  rest, Tab cycles, clicks work for all.

### T16 — Walking and jumping sounds ☑
- Soft footstep patter while a buddy walks, a hop sound on jump and a thud on landing.
- E2E check that the sounds play.

### T8 — GitHub Pages deployment ☐
- Workflow `.github/workflows/pages.yml`: build and deploy `dist/` via `actions/deploy-pages`
  when a release tag is pushed (and on manual dispatch).
- Repository Pages source set to GitHub Actions; game served at
  <https://marcelpetrick.github.io/AlliumAssault/>.

### T9 — Docs ☐
README (features, controls, weapons, Pages link), `docs/VISION.md`, `docs/ARCHITECTURE.md`.

### T12 — Self-review ☐
Review the full diff since v1.1.11 for bugs and cleanups, fix findings, re-run `npm run verify`.

### T13 — Push and public release ☐
Push `master`, tag the release version, push the tag (the release workflow publishes the GitHub
release with the zipped web build), confirm the Pages deployment.

## Defaults chosen (change on request)

| Topic | Value |
|---|---|
| Punch | 45 damage |
| Cluster bomb | 3 per team, 25 damage main blast, 5 bomblets × 10 damage |
| Sheep | 1 per team, 75 damage, radius 4, 10 s max |
| Air strike | 1 per team, 5 bomblets × 25 damage |
| Crates | Normal = 35 % chance per turn, max 4 on the map; health +25 HP |
| Self-destruct | damage = health, radius = health ÷ 10 |
