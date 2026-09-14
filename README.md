# 🧄 Allium Assault

A turn-based 3D artillery game in the spirit of **Worms Armageddon**, starring teams of cute
garlic buddies. Destructible islands, wind, bazookas, grenades, shotguns and a mighty garlic
punch — rendered with real-time 3D graphics in your browser.

![Gameplay](docs/screenshots/gameplay.jpg)

**Author:** Marcel Petrick <mail@marcelpetrick.it> · **License:** GPL-3.0-or-later · Built with AI assistance.

## Play

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
- **Hot-seat and AI** — mix human and AI teams freely; AI (easy / normal / hard) simulates real
  trajectories to find its shots.
- **Three sceneries** — Garlic Meadow, Golden Sunset, Moonlit Grove; seeded maps you can share.
- **Synthesized sound** — all effects generated with Web Audio, no asset files.

## Controls

| Key | Action |
|---|---|
| ← → | Walk |
| Enter | Jump forward |
| Backspace | Back-flip (high jump) |
| ↑ ↓ | Aim |
| Space | Hold to charge, release to fire (punch and shotgun fire instantly) |
| 1–4 / Tab | Choose weapon |
| Mouse wheel / drag | Zoom / pan camera |
| M / Esc | Mute / pause menu |

## Weapons

| Weapon | Ammo | Behaviour |
|---|---|---|
| 🚀 Bazooka | ∞ | Charged shot, strong wind drift, explodes on contact (50 dmg) |
| 💣 Grenade | ∞ | Charged throw, bounces, 3 s fuse, little wind drift (50 dmg) |
| 🔫 Shotgun | 2 | Two instant shots along the aim line (22 dmg each) |
| 👊 Garlic Punch | ∞ | Close-range uppercut that launches the victim (30 dmg) |

## Architecture

```
src/
├── core/     Pure TypeScript game rules — no Babylon, no DOM, fully unit-tested
│   ├── terrain.ts   density field, seeded generation, craters, spawn finding
│   ├── contour.ts   marching squares (fill triangles + oriented edges)
│   ├── physics.ts   circle bodies vs. field, swept projectiles
│   ├── game.ts      match state machine, turns, weapons, damage
│   └── ai.ts        trajectory-search AI driving the same commands as players
├── render/   Babylon.js presentation: terrain mesh, buddies, environment, effects, camera
├── ui/       HTML/CSS overlay: title, match setup, HUD, pause, victory
├── audio.ts  Web Audio synthesizer
└── app.ts    engine, fixed 60 Hz loop, input, wiring
```

Terrain is a scalar field sampled every 0.25 units: positive values are rock and approximate the
distance to the surface. Physics queries the field directly (smooth normals, no tunnelling),
explosions subtract discs from it, and the renderer rebuilds only dirty 8×8-unit chunks by
extruding the marching-squares contour into a bevelled 3D slab.

Design documents: [`docs/VISION.md`](docs/VISION.md), [`docs/PLAN.md`](docs/PLAN.md); the original
research session is archived in [`docs/archive/`](docs/archive/).

## Testing

```bash
npm run typecheck    # TypeScript strict
npm test             # Vitest: terrain, contour, physics, match rules, AI (incl. full AI match)
npm run e2e          # Playwright in Google Chrome: menus, a human turn, AI match to victory
npm run verify       # all of the above plus production build
```

The page exposes `window.__allium` (`state()`, `startMatch()`, `fastForward()`) for automated tests.

## History

Earlier 2D Phaser prototypes were discarded in favour of this 3D rewrite; they remain available as
git tags `archive/phaser-mvp` and `archive/secondTry_landscape`. See [`CHANGELOG.md`](CHANGELOG.md).

Game mechanics are inspired by Team17's Worms series; all design, art, sound and code are original.
