'use strict';
/* LIVE, authenticated, read-only QA.
 * Only POST /api/auth/login may reach the real API; all other writes
 * are blocked or locally stubbed. Secrets and all account data stay
 * out of the logs and artifacts.
 */
const { chromium } = require('playwright');
const SITE = 'https://d24sports.com';
const API = 'https://api.d24sports.com';
const KEYS = ['JYNLO_QA1_USERNAME', 'JYNLO_QA1_PASSWORD',
  'JYNLO_QA2_USERNAME', 'JYNLO_QA2_PASSWORD'];

if (KEYS.some(key => !process.env[key] || !process.env[key].trim())) {
  console.log('SKIPPED: four QA secrets required; no login attempted.');
  process.exit(0);
}

async function testAccount(browser, index) {
  const name = process.env['JYNLO_QA' + index + '_USERNAME'];
  const password = process.env['JYNLO_QA' + index + '_PASSWORD'];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'pt-PT',
    serviceWorkers: 'block', acceptDownloads: false
  });
  const page = await context.newPage();
  let loginCalls = 0, blockedWrites = 0, loginStatus = null, pageErrors = 0;
  page.on('pageerror', () => { pageErrors++; });
  page.on('response', response => {
    if (response.request().method() === 'POST'
      && response.url().startsWith(API + '/api/auth/login')) {
      loginStatus = response.status();
    }
  });

  await context.route('**/*', route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (url.origin !== SITE && url.origin !== API) {
      return route.abort('blockedbyclient');
    }
    if (method === 'POST' && url.origin === API
        && url.pathname === '/api/auth/login') {
      loginCalls++;
      return loginCalls === 1
        ? route.continue() : route.abort('blockedbyclient');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      blockedWrites++;
      if (url.origin === API && url.pathname === '/api/auth/refresh') {
        return route.fulfill({ status: 401, contentType: 'application/json',
          headers: {
            'access-control-allow-origin': SITE,
            'access-control-allow-credentials': 'true'
          }, body: '{"message":"QA refresh blocked"}' });
      }
      if (url.origin === API && (
        url.pathname === '/api/pilot/events/access'
        || url.pathname === '/api/presence/heartbeat')) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          headers: {
            'access-control-allow-origin': SITE,
            'access-control-allow-credentials': 'true'
          }, body: '{}' });
      }
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  const label = 'QA' + index;
  try {
    await page.goto(SITE + '/login?returnUrl=%2Fmenu%2Fcommunities', {
      waitUntil: 'domcontentloaded', timeout: 45000
    });
    await page.locator('.login-card input[name="username"]').waitFor({ timeout: 12000 });
    await page.locator('.login-card input[name="username"]').fill(name);
    await page.locator('.login-card input[name="password"]').fill(password);
    // A single click: do not retry login automatically or trigger lockouts.
    await page.locator('.login-card form button[type="submit"]').click();

    const outcome = await Promise.any([
      page.waitForURL(u => u.pathname === '/login/MFAauthentication',
        { timeout: 16000 }).then(() => 'MFA_REQUIRED'),
      page.waitForURL(u => u.pathname === '/menu/communities',
        { timeout: 16000 }).then(() => 'AUTHENTICATED'),
      page.locator('.login-card .error-feedback').waitFor({ timeout: 16000 })
        .then(() => 'LOGIN_REJECTED')
    ]).catch(() => 'TIMEOUT');

    if (outcome === 'MFA_REQUIRED') {
      console.log(label + ': MFA_REQUIRED; protected pages not tested.');
      return 'MFA_REQUIRED';
    }
    if (outcome === 'LOGIN_REJECTED') {
      console.log(label + ': LOGIN_REJECTED; error message redacted.');
      return 'LOGIN_REJECTED';
    }
    if (outcome !== 'AUTHENTICATED') {
      console.log(label + ': UNEXPECTED_AUTH_STATE');
      return 'UNEXPECTED_AUTH_STATE';
    }
    await page.locator('.communities-page').waitFor({ timeout: 15000 });
    await page.goto(SITE + '/menu/createEvent', {
      waitUntil: 'domcontentloaded', timeout: 35000
    });
    await page.locator('form.create-card input[name="sport"]')
      .waitFor({ timeout: 15000 });
    console.log(label + ': PASS; login, communities and session form read-only.');
    return 'PASS';
  } catch {
    console.log(label + ': FAIL; login HTTP ' + (loginStatus ?? 'unknown')
      + ', blocked writes ' + blockedWrites + ', JS errors ' + pageErrors
      + '. Exception details withheld.');
    return 'FAIL';
  } finally {
    // Delete all ephemeral cookies/tokens with the browser context.
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const results = [];
    for (let i = 1; i <= 2; i++) {
      results.push(await testAccount(browser, i));
    }
    console.log('QA results (no PII): ' + results.join(', '));
    if (results.some(r => !['PASS', 'MFA_REQUIRED'].includes(r))) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch(() => {
  console.error('FAIL: live QA startup failed; details redacted.');
  process.exitCode = 1;
});
