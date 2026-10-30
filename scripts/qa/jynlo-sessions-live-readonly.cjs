#!/usr/bin/env node
'use strict';

/*
 * Opt-in LIVE read-only QA of sessions owned/joined/waitlisted by two
 * pre-authorized disposable Jynlo QA identities.
 *
 * Exactly two permitted HTTP methods: POST only /api/auth/login, then GET
 * explicitly allowlisted own-session endpoints. No POST join, send, delete,
 * leave, invite, update, email, or cross-account queries. All responses are
 * size bounded; no JWTs, passwords, identifiers or player names in logs.
 */
const assert = require('node:assert/strict');

const API = 'https://api.d24sports.com';
const ACCOUNTS = ['jynloteste01', 'jynloteste02'];
const MAX_BYTES = 1_000_000;
const MAX_SESSION_CHECKS_PER_ACCOUNT = 3;
const REQUEST_TIMEOUT_MS = 12_000;
const validId = id => Number.isSafeInteger(id) && id > 0;
const validStatus = s => ['OPEN', 'FULL', 'COMPLETED', 'CANCELLED'].includes(s);

function createRunner({ fetchImpl = globalThis.fetch, output = console.log } = {}) {
  assert.equal(typeof fetchImpl, 'function', 'Node.js 22+ fetch required');

  async function request(path, { token, body } = {}) {
    assert.match(path, /^\/api\//);
    const login = path === '/api/auth/login';
    const own = path === '/api/sessions/mine';
    const detail = /^\/api\/sessions\/[1-9]\d*$/.test(path);
    const roster = /^\/api\/sessions\/[1-9]\d*\/participants$/.test(path);
    assert.ok(login || own || detail || roster, 'Unauthorized QA endpoint');
    assert.ok(login ? !token && body : token && body === undefined,
      'Invalid auth context for QA request');

    const url = new URL(path, API);
    assert.equal(url.origin, API, 'Unexpected QA host');
    const response = await fetchImpl(url.href, {
      method: login ? 'POST' : 'GET',
      redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(login ? { 'Content-Type': 'application/json' } : {})
      },
      ...(login ? { body: JSON.stringify(body) } : {})
    });
    assert.equal(response.ok, true,
      'HTTP ' + response.status + ' at ' + (login ? 'QA login' : path));

    const type = response.headers?.get?.('content-type') || '';
    assert.match(type, /application\/json/i, 'JSON required');
    const sizeHeader = Number(response.headers?.get?.('content-length') || 0);
    assert.ok(sizeHeader <= MAX_BYTES, 'QA response too large');
    const payload = await response.text();
    assert.ok(Buffer.byteLength(payload, 'utf8') <= MAX_BYTES,
      'QA response exceeded payload limit');
    try { return JSON.parse(payload); }
    catch { throw new Error('Invalid JSON returned by a QA endpoint'); }
  }

  async function login(username, password) {
    assert.ok(ACCOUNTS.includes(username), 'Unexpected QA username');
    assert.ok(typeof password === 'string' && password.length > 0,
      'QA credentials missing: configure protected GitHub Actions secrets');
    const auth = await request('/api/auth/login', {
      body: { username, password }
    });
    assert.notEqual(auth.mfaRequired, true, 'QA account requires MFA; do not bypass');
    assert.equal(auth.profile?.username?.toLowerCase(), username,
      'QA login returned a mismatched identity');
    assert.ok(typeof auth.token === 'string' && auth.token.length > 30,
      'QA login returned no usable token');
    return auth.token;
  }

  function checkSummary(item) {
    assert.ok(item && validId(item.id), 'Invalid QA session ID');
    assert.ok(typeof item.sport === 'string' && item.sport.length > 0,
      'QA session sport missing');
    assert.ok(typeof item.city === 'string' && item.city.length > 0,
      'QA session city missing');
    assert.ok(Number.isFinite(Date.parse(item.gameDate)), 'QA session date invalid');
    assert.ok(validStatus(item.status), 'QA session status unknown');
    assert.ok(Number.isInteger(item.participantCount)
      && item.participantCount >= 0, 'Invalid confirmed participant count');
    assert.ok(Number.isInteger(item.maxParticipants)
      && item.maxParticipants > 0, 'Invalid session capacity');
    assert.ok(typeof item.privateGame === 'boolean', 'Session visibility missing');
  }

  async function audit(username, token) {
    const mine = await request('/api/sessions/mine', { token });
    for (const bucket of ['created', 'joined', 'waitlisted']) {
      assert.ok(Array.isArray(mine?.[bucket]), 'My sessions bucket missing');
      assert.ok(mine[bucket].length <= 5000, 'Unexpected unbounded my-sessions list');
      const ids = new Set();
      for (const s of mine[bucket]) {
        checkSummary(s);
        assert.equal(ids.has(s.id), false, 'Duplicate session in same bucket');
        ids.add(s.id);
      }
    }

    let checked = 0;
    const checkedIds = new Set();
    for (const bucket of ['created', 'joined', 'waitlisted']) {
      const candidate = mine[bucket].find(s => !checkedIds.has(s.id));
      if (!candidate || checked >= MAX_SESSION_CHECKS_PER_ACCOUNT) continue;
      checkedIds.add(candidate.id);
      const detail = await request('/api/sessions/' + candidate.id, { token });
      assert.equal(detail.id, candidate.id, 'My sessions detail ID mismatch');
      checkSummary(detail);
      assert.ok(typeof detail.joined === 'boolean'
        && typeof detail.waitlisted === 'boolean',
      'Detail missing membership flags');
      assert.ok(typeof detail.creatorUsername === 'string'
        && detail.creatorUsername.length > 0, 'Detail missing organizer');
      if (bucket === 'created') {
        assert.equal(detail.creatorUsername.toLowerCase(), username,
          'Created session organizer differs from QA account');
      } else if (bucket === 'joined') {
        assert.equal(detail.joined, true, 'My joined session missing joined flag');
      } else if (bucket === 'waitlisted') {
        assert.equal(detail.waitlisted, true, 'Waitlist entry missing waitlisted flag');
      }

      // The caller is authorized to read the roster only as creator or member.
      const authorizedRoster = detail.joined
        || detail.creatorUsername.toLowerCase() === username;
      if (authorizedRoster) {
        const roster = await request('/api/sessions/' + candidate.id + '/participants',
          { token });
        assert.ok(Array.isArray(roster), 'Participant roster must be an array');
        assert.ok(roster.length <= 500, 'Unexpected unbounded participant list');
        for (const member of roster) {
          assert.ok(validId(member.id) && typeof member.username === 'string'
            && member.username.length > 0, 'Participant response is malformed');
        }
      }
      checked++;
    }
    output('[PASS] Authenticated session buckets, detail and authorized roster contract checked for a disposable QA account.');
    if (checked === 0) {
      output('[SKIP] No owned, joined or waitlisted QA sessions available for detail checks.');
    }
    return checked;
  }

  async function run({ passwords } = {}) {
    assert.ok(Array.isArray(passwords) && passwords.length === ACCOUNTS.length
      && passwords.every(p => typeof p === 'string' && p.length > 0),
    'Both protected QA passwords required; no production calls were made');
    let details = 0;
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const token = await login(ACCOUNTS[i], passwords[i]);
      details += await audit(ACCOUNTS[i], token);
    }
    output('[PASS] LIVE read-only session ownership audit complete: two QA accounts.');
    if (details === 0) output('[INFO] No sample detail exists; full detail coverage remains unverified.');
    return { accountsChecked: ACCOUNTS.length, detailChecks: details };
  }
  return { run };
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error('[FAIL] No command line flags permitted for LIVE QA.');
    process.exitCode = 1;
  } else {
    createRunner().run({
      passwords: [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2]
    }).catch(error => {
      // Errors contain only controlled route names/statuses. Never dump request
      // objects, fetch bodies, credentials, JWTs, or player data.
      console.error('[FAIL]', error.message);
      process.exitCode = 1;
    });
  }
}
module.exports = { createRunner };
