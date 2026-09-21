# Changelog

All notable changes to this project are documented here. Versions follow SemVer.

## [1.58.2] — 2026-09-22

### Fixed

- **A crate collected by a sheep no longer floats its reward twice.** The HUD printed the pickup at
  the crate and again over the buddy that was credited, which read as two crates rather than one.
  Only the rewarded buddy's number remains, so what is on screen is what the rules did.

## [1.58.1] — 2026-09-22

### Fixed

- **Start Battle is pinned to the bottom of the setup panel.** The options are taller than any
  viewport — nearly twice the screen at Huge text — so the button that starts the match used to
  scroll away under them. It now sits on a blurred bar at the foot of the panel, wherever the
  options have been scrolled to.
- **The map seed sits beside the picture it makes.** Seed and preview were two independent cells in
  a wrapping grid and could land rows apart; they now share a row of their own, so typing a seed
  and seeing the island it produces is one motion.

### Added

- A browser test that measures the menu, the HUD, the weapon bar and the buddy name tags at every
  text size and fails unless they all grow by the same factor — the guarantee behind the Text size
  setting, now checked rather than assumed.

## [1.58.0] — 2026-09-22

### Added

- **The settings store carries a schema version.** What the browser keeps is now stamped with the
  shape that wrote it, and a migration chain brings an older blob up to the current one before the
  field-by-field validation ever sees it — so a config saved by 1.57.1, which had no version and no
  graphics setting, still opens with everything the player chose. A config written by a *newer*
  build is read for what this one understands instead of being thrown away, so opening an older tab
  no longer costs you your setup.

## [1.57.1] — 2026-09-22

### Fixed

- **The browser suite could certify a stale build.** `reuseExistingServer` was unconditional, so
  `npm run e2e` skipped its own `npm run build` whenever anything was already serving :4173 — and
  then reported green for whatever happened to be in `dist/`. It now rebuilds locally, as
  Playwright's own default does.
- **A release could publish a build the browser suite had never seen.** `release.yml` ran lint,
  typecheck, coverage and build but not `npm run e2e` — the one gate that watches the renderer
  actually run, and the one that caught the missing picking-ray import in 1.56.0. It runs it now.
- **The bundle budget could no longer fire.** `chunkSizeWarningLimit` sat at 8,000 kB, above even
  the 6.9 MB bundle the deep imports removed, so re-introducing a barrel import would have been
  silent. It is now just above the real entry chunk, and a unit test fails outright on
  `from '@babylonjs/core'` anywhere in `src`, or on a picking ray built without its side-effect
  import.
- `npm run profile` now checks each stage against a generous ceiling instead of only printing, so
  the claim that a tenfold regression is visible is one the suite actually keeps.
- `state().quality` reported the pending menu choice rather than the budget the scene on screen was
  built with; `World` now keeps its quality and answers for itself.
- Four members carried a second, stale doc comment — `get rope()` described as the flying sheep,
  `dropCrates()` as returning a boolean, `selfDestruct()` as the blast it only schedules. The
  flying sheep has its comment back.

### Changed

- The crate setting's loudest option is now called **Cratyness**.
- `Quality` and its options moved out of the Babylon-laden `world.ts` into `render/quality.ts`, so
  the settings and the setup screen no longer reach into the renderer for a string union.
- `README.md` lists `src/core/match.ts` and `bench/`; `AGENTS.md` describes the weapon hotkeys the
  code actually implements.

## [1.57.0] — 2026-09-21

### Added

- **A Graphics setting in the setup screen**, Full or Low, saved with the other settings. Full is
  the default and now spends what a desktop can afford — up to 8.3 megapixels at twice the device
  density, where the old fixed budget capped everything at 4 million pixels and 1.5× — while Low
  drops the shadow cascade, bloom and MSAA for a weak GPU. `?quality=low` in the URL still forces
  Low, for a machine that cannot get as far as the menu. The choice applies to the next match; the
  one on screen keeps the scene it was built with.

## [1.56.0] — 2026-09-21

### Changed

- **The bundle is a quarter of its size**: 6,889 kB down to 1,510 kB, and 1,522 kB down to 374 kB
  over the wire. Babylon.js was imported from its package root, a barrel that re-exports the whole
  engine and defeats tree-shaking — a probe with nothing but a box and a light still weighed
  6.71 MB. Every Babylon symbol is now imported from its own module, and the one piece of the API
  that lives on `Scene.prototype` rather than on a class — the picking ray the map-click weapons
  aim with — is asked for by name.
- `npm run profile` measures the rules core stage by stage, and `docs/PERFORMANCE.md` holds the
  numbers, the method and the tools. The core needed no optimisation: its worst ordinary case costs
  a fifth of one percent of a frame.
- `game.ts` gave up its 250 lines of types, phases and tuning constants to `src/core/match.ts`; it
  re-exports them, so no import anywhere had to change. It is now 1,392 lines and is only the turn
  state machine.

## [1.55.1] — 2026-09-21

### Fixed

- The gravity browser test measured a jump on whatever island the setup screen's random seed
  produced, so a ceiling above the buddy could make the Moon jump look no higher than a normal one;
  it failed on CI for exactly that reason. It now flattens the ground first and measures on known
  terrain.
- Dependabot no longer proposes TypeScript 7 (typescript-eslint requires `<6.1.0`) or `@types/node`
  26 (the runtime is Node 24); both majors are ignored with the reasoning written down.

## [1.55.0] — 2026-09-21

Public release. It carries everything from 1.53.1 and 1.54.0: the thematically grouped two-row
weapon bar with its new hotkeys, the minigun that finally looks like a gun, the Lemmings-style
self-destruct, the coverage gate that now actually runs, the community health files, share
metadata, reduced-motion support, refreshed documentation and re-captured screenshots.

## [1.54.0] — 2026-09-21

### Added

- **Self-destruct takes its Lemmings moment.** Pressing the detonator no longer blows the buddy up
  on the spot: it panics for three seconds with "Oh no!" and a ticking countdown over its head,
  shaking and swelling, and only then takes the hillside with it. Nothing stops it once started.
- `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig` and a Dependabot configuration.
- Share metadata (description, Open Graph, theme colour), so a posted link shows the game.

### Changed

- **The weapon bar is two rows, grouped by kind**: launcher and thrown family, guns, fists, sheep,
  what is called in from the sky, digging tools, getting about and building, traps and last
  resorts. Every hotkey moved with it — 1–9, 0, then Shift+1–0, with Teleport on T.
- **The minigun finally looks like a gun** instead of a screw; the shotgun took the blast icon and
  self-destruct the skull.
- The overlay's own animations hold still for `prefers-reduced-motion`.
- All README screenshots and the GIF were re-captured on this version.

### Fixed

- **The coverage gate never ran**: `verify` and CI used `npm test`, so the 98% thresholds enforced
  since 1.43.3 were checked by nothing, and branch coverage had slipped to 97.97%. All four gates
  now run the coverage, and the gaps are covered again.
- Browser tests retry once, so a network hiccup no longer fails an otherwise green run.
- The teleport row appeared twice in the README; the whole weapon table is now generated from the
  weapon order.
- `docs/ARCHITECTURE.md` was two releases out of date; the finished `todo.md` moved to the archive
  and `review.md` now holds the current review.

## [1.53.1] — 2026-09-21

### Added

- `scripts/history_chart.py` and the chart it draws at the bottom of the README: lines of code per
  area across every commit, and the four core coverage metrics sampled at every tenth commit, with
  the measurements cached so redrawing is cheap.

## [1.53.0] — 2026-09-21

Public release. Everything below has been in the changelog since 1.44.1; this is the summary that
ships with the release.

### Added

- **Teleport** (T, one per match): click a free spot and the buddy appears there, then falls, lands
  hard or drowns from there like anybody else.
- **Gravity setting** — Moon, Normal or Heavy — and **Crate craziness**, which drops two crates
  every single turn.
- **Map preview** in the setup screen: the island the current seed makes, in the scenery's colours.
- The Sudden Death flood is shown by the camera as it climbs, and a buddy it drowns during its own
  turn intro no longer holds the match up for its whole clock.
- Explosions throw tumbling lumps of earth out of the ground they bite into.
- `docs/SOUND.md` and `touchdisplay_support_ideation.md`.

### Changed

- **Every action has its own sound.** Thrown weapons no longer borrow the bazooka's launch roar,
  the blowtorch lights its gas, the platform knocks in wood, teleport warps, small blasts pop and
  Sudden Death has its own siren.
- Explosions are half as dense and see-through, so the buddies and the crater stay visible.
- Napalm burns for nine seconds and eats a charred dent into the ground.
- Dependencies updated to their latest stable releases.

### Fixed

- One-shot particle systems could pile up in the scene forever; they are now swept up.
- The turn timer's caption no longer runs through its ring at larger text sizes.

## [1.52.2] — 2026-09-21

### Changed

- Dependencies updated to their latest stable releases: Babylon.js 9.27.1, ESLint 10.11.0,
  Prettier 3.9.8, markdownlint-cli2 0.23.3 and `@types/node` 24.13.6. TypeScript stays on 6.0.3
  (typescript-eslint requires `<6.1.0`) and `@types/node` on the 24.x line to match the Node 24
  runtime.

## [1.52.1] — 2026-09-21

### Added

- `touchdisplay_support_ideation.md`: a design study for playing the whole game on a touchscreen —
  an optional, translucent control overlay that is off by default, what each of the three hard
  inputs (aim, charge, pick a spot) becomes, and what building it would cost. No code yet.

## [1.52.0] — 2026-09-21

### Changed

- **Sound audit.** Thrown weapons (grenade, cluster, holy grenade, banana bomb) no longer play the
  bazooka's launch roar but a throw of their own; the blowtorch lights its gas instead of roaring;
  the platform knocks in wood; teleport has its own warp instead of the crate shimmer; small
  explosions pop rather than sounding like a shotgun; and Sudden Death has a deeper siren of its
  own. The choices are documented in `docs/SOUND.md`.

## [1.51.0] — 2026-09-21

### Added

- **Teleport** (T, one per match, more from crates). Click any free spot and the buddy appears
  there — with no speed and no ground under it, so it falls, lands hard or drowns from there like
  anybody else. Spots inside rock or off the map are refused for free.

## [1.50.0] — 2026-09-21

### Changed

- Explosions are half as dense and see-through, so the buddies and the crater stay visible through
  the blast, and a blast that bites into rock now throws tumbling lumps of earth out of the ground.
  A blast in mid-air throws none.

## [1.49.0] — 2026-09-21

### Changed

- Napalm burns for about nine seconds instead of five, and now eats into the ground it burns on:
  each patch takes four small bites of rock and sinks into the hollow, leaving a charred dent about
  a unit and a half deep.

## [1.48.0] — 2026-09-21

### Added

- The Sudden Death flood is now shown: the turn intro is a little longer and the camera holds on
  the waterline as it climbs, with a floating "rising" label.

### Fixed

- A buddy drowned by the rising water during its own turn intro no longer holds the match up until
  its turn clock runs out; the turn is handed on at once.

## [1.47.2] — 2026-09-21

### Fixed

- The turn timer's caption no longer runs through the ring at Large and Huge text size: the ring
  holds only the number, the caption sits below it, and the digits have equal width so the clock
  stops jittering as it counts down.

## [1.47.1] — 2026-09-21

### Changed

- Closed the report of a short-ranged banana bomb: measured at four aim angles it matches or beats
  the grenade at every one of them, and a unit test now guards that. No balance change.

## [1.47.0] — 2026-09-21

### Added

- **Crate craziness** — a fourth crate setting that drops two fresh crates at the start of every
  turn instead of rolling for one, with room for eight on the map at a time.

## [1.46.0] — 2026-09-21

### Added

- **Gravity setting** — Moon, Normal or Heavy in the setup screen. Lighter gravity gives floaty
  jumps, longer throws and gentle landings; heavier gravity does the opposite. Normal is the
  default and is exactly the world the game had before. Everything that falls uses it, the AI
  included, and the HUD shows the pull whenever it is not the ordinary one.

## [1.45.0] — 2026-09-21

### Added

- **Map preview in the setup screen.** The island the current seed produces is drawn next to the
  seed field in the colours of the chosen scenery, so you can roll the dice until you like the map
  instead of finding out once the match has started. It uses the same terrain generation as the
  match, and follows both the seed and the scenery.

## [1.44.1] — 2026-09-21

### Fixed

- Explosion, napalm and trail particle systems could get stuck in the scene forever: their effect
  stopped reporting ready, so their particles never aged and Babylon never disposed of them. Every
  one-shot system is now swept up once its last particle should have died, and the napalm and
  blowtorch flames are emptied after they fade, so nothing hangs in the air over cold ground.

## [1.44.0] — 2026-09-21

Public release. Everything below has been in the changelog since 1.41.0; this is the summary that
ships with the release.

### Added

- **Platform** (Shift+0, two per team). A five-unit wooden board placed with the mouse: the preview
  follows the cursor and shows green where it fits and red where it does not, the wheel tilts it up
  to 60°, and a left click sets it down. Boards are solid for buddies, projectiles and the AI, and
  explosions cannot cut them.
- **Sudden Death floods the map.** From the turn after the strike the water climbs one world unit
  at the start of every turn, so caves and low ground go under and a stalled match is decided.

### Changed

- **Rope is a basic weapon**: three per team from turn one under every arsenal setting, including
  "Find in crates". Crates hand out the offensive special weapons instead.
- The rules core is covered to 99.8% of statements, 98.2% of branches, 100% of functions and 99.9%
  of lines, enforced at 98% in all four; browser tests now also cover jumping, hard landings and
  the drill's fall cushion.

## [1.43.3] — 2026-09-21

### Changed

- The rules core is now covered to 99.8% of statements, 98.2% of branches, 100% of functions and
  99.9% of lines, with the enforced Vitest thresholds raised from 90/85/90/90 to 98 in all four.
  New tests cover match draws, empty weapon crates, boundary handling for fire, flyers, mines,
  ropes and contours, and the AI's recovery from a lost plan.

## [1.43.2] — 2026-09-21

### Changed

- Browser tests now cover ordinary movement as well as weapons: a jump that lands safely, a long
  fall that costs health, and the drill digging through a hollow without fall damage.

## [1.43.1] — 2026-09-21

### Fixed

- The Sudden Death flood now rises once at the start of each turn instead of continuously, so
  letting the turn clock run out no longer floods the map faster than playing the turn. The strike
  turn itself stays dry; from the next turn on the water climbs a world unit each time.

## [1.43.0] — 2026-09-21

### Added

- **Platform** (Shift+0, two per team). A five-unit wooden board that is set with the mouse: the
  preview follows the cursor and shows green where it fits and red where it does not, the wheel
  tilts it up to 60°, and a left click puts it down and ends the turn. Boards are solid for buddies,
  projectiles and the AI alike, and explosions cannot cut them. Spots in rock, under water, off the
  map or on top of a buddy, a crate or a mine are refused without costing a use or the turn.

## [1.42.0] — 2026-09-21

### Added

- **Sudden Death floods the map.** From the Sudden Death turn the water rises by one world unit
  every eight seconds and never stops, so caves and low ground go under and a stalled match is
  decided. Everything that can drown — buddies, mines, crates, projectiles, sheep, tombstones and
  burning napalm — already reads the live water level, and the water surface follows it on screen.

## [1.41.0] — 2026-09-21

### Changed

- **Rope is a basic weapon.** Every team now starts with its three ropes under every arsenal
  setting, including "Find in crates", where the map previously offered no way to get around until
  a crate happened to hold one. Crates hand out the offensive special weapons instead. The hotkey
  (Shift+9), the ammo and the rope itself are unchanged.

## [1.40.1] — 2026-09-21

### Fixed

- Explosions now show an immediate, brighter 3D fireball. Burning napalm patches keep visible
  flickering flames even when a browser renders few particles, and the blowtorch projects a clear
  flame along its burn direction. Checked in Chrome and Firefox at desktop and compact resolutions.

## [1.40.0] — 2026-09-20

Public release. Everything below has been in the changelog since 1.33.5; this is the summary that
ships with the release.

### Added

- **Rope** (Shift+9, three per team). Space shoots a hook up to 24 units into rock; Up and Down reel
  the rope in and out, Left and Right build a swing, and Space lets go with every bit of momentum —
  press it again in mid-air to hook on somewhere else, free for the rest of that traversal. A hook
  that hits nothing costs nothing. The rope bends around corners and gives them up again, and lets
  go if the rock it bit into is blasted away. Roping is not the turn's shot: land, then fire.
- **Proximity Mine** (Shift+8, two per team). Dropped at the buddy's feet, it arms while you run and
  then stays on the map through every turn until a living buddy comes within two units — its own
  team and the one who laid it included. Rock in between shields a buddy, and a blast sets mines off
  in a chain.
- **Air-strike approach side.** Left and Right now choose which side the plane flies in from while a
  strike is being aimed. The buddy stays put and keeps its facing, and the HUD shows the choice.
- **Sheep collect crates.** A Sheep or Super Sheep that runs over a crate collects it for the buddy
  that launched it, without going off. Collection follows the path the sheep really travelled, so a
  Super Sheep at full speed cannot skip one.
- **Text size in the pause menu.** Normal, Large and Huge without leaving a running match.

### Changed

- **Smarter AI, by level.** Normal and Hard see that a crate caught in a blast explodes again, weigh
  a crate by what is in it and by how hurt the buddy is, only walk to crates they can reach, and
  press the enemy team holding the most health while finishing one down to its last buddy. Hard also
  sees when a blast would shove an enemy into the water or off the map. Easy plays exactly as before.

### Fixed

- **The Holy Garlic Grenade arms promptly on a slope.** A projectile blocked by terrain used to
  stand still while still carrying speed, so the countdown only started on the ten-second emergency
  fuse. Contacts now slide along the surface and friction lets a hillside hold them.
- The AI no longer plans contact-fused shots through a supply crate that would stop them.
- Menus and the HUD stay readable and reachable at every text size.
- The AI-vs-AI browser test no longer depends on how many frames slip between its own calls, which
  made it fail about one run in ten.

## [1.39.2] — 2026-09-20

### Fixed

- The rope no longer crashes the renderer the moment it wraps or unwraps a corner. A Babylon tube
  can only be updated in place while it keeps the same number of points, and the rope gains one
  every time it bends around rock, so it is now rebuilt when that count changes.
- A buddy that let go of the rope and hit the ground took no fall damage, because the ordinary buddy
  step is skipped during a traversal. Hanging on the rope still costs nothing; the fall after the
  release now hurts like any other.

## [1.39.1] — 2026-09-20

### Changed

- Tidied `tasks.md`: the AI review and implementation were numbered T63/T64, which collided with the
  existing T63, and are now T65/T66. Statements left over from when the backlog was still unbuilt
  now say what was actually done.

## [1.39.0] — 2026-09-20

### Added

- Rope (Shift+9, three per team): Space shoots a hook up to 24 units into rock, then Up and Down reel
  the rope in and out, Left and Right build a swing, and Space lets go with every bit of momentum —
  press it again in mid-air to hook on somewhere else, free for the rest of that traversal. A hook
  that hits nothing costs nothing. The rope bends around corners it has to pass and gives them up
  again on the way back, and it lets go if the rock it bit into is blasted away. Roping does not use
  up the turn's shot: land first, then fire. Firing while attached is deliberately not supported, and
  the AI does not use the rope yet.

### Changed

- Weapon slots are narrower again, so all nineteen still sit on one row at 1280 px.
- Pausing now clears held keys, so a rope no longer keeps reeling when the match resumes.

## [1.38.0] — 2026-09-20

### Added

- Proximity Mine (Shift+8, two per team): Space drops it at the buddy's feet, it arms while you run,
  and then it stays on the map through every turn until a living buddy comes within two units — its
  own team and the one who laid it included. Rock in between shields a buddy, a blast sets mines off
  in a chain, and a mine falls when the ground beneath it is blasted away. The AI lays them and
  keeps its own buddies away from them.

### Changed

- Weapon slots are slightly narrower, so all eighteen still sit on one row at 1280 px.

## [1.37.0] — 2026-09-20

### Changed

- The AI opponents now understand more of the board, gated by level. Normal and Hard see that a
  crate caught in a blast explodes again, so they shoot crates beside enemies and keep clear of ones
  beside team-mates; they also weigh a crate by what is in it and by how hurt the buddy is, and only
  walk to crates they can actually reach. Hard additionally sees when a blast would shove an enemy
  into the water or off the map. With three or four teams, Normal and Hard press the enemy team
  holding the most health and finish a team down to its last buddy. Easy plays exactly as before.

### Fixed

- The AI no longer plans contact-fused shots straight through a supply crate that would stop them.

## [1.36.0] — 2026-09-20

### Added

- Sheep and Super Sheep now collect crates they run over, crediting the health or ammo to the buddy
  that launched them. Collection follows the path the sheep really travelled, so a Super Sheep at
  full speed cannot skip a crate, and touching one never sets the sheep off. A launcher that is dead
  or already out of health collects nothing and the crate stays on the map.
- Crate rewards now also float above the spot where the crate was collected, so a sheep picking one
  up across the map is visible.

## [1.35.0] — 2026-09-20

### Added

- Left and Right now choose which side the plane flies in from while an air strike or napalm strike
  is being aimed. The buddy stays put and keeps its facing, the HUD shows an Approach card next to
  the wind gauge, and the side resets to the buddy's facing at the start of each turn. The
  plane-less concrete mule is unaffected, and the AI picks its own approach side deliberately.

## [1.34.2] — 2026-09-20

### Changed

- Documented a review of the AI opponents in `todo.md`: what the three levels already do, why they
  ignore crate contents, chained crate explosions and which enemy team is ahead, and a ranked
  backlog for improving them.

## [1.34.1] — 2026-09-20

### Fixed

- The Holy Garlic Grenade no longer takes ten seconds to start singing when it lands on a slope. A
  projectile blocked by terrain now slides along the surface instead of standing still while still
  carrying speed, and contact friction lets a hillside hold it. Bouncing weapons keep skittering.

## [1.34.0] — 2026-09-20

### Added

- The pause menu now includes the Normal, Large and Huge text-size options. Changes apply to the
  open menu and HUD immediately, persist across reloads and leave the paused match untouched.

### Fixed

- Changing text size during a Quick Match no longer risks replacing the saved custom-match setup.

## [1.33.5] — 2026-09-20

### Fixed

- Large and Huge text no longer clip title controls or push the bottom weapon bar off-screen on
  compact viewports; menu screens scroll and the scaled HUD switches layout before it overflows.
- Weapon hotkeys and ammo, weapon captions/descriptions and the turn-timer caption use readable
  base sizes. Browser coverage now checks all text sizes across menus and a live match.

## [1.33.4] — 2026-09-20

### Added

- Completed the planning handoff in `todo.md`: suggested implementation order, affected files,
  proposed behavior/tuning, rope solver constraints and remaining validation risks.
- Recorded the pause-menu persistence pitfall and available hotkey slots. All gameplay changes
  remain explicitly deferred until the user decides when to start implementation.

## [1.33.3] — 2026-09-20

### Added

- Further `todo.md` research confirms title-screen and weapon-bar clipping at larger text sizes,
  and reproduces delayed Holy Grenade arming through ordinary throw commands on sloped terrain.
- Documented the rope's conflict with the single timed-action state, sheep reward feedback and
  deferred-death considerations, and the separate effect of low rendering rates on timers.

## [1.33.2] — 2026-09-20

### Added

- `todo.md` records seven requested follow-ups with code findings and acceptance checks: text
  readability, in-game text-size controls, a Worms 2-style rope, air-attack direction, persistent
  proximity mines, sheep crate collection and Holy Garlic Grenade timing.
- Initial Holy Grenade diagnostics reproduce delayed arming on slopes; the backlog records the
  reproduction and suspected contact/rest detection cause. Gameplay changes remain pending.

## [1.33.0] — 2026-09-18

### Changed

- Sudden Death now drops every living buddy to 1 HP instead of halving their health, so from that
  turn on the lightest scratch decides the match. It still leaves 1 rather than 0, so the strike
  itself kills nobody.
- README and vision marked "almost feature complete": everything on the vision list is in and
  covered by tests, and what remains is polish, balance and optional extra weapons.

## [1.32.2] — 2026-09-17

### Fixed

- The AI aimed the blowtorch wherever its buddy happened to be aiming while planning a level tunnel
  to an enemy behind a wall, so since the torch became directional it dug up over its target. It
  now aims level for that plan.
- The map pointer was picked with a full ray cast on every mouse move, including on the title
  screen and behind open menus, although only the strike cursor uses it. It is picked only while a
  human is aiming a strike weapon.
- `main.ts` cast the canvas lookup instead of checking it, the one place in `src/` that broke the
  project's own no-non-null-assertion invariant.

## [1.32.1] — 2026-09-17

### Changed

- Cut the CPU and GPU cost of a frame by about 40 % without touching how the game looks. Profiling
  a real session showed the JavaScript main thread idle over 98 % of the time and the whole cost in
  per-pixel work, of which 4× multisampling of the scene target alone was more than a third — on
  top of the FXAA pass that already smooths the same edges. The redundant multisampling is gone.
- The render loop draws at most 60 frames per second (20 while a menu is open). The simulation has
  always run at a fixed 60 Hz, so on a 120 or 144 Hz display the extra frames were redrawing the
  same state at two to three times the cost.
- The drawing buffer is capped at four megapixels. Up to that size nothing changes; beyond it — a
  maximised window on a HiDPI screen — the render scale eases off instead of growing without limit.

## [1.32.0] — 2026-09-17

### Added

- Sudden Death: a setup option (Off / turn 10 / 20 / 30, default turn 10) that halves every living
  buddy's health when that turn begins — never below 1 HP, so it wounds rather than kills. A siren
  and a banner announce it, and the setting is persisted with the rest of the match setup.

## [1.31.0] — 2026-09-17

### Added

- Help and Pause buttons in the HUD, under the wind gauge. Help pauses the match and opens How to
  Play straight away; Pause opens the pause menu. Escape still does the same, and the turn timer
  and the whole simulation stay frozen while a menu is open.

### Changed

- The pause menu's "Controls" button is now labelled "❔ How to Play", matching the title screen.

## [1.30.0] — 2026-09-17

### Changed

- The blowtorch burns along the aim line instead of always horizontally. Aim up and it cuts its
  way up through a hillside, aim down and it digs in; the buddy rides the tunnel it cuts, with the
  flame pointing the same way.
- Where there is no rock left in front of the flame the buddy simply walks and gravity applies, so
  the torch still cannot carry anyone across a gap.
- A burnt victim is now shoved along the burn line, always with some lift, rather than straight
  ahead of the buddy's facing.

## [1.29.0] — 2026-09-17

### Changed

- The cluster bomb is a basic weapon: every team starts with three of them under every arsenal
  setting, instead of having to find them in crates. The basic loadout is now bazooka, grenade,
  shotgun, garlic punch, cluster bomb, baseball bat, blowtorch and drill, always available from
  turn one; crates hand out the remaining special weapons.

## [1.28.0] — 2026-09-17

### Changed

- Napalm now reads as fire. A bursting canister throws a rolling fireball with smoke and embers,
  in the spirit of the concrete mule's impact, and the ground keeps burning for about five seconds
  instead of under two.
- The flames themselves are tall, bright tongues with drifting smoke and a much stronger flicker
  light, so a burning patch is visible from across the map instead of a faint shimmer.

## [1.27.0] — 2026-09-17

### Fixed

- Contact-fused projectiles — bazooka rockets, bomblets, air-strike bombs and napalm canisters —
  now burst on supply crates as well as on rock and buddies, instead of passing straight through
  them.
- A napalm canister's burst is big enough to see and hear (blast radius 1 → 1.3), so an impact no
  longer looks like the bomb simply vanished.

## [1.26.18] — 2026-09-16

### Fixed

- The HUD shows a new match right away; for one frame it used to show the previous match's weapon
  ammo, which also made the infinite-supplies E2E test flaky (about one run in eight).

## [1.26.17] — 2026-09-16

### Fixed

- CI now really runs actionlint on the workflows; the job described in 1.26.0 had not been added.

## [1.26.16] — 2026-09-16

### Changed

- Release v1.26.16: plan marks the batch review and the publish step as done. This release brings
  the drill, napalm strike, tombstones, Candy Shop and Frosty Peaks sceneries, infinite supplies,
  text size and remembered settings, the about screen, continuous flying sheep steering, louder
  sound, crate camera pans, SPDX/REUSE compliance, the linter pipeline and the review fixes.

## [1.26.15] — 2026-09-16

### Changed

- README media regenerated: the napalm screenshot now shows the burning ground without the
  "Retreat!" banner.

## [1.26.14] — 2026-09-16

### Changed

- `review.md` records how every finding of the full-code review was resolved; ARCHITECTURE describes
  the `TurnAction` union and weapon looks.

## [1.26.13] — 2026-09-16

### Changed

- The weapon action in progress (hopping or flying sheep, blowtorch, drill, minigun burst) is one
  `TurnAction` in the game instead of five independent fields, stepped and cleared in one place,
  so two actions can never run at once (review #2).

## [1.26.12] — 2026-09-16

### Changed

- Weapon presentation is declared in the weapon table (`look`: projectile model, flight, fire, shot
  and hit sounds, muzzle flash, camera follow) instead of being switched on weapon ids in the app,
  world and effects; a unit test makes sure every projectile declares its model and sounds
  (review #3). The drill no longer plays a firing whoosh and muzzle flash when it starts.

## [1.26.11] — 2026-09-16

### Fixed

- E2E: the human-turn test continues on a fixed map after clicking Quick Match, so a random map
  can no longer end the turn early (for example a jump into the water).

## [1.26.10] — 2026-09-16

### Changed

- The GitHub Pages deployment runs the Chrome E2E suite before publishing, so a build with failing
  browser tests never goes live (review #7).

## [1.26.9] — 2026-09-16

### Fixed

- Media capture script: the napalm screenshot waits for the "Retreat!" banner to fade instead of
  setting a field the world does not have (review #9).

## [1.26.8] — 2026-09-16

### Fixed

- The AI aims its napalm strike upwind so the wind carries the napalm onto the enemy, and scores
  the strike where it will actually land (review #5).

### Added

- AI tests for drilling onto a buried enemy and for the wind-aware napalm strike (review #8).

## [1.26.7] — 2026-09-16

### Fixed

- Crates no longer teleport into a tombstone (review #6).

## [1.26.6] — 2026-09-16

### Fixed

- Playing a Quick Match no longer overwrites the custom setup saved for the next game (review #4).

## [1.26.5] — 2026-09-16

### Fixed

- Saved settings are validated field by field: an invalid AI level, controller, option value,
  scenery, team colour or buddy name from an old or edited entry falls back to its default instead
  of crashing the AI loop or the setup screen (review #1).

## [1.26.4] — 2026-09-16

### Changed

- `review.md`: new review of the full codebase against the v1.17.5 release, with nine verified
  findings.

## [1.26.3] — 2026-09-16

### Changed

- Documentation reviewed and brought up to date with the code: README (seventeen weapons, controls,
  architecture tree, test and lint commands), AGENTS (layout, commands, weapon checklist,
  invariants), VISION (rules, sceneries, setup, quality tooling), ARCHITECTURE (components, drilling
  phase, settle rules, AI flow, CI jobs, key decisions, testing map) and PLAN (historical sections
  marked).

## [1.26.2] — 2026-09-16

### Changed

- New README media: a banana bomb recording, bazooka flight and blast, flying sheep in the Candy
  Shop, an air strike over Frosty Peaks, burning napalm, a tombstone and the title screen.

### Added

- `scripts/capture-media.mjs` (`npm run capture-media`) scripts the scenes in Chrome and
  regenerates all README screenshots and the GIF.

## [1.26.1] — 2026-09-16

### Changed

- README badges: play in browser, CI, GitHub Pages deployment, release, license, REUSE compliance,
  and live versions of Babylon.js, TypeScript, Vite, Vitest and Playwright read from package.json,
  plus Node.js.

## [1.26.0] — 2026-09-16

### Added

- Linters in `npm run lint` (run by `npm run verify` and CI on every push): type-aware ESLint
  (typescript-eslint strict and stylistic type-checked rules), Prettier, Stylelint
  (stylelint-config-standard), markdownlint and the SPDX check. CI also runs actionlint on the
  workflows. `npm run format` applies the auto-fixes.

### Changed

- All findings fixed: code, tests, CSS and docs reformatted; non-null assertions in the game
  replaced by invariant helpers and typed audio voices; modern CSS colour notation; Markdown code
  fences, headings and URLs cleaned up.
- `@types/node` added so Playwright and Node types resolve; smol-toml (a markdownlint-cli2
  dependency) is overridden to 1.8.0 to fix a high-severity advisory.

## [1.25.1] — 2026-09-16

### Added

- SPDX / REUSE compliance: every source, style, script, workflow and HTML file carries
  `SPDX-FileCopyrightText` and `SPDX-License-Identifier` headers (GPL-3.0-or-later); `REUSE.toml`
  covers Markdown, JSON and images; the license text is in `LICENSES/`. The official REUSE tool
  reports the project compliant with REUSE 3.3.
- Scripts: `npm run lint:spdx` (part of `npm run lint`), `npm run spdx:fix` and
  `npm run lint:reuse`; CI runs the REUSE check on every push.

## [1.25.0] — 2026-09-16

### Added

- About screen on the title menu: author and contact, free to play on GitHub Pages, source link and
  license, and the tech stack with exact versions and open-source licenses (Babylon.js, simplex-noise,
  Fredoka font, TypeScript, Vite, Vitest, Playwright, ESLint).

## [1.24.0] — 2026-09-16

### Added

- Text size option (Normal / Large / Huge) in the match setup, scaling the HUD, name tags, banners
  and menus.
- The setup and text size are saved in the browser and restored for the next game, also after a
  reload (with a fresh map seed).
- *Reset all* button in the setup restores every default and clears the saved settings.

## [1.23.0] — 2026-09-16

### Added

- Candy Shop scenery: pink frosting on chocolate ground, strawberry-milk sea, pastel hills, lollipop
  trees, gumdrops, candy canes and sprinkles.
- Frosty Peaks scenery: snow over icy blue rock, snow-capped pines, snowballs and ice crystals.

## [1.22.0] — 2026-09-16

### Added

- Tombstones: a buddy that dies (death blast or self-destruct) leaves a comic tombstone with
  "R.I.P.", its name and a team-coloured ribbon. It pops up with a springy wobble and a sad little
  trombone, gets knocked around by explosions and sinks in water. Drowned buddies leave none.

## [1.21.0] — 2026-09-16

### Added

- Napalm Strike (Shift+7, special, 1 per team): click on the map and a plane drops four napalm
  canisters. They are not aimed against the wind and drift far with it. Each sets the ground
  around its impact aflame for 1–2 seconds; a buddy touching the flames takes 3 damage and hops
  away from them, handy for pushing enemies into the water. Flames sink with blasted ground and go
  out in water. Fire particles with flickering light, ignition whoomph, crackling fire and a yelp
  when scorched.

## [1.20.0] — 2026-09-16

### Added

- Drill (Shift+6, 2 per team): drills straight down for three seconds, the buddy sinking into its
  own shaft under gravity. No fall damage while drilling, even when breaking into a cave; buddies
  in the way take 15 damage and a shove. Grinding sound, dirt spray, drill model; the AI drills
  onto enemies buried right below.

### Changed

- The phases that count down the turn timer and the phases that end the turn when the active buddy
  is hurt are defined once in the game instead of being repeated across game, HUD and app.

## [1.19.0] — 2026-09-16

### Added

- Arsenal option *Infinite supplies*: every weapon has unlimited ammo for the whole match.

## [1.18.6] — 2026-09-16

### Changed

- Plan: SPDX compliance, the linter proposal and a new full-code review added with their order.

## [1.18.5] — 2026-09-16

### Added

- When a crate teleports in, the camera pans to it and the turn intro lasts 1.3 s longer, so every
  player notices the drop (with the louder teleport shimmer).

## [1.18.4] — 2026-09-16

### Changed

- Plan and task list: drill, napalm strike, font size with persisted settings and Reset all, and
  an About screen.

## [1.18.3] — 2026-09-16

### Changed

- Louder sound: master volume doubled (0.55 → 1.1) behind a compressor that keeps big explosions
  from clipping; footsteps, sheep hops, the timer tick, flight sounds and the crate teleport
  shimmer are noticeably louder.

## [1.18.2] — 2026-09-16

### Changed

- `docs/PLAN.md`: plan and execution order for the current batch of requests; `tasks.md` lists
  the new requests (docs review, screenshots, badges, crate camera, banana bomb range).

## [1.18.1] — 2026-09-16

### Changed

- README: prominent "Play in your browser" link to <https://marcelpetrick.github.io/AlliumAssault/>
  at the top and in the Play section.

## [1.18.0] — 2026-09-16

### Changed

- Flying Sheep steering: all four arrow keys steer it relative to the screen for the whole flight;
  it turns towards the pressed direction (diagonals too) and holds that course when released.
  It flies slower (9 units/s) with a 15 s fuse so there is time to steer around obstacles.
- The AI steers with the same arrow keys, cruising above the terrain before diving onto its
  target.
- Unit and E2E tests steer through several directions in one flight.

## [1.17.8] — 2026-09-16

### Changed

- `tasks.md`: tombstone task and the plan for the current batch; `docs/PLAN.md` points to it.

## [1.17.7] — 2026-09-16

### Changed

- `tasks.md`: new tasks for continuous flying sheep steering, louder sounds, an infinite-supplies
  arsenal and the Candy Shop and Frosty Peaks sceneries.

## [1.17.6] — 2026-09-16

### Fixed

- E2E: the human-turn test skips ahead exactly to the next human turn instead of a fixed 60
  seconds, which could leave too little turn time to charge the bazooka on slow CI machines.

## [1.17.5] — 2026-09-16

### Changed

- Docs: README architecture and testing sections, `docs/VISION.md` (all fifteen weapons, crates,
  controls), `docs/ARCHITECTURE.md` (new core modules, weapon phases, AI flow, E2E coverage, Pages
  deployment) and `AGENTS.md` (layout, controls, how to add a weapon) describe the current game.

## [1.17.4] — 2026-09-16

### Fixed

- AI thinking is faster with the full arsenal: limited-ammo grenades are searched on a coarser
  grid (69 ms → 48 ms per decision in the benchmark), and projectile, strike and melee candidates
  come from the weapon table, so new weapons of those kinds are used automatically.
- The AI no longer launches the flying sheep into rock right next to its own buddy.
- The last-seconds tick and urgent timer also run while guiding a sheep or torching.
- The camera keeps the player's zoom if they zoomed during a strike.
- Matches with a crates-only arsenal always drop crates, even without a crate setting.

## [1.17.3] — 2026-09-16

### Added

- `review.md`: code and architecture review of all changes since v1.1.11, with eight verified
  findings ranked by impact.

## [1.17.2] — 2026-09-16

### Added

- GitHub Pages deployment: every release tag (or a manual run) builds the game and publishes it
  at <https://marcelpetrick.github.io/AlliumAssault/>.

## [1.17.1] — 2026-09-16

### Changed

- `@babylonjs/core` 9.26.1 → 9.26.2. TypeScript stays at 6.0.3 because typescript-eslint 8.70.0
  does not support TypeScript 7 yet.

## [1.17.0] — 2026-09-16

### Added

- Arsenal option in the match setup: *All weapons* (default) or *Find in crates*, where special
  weapons (cluster bomb, sheep, air strike, self-destruct, minigun, holy garlic grenade, banana
  bomb, flying sheep, concrete mule) start empty and each weapon crate adds one more. Choosing it
  switches crates on if they were off.

### Changed

- Weapon crates can contain any special weapon.

## [1.16.0] — 2026-09-16

### Changed

- Compact weapon bar for all 15 weapons: icon slots with hotkey and ammo badges, a caption with the
  selected weapon's name, ammo and description, and a layout that wraps and stacks on narrow
  screens.
- Hotkeys: 1–9 and 0 select the first ten weapons, Shift+1–5 the other five; the help screen and
  HUD hint list them.
- E2E tests select every weapon with its real hotkey and check the bar fits the screen.

## [1.15.0] — 2026-09-16

### Added

- Concrete Mule (1 per team): click on the map and a giant concrete mule drops from the sky onto
  that spot. It explodes on every impact (35 damage) and keeps crashing down through its own
  craters, up to six times. Block-built mule model, hee-haw bray, falling whistle.
- The AI drops the mule onto enemies, counting its repeated impacts.
- Unit and E2E tests.

### Changed

- Strike weapons can fall straight from the sky without a plane; the strike hint names the weapon.

## [1.14.0] — 2026-09-16

### Added

- Flying Sheep (1 per team): takes off along the aim direction at constant speed; ← and → steer
  it, Space detonates it (75 damage), and it explodes on hitting rock or a buddy or after 10 s.
  Caped sheep model, bleat and whoosh, fuse countdown, camera follow.
- The AI flies it over obstacles and dives onto the nearest enemy.
- Unit and E2E tests.

### Changed

- Guided weapons share one detonation path; the crate and sheep AI tests restrict the arsenal.

## [1.13.0] — 2026-09-16

### Added

- Banana Bomb (1 per team): thrown with a 3 second fuse (40 damage), then bursts into five
  bananas that bounce around and explode one after another (30 damage each). Curved banana models.
- The AI throws banana bombs like the other cluster weapons.
- Unit and E2E tests.

### Changed

- Cluster fragments can stagger their fuses.

## [1.12.0] — 2026-09-16

### Added

- Holy Garlic Grenade (1 per team): a golden grenade with a cross that barely bounces and has no
  timer. Once it has come to rest it sings a Hallelujah chord and erupts 1.6 seconds later in an
  enormous blast (100 damage, radius 7). Choir sound, glowing model, fuse countdown.
- The AI throws it when the huge blast pays off.
- Unit and E2E tests; AI tests restrict the arsenal with a helper so new weapons do not change
  their outcome.

## [1.11.0] — 2026-09-16

### Added

- Minigun (1 per team): Space fires a burst of 14 bullets over 1.4 seconds along a slightly
  wobbling aim line. Each hit does 5 damage and kicks the victim up and away, so the shoves add up
  and carry it across the map. Spin-up and rapid gunfire sounds, muzzle flashes, three-barrel model.
- The AI uses the minigun on enemies in sight, especially when the shove knocks them into water.
- Unit and E2E tests.

### Changed

- Hitscan weapons declare their upward kick; the shotgun keeps its previous behaviour.

## [1.10.0] — 2026-09-16

### Added

- Blowtorch (key 9, 2 per team): Space lights it and the buddy walks forward for three seconds,
  burning a level tunnel through the rock ahead. It only walks with ground underneath, so it
  falls into gaps and never tunnels upwards. Enemies in the flame take 15 damage and a shove.
- Flame particles and light, roaring torch sound, torch model, HUD hint.
- The AI burns through walls towards enemies on the same level.
- Unit and E2E tests.

### Changed

- Self-Destruct moved to the tenth weapon slot.

## [1.9.0] — 2026-09-16

### Added

- Self-Destruct (key 9, 1 per team): the buddy blows itself up on the spot. Damage equals its
  health and the blast radius is health ÷ 10, so a healthy buddy levels a big part of the map.
  Siren sound and detonator model.
- The AI self-destructs only when the blast is worth more than the buddy it costs.
- Unit and E2E tests.

## [1.8.1] — 2026-09-16

### Changed

- `tasks.md`: plan and open tasks for the Holy Garlic Grenade, Banana Bomb, Flying Sheep,
  Concrete Mule, Minigun and a compact weapon bar.

## [1.8.0] — 2026-09-16

### Added

- Baseball Bat (key 8, 2 per team): 25 damage, less than the punch, but knocks the victim far
  along the aim line, always at least 20° upwards, to swat enemies over edges. Wooden crack
  sound, bat model, camera follows the flight.
- The AI simulates where punches and bat swings send their victim and goes for knock-outs into
  the water.
- Unit and E2E tests for the bat.

### Changed

- E2E melee tests aim at the enemy after it settles; the weapon bar test no longer assumes a
  fixed number of weapons.
- `tasks.md`: new open task for the arsenal setting.

## [1.7.0] — 2026-09-16

### Added

- Footstep patter while a buddy walks, a "hup" with a puff of air on jumps and a softer thud on
  lighter landings.
- E2E test for walking, jumping and landing sounds.

## [1.6.1] — 2026-09-16

### Added

- End-to-end tests in Google Chrome for every weapon (bazooka, grenade, shotgun, punch, cluster
  bomb, sheep, air strike) with real keyboard and mouse input, checking projectiles, craters,
  damage and the sounds each weapon makes.
- End-to-end tests for crates (teleport and pickup), audio cues (select, tick, turn chime, mute)
  and the weapon bar.
- The audio engine counts played sound effects; the test hook exposes them together with crates,
  ammo and a world-to-screen projection.

### Changed

- E2E helpers moved to `e2e/support.ts`, typed from the app's test hook.
- `tasks.md`: new open tasks for the blowtorch, baseball bat, walking and jumping sounds and
  self-destruct.

## [1.6.0] — 2026-09-16

### Added

- Random crates: from the second turn on, a crate may teleport onto free land at the start of a
  turn (at most four on the map, placement follows the map seed). Health crates heal the buddy who
  touches them by 25 HP; weapon crates add a cluster bomb, sheep or air strike to the team.
  Crates fall, and explode when caught in a blast.
- Crates option in the match setup (Off / Normal / Lots); quick matches use Normal.
- Crate models, teleport shimmer, pickup sparkles, floating "+25 HP" / "+1 Sheep" text and
  teleport, pickup and heal sounds.
- The AI walks to a nearby crate when it has no good shot.

## [1.5.0] — 2026-09-16

### Added

- Air Strike (key 7, 1 per team): click on the map and a plane flies over in the buddy's facing
  direction, dropping five bombs (25 damage each) spaced around that spot. Release points allow
  for fall time and wind.
- Target crosshair under the mouse, plane model with spinning propeller, propeller fly-by sound,
  whistling bombs, and a camera that pulls back to show the strike.
- The AI calls air strikes onto enemy positions.

### Changed

- A short press on the map counts as a click; dragging still pans the camera.

## [1.4.1] — 2026-09-16

### Changed

- `tasks.md` tracks every request with its status and version: open features, E2E coverage,
  GitHub Pages, review and release, plus answered questions.

## [1.4.0] — 2026-09-16

### Added

- Sheep (key 6, 1 per team): Space releases it and it hops forward in small 45° leaps, turning
  around at walls; Space again detonates it (75 damage). It blows up by itself after 10 seconds or
  when the turn time runs out, and drowns in water. Fuse countdown, baa and hop sounds.
- The camera follows the sheep; the AI replays its hops and detonates it at the best moment.
- E2E test for releasing and detonating the sheep.

## [1.3.2] — 2026-09-16

### Fixed

- E2E: the charge-sound check waits for the next frame instead of racing the key-up that fires.

## [1.3.1] — 2026-09-16

### Added

- `AGENTS.md`: project layout, commands, working rules and versioning for contributors and coding
  agents.

### Changed

- Versioning: every commit still bumps the version and CHANGELOG, but only releases are tagged.

## [1.3.0] — 2026-09-16

### Added

- Cluster Bomb (key 5, 3 per team): a red grenade with a 3 second fuse that bursts into five
  bomblets; each bomblet explodes on contact for 10 damage.
- Weapon hotkeys now go up to 9; the weapon bar, hints and controls list follow the weapon table.
- The AI throws cluster bombs when the extra bomblet damage is worth the limited ammo.

## [1.2.0] — 2026-09-16

### Added

- Charge whoosh while Space is held: rises in pitch and loudness with the charge and stops on
  firing, pausing or losing focus.
- Flight sounds: bazooka rockets hiss and whistle (dropping in pitch as they fall), grenades whoosh.
- Weapon-select blip and a ticking clock during the last five seconds of a turn.

### Changed

- Grenade bounces are a clearly audible clunk scaled by the impact speed.

## [1.1.14] — 2026-09-16

### Changed

- Garlic Punch hits harder: 45 damage (was 30) and a stronger launch.

## [1.1.13] — 2026-09-16

### Fixed

- Buddies no longer float in mid-air when a crater removes the ground below them without the
  blast reaching them; they now fall.

## [1.1.12] — 2026-09-16

### Added

- `tasks.md`: task list for the floating-buddy fix, punch balance, sound, cluster grenade, sheep,
  air strike, crates, GitHub Pages deployment and docs.

## [1.1.11] — 2026-09-15

### Added

- `docs/ARCHITECTURE.md`: C4 architecture documentation (context, containers, components) with
  Mermaid diagrams for the frame loop, turn state machine, explosions, AI turns and delivery.

## [1.1.10] — 2026-09-15

### Fixed

- Explosions update ground props with one GPU buffer upload per prop type and skip props that are
  already hidden.

## [1.1.9] — 2026-09-15

### Fixed

- Each team starts its turn with the weapon it last selected instead of the previous team's choice.

## [1.1.8] — 2026-09-15

### Fixed

- AI finishes a shotgun turn by aiming its second shot at an enemy instead of re-planning for a
  weapon it cannot switch to and wasting the shot.

## [1.1.7] — 2026-09-15

### Fixed

- Pausing or switching away from the window while charging cancels the shot instead of firing it.

## [1.1.6] — 2026-09-15

### Fixed

- The second shotgun shot can be fired when the first shot used the team's last ammo; the turn no
  longer stalls until the timer runs out.

## [1.1.5] — 2026-09-15

### Fixed

- Removed stale references to the deleted archive tags and old branch from README and docs.

### Added

- Versioning section in the README: every commit carries its own SemVer version and tag.

## [1.1.4] — 2026-09-15

### Changed

- vitest 5.0.0 → 5.0.1. TypeScript stays on 6.0.3 until typescript-eslint supports 7.x.

## [1.1.3] — 2026-09-15

### Added

- Animated battle GIF, action screenshots and CI, release and license badges at the top of the README.

## [1.1.2] — 2026-09-15

### Fixed

- Camera now holds on explosions instead of snapping back to the retreating buddy.

## [1.1.1] — 2026-09-15

### Added

- GitHub Actions: CI (lint, typecheck, unit tests, build, Chrome E2E) and tag-triggered releases
  publishing the zipped web build with a checksum.

## [1.1.0] — 2026-09-15

### Added

- Fixed-step frame capture mode (`window.__allium.stepFrames`) for deterministic recordings.

## [1.0.1] — 2026-09-15

### Added

- ESLint with typescript-eslint; `npm run lint` is part of `npm run verify`.

## [1.0.0] — 2026-09-14

### Added

- Playwright E2E suite on Google Chrome: title demo, a full human turn (jump, aim, shotgun crater,
  bazooka, retreat), AI-vs-AI match to the victory screen and rematch, custom setup, pause menu.
- README with screenshots, controls, weapons, architecture and testing guide.

### Changed

- Brighter Moonlit Grove lighting; HUD shows "Match over" after victory.

## [0.5.0] — 2026-09-14

### Added

- Playable game: title screen with live demo battle, custom match setup, HUD, pause, help and victory screens.
- Keyboard and mouse controls, camera pan and zoom.
- Synthesized Web Audio sound effects with mute toggle.

## [0.4.0] — 2026-09-14

### Added

- Babylon.js 3D rendering: extruded, bevelled terrain chunks with procedural texturing and scorch marks.
- Garlic buddy models with facial animation, team bandanas, squash & stretch and held weapons.
- Sky shader, animated water, hill ranges with forests, clouds, ground props.
- Explosion, smoke, debris, splash and tracer effects; cascaded shadows, bloom and tone mapping.
- Themes: Garlic Meadow, Golden Sunset, Moonlit Grove.

## [0.3.0] — 2026-09-14

### Added

- Headless game core: seeded density-field terrain with craters, marching squares contouring,
  circle-vs-field character physics, swept projectiles, wind.
- Match state machine with turns, retreat, settling, fall damage, drowning, death explosions, victory.
- Weapons: bazooka, grenade, shotgun, garlic punch. Trajectory-search AI (easy/normal/hard).
- 25 Vitest unit tests including a full AI-vs-AI match.

## [0.2.0] — 2026-09-14

### Changed

- Restarted the project as a 3D rewrite on Babylon.js; the Phaser 2D prototypes are removed.

### Added

- `docs/VISION.md` (v2 vision), `docs/PLAN.md` (history mapping and milestones).
- Vite + TypeScript + Babylon.js scaffold, Vitest, Playwright (Google Chrome) smoke test.
