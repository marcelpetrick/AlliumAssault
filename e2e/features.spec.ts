import { expect, test } from '@playwright/test';
import { boot, fastForward, played, select, startDuel, state, waitFor, waitForSound } from './support';

/** Crates, audio cues and HUD behaviour in real Google Chrome. */

test('crates: one teleports in on the next turn and heals or arms the buddy who grabs it', async ({ page }, info) => {
  const errors = await boot(page);
  await startDuel(page, { crates: 1 });
  expect((await state(page)).crates).toHaveLength(0);

  await page.evaluate(() => window.__allium.app.game!.skipTurn());
  await waitFor(page, (s) => s.phase === 'aiming' && s.turn === 2, 30_000);
  const s = await state(page);
  expect(s.crates).toHaveLength(1);
  expect(played(s, 'teleport')).toBe(1);
  await page.evaluate(() => window.__allium.stepFrames(20, 1 / 30));
  await info.attach('crate', { body: await page.screenshot(), contentType: 'image/png' });

  const crate = s.crates[0];
  const grabber = s.buddies.find((b) => b.name === s.activeBuddy)!;
  const ammoBefore = s.ammo!;
  await page.evaluate((c) => {
    const b = window.__allium.app.game!.activeBuddy!;
    b.body.x = c.x - 0.95;
    b.body.y = c.y + 0.2;
    b.body.vx = b.body.vy = 0;
  }, crate);
  await fastForward(page, 0.5);
  const after = await state(page);
  expect(after.crates).toHaveLength(0);
  if (crate.kind === 'health') {
    expect(after.buddies.find((b) => b.name === grabber.name)!.hp).toBe(grabber.hp + 25);
    expect(played(after, 'heal')).toBe(1);
  } else {
    const weapon = crate.weapon as keyof typeof ammoBefore;
    expect(after.ammo![weapon]).toBe(ammoBefore[weapon] + 1);
    expect(played(after, 'pickup')).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('audio cues: weapon select blip, turn start chime, last-seconds tick, mute silences', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);

  await select(page, 2, 'grenade');
  await waitFor(page, (s) => (s.sound.played as Record<string, number>).select >= 1, 10_000);

  // Wind the turn clock down to the last seconds and let real frames run.
  await page.evaluate(() => (window.__allium.app.game!.turnTimeLeft = 4.2));
  await waitFor(page, (s) => (s.sound.played as Record<string, number>).tick >= 1, 30_000);

  await page.evaluate(() => window.__allium.app.game!.skipTurn());
  await waitFor(page, (s) => s.turn === 2 && ((s.sound.played as Record<string, number>).turn ?? 0) >= 1, 30_000);

  await page.keyboard.press('KeyM');
  const muted = await state(page);
  await select(page, 1, 'bazooka');
  expect(played(await state(page), 'select')).toBe(played(muted, 'select'));
  await page.keyboard.press('KeyM');
  expect(errors).toEqual([]);
});

test('movement sounds: footsteps while walking, a hup when jumping, a thud on landing', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  await page.keyboard.down('ArrowRight');
  await waitForSound(page, 'step', 2);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await waitForSound(page, 'step', 4);
  await page.keyboard.up('ArrowLeft');
  await fastForward(page, 0.5);

  await page.keyboard.press('Backspace');
  await waitForSound(page, 'jump');
  await fastForward(page, 2);
  expect(played(await state(page), 'land')).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('HUD: weapon bar lists every weapon with ammo and follows the selection', async ({ page }) => {
  const errors = await boot(page);
  await startDuel(page);
  const slots = page.locator('.weapons .slot');
  const ids = await page.evaluate(() => Object.keys(window.__allium.state().ammo!));
  const selectable = await slots.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.weapon!));
  expect(selectable.length).toBeGreaterThanOrEqual(8);
  for (const id of selectable) expect(ids).toContain(id);
  await expect(page.locator('.slot[data-weapon="cluster"]')).toContainText('×3');
  const sheep = page.locator('.slot[data-weapon="sheep"]');
  await sheep.click();
  await waitFor(page, (s) => s.weapon === 'sheep', 10_000);
  await expect(sheep).toHaveClass(/on/);
  await expect(page.locator('.hint')).toContainText('release the sheep');
  expect(errors).toEqual([]);
});
