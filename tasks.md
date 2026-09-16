# Tasks

Every commit gets its own SemVer version (`package.json`, `CHANGELOG.md`; no tag — tags only for
releases): patch for fixes/docs/balance, minor for features. `npm run verify` must be green before
each commit. See `AGENTS.md`.

Status: ☐ open · ☑ done

## Bugs

- ☑ **T1 — Buddies float after the ground under them is blasted away** (patch)
  - Cause: `Terrain.distance()` estimates the distance to the surface from the local field value
    and gradient. `carve()` only lowers the field inside the crater disc, so the unchanged field
    above the crater still extrapolates to the old, now removed surface. `touchingGround()` and
    `resolve()` believed that phantom surface, so buddies outside the blast radius kept standing
    on air.
  - Fix: only accept a contact when there is real rock just behind the estimated surface point.
  - Test: carve the ground away below a resting buddy without touching it — it must fall.

## Balance

- ☑ **T2 — Stronger Garlic Punch** (patch): damage 30 → 45, launch force 13 → 15.

## Features

- ☑ **T3 — Sound** (minor)
  - Continuous sounds: charge whoosh while Space is held (pitch/volume rise with the charge,
    stops on fire, pause, focus loss), flight whistle per projectile in the air.
  - One-shots: louder impact-scaled grenade bounce, weapon select, last-5-seconds tick.
  - Sheep baa/hop, airplane, bomblet pops, crate teleport, pickup and heal sounds ship with
    their features (T4–T7).
- ☑ **T4 — Cluster grenade** (minor)
  - Weapon bar and hotkeys generalised beyond four weapons (1–9), hidden internal weapons.
  - Red grenade, 3 s fuse, 3 per team. Explodes and releases 5 bomblets which explode on
    contact for 10 damage each.
  - AI considers it (main blast + estimated bomblet damage).
- ☐ **T5 — Sheep** (minor)
  - Space releases the sheep; it hops 45° upwards in small hops in the facing direction, turns
    around at walls. Second Space detonates it (big blast). Auto-detonates after 10 s or when
    the turn time runs out; drowns in water.
  - New phase `guiding`: turn timer keeps running, buddy cannot move, Space detonates.
  - Camera follows the sheep; AI releases it towards the nearest enemy and detonates in range.
- ☐ **T6 — Air strike** (minor)
  - Select it, click on the map: a plane flies over and drops 5 bomblets around the target.
  - Click vs. drag detection (< 6 px = click), screen → world picking, target cursor.
  - AI picks the target position that hits the most enemies. Test hook for E2E.
- ☐ **T7 — Random crates** (minor)
  - At a turn start, with a chance (setting Off / Normal / Lots) a crate teleports onto a random
    land spot (seeded, at most 4 on the map). Crates fall, can be destroyed by explosions.
  - Health crate: +25 HP for the collecting buddy. Weapon crate: +1 sheep, air strike or
    cluster grenade for the team.
  - Crate model, teleport effect, pickup banner; AI walks to a nearby crate when it has no good
    shot.

## Delivery

- ☐ **T8 — GitHub Pages deployment** (patch)
  - The build is a static site with relative asset paths (`base: './'`), so it runs on GitHub
    Pages without a server of our own.
  - Workflow `.github/workflows/pages.yml`: on every `v*` tag build and deploy `dist/` via
    `actions/deploy-pages`.
  - One-time manual step: repository Settings → Pages → Source: **GitHub Actions**.
    The game is then served at <https://marcelpetrick.github.io/AlliumAssault/>.
- ☐ **T9 — Docs** (patch): README (features, controls, Pages link), `docs/VISION.md`,
  `docs/ARCHITECTURE.md`, this file.

## Defaults chosen (change on request)

| Topic | Value |
|---|---|
| Punch | 45 damage |
| Cluster grenade | 3 per team, 5 bomblets × 10 damage |
| Sheep | 1 per team, 75 damage, radius 4, 10 s max |
| Air strike | 1 per team, 5 bomblets × 25 damage |
| Crates | Normal = 35 % chance per turn, max 4 on the map; health +25 HP |
