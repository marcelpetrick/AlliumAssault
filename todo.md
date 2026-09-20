# TODO

Requested on 2026-09-19; recorded in version 1.33.2, researched in 1.33.3 and planned in 1.33.4.
**Planning research is complete. Implementation is explicitly deferred until the user decides
when to begin.** All seven implementation tasks below remain open. Progress is also tracked in
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

## 2. Design and implement the rope, in the style of Worms 2

- [ ] Add a selectable rope that shoots a hook into terrain, attaches within a maximum range,
      and lets the active garlic buddy hang, climb, descend and swing.
- [ ] Use Space to shoot, detach and shoot again; Up/Down to shorten/lengthen the rope within
      minimum/maximum length; Left/Right to build swing. Preserve momentum on release.
- [ ] Define and document hook speed/range, rope length limits, reel speed, swing acceleration,
      damping, ammo rules and turn behavior before balancing. These are proposed game parameters,
      not verified numerical values from Worms 2.
- [ ] Support repeated attachment while airborne. Decide how weapon selection and firing from
      the rope work: the original uses Enter to fire a selected weapon while attached, which
      needs explicit context handling alongside this game's Enter-to-jump control.

### Physics and terrain constraints

- [ ] Keep the simulation in pure TypeScript under `src/core/`, using the existing gameplay
      plane and fixed 60 Hz stepping. Render the hook and rope as real 3D geometry.
- [ ] Sweep the hook path to the first valid terrain contact; prevent tunneling through thin
      rock, attachment beyond range, or attachment to water, empty space or decorative meshes.
- [ ] Model an anchored rope as a length constraint. A slack rope must not push the buddy away
      from its anchor. When taut, constrain distance and the outward radial velocity while
      retaining tangential momentum; account for changing length during reeling.
- [ ] Combine gravity, controlled swing forces and collision response with substeps and bounded
      constraint iterations. Avoid artificial energy gains, explosive velocities, NaNs and
      teleporting when the rope becomes taut or reaches minimum length.
- [ ] Resolve buddy contacts with floors, walls, ceilings and ledges together with the rope
      constraint. Reeling must stop safely when terrain blocks the buddy.
- [ ] Handle rope contact with terrain corners using wrap/unwrap pivots and total path length.
      Prevent the rope from passing through rock; use stable tolerances to avoid corner jitter.
- [ ] Revalidate anchors and pivots after terrain destruction. Release or update invalid
      attachments deterministically, preserving motion without trapping the buddy in rock.
- [ ] Define fall and impact damage while attached and after release, drowning, map bounds,
      explosions/knockback, owner death, turn expiry, pause/resume and match cleanup.

### Integration and acceptance

- [ ] Integrate attachment/flight state with `TurnAction`, `stepAction()` and the relevant phase
      sets. Ensure the ordinary buddy step does not also apply conflicting movement or gravity.
      Keep rope traversal on the turn timer and restore normal control after detaching.
- [ ] Append the weapon to `WEAPON_ORDER` without shifting existing hotkeys; extend weapon kind,
      ammo and presentation data, held model, rendering, sound, HUD/help, README and VISION.
- [ ] Define AI behavior explicitly; existing projectile/strike/melee planning does not provide
      rope navigation automatically.
- [ ] Unit-test hook hits/misses, length limits, slack/taut transitions, reeling, swing/release
      momentum, corners, high speeds, destroyed anchors, damage and turn transitions.
- [ ] Add E2E coverage for shooting, climbing, descending to maximum length, swinging,
      detaching/re-attaching and returning to ordinary play. Compare the feel with Worms 2.

Reference: the [archived Team17 Worms 2 controls](https://w2.worms2d.info/main.html?area=cont&page=abou)
confirm arrow-key swing/reeling, Space release/repeat firing and Enter weapon use while attached.
The solver above is a proposed implementation for this repo; matching the original feel still
requires playtesting.

Further architecture finding: `TurnAction` explicitly permits only one timed weapon action.
Putting the whole rope lifecycle in that union would conflict with firing another timed weapon
while attached. Decide this before implementation: to support attached weapon use, separate
the buddy's rope/movement state from the weapon action; otherwise document a deliberate
detach-before-firing rule. Do not silently replace the rope when launching a sheep or burst.

Terrain queries can remain in the core: `contourRegion()` already produces oriented surface
segments, and `Terrain.revision` changes after carving. Use those segments or swept density-field
queries for attachments and wrapping; do not read the Babylon mesh or consume the renderer's
dirty-chunk set. A separate core cache must invalidate on terrain revision changes.

## 3. Choose the direction of air attacks with Left/Right

- [ ] While aiming a plane-based strike, let Left choose entry from the left, flying right,
      and Right choose entry from the right, flying left. Show an unambiguous approach arrow
      and help text before the player clicks the target.
- [ ] Keep direction selection separate from walking and buddy facing. Holding a direction
      key must not move the buddy while choosing the plane's entry side.
- [ ] Apply the choice to both air strike and napalm strike. Keep plane-less drops unaffected.
- [ ] Pass the selected direction through the strike plan, bomb release order/velocity and
      plane rendering; preserve existing wind compensation and napalm drift behavior.
- [ ] Define a predictable default/reset policy and preserve deliberate AI strike direction.
- [ ] Add core tests for both directions and payloads, plus E2E tests for arrow keys, the
      preview, stationary buddy position and the resulting plane approach.

Initial finding: `planStrike()` in `src/core/strike.ts` already accepts `dir: 1 | -1` and handles
both directions. `Game.strike()` currently supplies the buddy's facing. Arrow keys currently
walk/turn that buddy, so direction is only indirectly selectable and changes player position.

## 4. Add proximity mines that persist across turns

- [ ] Add a mine weapon that places a physical mine on the map and consumes ammo consistently
      with the selected arsenal mode.
- [ ] Define placement, arming delay, proximity radius, triggered fuse, blast damage/radius,
      knockback and retreat time. Allow the deploying buddy a chance to move away before arming.
- [ ] Armed mines detect nearby living garlic buddies, including allies and the deployer after
      arming. Define whether terrain blocks detection and what happens if a buddy leaves range
      after triggering. Exclude corpses, crates and sheep unless separately specified.
- [ ] Store mines as persistent world entities with owner/team identity and explicit
      unarmed/armed/triggered states. Preserve them across all team and round changes; clear them
      on match restart. Do not store dormant mines only in the current turn's action.
- [ ] Handle terrain removal, falling, water, map bounds, explosions and deterministic chain
      reactions without duplicate damage or unbounded recursion.
- [ ] Ensure dormant mines do not prevent `isSettled()` or turn completion. Resolve moving or
      triggered mines consistently with the phase machine and damage/death handling.
- [ ] Integrate the weapon definition/order, inventory, model, sound, armed warning/countdown,
      help, README and VISION. Teach the AI to place mines and account for mine hazards.
- [ ] Unit-test range boundaries, arming/trigger timing, friendly proximity, persistence across
      several turns, chain reactions, destroyed ground and cleanup. Add a weapon E2E test.

Initial finding: there is no mine weapon or persistent mine collection. `Game` already owns
persistent crates and graves; these offer lifecycle examples, but mines need their own rules.

## 5. Let sheep and Super Sheep collect crates for their launcher

- [ ] Allow the walking Sheep and flying Super Sheep (`flysheep`) to collect health and weapon
      crates on contact without detonating merely because they touched a crate.
- [ ] Award health to the exact buddy who launched the sheep, and weapon ammo to that buddy's
      team. Use the actor's stored owner ID, not whichever buddy is currently active.
- [ ] Share the existing reward/event path so HUD, sound and inventory update once. Preserve
      the current health reward rules, including healing above starting health.
- [ ] Detect collection along movement paths/substeps, particularly for flying sheep, so a
      fast crossing cannot skip a crate. Define deterministic ordering for pickup versus a
      same-step collision, explosion or ordinary buddy pickup.
- [ ] Define dead/missing-owner behavior without resurrection or rewards to another buddy.
- [ ] Test both sheep types and both crate kinds, multiple pickups, competing collectors,
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

## 6. Debug and fix delayed Holy Garlic Grenade countdowns

- [x] Inspect the weapon definition, rest detection, projectile physics and existing tests.
- [x] Run an initial deterministic terrain/wind diagnostic; reproduce a delayed arming case.
- [ ] Preserve the reproduction as a regression test before changing physics.
- [ ] Fix the underlying contact/rest detection so an apparently settled grenade starts its
      countdown promptly. Keep legitimate flight/bouncing distinct from rest.
- [ ] Check slopes, crater edges, repeated bounces, wind in both directions, moving terrain
      support, water/out-of-bounds removal and the maximum-wait fallback.
- [ ] Assert one Hallelujah event, one explosion and the intended countdown duration; verify
      that motion after arming does not reset the fuse and other bouncing weapons still work.
- [ ] Extend E2E checks to assert arming latency and displayed countdown, not just eventual
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
