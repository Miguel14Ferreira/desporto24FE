'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPreflight } = require('./jynlo-email-live-preflight.cjs');

function fixture({ isolated = true, wrongMember = false, pending = false } = {}) {
  const calls = [];
  const users = ['jynloteste01', 'jynloteste02'];
  async function fetchImpl(url, o) {
    const p = new URL(url);
    assert.equal(p.origin, 'https://api.d24sports.com');
    const path = p.pathname;
    calls.push((o.method || 'GET') + ' ' + path);
    const who = o.headers.Authorization?.endsWith('1') ? 0 : 1;
    let value;
    if (path === '/api/auth/login') {
      const b = JSON.parse(o.body);
      assert.equal(b.password, b.username === users[0] ? 'qa1-pass' : 'qa2-pass');
      value = { token: 'jwt-token-' + 'x'.repeat(32) + (b.username === users[0] ? '1' : '2'),
        profile: { username: b.username }, mfaRequired: false };
    } else if (path === '/api/communities/mine') {
      value = who === 0 ? [{
        id: 123, ownerUsername: users[0], memberCount: wrongMember ? 2 : 1,
        members: [{ username: users[0] }]
      }] : [];
    } else if (path === '/api/communities/invites/me') {
      value = who === 1 && pending ? [{ communityId: 123 }] : [];
    } else if (path === '/api/notifications/me/preferences') {
      value = { inAppEnabled: true, emailEnabled: true,
        disabledInAppTypes: [], disabledEmailTypes: [] };
    } else if (path === '/api/communities/123') {
      value = { id: 123, ownerUsername: users[0],
        memberCount: isolated ? 1 : 2, members: [{ username: users[0] }] };
    } else throw new Error('Unknown route ' + path);
    return { ok: true, status: 200, json: async () => value };
  }
  const output = [];
  const runner = createPreflight({fetchImpl, output: s => output.push(s)});
  return {calls, output, execute: passwords => runner.run({passwords: passwords ?? ['qa1-pass','qa2-pass']})};
}

test('qualifies only isolated owner community, never changes app or emits email', async () => {
  const f = fixture();
  assert.deepEqual(await f.execute(), {safeCandidate: true, modifiedProduction:false});
  assert.deepEqual(f.output.map(x=>x.slice(0,7)), ['[READY]']);
  assert.equal(f.calls.filter(x=>x.startsWith('POST ')).length, 2);
  assert.equal(f.calls.some(x=>/^(PUT|DELETE|PATCH) /.test(x)),false);
  assert.equal(f.calls.some(x=>/POST \/api\/communities/.test(x)),false);
});

test('rejects a community with unexpected membership', async () => {
  const f = fixture({wrongMember:true});
  assert.equal((await f.execute()).safeCandidate,false);
  assert.ok(f.output[0].startsWith('[SKIP]'));
});

test('rejects a community with a pending QA invitation', async () => {
  const f = fixture({pending:true});
  assert.equal((await f.execute()).safeCandidate,false);
});

test('double-checks ownership and membership via authenticated community detail', async () => {
  const f = fixture({isolated:false});
  assert.equal((await f.execute()).safeCandidate,false);
});

test('stops before the network if secrets are missing', async () => {
  const f = fixture();
  await assert.rejects(() => f.execute(['qa1-pass','']), /QA passwords missing/);
  assert.equal(f.calls.length,0);
});
