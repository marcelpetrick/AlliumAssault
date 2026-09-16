import { expect, test, type Page } from '@playwright/test';
import type { MatchConfig } from '../src/core/game';

interface BuddyState {
  name: string;
  team: number;
  hp: number;
  alive: boolean;
  x: number;
  y: number;
  aim: number;
}

interface AppState {
  demo: boolean;
  paused: boolean;
  screen: string | null;
  phase: string | null;
  turn: number;
  activeTeam: number;
  activeBuddy: string | null;
  humanTurn: boolean;
  weapon: string | null;
  charge: number | null;
  winner: number | null;
  terrainRevision: number;
  projectiles: number;
  sound: { charge: boolean; flights: number };
  buddies: BuddyState[];
}

interface Hook {
  ready: boolean;
  state(): AppState;
  startMatch(config: MatchConfig): void;
  fastForward(seconds: number): void;
}

declare global {
  interface Window {
    __allium: Hook;
  }
}

const state = (page: Page) => page.evaluate(() => window.__allium.state());
const waitFor = (page: Page, fn: (s: AppState) => boolean, timeout = 90_000) =>
  page.waitForFunction((src) => new Function('s', `return (${src})(s)`)(window.__allium.state()), fn.toString(), { timeout, polling: 'raf' });

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?quality=low');
  await page.waitForFunction(() => window.__allium?.ready, null, { timeout: 60_000 });
  return errors;
}

async function toHumanAiming(page: Page): Promise<AppState> {
  await waitFor(page, (s) => s.phase === 'aiming' && s.humanTurn);
  return state(page);
}

test('title screen runs a live 3D demo behind the menu', async ({ page }, info) => {
  const errors = await boot(page);
  await expect(page.getByRole('button', { name: /Quick Match/ })).toBeVisible();
  const s = await state(page);
  expect(s.demo).toBe(true);
  expect(s.screen).toBe('title');
  expect(s.buddies).toHaveLength(6);
  await page.waitForTimeout(1500);
  const shot = await page.screenshot();
  await info.attach('title', { body: shot, contentType: 'image/png' });
  expect(shot.byteLength).toBeGreaterThan(100_000);
  expect(errors).toEqual([]);
});

test('human turn: walk, jump, aim, shotgun crater, bazooka and retreat', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Quick Match/ }).click();
  const start = await toHumanAiming(page);
  expect(start.screen).toBeNull();
  const me = () => state(page).then((s) => s.buddies.find((b) => b.name === start.activeBuddy)!);
  const origin = await me();

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ([name, y]) => window.__allium.state().buddies.find((b) => b.name === name)!.y > y + 0.4,
    [start.activeBuddy, origin.y] as const,
    { timeout: 30_000, polling: 'raf' },
  );

  await page.keyboard.press('Digit3');
  await waitFor(page, (s) => s.weapon === 'shotgun', 10_000);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction((name) => window.__allium.state().buddies.find((b) => b.name === name)!.aim < -1.3, start.activeBuddy, {
    timeout: 60_000,
    polling: 'raf',
  });
  await page.keyboard.up('ArrowDown');
  const before = await state(page);
  await page.keyboard.press('Space');
  await page.waitForFunction((rev) => window.__allium.state().terrainRevision > rev, before.terrainRevision, { timeout: 30_000 });
  expect((await state(page)).phase).toBe('aiming');
  await info.attach('shotgun-crater', { body: await page.screenshot(), contentType: 'image/png' });

  await page.keyboard.press('Space');
  await waitFor(page, (s) => s.phase === 'retreat', 20_000);

  // Next turn belongs to the AI team; let it play, then it is our turn again.
  await page.evaluate(() => window.__allium.fastForward(60));
  await waitFor(page, (s) => s.turn >= 3 || s.phase === 'gameOver', 60_000);
  expect((await state(page)).turn).toBeGreaterThanOrEqual(3);

  // Bazooka: charge with Space and release.
  const next = await toHumanAiming(page);
  expect(next.humanTurn).toBe(true);
  await page.keyboard.press('Digit1');
  await page.keyboard.down('Space');
  await waitFor(page, (s) => (s.charge ?? 0) > 0.3, 30_000);
  expect((await state(page)).sound.charge).toBe(true);
  await info.attach('charging', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.up('Space');
  await waitFor(page, (s) => s.phase === 'retreat' || s.phase === 'settling', 20_000);
  // Firing on key-up happens between frames; sounds follow on the next frame.
  await waitFor(page, (s) => !s.sound.charge && (s.projectiles === 0 || s.sound.flights > 0), 10_000);
  expect(errors).toEqual([]);
});

test('AI vs AI match reaches the victory screen and offers a rematch', async ({ page }, info) => {
  const errors = await boot(page);
  await page.evaluate(() =>
    window.__allium.startMatch({
      seed: 'e2e-duel',
      teams: [
        { name: 'Red Roasters', color: '#ef4b3c', controller: 'ai', aiLevel: 'hard', buddyNames: ['Ruby'] },
        { name: 'Blue Bulbs', color: '#3d8bfd', controller: 'ai', aiLevel: 'hard', buddyNames: ['Blu'] },
      ],
      turnTime: 20,
      retreatTime: 2,
      windMax: 0,
      theme: 'night',
    }),
  );
  for (let round = 0; round < 60 && (await state(page)).phase !== 'gameOver'; round++) {
    await page.evaluate(() => window.__allium.fastForward(15));
  }
  expect((await state(page)).phase).toBe('gameOver');
  await expect(page.getByText(/wins!|Draw!/)).toBeVisible({ timeout: 90_000 });
  await info.attach('victory', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: /Rematch/ }).click();
  const s = await state(page);
  expect(s.phase).not.toBe('gameOver');
  expect(s.screen).toBeNull();
  expect(errors).toEqual([]);
});

test('custom match setup: add a team, change options, start', async ({ page }, info) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Custom Match/ }).click();
  await expect(page.getByRole('heading', { name: 'Custom Match' })).toBeVisible();
  await page.getByRole('button', { name: /Add team/ }).click();
  await expect(page.locator('.team-card:not(.add)')).toHaveCount(3);
  const third = page.locator('.team-card:not(.add)').nth(2);
  await third.locator('input.team-name').fill('Onion Outlaws');
  await third.getByRole('button', { name: 'AI Hard' }).click();
  await page.locator('.team-card:not(.add)').nth(0).getByRole('button', { name: '+' }).click();
  await page.getByRole('button', { name: '60s' }).click();
  await page.getByRole('button', { name: 'Moonlit Grove' }).click();
  await info.attach('setup', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: /Start Battle/ }).click();
  const s = await state(page);
  expect(s.demo).toBe(false);
  expect(s.screen).toBeNull();
  expect(s.buddies).toHaveLength(10);
  expect(new Set(s.buddies.map((b) => b.team)).size).toBe(3);
  await expect(page.locator('.team-bar-name', { hasText: 'Onion Outlaws' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pause menu: controls, resume and quit to title', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: /Quick Match/ }).click();
  await waitFor(page, (s) => !s.demo && s.phase !== null, 30_000);
  await page.keyboard.press('Escape');
  await waitFor(page, (s) => s.paused && s.screen === 'pause', 10_000);
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await waitFor(page, (s) => !s.paused && s.screen === null, 10_000);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Quit to title/ }).click();
  await waitFor(page, (s) => s.demo && s.screen === 'title', 10_000);
  expect(errors).toEqual([]);
});
