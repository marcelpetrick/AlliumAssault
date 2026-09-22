// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Small pure geometry the scene needs and Babylon does not provide. Nothing here touches Babylon
 * or the DOM, so it can be unit tested directly rather than only through the browser suite.
 */

/** A point on the gameplay plane, or anywhere else two coordinates are enough. */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Pick a spot along a scatter band where the ground is clear of the water, or report that there is
 * none.
 *
 * The background hills fade to just under the waterline at the front and back of each band, so the
 * dry part of a band is narrower than the band itself and moves with the noise. Each candidate is
 * tried in turn and the first dry one wins; `margin` is how far above the water the ground has to
 * be, which needs to cover however far the decoration is sunk into it.
 */
export function dryScatter(height: (t: number) => number, waterLevel: number, margin: number, candidates: readonly number[]): number | null {
  for (const t of candidates) if (height(t) > waterLevel + margin) return t;
  return null;
}

/**
 * Where to draw a marker that has to appear under the mouse while sitting in front of the gameplay
 * plane.
 *
 * A cursor picked on the plane at z = 0 and then drawn at z = -0.8 is not under the mouse any more:
 * moving a point towards the camera also moves it across the screen, and the further from the
 * centre the worse it looks. The answer is to keep the marker on the same view ray and only travel
 * along it, which is what this returns.
 */
export function onViewRay(eye: { x: number; y: number; z: number }, onPlane: Vec2, z: number): Vec2 {
  if (eye.z === 0) return { x: onPlane.x, y: onPlane.y };
  const f = (z - eye.z) / -eye.z;
  return { x: eye.x + (onPlane.x - eye.x) * f, y: eye.y + (onPlane.y - eye.y) * f };
}
