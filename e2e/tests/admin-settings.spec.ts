import { test, expect, type Page } from '@playwright/test';
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

async function loginAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[aria-label="Email or Matric Number"]', process.env.E2E_ADMIN_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_ADMIN_PASSWORD!);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('Admin settings + browsing', () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, 'admin creds missing');
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('students: matric filter narrows results', async ({ page }) => {
    await page.goto(`${BASE}/admin/students`);
    await page.fill('input[aria-label="Matric filter"]', 'CS');
    const req = await page.waitForRequest(
      (r) => r.url().includes('/students') && r.url().includes('matric=CS'),
      { timeout: 2000 },
    );
    expect(req.url()).toContain('matric=CS');
  });

  test('settings index redirects to api-keys', async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await expect(page).toHaveURL(/\/admin\/settings\/api-keys$/);
  });

  test('branding page renders form', async ({ page }) => {
    await page.goto(`${BASE}/admin/settings/branding`);
    await expect(page.getByLabel(/school name/i)).toBeVisible();
  });

  test('ai-config route renders settings body', async ({ page }) => {
    await page.goto(`${BASE}/admin/settings/ai-config`);
    // After dynamic import resolves, the provider list should be reachable
    await expect(page.locator('text=/provider|language/i').first()).toBeVisible({ timeout: 5000 });
  });
});
