import { expect, test } from '@playwright/test';

test('boots a WebGL scene without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __allium?: { ready: boolean } }).__allium?.ready);
  await expect(page.locator('#stage')).toBeVisible();
  expect(errors).toEqual([]);
});
