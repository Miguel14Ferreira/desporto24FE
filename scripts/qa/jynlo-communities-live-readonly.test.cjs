'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner } = require('./jynlo-communities-live-readonly.cjs');

function fixture({ empty = false, wrong = false } = {}) {
  const calls = [];
  const out = [];
  const names = ['jynloteste01', 'jynloteste02'];
  const group = { id: 701, name: 'QA group', ownerUsername: names[0],
    visibility: 'PRIVATE', memberCount: 2, myRole: 'OWNER', sports: ['Futebol'] };
  const game = { id: 801, communityId: wrong ? 702 : 701, sport: 'Futebol',
    status: 'OPEN', gameDate: '2026-12-01T18:00:00Z', participantCount: 2,
    maxParticipants: 10, recurrenceSeriesId: 'qa-recurring' };

  async function fetchImpl(url, options) {
    const route = new URL(url).pathname;
    assert.equal(new URL(url).origin, 'https://api.d24sports.com');
    calls.push(options.method + ' ' + route);
    assert.ok(options.method === 'GET'
      || (options.method === 'POST' && route === '/api/auth/login'));
    let data;
    if (route === '/api/auth/login') {
      const req = JSON.parse(options.body);
      assert.ok(names.includes(req.username));
      data = { profile: { username: req.username }, mfaRequired: false,
        token: 'fixture-only-opaque-token-0123456789012345-' + req.username };
    } else if (route === '/api/communities/mine') {
      data = empty || options.headers.Authorization.endsWith(names[1]) ? [] : [group];
    } else if (route === '/api/communities/701') {
      data = group;
    } else if (route === '/api/communities/701/sessions') {
      data = [game];
    } else {
      throw Error('Unexpected endpoint');
    }
    return { ok: true, status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(data) };
  }
  return { calls, out,
    run: opts => createRunner({ fetchImpl, output: x => out.push(x) })
      .run({ passwords: ['synthetic-one', 'synthetic-two'], ...opts }) };
}

test('checks joined community sessions without modifying live data', async () => {
  const f = fixture();
  assert.deepEqual(await f.run({ requireCoverage: true }), {
    accountsChecked: 2, communitiesChecked: 1, sessionsChecked: 1, recurringObserved: true
  });
  assert.ok(f.calls.every(x => x.startsWith('GET ') || x === 'POST /api/auth/login'));
  assert.ok(f.out.every(x => !/701|801|qa-recurring/.test(x)));
});

test('strict mode rejects absence of QA community sessions', async () => {
  const f = fixture({ empty: true });
  await assert.rejects(() => f.run({ requireCoverage: true }),
    /QA_COMMUNITY_SESSION_COVERAGE_MISSING/);
});

test('detects cross-community session inconsistencies', async () => {
  await assert.rejects(() => fixture({ wrong: true }).run(),
    /QA_CROSS_COMMUNITY_SESSION/);
});

test('requires both QA credentials before network', async () => {
  const f = fixture();
  await assert.rejects(() => f.run({ passwords: ['', ''] }),
    /QA_BOTH_PASSWORDS_REQUIRED/);
  assert.equal(f.calls.length, 0);
});
