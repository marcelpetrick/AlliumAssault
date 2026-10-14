# Performance

Measured, not guessed. This page holds the numbers, how to reproduce them, and what was done about
them. Two things are measured separately, because they fail differently: the **rules core**, which a
test suite can hold still, and the **browser**, which cannot.

## How to measure

```bash
npm run profile        # the rules core, stage by stage (bench/core.bench.ts)
npm run build          # bundle sizes, printed by Vite
npm run e2e            # the browser suite; add --trace on to collect Playwright traces
```

For the function-level picture of the core, run the profiler under V8's own profiler and open the
result in Chrome DevTools (Performance → Load profile):

```bash
node --cpu-prof --cpu-prof-dir=.profile ./node_modules/vitest/vitest.mjs run --config vitest.profile.config.ts
```

In the browser, the tools that pay off are Chrome DevTools' Performance panel against
`npm run dev`, and Babylon's own instrumentation, which can be switched on from the console of a
running game:

```js
// Per-frame cost of the pieces, in milliseconds.
const { SceneInstrumentation } = await import('@babylonjs/core/Instrumentation/sceneInstrumentation');
const probe = new SceneInstrumentation(window.__allium.app.world.scene);
probe.captureRenderTime = probe.captureParticlesRenderTime = true;
setInterval(() => console.log(probe.renderTimeCounter.lastSecAverage.toFixed(2), 'ms/frame'), 1000);
```

## Rules-core measurements — 14 October 2026

`npm run profile`, on the development machine during the media refresh, µs per fixed 1/60 s step.
GPU captures were also running, so these are a dated smoke measurement, not a like-for-like
comparison with older benchmark runs. All benchmark ceilings passed. One whole frame is
16,667 µs, so the last column is the share of a frame the simulation would take if the renderer were
free:

| Scenario                              |    µs |  frame |
| ------------------------------------- | ----: | -----: |
| Idle turn, 8 buddies                  |   6.3 | 0.04 % |
| Walking buddy                         |   5.6 | 0.03 % |
| 12 projectiles in flight              |  20.6 | 0.12 % |
| 20 napalm patches burning             |  17.0 | 0.10 % |
| 16 buddies, 8 crates, mines, graves   |  20.6 | 0.12 % |
| Sudden Death, water rising            |   5.2 | 0.03 % |
| AI turn                               |   6.7 | 0.04 % |
| Carve a crater and re-contour a chunk | 237.8 | 1.43 % |
| 1000 terrain samples                  |  14.6 | 0.09 % |
| 1000 samples with 8 platforms placed  |  38.1 | 0.23 % |

These averages measure the named scenarios in `bench/core.bench.ts`. The AI row is an amortized
turn step, not the worst single planning decision; route searches and weapon searches run on the
main thread. Carving plus contour extraction is the largest measured stage in this run. Compare
future changes under matching machine load before calling a difference an optimization or a
regression. No new performance optimization is claimed by this media/documentation refresh.

## The browser

The following before/after table records the earlier deep-import audit; it is historical:

| Build                                      | Entry chunk |  Gzipped | Whole `dist/assets` |
| ------------------------------------------ | ----------: | -------: | ------------------: |
| Before — `import … from '@babylonjs/core'` |    6,889 kB | 1,522 kB |            7,308 kB |
| After — deep imports per module            |    1,510 kB |   374 kB |            2,556 kB |

**Current production build, 1.83.2 (14 October 2026):** entry JavaScript 1,602.9 kB,
404.6 kB gzipped as reported by Vite; all assets 2,378.2 kB before compression.
Vite's own gzip figure is printed by `npm run build`; neither figure is a runtime frame benchmark.

The entry chunk is what the browser must have before the first frame; the rest of `dist/assets` is
Babylon's shader chunks, which Vite splits out and the engine fetches when a material first
compiles.

Babylon.js publishes every class as its own module, and the package root is a barrel that re-exports
all of them. Importing from the root pulls the whole engine into the bundle: a probe with nothing
but an engine, a scene, a camera, a light, a box and a standard material still produced **6.71 MB**,
against 6.89 MB for the entire game. In other words, the game's own code and every feature it uses
accounted for 180 kB, and the other 6.7 MB was the barrel.

Switching the twenty-seven imported symbols to their own modules —
`@babylonjs/core/Meshes/meshBuilder`, `@babylonjs/core/Maths/math.vector` and so on — lets Rollup
drop what is not reached: **78 % off the entry chunk, 75 % off the transfer**. On a 10 Mbit
connection that is about ten seconds less before the first frame.

**The trap, and how it was caught.** Some of Babylon's API is not on the classes at all: it is added
to `Scene.prototype` by a module whose only job is that side effect. `scene.createPickingRay` is one
of them, and the barrel used to pull it in by accident. With deep imports it disappeared, the game
still built, typechecked and ran — and every weapon aimed by clicking the map silently did nothing.
Seven browser tests failed, which is exactly what they are for; `import '@babylonjs/core/Culling/ray'`
in `world.ts` asks for that side effect by name. Nothing else was lost: the shadows, the glow layer,
the post-processing pipeline, the particle systems and the shader-based water and sky all still
work, because each of those classes registers itself when its own module is imported.

**Frame cost in the browser is not benchmarked here on purpose.** The browser suite runs headless
with SwiftShader at about two frames a second, so its numbers say nothing about a real GPU; measure
with DevTools against `npm run dev` instead, using the snippet above.

## What the audit found sound

- **Fixed-step simulation** decoupled from the frame rate, with a cap on catch-up steps, so a slow
  frame cannot cascade.
- **Frame-rate cap and render scaling**: the canvas never draws more pixels than
  `MAX_RENDER_PIXELS` for the chosen quality, and the menu renders at a lower rate than a match.
- **Dirty-chunk terrain**: only the 32×32-cell chunks a blast touched are re-contoured, not the map.
- **`isPickable = false`** on everything that is not a click target, so picking a strike point does
  not walk the whole scene.
- **Seeded randomness** everywhere it matters, which is what makes the core benchmarks comparable
  between runs.
- **A graphics budget the player controls**: Full and Low in the setup menu, persisted with the
  other settings, with `?quality=low` in the URL as the escape hatch for a machine that cannot get
  as far as the menu. Low drops the shadow cascade, bloom and MSAA and halves the pixel density.

## Ideas that were measured and dropped

- **Splitting the heavy Babylon features into lazily loaded chunks** (shadows, the rendering
  pipeline, the glow layer) would shave a little more off the first load, but after the deep-import
  change the entry chunk is 374 kB gzipped and the split would buy tens of kilobytes at the cost of
  a loading path with two states. Not worth it yet.
- **Caching the weapon-bar DOM nodes** instead of querying them each frame: the query follows the 26 selectable weapon slots
  once per frame, far below anything measurable next to a WebGL draw.
