import { Buffer } from 'node:buffer';
import { expect, test, type Page } from '@playwright/test';

// Use a deliberately unsigned fixture token against a local Angular server only.
// Every backend call is intercepted; no production user or database is accessed.
function isolatedToken(admin = false): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({ sub: 'auditor-ficticio', exp: Math.floor(Date.now() / 1000) + 3600,
      Authorities: admin ? ['ROLE_ADMIN'] : [] }),
    'fixture-only'
  ].join('.');
}

async function isolateBackend(page: Page, admin = false): Promise<void> {
  await page.addInitScript(token => localStorage.setItem('t', token), isolatedToken(admin));
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'The audit is testing an unavailable API, not production.' })
  }));
  if (admin) {
    // Only the authorization probe succeeds; all admin page data remains mocked
    // as temporarily unavailable, so no real user information is accessed.
    await page.route('**/api/admin/access', route => route.fulfill({ status: 204 }));
  }
  // The authenticated navbar normally connects to realtime chat. Never connect
  // a fixture token to a real production WebSocket endpoint.
  await page.routeWebSocket('**/ws/chat', socket => socket.close());
}

test.describe('Jynlo protected-screen offline resilience', () => {
  test.beforeEach(async ({ page }) => {
    await isolateBackend(page);
  });

  const screens = [
    { path: '/menu/feed', name: 'feed' },
    { path: '/menu/discover', name: 'discover' },
    { path: '/menu/events', name: 'find-sessions' },
    { path: '/menu/createEvent', name: 'create-session' },
    { path: '/menu/my-sessions', name: 'my-sessions' },
    { path: '/menu/communities', name: 'communities' },
    { path: '/menu/perfis', name: 'find-people' },
    { path: '/menu/friendList', name: 'messages' },
    { path: '/menu/notifications', name: 'notifications' },
    { path: '/menu/dadosPerfil', name: 'my-profile' },
    { path: '/menu/alterardados', name: 'edit-profile' },
    { path: '/menu/alterarPassword', name: 'change-password' },
    { path: '/menu/venues/new', name: 'suggest-venue' }
  ] as const;

  for (const screen of screens) {
    test(`${screen.name} keeps usable navigation when the API is unavailable`,
      async ({ page }, testInfo) => {
        await page.goto(screen.path);
        await expect(page).toHaveURL(new RegExp(screen.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
        // The navbar host has zero height because its inner <nav> is fixed.
        await expect(page.locator('app-navbar .site-nav')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.screenshot({
          path: `test-results/screen-audit/${testInfo.project.name}-offline-${screen.name}.png`,
          fullPage: true
        });
      });
  }
});

test.describe('Jynlo administrator offline-screen audit', () => {
  test.beforeEach(async ({ page }) => {
    await isolateBackend(page, true);
  });

  const screens = [
    { path: '/menu/admin', name: 'dashboard' },
    { path: '/menu/admin/players', name: 'players' },
    { path: '/menu/admin/attendance-disputes', name: 'attendance-disputes' },
    { path: '/menu/admin/ideas', name: 'ideas' },
    { path: '/menu/admin/reports', name: 'reports' }
  ] as const;

  for (const screen of screens) {
    test(`admin ${screen.name} remains readable on API failure`,
      async ({ page }, testInfo) => {
        await page.goto(screen.path);
        await expect(page).toHaveURL(new RegExp(screen.path + '$'));
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.screenshot({
          path: `test-results/screen-audit/${testInfo.project.name}-admin-${screen.name}.png`,
          fullPage: true
        });
      });
  }
});

test('mobile signed-in navigation keeps Feed, Discover and the secondary Menu accessible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only navigation');
  await isolateBackend(page);
  await page.goto('/menu/feed');
  const nav = page.locator('app-navbar .site-nav');
  await expect(nav.locator('a.compact-feed-link')).toBeVisible();
  await expect(nav.locator('a[href="/menu/discover"].compact-primary')).toBeVisible();
  const menu = nav.locator('details.account-menu');
  await expect(menu.locator('summary')).toBeVisible();
  const right = await menu.locator('summary').evaluate(el => el.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);

  await menu.locator('summary').click();
  await expect(menu.locator('a[href="/menu/communities"]')).toBeVisible();
  await expect(menu.locator('a[href="/menu/friendList"]')).toBeVisible();
  await expect(menu.locator('a[href="/menu/notifications"]')).toBeVisible();
  await expect(menu.locator('a[href="/menu/createEvent"]')).toBeVisible();
});

test('desktop opens an explored community despite failure loading private memberships',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop discovery audit');
    await isolateBackend(page);
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 19, name: 'Desporto da Vila', description: 'Jogos abertos',
        sport: 'Futebol', sports: ['Futebol'], photoUrl: null, visibility: 'PUBLIC'
      })
    }));

    await page.goto('/menu/communities/19');
    await expect(page).toHaveURL(/\/menu\/communities\/19$/);
    await expect(page.locator('.community-detail-identity h2')).toHaveText('Desporto da Vila');
    await expect(page.locator('.community-detail-identity')).toContainText('Jogos abertos');
    await expect(page.getByRole('button', { name: /Aderir|Entrar/i }).first()).toBeVisible();
    await expect(page.locator('app-navbar .site-nav')).toBeVisible();
  });
