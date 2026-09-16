# Code review — full codebase

```text
Base: v1.17.5 (last release) @ 199d2d6   Head: 68f6d11
Files changed since the release: 77   +6644 / -800 lines
```

Scope: the whole current code (`src/`, `tests/`, `e2e/`, `scripts/`, CI), with extra attention on
what changed since the v1.17.5 release. `master` is the only branch, so there is no merge-base to
diff against; the release tag is used as the reference point. Every finding below was checked
against the file contents.

## Findings

```text
#1  MEDIUM  Code  src/ui/settings.ts:61
    parseSettings promises that a stored entry "can never break the setup screen", but it only checks team names, colours and buddy-name counts: a stored aiLevel outside easy/normal/hard makes LEVELS[level] undefined and AiDriver.update throws on every frame, and a non-string buddy name crashes esc() while rendering the setup. Validate every field that is used (controller, aiLevel, buddy-name strings, retreat/turn times, crates, arsenal) and fall back to defaults field by field.

#2  MEDIUM  Architecture  src/core/game.ts:231
    The in-turn action is still spread over six independent fields (sheep, flyer, burst, drill, torch, drops) plus phases in a 1100-line Game; every timed weapon adds a field, a step method, cleanup lines in beginTurn/endTurnEarly and phase handling, and nothing prevents two actions being active at once. Model the current action as one discriminated union with a single step/cleanup path, keeping read-only accessors for the renderer and HUD.

#3  MEDIUM  Architecture  src/app.ts:195
    Presentation is keyed by hard-coded weapon ids across modules — flight sound kinds (app.ts:195), fire sounds (app.ts:245), projectile models (render/effects.ts:654), held models and muzzle rules — so a new projectile silently gets a grenade model and the wrong sound. Declare presentation keys (flight sound, fire sound, projectile model) in the weapon table and look them up generically.

#4  LOW  Code  src/app.ts:116
    Every started match calls menu.setDraft, which now persists the config, so playing a Quick Match (random teams, default options) overwrites the custom setup the player saved for next time. Persist only matches started from the custom setup (and their restarts), keeping Quick Match out of the saved draft.

#5  LOW  Code  src/core/ai.ts:165
    The AI scores every strike weapon as if its payload lands on the chosen target, but the napalm strike is deliberately not wind-aimed (strike.windAimed = false), so in wind the AI's napalm drifts far off and its expected score is wrong. Offset the AI's target by the napalm's wind drift (the same fall-time maths planStrike uses).

#6  LOW  Code  src/core/game.ts:645
    New crates avoid living buddies and other crates but not tombstones, so a crate can teleport into a grave on the same spot. Include grave bodies in the occupied list.

#7  LOW  Code  .github/workflows/pages.yml:9
    The Pages deployment runs on any v* tag with lint, typecheck and unit tests but without the Chrome E2E suite and independently of the CI result for that commit, so a tag on a commit with failing E2E tests still goes live. Run the E2E suite in the Pages build job (or gate deployment on a successful CI run for the tagged commit).

#8  LOW  Code  tests/game.test.ts
    The AI's use of the drill and the napalm strike has no test (every other AI weapon choice is covered), so regressions in DRILL_REACH or strike scoring for napalm go unnoticed. Add planAttack tests for an enemy buried below and for a napalm strike in wind.

#9  LOW  Code  scripts/capture-media.mjs:123
    The napalm scene sets `bannerTime` on the World, which has no such field (it lives privately in Hud), so the "Retreat!" banner still covers the screenshot. Wait until the banner has faded (it lasts 1.8 s) instead of poking a non-existent field.
```

## Resolution

| #   | Status                                                                                                                                                               | Version |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **Fixed:** every stored field is validated and falls back to its default on its own; unusable teams fall back to the default teams; unit test with tampered entries. | 1.26.5  |
| 2   | **Fixed:** the action in progress is one `TurnAction` union stepped by `stepAction`; read-only accessors keep the renderer, HUD and tests unchanged.                 | 1.26.13 |
| 3   | **Fixed:** `WeaponDef.look` declares projectile model, flight/fire/shot/hit sounds, muzzle flash and camera follow; a unit test requires them for every projectile.  | 1.26.12 |
| 4   | **Fixed:** only the custom setup is persisted; the E2E settings test plays a Quick Match before reloading.                                                           | 1.26.6  |
| 5   | **Fixed:** `strikeWindShift()` gives the drift of payloads that are not wind-aimed; the AI aims upwind and scores the real landing spot.                             | 1.26.8  |
| 6   | **Fixed:** tombstones count as occupied spots for crate drops; unit test fails without the fix.                                                                      | 1.26.7  |
| 7   | **Fixed:** the Pages workflow runs the Chrome E2E suite before deploying.                                                                                            | 1.26.10 |
| 8   | **Fixed:** AI tests for drilling onto a buried enemy and for the wind-aware napalm strike.                                                                           | 1.26.8  |
| 9   | **Fixed:** the capture script lets the banner fade before the napalm screenshot.                                                                                     | 1.26.9  |

While fixing, the human-turn E2E test turned out to depend on Quick Match's random map (a jump could
land in the water); it now continues on a fixed map (1.26.11).

## Verdict

No crash or data loss in normal play; #1 can break the game from a bad stored entry and #2/#3 are
the design debt most likely to cause bugs with the next weapons. Fix #1–#6 and #8–#9 now; #7 is a
delivery safeguard worth adding before the next release.
