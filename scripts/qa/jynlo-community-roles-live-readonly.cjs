#!/usr/bin/env node
'use strict';

/*
 * Strictly allowlisted LIVE authorization audit for TWO pre-authorized,
 * disposable Jynlo QA accounts. Auth POST only; then bounded GET requests.
 * Never submit enrollment, publish, score, delete, invite, or moderate.
 * Do not print/store tokens, usernames, community IDs, private response bodies,
 * screenshots, cookies, recordings, traces or any real user data.
 *
 * This probes *read* authorization and role consistency. It CANNOT prove the
 * authorization of write endpoints, which are covered by backend unit tests.
 */
const assert = require('node:assert/strict');
const API = 'https://api.d24sports.com';
const ACCOUNTS = ['jynloteste01', 'jynloteste02'];
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_OWN_COMMUNITIES = 3;
const MAX_SHARED_COMMUNITIES = 2;
const MAX_TOURNAMENT_DETAILS = 2;
const MAX_NEGATIVE_PROBES = 1;
const ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);
const isId = value => Number.isSafeInteger(value) && value > 0;

function allowedPath(path) {
  assert.equal(typeof path, 'string', 'INVALID_PATH');
  assert.match(path, /^\/api\/communities\/(?:mine|[1-9]\d*(?:\/tournaments(?:\?page=0|\/[1-9]\d*)?)?)$/, 'ENDPOINT_NOT_ALLOWLISTED');
  return path;
}
function safeError(error) {
  const code = error && typeof error.message === 'string' ? error.message : '';
  return /^[A-Z][A-Z0-9_]{3,64}$/.test(code) ? code : 'ROLE_QA_CHECK_FAILED';
}
function summaries(communities) {
  assert.ok(Array.isArray(communities) && communities.length <= 2000, 'COMMUNITIES_FORMAT');
  const ids = new Set();
  for (const item of communities) {
    assert.ok(item && isId(item.id) && ROLES.has(item.myRole)
      && ['PUBLIC','PRIVATE'].includes(item.visibility), 'COMMUNITY_ROLE_FORMAT');
    assert.equal(ids.has(item.id), false, 'COMMUNITY_DUPLICATE');
    ids.add(item.id);
  }
  return communities.slice(0, MAX_OWN_COMMUNITIES).map(item => ({
    id: item.id, role: item.myRole, visibility: item.visibility
  }));
}
function sharedMemberships(first, second) {
  const ids = new Set(second.map(x => x.id));
  return first.filter(x => ids.has(x.id)).slice(0, MAX_SHARED_COMMUNITIES);
}
function nonmemberProbe(first, second) {
  const ids = new Set(second.map(x => x.id));
  return first.find(x => x.visibility === 'PRIVATE' && !ids.has(x.id)) || null;
}

function createRunner({ fetchImpl = globalThis.fetch, output = console.log } = {}) {
  assert.equal(typeof fetchImpl, 'function', 'NODE_FETCH_REQUIRED');
  let requests = 0;
  const MAX_REQUESTS = 34;

  async function request(path, { token, username, password } = {}) {
    const login = path === '/api/auth/login';
    if (!login) allowedPath(path);
    assert.ok(login ? !token && ACCOUNTS.includes(username) && !!password
      : typeof token === 'string' && !!token && !username && !password,
    'INVALID_QA_AUTH_CONTEXT');
    assert.ok(++requests <= MAX_REQUESTS, 'REQUEST_BUDGET_EXCEEDED');
    const uri = new URL(path, API);
    assert.equal(uri.origin, API, 'INVALID_ORIGIN');
    let response;
    try {
      response = await fetchImpl(uri.href, {
        method: login ? 'POST' : 'GET',
        redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: 'application/json',
          ...(login ? { 'Content-Type': 'application/json' }
            : { Authorization: 'Bearer ' + token })
        },
        ...(login ? { body: JSON.stringify({ username, password }) } : {})
      });
    } catch {
      throw Error('LIVE_NETWORK_ERROR');
    }
    assert.ok(Number.isSafeInteger(response.status), 'HTTP_STATUS_INVALID');
    return response;
  }

  async function readJson(response) {
    if (response.status !== 200) throw Error('EXPECTED_HTTP_200');
    if (!/application\/json/i.test(response.headers.get('content-type') || '')) {
      throw Error('EXPECTED_JSON');
    }
    const len = Number(response.headers.get('content-length') || 0);
    if (!Number.isFinite(len) || len < 0 || len > MAX_RESPONSE_BYTES) {
      throw Error('RESPONSE_TOO_LARGE');
    }
    let bytes;
    try { bytes = await response.arrayBuffer(); } catch { throw Error('RESPONSE_READ_FAILED'); }
    if (bytes.byteLength > MAX_RESPONSE_BYTES) throw Error('RESPONSE_TOO_LARGE');
    try { return JSON.parse(Buffer.from(bytes).toString('utf8')); }
    catch { throw Error('INVALID_JSON'); }
  }

  async function login(username, password) {
    assert.ok(typeof password === 'string' && password.length >= 8,
      'QA_SECRETS_NOT_CONFIGURED');
    const data = await readJson(await request('/api/auth/login', { username, password }));
    assert.equal(data.mfaRequired === true, false, 'QA_MFA_NOT_SUPPORTED');
    assert.equal(data.profile?.username?.toLowerCase(), username, 'LOGIN_IDENTITY_MISMATCH');
    assert.ok(typeof data.token === 'string' && data.token.length > 30, 'LOGIN_TOKEN_MISSING');
    return data.token;
  }

  async function ownDetail(item, token) {
    const data = await readJson(await request('/api/communities/' + item.id, { token }));
    assert.equal(data.id, item.id, 'OWN_COMMUNITY_ID_MISMATCH');
    assert.equal(data.myRole, item.role, 'COMMUNITY_ROLE_MISMATCH');
    assert.equal(data.visibility, item.visibility, 'COMMUNITY_VISIBILITY_MISMATCH');
  }

  async function listTournaments(id, token) {
    const data = await readJson(await request('/api/communities/' + id
      + '/tournaments?page=0', { token }));
    assert.ok(data && data.page === 0 && typeof data.hasMore === 'boolean'
      && Array.isArray(data.tournaments), 'TOURNAMENT_PAGE_FORMAT');
    const selected = data.tournaments.slice(0, MAX_TOURNAMENT_DETAILS);
    for (const entry of selected) {
      assert.ok(isId(entry?.id) && ['DRAFT','IN_PROGRESS','COMPLETED'].includes(entry.status),
        'TOURNAMENT_ITEM_FORMAT');
      const detail = await readJson(await request('/api/communities/' + id
        + '/tournaments/' + entry.id, { token }));
      assert.equal(detail.id, entry.id, 'TOURNAMENT_DETAIL_ID_MISMATCH');
      assert.equal(detail.status, entry.status, 'TOURNAMENT_STATUS_MISMATCH');
    }
    return selected.length;
  }

  async function deniedRead(communityId, token) {
    assert.ok(isId(communityId), 'NEGATIVE_PROBE_INVALID_ID');
    const response = await request('/api/communities/' + communityId, { token });
    // Strictest rule: do not read, log, buffer, deserialize or display the body
    // even if backend unexpectedly returns a 200. Only inspect HTTP status.
    assert.ok(response.status === 403 || response.status === 404,
      'NONMEMBER_READ_NOT_DENIED');
  }

  async function run({ passwords } = {}) {
    assert.ok(Array.isArray(passwords) && passwords.length === 2
      && passwords.every(x => typeof x === 'string' && x.length >= 8),
    'QA_SECRETS_NOT_CONFIGURED');
    const tokens = await Promise.all(ACCOUNTS.map((name, index) =>
      login(name, passwords[index])));
    assert.notEqual(tokens[0], tokens[1], 'QA_IDENTITIES_NOT_DISTINCT');
    const lists = await Promise.all(tokens.map(async token => summaries(
      await readJson(await request('/api/communities/mine', { token })))));
    let detailChecks = 0;
    for (let index = 0; index < 2; index++) {
      for (const item of lists[index]) {
        await ownDetail(item, tokens[index]);
        detailChecks++;
      }
    }

    const common = sharedMemberships(lists[0], lists[1]);
    let rolePairs = 0;
    let tournamentDetails = 0;
    let ownTournamentFallbacks = 0;
    // Only shared communities already authorized for BOTH disposable accounts.
    for (const item of common) {
      const other = lists[1].find(c => c.id === item.id);
      assert.ok(other, 'SHARED_MEMBERSHIP_MISSING');
      if (item.role !== other.role
          && (['OWNER','ADMIN'].includes(item.role) || ['OWNER','ADMIN'].includes(other.role))) {
        rolePairs++;
      }
      for (const token of tokens) tournamentDetails += await listTournaments(item.id, token);
    }

    // A pair of disposable QA accounts may not share a populated tournament.
    // Fall back to ONE exclusive, already-owned community per account, only
    // when shared reads found no tournament details. No community mutations.
    if (tournamentDetails === 0) {
      const commonIds = new Set(common.map(c => c.id));
      for (let i = 0; i < 2; i++) {
        const owned = lists[i].find(c => !commonIds.has(c.id));
        if (!owned) continue;
        ownTournamentFallbacks++;
        tournamentDetails += await listTournaments(owned.id, tokens[i]);
      }
    }

    let denied = 0;
    for (let i = 0; i < 2 && denied < MAX_NEGATIVE_PROBES; i++) {
      const candidate = nonmemberProbe(lists[i], lists[1 - i]);
      if (!candidate) continue;
      await deniedRead(candidate.id, tokens[1 - i]);
      denied++;
    }

    // Only aggregate coverage counters are output; no PII, tokens or IDs.
    output('[PASS] Two disposable QA accounts authenticated independently.');
    if (detailChecks) output('[PASS] Own-community details and roles verified; count=' + detailChecks + '.');
    else output('[SKIP] Neither QA account has an owned membership in the sampled lists; role details untested.');
    if (rolePairs) output('[PASS] Distinct manager/member role pair found in shared QA memberships.');
    else output('[SKIP] No shared QA community with a manager/member role split.');
    if (tournamentDetails) {
      output('[PASS] Authorized tournament detail reads agree with their lists; count='
        + tournamentDetails + '.');
    } else {
      output('[SKIP] No authorized tournament detail sample in shared or fallback first pages.');
    }
    if (denied) output('[PASS] Private non-member community detail refused via GET.');
    else output('[SKIP] No private QA community exclusive to one account; denial not tested.');
    return { accounts: 2, ownDetails: detailChecks, shared: common.length,
      managerMemberPairs: rolePairs, tournamentDetails, ownTournamentFallbacks,
      deniedChecks: denied };
  }
  return { run };
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error('[FAIL] FLAGS_NOT_ALLOWED');
    process.exitCode = 1;
  } else {
    createRunner().run({ passwords: [
      process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2
    ] }).catch(error => {
      console.error('[FAIL] ' + safeError(error));
      process.exitCode = 1;
    });
  }
}
module.exports = { createRunner, allowedPath, summaries, sharedMemberships,
  nonmemberProbe, safeError };
