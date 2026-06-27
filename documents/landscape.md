# Allium Assault — Landscape Visual Specification

Distilled from Worms 2 (1997) and Worms Armageddon (1999) reference material.

---

## Worms Visual DNA

What makes Worms terrain feel like Worms:

1. **Thick outlined cartoon look** — every terrain chunk has a near-black 1px outline on its
   exposed sides and bottom. This makes shapes pop against the sky.
2. **Surface gradient** — the very top 1-3px of terrain is bright (grass, sand, snow); it
   transitions quickly to a darker soil band, then to deep rock. Never flat-colored all the
   way through.
3. **Horizontal rock strata** — interior rock has subtle horizontal banding every ~18–24px,
   suggesting geological layers. Alternating between slightly lighter and slightly darker.
4. **Rich sky gradient** — background darkens from top to bottom (or top to horizon). Never
   a flat sky. Night themes: deep navy to purple. Day themes: bright cyan to pale blue.
5. **Chunky silhouettes** — shapes are organic, wide islands and thick land masses, not
   spiky thin spires. Edges are smooth blobs not jagged pixels.
6. **Theme-consistent everything** — sky, terrain color, water color, and decorations all
   belong to the same palette world.
7. **Layered depth** — background (stars/moon/trees) + sky + terrain + water + characters.
   Each layer has a distinct z depth.

---

## Terrain Layer Anatomy

```
AIR
─────────────────────────────  ← outline edge (1px near-black)
GRASS TOP   depth 0   bright colour  e.g. #6ACA35
GRASS MID   depth 1   slightly darker
GRASS DARK  depth 2   even darker
─────────────────────────────
SOIL LIGHT  depth 3–5  earthy brown / theme soil
SOIL DARK   depth 6–10 deeper, richer
─────────────────────────────
ROCK BAND A ┐
ROCK BAND B ├ repeating ~18px cycle, horizontal strata
ROCK BAND C ┘ + deterministic noise variation per pixel
─────────────────────────────  ← outline edge on sides / bottom
AIR / WATER
```

**Edge rule**: any solid pixel that borders air on its LEFT, RIGHT, or BOTTOM face gets the
theme's `outline` colour (very dark). Top-face border becomes the bright grass/sand top layer.

---

## The 5 Themes

### 🌲 FOREST (default, night)

Inspired by the classic Worms Armageddon "Earth" theme. Deep blue night sky, rich green
terrain, warm brown rock interior.

| Layer       | Colour   | Notes                    |
|-------------|----------|--------------------------|
| Sky top     | `#0D1B3E` | Midnight navy            |
| Sky horizon | `#1D3D70` | Dark royal blue          |
| Grass top   | `#6ACA35` | Bright lime green        |
| Grass mid   | `#4EA324` | Medium green             |
| Grass dark  | `#3A7C1A` | Deep shadowed green      |
| Soil light  | `#8B5A2A` | Warm earthy brown        |
| Soil dark   | `#6B3F1A` | Darker soil              |
| Rock A      | `#5A3412` | Deep brown (main)        |
| Rock B      | `#7B5030` | Lighter strata band      |
| Rock C      | `#3D2208` | Dark crevice band        |
| Outline     | `#1A0A00` | Near-black warm          |
| Water deep  | `#0A3070` | Deep ocean blue          |
| Water mid   | `#1A4FA8` | Mid blue                 |
| Water shine | `#5099CC` | Surface shimmer          |

Background: Moon (large ivory disc), 200 random stars (varied alpha), tree silhouettes
in the lower-left parallax layer (dark pine triangles at 30% scroll speed).

Decorations: Short grass tufts (2–3px tall, bright green), small daisy flowers (white/yellow
dots on 1px stems), occasional round mushroom (brown cap, cream stem).

---

### 🏖️ BEACH (day)

Inspired by Worms Armageddon "Beach" theme. Bright sky, golden sand, tropical water.

| Layer       | Colour   | Notes                    |
|-------------|----------|--------------------------|
| Sky top     | `#42B3D8` | Bright cyan-blue         |
| Sky horizon | `#98E0F5` | Very light at horizon    |
| Grass top   | `#E8C86C` | Sand gold                |
| Grass mid   | `#D4A84A` | Darker sand              |
| Grass dark  | `#BE8E30` | Damp packed sand         |
| Soil light  | `#C4963A` | Wet sand                 |
| Soil dark   | `#A07228` | Deep compacted sand      |
| Rock A      | `#907020` | Sand stone               |
| Rock B      | `#A88030` | Lighter stripe           |
| Rock C      | `#785818` | Dark crevice             |
| Outline     | `#3A2800` | Dark warm brown          |
| Water deep  | `#0A6B9E` | Tropical ocean           |
| Water mid   | `#1A8ABE` | Lighter ocean            |
| Water shine | `#66CCE8` | Surf shimmer             |

Background: Bright blue sky gradient, distant layered sky bands suggesting heat haze.
No moon, no stars.

Decorations: Seashells (tiny arc shapes), palm leaf sprigs (green fork shapes on stems),
occasional crab (tiny red shape).

---

### 🔥 HELL (fire)

Inspired by Worms Armageddon "Hell" theme. Near-black to deep crimson sky. Blood-red rock.
Lava instead of water.

| Layer       | Colour   | Notes                    |
|-------------|----------|--------------------------|
| Sky top     | `#0A0000` | Near-black               |
| Sky horizon | `#4A0808` | Deep blood red           |
| Grass top   | `#A82020` | Red-rock surface         |
| Grass mid   | `#882010` | Darker red               |
| Grass dark  | `#681808` | Deep crimson             |
| Soil light  | `#7A1A0A` | Dark red soil            |
| Soil dark   | `#5A1008` | Very dark                |
| Rock A      | `#4A0C06` | Obsidian black-red       |
| Rock B      | `#6A1A10` | Lighter hellfire band    |
| Rock C      | `#300A04` | Darkest crevice          |
| Outline     | `#100000` | Near-black               |
| Water deep  | `#CC2200` | Lava red                 |
| Water mid   | `#FF4400` | Orange lava              |
| Water shine | `#FF9900` | Hot lava glow            |

Background: Near-black sky, faint red glow at horizon, sparse ember particles (orange dots,
varied alpha). No moon, no stars, no trees.

Decorations: Bone fragments (tiny white cross shapes), flame licks (2-3px orange spikes
at random surface points).

---

### ❄️ SNOW (arctic night)

Inspired by Worms Armageddon "Snow" / arctic theme. Deep indigo night sky, pristine white
snow surface, icy interior.

| Layer       | Colour   | Notes                    |
|-------------|----------|--------------------------|
| Sky top     | `#060A1A` | Near-black indigo        |
| Sky horizon | `#1A2A4A` | Dark slate blue          |
| Grass top   | `#EEF4FF` | Pure bright snow         |
| Grass mid   | `#C8DCF0` | Blue-tinted snow         |
| Grass dark  | `#A0C0E0` | Icy blue                 |
| Soil light  | `#8BB0D0` | Packed snow              |
| Soil dark   | `#6A90B8` | Deep ice                 |
| Rock A      | `#3A5878` | Dark blue-grey ice       |
| Rock B      | `#4A6A90` | Lighter ice strata       |
| Rock C      | `#283A54` | Near-black ice           |
| Outline     | `#0A1020` | Dark navy outline        |
| Water deep  | `#0A2040` | Frozen ocean             |
| Water mid   | `#1A3A6A` | Cold dark blue           |
| Water shine | `#4A7AAA` | Ice shimmer              |

Background: Deep space indigo sky, large full moon (blue-white tint), many dense stars,
faint aurora borealis hint (green tint along top 20% of sky).

Decorations: Snowflake dots (white, occasional), icicle spikes (hanging 2–4px from
underside of platform overhangs), tiny snowdrift mounds.

---

### 🧀 CHEESE (space)

Inspired by Worms Armageddon "Cheese" theme. A planet of cheese floating in deep purple
space. Yellow/golden terrain, alien-coloured water.

| Layer       | Colour   | Notes                    |
|-------------|----------|--------------------------|
| Sky top     | `#08001A` | Deep space black-purple  |
| Sky horizon | `#1A0840` | Purple nebula            |
| Grass top   | `#F0D820` | Bright cheese yellow     |
| Grass mid   | `#D4B812` | Darker yellow            |
| Grass dark  | `#B89808` | Golden cheese            |
| Soil light  | `#C8A810` | Cheese interior          |
| Soil dark   | `#A88808` | Deeper cheese            |
| Rock A      | `#907008` | Old cheese brown         |
| Rock B      | `#B08010` | Lighter strata           |
| Rock C      | `#705800` | Dark rind crevice        |
| Outline     | `#201800` | Near-black brown         |
| Water deep  | `#1A0080` | Alien purple             |
| Water mid   | `#3000C0` | Bright purple fluid      |
| Water shine | `#7040FF` | Neon shimmer             |

Background: Deep space, dense starfield, one large bright star or planet visible (white
disc with slight glow). No moon, no trees.

Decorations: Cheese holes (circular dark dents in solid terrain, not actual holes — just
dark round spots), tiny alien antennae (2px tall fork shapes on random surface pixels).

---

## Decorative Element Rules

- Placed deterministically from world position hash — same seed = same flowers.
- Never overlap or block spawn points.
- Placed at the very top 2–3px of surface pixels only (no decoration inside rock).
- One element maximum per 20-pixel span (avoid crowding).
- Element height: 2–5px above surface. Never tall enough to block character movement.

---

## Water Rendering

- **Three-layer stack** (bottom to top):
  1. Deep water fill: `waterDeep` at 85% alpha, from waterLevel to world bottom.
  2. Mid water zone: `waterMid` at 50% alpha, from waterLevel to waterLevel + 60px depth.
  3. Shimmer strips: `waterShimmer` at 30% alpha, horizontal strips 4px tall spaced 12px
     apart, offset every 0.8s for a gentle wave animation.
- **Surface line**: 2px bright shimmer colour at `waterLevel - 1`, alpha 0.7.
- **No wave mesh needed** — the shimmer strips + surface line sell the effect.

---

## Sky Gradient Implementation

Draw 20 horizontal strips from top to bottom, linearly interpolating from `skyColorTop`
to `skyColorHorizon`. At z-depth -10 (behind everything). Width = full world width.

For themes with `hasStars: true`:
- 200 stars at deterministic positions `(i * 7919) % worldW`, `(i * 6131) % (worldH * 0.6)`.
- Star radius 1px, alpha varies 0.3–0.9 by index.
- Stars only in upper 60% of world height.

For themes with `hasMoon: true`:
- Large disc at (worldW * 0.78, worldH * 0.07), radius 55, colour `#FFFDE0`, alpha 0.9.
- Glow halo: radius 70, same colour, alpha 0.12.

For `hasTreeSilhouettes: true`:
- 40 pine triangles at y = worldH * 0.55–0.65, dark `#1A3A22`, 60% alpha.
- Scroll factor 0.3 (parallax).
