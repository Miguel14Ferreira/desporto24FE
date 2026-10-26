/*
 * Isolated browser-level smoke test of the ACTUAL built frontend candidate.
 * HTTP API calls are intercepted and answered with synthetic data; the real
 * Jynlo backend, Render and its production database are never contacted.
 *
 * This checks real Angular routing/DOM in headless Chromium, not auth-provider,
 * MFA, database, notifications, or real-environment integration.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:4173';
const ARTIFACTS = path.resolve('artifacts/desktop-candidate');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const future = (days = 2) => new Date(Date.now() + days * 86_400_000).toISOString();
const summary = [
  { id: 42, sport: 'Padel', city: 'Lisboa', gameDate: future(2),
    participantCount: 3, maxParticipants: 4, status: 'OPEN', priceAmount: 0,
    privateGame: false, audience: 'PUBLIC', distanceKm: null },
  { id: 43, sport: 'Futsal', city: 'Porto', gameDate: future(3),
    participantCount: 4, maxParticipants: 4, status: 'FULL', priceAmount: 0,
    privateGame: false, audience: 'PUBLIC', distanceKm: null },
  { id: 44, sport: 'Futebol', city: 'Lisboa', gameDate: future(1),
    participantCount: 1, maxParticipants: 6, status: 'OPEN', priceAmount: 0,
    privateGame: true, audience: 'PUBLIC', distanceKm: null }
];
const previews = {
  42: { id: 42, sport: 'Padel', city: 'Lisboa', gameDate: future(2),
    maxParticipants: 4, participantCount: 3, priceAmount: 0,
    status: 'OPEN', gamePhoto: null },
  43: { id: 43, sport: 'Futsal', city: 'Porto', gameDate: future(3),
    maxParticipants: 4, participantCount: 4, priceAmount: 0,
    status: 'FULL', gamePhoto: null },
  45: { id: 45, sport: 'Basquetebol', city: 'Cascais',
    gameDate: 'broken-api-date', maxParticipants: 8,
    participantCount: 2, priceAmount: 0, status: 'OPEN', gamePhoto: null }
};
const venues = [
  { id: 201, name: 'Pavilhão de teste', city: 'Lisboa',
    address: 'Morada sintética', sports: 'Padel', informationSource: 'OFFICIAL' },
  { id: 202, name: 'Campo de teste', city: 'Porto',
    address: 'Morada sintética', sports: 'Futsal', informationSource: 'OFFICIAL' }
];

async function main() {
  const browser = await chromium.launch({
    headless: true, args: ['--no-sandbox'],
    ...(process.env.JYNLO_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {})
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-PT' });
  const pageErrors = [];
  const unexpectedCalls = [];
  const discoverQueries = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  const json = (route, status, data) => route.fulfill({
    status, contentType: 'application/json',
    headers: {
      'access-control-allow-origin': SITE,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*'
    },
    body: JSON.stringify(data)
  });

  // Synthetic API contract; ALL external network is blocked. Never use QA
  // credentials or fetch production data in this browser verification.
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === SITE) return route.continue();

    if (url.origin === 'https://api.d24sports.com') {
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: {
          'access-control-allow-origin': SITE,
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': '*'
        } });
      }
      if (url.pathname === '/api/sessions' && request.method() === 'GET') {
        discoverQueries.push(url.searchParams.toString());
        const sport = (url.searchParams.get('sport') || '').toLowerCase();
        const city = (url.searchParams.get('city') || '').toLowerCase();
        return json(route, 200, summary.filter(x =>
          x.sport.toLowerCase().includes(sport) && x.city.toLowerCase().includes(city)));
      }
      if (url.pathname === '/api/venues/suggest' && request.method() === 'GET') {
        const sport = (url.searchParams.get('sport') || '').toLowerCase();
        const city = (url.searchParams.get('city') || '').toLowerCase();
        return json(route, 200, { page: 0, hasMore: false,
          venues: venues.filter(x =>
            x.sports.toLowerCase().includes(sport) && x.city.toLowerCase().includes(city)) });
      }
      const m = /^\/api\/sessions\/(\d+)\/public-preview$/.exec(url.pathname);
      if (m && request.method() === 'GET') {
        const item = previews[Number(m[1])];
        return json(route, item ? 200 : 404, item || { message: 'Not found' });
      }
      if (url.pathname === '/api/pilot/events/access' && request.method() === 'POST') {
        // Anonymous public analytics event: discard it in the synthetic backend.
        return json(route, 200, {});
      }
      if (url.pathname === '/api/auth/refresh' && request.method() === 'POST') {
        // A guest has no refresh cookie; a 401 is normal and must not sign in.
        return json(route, 401, { message: 'Guest' });
      }
      if (url.pathname === '/api/auth/google/config' && request.method() === 'GET') {
        return json(route, 200, { clientId: '' });
      }
      unexpectedCalls.push(request.method() + ' ' + url.pathname);
      return json(route, 404, { message: 'Mock not configured' });
    }

    // No contact with unrelated third parties. CSS network fallbacks are
    // intentionally empty; screenshots represent candidate UI with local CSS.
    if (request.resourceType() === 'stylesheet') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    return route.abort('blockedbyclient');
  });

  async function go(route) {
    await page.goto(SITE + route, { waitUntil: 'domcontentloaded' });
  }
  async function snapshot(name) {
    await page.screenshot({ path: path.join(ARTIFACTS, name + '.png'), fullPage: true });
  }
  function hrefReturnUrl() {
    const parsed = new URL(page.url());
    return parsed.searchParams.get('returnUrl');
  }
  function checkNoRuntimeErrors(step) {
    assert.deepEqual(pageErrors, [], step + ': unexpected JS errors');
  }

  try {
    await go('/');
    await page.locator('.home-page .preview-panel a.preview-item').first().waitFor();
    const homeCards = page.locator('.home-page a.preview-item');
    assert.equal(await homeCards.count(), 2, 'public home excludes the private session');
    assert.equal(await page.locator('.home-page .preview-venue').count(), 2,
      'public home shows bounded synthetic venues');
    assert.match(await homeCards.nth(1).innerText(), /Futsal/i);
    assert.ok((await homeCards.nth(1).innerText()).match(/lotad|chei|full/i),
      'FULL session has an explicit full indicator');
    await snapshot('01-public-home');
    checkNoRuntimeErrors('home');

    const sport = page.locator('form.preview-search input[name="sport"]');
    const city = page.locator('form.preview-search input[name="city"]');
    await sport.fill('Padel');
    await city.fill('Lisboa');
    await page.locator('form.preview-search button[type="submit"]').click();
    await page.waitForFunction(() =>
      document.querySelectorAll('.home-page a.preview-item').length === 1);
    assert.ok(discoverQueries.some(q => q.includes('sport=Padel') && q.includes('city=Lisboa')),
      'filter sent only the selected sport/city to mocked catalogue');
    assert.equal(await page.locator('.home-page .preview-venue').count(), 1);
    checkNoRuntimeErrors('public search');

    // Reproduce navigation from a scrolled home: route changes must reset
    // scroll position, or the fixed navbar hides the public session header.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    assert.ok(await page.evaluate(() => window.scrollY) > 0,
      'home page should be scrolled before navigating to the public preview');
    await page.locator('.home-page a.preview-item').first().click();
    await page.locator('.public-session-page .join-panel .primary-action').waitFor();
    await page.waitForFunction(() => window.scrollY <= 1, null, { timeout: 4000 });
    assert.equal(new URL(page.url()).pathname, '/sessions/42');
    assert.match(await page.locator('.session-facts').innerText(), /Lisboa/);
    await snapshot('02-open-session');
    await page.locator('.join-panel .primary-action').click();
    await page.waitForURL(u => u.pathname === '/login/registerNewUser');
    assert.equal(hrefReturnUrl(), '/menu/events/42?join=1',
      'registration preserves intent to join the chosen game');
    await page.locator('.login-card, .register-page, form').first().waitFor();
    await snapshot('03-registration-return');
    checkNoRuntimeErrors('registration navigation');

    await go('/sessions/42');
    await page.locator('.join-panel a[routerlink="/login"]').waitFor();
    await page.locator('.join-panel a[routerlink="/login"]').click();
    await page.waitForURL(u => u.pathname === '/login');
    assert.equal(hrefReturnUrl(), '/menu/events/42?join=1',
      'existing-player login preserves safe internal session return URL');
    await page.locator('.login-page form').waitFor();
    await snapshot('04-login-return');

    await go('/sessions/43');
    await page.locator('.join-panel .primary-action').waitFor();
    assert.match(await page.locator('.join-panel').innerText(), /lista de espera/i,
      'full game must advertise the waitlist rather than promise an open spot');
    await snapshot('05-full-session-waitlist');
    checkNoRuntimeErrors('waitlist preview');

    await go('/sessions/45');
    await page.locator('.session-facts').waitFor();
    const dateFacts = page.locator('.session-facts .fact strong');
    assert.equal((await dateFacts.nth(1).innerText()).trim(), 'Por indicar');
    assert.equal((await dateFacts.nth(2).innerText()).trim(), 'Por indicar');
    assert.equal(await page.locator('.join-panel .primary-action').count(), 0,
      'malformed date must not offer participation');
    await snapshot('06-invalid-date-fallback');
    checkNoRuntimeErrors('malformed date preview');

    await go('/sessions/999');
    await page.locator('.public-session-page .error-state').waitFor();
    assert.equal(await page.locator('.public-session-page .retry-action').count(), 0,
      '404 should not suggest retrying a missing session');
    await go('/sessions/0');
    await page.locator('.public-session-page .error-state').waitFor();
    assert.equal(await page.locator('.public-session-page .join-panel').count(), 0,
      'malformed session ID must not show join action');
    checkNoRuntimeErrors('invalid public links');

    // Premium responsive smoke: real 390px Chromium viewport with synthetic API.
    // Never contact production or rely on a desktop-sized screenshot for mobile claims.
    await page.setViewportSize({ width: 390, height: 844 });
    const checkMobile = async (label, selectors) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 4, label + ': horizontal document overflow ' + overflow + 'px');
      for (const selector of selectors) {
        const node = page.locator(selector).first();
        await node.waitFor({ state: 'visible' });
        const box = await node.boundingBox();
        assert.ok(box && box.width > 8 && box.x >= -3 && box.x + box.width <= 393,
          label + ': ' + selector + ' clipped beyond the mobile viewport: ' + JSON.stringify(box));
      }
      checkNoRuntimeErrors(label);
    };
    await go('/');
    await page.locator('.home-page .preview-search').waitFor();
    await checkMobile('mobile home', ['.home-page .hero', '.home-page .preview-search',
      '.home-page .preview-search input[name="sport"]', '.home-page .preview-search button[type="submit"]']);
    await snapshot('13-mobile-home');

    await go('/sessions/42');
    await page.locator('.public-session-page .join-panel .primary-action').waitFor();
    await checkMobile('mobile public session', ['.public-session-page .session-main',
      '.public-session-page .join-panel', '.public-session-page .join-panel .primary-action']);
    await snapshot('14-mobile-open-session');

    await go('/sessions/43');
    await page.locator('.public-session-page .join-panel .primary-action').waitFor();
    await checkMobile('mobile full-session waitlist', ['.public-session-page .session-main',
      '.public-session-page .join-panel']);
    assert.match(await page.locator('.join-panel').innerText(), /lista de espera/i);
    await snapshot('15-mobile-full-session');

    assert.deepEqual(unexpectedCalls, [], 'no unexpected production API calls should be made');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 4, 'desktop UI has unexpected horizontal overflow: ' + overflow);
    console.log('PASS: desktop journeys + three real 390px Chromium responsive scenarios; no browser JS exceptions.');
    console.log('PASS: all API data synthetic and intercepted; no production credentials or requests.');
  } catch (error) {
    await snapshot('FAILED-browser-state').catch(() => {});
    console.error(error);
    if (pageErrors.length) console.error('Browser JS errors:', pageErrors);
    if (unexpectedCalls.length) console.error('Unexpected mocked API calls:', unexpectedCalls);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
