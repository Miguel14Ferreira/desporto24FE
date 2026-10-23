'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner } = require('./jynlo-inbox-live-qa.cjs');

function fakeApi({ areFriends = true, failSending = false } = {}) {
  const state = {
    messages: [{ id: 11, username1: 'jynloteste01', username2: 'jynloteste02',
      text: 'antiga', date: new Date().toISOString() }],
    cursor: 11, posts: 0, auth: 0, calls: []
  };
  async function fetchImpl(url, request) {
    const parsed = new URL(url), method = request.method || 'GET';
    assert.equal(parsed.origin, 'https://api.d24sports.com');
    const path = parsed.pathname;
    state.calls.push(method + ' ' + path);
    let obj;
    if (path === '/api/auth/login' && method === 'POST') {
      const p = JSON.parse(request.body);
      state.auth++;
      assert.ok(p.username === 'jynloteste01' || p.username === 'jynloteste02');
      assert.equal(p.password, p.username === 'jynloteste01' ? 'p1' : 'p2');
      obj = { token: p.username === 'jynloteste01'
        ? 'qa1-abcdefghij-1234567890-abcdefghij'
        : 'qa2-abcdefghij-1234567890-abcdefghij',
        mfaRequired: false, profile: { username: p.username } };
    } else {
      const user = request.headers.Authorization?.startsWith('Bearer qa1-')
        ? 'jynloteste01' : 'jynloteste02';
      if (path.startsWith('/api/friends/status/')) obj = { friends: areFriends, pendingRequest: false };
      else if (path.endsWith('/info')) obj = { chatBlocked: false };
      else if (path === '/api/messages/inbox/summaries') {
        const refs = JSON.parse(request.body).conversations;
        assert.equal(refs.length, 1);
        const m = state.messages.at(-1);
        obj = [{ kind: 'direct', id: refs[0].id, latestMessageId: m.id,
          latestText: m.text, latestSender: m.username1, latestAt: m.date,
          unreadCount: state.messages.filter(x => x.username2 === user
            && x.id > (user === 'jynloteste02' ? state.cursor : 0)).length }];
      } else if (path === '/api/chat/me/jynloteste02' && method === 'POST') {
        state.posts++;
        if (failSending) throw new Error('socket closed after send');
        const m = { id: 12, username1: 'jynloteste01', username2: 'jynloteste02',
          text: JSON.parse(request.body).text, date: new Date().toISOString() };
        state.messages.push(m);
        obj = m;
      } else if (path.endsWith('/page')) {
        obj = { content: state.messages, last: true };
      } else if (path === '/api/messages/inbox/read') {
        const id = JSON.parse(request.body).lastSeenMessageId;
        state.cursor = Math.max(state.cursor, id);
        const m = state.messages.at(-1);
        obj = { kind: 'direct', id: 'jynloteste01', latestMessageId: m.id,
          latestText: m.text, latestAt: m.date,
          unreadCount: state.messages.filter(x => x.username2 === user && x.id > state.cursor).length };
      } else throw new Error('Unexpected ' + method + ' ' + path);
    }
    return { ok: true, status: 200, json: async () => obj };
  }
  return { fetchImpl, state };
}

test('preflight authenticates and checks permissions without sending or marking read', async () => {
  const mock = fakeApi(), report = [];
  const result = await createRunner({ fetchImpl: mock.fetchImpl, output: x => report.push(x) })
    .run({ passwords: ['p1', 'p2'] });
  assert.equal(result.phase, 'preflight');
  assert.equal(mock.state.posts, 0);
  assert.equal(mock.state.calls.some(x => x.startsWith('PUT ')), false);
  assert.equal(report.some(x => x.includes('[PASS]')), true);
});

test('one tagged QA message advances read state and is visible after a second login', async () => {
  const mock = fakeApi();
  const result = await createRunner({ fetchImpl: mock.fetchImpl, output: () => {} })
    .run({ passwords: ['p1', 'p2'], sendOnce: true });
  assert.equal(result.phase, 'completed');
  assert.equal(mock.state.posts, 1);
  assert.equal(mock.state.cursor, 12);
  assert.equal(mock.state.auth, 3);
  assert.equal(mock.state.calls.filter(x => x === 'PUT /api/messages/inbox/read').length, 1);
});

test('refuses to send if QA accounts are not friends', async () => {
  const mock = fakeApi({ areFriends: false });
  await assert.rejects(() =>
    createRunner({ fetchImpl: mock.fetchImpl, output: () => {} })
      .run({ passwords: ['p1', 'p2'], sendOnce: true }), /não são amigas/);
  assert.equal(mock.state.posts, 0);
});

test('ambiguous send is never retried and does not expose passwords or JWT', async () => {
  const mock = fakeApi({ failSending: true });
  await assert.rejects(() =>
    createRunner({ fetchImpl: mock.fetchImpl, output: () => {} })
      .run({ passwords: ['p1', 'p2'], sendOnce: true }), error => {
    assert.match(error.message, /Não repetir/);
    assert.equal(error.message.includes('p1'), false);
    assert.equal(error.message.includes('qa1-'), false);
    return true;
  });
  assert.equal(mock.state.posts, 1);
});
