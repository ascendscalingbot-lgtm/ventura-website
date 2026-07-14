const { test, expect } = require('@playwright/test');

const url = 'http://127.0.0.1:4173/stream.html?slug=clients-30k-dashboard-build';

async function unlock(page) {
  await page.getByLabel('First name').fill('Shayan');
  await page.getByLabel('Email address').fill('shayan@example.com');
  await page.getByRole('button', { name: 'Unlock the prompts' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('renders the VMC top bar and thumbnail before the title', async ({ page }) => {
  const logo = page.locator('.brand-logo');
  const navCta = page.getByRole('link', { name: 'Get the prompts' });
  const thumbnail = page.locator('.thumbnail-frame');
  const title = page.getByRole('heading', { level: 1 });

  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/assets/vmc-mint-monogram.png');
  await expect(navCta).toBeVisible();
  await expect(title).toHaveText('The $30K Client Dashboard Build');

  const logoBox = await logo.boundingBox();
  const ctaBox = await navCta.boundingBox();
  const thumbnailBox = await thumbnail.boundingBox();
  const titleBox = await title.boundingBox();
  expect(logoBox.x).toBeLessThan(ctaBox.x);
  expect(thumbnailBox.y).toBeGreaterThan(logoBox.y);
  expect(titleBox.y).toBeGreaterThan(thumbnailBox.y + thumbnailBox.height);
});

test('valid form hides the gate and reveals all prompts locally', async ({ page }) => {
  await expect(page.locator('#prompts')).toBeHidden();
  await expect(page.locator('#build-kit')).toBeVisible();
  await page.getByRole('button', { name: 'Unlock the prompts' }).click();
  await expect(page.locator('#prompts')).toBeHidden();

  await unlock(page);
  await expect(page.locator('#build-kit')).toBeHidden();
  await expect(page.locator('#prompts')).toBeVisible();
  await expect(page.locator('.prompt-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Copy all prompts' })).toBeVisible();
});

test('copy interaction gives visible feedback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  await unlock(page);
  await page.locator('.copy-button').first().click();
  await expect(page.locator('#toast')).toHaveText('Copied to clipboard');
  await expect(page.locator('.copy-button').first()).toHaveText('Copied');
});

test('mobile unlocked page and footer have no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlock(page);
  await expect(page.locator('.footer-logo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a strategy session' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await page.screenshot({ path: '/tmp/ventura-stream-prompts-mobile-v4.png', fullPage: true });
});
