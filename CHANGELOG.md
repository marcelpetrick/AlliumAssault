# Changelog

All notable changes to this project are documented here. Versions follow SemVer.

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
- Restarted the project as a 3D rewrite on Babylon.js; the Phaser 2D prototypes are removed
  (preserved as tags `archive/phaser-mvp` and `archive/secondTry_landscape`).

### Added
- `docs/VISION.md` (v2 vision), `docs/PLAN.md` (history mapping and milestones).
- Vite + TypeScript + Babylon.js scaffold, Vitest, Playwright (Google Chrome) smoke test.
