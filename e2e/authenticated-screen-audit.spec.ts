import { Buffer } from 'node:buffer';
import { expect, test, type Page } from '@playwright/test';

// Use a deliberately unsigned fixture token against a local Angular server only.
// Every backend call is intercepted; no production user or database is accessed.
function isolatedToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({ sub: 'auditor-ficticio', exp: Math.floor(Date.now() / 1000) + 3600 }),
    'fixture-only'
  ].join('.');
}

async function isolateBackend(page: Page): Promise<void> {
  await page.addInitScript(token => localStorage.setItem('t', token), isolatedToken());
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'The audit is testing an unavailable API, not production.' })
  }));
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
        await expect(page.locator('app-navbar')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.screenshot({
          path: `test-results/screen-audit/${testInfo.project.name}-offline-${screen.name}.png`,
          fullPage: true
        });
      });
  }
});
