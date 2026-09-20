# 🧄 Allium Assault

[![Play in browser](https://img.shields.io/badge/play-in%20your%20browser-ff6f91?logo=googlechrome&logoColor=white)](https://marcelpetrick.github.io/AlliumAssault/)
[![CI](https://github.com/marcelpetrick/AlliumAssault/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/marcelpetrick/AlliumAssault/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/marcelpetrick/AlliumAssault/pages.yml?label=GitHub%20Pages&logo=github)](https://github.com/marcelpetrick/AlliumAssault/actions/workflows/pages.yml)
[![Release](https://img.shields.io/github/v/release/marcelpetrick/AlliumAssault)](https://github.com/marcelpetrick/AlliumAssault/releases/latest)
[![License: GPL v3 or later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![REUSE 3.3 compliant](https://img.shields.io/badge/REUSE-3.3%20compliant-green.svg)](https://reuse.software/)
[![Babylon.js](https://img.shields.io/github/package-json/dependency-version/marcelpetrick/AlliumAssault/@babylonjs/core?label=Babylon.js&color=bb464b)](https://www.babylonjs.com/)
[![TypeScript](https://img.shields.io/github/package-json/dependency-version/marcelpetrick/AlliumAssault/dev/typescript?label=TypeScript&logo=typescript&logoColor=white&color=3178c6)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/github/package-json/dependency-version/marcelpetrick/AlliumAssault/dev/vite?label=Vite&logo=vite&logoColor=white&color=646cff)](https://vite.dev/)
[![Vitest](https://img.shields.io/github/package-json/dependency-version/marcelpetrick/AlliumAssault/dev/vitest?label=Vitest&logo=vitest&logoColor=white&color=6e9f18)](https://vitest.dev/)
[![Playwright](https://img.shields.io/github/package-json/dependency-version/marcelpetrick/AlliumAssault/dev/@playwright/test?label=Playwright&logo=playwright&color=2ead33)](https://playwright.dev/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-5fa04e.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

## ▶ [Play Allium Assault in your browser](https://marcelpetrick.github.io/AlliumAssault/)

No install, no account: open **<https://marcelpetrick.github.io/AlliumAssault/>** in a desktop
browser and start a Quick Match.

<p align="center">
  <img src="docs/screenshots/battle.gif" alt="A banana bomb bursting into bouncing bananas that blast craters into the meadow" width="100%">
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/action-1.jpg" alt="Bazooka rocket streaking towards the enemy team"></td>
    <td width="50%"><img src="docs/screenshots/action-2.jpg" alt="Explosion carving a crater next to a garlic buddy, with floating damage"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/candy-shop.jpg" alt="Flying sheep over the Candy Shop scenery with lollipop trees"></td>
    <td width="50%"><img src="docs/screenshots/frosty-peaks.jpg" alt="Air strike plane dropping bombs over the snowy Frosty Peaks"></td>
  </tr>
</table>

A turn-based 3D artillery game in the spirit of **Worms Armageddon**, starring teams of cute
garlic buddies. Destructible islands, wind, nineteen weapons from bazookas and banana bombs to
a steerable flying sheep, a concrete mule and a napalm strike, random crates, comic tombstones,
Sudden Death and five sceneries — rendered with real-time 3D graphics in your browser.

**Status: almost feature complete.** Everything on the vision list is in and playable; what is
left is polish, balance and the odd extra weapon.

**Download:** grab the ready-to-host web build from the [latest release](https://github.com/marcelpetrick/AlliumAssault/releases/latest),
unzip it and serve the folder with any static web server (e.g. `npx serve`).

**Author:** Marcel Petrick <mail@marcelpetrick.it> · **License:** GPL-3.0-or-later · Built with AI assistance.

## Play

Online: **<https://marcelpetrick.github.io/AlliumAssault/>** (updated with every release).

Locally:

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build (static files, no backend): `npm run build`, then serve `dist/` with any static
file server, e.g. `npm run preview`.

Append `?quality=low` to the URL on weak GPUs (disables shadows, bloom and MSAA).

## Features

- **Smooth 3D world** — Babylon.js 9: rounded terrain slabs, cascaded soft shadows, bloom, ACES
  tone mapping, animated water, parallax hills with forests, drifting clouds, particle explosions.
- **Destructible terrain** — every explosion carves a round, scorched crater; props on the ground
  get blown away.
- **Worms-style rules** — 2–4 teams of 1–4 buddies, rotating turns, turn timer, 5 s retreat,
  wind, knockback, fall damage, drowning, death explosions, last team standing wins.
- **Rope** — shoot a hook into rock, then hang, reel up and down, swing, let go with your momentum
  and hook on again in mid-air. It bends around corners it has to pass and lets go if the rock it
  bit into is blasted away. Roping does not use up the turn's shot: land, then fire.
- **Proximity mines** — laid at the buddy's feet, they arm while you run and then stay on the map
  through every turn until somebody walks into them. Rock between a mine and a buddy shields it, and
  a blast sets mines off in a chain.
- **Random crates** — from the second turn on, crates teleport onto free land: health crates heal
  25 HP, weapon crates add one more of a special weapon. Off / Normal / Lots in the setup. A hopping
  sheep or a Super Sheep that runs over a crate collects it for the buddy that launched it, without
  going off.
- **Arsenal setting** — start with every weapon, find the special weapons (sheep, air strike,
  self-destruct, minigun, holy grenade, banana bomb, flying sheep, concrete mule, napalm strike)
  in crates only, or play with infinite supplies of everything. The basic weapons — bazooka,
  grenade, shotgun, garlic punch, cluster bomb, baseball bat, blowtorch and drill — are always in
  the loadout from turn one.
- **Sudden Death** — from the setup screen, pick the turn (10, 20 or 30, or off) on which every
  living buddy drops to 1 HP. Nobody dies from the strike itself, but from then on the next hit of
  any kind decides it, so long matches end with a bang instead of a stalemate.
- **Tombstones** — fallen buddies leave a comic R.I.P. tombstone with their name that explosions
  knock around.
- **Hot-seat and AI** — mix human and AI teams freely; AI (easy / normal / hard) simulates real
  trajectories to find its shots.
- **Five sceneries** — Garlic Meadow, Golden Sunset, Moonlit Grove, Candy Shop (lollipop trees,
  gumdrops, strawberry-milk sea) and Frosty Peaks (snowy pines, ice); seeded maps you can share.
- **Comfortable setup** — text size Normal / Large / Huge, and the last match settings are
  remembered in the browser for the next game (Reset all restores the defaults).
- **Synthesized sound** — every effect generated with Web Audio, no asset files: charge whoosh,
  whistling rockets, bleating sheep, a propeller plane, crackling napalm, footsteps and more.
- **About screen** — author, tech stack with versions and open-source licenses.

## Controls

| Key                       | Action                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| ← →                       | Walk                                                                                              |
| Enter                     | Jump forward                                                                                      |
| Backspace                 | Back-flip (high jump)                                                                             |
| ↑ ↓                       | Aim                                                                                               |
| Space                     | Hold to charge, release to fire (punch and shotgun fire instantly); sheep: release, then detonate |
| 1–9, 0, Shift+1–9 / Tab   | Choose weapon (or click it in the weapon bar)                                                     |
| Mouse wheel / drag        | Zoom / pan camera                                                                                 |
| Click                     | Call the air strike or napalm strike, or drop the concrete mule, onto that spot                   |
| ← → (air/napalm strike)   | Choose the side the plane flies in from; the buddy stays put while choosing                       |
| ↑ ↓ ← → (on the rope)     | Reel in and out, swing left and right                                                             |
| Arrow keys (flying sheep) | Steer the flying sheep towards that direction                                                     |
| M / Esc                   | Mute / pause menu (Esc also closes help and about); the HUD's Help and Pause buttons do the same  |

## Weapons

| Weapon                 | Ammo | Behaviour                                                                                                                                   |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚀 Bazooka             | ∞    | Charged shot, strong wind drift, explodes on contact (50 dmg)                                                                               |
| 💣 Grenade             | ∞    | Charged throw, bounces, 3 s fuse, little wind drift (50 dmg)                                                                                |
| 🔫 Shotgun             | 2    | Two instant shots along the aim line (22 dmg each)                                                                                          |
| 👊 Garlic Punch        | ∞    | Close-range uppercut that launches the victim (45 dmg)                                                                                      |
| 🧨 Cluster Bomb        | 3    | Red grenade, 3 s fuse (25 dmg), bursts into five bomblets of 10 dmg each                                                                    |
| 🐑 Sheep               | 1    | Space releases it, it hops forward in small 45° leaps; Space again detonates it (75 dmg), at the latest after 10 s                          |
| ✈️ Air Strike          | 1    | Click on the map: a plane drops five bombs around that spot (25 dmg each)                                                                   |
| 🏏 Baseball Bat        | 2    | Home run: 25 dmg, knocks the victim far along the aim line (at least 20° upwards)                                                           |
| 🔥 Blowtorch           | 2    | Burns a tunnel along the aim line for 3 s and rides it — aim up to climb, down to dig in; falls where the rock ends (15 dmg)                |
| 💥 Self-Destruct       | 1    | The buddy blows itself up: damage equals its health, blast radius health ÷ 10                                                               |
| 🔩 Minigun             | 1    | Burst of 14 bullets (5 dmg each) whose kicks shove the victim far across the map                                                            |
| ✨ Holy Garlic Grenade | 1    | Rolls to a stop, sings Hallelujah, then erupts 1.6 s later (100 dmg, radius 7)                                                              |
| 🍌 Banana Bomb         | 1    | 3 s fuse (40 dmg), then five bouncing bananas explode one after another (30 dmg each)                                                       |
| 🦸 Flying Sheep        | 1    | Takes off along the aim; the arrow keys steer it the whole flight, Space detonates (75 dmg); explodes on impact or after 15 s               |
| 🫏 Concrete Mule       | 1    | Click on the map: it drops from the sky and explodes on up to six impacts as it smashes downwards (35 dmg each)                             |
| ⛏️ Drill               | 2    | Drills straight down for 3 s; no fall damage while drilling (15 dmg to buddies in the way)                                                  |
| 🌋 Napalm Strike       | 1    | Click on the map: a plane drops napalm that the wind carries far; burning ground (about 5 s) makes buddies hop for 3 dmg, water puts it out |
| 🛞 Proximity Mine      | 2    | Space drops it at your feet; it arms after 1.5 s and blows up the first buddy within 2 units — friend, foe or the one who laid it (40 dmg)  |
| 🪝 Rope                | 3    | Space shoots a hook up to 24 units into rock; hang, ↑↓ reel, ←→ swing, Space lets go with your momentum. Land first, then fire a weapon     |

## Architecture

```text
src/
├── core/     Pure TypeScript game rules — no Babylon, no DOM, fully unit-tested
│   ├── terrain.ts   density field, seeded generation, craters, spawn finding
│   ├── contour.ts   marching squares (fill triangles + oriented edges)
│   ├── physics.ts   circle bodies vs. field, swept projectiles
│   ├── weapons.ts   weapon table (19 weapons by kind), arsenal flags, hotkey mapping
│   ├── game.ts      match state machine, turns, weapon execution, damage, crates, mines, flames, tombstones
│   ├── sheep.ts     hopping sheep · flyer.ts steerable flying sheep
│   ├── strike.ts    air strike, napalm and concrete mule drop planning
│   ├── fire.ts      napalm flames on the ground · crates.ts seeded crate contents and spots
│   ├── mines.ts     proximity mines: arming delay, line of sight, trigger fuse
│   ├── rope.ts      rope: swept hook, length constraint, corner wrapping, swing
│   └── ai.ts        trajectory-search AI driving the same commands as players
├── render/   Babylon.js presentation: terrain mesh, buddies, sceneries, effects, camera
├── ui/       HTML/CSS overlay: title, setup, HUD, help, about, pause, victory; persisted settings
├── audio.ts  Web Audio synthesizer
└── app.ts    engine, fixed 60 Hz loop, input, wiring
scripts/      SPDX check and fixer, README media capture
```

Terrain is a scalar field sampled every 0.25 units: positive values are rock and approximate the
distance to the surface. Physics queries the field directly (smooth normals, no tunnelling),
explosions subtract discs from it, and the renderer rebuilds only dirty 8×8-unit chunks by
extruding the marching-squares contour into a bevelled 3D slab.

Design documents: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (C4 model with Mermaid diagrams),
[`docs/VISION.md`](docs/VISION.md), [`docs/PLAN.md`](docs/PLAN.md); the original
research session is archived in [`docs/archive/`](docs/archive/).

## Testing

```bash
npm run lint         # type-aware ESLint, Prettier, Stylelint, markdownlint, SPDX headers
npm run typecheck    # TypeScript strict
npm test             # Vitest: terrain, physics, every weapon's rules, crates, settings, AI (incl. a full AI match)
npm run e2e          # Playwright in Google Chrome: menus, settings, every weapon, crates, tombstones, sceneries, sounds
npm run coverage     # Vitest with v8 coverage of the game rules in src/core; HTML report in coverage/
npm run verify       # all of the above plus production build
```

The page exposes `window.__allium` (`state()`, `startMatch()`, `fastForward()`, `stepFrames()`,
`project()`) for automated tests.

Continuous integration runs all linters, typecheck, unit tests, build and the Chrome E2E suite on
every push, plus a REUSE compliance check and actionlint on the workflows.

```bash
npm run lint:spdx    # every file has SPDX headers or a REUSE.toml annotation
npm run spdx:fix     # add the SPDX header to new files
npm run lint:reuse   # official REUSE tool (needs uv)
```

Pushing a `v*` tag builds and publishes a GitHub release with the zipped static site and
deploys the game to GitHub Pages: <https://marcelpetrick.github.io/AlliumAssault/>.

## Versioning

The project follows [Semantic Versioning](https://semver.org/). Every commit on `master` carries
its own version: bump `package.json` (patch for fixes, docs and dependency updates; minor for
features; major for breaking changes) and add a matching entry to [`CHANGELOG.md`](CHANGELOG.md).
Commits are not tagged individually: a `vX.Y.Z` tag is created only for a release, and pushing it
publishes a GitHub release with the web build. Contributor and agent rules are in
[`AGENTS.md`](AGENTS.md).

## More screenshots

| Title screen                                                   | Napalm strike                                                                 | Tombstone                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Title screen with the live demo](docs/screenshots/title.jpg) | ![Napalm burning on a floating island at sunset](docs/screenshots/napalm.jpg) | ![R.I.P. tombstone in the Moonlit Grove](docs/screenshots/tombstone.jpg) |

Regenerate all media with `npm run capture-media -- <preview url>` against a running preview build (needs ffmpeg).

## History

Version 1 replaced two earlier 2D prototypes with this 3D rewrite. See [`CHANGELOG.md`](CHANGELOG.md)
for the release history.

Game mechanics are inspired by Team17's Worms series; all design, art, sound and code are original.
