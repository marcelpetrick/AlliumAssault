# Tasks

All requests and their status. Updated with every commit.

Every commit gets its own SemVer version (`package.json`, `CHANGELOG.md`; no tag — tags only for
releases): patch for fixes/docs/balance/tests, minor for features. Commits are atomic.
`npm run verify` must be green before each commit. See `AGENTS.md`.

Status: ☐ open · ☑ done

## Overview

| #    | Task                                                                                                            | Status | Version        |
| ---- | --------------------------------------------------------------------------------------------------------------- | ------ | -------------- |
| T0   | Task list in `tasks.md`, kept current with every commit                                                         | ☑      | 1.1.12, 1.4.1  |
| T1   | Fix buddies floating after the ground below is blasted away                                                     | ☑      | 1.1.13         |
| T2   | Stronger Garlic Punch                                                                                           | ☑      | 1.1.14         |
| T3   | Sound: charge whoosh, flight sounds, louder bounces                                                             | ☑      | 1.2.0, 1.3.2   |
| T4   | Cluster bomb                                                                                                    | ☑      | 1.3.0          |
| T11  | Versioning: bump every commit, tag only releases; `AGENTS.md`                                                   | ☑      | 1.3.1          |
| T5   | Sheep                                                                                                           | ☑      | 1.4.0          |
| T6   | Air strike                                                                                                      | ☑      | 1.5.0          |
| T7   | Random crates                                                                                                   | ☑      | 1.6.0          |
| T10  | End-to-end tests in Chrome for every weapon, crates and sounds                                                  | ☑      | 1.6.1          |
| T14  | Blowtorch: dig forward through rock for three seconds                                                           | ☑      | 1.10.0         |
| T15  | Baseball bat: less damage than the punch, knocks enemies far away                                               | ☑      | 1.8.0          |
| T16  | Sounds for walking and jumping buddies                                                                          | ☑      | 1.7.0          |
| T17  | Self-destruct: the buddy blows up with a blast that grows with its health                                       | ☑      | 1.9.0          |
| T18  | Arsenal setting: all weapons from the start, or special weapons only from crates                                | ☑      | 1.17.0         |
| T19  | Holy Garlic Grenade: waits until it rests, sings, then a huge blast                                             | ☑      | 1.12.0         |
| T20  | Banana Bomb: bursts into bouncing explosive bananas                                                             | ☑      | 1.13.0         |
| T21  | Flying Sheep: steer the sheep through the air, detonate on demand                                               | ☑      | 1.14.0         |
| T22  | Concrete Mule: falls from the sky and smashes down through the ground repeatedly                                | ☑      | 1.15.0         |
| T23  | Minigun: long rapid-fire burst that shoves buddies across the map                                               | ☑      | 1.11.0         |
| T24  | Compact weapon bar and hotkeys for 15 weapons                                                                   | ☑      | 1.16.0         |
| T25  | Update dependencies (`/updateDependencies`): pinned, latest stable, verify                                      | ☑      | 1.17.1         |
| T26  | Branch review (`/reviewBranch`): ten worst code and architecture issues in `review.md`                          | ☑      | 1.17.3         |
| T27  | Flying Sheep: steer with the arrow keys the whole flight, not just briefly                                      | ☑      | 1.18.0         |
| T28  | Louder sound effects                                                                                            | ☑      | 1.18.3         |
| T29  | Arsenal option "Infinite supplies": unlimited ammo for every weapon                                             | ☑      | 1.19.0         |
| T30  | More sceneries: Candy Shop and Frosty Peaks                                                                     | ☑      | 1.23.0         |
| T31  | Comic tombstones where buddies die                                                                              | ☑      | 1.22.0         |
| T37  | Play-in-browser link to GitHub Pages at the top of the README                                                   | ☑      | 1.18.1         |
| T32  | Review and update all documents and Markdown files, including the architecture                                  | ☑      | 1.26.3         |
| T33  | New screenshots and screen recordings for the README                                                            | ☑      | 1.26.2         |
| T34  | More README badges, like Cullendula                                                                             | ☑      | 1.26.1         |
| T35  | Crate drops: teleport sound and a short camera pan to the new crate                                             | ☑      | 1.18.5         |
| T36  | Banana bomb throw range reported as tiny                                                                        | ☑      | 1.47.1         |
| T38  | Napalm strike: burning ground for 1–2 s, flames make buddies jump, water puts them out, strong wind drift       | ☑      | 1.21.0         |
| T39  | Bigger font option, persisted settings restored for the next game, Reset all button                             | ☑      | 1.24.0         |
| T40  | About screen: author, tech stack, OSS licenses, GitHub Pages, free to play                                      | ☑      | 1.25.0         |
| T41  | Drill: dig vertically downwards, no fall damage while drilling                                                  | ☑      | 1.20.0         |
| T42  | SPDX compatible project with check scripts                                                                      | ☑      | 1.25.1         |
| T43  | Linters (best practice for the stack), fix findings, run on every push                                          | ☑      | 1.26.0         |
| T44  | New full-code `/reviewBranch`, fix the worst findings                                                           | ☑      | 1.26.14        |
| T8   | GitHub Pages deployment                                                                                         | ☑      | 1.17.2         |
| T9   | Docs: README, VISION, ARCHITECTURE                                                                              | ☑      | 1.17.5         |
| T12  | Self-review of all changes, fix findings                                                                        | ☑      | 1.17.4         |
| T13  | Push to GitHub and publish a public release                                                                     | ☑      | v1.17.5        |
| T45  | Napalm bombs detonate on first contact — ground, crates and buddies — with a real impact                        | ☑      | 1.27.0         |
| T46  | Napalm fire made visible: a proper burning fire that lingers                                                    | ☑      | 1.28.0         |
| T47  | Starting arsenal: bazooka, grenade, cluster, bat, blowtorch and drill available from turn one                   | ☑      | 1.29.0         |
| T48  | Blowtorch burns along the aim direction, not only horizontally                                                  | ☑      | 1.30.0         |
| T49  | Pause and How to Play reachable at all times from the HUD                                                       | ☑      | 1.31.0         |
| T50  | Sudden Death: after a set number of turns every buddy drops to 1 HP                                             | ☑      | 1.32.0, 1.33.0 |
| T51  | Profile the running game and cut CPU use without losing visual quality                                          | ☑      | 1.32.1         |
| T52  | `/reviewBranch` over the whole game: ten worst flaws, fix the findings                                          | ☑      | 1.32.2         |
| T53  | Public release v1.33.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.33.0         |
| T54  | Inspect requested areas and write the actionable backlog in `todo.md` (archived)                                | ☑      | 1.33.2         |
| T55  | Audit text size across menus, boxes and the in-game weapon bar                                                  | ☑      | 1.33.5         |
| T56  | Add the text-size setting to the in-game pause menu                                                             | ☑      | 1.34.0         |
| T57  | Design and implement a Worms 2-style rope with reeling and swinging                                             | ☑      | 1.39.0         |
| T58  | Select plane approach direction with Left/Right while aiming air attacks                                        | ☑      | 1.35.0         |
| T59  | Add proximity mines that persist across turns                                                                   | ☑      | 1.38.0         |
| T60  | Collect crates with Sheep and Super Sheep for their launcher                                                    | ☑      | 1.36.0         |
| T61  | Debug and fix delayed Holy Garlic Grenade arming                                                                | ☑      | 1.34.1         |
| T62  | Continue backlog research with browser layout checks and normal-throw grenade diagnostics                       | ☑      | 1.33.3         |
| T63  | Finish planning research and prepare the backlog for an implementation decision                                 | ☑      | 1.33.4         |
| T65  | Review the AI opponents and plan crate, blast-chain and target-selection improvements                           | ☑      | 1.34.2         |
| T66  | Implement the reviewed AI improvements                                                                          | ☑      | 1.37.0         |
| T67  | Public release v1.40.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.40.0         |
| T68  | Investigate Firefox fire visibility and strengthen explosion, napalm and blowtorch effects                      | ☑      | 1.40.1         |
| T69  | Review fire effects again, including lifecycle and browser behavior                                             | ☑      | 1.44.1         |
| T70  | Raise enforced core test coverage above 98% for statements, branches, functions and lines                       | ☑      | 1.43.3         |
| T71  | Expand E2E movement, landing and drill fall scenarios                                                           | ☑      | 1.43.2         |
| T72  | Raise the water continuously once Sudden Death begins                                                           | ☑      | 1.42.0         |
| T73  | Include Rope in the starting arsenal even when special weapons require crates                                   | ☑      | 1.41.0         |
| T74  | Add a two-use placeable platform with move, rotate and click-to-set controls                                    | ☑      | 1.43.0         |
| T75  | Map preview for the chosen seed in the setup screen                                                             | ☑      | 1.45.0         |
| T76  | Three gravity options in the menu, with today's gravity as the default                                          | ☑      | 1.46.0         |
| T77  | Crate craziness: an arsenal-style option that drops two new crates every turn                                   | ☑      | 1.47.0         |
| T78  | Sudden Death water: one rise at the start of each turn instead of a continuous flood                            | ☑      | 1.43.1         |
| T79  | Dependency review and update (`/updateDependencies`)                                                            | ☑      | 1.52.2         |
| T80  | Public release v1.44.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.44.0         |
| T81  | Turn timer: the number overlaps the ring at larger text sizes — make it fit, and keep it pretty                 | ☑      | 1.47.2         |
| T82  | Explosions: thinner and more translucent, with chunks of earth thrown out of the crater                         | ☑      | 1.50.0         |
| T83  | Sudden Death: show the rising water with the camera, and end a turn the moment the active buddy drowns          | ☑      | 1.48.0         |
| T84  | Teleport: one use per match, click anywhere, arrive under ordinary physics (fall damage, water)                 | ☑      | 1.51.0         |
| T85  | Napalm: flames burn longer and eat into the ground                                                              | ☑      | 1.49.0         |
| T86  | Sound audit: one sound per action, fix the borrowed ones, add teleport and platform, document the choices       | ☑      | 1.52.0         |
| T87  | Ideation for touch-display support, written to `touchdisplay_support_ideation.md` (no code yet)                 | ☑      | 1.52.1         |
| T88  | Python script charting lines of code and coverage over the commits, embedded in the README                      | ☑      | 1.53.1         |
| T89  | Public release v1.53.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.53.0         |
| T90  | Coverage gate: run it in `verify` and CI, and bring branches back above the enforced 98%                        | ☑      | 1.54.0         |
| T91  | Browser tests: retry once, so a network hiccup does not fail a green run                                        | ☑      | 1.54.0         |
| T92  | Community health files: CONTRIBUTING, SECURITY, `.editorconfig`, Dependabot                                     | ☑      | 1.54.0         |
| T93  | Documentation refresh: ARCHITECTURE up to date, finished `todo.md` archived, `review.md` rewritten              | ☑      | 1.54.0         |
| T94  | Share metadata: description, Open Graph and theme colour, so a shared link shows the game                       | ☑      | 1.54.0         |
| T95  | Review all screenshots and recordings, re-capture what the recent work made outdated                            | ☑      | 1.54.0         |
| T96  | Weapon bar over two rows for a better overview                                                                  | ☑      | 1.54.0         |
| T97  | Respect `prefers-reduced-motion` in the overlay animations                                                      | ☑      | 1.54.0         |
| T98  | Split `game.ts` into smaller modules; `effects.ts` follows when it is next touched                              | ☑      | 1.56.0         |
| T99  | Minigun icon: a screw, not a gun — give it a firearm icon in the shotgun's style                                | ☑      | 1.54.0         |
| T100 | Group the weapons thematically in the bar: launchers, thrown, guns, melee, sheep, air, digging, …               | ☑      | 1.54.0         |
| T101 | Self-destruct: a Lemmings-style panic and countdown before the blast, in the spirit of the 1992 game            | ☑      | 1.54.0         |
| T102 | Public release v1.55.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.55.0         |
| T103 | Fix the map-dependent gravity test that failed on CI, and teach Dependabot the two version limits               | ☑      | 1.55.1         |
| T104 | Profiling run across every stage of play, best-practice audit of the stack, then the fixes worth making         | ☑      | 1.56.0         |
| T105 | Tidy the repository root: fewer Markdown files, the rest moved into folders and linked                          | ☑      | 1.66.1         |
| T106 | Graphics setting in the setup: Full or Low, saved, with `?quality=low` still forcing Low                        | ☑      | 1.57.0         |
| T107 | Full project review (code, architecture, documentation), then fix every finding                                 | ☑      | 1.57.1         |
| T108 | Teleport: show a blue cross at the cursor, so the player sees where the buddy will arrive                       | ☑      | 1.59.0         |
| T109 | End-of-match statistics screen: damage, favourite weapon, best and worst, and funnier awards                    | ☑      | 1.65.0         |
| T110 | Settings: a versioned, robust store in the browser that still loads a config written by an older build          | ☑      | 1.58.0         |
| T111 | Setup screen: put the map seed in the same row as the map preview                                               | ☑      | 1.58.1         |
| T112 | Setup screen: keep Start Battle visible instead of letting the options scroll over it                           | ☑      | 1.58.1         |
| T113 | One text scale for the whole game: menus, setup and HUD grow together, in every size mode                       | ☑      | 1.58.1         |
| T114 | Flamethrower: three seconds of burning fuel, steered with up/down, blown by wind, leaves a fire carpet          | ☑      | 1.62.0         |
| T115 | Garlic punch: boxing gloves on the buddy, and an upward punch that knocks a hole in the ceiling                 | ☑      | 1.59.1         |
| T116 | Drill: a jackhammer animation while it runs, instead of a bit that just hangs there                             | ☑      | 1.59.3         |
| T117 | Mystery crate: a clown box with a question mark, random contents — a goodie, or a mine that arms itself         | ☑      | 1.63.0         |
| T118 | Languages: English (default), German, Croatian in a Split accent, and Mandarin, chosen in the setup             | ☑      | 1.66.0         |
| T119 | Scale the sheep weapon model up by 50%, so it reads as a sheep rather than a dot                                | ☑      | 1.59.3         |
| T120 | Napalm strike: smaller flames that dig only two thirds as deep — a carpet, not a trench                         | ☑      | 1.60.1         |
| T121 | Ming vase: a very rare cluster weapon — a blue-and-white porcelain vase that shatters into shards               | ☑      | 1.61.0         |
| T122 | Baseball bat: a stadium home-run roar when the swing connects and the victim sails away                         | ☑      | 1.59.2         |
| T123 | A crate caught in a blast leaves two or three short-lived flames where it burst                                 | ☑      | 1.60.0         |
| T124 | AI: Normal and Hard hunt crates — walk to them, and take the rope when walking will not do                      | ☑      | 1.64.0         |
| T125 | AI: stop leaning on the concrete mule — spread the choice across the arsenal it actually has                    | ☑      | 1.64.0         |
| T126 | Bug: a crate collected by a sheep floats its reward twice — once at the crate, once over the buddy              | ☑      | 1.58.2         |
| T127 | Public release v1.67.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.67.0         |
| T128 | Aim while charging: up and down adjust the shot during the charge, for last-minute corrections                  | ☑      | 1.70.0         |
| T129 | Translate every user-visible string: the statistics screen still shows English in all four languages            | ☑      | 1.69.0         |
| T130 | A short document on how the project's i18n works and how to add a string or a language                          | ☑      | 1.69.1         |
| T131 | Statistics: more colour, green for good and red for bad, blunders, favourite weapons, deaths by cause, tool use | ☑      | 1.69.0         |
| T132 | Check the blowtorch actually burns a buddy it walks into — it should                                            | ☑      | 1.68.3         |
| T133 | Rename the buddies in a team, the way the team itself can be renamed, and remember the names                    | ☑      | 1.71.0         |
| T134 | Setup screen: a bigger map-seed field and a bigger dice button                                                  | ☑      | 1.71.0         |
| T135 | Public release v1.72.0: push, tag, GitHub release and Pages deployment                                          | ☑      | 1.72.0         |
| T136 | Public release v1.74.0: the translation fixes, the About button and the documentation guards                    | ☑      | 1.74.0         |
| T137 | Bug: background trees are scattered below the waterline and stand in the sea                                    | ☐      |                |
| T138 | Walled landscape option: an indestructible wall round the level, no falling out, no aircraft                    | ☐      |                |
| T139 | A tooltip on the walled-landscape option explaining what it turns on and off                                    | ☐      |                |
| T140 | Gravity: check it is applied at all, then Moon at half, a normal default, and a superheavy                      | ☐      |                |
| T141 | Ming vase shards should go off on contact, not on a timer — they are contact bombs                              | ☐      |                |
| T142 | Air-strike marker does not sit under the mouse: it is drawn nearer the camera than it is picked                 | ☐      |                |
| T143 | README: state every weapon's damage explicitly, fragments and payloads separately                               | ☐      |                |
| T144 | Shorten the retreat window after firing from five seconds to three                                              | ☐      |                |
| T145 | AI stands beside a crate without taking it; every difficulty should hunt crates                                 | ☐      |                |
| T146 | "French Attack": wave a white flag, fire nothing, hand the turn to the next buddy                               | ☐      |                |

## Current implementation plan

Seven items from one play session. Smallest and most certain first, so each lands on a green tree.

1. **T137 — the tree in the sea.** The background hill bands fade to `waterLevel - 2` at their front
   and back edges, and trees are scattered across that range without checking the ground under them
   is dry. Scatter only above the waterline.

2. **T141 — the vase's shards are contact bombs.** They carry a 1.2 s fuse and bounce; they should
   go off on the first thing they touch, like the cluster bomb's bomblets.

3. **T142 — the strike marker does not sit under the mouse.** `pick()` intersects the gameplay plane
   at z = 0, but the reticle is drawn at z = −0.8 and the teleport cross at z = −0.6 — nearer the
   camera, so perspective pushes them away from the cursor, and further the nearer the screen edge.
   Pick the point on the plane the marker is actually drawn on.

4. **T140 — the gravity options.** Measured first: the setting is applied correctly and does change
   the flight, so nothing is broken. But at Moon a full-power bazooka carries 145 units across a
   128-unit map — it leaves the island entirely, which is what "everything is flying" means. Moon
   becomes a true half, Normal stays the default, and a superheavy option joins the end.

5. **T138 + T139 — the walled landscape.** An option in the setup screen: an indestructible wall
   round the arena, so nothing falls off the edge and every shot stays in play. Sudden Death still
   floods it — drowning becomes the only way out. Aircraft are switched off while it is on, since a
   plane over a sealed arena is the one thing that could still reach outside it. The option carries
   a tooltip saying both halves of that, because it changes two things at once.

6. **T144 — three seconds to retreat.** Five is long enough to walk out of your own blast and
   halfway across the map; three keeps the shot honest.

7. **T145 — the AI walks up to a crate and stops.** Reported from play: bots stand beside a crate
   and never take it. Find out why before changing anything, then make crate-hunting something
   every difficulty does rather than the top two only.

8. **T146 — the French Attack.** A weapon that does nothing: raise a white flag and the turn passes
   to the next buddy. Useful when every shot you have would hurt you more than them, and funny,
   which is the other half of why it is going in.

9. **T143 — the damage table.** The README gives one damage figure per weapon, which is a half-truth
   for anything that splits: the cluster bomb says 25 and then throws five bomblets. Every weapon
   states its own blast and, separately, what each fragment or bomb of its payload does — taken from
   the weapon table so the numbers cannot drift.

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

### T77 — Crate craziness ☑

Added in 1.47.0. The crate setting used to be a chance per turn; it now reads as crates per turn,
which is the same thing below 1 and a guaranteed count from 1 upwards, so the new "Craziness" option
is simply the value 2: two fresh crates at the start of every turn. The cap on crates lying about
scales with it — four per crate a turn brings, so four as before and eight under Craziness — and a
turn that finds no free spot left simply drops fewer. Unit test: two crates and two spawn events per
turn, growing to the bigger cap and no further, all on real ground clear of the buddies. Browser
test: two crates teleport in with their sound on the second turn, two more on the third.

### T76 — Gravity setting ☑

Added in 1.46.0. `MatchConfig.gravity` carries a multiplier that the match hands to
`Terrain.gravityScale`, next to the water level: the arena's pull belongs to the arena, and every
piece of physics already receives the terrain, so buddies, projectiles, crates, mines, tombstones,
ropes, falling bombs and the AI's own trajectory simulation all read the same number without a new
parameter anywhere. The setup screen offers Moon (0.55), Normal (1, exactly the world the game has
always had) and Heavy (1.5), the choice is persisted with the other settings, and the HUD shows a
badge whenever the pull is not the ordinary one. Unit tests: default 1, jumps scale with the
setting, a grenade flies more than 30% further on the moon than in the heavy world, and a long fall
costs less health. Browser test: the setting picked in the menu reaches the match, shows in the HUD
and floats the jump.

### T75 — Map preview in the setup screen ☑

Added in 1.45.0. Players picked a seed blind and only saw the island once the match had started.
`src/ui/mapPreview.ts` draws it on a plain 2D canvas next to the seed field: it generates the map
with the very `generateTerrain` the match uses, so the picture cannot drift from what is played,
and paints it as a silhouette in the chosen scenery's rock, grass and water colours — caves,
overhangs and floating ledges included. Generated maps are cached (24 seeds), typing a seed repaints
after a 250 ms pause, and picking another scenery recolours the same island. Browser test: the
preview is drawn, changes with the seed, changes again with the scenery, and the match that starts
really uses the previewed seed.

### T69 — Second fire review: a real particle leak ☑

Fixed in 1.44.1. Measured in Chrome instead of eyeballed: a probe counted the scene's particle
systems around a napalm strike. Seven one-shot bursts turned into 26 systems that were still there
nine seconds and ninety-six rendered frames later, each holding two to seventy particles that never
aged a single step. Their `isReady()` had flipped to false, and Babylon's `animate()` returns
early for a system that is not ready, so `disposeOnStop` never fired: they stayed in the scene,
drawn and paid for, until the match ended. It happens when bursts are created while the page is
not rendering — the AI's turn, a background tab, a `fastForward` — so an ordinary long match
accumulates them.

Three fixes: every one-shot system (explosion bursts and projectile trails) is now registered with
the time by which it must be gone — its longest particle life plus a second — and `Effects.update`
disposes whatever Babylon has not; the two napalm systems and the blowtorch flame, which are kept
between uses, are `reset()` three seconds after their last flame goes out, so frozen particles
cannot hang in the air over cold ground; and the napalm particles now read the flames of the
current frame instead of the ones captured when the systems were built.

A browser test covers it: a strike, the burn, and afterwards no ground-flame meshes, no napalm
light, no leftover one-shot systems and not one particle still drawn. Firefox is not in the
Playwright setup, so its check remains the manual one from T68; nothing in the fix is
browser-specific.

### T80 — Public release v1.44.0 ☑

Requested on 2026-09-21 in the middle of the backlog, so the rope, the flood, the platform and the
new tests reach players before the rest is finished. Pushed `master`, then pushed the single tag
`v1.44.0`, which runs `.github/workflows/release.yml`: verify, zip the static build with its
checksum, and publish a GitHub release whose notes come from the 1.44.0 changelog section. Pages
deploys from the same push. The open tasks T36, T69, T71 follow-ups and T75–T79 stay open.

### T70 — Core coverage above 98%, enforced ☑

Raised in 1.43.3. The Vitest thresholds had stood at 90/85/90/90 while the suite actually reached
far more, so a real gap could open without anything failing. Two test files were added for the
paths that only ever came up at the edges — `tests/game-edges.test.ts` for turn, rope, sheep,
crate, mine, grave and boundary handling plus a draw, and `tests/ai-edges.test.ts` for AI scoring,
crate fetching and recovery — and `tests/terrain.test.ts` gained the boundary cases of fire, flyer,
mine, rope and contour code. Nothing reachable is excluded from the report. The run now measures
99.8% statements, 98.2% branches, 100% functions and 99.9% lines, and the enforced threshold is
98% in each of the four. `coverage/` is now ignored by ESLint, so a local coverage run no longer
trips the lint step.

### T71 — Movement, landing and drill scenarios in the browser ☑

Added in 1.43.2. The browser suite checked weapons and features but never the plain act of moving
about. Two scenarios close that: a jump that rises more than a unit, comes back to the same ground
unhurt and thuds on landing, followed by a ten-unit drop onto the same spot that costs health; and
a drill started over a hollow that digs the buddy through it and down past it with full health,
which is the fall-damage exemption the drill is supposed to give.

### T78 — One water rise per turn ☑

Fixed in 1.43.1. The flood introduced in 1.42.0 climbed by the second, which rewarded stalling:
a player who let the whole turn clock run down flooded the map further than one who acted. The
water now climbs one world unit in `beginTurn`, before the turn is announced, and not at all in
between. The strike turn itself stays dry, so the Sudden Death banner and the first rise do not
land together. Unit tests cover the per-turn step, that ten seconds of play inside a turn move
nothing, and that a buddy under a rock roof still drowns; the browser test checks the same
sequence and that the water surface follows.

### T72 — Rising water in Sudden Death ☑

Implemented in 1.42.0. Sudden Death used to be a single strike; a match between two careful players
could still crawl on. `Game.waterRising` is set when the strike lands and, from then until the match
ends, the water climbs (see [T78](#t78--one-water-rise-per-turn-), which made the rise per turn
rather than per second), capped one unit below the map ceiling. The water level was already read live by everything
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

### T103 — A test that depended on the map, and two Dependabot limits ☑

Fixed in 1.55.1. The first CI run after the release caught something the local runs never did: the
gravity test starts a match from the setup screen, which carries a _random_ seed, so the jump it
measured happened on a different island every time — and on CI the buddy jumped into a ceiling,
making the Moon jump only 1.18× the normal one instead of the expected 1.4×. It now flattens the
ground and places the buddies before measuring, which is what the other movement tests already did.
Ran ten times locally without a wobble.

At the same time Dependabot, newly configured, proposed TypeScript 7.0.2 and `@types/node` 26 — the
two updates that were deliberately held back hours earlier — and `npm ci` failed on the peer
conflict. Both majors are now on its ignore list with the reason written next to them, and the pull
request was closed with that explanation.

### T102 — Public release v1.55.0 ☑

Requested on 2026-09-21 after the review batch. Pushed `master` and the single tag `v1.55.0`, which
runs the release workflow — now gated on coverage as well — and deploys Pages from the same push.

### T106 — A graphics budget the player picks ☑

Added in 1.57.0. The renderer had one fixed budget — four million pixels at up to 1.5× device
density — and one escape hatch, `?quality=low` in the URL, which nobody finds. The setup screen now
has **Graphics: Full or Low**, saved with the rest of the settings. Full is the default and is
deliberately generous (8.3 megapixels, up to 2× density, shadow cascade, bloom, MSAA), because the
game is meant to look right on a desktop even where that costs frames; Low halves the density, caps
at 2.1 megapixels and drops the three expensive passes. The URL parameter still wins, so a machine
that cannot render the menu smoothly has a way in. The setting takes effect for the next match, not
the one on screen: the scene is built once, with the budget it was given.

### T104 — Profiling, and a bundle four times smaller ☑

Measured in 1.56.0 and written up in [docs/PERFORMANCE.md](PERFORMANCE.md), which also says how
to reproduce every number and which tools to reach for.

**The rules core was profiled first, stage by stage**, with a new `npm run profile` (a Vitest run
under `vitest.profile.config.ts`, kept away from the unit tests): an idle turn, a walking buddy,
twelve projectiles, twenty burning napalm patches, sixteen buddies with crates, mines and graves, a
Sudden Death flood, an AI turn, a crater with its chunk re-contoured, and terrain sampling with and
without platforms. The answer was that there is nothing to win: the worst ordinary case is 31.7 µs
per step, a fifth of one percent of a 16.7 ms frame. The core was left alone and the numbers checked
in, so a future change that makes it ten times dearer is visible.

**The browser was a different story.** A probe with nothing but an engine, a scene, a camera, a
light, a box and a standard material built to 6.71 MB — against 6.89 MB for the whole game. The
game's own code and every feature it uses was 180 kB; the rest was `@babylonjs/core`'s barrel, which
re-exports the entire engine and defeats tree-shaking. Switching all twenty-seven imported symbols
to their own modules cut the entry chunk from **6,889 kB to 1,510 kB, and the transfer from
1,522 kB to 374 kB** — 78%. And it proved why the browser suite exists: part of Babylon's API is
installed on `Scene.prototype` by a module whose only job is that side effect, so `createPickingRay`
quietly vanished, the game still built and typechecked, and every weapon aimed by clicking the map
did nothing. Seven tests failed; `import '@babylonjs/core/Culling/ray'` asks for it by name.

### T98 — `game.ts` split, `effects.ts` deferred ☑

Done in 1.56.0. `game.ts` opened with 250 lines of types, phase groups, tuning constants and pure
helpers before the class began; they now live in `src/core/match.ts` — what a match is made of —
while `game.ts` is the state machine that operates on them and re-exports every moved name, so not
one import in `src`, `tests` or `e2e` had to change. `effects.ts` keeps its model factories for now,
which leaves [finding 9](review.md#9--partly-fixed-1560--gamets-1571-lines-and-effectsts-1348-are-too-big)
half open on purpose: splitting it is better done the next time it changes.

### T90–T101 — Review fixes, the weapon bar and the Lemmings moment ☑

All in 1.54.0, from the repository review written up in [review.md](review.md).

**T90 — the coverage gate never ran.** `verify` and all three workflows ran `npm test`, which does
not measure coverage, so the 98% enforced since 1.43.3 was checked by nothing — and branches had
already slipped to 97.97%. All four now run `npm run coverage`, and the branches that slipped (the
panic step without an active buddy, the crate rate at zero, the hotkey label past the letter keys)
are covered again: 99.8% statements, 98.1% branches, 100% functions, 99.8% lines.

**T91 — one retry for the browser suite.** Two runs failed on `net::ERR_NETWORK_CHANGED`, which
says nothing about the game.

**T92 — community health files.** `CONTRIBUTING.md` (pointing at `AGENTS.md` rather than repeating
it), `SECURITY.md` with the honest attack surface of a static site, `.editorconfig`, and Dependabot
with grouped dev tooling and the `build(deps)` prefix the project already uses.

**T93 — documentation.** `ARCHITECTURE.md` said nineteen weapons and knew nothing of the platform,
the teleport, gravity, the flood, the map preview or the particle sweeper; its state machine had no
`panicking` state. The finished `todo.md` moved to `docs/archive/todo-2026-09.md`, and `review.md`
now holds this review instead of the one from 1.26.14.

**T94 — share metadata.** A description, Open Graph tags, a theme colour: the Pages link showed a
bare URL when posted anywhere.

**T95 — media.** Every screenshot and the GIF were from 2026-09-17 and showed the old timer, the
one-row nineteen-weapon bar and the old thick explosions, so all of them were re-captured from a
preview build of this version. The `linkedin/` clips are left alone on purpose: they are the
recordings of a post that was already published, and re-cutting them would misrepresent it.

**T96, T99, T100 — the weapon bar.** Twenty-one weapons in one strip had become a wall, the minigun
wore a screw (🔩) and the order was the order in which the weapons had been built. The bar is now a
grid of eleven by two, and the order is thematic: launcher and thrown family, guns, fists, sheep,
what is called in from the sky, digging, getting about and building, traps and last resorts, with
the teleport on **T**. That moves every hotkey — the one place where "append, never reorder" is
deliberately broken, on request — so the README table (now generated from the weapon order and
carrying the keys), VISION, the HUD hint and every browser test moved with it. The minigun took the
gun icon; the shotgun, whose two barrels are the loudest thing about it, took 💥; and self-destruct
is now ☠️, which says what it does better than another explosion did.

**T97 — reduced motion.** The overlay's own decoration holds still under `prefers-reduced-motion`;
the game itself does not, because that motion is what the player asked for.

**T101 — the Lemmings moment.** Self-destruct went off the instant it was pressed, which is not how
anyone remembers it from 1992. Pressing the detonator now starts a `panicking` phase: a new
`PanicAction` counts three seconds down, the HUD floats "Oh no!" and then the seconds over the
buddy's head, the alarm gives way to a beep per second, the camera holds on it and the buddy shakes
and swells until it takes the hillside with it. Nothing can stop it once started — a buddy killed
mid-panic still goes off — which is both truer to the original and simpler to reason about.

### T88 — Growth and coverage chart ☑

Added in 1.53.1. `scripts/history_chart.py` draws two panels against the commit number — a date axis
squeezed nine tenths of the work into the last centimetre, because the project was written in
bursts, so the dates went onto the ticks instead. The top panel stacks the lines of code in the
rules core, the renderer, the app and UI, the unit tests and the browser tests, read straight out of
git for all 163 commits through a single `git cat-file --batch`, and marks the largest drop in the
line, which is the day the 2D prototype was thrown away. The bottom panel plots the four Vitest
metrics for `src/core`.

Measuring coverage at a past commit means running the suite there, so it is sampled at every tenth
commit — as requested — in a throwaway `git worktree` with today's `node_modules` symlinked in, and
every result is cached in `docs/history-coverage.json`, so a later run only measures what it does
not already know. The picture it tells: coverage sat in the low nineties through the build-out,
branches as low as 83.7%, and jumped to 98–100% when the thresholds were raised in
[T70](#t70--core-coverage-above-98-enforced-). The chart is embedded at the bottom of the README.

### T89 — Public release v1.53.0 ☑

Requested on 2026-09-21 once the batch from T81 to T87 was finished and reviewed. The diff since
v1.44.0 — thirteen commits — was read through before pushing: the teleport's refusals, the crate
loop's per-crate occupancy, the gravity multiplier reaching every falling thing, the particle
sweeper and the new sounds all checked against their tests. Pushed `master`, then the single tag
`v1.53.0`, which runs `.github/workflows/release.yml`: verify, zip the static build with its
checksum, publish the GitHub release from the 1.53.0 changelog section. Pages deploys from the same
push. T88 stays open by request, to be done after the release.

### T79 — Dependency review ☑

Run in 1.52.2. Every dependency was already pinned to an exact version, so only the versions moved:
Babylon.js 9.26.2 → 9.27.1, ESLint 10.10.0 → 10.11.0, Prettier 3.9.7 → 3.9.8, markdownlint-cli2
0.23.2 → 0.23.3 and `@types/node` 24.13.5 → 24.13.6. Two newer releases were deliberately not taken:

- **TypeScript 7.0.2** — typescript-eslint 8.70.0 declares `typescript >=4.8.4 <6.1.0`, so the whole
  type-aware lint setup would stop working. Staying on 6.0.3, the latest of the supported line.
- **`@types/node` 26.x** — the runtime, and CI, are Node 24; types for a newer runtime would describe
  APIs that are not there. Staying on the latest 24.x.

`npm run verify` — lint, typecheck, unit tests, build and the 58 browser tests — passed on the new
versions with no code changes needed.

### T87 — Touch-display ideation ☑

Written in 1.52.1 to [touchdisplay_support_ideation.md](touchdisplay_support_ideation.md); no code
was changed. It starts from an inventory of every input the game needs — how often it is used and
how precise it has to be — and finds that only three are hard on glass: aiming, charging, and
picking a spot on the map. The proposal is a landscape layout with a four-way pad under the left
thumb (walk and aim, held exactly like the arrow keys), a FIRE button that charges while held with
the charge drawn as a ring around it, JUMP above it, the existing weapon bar grown into a scrolling
strip with a grid behind it, and camera panning and pinch-zoom on the map itself. The map weapons
become tap-a-marker, adjust, confirm, because a mis-tap costs a turn where a mis-click never did.
The overlay is off by default, offered once when a touch is first seen, and settable to Off / On /
Auto beside the text size. The document also covers handedness, safe areas, haptics, the browser
details (`touch-action`, `dvh`, a PWA manifest), how the flows would be tested with Playwright's
touch emulation, a three-phase estimate of five to eight days, and four open questions for the
decision.

### T86 — Sound audit ☑

Done in 1.52.0, and written up in [docs/SOUND.md](SOUND.md), which now holds the principles,
the full action-to-sound table and the reasoning for every change. The audit listed every action
and weapon against what it actually played and found six borrowed voices:

- the grenade, cluster bomb, holy grenade and banana bomb all played the bazooka's launch roar
  although nothing about them is launched under power — the report that started this — and now
  have a `throw`: a short whoosh with a grunt under it;
- the blowtorch also roared like a rocket, and now lights its gas with a click and a rush
  (`torchLight`) before the running-torch loop takes over;
- the platform borrowed the mine's metal `clunk` and now knocks twice in wood (`build`);
- the teleport borrowed the crate's arrival shimmer and now has its own fold-away-and-back (`warp`);
- explosions under 1.2 radius played the shotgun blast and now use a small `pop`;
- Sudden Death played the self-destruct countdown and now has a deeper, slower `siren`, because one
  ends a turn and the other changes the match.

Five new voices were synthesized for that (`throw`, `pop`, `build`, `warp`, `torchLight`, `siren`),
and the noise helper learned a delay so a sound can be built from timed layers. Unit tests pin the
expected voice of every selectable weapon — a new weapon cannot be added without deciding what it
sounds like — and assert that only the bazooka roars and that every thrown weapon is a lobbed one;
a browser test checks that a grenade plays `throw` and never `fire`.

### T84 — Teleport ☑

Added in 1.51.0 as the twenty-first weapon: one use per match, or more from crates, since it is
flagged special. Press **T** — the twenty digit slots were full, so weapons past them now carry a
letter key, and `LETTER_KEYS` maps the code to the weapon for both the keyboard handler and the
weapon bar's label — then click any free spot. The buddy appears there with no speed and no support,
which is the whole point: from that moment it is an ordinary body, so it falls, takes the usual fall
damage, lands on a platform or drowns exactly like anyone else. A spot inside rock, too tight for
the buddy's girth, or off the map is refused and costs neither the use nor the turn; the fire button
does nothing, as for the other mouse-pointed weapons, which now share a `MAP_WEAPONS` list instead
of three separate comparisons. The renderer shimmers at both ends and holds the camera on the
arrival. Unit tests cover the beam, the ammo, the turn end, the fall damage, drowning and every
refusal; the browser test presses T, clicks, and watches the buddy arrive and fall.

### T82 — Thinner explosions that throw earth ☑

Done in 1.50.0. Since the fire effects were strengthened, a blast was a wall of sprites: it hid the
buddies, the crater and everything else behind it. The fire and smoke bursts now use about half the
particles and are drawn see-through (alpha 0.62 and 0.4 instead of 1 and 0.75), and the fireball
fades from 0.5 rather than 0.8, so the blast reads as a flash of fire with the world visible through
it.

In exchange the ground itself takes part: a blast that finds rock around it throws up to sixteen
tumbling lumps of earth in the scenery's own dirt colour, ballistic, spinning, shrinking away after
a second or two. They are meshes rather than particles on purpose — a handful of solid, spinning
pieces reads as "the ground came apart" in a way a sprite cloud never does. How many depends on how
much ground the blast actually found: the renderer samples two rings just outside the fresh crater,
so a blast in mid-air throws nothing, one on a hillside throws a few and one buried in rock throws
the lot. A browser test checks both ends of that and that the lumps clean themselves up.

### T85 — Napalm burns longer and eats into the ground ☑

Done in 1.49.0. The patches lasted about five seconds and left the ground exactly as they found it,
so a napalm strike was a light show with no aftermath. A patch now burns for nine seconds and takes
bites out of what it burns on: a 0.3-unit disc of rock every 1.1 s, four bites at most, after which
it only keeps burning. The flame sinks into the hollow it made — the rule that lets a flame follow
ground blasted from under it — so a patch ends up about 1.5 units deep and the ground keeps the
scar. Four bites is the cap on purpose: napalm should char a dent, not sink a mineshaft. Unit tests
cover the longer burn, the dent, its depth and the floor left under it; the browser test checks the
ground really lost substance where it burnt.

### T83 — Sudden Death you can see, and no turn wasted on a drowned buddy ☑

Done in 1.48.0. Two problems: the water climbed silently at the start of a turn, which players only
noticed once it had swallowed something, and a buddy the flood took during its own turn intro left
the match standing still until its 45-second clock ran out — `damage()` and `drown()` end a turn
only in the phases where the team is really playing, and the intro is not one of them.

`raiseWater` now reports that it moved and emits a `waterRise` event with the new level. The turn
intro grows by 1.4 s, the camera holds on the waterline for it — the same mechanism a freshly
teleported crate uses — and the HUD floats a "🌊 rising" label there. And one rule was added to the
step: a buddy that is no longer alive during its own `turnStart` ends the turn at once. Unit tests
cover the event and the turn handover, a browser test checks that the camera dips from the buddy
towards the water and that a drowned buddy's turn is over inside the intro with the full clock
untouched.

### T81 — Turn timer fits its ring ☑

Fixed in 1.47.2. The caption sat inside the circle, 13 px from its bottom, where the ring's arc cuts
across the line: at Large and Huge text "TURN" — and worse, "RETREAT" — ran straight through the
green arc, and the number, nudged up by a negative margin, grazed the top of it. The card is now a
small column: the ring holds the number and nothing else, the caption sits underneath it where no
arc can reach it, and the digits use tabular figures so the number no longer jitters as the clock
counts down. A browser test measures it at all three text sizes, in both the turn and the retreat
phase: every corner of the number stays inside the ring's inner radius and the caption starts below
the ring.

### T36 — Banana bomb range ☑

Closed in 1.47.1 as not a defect, with the measurements to back it. The banana bomb shares the
grenade's launch speeds (6 to 30), gravity scale and wind influence, so a full charge has to carry
it the same distance. Measured on flat ground without wind, from the buddy to the first blast:

| Aim | Banana Bomb | Grenade | Bazooka |
| --- | ----------- | ------- | ------- |
| 20° | 49.8        | 46.6    | 48.7    |
| 34° | 65.7        | 61.5    | 68.2    |
| 45° | 61.4        | 61.0    | 72.4    |
| 57° | 48.1        | 48.0    | 65.6    |

The banana bomb matches or beats the grenade at every angle, and its bananalets scatter another ten
units beyond the blast; the earlier Chrome measurement with real keys (63.5 against 63.6) agrees.
A unit test now guards it against an accidental nerf. What the report probably felt is the arc:
both are lobbed weapons and fall well short of the bazooka above 45°. Anyone wanting longer throws
can now pick Moon gravity ([T76](#t76--gravity-setting-)), which carries the same throw 75.8 units
instead of 61.4.

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

Recorded in 1.33.2. [todo.md](docs/archive/todo-2026-09.md) preserves the user's numbering 0–6 and includes initial
code findings, a rope physics/integration proposal, and acceptance checks for every task.
An initial Holy Grenade terrain/wind diagnostic reproduced a delay to the 10-second arming
fallback despite very little movement; T61 fixed it in 1.34.1.

### T55–T66 — Follow-up implementation ☑

Requested and recorded in 1.33.2; every one of them is implemented, in 1.33.5 through 1.39.0.

- T55: [0. Text-size coverage and weapon-bar readability](docs/archive/todo-2026-09.md#0-review-text-size-everywhere-especially-the-weapon-bar).
- T56: [1. Text-size setting in the pause menu](docs/archive/todo-2026-09.md#1-add-text-size-to-the-in-game-menu).
- T57: [2. Rope design and implementation](docs/archive/todo-2026-09.md#2-design-and-implement-the-rope-in-the-style-of-worms-2).
- T58: [3. Air-attack approach direction](docs/archive/todo-2026-09.md#3-choose-the-direction-of-air-attacks-with-leftright).
- T59: [4. Persistent proximity mines](docs/archive/todo-2026-09.md#4-add-proximity-mines-that-persist-across-turns).
- T60: [5. Sheep crate collection for the launcher](docs/archive/todo-2026-09.md#5-let-sheep-and-super-sheep-collect-crates-for-their-launcher).
- T61: [6. Holy Garlic Grenade timing](docs/archive/todo-2026-09.md#6-debug-and-fix-delayed-holy-garlic-grenade-countdowns).
- T65/T66: [7. AI opponent review and improvements](docs/archive/todo-2026-09.md#7-review-and-strengthen-the-ai-opponents).

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

Requested separately on 2026-09-20. Reviewed in 1.34.2 and written up in [7. Review and strengthen the AI opponents](docs/archive/todo-2026-09.md#7-review-and-strengthen-the-ai-opponents).
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
Updated [todo.md](docs/archive/todo-2026-09.md) with reproduction steps, evidence, remaining audit limits, and rope
and sheep integration constraints. Implementation tasks T55–T61 were carried out afterwards.

### T63 — Planning handoff complete; implementation deferred ☑

Recorded in 1.33.4. The user requested completed research and planning, committed and pushed,
with no implementation until they decide when to begin. [todo.md](docs/archive/todo-2026-09.md#planning-handoff)
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
