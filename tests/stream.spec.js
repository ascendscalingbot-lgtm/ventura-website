const { test, expect } = require('@playwright/test');

const url = 'http://127.0.0.1:4173/stream.html?slug=clients-30k-dashboard-build';

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('ventura-stream-prompts-unlocked', 'true'));
  await page.reload();
});

test('renders the stream kit and all prompts', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The $30K Client Dashboard Build');
  await expect(page.locator('.prompt-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Copy all prompts' })).toBeVisible();
  await expect(page.locator('#prompts')).toBeVisible();
});

test('copy interaction gives visible feedback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  await page.locator('.copy-button').first().click();
  await expect(page.locator('#toast')).toHaveText('Copied to clipboard');
  await expect(page.locator('.copy-button').first()).toHaveText('Copied');
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await page.screenshot({ path: '/tmp/ventura-stream-prompts-mobile.png', fullPage: true });
});
