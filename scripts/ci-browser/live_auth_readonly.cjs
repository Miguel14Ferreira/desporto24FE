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
    // Authorization evidence is kept only inside the disposable browser
    // and this runner process. Never log community identifiers or names.
    const mine = await page.evaluate(async api => {
      const token = localStorage.getItem('t');
      if (!token) return { status: 'NO_TOKEN', groups: [] };
      try {
        const response = await fetch(api + '/api/communities/mine', {
          headers: { Authorization: 'Bearer ' + token },
          credentials: 'include', cache: 'no-store'
        });
        if (!response.ok) return { status: 'HTTP_' + response.status, groups: [] };
        const body = await response.json();
        if (!Array.isArray(body)) return { status: 'INVALID_SHAPE', groups: [] };
        const roles = ['OWNER', 'ADMIN', 'MEMBER'];
        return {
          status: 'OK',
          groups: body
            .filter(g => Number.isSafeInteger(g.id) && g.id > 0
              && roles.includes(g.myRole))
            .map(g => ({ id: g.id, role: g.myRole, visibility: g.visibility }))
        };
      } catch {
        return { status: 'READ_FAILED', groups: [] };
      }
    }, API);
    if (mine.status !== 'OK') {
      console.log(label + ': GROUPS_READ_FAILED_' + mine.status);
      return 'FAIL';
    }
    const roles = { OWNER: 0, ADMIN: 0, MEMBER: 0 };
    for (const group of mine.groups) roles[group.role]++;

    // Limit extra browser requests to three existing QA-owned/member groups.
    let checked = 0;
    let deniedMemberRequests = 0;
    for (const group of mine.groups.slice(0, 3)) {
      await page.goto(SITE + '/menu/communities/' + group.id + '?tab=members', {
        waitUntil: 'domcontentloaded', timeout: 35000
      });
      await page.locator('.community-detail .role-badge').waitFor({ timeout: 15000 });
      const controls = await page.evaluate(() => ({
        managerSharing: Boolean(document.querySelector('.whatsapp-group-share')),
        pendingJoinManagement: Boolean(document.querySelector(
          '.community-tab-panel .management-block.first-block'))
      }));
      const manager = group.role === 'OWNER' || group.role === 'ADMIN';
      if (manager !== controls.managerSharing
          || manager !== controls.pendingJoinManagement) {
        console.log(label + ': ROLE_UI_MISMATCH; role=' + group.role
          + '; no community details logged.');
        return 'FAIL';
      }
      // Server-side authorization check: a basic member must not read
      // the management-only pending join requests. Do not read the body.
      const joinRequestsStatus = await page.evaluate(async ({ api, id }) => {
        const token = localStorage.getItem('t');
        if (!token) return 0;
        try {
          const response = await fetch(api + '/api/communities/' + id
            + '/join-requests', {
            headers: { Authorization: 'Bearer ' + token },
            credentials: 'include', cache: 'no-store'
          });
          return response.status;
        } catch {
          return 0;
        }
      }, { api: API, id: group.id });
      if (!manager) {
        if (![401, 403, 404].includes(joinRequestsStatus)) {
          console.log(label + ': MEMBER_AUTHORIZATION_MISMATCH; status='
            + joinRequestsStatus + '; group details withheld.');
          return 'FAIL';
        }
        deniedMemberRequests++;
      } else if (joinRequestsStatus !== 200) {
        console.log(label + ': MANAGER_JOIN_REQUESTS_UNAVAILABLE; status='
          + joinRequestsStatus + '; group details withheld.');
        return 'FAIL';
      }
      checked++;
    }
    console.log(label + ': ROLES_OK; owned=' + roles.OWNER
      + ', admins=' + roles.ADMIN + ', members=' + roles.MEMBER
      + ', UI-checked=' + checked
      + ', member-access-denials=' + deniedMemberRequests);
    if (checked === 0) {
      console.log(label + ': NO_COMMUNITY_MEMBERSHIP; role controls not exercised.');
    }
    // A nonmember should see only a limited private-community presentation,
    // never a full membership list or the pending approval queue.
    const discovery = await page.evaluate(async ({ api, joinedIds }) => {
      const token = localStorage.getItem('t');
      if (!token) return { result: 'NO_TOKEN' };
      const options = {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include', cache: 'no-store'
      };
      try {
        const search = await fetch(api
          + '/api/communities/search?name=&sport=&page=0', options);
        if (!search.ok) return { result: 'SEARCH_HTTP_' + search.status };
        const body = await search.json();
        if (!Array.isArray(body.communities)) return { result: 'INVALID_SEARCH' };
        const eligible = body.communities.filter(item =>
          item.visibility === 'PRIVATE'
          && Number.isSafeInteger(item.id)
          && !joinedIds.includes(item.id));
        if (!eligible.length) return {
          result: 'NO_UNJOINED_PRIVATE_ON_FIRST_PAGE',
          found: body.communities.length
        };
        const target = eligible[0];
        // No private details are returned to the runner; only HTTP statuses
        // and whether restricted fields appeared in the public presentation.
        const [presentation, details, approvals] = await Promise.all([
          fetch(api + '/api/communities/' + target.id + '/presentation', options),
          fetch(api + '/api/communities/' + target.id, options),
          fetch(api + '/api/communities/' + target.id + '/join-requests', options)
        ]);
        let leakedFields = false;
        if (presentation.ok) {
          const publicData = await presentation.json();
          leakedFields = ['members', 'joinRequests', 'pendingJoinRequests',
            'invites', 'email', 'phone'].some(key =>
              Object.prototype.hasOwnProperty.call(publicData, key));
        }
        return {
          result: 'PRIVATE_FOUND',
          presentationStatus: presentation.status,
          detailsStatus: details.status,
          approvalsStatus: approvals.status,
          leakedFields
        };
      } catch {
        return { result: 'DISCOVERY_NETWORK_ERROR' };
      }
    }, { api: API, joinedIds: mine.groups.map(group => group.id) });
    if (discovery.result === 'PRIVATE_FOUND') {
      if (discovery.presentationStatus !== 200
          || ![401, 403, 404].includes(discovery.detailsStatus)
          || ![401, 403, 404].includes(discovery.approvalsStatus)
          || discovery.leakedFields) {
        console.log(label + ': PRIVATE_COMMUNITY_PRIVACY_FAIL; statuses='
          + discovery.presentationStatus + '/'
          + discovery.detailsStatus + '/'
          + discovery.approvalsStatus + '; no record details logged.');
        return 'FAIL';
      }
      console.log(label + ': PRIVATE_COMMUNITY_PRIVACY_PASS; public preview readable,'
        + ' member details and join-request queues denied.');
    } else {
      console.log(label + ': PRIVATE_COMMUNITY_PRIVACY_NOT_TESTED; reason='
        + discovery.result + '; no personal data logged.');
    }
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
