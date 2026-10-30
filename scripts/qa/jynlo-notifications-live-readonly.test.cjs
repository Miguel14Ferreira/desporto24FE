'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner } = require('./jynlo-notifications-live-readonly.cjs');

const USERS = ['jynloteste01', 'jynloteste02'];

function fixture({ wrongCount = false, leak = false, mutedLeak = false, mfa = false, statusOnCross = 403 } = {}) {
  const calls = [];
  const qa1 = [
    { id: 101, username: USERS[0], type: 'SESSION_INVITE', read: false },
    ...(mutedLeak ? [{ id: 102, username: USERS[0], type: 'CHAT_MESSAGE', read: false }] : []),
    ...(leak ? [{ id: 103, username: 'unrelated-real-user', type: 'SESSION_INVITE', read: false }] : [])
  ];
  async function fetchImpl(url, options) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.d24sports.com');
    assert.equal(options.redirect, 'error');
    const method = options.method;
    const path = parsed.pathname;
    calls.push(method + ' ' + path);
    assert.ok(method === 'GET' || (method === 'POST' && path === '/api/auth/login'));
    let response;
    if (path === '/api/auth/login') {
      const { username, password } = JSON.parse(options.body);
      assert.ok(USERS.includes(username));
      assert.equal(password, username === USERS[0] ? 'qa1secret' : 'qa2secret');
      response = {
        token: 'live-fixture-jwt-token-with-more-than-thirty-characters-' + username,
        profile: { username }, mfaRequired: mfa
      };
    } else {
      assert.ok(options.headers.Authorization.startsWith('Bearer live-fixture-jwt-token'));
      const username = options.headers.Authorization.endsWith(USERS[0]) ? USERS[0] : USERS[1];
      if (path === '/api/notifications/me/preferences') {
        response = username === USERS[0] ?
          { inAppEnabled: true, emailEnabled: true,
            disabledInAppTypes: ['CHAT_MESSAGE'], disabledEmailTypes: ['COMMUNITY_INVITE'] } :
          { inAppEnabled: false, emailEnabled: false,
            disabledInAppTypes: [], disabledEmailTypes: [] };
      } else if (path === '/api/notifications/me') {
        response = username === USERS[0] ? qa1 : [];
      } else if (path === '/api/notifications/me/unread-count') {
        response = username === USERS[0] ? (wrongCount ? 2 : qa1.length) : 0;
      } else if (path === '/api/notifications/' + USERS[1 - USERS.indexOf(username)]) {
        return { ok: false, status: statusOnCross, json: async () => ({}) };
      } else {
        throw new Error('Unexpected production API path ' + path);
      }
    }
    return { ok: true, status: 200, json: async () => response };
  }
  return { fetchImpl, calls };
}
const run = (f, passwords = ['qa1secret', 'qa2secret']) =>
  createRunner({ fetchImpl: f.fetchImpl, output: () => {} }).run({ passwords });

test('checks two signed-in QA profiles without modifying preferences or triggering optional email', async () => {
  const f = fixture();
  assert.deepEqual(await run(f), { phase: 'readonly', accountsChecked: 2 });
  assert.equal(f.calls.filter(x => x.startsWith('POST ')).length, 2);
  assert.deepEqual(f.calls.filter(x => x.startsWith('POST ')), [
    'POST /api/auth/login', 'POST /api/auth/login'
  ]);
  assert.equal(f.calls.filter(x => /^(PUT|DELETE|PATCH) /.test(x)).length, 0);
  assert.equal(f.calls.some(x => /invite|friend-request|email/.test(x)), false);
  assert.equal(f.calls.filter(x => x === 'GET /api/notifications/me/unread-count').length, 2);
});

test('fails before contacting the API if either QA secret is unavailable', async () => {
  const f = fixture();
  await assert.rejects(() => run(f, ['qa1secret', '']), /passwords QA/);
  assert.deepEqual(f.calls, []);
});

test('stops without bypassing MFA if login requires verification', async () => {
  const f = fixture({ mfa: true });
  await assert.rejects(() => run(f), /MFA/);
  assert.equal(f.calls.filter(x => x.startsWith('GET ')).length, 0);
});

test('detects mismatched unread counts from the production API', async () => {
  const f = fixture({ wrongCount: true });
  await assert.rejects(() => run(f), /não coincidem/);
  assert.equal(f.calls.filter(x => x.startsWith('POST ')).length, 2);
});

test('rejects a muted chat notification returned by the filtered endpoint', async () => {
  const f = fixture({ mutedLeak: true });
  await assert.rejects(() => run(f), /categoria desativada/);
});

test('rejects notification data leaked from a different account', async () => {
  const f = fixture({ leak: true });
  await assert.rejects(() => run(f), /outra conta QA/);
});

test('requires ownership gate to return 403, not a permissive response', async () => {
  const f = fixture({ statusOnCross: 200 });
  await assert.rejects(() => run(f), /não bloqueou leitura/);
  assert.equal(f.calls.filter(x => x.startsWith('POST ')).length, 2);
});
