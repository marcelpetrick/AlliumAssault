# Code review — full codebase

```text
Base: master @ 8d53652 (only branch, so no merge-base to diff against)   Head: 8d53652
Files reviewed: 43 source, test and script files   ~9,200 lines in src/
```

Scope: the whole current game, as requested, rather than a branch diff — `master` is the only
branch. Every finding below was checked against the file contents, and the four suspicions listed
under "Checked and dropped" were measured rather than guessed at.

## Findings

```text
#1  HIGH  Code  src/core/ai.ts:193
    The AI's blowtorch plan sets aim: me.aim (typically 0.5 rad, about 29° up) while its
    reachability test assumes a level tunnel — it only considers enemies within 1 unit of its own
    height and within TORCH_SPEED * fuse horizontally. Since 1.30.0 the torch burns along the aim
    line, so the AI digs up over the enemy it planned to reach. The torch plan must aim level.
```

```text
#2  MEDIUM  Architecture  src/core/game.ts:262
    Game exposes projectiles, crates, graves, flames, drops, action, weapon, charge and the whole
    turn state as public mutable fields, so "the renderer reads core state and never changes rules"
    holds by convention only, and tests and E2E specs already reach in and mutate them. Expose the
    collections as readonly views and keep mutation behind methods.
```

```text
#3  LOW  Code  src/app.ts:413
    Every pointermove calls world.setPointer(), which allocates a Matrix and builds a full picking
    ray, although the result feeds only the strike cursor — which needs an aiming human turn with a
    strike weapon selected. It ran in the title-screen demo and behind open menus too. Gate it.
```

```text
#4  LOW  Code  src/main.ts:125
    document.getElementById('stage') as HTMLCanvasElement casts away a possible null, the exact
    pattern the project invariant forbids ("no non-null assertions in src"), and dom.ts already has
    queryAs() for it. A missing #stage would surface as a confusing Babylon error instead of a
    clear one.
```

## Checked and dropped

Measured, found harmless, and therefore not reported as findings:

| Suspicion                                                       | Measurement                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `findSpawnCandidates` scanning the whole map inside `beginTurn` | 1.16 ms per call — not a turn-start hitch                          |
| Buddies spawning stacked when `pickSpawns` cannot separate them | 25 seeds × 16 buddies: every pair separated; the reseed loop works |
| `Decorations.clearAround` scanning every prop per explosion     | one prop per column, about 145 in total                            |
| The new napalm fire's particle load                             | ~23 % extra frame cost while burning, capped by the emit rate      |

## Resolution

| #   | Status                                                                                                                              | Version |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **Fixed:** the AI aims the blowtorch level; a unit test plans a torch attack with a raised aim left over and fails without the fix. | 1.32.2  |
| 2   | **Open (accepted debt).** See below.                                                                                                | —       |
| 3   | **Fixed:** the pointer is only picked while a human is aiming a strike weapon with no menu open.                                    | 1.32.2  |
| 4   | **Fixed:** `queryAs(document, '#stage', HTMLCanvasElement)`.                                                                        | 1.32.2  |

### Why #2 stays open

A shallow `readonly` on the arrays would not actually close the hole: the elements stay mutable, so
a renderer could still write `projectile.x`. Closing it properly means read-only view types threaded
through `World`, `Effects`, `Hud` and `AiDriver`, plus replacing the direct mutation the unit tests
and the E2E helpers rely on to set up scenarios. That is a refactor worth its own branch and its own
verification pass, not a tail-end change. Recorded here so the next weapon does not widen it.

## Verdict

Mergeable. #1 was a real regression from the directional blowtorch (1.30.0) and is fixed; #3 and #4
are small and fixed alongside it. #2 is design debt with no defect behind it today.
