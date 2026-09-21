# Tasks

All requests and their status. Updated with every commit.

Every commit gets its own SemVer version (`package.json`, `CHANGELOG.md`; no tag — tags only for
releases): patch for fixes/docs/balance/tests, minor for features. Commits are atomic.
`npm run verify` must be green before each commit. See `AGENTS.md`.

Status: ☐ open · ☑ done

## Overview

| #   | Task                                                                                                      | Status | Version        |
| --- | --------------------------------------------------------------------------------------------------------- | ------ | -------------- |
| T0  | Task list in `tasks.md`, kept current with every commit                                                   | ☑      | 1.1.12, 1.4.1  |
| T1  | Fix buddies floating after the ground below is blasted away                                               | ☑      | 1.1.13         |
| T2  | Stronger Garlic Punch                                                                                     | ☑      | 1.1.14         |
| T3  | Sound: charge whoosh, flight sounds, louder bounces                                                       | ☑      | 1.2.0, 1.3.2   |
| T4  | Cluster bomb                                                                                              | ☑      | 1.3.0          |
| T11 | Versioning: bump every commit, tag only releases; `AGENTS.md`                                             | ☑      | 1.3.1          |
| T5  | Sheep                                                                                                     | ☑      | 1.4.0          |
| T6  | Air strike                                                                                                | ☑      | 1.5.0          |
| T7  | Random crates                                                                                             | ☑      | 1.6.0          |
| T10 | End-to-end tests in Chrome for every weapon, crates and sounds                                            | ☑      | 1.6.1          |
| T14 | Blowtorch: dig forward through rock for three seconds                                                     | ☑      | 1.10.0         |
| T15 | Baseball bat: less damage than the punch, knocks enemies far away                                         | ☑      | 1.8.0          |
| T16 | Sounds for walking and jumping buddies                                                                    | ☑      | 1.7.0          |
| T17 | Self-destruct: the buddy blows up with a blast that grows with its health                                 | ☑      | 1.9.0          |
| T18 | Arsenal setting: all weapons from the start, or special weapons only from crates                          | ☑      | 1.17.0         |
| T19 | Holy Garlic Grenade: waits until it rests, sings, then a huge blast                                       | ☑      | 1.12.0         |
| T20 | Banana Bomb: bursts into bouncing explosive bananas                                                       | ☑      | 1.13.0         |
| T21 | Flying Sheep: steer the sheep through the air, detonate on demand                                         | ☑      | 1.14.0         |
| T22 | Concrete Mule: falls from the sky and smashes down through the ground repeatedly                          | ☑      | 1.15.0         |
| T23 | Minigun: long rapid-fire burst that shoves buddies across the map                                         | ☑      | 1.11.0         |
| T24 | Compact weapon bar and hotkeys for 15 weapons                                                             | ☑      | 1.16.0         |
| T25 | Update dependencies (`/updateDependencies`): pinned, latest stable, verify                                | ☑      | 1.17.1         |
| T26 | Branch review (`/reviewBranch`): ten worst code and architecture issues in `review.md`                    | ☑      | 1.17.3         |
| T27 | Flying Sheep: steer with the arrow keys the whole flight, not just briefly                                | ☑      | 1.18.0         |
| T28 | Louder sound effects                                                                                      | ☑      | 1.18.3         |
| T29 | Arsenal option "Infinite supplies": unlimited ammo for every weapon                                       | ☑      | 1.19.0         |
| T30 | More sceneries: Candy Shop and Frosty Peaks                                                               | ☑      | 1.23.0         |
| T31 | Comic tombstones where buddies die                                                                        | ☑      | 1.22.0         |
| T37 | Play-in-browser link to GitHub Pages at the top of the README                                             | ☑      | 1.18.1         |
| T32 | Review and update all documents and Markdown files, including the architecture                            | ☑      | 1.26.3         |
| T33 | New screenshots and screen recordings for the README                                                      | ☑      | 1.26.2         |
| T34 | More README badges, like Cullendula                                                                       | ☑      | 1.26.1         |
| T35 | Crate drops: teleport sound and a short camera pan to the new crate                                       | ☑      | 1.18.5         |
| T36 | Banana bomb throw range reported as tiny                                                                  | ☐      |                |
| T38 | Napalm strike: burning ground for 1–2 s, flames make buddies jump, water puts them out, strong wind drift | ☑      | 1.21.0         |
| T39 | Bigger font option, persisted settings restored for the next game, Reset all button                       | ☑      | 1.24.0         |
| T40 | About screen: author, tech stack, OSS licenses, GitHub Pages, free to play                                | ☑      | 1.25.0         |
| T41 | Drill: dig vertically downwards, no fall damage while drilling                                            | ☑      | 1.20.0         |
| T42 | SPDX compatible project with check scripts                                                                | ☑      | 1.25.1         |
| T43 | Linters (best practice for the stack), fix findings, run on every push                                    | ☑      | 1.26.0         |
| T44 | New full-code `/reviewBranch`, fix the worst findings                                                     | ☑      | 1.26.14        |
| T8  | GitHub Pages deployment                                                                                   | ☑      | 1.17.2         |
| T9  | Docs: README, VISION, ARCHITECTURE                                                                        | ☑      | 1.17.5         |
| T12 | Self-review of all changes, fix findings                                                                  | ☑      | 1.17.4         |
| T13 | Push to GitHub and publish a public release                                                               | ☑      | v1.17.5        |
| T45 | Napalm bombs detonate on first contact — ground, crates and buddies — with a real impact                  | ☑      | 1.27.0         |
| T46 | Napalm fire made visible: a proper burning fire that lingers                                              | ☑      | 1.28.0         |
| T47 | Starting arsenal: bazooka, grenade, cluster, bat, blowtorch and drill available from turn one             | ☑      | 1.29.0         |
| T48 | Blowtorch burns along the aim direction, not only horizontally                                            | ☑      | 1.30.0         |
| T49 | Pause and How to Play reachable at all times from the HUD                                                 | ☑      | 1.31.0         |
| T50 | Sudden Death: after a set number of turns every buddy drops to 1 HP                                       | ☑      | 1.32.0, 1.33.0 |
| T51 | Profile the running game and cut CPU use without losing visual quality                                    | ☑      | 1.32.1         |
| T52 | `/reviewBranch` over the whole game: ten worst flaws, fix the findings                                    | ☑      | 1.32.2         |
| T53 | Public release v1.33.0: push, tag, GitHub release and Pages deployment                                    | ☑      | 1.33.0         |
| T54 | Inspect requested areas and write the actionable backlog in `todo.md`                                     | ☑      | 1.33.2         |
| T55 | Audit text size across menus, boxes and the in-game weapon bar                                            | ☑      | 1.33.5         |
| T56 | Add the text-size setting to the in-game pause menu                                                       | ☑      | 1.34.0         |
| T57 | Design and implement a Worms 2-style rope with reeling and swinging                                       | ☑      | 1.39.0         |
| T58 | Select plane approach direction with Left/Right while aiming air attacks                                  | ☑      | 1.35.0         |
| T59 | Add proximity mines that persist across turns                                                             | ☑      | 1.38.0         |
| T60 | Collect crates with Sheep and Super Sheep for their launcher                                              | ☑      | 1.36.0         |
| T61 | Debug and fix delayed Holy Garlic Grenade arming                                                          | ☑      | 1.34.1         |
| T62 | Continue backlog research with browser layout checks and normal-throw grenade diagnostics                 | ☑      | 1.33.3         |
| T63 | Finish planning research and prepare the backlog for an implementation decision                           | ☑      | 1.33.4         |
| T65 | Review the AI opponents and plan crate, blast-chain and target-selection improvements                     | ☑      | 1.34.2         |
| T66 | Implement the reviewed AI improvements                                                                    | ☑      | 1.37.0         |
| T67 | Public release v1.40.0: push, tag, GitHub release and Pages deployment                                    | ☑      | 1.40.0         |
| T68 | Investigate Firefox fire visibility and strengthen explosion, napalm and blowtorch effects                | ☑      | 1.40.1         |
| T69 | Review fire effects again, including lifecycle and browser behavior                                       | ☐      |                |
| T70 | Raise enforced core test coverage above 98% for statements, branches, functions and lines                 | ☐      |                |
| T71 | Expand E2E movement, landing and drill fall scenarios                                                     | ☐      |                |
| T72 | Raise the water continuously once Sudden Death begins                                                     | ☑      | 1.42.0         |
| T73 | Include Rope in the starting arsenal even when special weapons require crates                             | ☑      | 1.41.0         |
| T74 | Add a two-use placeable platform with move, rotate and click-to-set controls                              | ☑      | 1.43.0         |
| T75 | Map preview for the chosen seed in the setup screen                                                       | ☐      |                |
| T76 | Three gravity options in the menu, with today's gravity as the default                                    | ☐      |                |
| T77 | Crate craziness: an arsenal-style option that drops two new crates every turn                             | ☐      |                |
| T78 | Sudden Death water: one rise at the start of each turn instead of a continuous flood                      | ☐      |                |
| T79 | Dependency review and update (`/updateDependencies`)                                                      | ☐      |                |

## Current implementation plan

1. Raise the Sudden Death water once per turn instead of every frame, so sitting out a turn no
   longer floods the map faster than playing it (T78).
2. Add browser scenarios for ordinary and hard landings, jumping and a drill-cushioned fall (T71).
3. Measure the current core coverage, add behavior-focused tests for uncovered rules, then enforce
   more than 98% in each of the four Vitest metrics without excluding reachable code (T70).
4. Recheck the fire rendering and particle lifecycle in Chrome and Firefox; fix any reproducible
   issue, and verify that the new meshes leave no active objects after their effects end (T69).
5. Draw the terrain of the chosen seed into the setup screen, regenerated whenever the seed or the
   scenery changes, so the map is visible before the match starts (T75).
6. Add a gravity setting with three steps — Moon, Normal (the default, unchanged) and Heavy — that
   scales the gravity used by buddies, projectiles and everything else that falls, and reaches the
   core through the match configuration (T76).
7. Add "Crate craziness" to the crate setting: two fresh crates every turn (T77).
8. Re-examine the banana bomb's reported short range with the new gravity setting in hand (T36).
9. Run `/updateDependencies` (T79), then review the diff and run `npm run verify` before each versioned, local commit. Do not push or tag.

## Answered questions

- **How to run locally:** `npm install`, `npm run dev`, open <http://localhost:5173>
  (`?quality=low` for weak GPUs). Production: `npm run build`, `npm run preview`.
- **Versioning scheme starting at 0.1.0?** The project already follows SemVer (it was at 1.1.11);
  decision: keep the existing scheme and numbering.
- **GitHub Pages or own web server?** GitHub Pages works: the game is a static site with relative
  asset paths, so no server is needed (T8).

## Details

### T74 — Placeable platform ☑

Implemented in 1.43.0. The twentieth weapon (Shift+0, two per team) is a five-unit wooden board.
While it is selected the mouse carries a preview across the map — green where it fits, red where it
does not — the wheel tilts it in 0.08 rad steps up to 60° instead of zooming, and a left click sets
it down, which ends the turn like any other shot. A rejected spot costs neither the use nor the
turn.

`Terrain` keeps the boards outside the density field and merges them into `sample()`, so they are
solid for collision, normals, distances and the AI's surface search, but blasts cannot cut them and
the rock mesh is never rebuilt for them; `addPlatform` bumps the terrain revision so the AI drops
its cached surface heights. Each board's cosine and sine are resolved once at placement, because
`sample()` runs several times per body per physics step. `canPlacePlatform` demands open air with
0.3 units of clearance along the whole plank, keeps it inside the map and above the water, and
refuses spots occupied by a buddy, a crate or a mine. `PlatformView` draws the placed boards and the
preview; the terrain owns the collision.

### T72 — Rising water in Sudden Death ☑

Implemented in 1.42.0. Sudden Death used to be a single strike; a match between two careful players
could still crawl on. `Game.waterRising` is set when the strike lands and, from then until the match
ends, every step raises `Terrain.waterLevel` by 0.12 units per second (one world unit per eight
seconds, capped one unit below the map ceiling). The water level was already read live by everything
that can drown — buddies, mines, crates, projectiles, sheep, flyers, graves, napalm flames, the rope
hook, the camera floor and the AI's judgement of safe ground — so a roof over a hole shelters nobody
and no separate flood logic was needed. The renderer moves the water plane to the current level each
frame. Unit test: the flood starts on the configured turn, does not start before it, and drowns a
buddy sitting in a sheltered cave. E2E: the banner, the siren, a rising `waterLevel` and the water
mesh following it in the browser.

### T73 — Rope in the starting arsenal ☑

Implemented in 1.41.0. The rope is a way to get around, not firepower, so locking it behind crates
left the "Find in crates" arsenal without any traversal tool for most of a match. Dropping
`special` from its weapon definition makes it basic like the bazooka or the drill: three per team
from turn one under every arsenal setting. `CRATE_WEAPONS` derives from the same flag, so crates
now hand out the nine offensive specials only. Hotkey (Shift+9), ammo and behaviour are unchanged.

### T68 — Fire visibility and browser review ☑

At 1280×720, Chrome and Firefox both rendered napalm particles, but the blowtorch emitted only a
small glow at the buddy and a blast's bright phase was easy to miss. The same effect was more
noticeable at a closer camera distance, so this was not a Firefox-specific failure. Added animated
3D flame geometry to the blowtorch and burning patches, a short-lived emissive fireball to every
explosion, and longer, stronger torch particles. The geometry appears on the first rendered frame
and follows the core flame and torch state; meshes are hidden or removed as those states end.
Checked Firefox at 1280×720 and 800×600, Chrome at 1280×720, and extended the weapon E2E checks
to cover the visible effects and their cleanup.

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

- Match setup option **Arsenal**: _All weapons_ (every weapon with its normal starting ammo) or
  _Find in crates_ (special weapons start empty and are only found in weapon crates).
- Picking up a weapon crate adds one more of that weapon to the team's inventory.
- Special weapons: cluster bomb, sheep, air strike, self-destruct, minigun, holy garlic grenade,
  banana bomb, flying sheep, concrete mule. Weapon crates can contain any of them. Choosing
  _Find in crates_ switches crates on if they were off.
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

### T27 — Flying Sheep steering ☑

- Reproduced in Chrome: ← → did steer repeatedly, but the sheep flew so fast (13 units/s) that it
  usually hit something within two seconds, the controls turned it relative to its own heading,
  and ↑ ↓ did nothing.
- Fix: all four arrow keys steer relative to the screen (the sheep turns towards the pressed
  direction, diagonals included) for the whole flight until it explodes; slower flight
  (9 units/s) and a longer fuse (15 s) so there is time to steer. E2E test steering in several
  directions one after another.
- The AI presses arrow keys too: it cruises above the highest ground towards its target (↑ + →
  climbs at 45°) and dives in the last 6 units.

### T28 — Louder sounds ☑

- Raise the master volume and the quieter effects (footsteps, bounces, flight voices) so the game
  is clearly audible at normal system volume, without clipping on big explosions (compressor on
  the master bus).

### T29 — Infinite supplies ☑

- Third arsenal option next to _All weapons_ and _Find in crates_: every weapon has unlimited ammo.
  Unit and E2E tests.

### T30 — More sceneries ☑

- **Candy Shop**: pink frosting on chocolate ground, strawberry-milk water, pastel hills,
  lollipop trees and gumdrop props.
- **Frosty Peaks**: snow-covered ground, icy blue rock and water, snowy pines.
- Selectable in the setup, used by the title demo; E2E screenshot of each.

### T31 — Tombstones ☑

- When a buddy dies (0 HP death blast or self-destruct) a comic tombstone drops on the spot:
  rounded slab with "RIP", the buddy's name and a team-coloured ribbon, with a little wobble.
- Tombstones are physics bodies: they fall, get knocked around by explosions and sink in water.
  Drowned buddies leave none.
- Unit tests (grave on death, pushed by blasts, none when drowned) and E2E screenshot.

### Plan for T27–T31

Order: T27 flying sheep steering (a fix players hit now) → T28 volume → T29 infinite supplies →
T31 tombstones → T30 sceneries. One commit per task with tests, then a review of the batch, the
full E2E suite, and a push and release once approved.

### T36 — Banana bomb range ☐

- Reported: even at full charge the banana bomb only flies a short distance.
- Checked: at full charge and 43° aim it flies 63.5 units in Chrome with real keys, the same as
  the grenade (63.6); the core simulation agrees (first bounce 38 units out for both). Not
  reproduced yet — need the situation (aim angle, map, how it was charged).

### Batch plan

See `docs/PLAN.md` section 6 for the plan and execution order of T28–T36.

### T16 — Walking and jumping sounds ☑

- Soft footstep patter while a buddy walks, a hop sound on jump and a thud on landing.
- E2E check that the sounds play.

### T8 — GitHub Pages deployment ☑

- Workflow `.github/workflows/pages.yml`: build and deploy `dist/` via `actions/deploy-pages`
  when a release tag is pushed (and on manual dispatch).
- Repository Pages source set to GitHub Actions; game served at
  <https://marcelpetrick.github.io/AlliumAssault/>.

### T9 — Docs ☑

README (features, controls, weapons, Pages link), `docs/VISION.md`, `docs/ARCHITECTURE.md`.

### T12 — Self-review ☑

Review the full diff since v1.1.11 for bugs and cleanups, fix findings, re-run `npm run verify`.
Findings and their resolution are in `review.md`; #3 (in-turn action state as one union) stays
open as design debt.

### T13 — Push and public release ☑

Push `master`, tag the release version, push the tag (the release workflow publishes the GitHub
release with the zipped web build), confirm the Pages deployment.

- Done: `master` pushed, v1.17.5 released with the web zip, game live at
  <https://marcelpetrick.github.io/AlliumAssault/>. Pages needed enabling (source: GitHub Actions)
  and a `v*` tag rule on the `github-pages` environment.
- CI on the release commit hit a timing-dependent E2E failure in the human-turn test; fixed in
  1.17.6 (skip ahead exactly to the next human turn).

### T45 — Napalm bombs detonate on first contact ☑

- Contact-fused projectiles (`restitution === null`) only tested terrain and buddies, so napalm
  canisters, bazooka rockets and air-strike bombs flew straight through supply crates. Crates join
  the contact test.
- A napalm canister's blast (radius 1) fell below the explosion sound threshold and drew a tiny
  puff, so an impact read as "the bomb vanished". The canister gets a visible, audible burst.

### T46 — Napalm fire made visible ☑

- The burn lasted 1.8 s with small, short-lived particles — over before the camera settled.
- Longer burn, taller and brighter flames with smoke and embers, and an ignition fireball in the
  spirit of the Concrete Mule's impact blast.

### T47 — Starting arsenal ☑

Bazooka, grenade, shotgun, punch, cluster bomb, baseball bat, blowtorch and drill are basic
weapons: every team has them from turn one, also under the "special weapons from crates" arsenal.
The cluster bomb stops being crate-only and keeps a small starting stock.

### T48 — Directional blowtorch ☑

- The blowtorch burned a strictly horizontal tunnel regardless of the aim.
- It now burns along the aim direction (clamped to a sensible cone) and the buddy glides along the
  tunnel it cuts, so aiming up digs upwards and aiming down digs downwards.

### T49 — Pause and help at all times ☑

Escape already pauses and the pause screen already links the help, but nothing on screen says so.
A HUD button opens the pause menu, and How to Play is reachable from there during a match.

### T50 — Sudden Death ☑

After a configurable number of turns (default 10) every living buddy's health is halved (minimum

1. and the match announces it, so late games sharpen instead of dragging.

### T51 — Profiling and CPU budget ☑

- Measured with a Chrome DevTools CPU profile plus a per-feature frame-cost benchmark of a real
  match (Playwright driving the preview build, one setting changed at a time).
- Finding: the JavaScript main thread was idle for over 98 % of the samples — the cost is per-pixel
  work, not game logic. Of a 333 ms software-rendered frame, 4× multisampling of the scene target
  cost 119 ms (36 %). Bloom, FXAA, the vignette, the glow layer and the shadow cascades were each
  within measurement noise.
- Fixes: dropped the multisampling (FXAA already smooths the same edges — an RMSE of 0.6 % between
  the two renderings, and no visible difference on silhouettes), capped the render loop at 60 fps
  (20 fps behind a menu) since the simulation is a fixed 60 Hz step, and capped the drawing buffer
  at four megapixels so a maximised HiDPI window stops growing the pixel count without limit.
- Result: frame cost down about 40 % (333 ms → 200 ms in the same software-rendered benchmark),
  before counting the frames the rate cap saves on a high-refresh display.

### T52 — Full-game review ☑

Reviewed the whole game with the `/reviewBranch` skill (`master` is the only branch, so there is no
merge-base to diff against). Four findings survived verification — padding the list to ten would
have meant inventing them — and four further suspicions were measured and dropped. #1 (the AI
aiming the now-directional blowtorch off target), #3 and #4 are fixed; #2 (Game's public mutable
state) is recorded in `review.md` as accepted debt, since closing it properly needs read-only view
types through the renderer, HUD, AI and the test helpers.

### T53 — Public release v1.33.0 ☑

Minor bump with the patch reset to 0, as requested, for the batch T45–T52 (napalm, arsenal,
directional blowtorch, HUD pause and help, Sudden Death, the render-cost work and the full-game
review) plus the Sudden Death change to a flat 1 HP.

- Push `master`, tag `v1.33.0`, push the tag: the release workflow publishes the GitHub release
  with the zipped web build, and the Pages workflow deploys the playable build.
- README and `docs/VISION.md` now state the project is **almost feature complete**: everything on
  the vision list is implemented and covered by tests, and what remains is polish, balance and
  optional extra weapons.

### T54 — Requested code inspection and TODO backlog ☑

Recorded in 1.33.2. [todo.md](todo.md) preserves the user's numbering 0–6 and includes initial
code findings, a rope physics/integration proposal, and acceptance checks for every task.
An initial Holy Grenade terrain/wind diagnostic reproduced a delay to the 10-second arming
fallback despite very little movement; T61 fixed it in 1.34.1.

### T55–T66 — Follow-up implementation ☑

Requested and recorded in 1.33.2; every one of them is implemented, in 1.33.5 through 1.39.0.

- T55: [0. Text-size coverage and weapon-bar readability](todo.md#0-review-text-size-everywhere-especially-the-weapon-bar).
- T56: [1. Text-size setting in the pause menu](todo.md#1-add-text-size-to-the-in-game-menu).
- T57: [2. Rope design and implementation](todo.md#2-design-and-implement-the-rope-in-the-style-of-worms-2).
- T58: [3. Air-attack approach direction](todo.md#3-choose-the-direction-of-air-attacks-with-leftright).
- T59: [4. Persistent proximity mines](todo.md#4-add-proximity-mines-that-persist-across-turns).
- T60: [5. Sheep crate collection for the launcher](todo.md#5-let-sheep-and-super-sheep-collect-crates-for-their-launcher).
- T61: [6. Holy Garlic Grenade timing](todo.md#6-debug-and-fix-delayed-holy-garlic-grenade-countdowns).
- T65/T66: [7. AI opponent review and improvements](todo.md#7-review-and-strengthen-the-ai-opponents).

### T55 — Text-size coverage and layout ☑

Implemented in 1.33.5. All menu screens are scrollable when scaled content exceeds the viewport;
Large and Huge text select a compact HUD layout early enough to keep the weapon bar on-screen.
The smallest weapon and timer text was raised, and an E2E regression covers all three sizes at
960×600 across menus and a live match using actual rendered bounds and control reachability.

### T56 — Text size in the pause menu ☑

Implemented in 1.34.0. The pause menu now offers Normal, Large and Huge, applies changes while the
match remains frozen, and persists them across reloads. The menu separately retains the last saved
custom setup, preventing a text-size change during Quick Match from overwriting those settings.

### T57 — Rope ☑

Implemented in 1.39.0. `src/core/rope.ts` holds a swept hook, a length constraint around the last
corner the rope bends over, and corner wrap/unwrap with hysteresis; `stepFree()` in `physics.ts`
integrates a hanging buddy without walking, sticking or grounded damping. A `roping` phase and a
`{ kind: 'rope' }` action keep the traversal on the turn clock while `stepBuddies()` leaves the buddy
alone, so gravity is never doubled. Roping does not use the turn's shot: land, then fire. Firing while
attached is deliberately not supported, and AI rope use is deferred with the reason recorded. Shift+9;
no existing hotkey moved. Twelve core tests and one browser test, including determinism, a hands-off
swing that never gains energy, and a buddy caught mid-fall.

### T58 — Air-strike approach direction ☑

Implemented in 1.35.0. `Game.strikeDir` chooses the side the plane enters from while a plane-based
strike is selected; Left means entry on the left flying right, Right the mirror. The buddy neither
walks nor turns while choosing, the side resets to its facing at each turn start and carries over
between the air strike and the napalm strike within a turn. The plane-less concrete mule is
unaffected. The HUD gained an Approach card next to the wind gauge, and the AI sets its direction
explicitly instead of inheriting the human's choice.

### T59 — Persistent proximity mines ☑

Implemented in 1.38.0. `src/core/mines.ts` owns the unarmed/armed/triggered state machine;
`Game.mines` is a match-level list so mines outlive every turn and round. A mine is dropped at the
buddy's feet and the retreat window doubles as its 1.5-second arming delay; once armed it goes off
one second after any living buddy with health left comes within two units and it has a clear line to
them — its own team and the buddy that laid it included. Blasts chain through mines in id order,
each removed before its own blast. Dormant mines never hold up a turn. Shift+8; no existing hotkey
moved.

### T60 — Sheep crate collection ☑

Implemented in 1.36.0. `Game.sweepCrates()` collects crates along the segment a sheep really
travelled in a step, in travel order, and hands them to the existing `collectCrate()` path, so a
Super Sheep at full speed cannot skip one and the reward, sounds and HUD behave as for a walking
buddy. The recipient is the launcher, resolved through `Game.rewardee()`, which requires it to be
alive with health left so a deferred death is never undone; otherwise the crate stays on the map.
Touching a crate never detonates the sheep. The `cratePickup` event now carries the pickup position
so the HUD can show the reward where it happened as well as over its owner.

### T61 — Holy Garlic Grenade arming delay ☑

Fixed in 1.34.1. A projectile whose swept step ran into rock kept the tangential part of its
velocity but was never moved, so on a slope gravity refilled that velocity every step and the
grenade sat motionless while reporting 1.4–3.4 units/s — far above the 0.6 arming threshold. It
therefore only armed on the 10-second emergency fuse. Contacts now slide the projectile along the
surface with whatever velocity survives, and Coulomb friction bounded by the one-substep contact
load lets a slope actually hold it while leaving genuine bounces to skitter as before. In the
documented 216-throw matrix the fallback cases dropped from 117 to 4, and those four are a grenade
genuinely rolling down a 45° slope with a tailwind, which the fallback exists for.

### T67 — Public release v1.40.0 ☑

Requested on 2026-09-20 once the whole backlog was implemented and reviewed. Pushed `master`, then
pushed the single tag `v1.40.0`, which runs `.github/workflows/release.yml`: verify, zip the static
build with its checksum, and publish a GitHub release whose notes come from the 1.40.0 changelog
section. Pages deploys from the same push.

### T65/T66 — AI opponent review and improvements ☑

Requested separately on 2026-09-20. Reviewed in 1.34.2 and written up in [7. Review and strengthen the AI opponents](todo.md#7-review-and-strengthen-the-ai-opponents).
The three levels already differ in search resolution and aim noise, and the AI does fetch crates,
but it never reads a crate's contents or its own health when deciding to, never scores the chained
crate explosion that `Game.explode()` actually produces, and treats every enemy team alike. The
review also found that `simulateShot()` omits the crate `hitTest` the real game applies to contact
fuses, that blast knockback is only scored for melee and minigun, and that the AI never repositions.
Implemented in 1.37.0, except the proposed repositioning step, which is deferred with its reason
recorded: an `AiKnowledge` record gates the new understanding by level, so Easy plays exactly as
before while Normal gains crate awareness and team targeting and Hard adds knockback. `scoreBlast()`
counts the chained crate explosion, `simulateShot()` stops contact fuses at crates, crate fetching
weighs the kind against the buddy's health and the team's stock and checks the crate is reachable,
and `enemyWeight()` presses the enemy team holding the most health while finishing one down to its
last buddy.

### T62 — Further backlog research ☑

Recorded in 1.33.3. Checked three text sizes across four browser viewports and measured clipping
of title buttons and the bottom weapon bar. A 216-case matrix using the normal throw commands
reproduced the Holy Grenade's contact/rest mismatch, including on a modest slope without wind.
Updated [todo.md](todo.md) with reproduction steps, evidence, remaining audit limits, and rope
and sheep integration constraints. Implementation tasks T55–T61 were carried out afterwards.

### T63 — Planning handoff complete; implementation deferred ☑

Recorded in 1.33.4. The user requested completed research and planning, committed and pushed,
with no implementation until they decide when to begin. [todo.md](todo.md#planning-handoff)
now includes suggested order, affected files, proposed tuning and behavior, the rope solver
approach, cross-feature constraints and acceptance risks. Proposed defaults are not approvals.
No gameplay code was changed for the planning work; the user gave the go-ahead afterwards and
T55–T61 were implemented in 1.33.5 through 1.39.0.

## Defaults chosen (change on request)

| Topic         | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Punch         | 45 damage                                                      |
| Cluster bomb  | 3 per team, 25 damage main blast, 5 bomblets × 10 damage       |
| Sheep         | 1 per team, 75 damage, radius 4, 10 s max                      |
| Air strike    | 1 per team, 5 bomblets × 25 damage                             |
| Crates        | Normal = 35 % chance per turn, max 4 on the map; health +25 HP |
| Self-destruct | damage = health, radius = health ÷ 10                          |
