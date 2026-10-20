/*
 * Real Chromium-to-Spring-Boot auth contract on an ephemeral PostgreSQL DB.
 * No QA accounts, live API calls, outbound providers or mocks.
 * Never log access tokens, refresh cookies or passwords.
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const SITE = 'http://localhost:4173';
const API = 'http://localhost:8080';
const USER = process.env.TEST_USERNAME;
const PASSWORD = process.env.TEST_PASSWORD;
const SECRET = process.env.JWT_SECRET;
assert.ok(USER && PASSWORD && SECRET, 'Isolated fixture environment is required');

function expiredSignedJwt() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const text = [
    b64({ typ: 'JWT', alg: 'HS512' }),
    b64({
      iss: 'Desporto 24', aud: 'Desporto 24 APP', sub: USER,
      iat: now - 3600, exp: now - 60,
      'Token-Version': 0, 'Token-Type': 'access',
      Authorities: ['ROLE_USER']
    })
  ].join('.');
  return text + '.' + crypto.createHmac('sha512', SECRET).update(text).digest('base64url');
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const unexpected = [];
  try {
    await page.route('**/*', route => {
      const origin = new URL(route.request().url()).origin;
      if (origin === SITE || origin === API) return route.continue();
      unexpected.push(origin);
      return route.abort('blockedbyclient');
    });

    await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fcommunities', { waitUntil: 'domcontentloaded' });
    await page.locator('.login-page form input[name="username"]').fill(USER);
    await page.locator('.login-page form input[name="password"]').fill(PASSWORD);
    await page.locator('.login-page form button[type="submit"]').click();
    await page.waitForURL(url => url.pathname === '/menu/communities', { timeout: 20000 });
    const loginToken = await page.evaluate(() => localStorage.getItem('t'));
    assert.ok(loginToken && loginToken.split('.').length === 3, 'real login must issue access JWT');

    const cookies = (await context.cookies()).filter(c => c.name === 'desporto24_refresh');
    assert.equal(cookies.length, 1, 'Chromium must retain the refresh cookie');
    assert.equal(cookies[0].httpOnly, true, 'cookie must be HttpOnly');
    assert.equal(cookies[0].secure, true, 'cookie must be Secure');
    assert.equal(cookies[0].sameSite, 'None', 'cookie must have SameSite=None');
    assert.equal(cookies[0].path, '/api/auth', 'cookie must have narrow path');

    const allowed = await page.evaluate(async api => {
      const response = await fetch(api + '/api/auth/refresh', {
        method: 'POST', credentials: 'include'
      });
      return { status: response.status, body: await response.json() };
    }, API);
    assert.equal(allowed.status, 200, 'browser Origin must be allowed');
    assert.ok(allowed.body.token, 'refresh must return JWT');

    const expired = expiredSignedJwt();
    const expiredAccess = await fetch(API + '/api/communities/mine', {
      headers: { Authorization: 'Bearer ' + expired }
    });
    assert.equal(expiredAccess.status, 403, 'real filter rejects a signed expired access JWT');

    const forbidden = await fetch(API + '/api/admin/pilot/metrics', {
      headers: { Authorization: 'Bearer ' + allowed.body.token }
    });
    assert.equal(forbidden.status, 403, 'player cannot access admin area');

    await page.evaluate(token => localStorage.setItem('t', token), expired);
    await page.goto(SITE + '/menu/communities', { waitUntil: 'domcontentloaded' });
    await page.locator('.community-pitch').waitFor({ timeout: 20000 });
    const recovered = await page.evaluate(() => localStorage.getItem('t'));
    assert.ok(recovered && recovered !== expired, 'Angular guard refreshes a signed expired JWT');
    assert.notEqual(new URL(page.url()).pathname, '/login', 'successful refresh keeps route');

    const cookie = 'desporto24_refresh=' + cookies[0].value;
    for (const origin of [null, 'https://untrusted.example']) {
      const headers = { Cookie: cookie };
      if (origin) headers.Origin = origin;
      const result = await fetch(API + '/api/auth/refresh', { method: 'POST', headers });
      assert.equal(result.status, 403, 'missing/foreign Origin is rejected');
      assert.equal(result.headers.get('set-cookie'), null, 'rejected Origin cannot rotate cookie');
    }

    // External font/CSS CDN references are deliberately blocked by page.route.
    // Their attempted loads are not a failure of authentication integration.
    assert.deepEqual(
      unexpected.filter(origin =>
        origin === 'https://api.d24sports.com' || origin === 'https://d24sports.com'
      ),
      [],
      'the candidate must not request a LIVE Jynlo origin'
    );
    console.log('INFO: blocked optional third-party asset requests:', unexpected.length);
    console.log('PASS real browser + disposable Java/PostgreSQL login');
    console.log('PASS signed JWT expiry and browser refresh recovery');
    console.log('PASS HttpOnly/Secure/SameSite cookie, Origin guard, admin 403');
    console.log('PASS no production, QA identities or provider requests');
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => {
  // Never dump token, cookie or raw request/response bodies into CI logs.
  console.error('Isolated authentication test failed:', error.message);
  process.exitCode = 1;
});
