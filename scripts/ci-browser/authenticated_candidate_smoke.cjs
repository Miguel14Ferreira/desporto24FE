/*
 * Isolated desktop smoke: the login UI and authenticated community workflows.
 * This test uses fictitious credentials, an unsigned synthetic browser token
 * and a fully intercepted API. It MUST NOT contact production or use QA secrets.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:4173';
const ARTIFACTS = path.resolve('artifacts/desktop-candidate');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const token = [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: 'synthetic-browser-user',
    Authorities: ['ROLE_USER'],
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url'),
  'synthetic'
].join('.');

const community = (id, visibility, extras = {}) => ({
  id,
  name: id === 901 ? 'QA Clube Aberto' : id === 902 ? 'QA Grupo Privado' : 'QA Comunidade Criada',
  description: 'Conteúdo exclusivamente sintético',
  sport: 'Futebol',
  sports: ['Futebol'],
  photoUrl: null,
  visibility,
  rankingsEnabled: false,
  individualTournamentsEnabled: false,
  teamTournamentsEnabled: false,
  ownerUsername: 'synthetic-browser-user',
  myRole: id === 903 ? 'OWNER' : null,
  memberCount: 1,
  createdAt: new Date().toISOString(),
  members: [],
  ...extras
});
const presentations = [
  community(901, 'PUBLIC'),
  community(902, 'PRIVATE')
];
const seen = [];
const unexpected = [];
const errors = [];
let privateJoinRequests = 0;
let publicJoinRequests = 0;
let createdCommunity = null;
let featureChoice = null;

async function main() {
  const browser = await chromium.launch({
    headless: true, args: ['--no-sandbox'],
    ...(process.env.JYNLO_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {})
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-PT' });
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const json = (route, status, data) => route.fulfill({
    status, contentType: 'application/json',
    headers: {
      'access-control-allow-origin': SITE,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers': '*'
    },
    body: JSON.stringify(data)
  });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === SITE) return route.continue();

    if (url.origin === 'https://api.d24sports.com') {
      const method = request.method();
      const endpoint = method + ' ' + url.pathname;
      seen.push(endpoint);

      if (method === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: {
          'access-control-allow-origin': SITE,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
          'access-control-allow-headers': '*'
        } });
      }
      // Best-effort telemetry and heartbeat: acknowledge only in this isolated mock.
      if (endpoint === 'POST /api/pilot/events/access') return json(route, 200, {});
      if (endpoint === 'POST /api/presence/heartbeat') return json(route, 200, {});
      if (endpoint === 'GET /api/auth/google/config') return json(route, 200, { clientId: '' });
      if (endpoint === 'POST /api/auth/refresh') return json(route, 401, { message: 'Synthetic refresh rejected' });
      if (endpoint === 'POST /api/auth/login') {
        const fields = request.postDataJSON();
        if (fields.username !== 'synthetic-browser-user') {
          unexpected.push('Unexpected username in synthetic login');
          return json(route, 401, { message: 'Synthetic login rejected' });
        }
        if (fields.password !== 'synthetic-browser-password') {
          return json(route, 401, { message: 'Credenciais sintéticas inválidas' });
        }
        return json(route, 200, { token });
      }
      if (endpoint === 'GET /api/notifications/me/unread-count') return json(route, 200, 0);
      if (endpoint === 'GET /api/communities/mine') return json(route, 200, createdCommunity ? [createdCommunity] : []);
      // Current owned-community quota contract: five simultaneous groups, no daily cap.
      if (endpoint === 'GET /api/communities/creation-quota') {
        return json(route, 200, { owned: createdCommunity ? 1 : 0, limit: 5, canCreate: true });
      }
      if (endpoint === 'GET /api/communities/invites/me') return json(route, 200, []);
      if (endpoint === 'GET /api/communities/search') {
        const query = (url.searchParams.get('name') || '').toLowerCase();
        return json(route, 200, {
          communities: presentations.filter(x => x.name.toLowerCase().includes(query)),
          page: 0,
          hasMore: false
        });
      }
      if (endpoint === 'GET /api/communities/902/presentation') return json(route, 200, presentations[1]);
      if (endpoint === 'GET /api/communities/901/presentation') return json(route, 200, presentations[0]);
      if (endpoint === 'GET /api/communities/902/join-requests/me') return json(route, 200, null);
      if (endpoint === 'POST /api/communities/902/join-requests') {
        privateJoinRequests++;
        return json(route, 200, {
          id: 700, communityId: 902, communityName: presentations[1].name,
          requesterUsername: 'synthetic-browser-user', status: 'PENDING',
          createdAt: new Date().toISOString()
        });
      }
      if (endpoint === 'POST /api/communities/901/join') {
        publicJoinRequests++;
        return json(route, 200, community(901, 'PUBLIC', { myRole: 'MEMBER' }));
      }
      if (endpoint === 'POST /api/communities') {
        const submitted = request.postDataJSON();
        if (submitted.name !== 'QA Comunidade Criada') {
          unexpected.push('Unexpected synthetic community creation input');
        }
        createdCommunity = community(903, submitted.visibility, {
          name: submitted.name, description: submitted.description,
          sports: submitted.sports, sport: submitted.sport
        });
        return json(route, 200, createdCommunity);
      }
      if (endpoint === 'GET /api/communities/903') {
        return json(route, createdCommunity ? 200 : 404, createdCommunity || { message: 'Not found' });
      }
      if (endpoint === 'PUT /api/communities/903/features') {
        featureChoice = request.postDataJSON();
        return json(route, 200, { ...createdCommunity, ...featureChoice });
      }
      // Optional data on the owner's overview has no synthetic records.
      if (method === 'GET' && /^\/api\/communities\/903\/(sessions|competition|archives)/.test(url.pathname)) {
        return json(route, 200, []);
      }
      unexpected.push(endpoint);
      return json(route, 404, { message: 'Synthetic endpoint not configured' });
    }
    // Never contact third-party services or the production host.
    return route.abort('blockedbyclient');
  });

  const snapshot = async name =>
    page.screenshot({ path: path.join(ARTIFACTS, name + '.png'), fullPage: true });
  const locationPath = () => new URL(page.url()).pathname;

  try {
    await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fcommunities', {
      waitUntil: 'domcontentloaded'
    });
    await page.locator('.login-card form input[name="username"]').fill('synthetic-browser-user');
    await page.locator('.login-card form input[name="password"]').fill('incorrect-synthetic-password');
    await page.locator('.login-card form button[type="submit"]').click();
    await page.locator('.login-card .error-feedback').waitFor();
    assert.equal(locationPath(), '/login', 'invalid synthetic login stays on the login screen');
    assert.equal(await page.evaluate(() => localStorage.getItem('t')), null);
    await snapshot('07-qa-invalid-login');

    await page.locator('.login-card form input[name="password"]').fill('synthetic-browser-password');
    await page.locator('.login-card form button[type="submit"]').click();
    await page.waitForURL(u => u.pathname === '/menu/communities');
    await page.locator('.community-pitch').waitFor();
    assert.equal(await page.locator('.site-nav__links > a[href="/menu/communities"]').count(), 1);
    assert.equal(await page.locator('.account-menu a[href="/menu/communities"]').count(), 0);
    await snapshot('08-qa-communities');

    await page.locator('input[name="communitySearchName"]').fill('QA');
    await page.locator('#community-search button[type="submit"]').click();
    await page.locator('#community-search button.community-card').first().waitFor();
    assert.equal(await page.locator('#community-search button.community-card').count(), 2);
    assert.match(await page.locator('#community-search').innerText(), /QA Grupo Privado/);
    await page.locator('#community-search button.community-card').filter({ hasText: 'QA Grupo Privado' }).click();
    await page.waitForURL(u => u.pathname === '/menu/communities/902');
    const joinPrivate = page.locator('.community-detail button.primary-action');
    await joinPrivate.waitFor();
    await joinPrivate.click();
    await page.waitForFunction(() =>
      document.querySelector('.community-detail .feedback')?.textContent?.trim().length > 0);
    assert.equal(privateJoinRequests, 1);
    assert.equal(publicJoinRequests, 0, 'private joins must not use public join endpoint');
    assert.equal(await joinPrivate.isDisabled(), true,
      'a private join request cannot be submitted repeatedly');
    await snapshot('09-qa-private-join-request');

    await page.goto(SITE + '/menu/communities/create', { waitUntil: 'domcontentloaded' });
    const createForm = page.locator('form.create-panel');
    await createForm.waitFor();
    assert.equal(await createForm.locator('button[type="submit"]').isDisabled(), true);
    await createForm.locator('input[name="name"]').fill('QA Comunidade Criada');
    await createForm.locator('input[name="sportSearch"]').fill('Futebol');
    await createForm.locator('.sport-suggestions button').filter({ hasText: 'Futebol' }).first().click();
    await createForm.locator('select[name="visibility"]').selectOption('PRIVATE');
    await snapshot('10-qa-create-community');
    await createForm.locator('button[type="submit"]').click();
    await page.waitForURL(u => u.pathname === '/menu/communities/903/invite');
    await page.locator('.invite-step-community').waitFor();
    await page.locator('.invite-step-panel button.primary-action').click();
    const inviteLink = page.locator('.invite-step-link input');
    await inviteLink.waitFor();
    const linkValue = await inviteLink.inputValue();
    assert.ok(linkValue.startsWith(SITE + '/'), 'invitation points to local candidate');
    assert.ok(linkValue.includes('903'), 'invitation belongs to the created group');
    await snapshot('11-qa-community-invite');

    await page.locator('.invite-step-footer button.secondary-action').click();
    await page.locator('.competition-onboarding-options').waitFor();
    await page.locator('.competition-onboarding-option').filter({ hasText: 'Apenas sessões' }).click();
    await page.locator('.invite-step-footer .primary-action').click();
    await page.waitForURL(u => u.pathname === '/menu/communities/903');
    assert.deepEqual(featureChoice, {
      rankingsEnabled: false, individualTournamentsEnabled: false,
      teamTournamentsEnabled: false
    }, 'the user chooses only sessions without enabling competitions');

    await page.goto(SITE + '/menu/createEvent', { waitUntil: 'domcontentloaded' });
    await page.locator('form.create-card input[name="sport"]').waitFor();
    assert.equal(await page.locator('input[name="venueSearch"]').isDisabled(), true,
      'venue lookup requires a sport and district');
    await snapshot('12-qa-create-session');
    // The premium community page and creation form need a real mobile
    // viewport check; DOM-only unit tests cannot catch horizontal clipping.
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileFits = async (label, selectors) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 4, label + ': horizontal scroll overflow ' + overflow + 'px');
      for (const selector of selectors) {
        const element = page.locator(selector).first();
        await element.waitFor({ state: 'visible' });
        const box = await element.boundingBox();
        assert.ok(box && box.width > 8 && box.x >= -3 && box.x + box.width <= 393,
          label + ': ' + selector + ' extends outside viewport: ' + JSON.stringify(box));
      }
    };
    await page.goto(SITE + '/menu/communities/create', { waitUntil: 'domcontentloaded' });
    await page.locator('.jynlo-community-create-premium .create-panel').waitFor();
    await mobileFits('mobile community creation', [
      '.jynlo-community-create-premium .create-panel',
      '.jynlo-community-create-premium input[name="name"]',
      '.jynlo-community-create-premium #community-sport-search',
      '.jynlo-community-create-premium .form-actions button[type="submit"]'
    ]);
    await snapshot('13-mobile-community-create');

    await page.goto(SITE + '/menu/communities/903', { waitUntil: 'domcontentloaded' });
    await page.locator('.jynlo-community-main-premium .community-detail .detail-header').waitFor();
    await mobileFits('mobile community detail', [
      '.jynlo-community-main-premium .community-detail',
      '.jynlo-community-main-premium .detail-header',
      '.jynlo-community-main-premium .community-detail-copy'
    ]);
    assert.equal(await page.locator('.community-detail h2').filter({ hasText: 'QA Comunidade Criada' }).count() > 0,
      true, 'created community detail remains visible at mobile viewport');
    await snapshot('14-mobile-community-detail');

    assert.deepEqual(errors, [], 'no uncaught JavaScript exceptions');
    assert.deepEqual(unexpected, [], 'only explicitly mocked API calls are allowed');
    console.log('PASS: synthetic login, rejection, community search and join request,');
    console.log('PASS: community creation, invitation, options and session form.');
    console.log('PASS: authenticated journey screenshots + 390px community creation/detail checks, no production requests or credentials.');
  } catch (err) {
    await snapshot('FAILED-authenticated-browser-state').catch(() => {});
    console.error(err);
    if (errors.length) console.error('Browser JS errors:', errors);
    if (unexpected.length) console.error('Unmocked API calls:', unexpected);
    console.error('API endpoints exercised:', seen.join(', '));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
