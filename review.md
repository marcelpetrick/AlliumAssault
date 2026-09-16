# Branch review

```
Base: master @ dfafe26 (v1.1.11, origin/master before this work)   Head: 87783b5
Files changed: 34   +3947 / -206 lines
```

`master` is the only branch, so the merge-base with itself is HEAD. The review uses the last
published state before this work, v1.1.11 (`dfafe26`). `origin/master` has since moved to
`f5212d8`, partway through the work. Resolved findings are marked **(fixed in x.y.z)**.

## Findings

```
#1  MEDIUM  Code  src/core/ai.ts:102
    planAttack now tries every projectile, strike, melee, sheep, flyer, torch and self-destruct option synchronously inside Game.step, taking 57–90 ms per decision (measured in Node, hard AI, full arsenal; 14–34 ms with the original four weapons), so every AI turn freezes the frame for several frames. Budget the search (fewer samples for limited-ammo weapons, early exit on lethal plans) or spread it over several steps.

#2  MEDIUM  Architecture  src/core/ai.ts:117
    Weapon behaviour is keyed by hard-coded weapon ids spread over many modules: the AI candidate lists (ai.ts:117, 145, 203), flight-sound kinds (src/app.ts:175), projectile models (src/render/effects.ts:521), held models, muzzle and sound switches. A new weapon silently gets no AI use, no sound and a default grenade model unless eight files are touched. Derive AI candidates from WeaponDef.kind and move model and sound keys into the weapon table.

#3  MEDIUM  Architecture  src/core/game.ts:877
    The in-turn action state is five independent nullable fields (sheep, flyer, torch, burst, drops) plus phases, and the list of "active buddy can end the turn" phases is copied in damage() (877), drown() (885), `acting` (281) and the per-phase timers in stepPhase, which has no 'firing' case. Every new timed weapon has to update all of them consistently. Model the current action as one discriminated union with its own step, detonate and cleanup.

#4  MEDIUM  Code  src/core/ai.ts:170
    The AI releases the flying sheep with a fixed aim of 0.8 rad toward the nearest enemy without checking the path. Under an overhang or next to a wall, stepFlyer reports a hit on the first sub-steps and the sheep explodes (75 damage, radius 4) right beside the AI's own buddy. Trace the first metres of the launch (as simulateShot does) and skip or re-aim blocked launches.

#5  MEDIUM  Code  .github/workflows/pages.yml:37
    GitHub Pages is not enabled for the repository (`GET /repos/…/pages` returns 404), so configure-pages/deploy-pages fail on every release tag until Pages is switched to "GitHub Actions" in the repository settings. Enable Pages before the first tagged release, or pass `enablement: true` with a token that is allowed to.

#6  LOW  Code  src/app.ts:189
    The last-seconds tick only sounds in the 'aiming' phase, but the turn timer keeps running and the HUD timer turns urgent (src/ui/hud.ts:145) while guiding a sheep. The audio cue goes missing exactly when the player is racing the clock. Tick in every phase that counts down turnTimeLeft.

#7  LOW  Code  src/render/world.ts:183
    During an air strike the camera saves the zoom and restores it 4.5 s later (world.ts:225), overwriting any zoom the player chose meanwhile. Restore only if the zoom still matches the forced value, or zoom out through a temporary offset instead.

#8  LOW  Architecture  src/core/game.ts:237
    With `arsenal: 'crates'` special weapons start empty, but only the setup screen (src/ui/menu.ts:290) makes sure crates are enabled. Any other MatchConfig source (tests, test hook, a future preset) can build a match where special weapons can never appear. Enforce the invariant in Game (or in one config normaliser) rather than in the menu.
```

## Resolution (1.17.4)

| # | Status |
|---|---|
| 1 | **Fixed (mostly):** limited-ammo projectile weapons search a coarser grid; a full-arsenal decision dropped from 69 ms to 48 ms (bazooka + grenade alone: 34 ms). Spreading the search over several frames stays open if needed. |
| 2 | **Partly fixed:** AI candidates now come from `WeaponDef.kind` (projectile, strike, melee), so new weapons of those kinds are used automatically. Sounds and models are still keyed by id. |
| 3 | **Open:** design debt; worth doing before the next timed weapon. |
| 4 | **Fixed:** the AI only launches the flying sheep along a path that clears the blast radius; test added. |
| 5 | **Fixed at release:** Pages is enabled with the GitHub Actions source before the release tag is pushed. |
| 6 | **Fixed:** the clock ticks, and the HUD timer turns urgent, while guiding and torching too; E2E test added. |
| 7 | **Fixed:** the forced strike zoom is only undone if the player did not zoom meanwhile. |
| 8 | **Fixed:** the game drops crates at the default chance when the arsenal is crates-only and no crate chance is set; test added. |

## Verdict

Every feature works and is covered by unit and Chrome E2E tests; nothing here corrupts matches.
Fix #5 before the first release that relies on Pages, and #1 and #4 are the user-visible ones
worth fixing before release. #2 and #3 are design debt that grows with each new weapon.
