# Touch display support — ideation

**Status:** design study, nothing implemented. Written for T87 so the work can be judged and
scheduled before any code is written.

The game is played today with a keyboard and a mouse. This document works out how the same match
could be played with nothing but fingers on glass, without taking anything away from the desktop
game, and what that would cost.

---

## 1. What the game actually asks of a player

Before designing buttons, the honest inventory. Every input the game needs, how often it is used,
and how forgiving it is:

| Input                        | Today                   | Frequency  | Precision needed               |
| ---------------------------- | ----------------------- | ---------- | ------------------------------ |
| Walk left / right            | ← →                     | Constant   | Low, but must be **held**      |
| Aim up / down                | ↑ ↓                     | Constant   | **High** — a degree decides it |
| Charge and fire              | Hold Space, release     | Every turn | **High** — timing is the power |
| Jump / back-flip             | Enter / Backspace       | Often      | Low, discrete                  |
| Pick a weapon                | 1–0, ⇧1–⇧0, T, Tab, bar | Every turn | Low, discrete (21 of them)     |
| Detonate a sheep             | Space again             | Rare       | Medium — timing                |
| Steer the flying sheep       | Arrow keys              | Rare       | High, continuous               |
| Rope: reel, swing, let go    | ↑↓ ←→, Space            | Rare       | High, continuous               |
| Strike / platform / teleport | Mouse click on the map  | Rare       | **High** — a spot on the map   |
| Platform tilt                | Mouse wheel             | Rare       | Medium                         |
| Air strike approach side     | ← →                     | Rare       | Low, discrete                  |
| Pan and zoom the camera      | Drag, wheel             | Constant   | Medium                         |
| Pause / help / mute          | Esc, HUD buttons, M     | Rare       | Low                            |

Three of those are the hard ones: **aim**, **charge**, and **a spot on the map**. Everything else is
a button.

Two facts decide the whole design. First, **a fingertip is about 9 mm**, so every target wants
44 CSS px and a little air around it — the current 38 px weapon slots are already below that.
Second, **a finger hides what it touches**, so nothing a player must watch may sit under a thumb:
the buddy, the aim line and the power bar have to stay in the clear.

---

## 2. Design goals

1. **One game, two input styles.** No touch-only mode, no cut-down rules. The same match, the same
   weapons, the same AI.
2. **Off by default, one tap away.** Exactly as requested: the overlay ships hidden. A device with a
   touchscreen is offered it once, politely, and the setting lives in the menus.
3. **Nothing important under a thumb.** Controls hug the bottom corners; the middle of the screen
   stays the battlefield.
4. **The overlay is furniture, not decoration.** Translucent, idle at low opacity, never animated
   for its own sake, gone entirely while the AI plays or a cut scene runs.
5. **No accidental turns.** Anything that spends ammo or ends a turn is confirmed on touch, because
   a mis-tap costs a turn and a mis-click never did.
6. **Every gesture has a button.** Gestures are shortcuts for people who find them; nothing is
   reachable _only_ by a gesture. (Pinch-zoom has a zoom button; two-finger rotate has a dial.)

---

## 3. The layout

Landscape is the primary orientation: the map is wide, and two thumbs on the short edges is the
natural artillery pose. Portrait is supported as a narrower variant, not a separate design.

```text
 ┌──────────────────────────────────────────────────────────────────────┐
 │  ┌ team ─────┐          ┌ turn ┐                    ┌ wind ┐ ┌ ☰ ┐   │   HUD, unchanged
 │  │ Ruby 100  │          │  37  │                    └──────┘ └───┘   │
 │  └───────────┘          └──────┘                                     │
 │                                                                      │
 │                          ·  the battlefield  ·                       │   never covered
 │                                                                      │
 │                                                                      │
 │   ┌───────┐                                              ┌────────┐  │
 │   │   ▲   │        ┌───────────────────────────┐         │  JUMP  │  │
 │   │ ◀ ✥ ▶ │        │ 🔫 🍌 🐑 …  weapons  ⌃    │         └────────┘  │
 │   │   ▼   │        └───────────────────────────┘      ┌──────────┐   │
 │   └───────┘                                           │   FIRE   │   │
 │    move/aim                                           │   ◍ hold │   │
 │                                                       └──────────┘   │
 └──────────────────────────────────────────────────────────────────────┘
```

- **Left thumb — the pad.** A single four-way control: ◀ ▶ walk, ▲ ▼ aim. Press and hold, exactly
  like the arrow keys, so all the existing repeat behaviour keeps working. It is one pad rather than
  two sticks because walking and aiming are never done at the same time — the game already shares
  the arrow keys between them.
- **Right thumb — act.** A large **FIRE** button that charges while held and fires on release, with
  the charge drawn as a ring filling around it (the power bar stays where it is, but the ring is
  under the thumb where the eye already is). **JUMP** above it; **back-flip** is a long-press on
  JUMP, or a second small button when the screen has room.
- **Weapons.** The existing weapon bar is already tappable; on touch it becomes a horizontally
  scrolling strip of 48 px slots with the current weapon centred, and a ⌃ handle that opens it into
  a three-row grid of all 21 with names. Tapping a weapon never fires it, so the grid can be
  explored safely.
- **Menus.** The ☰ button in the HUD (today's Pause/Help buttons) is the escape hatch; no gesture is
  needed to reach the menu.

### Portrait

The same pieces, stacked: the pad bottom-left, FIRE bottom-right, the weapon strip along the bottom
edge above them, and the map gets the top two-thirds. A hint on the title screen suggests turning
the device, but nothing is blocked.

---

## 4. The hard three

### 4.1 Aiming

Holding ▲ for a couple of degrees is fine, but fine aim under time pressure is not a held key, it is
a nudge. Proposal, in order of ambition:

1. **Held pad, as today.** Works, matches the keyboard exactly, no new rules. Ship this first.
2. **Aim wheel.** Dragging the pad's ▲/▼ arrows away from the pad turns the drag into a vertical
   fine-aim: 1 px of travel to a fixed small angle, so a slow drag is a precise aim. This is the
   one addition worth making for touch, because the keyboard has no equivalent need.
3. **Drag the aim line.** Touch the buddy and drag out an aim line, like a slingshot. Attractive,
   but it hides the buddy under the finger, and it fights the map-tap weapons. Rejected for now.

### 4.2 Charging

Hold FIRE, release to fire. The charge ring around the button shows the power, and a light haptic
tick at 50 % and 100 % gives the timing that the sound gives today. Two touch-specific safeguards:

- **Slide off to cancel.** Dragging the thumb off the button before lifting cancels the shot, the
  same as `cancelCharge()` does when the window loses focus. Without it, a mis-touch spends a turn.
- **A tap is a minimum-power shot**, not a mis-fire, because a tap is what a nervous thumb does.

### 4.3 A spot on the map (strike, platform, teleport)

Mouse hover has no touch equivalent, so the "preview follows the cursor" model has to become a
two-step:

1. **Tap the map** → the marker (or the platform preview, or the teleport target) appears there and
   stays. Nothing has been spent.
2. **Drag the marker** to adjust it; for the platform, a rotation dial appears beside it — a knob
   dragged with the other thumb, or two-finger twist for those who try it.
3. **Tap the ✓ button** that appears over the FIRE button → the strike is called, the board is set,
   the buddy is beamed.

The ✗ next to it cancels for free. This is slower than a mouse click on purpose: on touch it is the
difference between a considered placement and a wasted turn. The desktop flow does not change.

### 4.4 The rope and the flying sheep

Both repurpose the arrow keys, and the pad inherits that. While roping or guiding, the pad shows
different glyphs (reel in/out, swing, or a compass rose for the sheep) and a one-line caption above
it says what it does. FIRE becomes **LET GO** for the rope and **DETONATE** for the sheep — with no
confirm, because both are time-critical and both are already irreversible in the same way on
keyboard.

---

## 5. Camera

| Gesture                    | Does                                                |
| -------------------------- | --------------------------------------------------- |
| One-finger drag on the map | Pan (as the mouse drag does today)                  |
| Pinch                      | Zoom                                                |
| Double-tap on the map      | Recentre on the active buddy and resume auto-follow |
| Single tap on the map      | **Nothing**, unless a map weapon is selected        |

That last row matters: a tap must not be a click. Today a click on the map calls a strike whenever
one is selected; on touch, taps happen by accident all the time, hence the marker-and-confirm flow
above.

---

## 6. When the controls appear

- **Default: off.** The overlay does not exist until it is asked for.
- **The offer.** The first time a `pointerdown` with `pointerType === 'touch'` arrives in a match,
  a small non-modal card appears for a few seconds: _"Playing on a touchscreen? **Show controls** ·
  Not now"_. Choosing either answer is remembered; "Not now" never asks again in that session.
- **The setting.** `Touch controls: Off / On / Auto` in the setup screen and in the pause menu,
  beside the text-size setting, persisted with the other settings. **Auto** means: shown while the
  last input was a touch, hidden again the moment a key or a mouse is used — the right behaviour for
  a laptop with a touchscreen, and for a tablet with a keyboard case.
- **While the AI plays**, during the turn intro and on every menu screen, the overlay hides itself.

---

## 7. Comfort and accessibility

- **Handedness.** A mirror switch swaps the pad and the action cluster. Two taps in the menu.
- **Size.** The overlay scales with the existing text-size setting (Normal / Large / Huge), so one
  setting covers both.
- **Safe areas.** `env(safe-area-inset-*)` padding, so nothing sits under a notch or a home bar.
- **Haptics.** `navigator.vibrate` where it exists: a tick at full charge, a short buzz on taking
  damage. Silent by default if the device has no motor; never used for decoration.
- **No hover.** Everything currently explained by a `title` attribute needs a visible label or a
  long-press tooltip on touch.
- **Colour and contrast.** The overlay is white glyphs at 70 % on a 35 % dark plate, which keeps
  4.5:1 against both the sky and the rock; it dims to 35 % after three seconds without a touch.

---

## 8. Technical notes

- Input already goes through **pointer events**, so the pad and buttons are new DOM elements that
  synthesise the same intents the keyboard handler produces — best done by extracting the intent
  layer (`walk(-1)`, `aim(+1)`, `pressFire()`, …) so both input styles call the same functions and
  the rules core stays untouched.
- `touch-action: none` on the canvas and the overlay, to stop the browser's own pan and double-tap
  zoom; `user-select: none` so a long press does not select text.
- iOS Safari: the visual viewport shrinks when the browser chrome hides; use `dvh` units and listen
  to `visualViewport` rather than `100vh`.
- A **PWA manifest** with `display: fullscreen` and `orientation: landscape` would remove the
  browser chrome entirely for players who add the game to their home screen. Small change, large
  effect on a phone.
- Performance: the phone GPUs that matter run the game at `?quality=low` today. Worth measuring
  before promising anything; the overlay itself is DOM and costs nothing.
- **Tests.** Playwright supports touch emulation (`hasTouch`, `page.touchscreen.tap`, and device
  descriptors such as "Pixel 7" and "iPad Mini"), so the touch flows can be covered by the existing
  E2E suite: a second project with a touch device, one test per control (walk, aim, charge-and-fire,
  jump, weapon grid, marker-and-confirm, pinch-zoom), plus a test that the overlay stays hidden by
  default and appears when the setting is on.

---

## 9. What it would cost

| Phase  | Contents                                                                                                          | Rough size |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| **P1** | Intent layer extracted; pad, FIRE with charge ring, JUMP; setting and the offer card; overlay hiding rules; tests | 2–3 days   |
| **P2** | Weapon grid; marker-and-confirm for strike, platform and teleport; rope and sheep pad modes; camera gestures      | 2–3 days   |
| **P3** | Handedness, sizes, haptics, safe areas, PWA manifest, portrait layout, device-matrix screenshots                  | 1–2 days   |

P1 alone makes the game playable on a tablet. P2 makes every weapon usable. P3 is the polish that
decides whether it feels like a port or like a game that always had touch.

---

## 10. Open questions

1. **Phones as well as tablets?** A 5-inch screen can hold the controls, but the weapon grid and the
   map both get cramped. If phones matter, the weapon grid needs a search-free two-level menu and
   the camera needs a "fit the whole island" button.
2. **Is the confirm step welcome?** It is the safest choice, but it costs a tap on every strike. An
   alternative is tap-and-hold-to-commit (hold 400 ms on the target), which is one gesture instead
   of two but harder to discover.
3. **Should the desktop game gain any of this?** The platform rotation dial and the "fit the island"
   button are useful with a mouse too.
4. **How far back?** Supporting iOS Safari 15 and Chrome 100 costs a few CSS fallbacks (`dvh`,
   `env()`); supporting only current browsers costs nothing.
