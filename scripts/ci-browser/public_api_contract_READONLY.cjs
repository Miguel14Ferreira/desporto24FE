/*
 * Jynlo PUBLIC API compatibility, READ ONLY.
 * Only anonymous HTTPS GET endpoints. No cookies, Authorization, mutation
 * requests, credential logging, persisted records, or production writes.
 */
'use strict';

const assert = require('node:assert/strict');

const HOST = 'https://api.d24sports.com';
const MAX_BYTES = 2_000_000;

async function readPublicJson(path, description) {
  assert.ok(path.startsWith('/api/'), 'Only public API paths are allowed');
  const url = new URL(path, HOST);
  assert.equal(url.origin, HOST, 'Disallowed host');
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
    headers: { accept: 'application/json' }
  });
  assert.equal(res.status, 200, description + ' must return 200 for anonymous GET');
  assert.match(res.headers.get('content-type') || '', /application\/json/i,
    description + ' must serve JSON');
  if (Number(res.headers.get('content-length') || '0') > MAX_BYTES) {
    throw new Error(description + ' payload exceeds safety limit');
  }
  const response = await res.arrayBuffer();
  assert.ok(response.byteLength <= MAX_BYTES, description + ' payload exceeds safety limit');
  return JSON.parse(Buffer.from(response).toString('utf8'));
}

function validPositiveId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

async function main() {
  const today = new Date();
  const in14Days = new Date(today.getTime() + 14 * 86_400_000);
  const query = new URLSearchParams({
    privateGame: 'false',
    sort: 'date',
    from: today.toISOString(),
    to: in14Days.toISOString()
  });

  const sessions = await readPublicJson('/api/sessions?' + query, 'Public session discovery');
  assert.ok(Array.isArray(sessions), 'Session discovery must return JSON array');
  for (const s of sessions) {
    assert.ok(validPositiveId(s.id), 'Session ID is not a safe positive integer');
    assert.equal(typeof s.sport, 'string', 'Session sport');
    assert.equal(typeof s.city, 'string', 'Session city');
    assert.ok(Number.isFinite(Date.parse(s.gameDate)), 'Session date must be valid');
    assert.ok(['OPEN', 'FULL'].includes(s.status), 'Only active public sessions should be discovered');
    assert.equal(s.privateGame, false, 'Private sessions must not be returned to anonymous clients');
    assert.notEqual(s.audience, 'COMMUNITY_ONLY', 'Community-only session leaked to anonymous clients');
    assert.ok(Number.isInteger(s.participantCount) && s.participantCount >= 0, 'Invalid confirmed count');
    assert.ok(Number.isInteger(s.maxParticipants) && s.maxParticipants > 0, 'Invalid capacity');
    assert.ok(!('participants' in s) && !('email' in s) && !('phone' in s),
      'Guest listing must not expose participant identities');
  }
  console.log('PASS: anonymous sessions GET; contract checked; no records printed.');

  const venuePage = await readPublicJson('/api/venues/suggest?page=0',
    'Public venue suggestion first page');
  assert.ok(Array.isArray(venuePage.venues), 'Venue suggestion must have venues array');
  assert.equal(venuePage.page, 0, 'Venue suggestion page');
  assert.equal(typeof venuePage.hasMore, 'boolean', 'Venue suggestion hasMore flag');
  assert.ok(venuePage.venues.length <= 50, 'Venue autocomplete should be bounded');
  for (const v of venuePage.venues) {
    assert.ok(validPositiveId(v.id), 'Venue ID invalid');
    assert.equal(typeof v.name, 'string', 'Venue name');
    assert.equal(typeof v.city, 'string', 'Venue city');
  }
  console.log('PASS: anonymous bounded venue suggestions GET; contract checked; no records printed.');

  if (sessions.length > 0) {
    // Only a server-discovered PUBLIC session ID, never a guessed private ID.
    const id = sessions[0].id;
    const preview = await readPublicJson(
      '/api/sessions/' + id + '/public-preview', 'Public session preview');
    assert.equal(preview.id, id, 'Public preview ID mismatch');
    assert.equal(typeof preview.sport, 'string', 'Preview sport');
    assert.equal(typeof preview.city, 'string', 'Preview city');
    assert.ok(Number.isFinite(Date.parse(preview.gameDate)), 'Preview date');
    assert.ok(['OPEN', 'FULL'].includes(preview.status), 'Preview state');
    for (const key of ['participantNames', 'participants', 'createdByUsername',
      'creatorUsername', 'email', 'address', 'venueAddress']) {
      assert.ok(!(key in preview), 'Public preview exposes a private field: ' + key);
    }
    console.log('PASS: anonymous public-preview GET; privacy shape checked; no records printed.');
  } else {
    console.log('SKIP: public-preview GET — no future sessions in the 14-day window.');
  }
  console.log('Public API READ-ONLY contract smoke complete; GET only; no production mutations.');
}


/**
 * Anonymous browser QA against the real published frontend. All requests are
 * guarded at the browser route layer: only GET/HEAD to the two known Jynlo
 * origins can reach the network. This must NEVER use cookies/QA credentials,
 * submit forms, create sessions or mutate community/competition records.
 */
async function liveBrowserReadOnly() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const site = 'https://d24sports.com';
  const allowedOrigins = new Set([site, HOST]);
  const blockedMethods = [];
  let readRequests = 0;
  try {
    const context = await browser.newContext({
      locale: 'pt-PT',
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
      acceptDownloads: false
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (method !== 'GET' && method !== 'HEAD') {
        blockedMethods.push(method);
        return route.fulfill({
          status: 403, contentType: 'text/plain', body: 'Blocked by read-only browser QA'
        });
      }
      if (!allowedOrigins.has(url.origin)) return route.abort('blockedbyclient');
      readRequests++;
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    const response = await page.goto(site + '/home', {
      waitUntil: 'domcontentloaded', timeout: 60_000
    });
    assert.equal(response?.status(), 200, 'Published homepage must return HTTP 200');
    await page.locator('.home-page .hero h1').waitFor({ state: 'visible', timeout: 30_000 });
    assert.equal(await page.locator('.preview-panel').count(), 2,
      'Homepage must render the public sessions and venues panels');
    console.log('PASS: real published homepage and public discovery widgets rendered.');

    // The UI must send an actual filtered anonymous GET; no session content,
    // user identities or query result rows are saved or printed.
    await page.locator('.preview-search input[name="sport"]').fill('Karting');
    await page.locator('.preview-search input[name="city"]').fill('Lisboa');
    const filteredSession = page.waitForResponse(result => {
      const url = new URL(result.url());
      return url.origin === HOST && url.pathname === '/api/sessions'
        && url.searchParams.get('sport') === 'Karting'
        && url.searchParams.get('city') === 'Lisboa'
        && result.request().method() === 'GET';
    }, { timeout: 30_000 });
    await page.locator('.preview-search button[type="submit"]').click();
    const filtered = await filteredSession;
    assert.equal(filtered.status(), 200, 'Filtered public session search must return 200');
    console.log('PASS: published homepage sends filtered public sessions GET.');

    const login = await page.goto(site + '/login', {
      waitUntil: 'domcontentloaded', timeout: 60_000
    });
    assert.equal(login?.status(), 200, 'Published login route must return HTTP 200');
    await page.locator('.login-card input[name="username"]').waitFor({
      state: 'visible', timeout: 30_000
    });
    assert.ok(await page.locator('.login-card input[name="password"]').isVisible(),
      'Password input must be rendered without credentials');
    console.log('PASS: published login form rendered; no credentials entered.');

    // Never request a private resource ID. A guest attempting the protected
    // community index must be redirected to login by the real route guard.
    await page.goto(site + '/menu/communities', {
      waitUntil: 'domcontentloaded', timeout: 60_000
    });
    await page.locator('.login-card input[name="username"]').waitFor({
      state: 'visible', timeout: 30_000
    });
    assert.equal(new URL(page.url()).pathname, '/login',
      'Anonymous access to community management must redirect to login');
    assert.equal(errors.length, 0, 'Unexpected uncaught Angular browser exception');
    assert.ok(readRequests > 0, 'No verified live read request was made');
    console.log('PASS: published community route redirects guests; all writes blocked.');
    if (blockedMethods.length) {
      console.log('INFO: rejected ' + blockedMethods.length
        + ' browser-side non-read requests before they reached production.');
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

const run = process.env.JYNLO_LIVE_BROWSER_READONLY === '1'
  ? liveBrowserReadOnly().then(main)
  : main();
run.catch(error => {
  console.error('READ-ONLY live Jynlo validation FAILED: ' + error.message);
  process.exitCode = 1;
});
