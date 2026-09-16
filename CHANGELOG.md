# Changelog

All notable changes to this project are documented here. Versions follow SemVer.

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
