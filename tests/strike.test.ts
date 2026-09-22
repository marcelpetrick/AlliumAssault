// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { groundBelow, planeAltitude, planStrike } from '../src/core/strike';
import { WEAPONS } from '../src/core/weapons';
import { flatTerrain } from './helpers';

describe('strike planning', () => {
  it('flies the plane clear of the ground under the target', () => {
    const t = flatTerrain(20);
    expect(planeAltitude(t)).toBeGreaterThan(20);
  });

  it('clears a hill that is nowhere near the target but is on the way', () => {
    const t = flatTerrain(20);
    const flat = planeAltitude(t);
    // A spire on the far side of the map: the plane crosses the level to reach anything.
    t.addDisc(30, 46, 9);
    const peak = groundBelow(t, 30);
    expect(peak).toBeGreaterThan(flat);
    expect(planeAltitude(t)).toBeGreaterThan(peak);
    // And the strike itself flies at that height, not at the height of the ground it is aimed at.
    const plan = planStrike(t, WEAPONS.airstrike, 100, 1, 0);
    expect(plan.ground).toBeLessThan(21);
    expect(plan.altitude).toBeGreaterThan(peak);
  });

  it('clears a floating island, which has sky under it as well as over it', () => {
    const t = flatTerrain(20);
    t.addDisc(64, 52, 7);
    const plan = planStrike(t, WEAPONS.airstrike, 20, 1, 0);
    // The island's top surface, and the plane above it.
    expect(plan.altitude).toBeGreaterThan(groundBelow(t, 64));
  });

  it('takes the altitude again once the terrain has been blown apart', () => {
    const t = flatTerrain(20);
    t.addDisc(40, 50, 8);
    const high = planeAltitude(t);
    t.carve(40, 50, 12);
    const after = planeAltitude(t);
    expect(after).toBeLessThan(high);
  });

  it('gives the bombs a longer fall when the plane has to fly higher, and still lands them on target', () => {
    const t = flatTerrain(20);
    const low = planStrike(t, WEAPONS.airstrike, 64, 1, 0);
    t.addDisc(20, 50, 9);
    const high = planStrike(t, WEAPONS.airstrike, 64, 1, 0);
    expect(high.altitude).toBeGreaterThan(low.altitude);
    // Bombs keep the plane's forward speed, so a longer fall means letting go earlier.
    expect(high.drops[0].x).toBeLessThan(low.drops[0].x);
    // Where they land is checked against the simulation in game.test.ts, not against the formula here.
  });

  it('drops a plane-less strike straight down, so it needs no path cleared', () => {
    const t = flatTerrain(20);
    const plan = planStrike(t, WEAPONS.mule, 64, 1, 0);
    expect(plan.startX).toBe(64);
    expect(plan.altitude).toBeGreaterThan(plan.ground);
  });
});
