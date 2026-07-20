import { test, expect, type Page } from '@playwright/test';
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[aria-label="Email or Matric Number"]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
}

test.describe('Admin dashboard', () => {
  test('admin lands on /admin after login', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, 'admin creds missing');
    await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('admin hand-navigation to /dashboard is redirected to /admin', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, 'admin creds missing');
    await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('student hand-navigation to /admin is redirected to /dashboard', async ({ page }) => {
    test.skip(!process.env.E2E_STUDENT_EMAIL, 'student creds missing');
    await login(page, process.env.E2E_STUDENT_EMAIL!, process.env.E2E_STUDENT_PASSWORD!);
    await page.goto(`${BASE}/admin`);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
