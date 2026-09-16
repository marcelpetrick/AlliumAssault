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
| T10 | End-to-end tests in Chrome for every weapon, crates and sounds | ☐ | |
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

### T10 — End-to-end tests for the game and its features ☐
Goal: know that the game and each feature work in a real browser, in addition to unit tests.
- Playwright driving Google Chrome (DevTools protocol), real keyboard and mouse input.
- One E2E test per weapon: bazooka, grenade, shotgun, punch, cluster bomb, sheep, air strike —
  each checks the visible effect (projectile/sheep/plane, crater, damage) through the
  `window.__allium` test hook.
- Crates: spawn, pickup gives HP or ammo.
- Sounds: the audio engine records which sound effects played and which continuous voices run;
  tests assert the expected sounds for charging, flight, bounce, explosion, sheep, plane, crates.
- No console errors in any test.

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
