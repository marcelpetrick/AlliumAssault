# Implementation plan — October 2026

Status and delivery versions live in [tasks.md](tasks.md). Architecture is documented in
[ARCHITECTURE.md](ARCHITECTURE.md). This is the execution plan for the current user requests.

## 1. Audit and reproduce (T152)

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

## 4. Jetpack (T154)

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

## 6. Homing rocket (T157)

Crate-only weapon with one use per pickup. Click an enemy to lock it, then aim and charge like a
bazooka. First three seconds are ballistic. Afterwards track that buddy's current location in a
straight line, with ordinary swept collision against walls, buddies and crates. If the target
is gone, continue straight. Never fly through intervening rock. Give AI a target-aware simulation,
show the selected target, translate instructions and test timing, walls, target loss and crate use.

## 7. Tag-team factions (T158)

Optional mode, off by default. Assign teams to editable factions in setup; a single team can be its
own faction. Keep normal team turns and inventories. All living teams in one faction win together
when opposing factions are eliminated. Friendly fire remains active. AI values faction allies as
friends. Persist names/assignments with validation and show the faction in HUD/victory. Cover
eliminated allies, multiple winners, draws, free-for-all compatibility and the complete setup flow.

## 8. Review, verification and public release (T159)

Update AGENTS.md with the user's version ownership: never reset to 1.0.0; only the user makes that
change. Use atomic Conventional Commits, bump the current version and update changelog/tasks with
each. Run `npm run verify` before every commit; fix concrete review findings and write resolutions
in review.md. Keep tests meaningful and preserve >98% core coverage without excluding new behavior.
Update README, VISION and architecture for new features. After the complete batch is committed
and verified, push, publish one final version tag and confirm the public release and deployment.
