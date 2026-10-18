import { test, expect, type Page } from '@playwright/test';

// Browser audit with deliberately rejected API calls. We never sign in to, or
// modify, a real account. Screenshots are saved as CI artifacts for visual review.
async function isolateProductionApi(page: Page): Promise<void> {
  await page.route('**/api/**', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Isolated navigation audit — no authenticated session' })
  }));
}

test.describe('Jynlo public-screen audit', () => {
  test.beforeEach(async ({ page }) => {
    await isolateProductionApi(page);
  });

  const publicScreens = [
    { path: '/home', name: 'home' },
    { path: '/about', name: 'about' },
    { path: '/contact', name: 'contact' },
    { path: '/login', name: 'login' },
    { path: '/login/registerNewUser', name: 'registration' },
    { path: '/login/resetPassword', name: 'password-reset' },
    { path: '/privacy', name: 'privacy' },
    { path: '/terms', name: 'terms' },
    { path: '/this-route-does-not-exist', name: 'not-found' }
  ] as const;

  for (const screen of publicScreens) {
    test(`opens ${screen.name} with a readable title, navigation and no overflow`,
      async ({ page }, testInfo) => {
        await page.goto(screen.path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        // The Angular host has no layout box: the fixed <nav> is the visible UI.
        await expect(page.locator('app-navbar .site-nav')).toBeVisible();
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `Horizontal overflow on ${screen.path}`).toBeLessThanOrEqual(4);
        await page.screenshot({
          path: `test-results/screen-audit/${testInfo.project.name}-${screen.name}.png`,
          fullPage: true
        });
      });
  }

  test('home page takes visitors to registration without an authenticated session', async ({ page }) => {
    await page.goto('/home');
    await page.locator('a[href="/login/registerNewUser"]').first().click();
    await expect(page).toHaveURL(/\/login\/registerNewUser/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('unknown path stays public even when background requests return 401', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/this-route-does-not-exist$/);
    await expect(page.locator('.not-found-card a[href="/home"]')).toBeVisible();
    await page.locator('.not-found-card a[href="/home"]').click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test('anonymous visitors are sent to login from private areas', async ({ page }) => {
    const protectedPaths = [
      '/menu/feed', '/menu/discover', '/menu/events',
      '/menu/createEvent', '/menu/my-sessions', '/menu/communities',
      '/menu/friendList', '/menu/perfis', '/menu/dadosPerfil',
      '/menu/notifications', '/menu/venues/new', '/menu/admin'
    ];
    for (const path of protectedPaths) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page).toHaveURL(/\/login\?/);
        expect(new URL(page.url()).searchParams.get('returnUrl')).toBe(path);
      });
    }
  });
});

test('mobile guest navigation exposes primary links and a menu for secondary pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only navigation');
  await isolateProductionApi(page);
  await page.goto('/home');
  const nav = page.locator('app-navbar .site-nav');
  await expect(nav.locator('a.register-link')).toBeVisible();
  await expect(nav.locator('a.login-link')).toBeVisible();
  const menu = nav.locator('details.guest-nav-menu');
  await expect(menu.locator('summary')).toBeVisible();
  const right = await menu.locator('summary').evaluate(el => el.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);

  await menu.locator('summary').click();
  await expect(menu.locator('a[href="/about"]')).toBeVisible();
  await expect(menu.locator('a[href="/contact"]')).toBeVisible();
  await expect(menu.locator('.language-switch button').first()).toBeVisible();
});
