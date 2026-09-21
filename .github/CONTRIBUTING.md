# Contributing

Thanks for looking. Allium Assault is a small, opinionated project: a turn-based 3D artillery game
that runs entirely in the browser, with no backend and no asset pipeline. Issues and pull requests
are welcome as long as they keep it that way.

## Before you start

- **Open an issue first** for anything bigger than a fix. A new weapon, a new setting or a new
  renderer feature is a design decision, and it is cheaper to agree on it before the code exists.
- **Read [`AGENTS.md`](AGENTS.md).** It is written for coding agents but it is the house style for
  everybody: where code goes, what the layers may import, how weapons are added, how commits look.
- The architecture is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), the design intent in
  [`docs/VISION.md`](docs/VISION.md), the sound decisions in [`docs/SOUND.md`](docs/SOUND.md).

## Getting set up

```bash
npm install
npm run dev        # http://localhost:5173  (?quality=low on a weak GPU)
npm run verify     # lint, typecheck, coverage, build and the browser tests
```

`npm run verify` is the gate. It must be green before a commit, and CI runs the same thing plus the
REUSE licence check and a workflow lint.

## House rules

- **Layers.** `src/core/` is the rules: pure TypeScript, no Babylon, no DOM, fully unit tested.
  `src/render/` reads core state and events and never changes them. `src/ui/` is the HTML overlay.
- **No non-null assertions in `src/`.** Use `defined()` from `src/core/assert.ts` or `query()` from
  `src/ui/dom.ts`, which fail with a message that says what was missing.
- **Tests come with the change.** Rules get unit tests; anything a player can see gets a browser
  test. Core coverage is enforced at 98% for statements, branches, functions and lines.
- **Presentation never switches on a weapon id.** Weapons describe themselves through `look` keys
  that the renderer and the synthesizer map to models and sounds.
- **Every commit bumps the version** in `package.json` and adds a `CHANGELOG.md` entry: patch for
  fixes, docs, balance and dependencies, minor for features. Tags are only created for releases.
- **Conventional commits**: `feat(core): …`, `fix(render): …`, `docs: …`, with a body that says why.
- **Licensing.** Every file carries `SPDX-FileCopyrightText` and `SPDX-License-Identifier`
  (GPL-3.0-or-later) or is annotated in `REUSE.toml`. `npm run spdx:fix` adds headers to new files.

## Reporting a bug

Tell us the browser, the setting (scenery, gravity, arsenal, text size) and the map seed — the seed
is in the setup screen and makes the island reproducible. A screenshot of the HUD helps.
