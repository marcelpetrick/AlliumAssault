# TODO

Requested on 2026-09-19; recorded in version 1.33.2, researched in 1.33.3 and planned in 1.33.4.
Section 7 was added on 2026-09-20 from a separate request to review the AI opponents.
Every task in this file is implemented. Progress is also tracked in
[tasks.md](tasks.md); the [planning handoff](#planning-handoff) lists proposed decisions and order.

## 0. Review text size everywhere, especially the weapon bar — done in 1.33.5

- [x] Audit Normal, Large and Huge across the title, setup, pause, help, about and victory
      screens, all panels and boxes, and the in-game HUD.
- [x] Check the bottom weapon list first: weapon names, descriptions, hotkeys and ammo must be
      readable. Increase small base sizes and adjust spacing/wrapping where necessary.
- [x] Check turn information, timer, wind, team health, hints, banners, buddy labels, health
      labels, grenade countdowns and floating damage numbers.
- [x] Verify that every control remains reachable at each size, including smaller viewports;
      check clipping, overlaps, scrolling and keyboard focus.
- [x] Add browser checks for actual element sizes and layout, plus visual inspection at all
      three settings. Checking only the stored setting is insufficient.

Initial finding: `src/ui/styles.css` already scales `.hud-bottom`, including the weapon bar,
using `--ui-scale`. However, `.slot-key` starts at 9 px and `.slot-ammo` at 10 px; even Huge only
scales these to 13.5 and 15 px. Weapon captions/descriptions start at 13/12 px. World-positioned
labels use separate transforms in `src/ui/hud.ts`. The existing settings E2E checks persistence
and the root scale, but does not establish readability or complete layout coverage.

### Browser findings — 2026-09-20

Checked Normal/Large/Huge at 1920×1080, 1280×720, 960×600 and 900×600 in headless Google Chrome
with the current production build. Measurements used rendered element rectangles after loading
fonts, with animations disabled for stable layout measurements. Inspected screenshots of the
Huge HUD at 1280×720 and 960×600 and the Huge title layout. No page errors occurred.

- **Confirmed:** the HUD scale is applied at 1, 1.25 and 1.5, including the weapon slots. The
  small base text is a readability issue, rather than a missing scaling rule.
- **Confirmed:** at 960×600/Huge the weapon panel extends from x=387 to about x=1033, beyond
  the right edge at x=960. Some weapon controls are clipped; the hint is entirely off-screen.
  At Large, the hint also extends beyond the viewport. The CSS switches to a single-column
  bottom HUD only at viewport widths of 900 px or less, ignoring the space consumed by scaling.
- **Confirmed:** at 1280×720/Huge the title's How to Play button spans about y=667–753 and
  About spans y=771–834. About is entirely below the viewport. The Large title also overflows.
  The centered title stack has no scrolling container; `html` and `body` hide overflow.
- The 1280×720/Huge HUD fits within the viewport but squeezes its hint into a tall, narrow
  column. Fixing overflow alone will not make this layout comfortable to read.
- No outer-panel overflow was measured for setup, pause, help, about or victory in this matrix.
  This does not establish full keyboard accessibility, every nested control, or countdown and
  damage-label behavior; those acceptance checks remain open.

Implementation direction: give the title a scrollable, height-aware layout, and make the HUD
respond to available space at the chosen scale. Test just above the existing 900 px breakpoint
as well as common desktop sizes. Raise the small weapon text sizes together with the layout fix.

Implemented in 1.33.5: menu screens scroll when scaled content no longer fits, so every title and
panel control remains reachable. Large and Huge switch to the compact bottom-HUD layout before
their scaled weapon bars can overflow. Weapon hotkeys and ammo now start at 12 px, captions and
descriptions are larger, and the timer caption is no longer 8 px. A browser regression exercises
Normal, Large and Huge at 960×600 across title, setup, help, about, pause and a live match, checks
rendered rectangles, scrolls to every title button, and asserts the weapon text sizes.

## 1. Add text size to the in-game menu — done in 1.34.0

- [x] Expose the same Normal / Large / Huge option in the pause menu, reachable via Escape
      and the HUD Pause button.
- [x] Reuse `TEXT_SIZES`, `applyTextSize()` and the persisted setting in `src/ui/settings.ts`.
      Apply changes immediately to the open menu and the game HUD.
- [x] Keep the match paused and preserve its state, selected weapon and remaining turn time.
      Keep the user in the pause menu after changing the setting.
- [x] Verify that setup and pause show the same selection, it survives reloads, and Reset all
      continues to restore the default.
- [x] Add E2E coverage for changing size during a match, resuming, and persistence.

Initial finding: the selector exists in `Menu.showSetup()` only. `showPause()` has no selector,
and the current settings action handler finishes with `showSetup()`. Reusing the action requires
returning to the correct screen rather than opening match setup during play.

Persistence constraint: `App.startMatch()` calls `Menu.setDraft()` even for Quick Match. Calling
the existing `persist()` from a new pause-menu selector would therefore save that temporary
match configuration over the user's saved custom setup. Save the new text size together with
the previously persisted match settings instead. Add a regression flow: save a custom setup,
start Quick Match, change text size while paused, reload, and verify that both the custom setup
and new size survive. Preserve the current behavior when storage is unavailable.

Implemented in 1.34.0: the pause menu exposes the shared segmented text-size control and rerenders
itself after an immediate change. `Menu` keeps the last persisted custom setup separately from its
session draft, so resizing a Quick Match cannot overwrite the custom setup. The browser regression
checks the frozen timer, pause screen, immediate Huge HUD, stored values, resume and reload flow.

## 2. Design and implement the rope, in the style of Worms 2 — done in 1.39.0

- [x] Add a selectable rope that shoots a hook into terrain, attaches within a maximum range,
      and lets the active garlic buddy hang, climb, descend and swing.
- [x] Use Space to shoot, detach and shoot again; Up/Down to shorten/lengthen the rope within
      minimum/maximum length; Left/Right to build swing. Preserve momentum on release.
- [x] Define and document hook speed/range, rope length limits, reel speed, swing acceleration,
      damping, ammo rules and turn behavior before balancing. These are proposed game parameters,
      not verified numerical values from Worms 2.
- [x] Support repeated attachment while airborne. Decide how weapon selection and firing from
      the rope work: the original uses Enter to fire a selected weapon while attached, which
      needs explicit context handling alongside this game's Enter-to-jump control.

### Physics and terrain constraints

- [x] Keep the simulation in pure TypeScript under `src/core/`, using the existing gameplay
      plane and fixed 60 Hz stepping. Render the hook and rope as real 3D geometry.
- [x] Sweep the hook path to the first valid terrain contact; prevent tunneling through thin
      rock, attachment beyond range, or attachment to water, empty space or decorative meshes.
- [x] Model an anchored rope as a length constraint. A slack rope must not push the buddy away
      from its anchor. When taut, constrain distance and the outward radial velocity while
      retaining tangential momentum; account for changing length during reeling.
- [x] Combine gravity, controlled swing forces and collision response with substeps and bounded
      constraint iterations. Avoid artificial energy gains, explosive velocities, NaNs and
      teleporting when the rope becomes taut or reaches minimum length.
- [x] Resolve buddy contacts with floors, walls, ceilings and ledges together with the rope
      constraint. Reeling must stop safely when terrain blocks the buddy.
- [x] Handle rope contact with terrain corners using wrap/unwrap pivots and total path length.
      Prevent the rope from passing through rock; use stable tolerances to avoid corner jitter.
- [x] Revalidate anchors and pivots after terrain destruction. Release or update invalid
      attachments deterministically, preserving motion without trapping the buddy in rock.
- [x] Define fall and impact damage while attached and after release, drowning, map bounds,
      explosions/knockback, owner death, turn expiry, pause/resume and match cleanup.

### Integration and acceptance

- [x] Integrate attachment/flight state with `TurnAction`, `stepAction()` and the relevant phase
      sets. Ensure the ordinary buddy step does not also apply conflicting movement or gravity.
      Keep rope traversal on the turn timer and restore normal control after detaching.
- [x] Append the weapon to `WEAPON_ORDER` without shifting existing hotkeys; extend weapon kind,
      ammo and presentation data, held model, rendering, sound, HUD/help, README and VISION.
- [x] Define AI behavior explicitly; existing projectile/strike/melee planning does not provide
      rope navigation automatically.
- [x] Unit-test hook hits/misses, length limits, slack/taut transitions, reeling, swing/release
      momentum, corners, high speeds, destroyed anchors, damage and turn transitions.
- [x] Add E2E coverage for shooting, climbing, descending to maximum length, swinging,
      detaching/re-attaching and returning to ordinary play. Compare the feel with Worms 2.

Reference: the [archived Team17 Worms 2 controls](https://w2.worms2d.info/main.html?area=cont&page=abou)
confirm arrow-key swing/reeling, Space release/repeat firing and Enter weapon use while attached.
The solver above is a proposed implementation for this repo; matching the original feel still
requires playtesting.

### Implemented in 1.39.0

`src/core/rope.ts` is pure TypeScript with no Babylon or DOM. Agreed parameters, all proposals for
this game rather than measured Worms 2 values: hook speed 40, maximum range and paid-out length 24,
minimum length 1.2, reel speed 6, swing acceleration 26, a gentle 0.25/s drag, four constraint
substeps a frame, at most eight corners.

**Hook.** `stepHook()` sweeps in 0.12-unit steps, so it cannot tunnel through thin rock, and bites at
the first solid sample. It gives up beyond 24 units from the buddy, in water, off the map or after
its flight time, and a miss costs no use. The team pays one of its three uses only when the hook
actually bites, so `Game.fire()` skips the usual ammo decrement for the rope kind.

**Constraint.** The rope is a length constraint around the last pivot. `S` is the pinned length from
the anchor through the earlier corners, and the allowance is `max(ROPE_MIN, L - S)`. Slack pushes
nothing. When taut the buddy is placed on the circle and only the radial speed above the current
pay-out rate is removed, so tangential momentum survives and reeling still pulls it in; at the
minimum the sign is reversed so it cannot pass through its own anchor. `stepFree()` in `physics.ts`
integrates and resolves terrain contacts without walking, sticking or grounded damping, which is why
floors, walls, ceilings and ledges all still stop the buddy.

**Corners.** `updatePivots()` adds a corner when the straight run from the last pivot to the buddy is
blocked, placing it at the last clear sample pushed `PIVOT_CLEARANCE` out along the terrain normal,
and drops one again when the previous pivot has a clear run with `UNWRAP_MARGIN` to spare — the
hysteresis is what stops a corner chattering. `L` is untouched when the path changes, so the total
paid-out length is preserved and the allowance grows and shrinks with `S`.

**Failure behaviour.** If the rock the hook bit into is no longer solid, or the path would need more
than eight corners, the rope lets go rather than solving badly or dragging the buddy through rock.
Every outcome is deterministic: a test runs the same traversal twice and compares positions,
velocities and corner counts exactly.

**Turn integration.** A `{ kind: 'rope', rope, paid }` `TurnAction` and a `roping` phase, in both
`COUNTDOWN_PHASES` and `ACTION_PHASES`, so the turn clock runs and hurting the buddy still ends the
turn. `stepBuddies()` skips the buddy the rope is moving, so gravity is never applied twice, and
`stepRoping()` drives it instead. Between hooks the buddy simply falls; once it lands the traversal
ends and the phase returns to `aiming` with the timer still running. Roping is not the turn's shot —
`fire()` restores `shotsLeft` — so the player lands and then fires a weapon. `checkRopeBounds()` is
applied in both branches: without it a buddy that let go over the sea fell for ever, which is what
the drowning test caught. Running out of time drops the rope and ends the turn; `pause()` now clears
held keys and the game's input so a rope does not keep reeling on resume.

**Decided: no firing while attached.** The original uses Enter for that, which collides with
Enter-to-jump here, and `TurnAction` carries one timed action at a time. Let go, land, then fire. This
is a deliberate rule, not an oversight.

**AI: deferred.** `planAttack()` has no rope branch and says so in its own comment, so an AI can
never select one and never strands itself holding a utility it cannot use. Rope path planning is its
own problem and is not part of this release.

**Presentation.** A held gun and coil in `buddyView.ts`; the rope itself is an updatable Babylon tube
through the anchor, every corner and the buddy, rebuilt each frame from `Game.ropeLine()`;
`hookShot`, `hookBite` and `reel` sounds; a HUD hint that changes between hanging and between hooks.
Weapon slots are two pixels narrower again so all nineteen still fit one row at 1280 px.

**Coverage.** `tests/rope.test.ts` has twelve cases: biting within range and paying out what it flew,
a free miss, reeling at the measured speed and both length limits, a swing that builds and then never
gains energy over six cycles hands-off, letting go with the exact velocity and a free second hook,
wrapping and unwrapping around a pillar with the buddy never inside rock, a blasted anchor, landing
back into aiming and firing a bazooka afterwards, turn expiry mid-swing resolving the turn, drowning
out at sea, byte-identical determinism, and catching a buddy already falling at 34 units a second
without a teleport or a NaN. The browser test hooks a slab overhead, reels, swings, reads the hint,
lets go, lands and fires.

**Still empirical.** The numbers above are a starting point, not a match for Worms 2's feel; that
needs playtesting. Corner wrapping is this repo's own design, not a reproduction of the original's.

Further architecture finding: `TurnAction` explicitly permits only one timed weapon action.
Putting the whole rope lifecycle in that union would conflict with firing another timed weapon
while attached. Decide this before implementation: to support attached weapon use, separate
the buddy's rope/movement state from the weapon action; otherwise document a deliberate
detach-before-firing rule. Do not silently replace the rope when launching a sheep or burst.

Terrain queries can remain in the core: `contourRegion()` already produces oriented surface
segments, and `Terrain.revision` changes after carving. Use those segments or swept density-field
queries for attachments and wrapping; do not read the Babylon mesh or consume the renderer's
dirty-chunk set. A separate core cache must invalidate on terrain revision changes.

## 3. Choose the direction of air attacks with Left/Right — done in 1.35.0

- [x] While aiming a plane-based strike, let Left choose entry from the left, flying right,
      and Right choose entry from the right, flying left. Show an unambiguous approach arrow
      and help text before the player clicks the target.
- [x] Keep direction selection separate from walking and buddy facing. Holding a direction
      key must not move the buddy while choosing the plane's entry side.
- [x] Apply the choice to both air strike and napalm strike. Keep plane-less drops unaffected.
- [x] Pass the selected direction through the strike plan, bomb release order/velocity and
      plane rendering; preserve existing wind compensation and napalm drift behavior.
- [x] Define a predictable default/reset policy and preserve deliberate AI strike direction.
- [x] Add core tests for both directions and payloads, plus E2E tests for arrow keys, the
      preview, stationary buddy position and the resulting plane approach.

Initial finding: `planStrike()` in `src/core/strike.ts` already accepts `dir: 1 | -1` and handles
both directions. `Game.strike()` currently supplies the buddy's facing. Arrow keys currently
walk/turn that buddy, so direction is only indirectly selectable and changes player position.

Implemented in 1.35.0: `Game.strikeDir` holds the side the next plane comes in from, 1 for entry on
the left flying right and -1 for entry on the right flying left, exactly the convention
`planStrike()` already used. `Game.choosingApproach` is true while a plane-based strike is selected
during `aiming`; `step()` then reads Left/Right into `strikeDir` and `stepBuddies()` skips walking,
so the buddy holds its ground and its facing is untouched. Holding both keys leaves the choice
alone, like holding both walk keys. `beginTurn()` resets the side to the active buddy's facing, so a
player who never touches an arrow key gets the previous behaviour; within a turn the choice carries
over between the air strike and the napalm strike. The concrete mule has no plane, so it keeps
walking on Left/Right and ignores the setting.

The HUD shows an `Approach` card beside the wind gauge with `✈️ ⟶ from the left` or
`from the right ⟵ ✈️`, and the strike hint names the side; both disappear once the strike is called.
The AI now states its direction in `AttackPlan.strikeDir` and applies it with `setStrikeDir()` before
`strike()`, so it still flies in from its own side of the target rather than inheriting whatever the
human last chose. Wind compensation and the napalm drift are untouched: `planStrike()` already
folded `dir` into the release points, bomb carry velocity and start position.

Covered by three core tests (arrow keys for both strike weapons, mirrored approach landing on the
same target, the mule still walking) and a browser test that holds each arrow key, reads the
approach card and hint, checks the buddy has not moved, then clicks and verifies the plane entered
from the left.

## 4. Add proximity mines that persist across turns — done in 1.38.0

- [x] Add a mine weapon that places a physical mine on the map and consumes ammo consistently
      with the selected arsenal mode.
- [x] Define placement, arming delay, proximity radius, triggered fuse, blast damage/radius,
      knockback and retreat time. Allow the deploying buddy a chance to move away before arming.
- [x] Armed mines detect nearby living garlic buddies, including allies and the deployer after
      arming. Define whether terrain blocks detection and what happens if a buddy leaves range
      after triggering. Exclude corpses, crates and sheep unless separately specified.
- [x] Store mines as persistent world entities with owner/team identity and explicit
      unarmed/armed/triggered states. Preserve them across all team and round changes; clear them
      on match restart. Do not store dormant mines only in the current turn's action.
- [x] Handle terrain removal, falling, water, map bounds, explosions and deterministic chain
      reactions without duplicate damage or unbounded recursion.
- [x] Ensure dormant mines do not prevent `isSettled()` or turn completion. Resolve moving or
      triggered mines consistently with the phase machine and damage/death handling.
- [x] Integrate the weapon definition/order, inventory, model, sound, armed warning/countdown,
      help, README and VISION. Teach the AI to place mines and account for mine hazards.
- [x] Unit-test range boundaries, arming/trigger timing, friendly proximity, persistence across
      several turns, chain reactions, destroyed ground and cleanup. Add a weapon E2E test.

Initial finding: there is no mine weapon or persistent mine collection. `Game` already owns
persistent crates and graves; these offer lifecycle examples, but mines need their own rules.

Implemented in 1.38.0. `src/core/mines.ts` holds the data and the state machine: a mine falls and
settles like any loose body, is `unarmed` for `MINE_ARM_TIME` (1.5 s), then `armed`, and `triggered`
for `MINE_FUSE` (1 s) before it goes off. There is no dud chance and no expiry. `Game.mines` is a
match-level list, not part of a `TurnAction`, so mines outlive every team and round change; a restart
builds a new `Game` and starts empty.

Agreed behaviour: `Game.fire()` drops the mine at the buddy's feet and starts the retreat, so the
1.5 s arming delay _is_ the window to get clear. Once armed it triggers on any living buddy with
health left within `MINE_TRIGGER_RANGE` (2 units) that it has a clear line to — its own team and the
buddy that laid it included. `mineSees()` walks the ray, so rock between them shields a buddy.
Corpses, crates, sheep and tombstones are ignored. Once triggered it explodes whether or not the
buddy runs away. Buddy movement is swept from the position recorded before `stepBuddies()`, so a
fast fall past a mine cannot slip between two frames.

Blast values: radius 3, damage 40, force 12, two per team, `special` so the arsenal setting can
restrict it to crates. Appended to `WEAPON_ORDER` as Shift+8, leaving every existing hotkey alone.

`Game.explode()` sets off mines inside the blast in id order, each removed from the list before its
own blast, so a chain is deterministic and nothing is hurt twice. A mine falls when its ground is
carved away and is removed with a splash in water or off the map. `isSettled()` waits for a
_triggered_ mine but never for a dormant one, so a minefield does not hold up turns.

Presentation: a held disc in `buddyView.ts`, a world model in `effects.ts` whose lamp is dark while
arming, glows while armed and flashes while the fuse burns; `clunk`, `armed` and `beep` sounds; the
HUD floats a warning and shows the fuse countdown with the existing grenade countdown.

AI: `planAttack()` lays a mine when an enemy is close enough to wander into it, weighted by team
focus, and refuses when one of its own is standing beside the spot. `scoreBlast()` counts a mine in
the blast as a chained explosion, and `walkable()` refuses any path that passes near one.

Ten core tests and one browser test cover placement and ammo, arming, triggering and the fuse
running on after the victim leaves, friendly fire and the deployer, ignoring corpses/crates and rock
in the way, surviving four turn changes without holding one up, chain blasts without double damage,
falling and drowning, the hotkey order, and the AI laying and avoiding mines.

## 5. Let sheep and Super Sheep collect crates for their launcher — done in 1.36.0

- [x] Allow the walking Sheep and flying Super Sheep (`flysheep`) to collect health and weapon
      crates on contact without detonating merely because they touched a crate.
- [x] Award health to the exact buddy who launched the sheep, and weapon ammo to that buddy's
      team. Use the actor's stored owner ID, not whichever buddy is currently active.
- [x] Share the existing reward/event path so HUD, sound and inventory update once. Preserve
      the current health reward rules, including healing above starting health.
- [x] Detect collection along movement paths/substeps, particularly for flying sheep, so a
      fast crossing cannot skip a crate. Define deterministic ordering for pickup versus a
      same-step collision, explosion or ordinary buddy pickup.
- [x] Define dead/missing-owner behavior without resurrection or rewards to another buddy.
- [x] Test both sheep types and both crate kinds, multiple pickups, competing collectors,
      launcher attribution, invalid owners and pickup followed by detonation. Add E2E coverage.

Initial finding: both actors already carry `owner`. `Game.stepCrates()` only checks living
buddies, and `collectCrate()` already awards health to a buddy or ammo to its team and emits a
`cratePickup` event. The flying sheep has swept movement in `src/core/flyer.ts`; collection must
fit that path instead of relying solely on its final position after a frame.

Further integration finding: the existing HUD displays a `cratePickup` reward above the event's
recipient buddy. That correctly identifies the launcher, but the camera may be following the
sheep elsewhere. Add pickup-position feedback if needed without changing reward ownership.
Also test the launcher at zero HP but still `alive`: deaths are deferred, so checking only
`alive` can accidentally let a pickup rescue a buddy already awaiting death. Choose that rule
explicitly rather than inheriting it by accident.

Implemented in 1.36.0: `Game.sweepCrates(owner, from, to, radius)` collects every crate whose centre
lies within reach of the segment the sheep actually travelled during the step, in travel order with
the crate id breaking ties, and hands each one to `collectCrate()` — the same path a walking buddy
uses, so ammo, health, HUD floaters and sounds all behave identically and fire once. Both
`Game.stepSheep()` and `Game.stepFlyer()` record their position before stepping and sweep afterwards,
so a Super Sheep crossing a crate at 9 units a second cannot skip it, and a crate behind the rock it
crashed into is not on the travelled segment and stays put. The sweep runs before the step's result is
acted on, so a sheep that picks a crate up and detonates in the same step does both, in that order.

The recipient is resolved through `Game.rewardee(owner)`, which requires the launcher to exist, be
`alive` **and** have health left. Deaths are deferred to the death phase, so a buddy sitting on 0 HP
is still `alive`; healing it would pull it back out of a death it has already earned. When there is no
valid recipient the crate is left on the map rather than given to anyone else. Each crate is
re-checked against `this.crates` before the reward, so a chain blast during the same step cannot hand
out a crate twice, and a crate a buddy walked into first is simply gone by the time the sheep arrives.

The `cratePickup` event now carries the pickup position. The HUD floats the reward there, and
additionally over the rewarded buddy when that is more than two units away, so a sheep collecting a
crate across the map is visible without moving the reward off its owner.

Five core tests cover a hopping sheep taking two crates of different kinds in order for its launcher
(and not for its team-mate), a flying sheep sweeping one up mid-flight and still detonating later, a
launcher that is dead or awaiting death collecting nothing, and a crate a buddy already took not
being handed out twice. A browser test flies a Super Sheep clear of its launcher, drops a health crate
on its flight line and checks the launcher is healed and the heal sound plays.

## 6. Debug and fix delayed Holy Garlic Grenade countdowns — done in 1.34.1

- [x] Inspect the weapon definition, rest detection, projectile physics and existing tests.
- [x] Run an initial deterministic terrain/wind diagnostic; reproduce a delayed arming case.
- [x] Preserve the reproduction as a regression test before changing physics.
- [x] Fix the underlying contact/rest detection so an apparently settled grenade starts its
      countdown promptly. Keep legitimate flight/bouncing distinct from rest.
- [x] Check slopes, crater edges, repeated bounces, wind in both directions, moving terrain
      support, water/out-of-bounds removal and the maximum-wait fallback.
- [x] Assert one Hallelujah event, one explosion and the intended countdown duration; verify
      that motion after arming does not reset the fuse and other bouncing weapons still work.
- [x] Extend E2E checks to assert arming latency and displayed countdown, not just eventual
      explosion. Separately check elapsed simulation time versus wall time at low frame rates.

### Initial findings and reproduction

`WEAPONS.holy` has `fuse: 0`, `restFuse: 1.6`, restitution 0.25 and wind influence 0.3.
`Game.stepProjectiles()` starts the fuse only after speed stays below 0.6 world units/second for
0.3 seconds, or projectile age exceeds the 10-second fallback. Thus the countdown deliberately
starts after rest; the issue is whether rest is recognized correctly.

A temporary Vitest diagnostic used the real `Game.step(1 / 60)` and projectile physics across
15 combinations: terrain slopes 0, 0.1, 0.3, 0.6 and 1, each with wind -1, 0 and 1. Terrain was
`Terrain(128, 64, 3)`, filled with
`(28 + slope * (x - 64) - y) / Math.hypot(1, slope)`. A Holy Grenade began at
`x = 64`, `y = 28 + 0.15 * Math.hypot(1, slope)`, radius 0.15, zero velocity/age/fuse,
and an existing buddy as owner. Buddies were kept alive with high health during the diagnostic.

| Case                  | Arms at | Explodes at | Observation                                       |
| --------------------- | ------- | ----------- | ------------------------------------------------- |
| Flat, all three winds | 0.367 s | 1.967 s     | Rest recognized normally                          |
| Slope 0.6, wind 0     | 10.0 s  | 11.6 s      | Rest never exceeds about 0.033 s before fallback  |
| Slope 1, all winds    | 10.0 s  | 11.6 s      | Same delayed arming despite little visible motion |

Times are simulation seconds from placing the diagnostic projectile, rounded. Five of the
15 cases reached the fallback. In the slope-0.6/no-wind case, displacement was below 0.001 units
in 688 of 696 steps, yet its velocity-based rest timer kept resetting.

The suspected cause is in `stepProjectile()`: on a bouncing terrain contact, velocity is
reflected/damped but the step continues without advancing the position along the surface.
That can leave an almost stationary projectile with enough residual velocity to fail the rest
test repeatedly. Investigate consistent contact motion and support-aware rest detection rather
than merely shortening the fallback or accepting all slow airborne motion as resting.

The existing Holy Grenade unit test uses flat ground; the browser test permits up to 12 seconds
to find an armed projectile. Both can pass while this delay remains. The existing game/physics
tests and temporary diagnostic passed during this review; that does not mean the bug is fixed.

### Confirmed normal-throw reproduction — 2026-09-20

The defect also occurs through `selectWeapon()`, `pressFire()` and `releaseFire()`, without
inserting a projectile directly. A diagnostic matrix covered 216 throws: slopes
`[-0.6, -0.3, 0, 0.3, 0.6, 1]`, winds `[-1, 0, 1]`, aim angles `[0, 0.6, 1.2]` radians and
charge durations `[0.05, 0.3, 0.9, 1.4]` seconds, facing downhill (right on flat terrain).
117 reached the 10-second fallback. This is a controlled test matrix, not a measured frequency
in ordinary matches. All flat-ground cases armed before the fallback.

Reproduce a modest slope with no wind using the existing test helpers:

1. Create `Terrain(128, 64, 3)` and fill it with
   `(28 - 0.3 * (x - 64) - y) / Math.hypot(1, 0.3)`.
2. Create a `Game` with `config([team('A', 1), team('B', 1)])` from `tests/helpers.ts` and
   override spawns to x=60 and x=68, with `y = 29 - 0.3 * (x - 64)`.
3. Simulate 1.5 seconds, keep both buddies alive with 10000 HP, and set wind to 0.
4. Select `holy`, set the active buddy's facing to 1 and aim to 0.6, press fire, simulate
   0.3 seconds, then release fire.
5. Step at 1/60 second and record projectile age, position, speed, rest, armed state and events.

By projectile age 2 seconds it is stuck around `(71.0871, 26.0312)`. Subsequent whole-second
samples through age 11 have the same position. Its stored speed converges to about 1.3789
units/second, keeping `rest` at zero. It arms at age 10 and explodes at 11.6 seconds.

This confirms the contact/rest mismatch: a rejected step into terrain can retain tangential
velocity without moving tangentially. Gravity keeps feeding that velocity, while contact damping
leaves a nonzero equilibrium above both the 0.8 physics stop threshold and 0.6 arming threshold.
The earlier placed grenade at slope 0.6/no wind similarly stays fixed with stored speed about
2.4662. Fix contact motion/rest consistently and test the thrown case, rather than only changing
the timer. A displacement-only rest check also needs terrain-support checks to avoid treating
an airborne apex or a blocked invalid position as a valid resting grenade.

Separate timing concern from code inspection: `App.frame()` caps elapsed time passed into
`advance()` at 0.1 seconds. Below 10 rendered frames/second, the simulation therefore runs
slower than wall time; at a steady 2 fps it would advance roughly 0.2 simulation seconds per
real second. This affects all timers and may amplify the perceived grenade delay. The diagnostic
above uses fixed simulation steps and reproduces the arming bug independently of rendering.

### Implemented in 1.34.1

`stepProjectile()` rejected a swept step that ended inside rock: it reflected the velocity but left
the projectile where it was. On a slope, gravity then refilled the tangential velocity every step,
so the grenade stood still while reporting 1.4–3.4 units/s — above both the 0.8 physics stop and
the 0.6 arming threshold — and only armed on the 10-second fallback.

A blocked contact now slides the projectile along the surface with whatever velocity survived the
response, and zeroes that velocity when the surface blocks the response too, so a stored speed
always corresponds to real motion. Coulomb friction (`FRICTION = 0.9`) rubs off the sliding part,
but the friction impulse is capped at the load the surface carries in a single substep. A resting
projectile feels its whole weight and stops; a hard bounce is over too quickly for friction to bite,
so grenades, cluster bomblets and bananas still skitter. A slope holds a resting projectile while
`tan(angle) <= FRICTION * (1 + restitution)`.

Re-running the documented 216-throw matrix drops the fallback cases from 117 to 4. Those four are a
grenade rolling steadily down a 45° slope with a tailwind: it moves about 1.8 units per second and
its stored speed matches that displacement, so it is genuinely in motion and the fallback is doing
its intended job. The rest threshold, the 1.6-second fuse and the 10-second fallback are unchanged.

Regressions: `tests/physics.test.ts` asserts that a projectile settling on slopes 0.1–0.8 ends
below the arming threshold _and_ stays put, that a 68° slope makes it roll with speed matching its
displacement, and that a shallow bounce still skitters along flat ground; `tests/game.test.ts`
throws a Holy Grenade on four slopes through `selectWeapon`/`pressFire`/`releaseFire` and requires
arming from rest within 6 seconds; `e2e/weapons.spec.ts` stands a buddy on a real hillside of the
generated map, measures the arming age in the browser and asserts the on-screen countdown runs
2 → 1. All four fail on the unfixed physics.

The separate frame-rate concern below 10 fps is untouched: `App.frame()` still caps `advance()` at
0.1 seconds, so the simulation runs slower than wall time on very slow machines. That is a
rendering/timing change with its own tests, not part of this fix.

## 7. Review and strengthen the AI opponents — implemented in 1.37.0, one item deferred

Requested on 2026-09-20. This section is a **review with a proposed backlog**; no AI behaviour has
been changed yet. Findings below were read out of `src/core/ai.ts`, `src/core/game.ts` and
`src/core/crates.ts` as they stand in 1.34.1.

### What the AI already does

- Three levels differ only in search resolution and hand shake: `LEVELS` gives easy 10 angles,
  5 powers and 0.12 rad aim error; normal 18/8/0.045; hard 28/11/0.012, plus thinking times of
  1.2/0.9/0.6 seconds. So the harder levels genuinely aim better, and easy genuinely misses more.
- It brute-forces every projectile weapon over the angle/power grid with `simulateShot()`, which
  uses the real `stepProjectile()` including wind, gravity scale, restitution and fuses.
- It scores walking sheep by replaying their hops, air strikes by summing the blast of every bomb
  in the pattern (with wind drift compensation), flying sheep, torch, drill, self-destruct, melee
  and hitscan weapons, and it checks line of sight for minigun and shotgun.
- `knockedOut()` already recognises that a melee or minigun shove can drown a buddy or throw it off
  the map, and counts that as lethal.
- Limited ammo costs a handicap (12 points for projectiles, 15 for sheep and flying sheep) so the
  AI does not burn a Holy Grenade on a shot a bazooka would also make.
- It does collect crates: `nearbyCrate()` plus the `fetch` stage walks to one and jumps when stuck.

### Answers to the three questions asked

- **Do they collect crates they could reach?** Partly. `nearbyCrate()` only accepts a crate within
  12 world units horizontally, within 3 units vertically and already grounded, and the `fetch` stage
  only starts when the best attack scores below `CRATE_WORTH = 15`, at most twice per turn, with more
  than 12 seconds left. Walking is a blind "hold left or right and jump when stuck" — there is no
  path check, so a crate behind a wall or across a gap is attempted and abandoned after 6 seconds.
- **Do they tell health from ammunition?** No. `nearbyCrate()` never reads `crate.kind`, and the
  decision never reads `me.hp`. A buddy on 8 HP standing next to a health crate will still take a
  mediocre shot if that shot happens to score 15 or more, and a full-health buddy will walk to a
  health crate it barely benefits from just as eagerly as to a weapon crate.
- **Do they shoot crates for extra damage?** No. `Game.explode()` detonates any crate inside the
  blast with `CRATE_BLAST` (radius 1.8, 10 damage, force 6) and chains, but `scoreBlast()` in the AI
  iterates only over buddies. The AI therefore never sees a crate next to an enemy as a free second
  explosion, never notices that its own shot will blow up the crate it was about to fetch, and never
  notices a crate next to itself turning a near miss into self-damage.
- **Do they prefer the stronger enemy team?** No. `scoreBlast()` treats every buddy whose `team`
  differs from its own identically: raw damage plus a flat 40-point bonus when the hit would be
  lethal. With three or four teams there is no notion of which team is ahead on total health, no
  focus fire on a nearly eliminated team, and no reluctance to help the leader by weakening a rival.

### Further defects and opportunities found while reviewing

- **Prediction mismatch:** `Game.stepProjectiles()` gives contact-fused weapons a `hitTest` that
  matches buddies _and crates_, but `simulateShot()` in the AI builds the same test from buddies
  only. The AI can therefore plan a rocket straight through a crate that will in fact stop it short.
- **Knockback is only scored for melee and minigun.** A bazooka or grenade that would shove an
  enemy into the water scores as plain damage, so the AI misses the cheapest kills on this map type.
- **No repositioning.** Apart from fetching a crate, the AI never walks, jumps or back-flips to
  improve a shot, break line of sight, or step out of a blast it is standing in. If every shot from
  where it stands is bad, it takes the least bad one.
- **No terrain reasoning about the ground it stands on.** It will happily blast the rock under its
  own feet, and never considers digging an enemy's support away to drop them into the water.
- **No memory across turns.** `AiDriver.reset()` clears everything each turn, so the AI cannot
  learn a wind-corrected aim from its previous miss or finish a crate run it began last turn.
- **Retreat is minimal:** it scurries for one second, only after a contact-fused weapon, and only
  directly away from its own facing, regardless of where the blast or the enemies actually are.
- **Sudden death and the turn clock** are only consulted for the sheep budget and the crate-fetch
  gate; the AI does not play more aggressively when health drops to `SUDDEN_DEATH_HP`.
- **Level differentiation is purely mechanical.** Easy and hard evaluate the same tactics with the
  same knowledge; only the grid and the noise differ. Crate awareness, target selection and
  knockback reasoning would be more convincing as knowledge the higher levels have and easy lacks.

### Proposed work, roughly in order of value per risk

- [x] Teach `scoreBlast()` about crates: add the chained `CRATE_BLAST` of every crate inside the
      radius, credited to whoever it would hit, so shooting a crate beside an enemy is rewarded and
      one beside a friend is penalised. Keep the chain bounded and deterministic.
- [x] Give `simulateShot()` the same crate `hitTest` the game uses, so contact fuses are predicted
      correctly.
- [x] Make crate fetching need-aware: read `crate.kind`, weigh a health crate by the missing health
      of the buddy (and by `CRATE_HEAL`), weigh a weapon crate by what the team is short of, and let
      a badly hurt buddy prefer healing over a mediocre attack instead of using one fixed threshold.
- [x] Replace the blind walk with a reachability check along the surface, so the AI only commits to
      a crate it can actually walk to within the remaining turn time, and give up earlier otherwise.
- [x] Score knockback for blasts as well: reuse `knockedOut()` with the explosion's force vector for
      enemies near the blast, and subtract the same for friends and for itself.
- [x] Add team-level target selection: weight each enemy by its team's remaining total health so the
      AI presses the leading team, and prefer finishing a team that is one buddy from elimination.
      Decide the exact rule and make it visible in the scoring, not hidden in tie-breaks.
- [ ] **Deferred.** Consider a short repositioning step before aiming at hard level: sample a few
      reachable standing spots and re-plan from the best one, bounded by turn time. Left out of
      1.37.0: `planAttack()` already costs about 24 ms at hard level, and re-planning from several
      positions multiplies that by the number of candidates inside the turn loop. It needs its own
      budgeted search and its own measurements, not a bolt-on.
- [x] Gate the new knowledge by level, so easy stays cheerfully bad: crate contents and team
      targeting for normal and hard, knockback and repositioning for hard only.
- [x] Unit-test each rule in isolation with deterministic terrain and seeds: a crate beside an enemy
      raises the score, a crate beside a friend lowers it, a hurt buddy fetches the health crate, a
      healthy buddy does not, the leading team is preferred, and every level still finishes a turn.
- [x] Add E2E coverage that an AI match plays to a finish at every level without stalling, and that
      an AI buddy visibly picks up a health crate when badly hurt.

### Implemented in 1.37.0

An `AiKnowledge` record now says what each level understands, separately from how finely it searches
and how much its hand shakes. Easy knows nothing extra and plays exactly as before; Normal gains
crate awareness and team targeting; Hard adds knockback.

- **Crate chains.** `scoreBlast()` adds the `CRATE_BLAST` of every crate inside the blast radius, run
  through the same per-buddy tally as the blast itself, so a crate beside an enemy is a second
  explosion worth having and one beside a team-mate is a hazard. Only the first link of the chain is
  estimated, which keeps it bounded and order-independent; destroying a crate also costs a small
  fixed supply penalty. `Game.explode()` remains the authority — the AI only estimates it.
- **Contact fuses.** `simulateShot()` now uses the same crate `hitTest` as
  `Game.stepProjectiles()`, so the AI no longer plans rockets through a crate that would stop them.
- **Need-aware crates.** `crateValue()` reads the kind, which is visible on the map. A health crate
  is worth 10 at full health (over-healing is still a buffer) rising to 25 when a full heal would be
  used, plus 25 more when the buddy is hurt badly enough that the heal may keep it in the match. The
  weapon inside a weapon crate is not visible, so it is valued by how many special weapons the team
  has none of. Distance costs 0.4 a unit. The AI fetches whenever that beats its best attack, instead
  of the old fixed threshold of 15.
- **Reachability.** `walkable()` walks the surface profile in half-unit steps and rejects water, gaps
  and steps too tall to climb, and checks the walk fits in the turn time. Easy skips the check and
  keeps blundering towards crates it cannot reach.
- **Knockback.** `shovedOut()` answers "would this shove put them in the water or off the map?" with
  a one-line ballistic estimate rather than simulating the fall, because `knockedOut()` at 150 body
  steps a call cannot run inside a 616-shot search. A blast that throws an enemy out is scored as the
  whole buddy. It ignores rock in the way, so it can be optimistic; that is a heuristic, not a claim.
- **Team targeting.** `enemyWeight()` weighs each enemy by its team's share of the health the
  opposition has left, plus a bonus for a team down to its last buddy. With a single opponent it
  returns 1, so duels are unchanged. The weight is applied everywhere an enemy is valued — blasts,
  melee, minigun, shotgun, torch, drill, flying sheep and self-destruct — not hidden in a tie-break.

Cost measured on a three-team flat arena with two crates: easy 7.0 → 8.1 ms, normal 11.3 → 12.7 ms,
hard 21.1 → 23.6 ms per `planAttack()`. A surface-height cache keyed on `Terrain.revision` keeps
`groundBelow()` from rescanning the same columns.

Eight core tests cover the crate chain (and easy not seeing it), a crate beside a team-mate, the
contact fuse stopping at a crate, a hurt buddy fetching where a healthy one shoots, a crate behind
an unclimbable wall being left alone, leader-pressing and last-buddy focus, Hard seeing a cliff shove
where Normal does not, and every level finishing an AI-vs-AI match with crates. Two browser tests run
a match at each level to a finish and watch a nearly dead hard AI walk to a health crate and heal.

### Risks

- The AI runs inside the turn loop; `planAttack()` already brute-forces up to 28 x 11 x 2 shots per
  projectile weapon. Crate chains, knockback simulation and repositioning all multiply that. Measure
  the per-turn cost and keep the added work behind the level gates.
- Scoring changes shift balance for every existing AI test. Expect to re-baseline `tests/game.test.ts`
  AI expectations and to check that easy still misses often enough to be fun.
- Blast chains must not recurse: `Game.explode()` removes a crate before detonating it, and any AI
  estimate must use the same rule rather than a second, divergent model.

## Planning handoff

The research is sufficient to schedule work; no implementation or experimental gameplay changes
are included. The following order and defaults are **proposals for the later implementation
decision**, not additional approved requirements or claims of exact Worms 2 physics.

### Suggested implementation order and boundaries

| Order | Task    | Main files                                                                                                          | Deliverable and dependency                                                                                                                 |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | 0 / T55 | `src/ui/styles.css`, `src/ui/hud.ts`, `e2e/game.spec.ts`, `e2e/features.spec.ts`                                    | Readable weapon text and layouts that fit or scroll at all three sizes; establish layout tests before adding more controls.                |
| 2     | 1 / T56 | `src/ui/menu.ts`, `src/ui/settings.ts`, `tests/settings.test.ts`, `e2e/game.spec.ts`                                | Shared size control in setup/pause, safe persistence and unchanged match state; builds on the layout fix.                                  |
| 3     | 6 / T61 | `src/core/physics.ts`, `src/core/game.ts`, `tests/physics.test.ts`, `tests/game.test.ts`, `e2e/weapons.spec.ts`     | A regression for the normal throw, consistent contact/rest behavior and bounded countdown latency; audit all bouncing weapons.             |
| 4     | 3 / T58 | `src/core/game.ts`, `src/core/ai.ts`, `src/ui/hud.ts`, `src/render/effects.ts`, `src/render/world.ts`, `src/app.ts` | Explicit plane entry side and preview, preserving AI direction and plane-less strikes. Independent of the grenade fix.                     |
| 5     | 5 / T60 | `src/core/game.ts`, `src/core/sheep.ts`, `src/core/flyer.ts`, `src/ui/hud.ts`                                       | Swept crate pickup credited once to the launching buddy/team, with visible feedback. Independent of new weapons.                           |
| 6     | 4 / T59 | Proposed `src/core/mines.ts`, plus game, weapons, AI, renderer, audio and tests                                     | Persistent mine lifecycle and hazards across turns, building on understood collision/settling behavior.                                    |
| 7     | 2 / T57 | Proposed `src/core/rope.ts`, plus physics, game, weapons, AI, input, renderer, audio and tests                      | Rope physics and turn integration, then presentation and balance. Highest uncertainty; keep its solver work separate from unrelated fixes. |

Every gameplay change also updates help and the relevant README/VISION entries. New weapons
need held models in `buddyView.ts`, presentation metadata and E2E coverage. The integration files
above are starting points, not permission to refactor unrelated systems. Use separate commits
for these deliverables with the repository's normal verification and versioning rules.

### Proposed behavior to decide before implementation

| Topic            | Proposed default                                                                                                                                                                                                             | Decision or validation still needed                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Readability      | Raise weapon hotkeys/ammo to at least 12 CSS px at Normal; preserve 1/1.25/1.5 scaling. Stack HUD regions or scroll deliberately when space runs out.                                                                        | Visual review with all 19 future weapon slots, long names, all four teams and the viewport matrix above.                                                                                                   |
| Strike direction | Left means entry from the left (`dir = 1`), Right means entry from the right (`dir = -1`). Initialize from buddy facing each turn, retain the choice between plane-based weapons within that turn, and show a labeled arrow. | Confirm this entry-side convention; AI must set direction explicitly rather than inheriting the human selection. Both keys held leave it unchanged.                                                        |
| Mines            | Place beside the buddy; allow 1 second to arm, then trigger within 2 world units of a living, positive-HP buddy's center with terrain line of sight. Once triggered, explode after 1 second even if the buddy moves away.    | Proposed tuning only: 2 starting mines, 40 damage, radius 3, force 12; compare with grenades and ensure the retreat window is usable.                                                                      |
| Mine persistence | No dud randomness or automatic turn-based expiry. Explosions trigger mines; stable ID order and removal before blast prevent duplicate chains. Settled dormant mines do not block the turn.                                  | Decide final blast-chain behavior and proximity boundary; exercise large persistent mine populations and the 15-second settling fallback.                                                                  |
| Sheep rewards    | Existing health/ammo amounts; launcher ID determines recipient. Require the launcher to exist, be alive and have positive HP; otherwise leave the crate available.                                                           | Confirm exclusion of buddies awaiting death. Add contact-position feedback while retaining launcher-centered reward attribution.                                                                           |
| Rope stock       | Basic utility with 3 uses per team; one use consumed on first successful attachment, with re-shooting in that traversal until an offensive action or turn end. A miss consumes no use.                                       | Confirm basic versus crate-only availability, stock and whether repeat attachments should be unlimited within a traversal.                                                                                 |
| Rope dimensions  | Initial tuning: 1.2 minimum length, 24 maximum length, hook speed 40 and reel speed 6 world units/second. No wind force on the attached buddy, matching existing buddy movement.                                             | Tune after physics tests; total wrapped path counts toward maximum length. Swing acceleration, damping and safe motor force need playtesting, not guessed equivalence to Worms 2.                          |
| Rope and weapons | Prefer separate rope locomotion state, so selected weapons need not overwrite attachment state. Keep Space for rope shoot/release and arrows for swing/reel; use context-aware Enter for weapon use while attached.          | Decide the supported weapon set and aim/charge controls while attached. Guided sheep, torch and drill require explicit coexistence or detach rules; do not promise all combinations before resolving them. |
| AI scope         | Require existing AI turns to remain valid for every step. Add simple mine placement/hazard checks. Stage rope path planning after reliable human traversal.                                                                  | Decide whether the first rope release includes AI rope use; if deferred, document that clearly and ensure an AI never stalls holding an unsupported utility.                                               |
| Holy Grenade     | Preserve rest-triggered arming, the 1.6-second fuse and the 10-second emergency fallback initially; fix the physics mismatch first.                                                                                          | Rebalance only after the regression passes. Treat wall-time catch-up below 10 fps as a separate timing change with its own tests.                                                                          |

Mine detection should sweep buddy movement relative to the mine between fixed steps, not just
sample endpoints, so fast falls and rope swings cannot bypass it. Crate collection should use
the sheep's actual traversed segments and retain collision ordering: a crate beyond an earlier
terrain hit cannot be collected. Within one simulation step, process candidate contacts in
travel order with stable IDs as tie-breakers and verify the crate still exists before reward.

There are currently 17 selectable weapons. Appending mines and then rope would use Shift+8 and
Shift+9 without changing any current binding; `weaponForKey()` already supports those indices.
No more shifted number slots remain afterward. Update every displayed hotkey range and test
selection/cycling with empty ammo as well as Infinite supplies.

### Rope solver plan and review points

1. Define independent hook/traversal state with owner ID, hook position/velocity, terrain anchor,
   ordered wrap pivots, total paid-out length and usage accounting. Separate state/events for
   presentation from core collision decisions. Detachment always preserves current velocity.
2. Advance the hook with swept tests against authoritative core terrain. Reject invalid,
   unreachable and out-of-range anchors. Keep hook flight bounded even when nothing is hit.
3. Apply gravity and controlled swing forces once per substep. For a fixed anchor/pivot chain,
   let `S` be the length of completed anchor-to-pivot segments, `L` the total paid-out length,
   and `r` the buddy's distance from the final pivot. Enforce `r <= L - S` only when taut; slack
   rope exerts no pushing force. A positive minimum prevents division by zero near the anchor.
4. For stationary pivots, the taut radial velocity must not exceed the available-length rate
   `d(L - S)/dt`; account for reeling rather than always zeroing radial velocity. Retain the
   tangential component. Reeling can intentionally add energy, while passive swinging must not
   gain energy from repeated corrections. Bound motor effort and substeps.
5. Resolve buddy terrain contacts and rope constraints together. Add/remove corner pivots only
   after swept visibility and side tests, with hysteresis around corners. Preserve total paid-out
   length when the path changes. Stop reeling when blocked; if terrain changes leave no feasible
   configuration, detach safely instead of pulling through solid rock. Bound pivot count and
   solver iterations, with deterministic failure behavior.
6. Test the solver before presentation: straight hangs, slack drops, long swings, minimum and
   maximum length, high-speed catches, ledge/ceiling contacts, wrapping both directions,
   unsupported anchors, and identical inputs producing identical results. Then test turn expiry,
   damage, drowning, pause/resume, retreat rules, crate/mine interactions and weapon use.

General reference: [Box2D's distance-joint documentation](https://box2d.org/documentation/md_simulation.html)
describes distance constraints, length limits and motorized length adjustment. It informs the
design vocabulary only; adding Box2D or replacing this game's physics is not proposed. The
inequality, terrain wrapping and integration strategy above are this project's proposed design.
The earlier Team17 reference establishes controls, not exact simulation constants or a verified
corner-wrapping algorithm. Matching the feel still needs a later prototype and playtesting.

### Remaining risks and evidence needed at implementation time

- **UI:** root-scale assertions alone miss clipping. Check actual rectangles and keyboard
  access; account for changing text size while a menu is open, projected labels and browser zoom.
- **Settings:** text-size-only persistence must not replace saved custom setup with an in-memory
  Quick Match, and a storage failure must not prevent immediate resizing.
- **Physics:** a correction to shared projectile contact code can change grenade, cluster and
  banana behavior. Use existing tests plus slope/crater regressions; do not merely weaken the
  Holy Grenade speed threshold to hide a stationary-body/velocity mismatch.
- **Turns:** newly triggered mines must finish relevant damage/death resolution before advancing
  the active player. Confirm behavior if a chain is still active at `SETTLE_MAX`; dormant mines
  must neither force a wait nor disappear in `beginTurn()`.
- **Rope:** `stepBuddies()` must not apply gravity a second time, and `isSettled()`/turn-end cleanup
  must not leave an attached buddy suspended forever. Route arrow, Space and Enter commands by
  active control context; clear held inputs on pause, focus loss and transitions.
- **Delivery:** prove each chosen feature with core tests and a deterministic browser flow,
  including all existing weapons after shared-physics changes. Numerical tuning, AI rope
  navigation and exact Worms 2 feel remain empirical work, not completed research claims.

## Completion requirements

For each implementation task, update this file and `tasks.md`, document final behavior, add
meaningful unit/E2E coverage, and run `npm run verify` before committing. Follow the repository's
SPDX rules, bump the version and add a matching changelog entry for every commit. Keep commits
local unless a push, tag or release is explicitly requested.
