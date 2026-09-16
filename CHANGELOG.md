# Changelog

All notable changes to this project are documented here. Versions follow SemVer.

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
