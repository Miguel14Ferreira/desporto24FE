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
const MAX_COMMUNITIES = 3;
const MAX_TOURNAMENTS = 15;

function isId(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function readOnlyPath(path) {
  assert.equal(typeof path, 'string');
  assert.match(path, /^\/api\/communities(?:\/mine|\/[1-9]\d*\/tournaments(?:\?page=0|\/[1-9]\d*\/races)?)$/);
  return path;
}
function commonCommunities(first, second) {
  assert.ok(Array.isArray(first) && Array.isArray(second), 'COMMUNITIES_FORMAT');
  const ids = new Set(second.filter(c => isId(c?.id)).map(c => c.id));
  return first.filter(c => isId(c?.id) && ids.has(c.id))
    .map(c => c.id).slice(0, MAX_COMMUNITIES);
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
async function browserReadOnly(tokens, selectedCommunity, chromium) {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  const contexts = [];
  const allowed = new Set([SITE, API]);
  let rejectedWrites = 0;
  try {
    for (const token of tokens) {
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

  let archived = 0, active = 0;
  for (const id of shared) {
    const path = '/api/communities/' + id + '/tournaments?page=0';
    const pages = await Promise.all(tokens.map(t => getJson(path, t, fetchImpl)));
    for (const p of pages) {
      assert.ok(Array.isArray(p?.tournaments) && p.page === 0
        && typeof p.hasMore === 'boolean', 'TOURNAMENT_PAGE_FORMAT');
    }
    // Never guess tournament IDs or request data from communities not joined by both QA users.
    const otherIds = new Set(pages[1].tournaments.map(t => t.id));
    const karting = pages[0].tournaments.filter(t =>
      t.scoringMode === 'RACE_POINTS' && isId(t.id) && otherIds.has(t.id))
      .slice(0, MAX_TOURNAMENTS);
    for (const t of karting) {
      const endpoint = '/api/communities/' + id + '/tournaments/' + t.id + '/races';
      const data = await Promise.all(tokens.map(token => getJson(endpoint, token, fetchImpl)));
      assert.ok(data.every(d => Array.isArray(d?.linkedRaces)
        && Array.isArray(d?.standings) && Array.isArray(d?.pointsByPlace)),
      'KARTING_OVERVIEW_FORMAT');
      if (t.status === 'COMPLETED') {
        for (const d of data) validateArchived(t, d);
        assert.deepEqual(data[0], data[1], 'ARCHIVE_DIFFERS_BETWEEN_MEMBERS');
        archived++;
      } else active++;
    }
  }
  report('[PASS] Karting API read-only checks complete; private data not printed.');
  if (shared.length === 0) {
    report('[SKIP] QA accounts do not share a community; no tournament was inspected.');
  } else if (archived === 0) {
    report('[SKIP] No shared completed Karting championship found for archive verification.');
  } else {
    report('[PASS] Archived Karting classification is identical across two members.');
  }
  const chromium = browserEngine || require('playwright').chromium;
  const blocked = await browserReadOnly(tokens, shared[0] ?? null, chromium);
  report('[PASS] Two separate Chromium contexts opened live authenticated communities.');
  report('[INFO] Browser-side blocked non-read requests: ' + blocked);
  return { shared: shared.length, archived, active, blocked };
}
if (require.main === module) {
  run().catch(error => {
    console.error('[FAIL] Jynlo authenticated read-only QA: ' + safeError(error));
    process.exitCode = 1;
  });
}
module.exports = { run, readOnlyPath, commonCommunities, validateArchived, safeError };
