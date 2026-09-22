# Changelog

All notable changes to this project are documented here. Versions follow SemVer.

## [1.72.2] — 2026-09-22

### Changed

- **About is a real button on the title screen.** It was a ghost button — transparent, borderless,
  muted text — tucked under three full-size ones, so it read as a footnote rather than a choice. It
  is now the same 300×58 button as Custom Match and How to Play. Big buttons also got a fixed line
  height, because `ℹ` has taller metrics than `⚙` and `❔` and was making its own button three
  pixels taller than the rest of the stack.

## [1.72.1] — 2026-09-22

### Changed

- `typescript-eslint` 8.70.0 → 8.70.1. Every other dependency was already on its latest stable
  release. TypeScript stays at 6.0.3 and `@types/node` at 24.13.6: the newer majors of both are
  held back on purpose, and both pins are the newest release inside the range they are allowed —
  `typescript-eslint` still declares `typescript >=4.8.4 <6.1.0`, and the runtime here and in CI is
  Node 24.

## [1.72.0] — 2026-09-22

Public release. What is new since 1.68.0.

### The scoreboard

- **It speaks all four languages.** It never did: the core built its award titles as English
  sentences, where no catalogue could reach them. Awards now carry an id and their numbers, and the
  interface supplies the words — and the compiler refuses to build if an award is missing words in
  any language.
- **It says more, in colour.** Green for what went well, red for what did not. Blunders have their
  own board beside the honours. New counts: how many drowned, how many were blown up, how many
  pressed their own detonator; every weapon ranked by use; and the tools ranked separately.
- Two new awards: most knocked out, and tool of the match.

### Playing

- **The aim answers while a shot is charging** — at 45% of the usual speed, so it is a last-minute
  correction rather than a second chance to aim.
- **Buddies can be renamed**, the way the team already could, and the names are remembered for the
  next match.
- The map-seed field and its dice button are half again as large.

### Also

- The help screen's key map and the whole About screen were untranslated too. Both follow the
  setting now.
- `docs/I18N.md` explains how the translations work and the rule behind them: the core may never
  hold a player-facing sentence.
- The README listed the flamethrower twice. It does not now, and four tests hold the weapon table to
  the code and sweep every document for a repeated row.
- `docs/ARCHITECTURE.md` is back in step with the code after the 1.56–1.68 run.
- Tests that pin down what the blowtorch does to a buddy it walks into, which was correct all along
  but only guaranteed at point-blank range.

## [1.71.1] — 2026-09-22

### Fixed

- **An award without words would have blanked the whole scoreboard.** The screen built its
  catalogue keys from the award id with a cast, so a new award nobody had translated would have
  reached `t()` with a key that has no English behind it and thrown in the middle of rendering. The
  award ids are a named union now and the cast is gone, which means the compiler checks that every
  award has a title and a detail in every language — remove one and the build fails, in all three
  catalogues at once.

## [1.71.0] — 2026-09-22

### Added

- **Buddies can be renamed.** Each one in the setup screen is now a field, the way the team name
  already was, and the names are saved with the rest of the setup — so the next match starts with
  the team you named last time. Clearing a field falls back to a default rather than leaving a
  nameless buddy in the HUD.

### Changed

- The map-seed field and its dice button are half again as large. They are the two most-used
  controls on the setup screen and were the smallest.

## [1.70.0] — 2026-09-22

### Added

- **The aim answers while a shot is charging.** Up and down used to do nothing once Space was held,
  which is exactly the moment a player notices the shot is two degrees off. They work now, at 45% of
  the ordinary speed: enough to fix the two degrees, not enough to swing a quarter turn without
  letting go — holding Space should still be a commitment. The key map says so.

## [1.69.1] — 2026-09-22

### Added

- **`docs/I18N.md`**: how the four languages work — the two modules and why they are split, adding a
  string, adding a language, the rule that the core may never hold a player-facing sentence (with
  the scoreboard as the worked example of what happens when it does), where the language is stored,
  and what each test enforces. Linked from the docs index and from `AGENTS.md`, which now carries
  the rule itself.

## [1.69.0] — 2026-09-22

### Fixed

- **The statistics screen was English in all four languages.** The cause was architectural: the core
  built award titles and details as English sentences, where no catalogue could reach them. Awards
  now carry an id, an icon, who earned it and the numbers behind it, and the interface turns those
  into a sentence in whichever language it is speaking. A weapon award carries the weapon's id
  rather than its English name, for the same reason.
- The help screen's key map and the whole About screen were also untranslated. Both follow the
  setting now; the physical key names (`Enter`, `Space`, `Backspace`) stay as they are printed on
  the keyboard, and so do proper nouns, URLs and licence identifiers.

### Added

- **The scoreboard says more, and in colour.** Green for what went well, red for what did not, each
  team's own colour beside its name. Blunders have their own board beside the honours. New counts:
  how many drowned, how many were blown up, how many pressed their own detonator; every weapon used,
  ranked; and the tools — rope, blowtorch, drill, platform, teleport, flamethrower — ranked
  separately, because reaching for a tool is a different kind of decision.
- Two new awards: most knocked out, and tool of the match.
- 61 new catalogue keys in each of the four languages, and a browser test that plays an AI duel in
  German and fails if a single English heading, award title or column name survives on the screen.

## [1.68.3] — 2026-09-22

### Added

- Tests for what the blowtorch does to a buddy. It already burnt anyone it walked into for 15 and
  shoved them upwards, and it already made no distinction between friend and foe — but only the
  close-range case was covered, so none of that was guaranteed. Now the whole three-second walk is:
  caught at four units and at eight, untouched at twelve, shoved as it burns, and a teammate in the
  way burns exactly like an enemy.

## [1.68.2] — 2026-09-22

### Fixed

- **The README listed the flamethrower twice.** A botched edit inserted the row once, failed
  partway, and inserted it again on the retry. One row, with the fuller wording, remains. The rest
  of the table was already in the weapon bar's own order and is unchanged.

### Added

- Tests that hold the README's weapon table to the code: every weapon exactly once, in the order the
  weapon bar shows them, with the hotkey the game binds and the ammo the weapon table gives out —
  and a sweep of every Markdown file in the repository for a table row repeated inside one table.
  All four fail if the duplicated row is put back.

## [1.68.1] — 2026-09-22

### Changed

- **`docs/ARCHITECTURE.md` brought back in step with the code.** The C4 model had drifted over the
  1.56–1.68 run: the component diagrams now name `stats.ts`, `quality.ts`, `i18n.ts`,
  `i18nWeapons.ts`, `settings.ts` and `dom.ts`; the state machine shows the `spraying` phase the
  flamethrower introduced and the `roping` phase that had never been drawn at all; the explosion
  flow shows chained crates leaving fire and damage being booked against whoever caused it; and the
  AI flow shows the cost that keeps it off one weapon and the rope trip it now takes to reach a
  crate. Added the import rules that a unit test enforces, the coverage and profiling gates, and
  three key decisions that had gone unrecorded. All nine diagrams were rendered to check they parse,
  and the AI planning cost was re-measured rather than repeated from memory — 30 ms, not 50.

## [1.68.0] — 2026-09-22

Public release. Everything below since 1.55.1, in one page.

### Weapons and things on the map

- **Flamethrower** (F, two per match): three seconds of lit fuel out of a nozzle you keep steering
  with up and down while it runs. Wind and gravity carry the gobs, and where they land the ground
  goes on burning — a carpet to drive somebody across rather than a gun to kill them with.
- **Ming Vase** (V, one per match): six hundred years of porcelain, thrown once, for an enormous
  blast and eight shards that each land like a grenade.
- **Mystery boxes**: a clown box with a question mark, rolled when it is opened rather than when it
  drops. Health, a special weapon, or a live mine armed on the spot under whoever was greedy.
- Crates caught in a blast leave their contents burning; napalm lays a shallow carpet instead of
  digging a trench; the garlic punch wears a real boxing glove and, thrown steeply upwards, knocks
  a shaft through the ceiling; the drill hammers like a jackhammer; the sheep is half again as
  large; and a connecting baseball bat brings a stadium with it.

### Seeing what you are doing

- **A blue cross marks where a teleport will put you**, red where the buddy would not fit — the
  cursor asks the game the same question the click does.
- **A statistics screen** at the end of a match: damage dealt and taken per team, own goals, shots
  and accuracy, a line per buddy, and twelve awards from Most Valuable Buddy to Butterfingers.
  Damage is attributed through chained crates and mines, so it credits whoever actually did it.
- **Four languages** — English, German, Croatian as it is spoken in Split, and Mandarin — chosen in
  the setup screen, guessed from the browser the first time, and covering every menu, hint, banner
  and weapon.
- The setup screen keeps **Start Battle** on screen however far the options scroll, and puts the map
  seed beside the picture it makes.

### The opposition

- The AI **stops leaning on the concrete mule**: what a weapon costs to reach for grows with use and
  with scarcity, and a cluster weapon is priced by its whole payload, so a match now sees six to
  eight different weapons instead of two.
- Normal and Hard **go shopping**: when a crate is somewhere walking cannot reach and there is rock
  overhead, they fire the rope, swing across and drop onto it.

### Under it

- A quarter of the bundle it was: 6,889 kB down to 1,510 kB, and 374 kB over the wire.
- Settings carry a schema version and migrate, so a config written by an older build still opens.
- 244 unit tests and 68 browser tests; 99.6% of the rules core's statements and 98.1% of its
  branches, above the thresholds the build enforces.

## [1.67.1] — 2026-09-22

### Fixed

- **The weapon bar keeps to two rows.** With twenty-three weapons it wrapped to eleven, eleven and
  one, leaving a single slot marooned on a third row. The column count is now half the arsenal
  rounded up, taken from the weapon table, so adding a weapon rebalances the bar instead of starting
  a new row.
- The HUD's Help and Pause buttons kept their plain accessible names when the labels were
  translated; a screen reader was being offered "❔ Help" and the title text as the button's name.

## [1.67.0] — 2026-09-22

### Added

- Nothing of its own: the version bump that closed the batch below. The release it was meant to
  carry went out as 1.68.0, after two more fixes the browser suite turned up.

## [1.66.2] — 2026-09-22

### Fixed

- The browser test that grabs a crate only knew about health and weapon crates, so it failed the
  moment a mystery box happened to be the one that dropped. It now checks all three: healed, armed,
  or standing on a live mine.

## [1.66.1] — 2026-09-22

### Changed

- **The repository root holds three Markdown files instead of eight.** `README.md`, `CHANGELOG.md`
  and `AGENTS.md` stay where a visitor and a tool expect them. `CONTRIBUTING.md` and `SECURITY.md`
  moved to `.github/`, which is where GitHub looks for them anyway; `tasks.md`, `review.md` and the
  touch-display study moved into `docs/`, which now has an index listing every document and what it
  is for.

## [1.66.0] — 2026-09-22

### Added

- **Four languages.** English, German, Croatian and Mandarin, chosen in the setup screen beside
  Graphics and remembered with the rest of the settings. The first time a player arrives, the
  browser's own language decides. Menus, the HUD, every hint and banner, and all twenty-three
  weapons' names and descriptions follow the setting; the choice repaints whatever screen is open,
  and the HUD picks it up when the next match starts.
- The Croatian is written the way it is spoken in Split — the Dalmatian ikavica and the čakavian
  habits that go with it: *vrime* not *vrijeme*, *di* not *gdje*, *biž* not *bježi*.
- English is the source of truth and holds every key; the other catalogues are partial and fall
  back to it, so a gap shows English words rather than an identifier. Tests walk all four
  catalogues and fail on a missing key or an untranslated weapon.

## [1.65.1] — 2026-09-22

### Added

- Tests for the edges of the AI's new rope fetch: the crate blown up mid-swing, the drop onto a
  crate it is hanging over, and the swing that has run out of patience. Core coverage is back above
  the enforced thresholds on all four measures.

## [1.65.0] — 2026-09-22

### Added

- **A statistics screen at the end of a match.** The victory screen now leads to a scoreboard: a
  per-team table of damage dealt and taken, own goals, shots and accuracy; an honours board; and a
  line for every buddy. The awards include the most valuable buddy, the biggest single blow, the
  own goal of the match, the deadeye and the butterfingers, the crate hoarder, who went swimming,
  who came through without a scratch, who never fired a shot, the weapon of the match, how much of
  the island was blasted away, and how long it all took. An award nobody earned is left out
  entirely, so a short quiet match shows three lines rather than a dozen empty ones.
- Damage is now attributed: every blast carries the buddy that caused it and the weapon that made
  it, all the way through chained crates and mines, so the scoreboard credits the player who did
  the damage rather than whoever happened to be taking the turn.

## [1.64.0] — 2026-09-22

### Changed

- **The AI stops leaning on one weapon.** What a weapon costs to reach for now depends on how often
  this team has already used it, on how little is left, and — for a cluster weapon — on its whole
  payload rather than just its first blast. The concrete mule used to win from almost anywhere and
  be played every turn until it ran out; over a full match the AI now reaches for six to eight
  different weapons and no longer opens every game with the biggest thing in its bag.
- **Normal and Hard go shopping.** They already valued crates; now they can get to the ones that are
  not simply along the ground. When a crate is out of walking reach but there is rock overhead to
  hook, they fire the rope, swing across, reel in and let go over it. The attempt is abandoned after
  nine seconds however it is going, so a traversal that is not working can never eat a turn. Easy
  is untouched: not thinking about crates is part of what makes it Easy.

## [1.63.0] — 2026-09-22

### Added

- **Mystery boxes.** A third kind of crate: a clown box in pink and yellow with a question mark
  painted on its side and a knob on the lid. What is inside is rolled when somebody opens it rather
  than when it drops, so nothing about the box on the map gives it away — a third of the time
  health, two fifths a special weapon, and the remaining quarter a live mine, armed on the spot
  with no grace period, under whoever was greedy. Seeded like everything else, so the same map
  plays the same joke twice.

## [1.62.0] — 2026-09-22

### Added

- **The Flamethrower** (F, two per match, special). Three seconds of lit fuel out of a nozzle. Up
  and down swing the nozzle *while it is running* — further than the ordinary aim allows, so you
  can hose your own feet — and each gob is a projectile that wind and gravity carry, which means
  the stream drifts and falls and never quite lands where the nozzle pointed. Where it lands it
  goes on burning, so a sweep lays a carpet of fire across the ground. Damage from the stream
  itself is deliberately mediocre: the weapon is for driving a buddy out of cover and across the
  flames, not for killing it outright.

## [1.61.0] — 2026-09-22

### Added

- **The Ming Vase** (V, one per match, special). A blue-and-white porcelain heirloom, lobbed once:
  it bursts for a five-unit blast — larger than anything but the holy grenade — and throws eight
  razor shards that each land harder than a banana fragment. It is drawn as what it is, a glazed
  vase with a cobalt band, right up to the moment it stops being one.

## [1.60.1] — 2026-09-22

### Changed

- **Napalm lays a carpet instead of digging a trench.** Three shallow bites out of the ground rather
  than four deep ones — about two thirds of the depth — and flames drawn lower and narrower. What a
  napalm strike leaves behind is now ground a buddy has to cross, not a ditch it can shelter in.

## [1.60.0] — 2026-09-22

### Added

- **A crate caught in a blast leaves its contents burning.** Two or three flames for a couple of
  seconds — enough to make the spot worth walking around, far short of a napalm strike, and never
  long enough to hold a turn up.

## [1.59.3] — 2026-09-22

### Changed

- **The drill hammers like a jackhammer.** The bit drives down and recoils eleven times a second on
  a sawtooth stroke — abrupt slam, slower recovery — the tool kicks back against it and the buddy
  rattles with the whole thing. Before, it hung there while dust came out of the ground.
- **The sheep is drawn half again as large**, so what bounds across the island reads as a sheep.
  Only the model: its collision radius and its blast are the rules' and are untouched.

## [1.59.2] — 2026-09-22

### Added

- **A stadium roars when the baseball bat connects.** Crack, then a swell of synthesized crowd noise
  with a couple of whistles riding on top — on the hit, never on a swing through thin air.

## [1.59.1] — 2026-09-22

### Added

- **The garlic punch wears a proper boxing glove** — a laced fist with a thumb, and a second glove
  held back at the chin — instead of the red ball it had before.
- **An uppercut thrown at the ceiling punches through it.** Aimed steeply upwards, the punch drives
  a shaft of discs along the aim rather than denting whatever happens to be in front of the buddy,
  so a buddy boxed in under a ledge can knock its own way out. A flat swing behaves exactly as it
  did.
- A swing now reports whether it connected, so presentation can tell a hit from a miss without
  guessing from the damage events that follow.

## [1.59.0] — 2026-09-22

### Added

- **The teleport shows where it will put you.** The air strike draws a reticle and the platform
  draws the board it is about to place; the teleport asked the player to click blind. A blue cross
  now follows the mouse while the teleport is selected, turning red over any spot the buddy would
  not fit into — inside rock, off the map, or too tight to stand in. The cursor asks the game the
  same question the click does, `canTeleportTo`, so the preview can never promise a move that the
  click then refuses.

## [1.58.2] — 2026-09-22

### Fixed

- **A crate collected by a sheep no longer floats its reward twice.** The HUD printed the pickup at
  the crate and again over the buddy that was credited, which read as two crates rather than one.
  Only the rewarded buddy's number remains, so what is on screen is what the rules did.

## [1.58.1] — 2026-09-22

### Fixed

- **Start Battle is pinned to the bottom of the setup panel.** The options are taller than any
  viewport — nearly twice the screen at Huge text — so the button that starts the match used to
  scroll away under them. It now sits on a blurred bar at the foot of the panel, wherever the
  options have been scrolled to.
- **The map seed sits beside the picture it makes.** Seed and preview were two independent cells in
  a wrapping grid and could land rows apart; they now share a row of their own, so typing a seed
  and seeing the island it produces is one motion.

### Added

- A browser test that measures the menu, the HUD, the weapon bar and the buddy name tags at every
  text size and fails unless they all grow by the same factor — the guarantee behind the Text size
  setting, now checked rather than assumed.

## [1.58.0] — 2026-09-22

### Added

- **The settings store carries a schema version.** What the browser keeps is now stamped with the
  shape that wrote it, and a migration chain brings an older blob up to the current one before the
  field-by-field validation ever sees it — so a config saved by 1.57.1, which had no version and no
  graphics setting, still opens with everything the player chose. A config written by a *newer*
  build is read for what this one understands instead of being thrown away, so opening an older tab
  no longer costs you your setup.

## [1.57.1] — 2026-09-22

### Fixed

- **The browser suite could certify a stale build.** `reuseExistingServer` was unconditional, so
  `npm run e2e` skipped its own `npm run build` whenever anything was already serving :4173 — and
  then reported green for whatever happened to be in `dist/`. It now rebuilds locally, as
  Playwright's own default does.
- **A release could publish a build the browser suite had never seen.** `release.yml` ran lint,
  typecheck, coverage and build but not `npm run e2e` — the one gate that watches the renderer
  actually run, and the one that caught the missing picking-ray import in 1.56.0. It runs it now.
- **The bundle budget could no longer fire.** `chunkSizeWarningLimit` sat at 8,000 kB, above even
  the 6.9 MB bundle the deep imports removed, so re-introducing a barrel import would have been
  silent. It is now just above the real entry chunk, and a unit test fails outright on
  `from '@babylonjs/core'` anywhere in `src`, or on a picking ray built without its side-effect
  import.
- `npm run profile` now checks each stage against a generous ceiling instead of only printing, so
  the claim that a tenfold regression is visible is one the suite actually keeps.
- `state().quality` reported the pending menu choice rather than the budget the scene on screen was
  built with; `World` now keeps its quality and answers for itself.
- Four members carried a second, stale doc comment — `get rope()` described as the flying sheep,
  `dropCrates()` as returning a boolean, `selfDestruct()` as the blast it only schedules. The
  flying sheep has its comment back.

### Changed

- The crate setting's loudest option is now called **Cratyness**.
- `Quality` and its options moved out of the Babylon-laden `world.ts` into `render/quality.ts`, so
  the settings and the setup screen no longer reach into the renderer for a string union.
- `README.md` lists `src/core/match.ts` and `bench/`; `AGENTS.md` describes the weapon hotkeys the
  code actually implements.

## [1.57.0] — 2026-09-21

### Added

- **A Graphics setting in the setup screen**, Full or Low, saved with the other settings. Full is
  the default and now spends what a desktop can afford — up to 8.3 megapixels at twice the device
  density, where the old fixed budget capped everything at 4 million pixels and 1.5× — while Low
  drops the shadow cascade, bloom and MSAA for a weak GPU. `?quality=low` in the URL still forces
  Low, for a machine that cannot get as far as the menu. The choice applies to the next match; the
  one on screen keeps the scene it was built with.

## [1.56.0] — 2026-09-21

### Changed

- **The bundle is a quarter of its size**: 6,889 kB down to 1,510 kB, and 1,522 kB down to 374 kB
  over the wire. Babylon.js was imported from its package root, a barrel that re-exports the whole
  engine and defeats tree-shaking — a probe with nothing but a box and a light still weighed
  6.71 MB. Every Babylon symbol is now imported from its own module, and the one piece of the API
  that lives on `Scene.prototype` rather than on a class — the picking ray the map-click weapons
  aim with — is asked for by name.
- `npm run profile` measures the rules core stage by stage, and `docs/PERFORMANCE.md` holds the
  numbers, the method and the tools. The core needed no optimisation: its worst ordinary case costs
  a fifth of one percent of a frame.
- `game.ts` gave up its 250 lines of types, phases and tuning constants to `src/core/match.ts`; it
  re-exports them, so no import anywhere had to change. It is now 1,392 lines and is only the turn
  state machine.

## [1.55.1] — 2026-09-21

### Fixed

- The gravity browser test measured a jump on whatever island the setup screen's random seed
  produced, so a ceiling above the buddy could make the Moon jump look no higher than a normal one;
  it failed on CI for exactly that reason. It now flattens the ground first and measures on known
  terrain.
- Dependabot no longer proposes TypeScript 7 (typescript-eslint requires `<6.1.0`) or `@types/node`
  26 (the runtime is Node 24); both majors are ignored with the reasoning written down.

## [1.55.0] — 2026-09-21

Public release. It carries everything from 1.53.1 and 1.54.0: the thematically grouped two-row
weapon bar with its new hotkeys, the minigun that finally looks like a gun, the Lemmings-style
self-destruct, the coverage gate that now actually runs, the community health files, share
metadata, reduced-motion support, refreshed documentation and re-captured screenshots.

## [1.54.0] — 2026-09-21

### Added

- **Self-destruct takes its Lemmings moment.** Pressing the detonator no longer blows the buddy up
  on the spot: it panics for three seconds with "Oh no!" and a ticking countdown over its head,
  shaking and swelling, and only then takes the hillside with it. Nothing stops it once started.
- `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig` and a Dependabot configuration.
- Share metadata (description, Open Graph, theme colour), so a posted link shows the game.

### Changed

- **The weapon bar is two rows, grouped by kind**: launcher and thrown family, guns, fists, sheep,
  what is called in from the sky, digging tools, getting about and building, traps and last
  resorts. Every hotkey moved with it — 1–9, 0, then Shift+1–0, with Teleport on T.
- **The minigun finally looks like a gun** instead of a screw; the shotgun took the blast icon and
  self-destruct the skull.
- The overlay's own animations hold still for `prefers-reduced-motion`.
- All README screenshots and the GIF were re-captured on this version.

### Fixed

- **The coverage gate never ran**: `verify` and CI used `npm test`, so the 98% thresholds enforced
  since 1.43.3 were checked by nothing, and branch coverage had slipped to 97.97%. All four gates
  now run the coverage, and the gaps are covered again.
- Browser tests retry once, so a network hiccup no longer fails an otherwise green run.
- The teleport row appeared twice in the README; the whole weapon table is now generated from the
  weapon order.
- `docs/ARCHITECTURE.md` was two releases out of date; the finished `todo.md` moved to the archive
  and `review.md` now holds the current review.

## [1.53.1] — 2026-09-21

### Added

- `scripts/history_chart.py` and the chart it draws at the bottom of the README: lines of code per
  area across every commit, and the four core coverage metrics sampled at every tenth commit, with
  the measurements cached so redrawing is cheap.

## [1.53.0] — 2026-09-21

Public release. Everything below has been in the changelog since 1.44.1; this is the summary that
ships with the release.

### Added

- **Teleport** (T, one per match): click a free spot and the buddy appears there, then falls, lands
  hard or drowns from there like anybody else.
- **Gravity setting** — Moon, Normal or Heavy — and **Crate craziness**, which drops two crates
  every single turn.
- **Map preview** in the setup screen: the island the current seed makes, in the scenery's colours.
- The Sudden Death flood is shown by the camera as it climbs, and a buddy it drowns during its own
  turn intro no longer holds the match up for its whole clock.
- Explosions throw tumbling lumps of earth out of the ground they bite into.
- `docs/SOUND.md` and `touchdisplay_support_ideation.md`.

### Changed

- **Every action has its own sound.** Thrown weapons no longer borrow the bazooka's launch roar,
  the blowtorch lights its gas, the platform knocks in wood, teleport warps, small blasts pop and
  Sudden Death has its own siren.
- Explosions are half as dense and see-through, so the buddies and the crater stay visible.
- Napalm burns for nine seconds and eats a charred dent into the ground.
- Dependencies updated to their latest stable releases.

### Fixed

- One-shot particle systems could pile up in the scene forever; they are now swept up.
- The turn timer's caption no longer runs through its ring at larger text sizes.

## [1.52.2] — 2026-09-21

### Changed

- Dependencies updated to their latest stable releases: Babylon.js 9.27.1, ESLint 10.11.0,
  Prettier 3.9.8, markdownlint-cli2 0.23.3 and `@types/node` 24.13.6. TypeScript stays on 6.0.3
  (typescript-eslint requires `<6.1.0`) and `@types/node` on the 24.x line to match the Node 24
  runtime.

## [1.52.1] — 2026-09-21

### Added

- `touchdisplay_support_ideation.md`: a design study for playing the whole game on a touchscreen —
  an optional, translucent control overlay that is off by default, what each of the three hard
  inputs (aim, charge, pick a spot) becomes, and what building it would cost. No code yet.

## [1.52.0] — 2026-09-21

### Changed

- **Sound audit.** Thrown weapons (grenade, cluster, holy grenade, banana bomb) no longer play the
  bazooka's launch roar but a throw of their own; the blowtorch lights its gas instead of roaring;
  the platform knocks in wood; teleport has its own warp instead of the crate shimmer; small
  explosions pop rather than sounding like a shotgun; and Sudden Death has a deeper siren of its
  own. The choices are documented in `docs/SOUND.md`.

## [1.51.0] — 2026-09-21

### Added

- **Teleport** (T, one per match, more from crates). Click any free spot and the buddy appears
  there — with no speed and no ground under it, so it falls, lands hard or drowns from there like
  anybody else. Spots inside rock or off the map are refused for free.

## [1.50.0] — 2026-09-21

### Changed

- Explosions are half as dense and see-through, so the buddies and the crater stay visible through
  the blast, and a blast that bites into rock now throws tumbling lumps of earth out of the ground.
  A blast in mid-air throws none.

## [1.49.0] — 2026-09-21

### Changed

- Napalm burns for about nine seconds instead of five, and now eats into the ground it burns on:
  each patch takes four small bites of rock and sinks into the hollow, leaving a charred dent about
  a unit and a half deep.

## [1.48.0] — 2026-09-21

### Added

- The Sudden Death flood is now shown: the turn intro is a little longer and the camera holds on
  the waterline as it climbs, with a floating "rising" label.

### Fixed

- A buddy drowned by the rising water during its own turn intro no longer holds the match up until
  its turn clock runs out; the turn is handed on at once.

## [1.47.2] — 2026-09-21

### Fixed

- The turn timer's caption no longer runs through the ring at Large and Huge text size: the ring
  holds only the number, the caption sits below it, and the digits have equal width so the clock
  stops jittering as it counts down.

## [1.47.1] — 2026-09-21

### Changed

- Closed the report of a short-ranged banana bomb: measured at four aim angles it matches or beats
  the grenade at every one of them, and a unit test now guards that. No balance change.

## [1.47.0] — 2026-09-21

### Added

- **Crate craziness** — a fourth crate setting that drops two fresh crates at the start of every
  turn instead of rolling for one, with room for eight on the map at a time.

## [1.46.0] — 2026-09-21

### Added

- **Gravity setting** — Moon, Normal or Heavy in the setup screen. Lighter gravity gives floaty
  jumps, longer throws and gentle landings; heavier gravity does the opposite. Normal is the
  default and is exactly the world the game had before. Everything that falls uses it, the AI
  included, and the HUD shows the pull whenever it is not the ordinary one.

## [1.45.0] — 2026-09-21

### Added

- **Map preview in the setup screen.** The island the current seed produces is drawn next to the
  seed field in the colours of the chosen scenery, so you can roll the dice until you like the map
  instead of finding out once the match has started. It uses the same terrain generation as the
  match, and follows both the seed and the scenery.

## [1.44.1] — 2026-09-21

### Fixed

- Explosion, napalm and trail particle systems could get stuck in the scene forever: their effect
  stopped reporting ready, so their particles never aged and Babylon never disposed of them. Every
  one-shot system is now swept up once its last particle should have died, and the napalm and
  blowtorch flames are emptied after they fade, so nothing hangs in the air over cold ground.

## [1.44.0] — 2026-09-21

Public release. Everything below has been in the changelog since 1.41.0; this is the summary that
ships with the release.

### Added

- **Platform** (Shift+0, two per team). A five-unit wooden board placed with the mouse: the preview
  follows the cursor and shows green where it fits and red where it does not, the wheel tilts it up
  to 60°, and a left click sets it down. Boards are solid for buddies, projectiles and the AI, and
  explosions cannot cut them.
- **Sudden Death floods the map.** From the turn after the strike the water climbs one world unit
  at the start of every turn, so caves and low ground go under and a stalled match is decided.

### Changed

- **Rope is a basic weapon**: three per team from turn one under every arsenal setting, including
  "Find in crates". Crates hand out the offensive special weapons instead.
- The rules core is covered to 99.8% of statements, 98.2% of branches, 100% of functions and 99.9%
  of lines, enforced at 98% in all four; browser tests now also cover jumping, hard landings and
  the drill's fall cushion.

## [1.43.3] — 2026-09-21

### Changed

- The rules core is now covered to 99.8% of statements, 98.2% of branches, 100% of functions and
  99.9% of lines, with the enforced Vitest thresholds raised from 90/85/90/90 to 98 in all four.
  New tests cover match draws, empty weapon crates, boundary handling for fire, flyers, mines,
  ropes and contours, and the AI's recovery from a lost plan.

## [1.43.2] — 2026-09-21

### Changed

- Browser tests now cover ordinary movement as well as weapons: a jump that lands safely, a long
  fall that costs health, and the drill digging through a hollow without fall damage.

## [1.43.1] — 2026-09-21

### Fixed

- The Sudden Death flood now rises once at the start of each turn instead of continuously, so
  letting the turn clock run out no longer floods the map faster than playing the turn. The strike
  turn itself stays dry; from the next turn on the water climbs a world unit each time.

## [1.43.0] — 2026-09-21

### Added

- **Platform** (Shift+0, two per team). A five-unit wooden board that is set with the mouse: the
  preview follows the cursor and shows green where it fits and red where it does not, the wheel
  tilts it up to 60°, and a left click puts it down and ends the turn. Boards are solid for buddies,
  projectiles and the AI alike, and explosions cannot cut them. Spots in rock, under water, off the
  map or on top of a buddy, a crate or a mine are refused without costing a use or the turn.

## [1.42.0] — 2026-09-21

### Added

- **Sudden Death floods the map.** From the Sudden Death turn the water rises by one world unit
  every eight seconds and never stops, so caves and low ground go under and a stalled match is
  decided. Everything that can drown — buddies, mines, crates, projectiles, sheep, tombstones and
  burning napalm — already reads the live water level, and the water surface follows it on screen.

## [1.41.0] — 2026-09-21

### Changed

- **Rope is a basic weapon.** Every team now starts with its three ropes under every arsenal
  setting, including "Find in crates", where the map previously offered no way to get around until
  a crate happened to hold one. Crates hand out the offensive special weapons instead. The hotkey
  (Shift+9), the ammo and the rope itself are unchanged.

## [1.40.1] — 2026-09-21

### Fixed

- Explosions now show an immediate, brighter 3D fireball. Burning napalm patches keep visible
  flickering flames even when a browser renders few particles, and the blowtorch projects a clear
  flame along its burn direction. Checked in Chrome and Firefox at desktop and compact resolutions.

## [1.40.0] — 2026-09-20

Public release. Everything below has been in the changelog since 1.33.5; this is the summary that
ships with the release.

### Added

- **Rope** (Shift+9, three per team). Space shoots a hook up to 24 units into rock; Up and Down reel
  the rope in and out, Left and Right build a swing, and Space lets go with every bit of momentum —
  press it again in mid-air to hook on somewhere else, free for the rest of that traversal. A hook
  that hits nothing costs nothing. The rope bends around corners and gives them up again, and lets
  go if the rock it bit into is blasted away. Roping is not the turn's shot: land, then fire.
- **Proximity Mine** (Shift+8, two per team). Dropped at the buddy's feet, it arms while you run and
  then stays on the map through every turn until a living buddy comes within two units — its own
  team and the one who laid it included. Rock in between shields a buddy, and a blast sets mines off
  in a chain.
- **Air-strike approach side.** Left and Right now choose which side the plane flies in from while a
  strike is being aimed. The buddy stays put and keeps its facing, and the HUD shows the choice.
- **Sheep collect crates.** A Sheep or Super Sheep that runs over a crate collects it for the buddy
  that launched it, without going off. Collection follows the path the sheep really travelled, so a
  Super Sheep at full speed cannot skip one.
- **Text size in the pause menu.** Normal, Large and Huge without leaving a running match.

### Changed

- **Smarter AI, by level.** Normal and Hard see that a crate caught in a blast explodes again, weigh
  a crate by what is in it and by how hurt the buddy is, only walk to crates they can reach, and
  press the enemy team holding the most health while finishing one down to its last buddy. Hard also
  sees when a blast would shove an enemy into the water or off the map. Easy plays exactly as before.

### Fixed

- **The Holy Garlic Grenade arms promptly on a slope.** A projectile blocked by terrain used to
  stand still while still carrying speed, so the countdown only started on the ten-second emergency
  fuse. Contacts now slide along the surface and friction lets a hillside hold them.
- The AI no longer plans contact-fused shots through a supply crate that would stop them.
- Menus and the HUD stay readable and reachable at every text size.
- The AI-vs-AI browser test no longer depends on how many frames slip between its own calls, which
  made it fail about one run in ten.

## [1.39.2] — 2026-09-20

### Fixed

- The rope no longer crashes the renderer the moment it wraps or unwraps a corner. A Babylon tube
  can only be updated in place while it keeps the same number of points, and the rope gains one
  every time it bends around rock, so it is now rebuilt when that count changes.
- A buddy that let go of the rope and hit the ground took no fall damage, because the ordinary buddy
  step is skipped during a traversal. Hanging on the rope still costs nothing; the fall after the
  release now hurts like any other.

## [1.39.1] — 2026-09-20

### Changed

- Tidied `tasks.md`: the AI review and implementation were numbered T63/T64, which collided with the
  existing T63, and are now T65/T66. Statements left over from when the backlog was still unbuilt
  now say what was actually done.

## [1.39.0] — 2026-09-20

### Added

- Rope (Shift+9, three per team): Space shoots a hook up to 24 units into rock, then Up and Down reel
  the rope in and out, Left and Right build a swing, and Space lets go with every bit of momentum —
  press it again in mid-air to hook on somewhere else, free for the rest of that traversal. A hook
  that hits nothing costs nothing. The rope bends around corners it has to pass and gives them up
  again on the way back, and it lets go if the rock it bit into is blasted away. Roping does not use
  up the turn's shot: land first, then fire. Firing while attached is deliberately not supported, and
  the AI does not use the rope yet.

### Changed

- Weapon slots are narrower again, so all nineteen still sit on one row at 1280 px.
- Pausing now clears held keys, so a rope no longer keeps reeling when the match resumes.

## [1.38.0] — 2026-09-20

### Added

- Proximity Mine (Shift+8, two per team): Space drops it at the buddy's feet, it arms while you run,
  and then it stays on the map through every turn until a living buddy comes within two units — its
  own team and the one who laid it included. Rock in between shields a buddy, a blast sets mines off
  in a chain, and a mine falls when the ground beneath it is blasted away. The AI lays them and
  keeps its own buddies away from them.

### Changed

- Weapon slots are slightly narrower, so all eighteen still sit on one row at 1280 px.

## [1.37.0] — 2026-09-20

### Changed

- The AI opponents now understand more of the board, gated by level. Normal and Hard see that a
  crate caught in a blast explodes again, so they shoot crates beside enemies and keep clear of ones
  beside team-mates; they also weigh a crate by what is in it and by how hurt the buddy is, and only
  walk to crates they can actually reach. Hard additionally sees when a blast would shove an enemy
  into the water or off the map. With three or four teams, Normal and Hard press the enemy team
  holding the most health and finish a team down to its last buddy. Easy plays exactly as before.

### Fixed

- The AI no longer plans contact-fused shots straight through a supply crate that would stop them.

## [1.36.0] — 2026-09-20

### Added

- Sheep and Super Sheep now collect crates they run over, crediting the health or ammo to the buddy
  that launched them. Collection follows the path the sheep really travelled, so a Super Sheep at
  full speed cannot skip a crate, and touching one never sets the sheep off. A launcher that is dead
  or already out of health collects nothing and the crate stays on the map.
- Crate rewards now also float above the spot where the crate was collected, so a sheep picking one
  up across the map is visible.

## [1.35.0] — 2026-09-20

### Added

- Left and Right now choose which side the plane flies in from while an air strike or napalm strike
  is being aimed. The buddy stays put and keeps its facing, the HUD shows an Approach card next to
  the wind gauge, and the side resets to the buddy's facing at the start of each turn. The
  plane-less concrete mule is unaffected, and the AI picks its own approach side deliberately.

## [1.34.2] — 2026-09-20

### Changed

- Documented a review of the AI opponents in `todo.md`: what the three levels already do, why they
  ignore crate contents, chained crate explosions and which enemy team is ahead, and a ranked
  backlog for improving them.

## [1.34.1] — 2026-09-20

### Fixed

- The Holy Garlic Grenade no longer takes ten seconds to start singing when it lands on a slope. A
  projectile blocked by terrain now slides along the surface instead of standing still while still
  carrying speed, and contact friction lets a hillside hold it. Bouncing weapons keep skittering.

## [1.34.0] — 2026-09-20

### Added

- The pause menu now includes the Normal, Large and Huge text-size options. Changes apply to the
  open menu and HUD immediately, persist across reloads and leave the paused match untouched.

### Fixed

- Changing text size during a Quick Match no longer risks replacing the saved custom-match setup.

## [1.33.5] — 2026-09-20

### Fixed

- Large and Huge text no longer clip title controls or push the bottom weapon bar off-screen on
  compact viewports; menu screens scroll and the scaled HUD switches layout before it overflows.
- Weapon hotkeys and ammo, weapon captions/descriptions and the turn-timer caption use readable
  base sizes. Browser coverage now checks all text sizes across menus and a live match.

## [1.33.4] — 2026-09-20

### Added

- Completed the planning handoff in `todo.md`: suggested implementation order, affected files,
  proposed behavior/tuning, rope solver constraints and remaining validation risks.
- Recorded the pause-menu persistence pitfall and available hotkey slots. All gameplay changes
  remain explicitly deferred until the user decides when to start implementation.

## [1.33.3] — 2026-09-20

### Added

- Further `todo.md` research confirms title-screen and weapon-bar clipping at larger text sizes,
  and reproduces delayed Holy Grenade arming through ordinary throw commands on sloped terrain.
- Documented the rope's conflict with the single timed-action state, sheep reward feedback and
  deferred-death considerations, and the separate effect of low rendering rates on timers.

## [1.33.2] — 2026-09-20

### Added

- `todo.md` records seven requested follow-ups with code findings and acceptance checks: text
  readability, in-game text-size controls, a Worms 2-style rope, air-attack direction, persistent
  proximity mines, sheep crate collection and Holy Garlic Grenade timing.
- Initial Holy Grenade diagnostics reproduce delayed arming on slopes; the backlog records the
  reproduction and suspected contact/rest detection cause. Gameplay changes remain pending.

## [1.33.0] — 2026-09-18

### Changed

- Sudden Death now drops every living buddy to 1 HP instead of halving their health, so from that
  turn on the lightest scratch decides the match. It still leaves 1 rather than 0, so the strike
  itself kills nobody.
- README and vision marked "almost feature complete": everything on the vision list is in and
  covered by tests, and what remains is polish, balance and optional extra weapons.

## [1.32.2] — 2026-09-17

### Fixed

- The AI aimed the blowtorch wherever its buddy happened to be aiming while planning a level tunnel
  to an enemy behind a wall, so since the torch became directional it dug up over its target. It
  now aims level for that plan.
- The map pointer was picked with a full ray cast on every mouse move, including on the title
  screen and behind open menus, although only the strike cursor uses it. It is picked only while a
  human is aiming a strike weapon.
- `main.ts` cast the canvas lookup instead of checking it, the one place in `src/` that broke the
  project's own no-non-null-assertion invariant.

## [1.32.1] — 2026-09-17

### Changed

- Cut the CPU and GPU cost of a frame by about 40 % without touching how the game looks. Profiling
  a real session showed the JavaScript main thread idle over 98 % of the time and the whole cost in
  per-pixel work, of which 4× multisampling of the scene target alone was more than a third — on
  top of the FXAA pass that already smooths the same edges. The redundant multisampling is gone.
- The render loop draws at most 60 frames per second (20 while a menu is open). The simulation has
  always run at a fixed 60 Hz, so on a 120 or 144 Hz display the extra frames were redrawing the
  same state at two to three times the cost.
- The drawing buffer is capped at four megapixels. Up to that size nothing changes; beyond it — a
  maximised window on a HiDPI screen — the render scale eases off instead of growing without limit.

## [1.32.0] — 2026-09-17

### Added

- Sudden Death: a setup option (Off / turn 10 / 20 / 30, default turn 10) that halves every living
  buddy's health when that turn begins — never below 1 HP, so it wounds rather than kills. A siren
  and a banner announce it, and the setting is persisted with the rest of the match setup.

## [1.31.0] — 2026-09-17

### Added

- Help and Pause buttons in the HUD, under the wind gauge. Help pauses the match and opens How to
  Play straight away; Pause opens the pause menu. Escape still does the same, and the turn timer
  and the whole simulation stay frozen while a menu is open.

### Changed

- The pause menu's "Controls" button is now labelled "❔ How to Play", matching the title screen.

## [1.30.0] — 2026-09-17

### Changed

- The blowtorch burns along the aim line instead of always horizontally. Aim up and it cuts its
  way up through a hillside, aim down and it digs in; the buddy rides the tunnel it cuts, with the
  flame pointing the same way.
- Where there is no rock left in front of the flame the buddy simply walks and gravity applies, so
  the torch still cannot carry anyone across a gap.
- A burnt victim is now shoved along the burn line, always with some lift, rather than straight
  ahead of the buddy's facing.

## [1.29.0] — 2026-09-17

### Changed

- The cluster bomb is a basic weapon: every team starts with three of them under every arsenal
  setting, instead of having to find them in crates. The basic loadout is now bazooka, grenade,
  shotgun, garlic punch, cluster bomb, baseball bat, blowtorch and drill, always available from
  turn one; crates hand out the remaining special weapons.

## [1.28.0] — 2026-09-17

### Changed

- Napalm now reads as fire. A bursting canister throws a rolling fireball with smoke and embers,
  in the spirit of the concrete mule's impact, and the ground keeps burning for about five seconds
  instead of under two.
- The flames themselves are tall, bright tongues with drifting smoke and a much stronger flicker
  light, so a burning patch is visible from across the map instead of a faint shimmer.

## [1.27.0] — 2026-09-17

### Fixed

- Contact-fused projectiles — bazooka rockets, bomblets, air-strike bombs and napalm canisters —
  now burst on supply crates as well as on rock and buddies, instead of passing straight through
  them.
- A napalm canister's burst is big enough to see and hear (blast radius 1 → 1.3), so an impact no
  longer looks like the bomb simply vanished.

## [1.26.18] — 2026-09-16

### Fixed

- The HUD shows a new match right away; for one frame it used to show the previous match's weapon
  ammo, which also made the infinite-supplies E2E test flaky (about one run in eight).

## [1.26.17] — 2026-09-16

### Fixed

- CI now really runs actionlint on the workflows; the job described in 1.26.0 had not been added.

## [1.26.16] — 2026-09-16

### Changed

- Release v1.26.16: plan marks the batch review and the publish step as done. This release brings
  the drill, napalm strike, tombstones, Candy Shop and Frosty Peaks sceneries, infinite supplies,
  text size and remembered settings, the about screen, continuous flying sheep steering, louder
  sound, crate camera pans, SPDX/REUSE compliance, the linter pipeline and the review fixes.

## [1.26.15] — 2026-09-16

### Changed

- README media regenerated: the napalm screenshot now shows the burning ground without the
  "Retreat!" banner.

## [1.26.14] — 2026-09-16

### Changed

- `review.md` records how every finding of the full-code review was resolved; ARCHITECTURE describes
  the `TurnAction` union and weapon looks.

## [1.26.13] — 2026-09-16

### Changed

- The weapon action in progress (hopping or flying sheep, blowtorch, drill, minigun burst) is one
  `TurnAction` in the game instead of five independent fields, stepped and cleared in one place,
  so two actions can never run at once (review #2).

## [1.26.12] — 2026-09-16

### Changed

- Weapon presentation is declared in the weapon table (`look`: projectile model, flight, fire, shot
  and hit sounds, muzzle flash, camera follow) instead of being switched on weapon ids in the app,
  world and effects; a unit test makes sure every projectile declares its model and sounds
  (review #3). The drill no longer plays a firing whoosh and muzzle flash when it starts.

## [1.26.11] — 2026-09-16

### Fixed

- E2E: the human-turn test continues on a fixed map after clicking Quick Match, so a random map
  can no longer end the turn early (for example a jump into the water).

## [1.26.10] — 2026-09-16

### Changed

- The GitHub Pages deployment runs the Chrome E2E suite before publishing, so a build with failing
  browser tests never goes live (review #7).

## [1.26.9] — 2026-09-16

### Fixed

- Media capture script: the napalm screenshot waits for the "Retreat!" banner to fade instead of
  setting a field the world does not have (review #9).

## [1.26.8] — 2026-09-16

### Fixed

- The AI aims its napalm strike upwind so the wind carries the napalm onto the enemy, and scores
  the strike where it will actually land (review #5).

### Added

- AI tests for drilling onto a buried enemy and for the wind-aware napalm strike (review #8).

## [1.26.7] — 2026-09-16

### Fixed

- Crates no longer teleport into a tombstone (review #6).

## [1.26.6] — 2026-09-16

### Fixed

- Playing a Quick Match no longer overwrites the custom setup saved for the next game (review #4).

## [1.26.5] — 2026-09-16

### Fixed

- Saved settings are validated field by field: an invalid AI level, controller, option value,
  scenery, team colour or buddy name from an old or edited entry falls back to its default instead
  of crashing the AI loop or the setup screen (review #1).

## [1.26.4] — 2026-09-16

### Changed

- `review.md`: new review of the full codebase against the v1.17.5 release, with nine verified
  findings.

## [1.26.3] — 2026-09-16

### Changed

- Documentation reviewed and brought up to date with the code: README (seventeen weapons, controls,
  architecture tree, test and lint commands), AGENTS (layout, commands, weapon checklist,
  invariants), VISION (rules, sceneries, setup, quality tooling), ARCHITECTURE (components, drilling
  phase, settle rules, AI flow, CI jobs, key decisions, testing map) and PLAN (historical sections
  marked).

## [1.26.2] — 2026-09-16

### Changed

- New README media: a banana bomb recording, bazooka flight and blast, flying sheep in the Candy
  Shop, an air strike over Frosty Peaks, burning napalm, a tombstone and the title screen.

### Added

- `scripts/capture-media.mjs` (`npm run capture-media`) scripts the scenes in Chrome and
  regenerates all README screenshots and the GIF.

## [1.26.1] — 2026-09-16

### Changed

- README badges: play in browser, CI, GitHub Pages deployment, release, license, REUSE compliance,
  and live versions of Babylon.js, TypeScript, Vite, Vitest and Playwright read from package.json,
  plus Node.js.

## [1.26.0] — 2026-09-16

### Added

- Linters in `npm run lint` (run by `npm run verify` and CI on every push): type-aware ESLint
  (typescript-eslint strict and stylistic type-checked rules), Prettier, Stylelint
  (stylelint-config-standard), markdownlint and the SPDX check. CI also runs actionlint on the
  workflows. `npm run format` applies the auto-fixes.

### Changed

- All findings fixed: code, tests, CSS and docs reformatted; non-null assertions in the game
  replaced by invariant helpers and typed audio voices; modern CSS colour notation; Markdown code
  fences, headings and URLs cleaned up.
- `@types/node` added so Playwright and Node types resolve; smol-toml (a markdownlint-cli2
  dependency) is overridden to 1.8.0 to fix a high-severity advisory.

## [1.25.1] — 2026-09-16

### Added

- SPDX / REUSE compliance: every source, style, script, workflow and HTML file carries
  `SPDX-FileCopyrightText` and `SPDX-License-Identifier` headers (GPL-3.0-or-later); `REUSE.toml`
  covers Markdown, JSON and images; the license text is in `LICENSES/`. The official REUSE tool
  reports the project compliant with REUSE 3.3.
- Scripts: `npm run lint:spdx` (part of `npm run lint`), `npm run spdx:fix` and
  `npm run lint:reuse`; CI runs the REUSE check on every push.

## [1.25.0] — 2026-09-16

### Added

- About screen on the title menu: author and contact, free to play on GitHub Pages, source link and
  license, and the tech stack with exact versions and open-source licenses (Babylon.js, simplex-noise,
  Fredoka font, TypeScript, Vite, Vitest, Playwright, ESLint).

## [1.24.0] — 2026-09-16

### Added

- Text size option (Normal / Large / Huge) in the match setup, scaling the HUD, name tags, banners
  and menus.
- The setup and text size are saved in the browser and restored for the next game, also after a
  reload (with a fresh map seed).
- *Reset all* button in the setup restores every default and clears the saved settings.

## [1.23.0] — 2026-09-16

### Added

- Candy Shop scenery: pink frosting on chocolate ground, strawberry-milk sea, pastel hills, lollipop
  trees, gumdrops, candy canes and sprinkles.
- Frosty Peaks scenery: snow over icy blue rock, snow-capped pines, snowballs and ice crystals.

## [1.22.0] — 2026-09-16

### Added

- Tombstones: a buddy that dies (death blast or self-destruct) leaves a comic tombstone with
  "R.I.P.", its name and a team-coloured ribbon. It pops up with a springy wobble and a sad little
  trombone, gets knocked around by explosions and sinks in water. Drowned buddies leave none.

## [1.21.0] — 2026-09-16

### Added

- Napalm Strike (Shift+7, special, 1 per team): click on the map and a plane drops four napalm
  canisters. They are not aimed against the wind and drift far with it. Each sets the ground
  around its impact aflame for 1–2 seconds; a buddy touching the flames takes 3 damage and hops
  away from them, handy for pushing enemies into the water. Flames sink with blasted ground and go
  out in water. Fire particles with flickering light, ignition whoomph, crackling fire and a yelp
  when scorched.

## [1.20.0] — 2026-09-16

### Added

- Drill (Shift+6, 2 per team): drills straight down for three seconds, the buddy sinking into its
  own shaft under gravity. No fall damage while drilling, even when breaking into a cave; buddies
  in the way take 15 damage and a shove. Grinding sound, dirt spray, drill model; the AI drills
  onto enemies buried right below.

### Changed

- The phases that count down the turn timer and the phases that end the turn when the active buddy
  is hurt are defined once in the game instead of being repeated across game, HUD and app.

## [1.19.0] — 2026-09-16

### Added

- Arsenal option *Infinite supplies*: every weapon has unlimited ammo for the whole match.

## [1.18.6] — 2026-09-16

### Changed

- Plan: SPDX compliance, the linter proposal and a new full-code review added with their order.

## [1.18.5] — 2026-09-16

### Added

- When a crate teleports in, the camera pans to it and the turn intro lasts 1.3 s longer, so every
  player notices the drop (with the louder teleport shimmer).

## [1.18.4] — 2026-09-16

### Changed

- Plan and task list: drill, napalm strike, font size with persisted settings and Reset all, and
  an About screen.

## [1.18.3] — 2026-09-16

### Changed

- Louder sound: master volume doubled (0.55 → 1.1) behind a compressor that keeps big explosions
  from clipping; footsteps, sheep hops, the timer tick, flight sounds and the crate teleport
  shimmer are noticeably louder.

## [1.18.2] — 2026-09-16

### Changed

- `docs/PLAN.md`: plan and execution order for the current batch of requests; `tasks.md` lists
  the new requests (docs review, screenshots, badges, crate camera, banana bomb range).

## [1.18.1] — 2026-09-16

### Changed

- README: prominent "Play in your browser" link to <https://marcelpetrick.github.io/AlliumAssault/>
  at the top and in the Play section.

## [1.18.0] — 2026-09-16

### Changed

- Flying Sheep steering: all four arrow keys steer it relative to the screen for the whole flight;
  it turns towards the pressed direction (diagonals too) and holds that course when released.
  It flies slower (9 units/s) with a 15 s fuse so there is time to steer around obstacles.
- The AI steers with the same arrow keys, cruising above the terrain before diving onto its
  target.
- Unit and E2E tests steer through several directions in one flight.

## [1.17.8] — 2026-09-16

### Changed

- `tasks.md`: tombstone task and the plan for the current batch; `docs/PLAN.md` points to it.

## [1.17.7] — 2026-09-16

### Changed

- `tasks.md`: new tasks for continuous flying sheep steering, louder sounds, an infinite-supplies
  arsenal and the Candy Shop and Frosty Peaks sceneries.

## [1.17.6] — 2026-09-16

### Fixed

- E2E: the human-turn test skips ahead exactly to the next human turn instead of a fixed 60
  seconds, which could leave too little turn time to charge the bazooka on slow CI machines.

## [1.17.5] — 2026-09-16

### Changed

- Docs: README architecture and testing sections, `docs/VISION.md` (all fifteen weapons, crates,
  controls), `docs/ARCHITECTURE.md` (new core modules, weapon phases, AI flow, E2E coverage, Pages
  deployment) and `AGENTS.md` (layout, controls, how to add a weapon) describe the current game.

## [1.17.4] — 2026-09-16

### Fixed

- AI thinking is faster with the full arsenal: limited-ammo grenades are searched on a coarser
  grid (69 ms → 48 ms per decision in the benchmark), and projectile, strike and melee candidates
  come from the weapon table, so new weapons of those kinds are used automatically.
- The AI no longer launches the flying sheep into rock right next to its own buddy.
- The last-seconds tick and urgent timer also run while guiding a sheep or torching.
- The camera keeps the player's zoom if they zoomed during a strike.
- Matches with a crates-only arsenal always drop crates, even without a crate setting.

## [1.17.3] — 2026-09-16

### Added

- `review.md`: code and architecture review of all changes since v1.1.11, with eight verified
  findings ranked by impact.

## [1.17.2] — 2026-09-16

### Added

- GitHub Pages deployment: every release tag (or a manual run) builds the game and publishes it
  at <https://marcelpetrick.github.io/AlliumAssault/>.

## [1.17.1] — 2026-09-16

### Changed

- `@babylonjs/core` 9.26.1 → 9.26.2. TypeScript stays at 6.0.3 because typescript-eslint 8.70.0
  does not support TypeScript 7 yet.

## [1.17.0] — 2026-09-16

### Added

- Arsenal option in the match setup: *All weapons* (default) or *Find in crates*, where special
  weapons (cluster bomb, sheep, air strike, self-destruct, minigun, holy garlic grenade, banana
  bomb, flying sheep, concrete mule) start empty and each weapon crate adds one more. Choosing it
  switches crates on if they were off.

### Changed

- Weapon crates can contain any special weapon.

## [1.16.0] — 2026-09-16

### Changed

- Compact weapon bar for all 15 weapons: icon slots with hotkey and ammo badges, a caption with the
  selected weapon's name, ammo and description, and a layout that wraps and stacks on narrow
  screens.
- Hotkeys: 1–9 and 0 select the first ten weapons, Shift+1–5 the other five; the help screen and
  HUD hint list them.
- E2E tests select every weapon with its real hotkey and check the bar fits the screen.

## [1.15.0] — 2026-09-16

### Added

- Concrete Mule (1 per team): click on the map and a giant concrete mule drops from the sky onto
  that spot. It explodes on every impact (35 damage) and keeps crashing down through its own
  craters, up to six times. Block-built mule model, hee-haw bray, falling whistle.
- The AI drops the mule onto enemies, counting its repeated impacts.
- Unit and E2E tests.

### Changed

- Strike weapons can fall straight from the sky without a plane; the strike hint names the weapon.

## [1.14.0] — 2026-09-16

### Added

- Flying Sheep (1 per team): takes off along the aim direction at constant speed; ← and → steer
  it, Space detonates it (75 damage), and it explodes on hitting rock or a buddy or after 10 s.
  Caped sheep model, bleat and whoosh, fuse countdown, camera follow.
- The AI flies it over obstacles and dives onto the nearest enemy.
- Unit and E2E tests.

### Changed

- Guided weapons share one detonation path; the crate and sheep AI tests restrict the arsenal.

## [1.13.0] — 2026-09-16

### Added

- Banana Bomb (1 per team): thrown with a 3 second fuse (40 damage), then bursts into five
  bananas that bounce around and explode one after another (30 damage each). Curved banana models.
- The AI throws banana bombs like the other cluster weapons.
- Unit and E2E tests.

### Changed

- Cluster fragments can stagger their fuses.

## [1.12.0] — 2026-09-16

### Added

- Holy Garlic Grenade (1 per team): a golden grenade with a cross that barely bounces and has no
  timer. Once it has come to rest it sings a Hallelujah chord and erupts 1.6 seconds later in an
  enormous blast (100 damage, radius 7). Choir sound, glowing model, fuse countdown.
- The AI throws it when the huge blast pays off.
- Unit and E2E tests; AI tests restrict the arsenal with a helper so new weapons do not change
  their outcome.

## [1.11.0] — 2026-09-16

### Added

- Minigun (1 per team): Space fires a burst of 14 bullets over 1.4 seconds along a slightly
  wobbling aim line. Each hit does 5 damage and kicks the victim up and away, so the shoves add up
  and carry it across the map. Spin-up and rapid gunfire sounds, muzzle flashes, three-barrel model.
- The AI uses the minigun on enemies in sight, especially when the shove knocks them into water.
- Unit and E2E tests.

### Changed

- Hitscan weapons declare their upward kick; the shotgun keeps its previous behaviour.

## [1.10.0] — 2026-09-16

### Added

- Blowtorch (key 9, 2 per team): Space lights it and the buddy walks forward for three seconds,
  burning a level tunnel through the rock ahead. It only walks with ground underneath, so it
  falls into gaps and never tunnels upwards. Enemies in the flame take 15 damage and a shove.
- Flame particles and light, roaring torch sound, torch model, HUD hint.
- The AI burns through walls towards enemies on the same level.
- Unit and E2E tests.

### Changed

- Self-Destruct moved to the tenth weapon slot.

## [1.9.0] — 2026-09-16

### Added

- Self-Destruct (key 9, 1 per team): the buddy blows itself up on the spot. Damage equals its
  health and the blast radius is health ÷ 10, so a healthy buddy levels a big part of the map.
  Siren sound and detonator model.
- The AI self-destructs only when the blast is worth more than the buddy it costs.
- Unit and E2E tests.

## [1.8.1] — 2026-09-16

### Changed

- `tasks.md`: plan and open tasks for the Holy Garlic Grenade, Banana Bomb, Flying Sheep,
  Concrete Mule, Minigun and a compact weapon bar.

## [1.8.0] — 2026-09-16

### Added

- Baseball Bat (key 8, 2 per team): 25 damage, less than the punch, but knocks the victim far
  along the aim line, always at least 20° upwards, to swat enemies over edges. Wooden crack
  sound, bat model, camera follows the flight.
- The AI simulates where punches and bat swings send their victim and goes for knock-outs into
  the water.
- Unit and E2E tests for the bat.

### Changed

- E2E melee tests aim at the enemy after it settles; the weapon bar test no longer assumes a
  fixed number of weapons.
- `tasks.md`: new open task for the arsenal setting.

## [1.7.0] — 2026-09-16

### Added

- Footstep patter while a buddy walks, a "hup" with a puff of air on jumps and a softer thud on
  lighter landings.
- E2E test for walking, jumping and landing sounds.

## [1.6.1] — 2026-09-16

### Added

- End-to-end tests in Google Chrome for every weapon (bazooka, grenade, shotgun, punch, cluster
  bomb, sheep, air strike) with real keyboard and mouse input, checking projectiles, craters,
  damage and the sounds each weapon makes.
- End-to-end tests for crates (teleport and pickup), audio cues (select, tick, turn chime, mute)
  and the weapon bar.
- The audio engine counts played sound effects; the test hook exposes them together with crates,
  ammo and a world-to-screen projection.

### Changed

- E2E helpers moved to `e2e/support.ts`, typed from the app's test hook.
- `tasks.md`: new open tasks for the blowtorch, baseball bat, walking and jumping sounds and
  self-destruct.

## [1.6.0] — 2026-09-16

### Added

- Random crates: from the second turn on, a crate may teleport onto free land at the start of a
  turn (at most four on the map, placement follows the map seed). Health crates heal the buddy who
  touches them by 25 HP; weapon crates add a cluster bomb, sheep or air strike to the team.
  Crates fall, and explode when caught in a blast.
- Crates option in the match setup (Off / Normal / Lots); quick matches use Normal.
- Crate models, teleport shimmer, pickup sparkles, floating "+25 HP" / "+1 Sheep" text and
  teleport, pickup and heal sounds.
- The AI walks to a nearby crate when it has no good shot.

## [1.5.0] — 2026-09-16

### Added

- Air Strike (key 7, 1 per team): click on the map and a plane flies over in the buddy's facing
  direction, dropping five bombs (25 damage each) spaced around that spot. Release points allow
  for fall time and wind.
- Target crosshair under the mouse, plane model with spinning propeller, propeller fly-by sound,
  whistling bombs, and a camera that pulls back to show the strike.
- The AI calls air strikes onto enemy positions.

### Changed

- A short press on the map counts as a click; dragging still pans the camera.

## [1.4.1] — 2026-09-16

### Changed

- `tasks.md` tracks every request with its status and version: open features, E2E coverage,
  GitHub Pages, review and release, plus answered questions.

## [1.4.0] — 2026-09-16

### Added

- Sheep (key 6, 1 per team): Space releases it and it hops forward in small 45° leaps, turning
  around at walls; Space again detonates it (75 damage). It blows up by itself after 10 seconds or
  when the turn time runs out, and drowns in water. Fuse countdown, baa and hop sounds.
- The camera follows the sheep; the AI replays its hops and detonates it at the best moment.
- E2E test for releasing and detonating the sheep.

## [1.3.2] — 2026-09-16

### Fixed

- E2E: the charge-sound check waits for the next frame instead of racing the key-up that fires.

## [1.3.1] — 2026-09-16

### Added

- `AGENTS.md`: project layout, commands, working rules and versioning for contributors and coding
  agents.

### Changed

- Versioning: every commit still bumps the version and CHANGELOG, but only releases are tagged.

## [1.3.0] — 2026-09-16

### Added

- Cluster Bomb (key 5, 3 per team): a red grenade with a 3 second fuse that bursts into five
  bomblets; each bomblet explodes on contact for 10 damage.
- Weapon hotkeys now go up to 9; the weapon bar, hints and controls list follow the weapon table.
- The AI throws cluster bombs when the extra bomblet damage is worth the limited ammo.

## [1.2.0] — 2026-09-16

### Added

- Charge whoosh while Space is held: rises in pitch and loudness with the charge and stops on
  firing, pausing or losing focus.
- Flight sounds: bazooka rockets hiss and whistle (dropping in pitch as they fall), grenades whoosh.
- Weapon-select blip and a ticking clock during the last five seconds of a turn.

### Changed

- Grenade bounces are a clearly audible clunk scaled by the impact speed.

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
