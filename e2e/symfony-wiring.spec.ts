import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('Symfony wiring — security invariants', () => {
  test('login puts tokens in httpOnly cookies, not JS-readable storage', async ({ page, context }) => {
    test.skip(!process.env.E2E_STUDENT_EMAIL, 'E2E credentials not configured');

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type=email]',    process.env.E2E_STUDENT_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_STUDENT_PASSWORD!);
    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/dashboard/);

    // access_token cookie exists and is httpOnly
    const cookies = await context.cookies();
    const access = cookies.find((c) => c.name === 'access_token');
    expect(access).toBeDefined();
    expect(access?.httpOnly).toBe(true);

    // document.cookie must NOT expose it
    const clientVisibleCookies = await page.evaluate(() => document.cookie);
    expect(clientVisibleCookies).not.toContain('access_token');
    expect(clientVisibleCookies).not.toContain('refresh_token');

    // sessionStorage carries user identity but no raw token
    const stored = await page.evaluate(() => window.sessionStorage.getItem('auth-storage'));
    expect(stored ?? '').not.toContain('access_token');
    expect(stored ?? '').not.toContain('refresh_token');
    // But should contain the user info
    expect(stored ?? '').toContain('isAuthenticated');
  });

  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('student opens a course via dashboard card', async ({ page }) => {
    test.skip(!process.env.E2E_STUDENT_EMAIL, 'E2E credentials not configured');

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type=email]',    process.env.E2E_STUDENT_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_STUDENT_PASSWORD!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/dashboard/);

    const firstCard = page.locator('[data-testid="course-card"]').first();
    // Cards may take a moment to render after /courses fetch
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Find the primary button inside the first card (Start/Continue)
    await firstCard.locator('button').click();
    await expect(page).toHaveURL(/\/course\/\d+/);
  });

  test('logout clears cookies and redirects to login', async ({ page, context }) => {
    test.skip(!process.env.E2E_STUDENT_EMAIL, 'E2E credentials not configured');

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type=email]',    process.env.E2E_STUDENT_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_STUDENT_PASSWORD!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Existing dashboard header has a sign-out button (see app/dashboard/layout.tsx)
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    const cookies = await context.cookies();
    const access = cookies.find((c) => c.name === 'access_token');
    // After logout the cookie is cleared (either absent or empty value with Max-Age=0)
    expect(access?.value ?? '').toBe('');
  });
});

test.describe('Admin gate', () => {
  test('student cannot reach /dashboard/admin/api-keys (notFound)', async ({ page }) => {
    test.skip(!process.env.E2E_STUDENT_EMAIL, 'E2E credentials not configured');

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type=email]',    process.env.E2E_STUDENT_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_STUDENT_PASSWORD!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Direct navigation — admin layout should return 404
    const response = await page.goto(`${BASE_URL}/dashboard/admin/api-keys`);
    expect(response?.status()).toBe(404);
  });

  test('admin can reach /dashboard/admin/api-keys and sees the table', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, 'E2E admin credentials not configured');

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type=email]',    process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`${BASE_URL}/dashboard/admin/api-keys`);
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();

    // All 11 provider rows render
    const rows = page.locator('tbody tr').filter({ has: page.locator('td.font-medium') });
    await expect(rows).toHaveCount(11);
  });
});
