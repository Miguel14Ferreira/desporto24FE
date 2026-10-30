#!/usr/bin/env node
'use strict';

/*
 * Opt-in, authenticated, READ-ONLY smoke of the real published Jynlo.
 * Credentials are read ONLY from protected GitHub Actions secrets at runtime.
 * Only POST /api/auth/login is permitted; every subsequent API request is GET.
 * Never log identities, tokens, community IDs/names, results or HTTP bodies.
 * Never persist browser storage, screenshots, traces, recordings or artifacts.
 */
const assert = require('node:assert/strict');
const { authenticate } = require('./jynlo-inbox-live-browser.cjs');

const SITE = 'https://d24sports.com';
const API = 'https://api.d24sports.com';
const ACCOUNTS = ['jynloteste01', 'jynloteste02'];
const MAX_BYTES = 2_000_000;
const MAX_COMMUNITIES = 6;
const MAX_TOURNAMENTS = 15;
const MAX_PAGES = 3;

function isId(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function readOnlyPath(path) {
  assert.equal(typeof path, 'string');
  assert.match(path, /^\/api\/communities(?:\/mine|\/[1-9]\d*\/tournaments(?:\?page=[0-2]|\/[1-9]\d*\/races)?)$/);
  return path;
}
function commonCommunities(first, second) {
  assert.ok(Array.isArray(first) && Array.isArray(second), 'COMMUNITIES_FORMAT');
  const ids = new Set(second.filter(c => isId(c?.id)).map(c => c.id));
  return first.filter(c => isId(c?.id) && ids.has(c.id))
    .map(c => c.id).slice(0, MAX_COMMUNITIES);
}
function ownCommunities(communities) {
  assert.ok(Array.isArray(communities), 'COMMUNITIES_FORMAT');
  return [...new Set(communities.filter(c => isId(c?.id)).map(c => c.id))]
    .slice(0, MAX_COMMUNITIES);
}
function validateArchived(tournament, data) {
  assert.equal(tournament.status, 'COMPLETED', 'NOT_ARCHIVED');
  assert.equal(tournament.scoringMode, 'RACE_POINTS', 'NOT_KARTING');
  assert.ok(data && Array.isArray(data.linkedRaces)
    && Array.isArray(data.availableRaces) && Array.isArray(data.standings)
    && Array.isArray(data.pointsByPlace), 'ARCHIVE_FORMAT');
  assert.equal(data.availableRaces.length, 0, 'ARCHIVE_HAS_EDITABLE_RACES');
  assert.ok(data.linkedRaces.length >= 1, 'ARCHIVE_MISSING_RACES');
  assert.ok(data.standings.length >= 2, 'ARCHIVE_MISSING_CLASSIFICATION');
  assert.equal(data.standings[0].position, 1, 'ARCHIVE_LEADER_INVALID');
  const tied = data.standings[1]?.position === 1;
  assert.equal(Boolean(tournament.championTied), tied, 'ARCHIVE_TIE_MISMATCH');
  if (tied) {
    assert.equal(tournament.championProfileId, null, 'TIE_HAS_SINGLE_CHAMPION');
  } else {
    assert.equal(tournament.championProfileId, data.standings[0].profileId ?? null,
      'ARCHIVE_CHAMPION_MISMATCH');
  }
}
function safeError(error) {
  const code = error && typeof error.message === 'string' ? error.message : '';
  // Error messages can contain network destinations or personal data; whitelist
  // only local, developer-controlled codes before any output.
  return /^[A-Z][A-Z0-9_]{3,70}$/.test(code) ? code : 'LIVE_QA_CHECK_FAILED';
}
async function getJson(path, token, fetchImpl = fetch) {
  readOnlyPath(path);
  assert.equal(typeof token, 'string', 'TOKEN_REQUIRED');
  const response = await fetchImpl(API + path, {
    method: 'GET', redirect: 'error',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, 'LIVE_GET_STATUS');
  assert.match(response.headers.get('content-type') || '', /application\/json/, 'LIVE_JSON_EXPECTED');
  assert.ok(Number(response.headers.get('content-length') || 0) <= MAX_BYTES, 'LIVE_GET_TOO_LARGE');
  const bytes = await response.arrayBuffer();
  assert.ok(bytes.byteLength <= MAX_BYTES, 'LIVE_GET_TOO_LARGE');
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

async function tournamentPages(communityId, token, fetchImpl = fetch) {
  const tournaments = [];
  for (let page = 0; page < MAX_PAGES && tournaments.length < MAX_TOURNAMENTS; page++) {
    const url = '/api/communities/' + communityId + '/tournaments?page=' + page;
    const result = await getJson(url, token, fetchImpl);
    assert.ok(Array.isArray(result?.tournaments) && result.page === page
      && typeof result.hasMore === 'boolean', 'TOURNAMENT_PAGE_FORMAT');
    tournaments.push(...result.tournaments.slice(0, MAX_TOURNAMENTS - tournaments.length));
    if (!result.hasMore) break;
  }
  return tournaments;
}

async function browserReadOnly(tokens, selectedCommunities, chromium) {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  const contexts = [];
  const allowed = new Set([SITE, API]);
  let rejectedWrites = 0;
  try {
    for (const [index, token] of tokens.entries()) {
      const context = await browser.newContext({
        locale: 'pt-PT', viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block', acceptDownloads: false
      });
      contexts.push(context);
      await context.addInitScript(t => localStorage.setItem('t', t), token);
      await context.route('**/*', async route => {
        const req = route.request();
        const u = new URL(req.url());
        if (!['GET', 'HEAD'].includes(req.method())) {
          rejectedWrites++;
          return route.fulfill({status: 403, contentType:'text/plain', body:'Read only'});
        }
        if (!allowed.has(u.origin)) return route.abort('blockedbyclient');
        return route.continue();
      });
      const page = await context.newPage();
      const selectedCommunity = selectedCommunities[index] ?? null;
      const route = selectedCommunity
        ? '/menu/communities/' + selectedCommunity + '?tab=tournaments'
        : '/menu/communities?view=mine';
      const response = await page.goto(SITE + route, {
        waitUntil: 'domcontentloaded', timeout: 45000
      });
      assert.equal(response?.status(), 200, 'LIVE_SITE_NOT_200');
      await page.locator('.communities-page').waitFor({state:'visible',timeout:25000});
      assert.notEqual(new URL(page.url()).pathname, '/login', 'LIVE_AUTH_REDIRECT');
      if (selectedCommunity) {
        await page.locator('.communities-page.community-detail-page').waitFor({
          state:'visible',timeout:15000
        });
        // A matching URL alone can show an unloaded or error-only detail page.
        // Require the actual community presentation to have rendered.
        await page.locator('.community-detail h2').first().waitFor({
          state: 'visible', timeout: 15000
        });
      }
      await page.close();
    }
    return rejectedWrites;
  } finally {
    await Promise.all(contexts.map(c => c.close().catch(() => {})));
    await browser.close().catch(() => {});
  }
}
async function run({ passwords = [process.env.JYNLO_QA_PASSWORD_1,
  process.env.JYNLO_QA_PASSWORD_2], fetchImpl = fetch, browserEngine,
  report = console.log } = {}) {
  assert.ok(Array.isArray(passwords) && passwords.length === 2
    && passwords.every(v => typeof v === 'string' && v.length >= 8),
  'QA_SECRETS_NOT_CONFIGURED');
  // Login is the ONLY POST; never create community or tournament resources.
  const tokens = await Promise.all(ACCOUNTS.map((u,i) =>
    authenticate(u, passwords[i], fetchImpl)));
  report('[PASS] Two disposable QA users authenticated (no credentials printed).');

  const lists = await Promise.all(tokens.map(t => getJson('/api/communities/mine', t, fetchImpl)));
  const shared = commonCommunities(lists[0], lists[1]);
  report('[PASS] Both accounts read own community memberships.');

  // Audit each account's own communities even when they do not share one.
  // Shared archives are compared across accounts, but do not gate all checks.
  const own = lists.map(ownCommunities);
  const indexed = [];
  let archived = 0, active = 0;
  for (let index = 0; index < tokens.length; index++) {
    const entries = new Map();
    for (const id of own[index]) {
      const tournaments = await tournamentPages(id, tokens[index], fetchImpl);
      for (const t of tournaments.filter(t => t.scoringMode === 'RACE_POINTS'
          && isId(t.id))) {
        const endpoint = '/api/communities/' + id + '/tournaments/' + t.id + '/races';
        const data = await getJson(endpoint, tokens[index], fetchImpl);
        assert.ok(Array.isArray(data?.linkedRaces)
          && Array.isArray(data?.standings) && Array.isArray(data?.pointsByPlace),
        'KARTING_OVERVIEW_FORMAT');
        if (t.status === 'COMPLETED') {
          validateArchived(t, data);
          archived++;
        } else active++;
        entries.set(id + ':' + t.id, {t, data});
      }
    }
    indexed.push(entries);
  }
  let crossChecked = 0;
  for (const [key, a] of indexed[0]) {
    const b = indexed[1].get(key);
    if (!b || a.t.status !== 'COMPLETED' || b.t.status !== 'COMPLETED') continue;
    assert.deepEqual(a.data, b.data, 'ARCHIVE_DIFFERS_BETWEEN_MEMBERS');
    crossChecked++;
  }
  report('[PASS] Karting API read-only checks complete; private data not printed.');
  if (archived === 0) {
    report('[SKIP] No completed Karting championship found in bounded QA memberships.');
  } else {
    report('[PASS] Completed Karting snapshots validated for available QA accounts.');
  }
  if (crossChecked > 0) {
    report('[PASS] Archived Karting classification is identical across two members.');
  } else {
    report('[SKIP] No shared completed Karting championship was available to compare.');
  }
  const chromium = browserEngine || require('playwright').chromium;
  const blocked = await browserReadOnly(tokens, own.map(ids => ids[0] ?? null), chromium);
  report('[PASS] Two separate Chromium contexts opened live authenticated communities.');
  report('[INFO] Browser-side blocked non-read requests: ' + blocked);
  return { shared: shared.length, archived, active, crossChecked, blocked };
}
if (require.main === module) {
  run().catch(error => {
    console.error('[FAIL] Jynlo authenticated read-only QA: ' + safeError(error));
    process.exitCode = 1;
  });
}
module.exports = { run, readOnlyPath, commonCommunities, ownCommunities,
  tournamentPages, validateArchived, safeError };
