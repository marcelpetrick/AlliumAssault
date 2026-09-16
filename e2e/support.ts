// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, type Page } from '@playwright/test';
import type { MatchConfig } from '../src/core/game';
import type { AlliumHook } from '../src/main';

export type AppState = ReturnType<AlliumHook['state']>;

declare global {
  interface Window {
    __allium: AlliumHook;
  }
}

export const state = (page: Page): Promise<AppState> => page.evaluate(() => window.__allium.state());

/** Wait until `fn(state)` holds; `fn` is serialised into the page, so it cannot use closures. */
export const waitFor = (page: Page, fn: (s: AppState) => boolean, timeout = 90_000) =>
  page.waitForFunction((src) => new Function('s', `return (${src})(s)`)(window.__allium.state()), fn.toString(), { timeout, polling: 'raf' });

/** Open the game in Chrome and collect console errors. */
export async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__allium?.ready, null, { timeout: 60_000 });
  return errors;
}

export async function toHumanAiming(page: Page): Promise<AppState> {
  await waitFor(page, (s) => s.phase === 'aiming' && s.humanTurn);
  return state(page);
}

/** Two human teams of one buddy each, no wind: a calm arena for testing one feature at a time. */
export function duel(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    seed: 'e2e-arena',
    teams: [
      { name: 'Red Roasters', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Ruby'] },
      { name: 'Blue Bulbs', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Blu'] },
    ],
    turnTime: 90,
    retreatTime: 3,
    windMax: 0,
    crates: 0,
    theme: 'meadow',
    ...overrides,
  };
}

/**
 * Start a duel and wait for the first human turn. A key press unlocks Web Audio, as a real player's
 * first input would, so sound effects are produced and recorded.
 */
export async function startDuel(page: Page, overrides: Partial<MatchConfig> = {}): Promise<AppState> {
  await page.evaluate((config) => window.__allium.startMatch(config), duel(overrides));
  await page.keyboard.press('Shift');
  return toHumanAiming(page);
}

/** Times a sound effect has been played so far. */
export const played = (s: AppState, sfx: string): number => (s.sound.played as Record<string, number | undefined>)[sfx] ?? 0;

/**
 * Wait until a sound effect has played at least `count` times. Key and mouse handlers change the
 * game immediately, but events (and their sounds) are dispatched on the next frame.
 */
export const waitForSound = (page: Page, sfx: string, count = 1) =>
  page.waitForFunction(([name, n]) => ((window.__allium.state().sound.played as Record<string, number>)[name] ?? 0) >= n, [sfx, count] as const, {
    timeout: 20_000,
    polling: 'raf',
  });

/** Advance the simulation instantly by `seconds`. */
export const fastForward = (page: Page, seconds: number) => page.evaluate((t) => window.__allium.fastForward(t), seconds);

/** Point the active buddy: aim angle in radians above horizontal, facing ±1. */
export const aim = (page: Page, angle: number, facing: 1 | -1 = 1) =>
  page.evaluate(
    ([a, f]) => {
      const g = window.__allium.app.game!;
      g.activeBuddy!.aim = a;
      g.face(f as 1 | -1);
    },
    [angle, facing] as const,
  );

/** Select a weapon with its hotkey (`'1'`…`'0'`, `'Shift+1'`…) and wait until the game switched. */
export async function select(page: Page, key: string, weapon: string): Promise<void> {
  await page.keyboard.press(key.replace(/(\d)$/, 'Digit$1'));
  await page.waitForFunction((w) => window.__allium.state().weapon === w, weapon, { timeout: 10_000 });
}

/** Hold Space until the charge reaches `level`, then release. */
export async function chargeAndRelease(page: Page, level: number): Promise<void> {
  await page.keyboard.down('Space');
  await page.waitForFunction((l) => (window.__allium.state().charge ?? 0) >= l, level, { timeout: 60_000, polling: 'raf' });
  await page.keyboard.up('Space');
}

export async function expectNoErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([]);
}
