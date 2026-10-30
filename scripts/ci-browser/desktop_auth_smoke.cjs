/*
 * Authenticated Angular browser smoke with a fully synthetic API.
 *
 * No real credentials, provider scripts, signed tokens, production writes,
 * QA users, or requests to live API. The unsigned fixture JWT is accepted
 * only by the mocked client-side route guard, NEVER by a real backend.
 */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const SITE = 'http://127.0.0.1:4173';
const API = 'https://api.d24sports.com';
const fixtureToken = [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: 'synthetic-player', Authorities: ['ROLE_USER'],
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url'),
  'dummy-signature'
].join('.');

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const browserErrors = [];
  const actions = [];
  const loginIdentifiers = [];
  const unexpected = [];

  async function makePage() {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-PT' });
    const page = await context.newPage();
    page.on('pageerror', error => browserErrors.push(error.stack || error.message));
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === SITE) return route.continue();

      // All API calls are intercepted. Do not permit outbound contact with LIVE.
      if (url.origin === API) {
        const respond = (status, body) => route.fulfill({
          status, contentType: 'application/json',
          headers: {
            'access-control-allow-origin': SITE,
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': '*'
          },
          body: JSON.stringify(body)
        });
        if (req.method() === 'OPTIONS') {
          return route.fulfill({ status: 204, headers: {
            'access-control-allow-origin': SITE,
            'access-control-allow-credentials': 'true',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': '*'
          } });
        }
        if (url.pathname === '/api/auth/google/config' && req.method() === 'GET') {
          return respond(200, { clientId: '' });
        }
        if (url.pathname === '/api/auth/refresh' && req.method() === 'POST') {
          return respond(401, { message: 'Guest' });
        }
        if (url.pathname === '/api/auth/login' && req.method() === 'POST') {
          actions.push('login');
          const body = JSON.parse(req.postData() || '{}');
          loginIdentifiers.push(body.username);
          // Names and passwords below exist ONLY inside this mocked runner.
          if (body.username === 'synthetic-invalid') {
            return respond(401, { message: 'Credenciais inválidas' });
          }
          if (body.username === 'synthetic-mfa') {
            return respond(202, {
              mfaRequired: true, challengeId: 'synthetic-challenge',
              challengeExpiresAt: new Date(Date.now() + 300000).toISOString(),
              token: null, profile: null
            });
          }
          if (['synthetic-direct', 'synthetic-user@example.test', '+351 912 345 678'].includes(body.username)) {
            return respond(200, {
              mfaRequired: false, challengeId: null,
              challengeExpiresAt: null, token: fixtureToken, profile: null
            });
          }
          return respond(401, { message: 'Fixture account not configured' });
        }
        if (url.pathname === '/api/auth/mfa/resend' && req.method() === 'POST') {
          actions.push('mfa-resend');
          const body = JSON.parse(req.postData() || '{}');
          assert.equal(body.challengeId, 'synthetic-challenge');
          return respond(202, {
            mfaRequired: true,
            challengeId: 'synthetic-challenge-renewed',
            challengeExpiresAt: new Date(Date.now() + 300000).toISOString(),
            token: null, profile: null
          });
        }
        if (url.pathname === '/api/auth/mfa/confirm' && req.method() === 'POST') {
          actions.push('mfa-confirm');
          const body = JSON.parse(req.postData() || '{}');
          assert.equal(body.challengeId, 'synthetic-challenge');
          if (body.code === '111111') {
            return respond(401, { message: 'Código incorreto' });
          }
          if (body.code === '222222') {
            return respond(200, {
              mfaRequired: false, challengeId: null,
              challengeExpiresAt: null, token: fixtureToken, profile: null
            });
          }
          return respond(400, { message: 'Invalid fixture code' });
        }
        if (url.pathname === '/api/sessions/mine' && req.method() === 'GET') {
          return respond(200, { created: [], joined: [], waitlisted: [] });
        }
        if (url.pathname === '/api/pilot/events/access' && req.method() === 'POST') {
          return respond(200, {});
        }

        // No real network request is made. Unknown API calls cannot mutate LIVE.
        unexpected.push(req.method() + ' ' + url.pathname);
        return respond(404, { message: 'Fixture route missing' });
      }
      if (req.resourceType() === 'stylesheet') {
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      return route.abort('blockedbyclient');
    });
    return { context, page };
  }

  async function fillAndSubmit(page, username) {
    await page.locator('.login-page form input[name="username"]').fill(username);
    await page.locator('.login-page form input[name="password"]').fill('fixture-only-password');
    await page.locator('.login-page form button[type="submit"]').click();
  }
  async function token(page) {
    return page.evaluate(() => localStorage.getItem('t'));
  }
  async function assertNoLeak() {
    assert.deepEqual(browserErrors, [], 'Angular browser must not throw JS exceptions');
  }

  try {
    // Case 1: an incomplete form does not call the login endpoint.
    {
      const { context, page } = await makePage();
      await page.goto(SITE + '/login', { waitUntil: 'domcontentloaded' });
      await page.locator('.login-page form').waitFor();
      const before = actions.length;
      await page.locator('.login-page form button[type="submit"]').click();
      await page.locator('.login-page .error-feedback').waitFor();
      assert.equal(actions.length, before, 'missing credentials must not make login request');
      assert.equal(await token(page), null);
      await context.close();
    }

    // Case 2: a failed login shows feedback without saving a token or leaving.
    {
      const { context, page } = await makePage();
      await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fmy-sessions', { waitUntil: 'domcontentloaded' });
      await fillAndSubmit(page, 'synthetic-invalid');
      await page.locator('.login-page .error-feedback').waitFor();
      assert.match(await page.locator('.login-page .error-feedback').innerText(), /Credenciais inválidas/);
      assert.equal(new URL(page.url()).pathname, '/login');
      assert.equal(await token(page), null);
      await context.close();
    }

    // Case 3: normal login persists the fixture token and resumes target route.
    {
      const { context, page } = await makePage();
      await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fmy-sessions', { waitUntil: 'domcontentloaded' });
      await fillAndSubmit(page, 'synthetic-direct');
      await page.waitForURL(u => u.pathname === '/menu/my-sessions');
      assert.equal(await token(page), fixtureToken, 'direct login should save token in this test browser only');
      await context.close();
    }

    // The same form and password flow accept all three identifier formats.
    // The synthetic API acknowledges aliases; the real Java resolver is tested
    // separately in the backend suite. No production credentials leave Chromium.
    {
      for (const identifier of ['synthetic-user@example.test', '+351 912 345 678']) {
        const { context, page } = await makePage();
        await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fmy-sessions', {
          waitUntil: 'domcontentloaded'
        });
        await fillAndSubmit(page, identifier);
        await page.waitForURL(u => u.pathname === '/menu/my-sessions');
        assert.equal(await token(page), fixtureToken);
        assert.equal(loginIdentifiers.at(-1), identifier);
        await context.close();
      }
    }

    // Case 4: MFA never authenticates the user before confirming its challenge.
    {
      const { context, page } = await makePage();
      await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fmy-sessions', { waitUntil: 'domcontentloaded' });
      await fillAndSubmit(page, 'synthetic-mfa');
      await page.waitForURL(u => u.pathname === '/login/MFAauthentication');
      await page.locator('.mfa-page input[name="code"]').waitFor();
      assert.equal(await token(page), null, 'MFA challenge must not count as signed in');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mfa-challenge-id')), 'synthetic-challenge');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mfa-return-url')), '/menu/my-sessions');

      await page.locator('.mfa-page input[name="code"]').fill('111111');
      await page.locator('.mfa-page button[type="submit"]').click();
      await page.locator('.mfa-page .error-feedback').waitFor();
      assert.equal(await token(page), null, 'invalid MFA must not produce a token');
      assert.equal(new URL(page.url()).pathname, '/login/MFAauthentication');

      await page.locator('.mfa-page input[name="code"]').fill('222222');
      await page.locator('.mfa-page button[type="submit"]').click();
      await page.waitForURL(u => u.pathname === '/menu/my-sessions');
      assert.equal(await token(page), fixtureToken);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mfa-challenge-id')), null);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mfa-return-url')), null);
      await context.close();
    }

    // Case 5: expired MFA challenge cannot be submitted; "back" restores only
    // validated return paths, never an arbitrary external URL.
    {
      const { context, page } = await makePage();
      await page.addInitScript(() => {
        sessionStorage.setItem('mfa-challenge-id', 'synthetic-challenge');
        sessionStorage.setItem('mfa-expires-at', new Date(Date.now() - 60000).toISOString());
        sessionStorage.setItem('mfa-return-url', 'https://not-jynlo.invalid/fake-login');
      });
      await page.goto(SITE + '/login/MFAauthentication', { waitUntil: 'domcontentloaded' });
      await page.locator('.mfa-page button[type="submit"]').waitFor();
      assert.equal(await page.locator('.mfa-page button[type="submit"]').isDisabled(), true);
      const before = actions.filter(a => a === 'mfa-confirm').length;
      const renew = page.locator('.mfa-page .secondary-actions button')
        .filter({ hasText: 'Renovar desafio' });
      await renew.waitFor();
      await renew.click();
      await page.waitForFunction(() =>
        sessionStorage.getItem('mfa-challenge-id') === 'synthetic-challenge-renewed');
      assert.equal(await page.locator('.mfa-page button[type="submit"]').isDisabled(), false);
      assert.equal(actions.filter(a => a === 'mfa-resend').length, 1);
      assert.equal(before, actions.filter(a => a === 'mfa-confirm').length);
      await page.locator('.mfa-page .secondary-actions button')
        .filter({ hasText: 'Voltar ao login' }).click();
      await page.waitForURL(u => u.pathname === '/login');
      assert.equal(new URL(page.url()).searchParams.get('returnUrl'), '/menu/feed');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mfa-challenge-id')), null);
      await context.close();
    }

    await assertNoLeak();
    console.log('PASS: 7 synthetic authenticated-browser scenarios; no JS runtime errors.');
    console.log('PASS: empty/invalid login, direct JWT, MFA reject/confirm, expired MFA renewal and safe return.');
    console.log('PASS: zero real credentials, external auth calls or production API writes.');
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
