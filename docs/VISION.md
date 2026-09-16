# Allium Assault — Vision (v2, 3D)

A turn-based artillery game in the spirit of **Worms Armageddon**, running entirely in the
browser, starring teams of cute **garlic buddies**. Version 2 replaces the abandoned 2D pixel
prototypes with smooth, real-time **3D graphics** while keeping the classic 2D gameplay plane.

## Pillars

1. **Looks good immediately.** Real 3D meshes, dynamic lighting, soft shadows, bloom,
   tone mapping, animated water, parallax scenery. No pixel art, no voxels.
2. **Plays like Worms.** Teams take timed turns; one buddy acts per turn; move, aim, fire,
   retreat, and wait for the world to settle. Wind, knockback, fall damage, drowning,
   destructible terrain, and death explosions all matter.
3. **Browser only.** Static files, no backend, no account. Open the page and play.
4. **Testable.** The game rules live in a headless, deterministic TypeScript core with unit
   tests; the browser build is verified end-to-end in Chrome via Playwright.

## Game rules (MVP)

| Topic | Rule |
|---|---|
| Modes | Local hot-seat and human-vs-AI, freely mixed |
| Teams | 2–4 teams, 1–4 buddies each |
| Turn | 45 s (configurable), rotating team order, rotating buddy within a team |
| Retreat | 5 s after an attack; movement only |
| Settling | Turn ends only after all bodies and projectiles came to rest |
| Health | 100 HP; ≤ 0 HP → death explosion at end of turn |
| Hazards | Water at the bottom = instant death; fall damage above a speed threshold |
| Wind | New random wind each turn, shown in HUD; affects projectiles per weapon |
| Victory | Last team with living buddies wins; draw if none survive |

## Weapons

Fifteen weapons. *Special* weapons can be restricted to crates with the arsenal setting.

| Weapon | Ammo | Behaviour |
|---|---|---|
| Bazooka | ∞ | Charged shot, ballistic, strong wind influence, explodes on contact |
| Grenade | ∞ | Charged throw, bounces, 3 s fuse, light wind influence |
| Shotgun | 2 | Two instant shots per turn along the aim line, small craters |
| Garlic Punch | ∞ | Melee uppercut: 45 damage + launch, no charge |
| Cluster Bomb (special) | 3 | Red grenade; bursts into five bomblets of 10 damage |
| Sheep (special) | 1 | Hops forward on its own; Space detonates |
| Air Strike (special) | 1 | Click a target: a plane drops five bombs |
| Baseball Bat | 2 | Melee: 25 damage, knocks the victim far |
| Blowtorch | 2 | Walks forward 3 s burning a level tunnel; obeys gravity |
| Self-Destruct (special) | 1 | Buddy explodes: damage = health, radius = health ÷ 10 |
| Minigun (special) | 1 | 14-bullet burst that shoves the victim far |
| Holy Garlic Grenade (special) | 1 | Explodes 1.6 s after coming to rest, huge blast |
| Banana Bomb (special) | 1 | Bursts into five bouncing bananas that explode in turn |
| Flying Sheep (special) | 1 | Steerable with ← →, Space detonates |
| Concrete Mule (special) | 1 | Click a target: falls from the sky and smashes down six times |

## Crates

From the second turn on a crate may teleport onto free land at a turn start (Off / Normal / Lots,
at most four on the map). Health crates heal the collecting buddy by 25 HP; weapon crates add one
more of a special weapon to its team. Crates explode when caught in a blast.

## Controls

Following the last control decision made in the 2D prototype:

| Key | Action |
|---|---|
| ← / → | Walk |
| Enter | Jump forward |
| Backspace | Back-flip (high jump) |
| ↑ / ↓ | Aim |
| Space (hold/release) | Charge and fire; instant weapons fire on press; Space again detonates sheep |
| 1–9, 0, Shift+1–5 / Tab | Select weapon (or click the weapon bar) |
| Click on the map | Call the air strike or concrete mule |
| ← / → while a flying sheep flies | Steer it |
| Mouse wheel / drag | Zoom / pan camera |
| Esc | Pause menu |

## Look & feel

- **Terrain:** a smooth signed-density field meshed with marching squares, extruded into
  pillowy 3D slabs with grass tops, rock strata, scorch marks around craters.
- **Garlic buddies:** lathe-modelled bulbs with sprouts, big eyes, team-coloured bandanas,
  squash-and-stretch and bobbing animations, held weapon models.
- **World:** gradient sky, sun with shadows, layered distant hills and low-poly trees,
  animated transparent water, drifting clouds, particle explosions with fire, smoke, debris.
- **UI:** polished HTML/CSS overlay — title screen, match setup (teams, colours,
  controller, buddies, turn time, map seed, theme), HUD (timer, wind, weapons, team health),
  pause and victory screens.

## Technology

| Role | Choice | Why |
|---|---|---|
| 3D engine | **Babylon.js 9** | Full browser game engine (scene graph, PBR, shadows, post-processing, particles) |
| Language | TypeScript (strict) | Safety for the rules core |
| Bundler | Vite | Fast dev server, static build |
| Unit tests | Vitest | Headless core tests |
| E2E tests | Playwright + Google Chrome | Real WebGL rendering and input |
| Noise | simplex-noise | Seeded terrain generation |

Physics for terrain, characters, and projectiles is custom 2D against the density field —
general-purpose physics engines cannot do arbitrarily destructible Worms terrain well
(finding from the original research, still valid).

## Out of scope (for now)

Online multiplayer, ninja rope, jetpack, mines, sudden death, persistent statistics.
