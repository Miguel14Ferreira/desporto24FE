import { expect, test, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

// The fixture token is used only on Angular's local test origin.
// Every API call is intercepted below; no production account or data is used.
function fixtureToken(username: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({ sub: username, exp: Math.floor(Date.now() / 1000) + 3600 }),
    'fixture'
  ].join('.');
}

async function mockDiscovery(page: Page, initiallyFailSessions: boolean, emptyResults = false) {
  await page.addInitScript(token => localStorage.setItem('t', token), fixtureToken('browser-tester'));
  let failSessions = initiallyFailSessions;
  const futureDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization,content-type'
  };

  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const reply = (data: unknown, status = 200) => route.fulfill({
      status, headers: cors, contentType: 'application/json', body: JSON.stringify(data)
    });

    if (req.method() === 'GET' && path === '/api/profile/browser-tester') {
      return reply({
        username: 'browser-tester', fullName: 'Jogador de teste',
        favoriteSports: '', location: '', profilePicUrl: null
      });
    }
    if (req.method() === 'GET' && path === '/api/venues') {
      return reply(emptyResults ? [] : [{
        id: 7, name: 'Recinto de teste', city: 'Lisboa', indoor: false,
        parking: false, venueType: null, ownershipType: 'PUBLIC'
      }]);
    }
    if (req.method() === 'GET' && path === '/api/sessions') {
      return failSessions
        ? reply({ message: 'Sessions temporarily unavailable' }, 503)
        : reply(emptyResults ? [] : [{
          id: 19, sport: 'Padel', city: 'Lisboa', gameDate: futureDate,
          distanceKm: null, participantCount: 2, maxParticipants: 4,
          priceAmount: 0, privateGame: false, audience: 'PUBLIC', status: 'OPEN'
        }]);
    }
    if (req.method() === 'GET' && path === '/api/sessions/19') {
      return reply({
        id: 19, sport: 'Padel', city: 'Lisboa', gameDate: futureDate,
        distanceKm: null, participantCount: 2, maxParticipants: 4, priceAmount: 0,
        privateGame: false, audience: 'PUBLIC', status: 'OPEN',
        joined: false, waitlisted: false, waitlistPosition: null,
        creatorUsername: null, canSeeExactAddress: false, gamePhoto: null, address: null
      });
    }
    if (req.method() === 'GET' && path === '/api/profile/search') {
      return reply(emptyResults ? [] : [{
        username: 'ana-teste', fullName: 'Ana Teste', location: 'Lisboa',
        favoriteSports: 'Padel', profilePicUrl: null
      }]);
    }
    if (req.method() === 'GET' && path === '/api/notifications/unread-count') {
      return reply(0);
    }

    // Unknown requests fail closed instead of accidentally reaching a real backend.
    return reply({ message: 'Unmocked E2E endpoint' }, 404);
  });

  return { recoverSessions: () => { failSessions = false; } };
}

test('Descobrir keeps successful categories visible when sessions fail and recovers on retry', async ({ page }) => {
  const fixture = await mockDiscovery(page, true);
  await page.goto('/menu/discover?city=Lisboa');

  const error = page.locator('.pillar-error--sessions');
  await expect(error).toContainText('Não foi possível procurar sessões.');
  await expect(page.locator('.session-empty')).toHaveCount(0);
  await expect(page.locator('.session-empty-create')).toHaveCount(0);
  await expect(page.locator('.venue-card')).toContainText('Recinto de teste');
  await expect(page.locator('.person-card')).toContainText('Ana Teste');
  await expect(page.locator('.discover-error')).toBeVisible();

  fixture.recoverSessions();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  const session = page.locator('.session-card');
  await expect(session).toContainText('Padel');
  await expect(session).toHaveAttribute('href', /\/menu\/events\/19\?/);
  const sessionHref = new URL((await session.getAttribute('href'))!, 'https://jynlo.test');
  expect(sessionHref.searchParams.get('join')).toBe('1');
  expect(sessionHref.searchParams.get('from')).toBe('discover');
  expect(sessionHref.searchParams.get('city')).toBe('Lisboa');
  await expect(error).toHaveCount(0);
  await expect(page.locator('.discover-error')).toHaveCount(0);
});

test('Descobrir only shows no-result copy when the search succeeds with no matches', async ({ page }) => {
  await mockDiscovery(page, false, true);
  await page.goto('/menu/discover?city=Lisboa');
  await expect(page.locator('.pillar-error--sessions')).toHaveCount(0);
  await expect(page.locator('.discover-error')).toHaveCount(0);
  await expect(page.locator('.session-empty')).toContainText('Sem atividades abertas');
  await expect(page.locator('.people-empty')).toContainText('Ainda sem correspondências');
  await expect(page.locator('.pillar-panel').first()).toContainText('Ainda não encontrámos locais');
});

test('Descobrir opens a session without auto-joining and returns to the same search', async ({ page }) => {
  await mockDiscovery(page, false);
  let joinRequests = 0;
  await page.route('**/api/sessions/19/join', async route => {
    joinRequests++;
    await route.fulfill({
      status: 403, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: '{"message":"Not allowed in E2E"}'
    });
  });
  await page.goto('/menu/discover?sport=Padel&city=Lisboa');
  await page.locator('.session-card').click();
  await expect(page).toHaveURL(/\/menu\/events\/19\?/);
  const back = page.locator('.back-link');
  await expect(back).toContainText('Voltar ao Descobrir');
  await expect(back).toHaveAttribute('href', '/menu/discover?sport=Padel&city=Lisboa');
  expect(joinRequests).toBe(0);

  await back.click();
  await expect(page).toHaveURL(/\/menu\/discover\?sport=Padel&city=Lisboa/);
  await expect(page.locator('input[name="sport"]')).toHaveValue('Padel');
  await expect(page.locator('input[name="location"]')).toHaveValue('Lisboa');
  await expect(page.locator('.session-card')).toContainText('Padel');
  expect(joinRequests).toBe(0);
});
