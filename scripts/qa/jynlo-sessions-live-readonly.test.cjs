'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner } = require('./jynlo-sessions-live-readonly.cjs');

const USERS = ['jynloteste01', 'jynloteste02'];
const FUTURE = '2026-11-01T18:00:00Z';
const sample = (id, extras = {}) => ({
  id, sport: 'Padel', city: 'Lisboa', gameDate: FUTURE,
  participantCount: 2, maxParticipants: 4, priceAmount: 0,
  privateGame: false, status: 'OPEN', audience: 'PUBLIC', ...extras
});

function fixture({ noSessions = false, inconsistentMembership = false,
  wrongOwner = false, malformedRoster = false, invalidBucket = false } = {}) {
  const calls = [];
  const outputs = [];
  const accounts = {
    [USERS[0]]: {
      created: noSessions ? [] : [sample(901)],
      joined: noSessions ? [] : [sample(902)],
      waitlisted: noSessions ? [] : [sample(903)]
    },
    [USERS[1]]: { created: [], joined: [], waitlisted: [] }
  };
  const details = {
    901: sample(901, { creatorUsername: wrongOwner ? 'other-user' : USERS[0],
      joined: false, waitlisted: false }),
    902: sample(902, { creatorUsername: 'qa-organizer',
      joined: !inconsistentMembership, waitlisted: false }),
    903: sample(903, { creatorUsername: 'qa-organizer',
      joined: false, waitlisted: true, waitlistPosition: 2 })
  };
  const members = [
    { id: 61, username: USERS[0], attendanceStatus: 'PENDING', joinedAt: FUTURE }
  ];

  async function fetchImpl(url, options) {
    const parsed = new URL(url), endpoint = parsed.pathname;
    assert.equal(parsed.origin, 'https://api.d24sports.com');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    const method = options.method;
    calls.push(method + ' ' + endpoint);
    assert.ok(method === 'GET' || (method === 'POST' && endpoint === '/api/auth/login'),
      'Unexpected mutation request');
    let body;
    if (method === 'POST') {
      const { username, password } = JSON.parse(options.body);
      assert.ok(USERS.includes(username));
      assert.equal(password, username === USERS[0] ? 'password-one' : 'password-two');
      body = {
        mfaRequired: false, profile: { username },
        token: 'fixture-long-qa-token-opaque-0123456789-' + username
      };
    } else {
      const token = options.headers.Authorization?.replace('Bearer ', '');
      assert.ok(token?.startsWith('fixture-long-qa-token-opaque-'));
      const who = token.endsWith(USERS[0]) ? USERS[0] : USERS[1];
      if (endpoint === '/api/sessions/mine') {
        body = invalidBucket && who === USERS[0] ? { created: {}, joined: [], waitlisted: [] }
          : accounts[who];
      } else {
        const match = /^\/api\/sessions\/(901|902|903)(\/participants)?$/.exec(endpoint);
        assert.ok(match, 'Unexpected endpoint ' + endpoint);
        assert.equal(who, USERS[0], 'Should not access another identity data');
        body = match[2] ? (malformedRoster ? [{ id: 0, username: null }] : members)
          : details[Number(match[1])];
      }
    }
    return { ok: true, status: 200, headers: { get: name =>
      name === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify(body) };
  }
  const runner = createRunner({ fetchImpl, output: x => outputs.push(x) });
  return { calls, outputs, run: passwords =>
    runner.run({ passwords: passwords ?? ['password-one', 'password-two'] }) };
}

test('reads only own sessions, details and authorized participants, with no other mutations', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { accountsChecked: 2, detailChecks: 3 });
  assert.equal(f.calls.filter(x => x === 'POST /api/auth/login').length, 2);
  assert.ok(f.calls.every(x => x.startsWith('GET ') || x === 'POST /api/auth/login'));
  assert.ok(f.calls.includes('GET /api/sessions/901/participants'));
  assert.ok(f.calls.includes('GET /api/sessions/902/participants'));
  assert.equal(f.calls.includes('GET /api/sessions/903/participants'), false,
    'Waitlisted players must not request restricted rosters');
  assert.ok(f.outputs.every(x => !/901|902|903|jynloteste|fixture-long-qa-token/.test(x)),
    'No identifiers, JWTs or accounts in log messages');
});

test('completes safely without existing QA sessions and reports detail coverage gap', async () => {
  const f = fixture({ noSessions: true });
  assert.deepEqual(await f.run(), { accountsChecked: 2, detailChecks: 0 });
  assert.ok(f.outputs.some(x => x.includes('[SKIP]')));
  assert.equal(f.calls.some(x => /\/api\/sessions\/\d+/.test(x)), false);
});

test('requires both secrets before contacting production', async () => {
  const f = fixture();
  await assert.rejects(() => f.run(['password-one', '']), /Both protected QA passwords/);
  assert.equal(f.calls.length, 0);
});

test('rejects invalid my-sessions payloads', async () => {
  const f = fixture({ invalidBucket: true });
  await assert.rejects(() => f.run(), /bucket missing/);
  assert.equal(f.calls.some(x => /PUT|DELETE|PATCH|join|invite/.test(x)), false);
});

test('detects inconsistent joined membership from LIVE detail', async () => {
  const f = fixture({ inconsistentMembership: true });
  await assert.rejects(() => f.run(), /missing joined flag/);
});

test('detects sessions attributed to the wrong creator', async () => {
  const f = fixture({ wrongOwner: true });
  await assert.rejects(() => f.run(), /organizer differs/);
});

test('rejects malformed authorized participant rosters', async () => {
  const f = fixture({ malformedRoster: true });
  await assert.rejects(() => f.run(), /Participant response is malformed/);
});
