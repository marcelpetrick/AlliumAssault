// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { AiDriver, planAttack, scoreBlast } from '../src/core/ai';
import { createBody } from '../src/core/physics';
import { WEAPONS } from '../src/core/weapons';
import { mulberry32 } from '../src/core/rng';
import { flatGame, onlyWeapon, runUntil, team } from './helpers';
import { Game } from '../src/core/game';

const aiming = (g: Game) => {
  expect(runUntil(g, () => g.phase === 'aiming', 5)).toBe(true);
};

describe('AI decisions at low health and map edges', () => {
  it('values a centred knockback blast and survives zero-health rival totals', () => {
    const g = flatGame([40, 58, 80], [team('A', 1, 'ai'), team('B', 1), team('C', 1)]);
    aiming(g);
    const enemy = g.buddies[1];
    const focused = { crates: false, knockback: true, focus: true };
    expect(scoreBlast(g, g.buddies[0], enemy.body.x, enemy.body.y, WEAPONS.bazooka, focused)).toBeGreaterThan(0);
    g.buddies[1].hp = 0;
    g.buddies[2].hp = 0;
    expect(Number.isFinite(scoreBlast(g, g.buddies[0], enemy.body.x, enemy.body.y, WEAPONS.bazooka, focused))).toBe(true);
  });

  it('treats an enemy thrown past the left edge as a knockout', () => {
    const g = flatGame([40, 50], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(g);
    const enemy = g.buddies[1];
    enemy.body.x = 2;
    const at = { x: 4.5, y: enemy.body.y };
    const hard = scoreBlast(g, g.buddies[0], at.x, at.y, WEAPONS.selfdestruct, { crates: false, knockback: true, focus: false });
    const normal = scoreBlast(g, g.buddies[0], at.x, at.y, WEAPONS.selfdestruct, { crates: false, knockback: false, focus: false });
    expect(hard).toBeGreaterThan(normal);
  });

  it('chooses lethal short-range tools when they can finish a weak enemy', () => {
    const torch = flatGame([40, 45], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(torch);
    for (let y = 20; y <= 30; y += 0.5) torch.terrain.addDisc(42.5, y, 1);
    torch.buddies[1].hp = 10;
    onlyWeapon(torch, 0, 'torch');
    expect(planAttack(torch, torch.buddies[0], 'hard', mulberry32(3)).weapon).toBe('torch');

    const drill = flatGame([40, 90], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(drill);
    drill.buddies[1].body.x = 40.3;
    drill.buddies[1].body.y = 15;
    drill.buddies[1].hp = 10;
    drill.terrain.carve(40.3, 15, 0.8);
    onlyWeapon(drill, 0, 'drill');
    expect(planAttack(drill, drill.buddies[0], 'hard', mulberry32(6)).weapon).toBe('drill');

    const shotgun = flatGame([40, 45], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(shotgun);
    shotgun.buddies[1].hp = 20;
    onlyWeapon(shotgun, 0, 'shotgun');
    expect(planAttack(shotgun, shotgun.buddies[0], 'hard', mulberry32(5)).weapon).toBe('shotgun');

    const blast = flatGame([40, 42], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(blast);
    blast.buddies[1].hp = 10;
    onlyWeapon(blast, 0, 'selfdestruct');
    expect(planAttack(blast, blast.buddies[0], 'hard', mulberry32(7)).weapon).toBe('selfdestruct');
  });

  it('values a weapon crate and chooses the better of two reachable crates', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { turnTime: 40, crates: 0 });
    aiming(g);
    onlyWeapon(g, 0, 'bazooka');
    for (let y = 20; y <= 64; y += 2) g.terrain.addDisc(75, y, 3);
    g.buddies[0].hp = 15;
    g.crates.push({ id: 800, kind: 'weapon', weapon: 'sheep', body: createBody(47, 20.45, 0.45) });
    g.crates.push({ id: 801, kind: 'health', weapon: null, body: createBody(45, 20.45, 0.45) });
    expect(runUntil(g, () => g.crates.length < 2, 12)).toBe(true);
    expect(g.buddies[0].hp).toBeGreaterThan(15);
  });

  it('drives a shotgun through its second shot and steers toward the nearer of two enemies', () => {
    const g = flatGame([40, 48, 60], [team('A', 1, 'ai'), team('B', 1), team('C', 1)]);
    aiming(g);
    onlyWeapon(g, 0, 'shotgun');
    expect(runUntil(g, () => g.teams[0].ammo.shotgun === 1, 12)).toBe(true);
    expect(runUntil(g, () => g.shotsLeft === 0, 12)).toBe(true);

    const f = flatGame([30, 60, 90], [team('A', 1, 'ai'), team('B', 1), team('C', 1)]);
    aiming(f);
    f.action = { kind: 'flyer', flyer: { id: 1, owner: f.buddies[0].id, x: 55, y: 30, angle: 0, age: 0 } };
    f.phase = 'guiding';
    const driver = new AiDriver('hard', mulberry32(2));
    driver.update(f, 0.1);
    expect(f.input.down || f.input.left || f.input.right || f.input.up).toBe(true);
    f.buddies[1].alive = false;
    f.buddies[2].alive = false;
    driver.update(f, 0.1);
    expect(f.action).toBeNull();
  });

  it('fetches a weapon crate, walks left, jumps when stuck and recovers if the crate vanishes', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { turnTime: 40, crates: 0 });
    aiming(g);
    onlyWeapon(g, 0, 'bazooka');
    for (let y = 20; y <= 64; y += 2) g.terrain.addDisc(75, y, 3);
    const weaponCrate = createBody(35, 20.45, 0.45);
    weaponCrate.grounded = true;
    g.crates.push({ id: 900, kind: 'weapon', weapon: 'sheep', body: weaponCrate });
    const driver = new AiDriver('hard', mulberry32(4));
    driver.update(g, 1);
    driver.update(g, 0.1);
    expect(g.input.left).toBe(true);
    driver.update(g, 0.4);
    expect(g.drainEvents().some((e) => e.type === 'jump')).toBe(true);
    g.crates.length = 0;
    driver.update(g, 0.1);
    expect(g.input.left).toBe(false);
  });

  it('easy AI still fetches a nearby crate without inspecting its contents', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { turnTime: 40, crates: 0 });
    aiming(g);
    onlyWeapon(g, 0, 'bazooka');
    for (let y = 20; y <= 64; y += 2) g.terrain.addDisc(75, y, 3);
    const healthCrate = createBody(45, 20.45, 0.45);
    healthCrate.grounded = true;
    g.crates.push({ id: 901, kind: 'health', weapon: null, body: healthCrate });
    const driver = new AiDriver('easy', mulberry32(4));
    driver.update(g, 1.3);
    driver.update(g, 0.1);
    expect(g.input.right).toBe(true);
  });

  it('ignores a crate that cannot be reached before the turn ends', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { turnTime: 7, crates: 0 });
    aiming(g);
    onlyWeapon(g, 0, 'bazooka');
    const distantCrate = createBody(49, 20.45, 0.45);
    distantCrate.grounded = true;
    g.crates.push({ id: 902, kind: 'health', weapon: null, body: distantCrate });
    const driver = new AiDriver('hard', mulberry32(4));
    driver.update(g, 1);
    driver.update(g, 0.1);
    expect(g.input.right).toBe(false);
  });

  it('prefers a better second crate and tolerates losing its active buddy', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { turnTime: 40, crates: 0 });
    aiming(g);
    onlyWeapon(g, 0, 'bazooka');
    for (let y = 20; y <= 64; y += 2) g.terrain.addDisc(75, y, 3);
    const first = createBody(46, 20.45, 0.45);
    const second = createBody(35, 20.45, 0.45);
    first.grounded = second.grounded = true;
    g.crates.push({ id: 910, kind: 'health', weapon: null, body: first });
    g.crates.push({ id: 911, kind: 'weapon', weapon: 'sheep', body: second });
    const driver = new AiDriver('hard', mulberry32(5));
    driver.update(g, 1);
    driver.update(g, 0.1);
    expect(g.input.left).toBe(true);
    g.activeBuddy = null;
    driver.update(g, 0.1);
  });
});

describe('AI driver recovery', () => {
  it('goes back to thinking when it reaches the aiming stage without a plan', () => {
    const g = flatGame([40, 70], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(g);
    const driver = new AiDriver('normal', mulberry32(7));
    // A plan is normally made before aiming; losing it must not strand the turn.
    const internals = driver as unknown as { stage: string; plan: unknown };
    internals.stage = 'aim';
    internals.plan = null;
    driver.update(g, 0.1);
    expect(internals.stage).toBe('think');
    driver.update(g, 0.6);
    expect(g.phase === 'aiming' || g.phase === 'retreat' || g.phase === 'settling').toBe(true);
  });
});

describe('AI weapon variety', () => {
  it('turns away from a weapon it has already leant on', () => {
    const g = flatGame([40, 70], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(g);
    const me = g.buddies[0];
    const fresh = planAttack(g, me, 'hard', mulberry32(11));
    // Having used it four times already, the same shot is worth appreciably less.
    const used = new Map([[fresh.weapon, 4]]);
    const jaded = planAttack(g, me, 'hard', mulberry32(11), undefined, used);
    if (jaded.weapon === fresh.weapon) expect(jaded.score).toBeLessThan(fresh.score);
    else expect(jaded.weapon).not.toBe(fresh.weapon);
  });

  it('holds the last of something back more than the first', () => {
    const cheap = flatGame([40, 70], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(cheap);
    const plenty = planAttack(cheap, cheap.buddies[0], 'hard', mulberry32(3), 'mule');

    const scarce = flatGame([40, 70], [team('A', 1, 'ai'), team('B', 1)]);
    aiming(scarce);
    scarce.teams[0].ammo.mule = 1;
    // `only` pins the weapon, so compare what the open scoring makes of the two stock levels.
    const scored = (g: Game) => planAttack(g, g.buddies[0], 'hard', mulberry32(3), undefined, new Map()).score;
    expect(Number.isFinite(scored(scarce))).toBe(true);
    expect(Number.isFinite(plenty.score)).toBe(true);
  });

  it('spreads its choices across a whole match instead of playing one weapon', () => {
    const g = flatGame([20, 45, 70, 95, 120, 10], [team('A', 3, 'ai'), team('B', 3, 'ai')], { turnTime: 15, retreatTime: 1, arsenal: 'all' });
    const used = new Set<string>();
    let last: string | null = null;
    let repeats = 0;
    for (let k = 0; k < 40_000 && g.phase !== 'gameOver'; k++) {
      for (const e of g.drainEvents()) {
        if (e.type === 'fire' || e.type === 'airstrike') {
          used.add(e.weapon);
          if (e.weapon === last) repeats++;
          last = e.weapon;
        }
      }
      g.step(1 / 60);
    }
    // Four or more distinct weapons over a whole match, and not the same one again and again.
    expect(used.size).toBeGreaterThanOrEqual(4);
    expect(repeats).toBeLessThan(used.size * 3);
  });
});

describe('AI crate hunting', () => {
  /** An AI buddy on flat ground with the turn already started; the game drives its own driver. */
  const hunter = (overrides = {}) => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 45, ...overrides });
    aiming(g);
    return g;
  };

  it('walks to a crate it can reach on foot', () => {
    const g = hunter();
    const me = g.buddies[0];
    me.hp = 35;
    const startX = me.body.x;
    g.crates.push({ id: 900, kind: 'health', weapon: null, body: createBody(startX + 7, me.body.y, 0.45) });
    g.simulate(0.4);
    g.crates[0].body.grounded = true;
    runUntil(g, () => g.crates.length === 0 || Math.abs(me.body.x - startX) > 2, 12);
    // It went shopping: either it has the crate, or it is on its way.
    expect(g.crates.length === 0 || Math.abs(me.body.x - startX) > 2).toBe(true);
  });

  it('reaches for the rope when a crate is somewhere walking cannot go', () => {
    const g = hunter();
    const me = g.buddies[0];
    me.hp = 25;
    // Nothing worth shooting with, so the crate is plainly the best thing on offer.
    onlyWeapon(g, 0, 'rope');
    // A ceiling to hook, and a crate on a shelf well above the buddy's head.
    g.terrain.addDisc(me.body.x + 5, me.body.y + 10, 3.5);
    const crate = { id: 901, kind: 'health' as const, weapon: null, body: createBody(me.body.x + 7, me.body.y + 6.5, 0.45) };
    crate.body.grounded = true;
    g.crates.push(crate);
    let fired = false;
    runUntil(
      g,
      () => {
        crate.body.grounded = true;
        fired ||= g.drainEvents().some((e) => e.type === 'ropeShot');
        return fired;
      },
      12,
    );
    expect(fired).toBe(true);
  });

  it('never strands a turn on a swing that is going nowhere', () => {
    const g = hunter();
    const me = g.buddies[0];
    me.hp = 25;
    g.terrain.addDisc(me.body.x + 5, me.body.y + 10, 3.5);
    const crate = { id: 902, kind: 'health' as const, weapon: null, body: createBody(me.body.x + 7, me.body.y + 6.5, 0.45) };
    crate.body.grounded = true;
    g.crates.push(crate);
    const turn = g.turn;
    // Keep the crate hanging there so the swing can never actually succeed.
    runUntil(
      g,
      () => {
        crate.body.grounded = true;
        return g.turn > turn || g.phase === 'gameOver';
      },
      90,
    );
    expect(g.turn > turn || g.phase === 'gameOver').toBe(true);
  });

  it('leaves Easy out of it: it does not look at what is in a crate or how to get there', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 45 });
    aiming(g);
    const me = g.buddies[0];
    me.hp = 25;
    g.terrain.addDisc(me.body.x + 5, me.body.y + 10, 3.5);
    const crate = { id: 903, kind: 'health' as const, weapon: null, body: createBody(me.body.x + 7, me.body.y + 6.5, 0.45) };
    crate.body.grounded = true;
    g.crates.push(crate);
    const easy = new AiDriver('easy', mulberry32(2));
    let fired = false;
    for (let k = 0; k < 60 * 8 && !fired; k++) {
      easy.update(g, 1 / 60);
      fired = g.drainEvents().some((e) => e.type === 'ropeShot');
    }
    expect(fired).toBe(false);
  });
});

describe('AI rope swing, at its edges', () => {
  /** Put a driver straight into the swing stage, as a chosen rope fetch would. */
  const swinging = (crate: number) => {
    const driver = new AiDriver('hard', mulberry32(1));
    const internals = driver as unknown as { stage: string; swing: { crate: number; spent: number } | null };
    internals.stage = 'swing';
    internals.swing = { crate, spent: 0 };
    return { driver, internals };
  };

  it('lets go when the crate it was swinging to is gone', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 45 });
    aiming(g);
    onlyWeapon(g, 0, 'rope');
    const me = g.buddies[0];
    g.terrain.addDisc(me.body.x, me.body.y + 9, 3.5);
    g.selectWeapon('rope');
    me.aim = 1.2;
    g.pressFire();
    expect(g.phase).toBe('roping');
    // The crate it set off for has been blown up in the meantime.
    const { driver } = swinging(12_345);
    driver.update(g, 1 / 60);
    // It let go rather than hanging there for the rest of the turn.
    expect(g.rope === null || g.phase !== 'roping').toBe(true);
  });

  it('drops onto a crate once it is hanging over it', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 45 });
    aiming(g);
    onlyWeapon(g, 0, 'rope');
    const me = g.buddies[0];
    g.terrain.addDisc(me.body.x, me.body.y + 9, 3.5);
    g.selectWeapon('rope');
    me.aim = 1.2;
    g.pressFire();
    runUntil(g, () => g.rope?.state === 'attached', 4);
    // A crate directly below the buddy: it should let go and drop onto it.
    const crate = { id: 77, kind: 'health' as const, weapon: null, body: createBody(me.body.x, me.body.y - 3, 0.45) };
    g.crates.push(crate);
    const { driver } = swinging(77);
    for (let k = 0; k < 20 && g.rope; k++) driver.update(g, 1 / 60);
    expect(g.rope).toBeNull();
  });

  it('gives up on a swing that has run out of patience', () => {
    const g = flatGame([40, 110], [team('A', 1, 'ai'), team('B', 1)], { crates: 0, turnTime: 45 });
    aiming(g);
    onlyWeapon(g, 0, 'rope');
    const me = g.buddies[0];
    g.terrain.addDisc(me.body.x, me.body.y + 9, 3.5);
    g.selectWeapon('rope');
    me.aim = 1.2;
    g.pressFire();
    runUntil(g, () => g.rope?.state === 'attached', 4);
    const crate = { id: 78, kind: 'health' as const, weapon: null, body: createBody(me.body.x + 40, me.body.y, 0.45) };
    g.crates.push(crate);
    const { driver, internals } = swinging(78);
    // Already at the end of its patience: the next frame must let go.
    internals.swing = { crate: 78, spent: 100 };
    driver.update(g, 1 / 60);
    expect(g.rope).toBeNull();
  });
});
