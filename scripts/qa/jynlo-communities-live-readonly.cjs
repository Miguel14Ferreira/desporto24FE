#!/usr/bin/env node
'use strict';

/*
 * Opt-in LIVE contract audit of communities already joined by two disposable QA
 * accounts. POST is used exclusively for login; every subsequent request is GET.
 * No private names, members, tokens, locations or IDs are written to logs.
 */
const assert = require('node:assert/strict');
const API = 'https://api.d24sports.com';
const USERS = ['jynloteste01', 'jynloteste02'];
const MAX_COMMUNITIES = 3;
const MAX_ITEMS = 5000;
const MAX_BYTES = 1_000_000;
const validId = value => Number.isSafeInteger(value) && value > 0;

function createRunner({ fetchImpl = globalThis.fetch, output = console.log } = {}) {
  assert.equal(typeof fetchImpl, 'function', 'Node 22+ fetch required');

  async function request(path, { token, body } = {}) {
    const login = path === '/api/auth/login';
    const own = path === '/api/communities/mine';
    const detail = /^\/api\/communities\/[1-9]\d*$/.test(path);
    const sessions = /^\/api\/communities\/[1-9]\d*\/sessions$/.test(path);
    assert.ok(login || own || detail || sessions, 'QA_ENDPOINT_NOT_ALLOWED');
    assert.ok(login ? !token && body : token && body === undefined, 'QA_AUTH_CONTEXT_INVALID');
    const url = new URL(path, API);
    assert.equal(url.origin, API);
    const response = await fetchImpl(url.href, {
      method: login ? 'POST' : 'GET',
      headers: { Accept: 'application/json',
        ...(login ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(login ? { body: JSON.stringify(body) } : {}),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000)
    });
    assert.equal(response.ok, true, 'QA_HTTP_' + response.status);
    assert.match(response.headers?.get?.('content-type') || '', /application\/json/i);
    const length = Number(response.headers?.get?.('content-length') || 0);
    assert.ok(Number.isFinite(length) && length <= MAX_BYTES, 'QA_PAYLOAD_TOO_LARGE');
    const text = await response.text();
    assert.ok(Buffer.byteLength(text, 'utf8') <= MAX_BYTES, 'QA_PAYLOAD_TOO_LARGE');
    try { return JSON.parse(text); }
    catch { throw new Error('QA_INVALID_JSON'); }
  }

  function communityShape(c) {
    assert.ok(c && validId(c.id), 'QA_INVALID_COMMUNITY_ID');
    assert.ok(typeof c.name === 'string' && c.name.trim(), 'QA_INVALID_COMMUNITY_NAME');
    assert.ok(typeof c.ownerUsername === 'string' && c.ownerUsername.trim(), 'QA_INVALID_OWNER');
    assert.ok(typeof c.visibility === 'string' && c.visibility.length, 'QA_INVALID_VISIBILITY');
    assert.ok(Number.isInteger(c.memberCount) && c.memberCount >= 1, 'QA_INVALID_MEMBER_COUNT');
    assert.ok(Array.isArray(c.sports) && c.sports.every(s => typeof s === 'string'), 'QA_INVALID_SPORTS');
  }

  async function login(user, password) {
    assert.ok(USERS.includes(user) && typeof password === 'string' && password.length > 0,
      'QA_CREDENTIALS_MISSING');
    const result = await request('/api/auth/login', { body: { username: user, password } });
    assert.notEqual(result.mfaRequired, true, 'QA_MFA_REQUIRED');
    assert.equal(result.profile?.username?.toLowerCase(), user, 'QA_LOGIN_IDENTITY_MISMATCH');
    assert.ok(typeof result.token === 'string' && result.token.length > 30, 'QA_TOKEN_INVALID');
    return result.token;
  }

  async function audit(user, token) {
    const mine = await request('/api/communities/mine', { token });
    assert.ok(Array.isArray(mine) && mine.length <= MAX_ITEMS, 'QA_INVALID_COMMUNITY_LIST');
    const ids = new Set();
    for (const c of mine) {
      communityShape(c);
      assert.ok(!ids.has(c.id), 'QA_DUPLICATE_COMMUNITY');
      ids.add(c.id);
    }
    let checked = 0, checkedSessions = 0, recurring = 0;
    for (const summary of mine.slice(0, MAX_COMMUNITIES)) {
      const id = summary.id;
      const detail = await request('/api/communities/' + id, { token });
      communityShape(detail);
      assert.equal(detail.id, id, 'QA_COMMUNITY_DETAIL_MISMATCH');
      assert.equal(detail.ownerUsername.toLowerCase(), summary.ownerUsername.toLowerCase(),
        'QA_COMMUNITY_OWNER_MISMATCH');
      assert.ok(typeof detail.myRole === 'string' && detail.myRole.length,
        'QA_NOT_MEMBER');
      const sessions = await request('/api/communities/' + id + '/sessions', { token });
      assert.ok(Array.isArray(sessions) && sessions.length <= MAX_ITEMS,
        'QA_INVALID_COMMUNITY_SESSIONS');
      const sessionIds = new Set();
      for (const s of sessions) {
        assert.ok(s && validId(s.id), 'QA_INVALID_SESSION_ID');
        assert.ok(!sessionIds.has(s.id), 'QA_DUPLICATE_SESSION');
        sessionIds.add(s.id);
        assert.equal(s.communityId, id, 'QA_CROSS_COMMUNITY_SESSION');
        assert.ok(typeof s.sport === 'string' && s.sport.trim(), 'QA_INVALID_SESSION_SPORT');
        assert.ok(typeof s.status === 'string' && s.status.length, 'QA_INVALID_SESSION_STATUS');
        assert.ok(Number.isFinite(Date.parse(s.gameDate)), 'QA_INVALID_SESSION_DATE');
        assert.ok(Number.isInteger(s.participantCount) && s.participantCount >= 0,
          'QA_INVALID_PARTICIPANTS');
        assert.ok(Number.isInteger(s.maxParticipants) && s.maxParticipants > 0,
          'QA_INVALID_CAPACITY');
        if (s.recurrenceSeriesId != null) {
          assert.ok(typeof s.recurrenceSeriesId === 'string' && s.recurrenceSeriesId.trim(),
            'QA_INVALID_RECURRENCE');
          recurring++;
        }
        checkedSessions++;
      }
      checked++;
    }
    output('[PASS] QA community membership, details and session ownership contracts checked.');
    if (checked === 0) output('[SKIP] QA account has no communities for detail verification.');
    return { checked, checkedSessions, recurring };
  }

  async function run({ passwords, requireCoverage = false } = {}) {
    assert.ok(Array.isArray(passwords) && passwords.length === 2
      && passwords.every(p => typeof p === 'string' && p.length > 0),
    'QA_BOTH_PASSWORDS_REQUIRED');
    let communities = 0, sessions = 0, recurring = 0;
    for (let i = 0; i < USERS.length; i++) {
      const token = await login(USERS[i], passwords[i]);
      const result = await audit(USERS[i], token);
      communities += result.checked;
      sessions += result.checkedSessions;
      recurring += result.recurring;
    }
    if (communities === 0 || sessions === 0) {
      output('[INFO] QA community/session samples incomplete; no writes performed.');
      assert.ok(!requireCoverage, 'QA_COMMUNITY_SESSION_COVERAGE_MISSING');
    }
    output('[PASS] LIVE QA read-only community contract audit complete.');
    output('[INFO] Recurring sessions observed: ' + (recurring > 0 ? 'yes' : 'not verified'));
    return { accountsChecked: 2, communitiesChecked: communities, sessionsChecked: sessions,
      recurringObserved: recurring > 0 };
  }
  return { run };
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error('[FAIL] LIVE QA does not accept arguments.');
    process.exitCode = 2;
  } else {
    createRunner().run({
      passwords: [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2],
      requireCoverage: process.env.JYNLO_QA_REQUIRE_COMMUNITY_COVERAGE === 'true'
    }).catch(e => {
      console.error('[FAIL] ' + (e instanceof Error ? e.message : 'QA_UNKNOWN_ERROR'));
      process.exitCode = 1;
    });
  }
}
module.exports = { createRunner };
