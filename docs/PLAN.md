# Implementation plan

## Performance review, jetpack and porcelain — November 2026

1. Measure simulation, individual AI plans, map setup, browser frame work and startup; record the
   machine and renderer limitations, rank candidate improvements, and distinguish experiments
   from proven speedups.
2. Change unpowered jetpack descent to start gently, accelerate more slowly than an ordinary fall,
   and permit reduced damage on a long fall. Verify fuel exhaustion, manual cutoff, damage,
   timeout, gravity settings, water and short safe falls.
3. Replace the Ming vase's miniature-vase fragment models with visible blue-and-white porcelain
   shards. Check actual fragmentation, graphics budgets and cleanup, and refresh affected media.
4. Review the branch and current code for concrete problems; inspect root files and move only
   suitable tool configuration while preserving standard discovery and CI behavior.
5. Update active documentation and tasks, review the complete diff, run full verification and
   REUSE, then commit the finished changes with an appropriate version bump.

## Painted landscapes and release — November 2026

1. Recheck homing with real controls, collision and a moving target. Investigate the tree in water
   against the actual rendered hill triangles and the water surface; reproduce and correct it.
2. Design a brush editor beside the setup preview with drawing, erasing, reset, cancel and apply.
   Convert the sketch deterministically into destructible terrain, including floating islands.
3. Validate playable spawn space for all selected buddies; do not silently replace the drawing or
   start an unplayable match. Keep the preview and match terrain identical, including walls.
4. Validate stored sketches, pointer input and cancellation; translate all text, preserve settings,
   cover core and browser flows, and review malformed, empty and crowded sketches.
5. Update documentation and affected media, review the changes, run the full verification and
   REUSE checks, bump the minor version, commit, push and publish the public release and Pages.

Status and delivery versions live in [tasks.md](tasks.md). Architecture is documented in
[ARCHITECTURE.md](ARCHITECTURE.md). This is the execution plan for the current user requests.

## 1. Audit and reproduce (T152 — delivered in 1.83.1)

Review current implementation of Firefox fire visibility, explosions, napalm, directional torch,
particle cleanup, default rope, two-use platforms, Sudden Death water, walking, jumping, falls
and drilling. Existing core baseline: 313 tests, 99.68% statements, 98.13% branches,
100% functions, 99.90% lines. Keep all four metrics above 98%; measure actual coverage.
Run browser checks across resolutions and Firefox where available. Record limits honestly.

## 2. Competent AI (T153 — delivered in 1.79.0)

Reproduce nearby crate failures before editing. Replace sky-only walking checks with physics
simulation of the buddy's actual floor, steps and jumps. Account for mines in two dimensions,
water, fire and hard falls. Do not let a weak unreachable enemy veto an easy pickup. Reserve
attack time, replan after pickups, stop retrying failed routes and reposition for a better shot.

Replace speculative rope use with simulated hook launches and completed traversal checks. Use
consistent steering in planning and play; release once, preserve momentum, brake near the goal,
and avoid dangerous drops. Normal should play like a person with several games of experience:
safe supplies, basic jumps, useful attacks, awareness of friends and hazards. Easy retains larger
errors; Hard searches more accurately. Outcome tests must assert pickup/landing/attack, not only
that a hook was fired or the buddy moved.

## 3. Melee wall damage (T155 — delivered in 1.80.1)

Verify existing punch wall/ceiling carving. Give the bat a useful terrain carve radius. Rock is
destructible; arena borders and placed boards retain their existing indestructible rules. Test
wall strikes, misses and victims beside walls in core and browser.

## 4. Jetpack (T154 — delivered in 1.81.0)

Append a default inventory tool without changing existing hotkeys. Space activates; arrows
accelerate directionally for six seconds. Cap velocity; after fuel runs out, limit descent speed
until landing and return to aiming so the buddy can attack. Space can stop thrust early. Terrain,
water, turn timeout, damage and death must work. Show a 3D pack, fiery downward exhaust and fuel
remaining; translate controls and descriptions in all languages. Verify normal/heavy gravity,
collision, fuel, pickups in flight, safe landing and another weapon afterwards.

## 5. Adaptive terrain and wall preview (T156 — delivered in 1.80.0)

Seed selects a layout and its parameters: broad plains, solid cave-free rolling landscapes,
clustered islands, or mixed cavernous terrain. Vary height, widths, number and spacing rather than
always stamping caves and floating ledges. Adapt geometry to arena dimensions. Preserve seeded
reproducibility, enough safe separated spawns and headroom. Preview uses the exact same terrain;
toggling walls repaints visible side barriers without changing the seed. Test seed matrices,
dimensions, topology, spawn clearance and browser preview/match consistency.

## 6. Homing rocket (T157 — delivered in 1.82.0)

Crate-only weapon with one use per pickup. Click an enemy to lock it, then aim and charge like a
bazooka. First three seconds are ballistic. Afterwards track that buddy's current location in a
straight line, with ordinary swept collision against walls, buddies and crates. If the target
is gone, continue straight. Never fly through intervening rock. Give AI a target-aware simulation,
show the selected target, translate instructions and test timing, walls, target loss and crate use.

## 7. Tag-team factions (T158 — delivered in 1.83.0)

Optional mode, off by default. Assign teams to editable factions in setup; a single team can be its
own faction. Keep normal team turns and inventories. All living teams in one faction win together
when opposing factions are eliminated. Friendly fire remains active. AI values faction allies as
friends. Persist names/assignments with validation and show the faction in HUD/victory. Cover
eliminated allies, multiple winners, draws, free-for-all compatibility and the complete setup flow.

## 8. Review, verification and public release (T159 — delivery version 1.83.1)

Update AGENTS.md with the user's version ownership: never reset to 1.0.0; only the user makes that
change. Use atomic Conventional Commits, bump the current version and update changelog/tasks with
each. Run `npm run verify` before every commit; fix concrete review findings and write resolutions
in review.md. Keep tests meaningful and preserve >98% core coverage without excluding new behavior.
Update README, VISION and architecture for new features. After the complete batch is committed
and verified, push, publish one final version tag and confirm the public release and deployment.

## Final review follow-through — 1.83.1

All implementation sections above are delivered. Final AI review additionally separates human
aircraft approach input from AI walking, shares proactive jump control between planning and play,
requires safe grounded route completion and checks retreat terrain before walking. Lethal friendly
fire remains active without earning enemy-kill awards. Coverage is enforced above 98% with a
98.1% threshold for all four core metrics. Firefox fire audit and screenshots are retained.
The authorized final release tag publishes the static build, checksum and playable Pages site.

## Media and documentation refresh — execution plan (T160–T163)

1. **Audit (completed).** Review every tracked Markdown document and media reference against
   current source, settings and release facts. Keep dated history accurate; label historical
   material and repair its links rather than rewriting the past.
2. **Capture tooling (completed).** Use deterministic scenes and real game actions. Assert that each weapon
   actually acts, report browser errors, and record capture provenance. Add scripted feature
   clips for terrain families, allied factions, rising water and improved AI where useful.
3. **Regenerate media (completed).** Refresh every game screenshot, all weapon GIFs, the battle GIF, Firefox
   evidence, the history chart and social video/poster assets against the current production build.
   Inspect representative frames and check frame counts, durations and referenced files.
4. **Update documentation (completed).** Correct stale gameplay, controls, architecture, testing, performance,
   media instructions and document indexes. Check local links across all Markdown, including
   archives and social copy; document the review and remaining limits.
5. **Verify and deliver.** Run the full verification and REUSE gates, review the complete diff,
   commit a versioned documentation/media refresh, push it and confirm GitHub CI.

Capture review also found unreadable faction-name fields (T163). Explicit dark input styling and
a browser contrast check fix the issue; setup images and faction/social clips are recaptured.
All 56 assets have decoded format/hash records, and all 23 Markdown documents are reviewed.
The final delivery gate verifies the exact staged tree before committing and pushing 1.83.2.

## Dependency update and release — 15 October 2026 (T164)

1. Check every direct dependency and override against the npm registry; confirm stable, exact pins
   and compatibility with the Node 24 runtime and the type-aware linter.
2. Update Playwright to 1.64.1 and typescript-eslint to 8.71.2, reinstall and inspect the lockfile.
   Retain Node 24 typings and TypeScript 6 while the latest linter excludes TypeScript 7.
3. Review the dependency diff and audit results; run the complete verification and REUSE gates.
4. Commit version 1.83.3, push master and its single release tag, then confirm the published archive,
   checksum and Pages deployment. The user explicitly authorized pushing and releasing.

## November dependency and weapon investigation (T167–T169)

1. Base the update on current master in an isolated checkout; preserve the unmerged Gource branch.
   Check every npm dependency/override against the registry, retain supported compiler/runtime
   versions, run the complete gate, then make one dependency commit and push it first.
2. Reproduce the homing problem through real player input before changing the rules. Compare the
   launch, target selection and guidance with Team17’s Worms 2 guide and Armageddon manual.
   Preserve the requested ballistic opening and terrain collision; supply one rocket in the
   normal starting inventory. Cover both the interface and the actual flight outcome.
3. Review all selectable weapons against their documented damage and intended physical behavior.
   Check launch/charge, knockback, terrain and body hits, fuses, repeated shots, tools and stock.
   Record deliberate balance differences from Worms and fix reproducible defects with outcome tests.
4. Update gameplay instructions, translations and affected media; review the changes, retain all
   four core coverage metrics above 98%, run full verification before each atomic commit, and push
   the completed fixes.

The next dependency version is 1.83.6: 1.83.4 and 1.83.5 already label the preserved local media
commits, while current master contains an independent 1.83.4 security update.

Dependency work is verified and pushed as 62b4c55. Player-input reproduction found zero initial
homing stock, an overly precise world-space click test, and a normal charged shot ending after
2.08 seconds before the old three-second delay. The fix uses a one-second ballistic opening,
screen-space buddy picking and normal starting stock. The arsenal audit additionally verifies
actual damage/knockback and tools, corrects damage help, enables live burst aiming, and aligns
returning-rocket predictions with owner collision. Full verification passed with 428 unit tests
and 86 browser tests; Firefox and refreshed media checks passed. See [review.md](review.md) for
the measured coverage and complete arsenal findings.
