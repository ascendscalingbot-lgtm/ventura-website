const { test, expect } = require('@playwright/test');

const url = 'http://127.0.0.1:4173/stream.html?slug=clients-30k-dashboard-build';

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('renders the centered VMC header and thumbnail before the title', async ({ page }) => {
  const logo = page.locator('.brand-logo');
  const thumbnail = page.locator('.thumbnail-frame');
  const title = page.getByRole('heading', { level: 1 });

  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/assets/vmc-mint-monogram.png');
  await expect(title).toHaveText('The $30K Client Dashboard Build');

  const logoBox = await logo.boundingBox();
  const thumbnailBox = await thumbnail.boundingBox();
  const titleBox = await title.boundingBox();
  const viewportCenter = page.viewportSize().width / 2;
  expect(Math.abs((logoBox.x + logoBox.width / 2) - viewportCenter)).toBeLessThan(1);
  expect(thumbnailBox.y).toBeGreaterThan(logoBox.y);
  expect(titleBox.y).toBeGreaterThan(thumbnailBox.y + thumbnailBox.height);
});

test('preview button reveals all prompts without a form submission', async ({ page }) => {
  await expect(page.locator('#prompts')).toBeHidden();
  await expect(page.locator('form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview all prompts' }).click();
  await expect(page.locator('#prompts')).toBeVisible();
  await expect(page.locator('.prompt-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Copy all prompts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prompts are open' })).toHaveAttribute('aria-expanded', 'true');
});

test('copy interaction gives visible feedback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  await page.getByRole('button', { name: 'Preview all prompts' }).click();
  await page.locator('.copy-button').first().click();
  await expect(page.locator('#toast')).toHaveText('Copied to clipboard');
  await expect(page.locator('.copy-button').first()).toHaveText('Copied');
});

test('mobile preview has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Preview all prompts' }).click();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await page.screenshot({ path: '/tmp/ventura-stream-prompts-mobile-v3.png', fullPage: true });
});
