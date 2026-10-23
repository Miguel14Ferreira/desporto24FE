'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner } = require('./jynlo-inbox-live-qa.cjs');

const FIRST = 'jynloteste01';
const SECOND = 'jynloteste02';

function fakeApi({ areFriends = true, pendingDirection = null, unrelatedNotification = false,
    omitInvitation = false, failSending = false, failFriendInvitation = false } = {}) {
  const state = {
    messages: [{ id: 11, username1: FIRST, username2: SECOND,
      text: 'antiga', date: new Date().toISOString() }],
    cursor: 11, posts: 0, auth: 0, calls: [], friends: areFriends,
    invites: 0, accepts: 0, pendingDirection, notifications: []
  };
  function invitation(sender, recipient, id = 121) {
    return { id, username: recipient, friendRequest: true,
      message: 'Olá, tu recebeste um novo pedido de amizade vindo de ' + sender
        + '. Tu podes aceitar ou rejeitar este pedido.',
      token: 'synthetic-only-pending-request-' + id };
  }
  if (pendingDirection) {
    state.notifications.push(pendingDirection === 'forward'
      ? invitation(FIRST, SECOND) : invitation(SECOND, FIRST));
  }
  if (unrelatedNotification) state.notifications.push(invitation('outro-utilizador', SECOND, 122));

  async function fetchImpl(url, request) {
    const parsed = new URL(url), method = request.method || 'GET';
    assert.equal(parsed.origin, 'https://api.d24sports.com');
    const path = parsed.pathname;
    state.calls.push(method + ' ' + path);
    let obj;
    if (path === '/api/auth/login' && method === 'POST') {
      const p = JSON.parse(request.body);
      state.auth++;
      assert.ok(p.username === FIRST || p.username === SECOND);
      assert.equal(p.password, p.username === FIRST ? 'p1' : 'p2');
      obj = { token: p.username === FIRST
        ? 'qa1-abcdefghij-1234567890-abcdefghij'
        : 'qa2-abcdefghij-1234567890-abcdefghij',
        mfaRequired: false, profile: { username: p.username } };
    } else {
      const user = request.headers.Authorization?.startsWith('Bearer qa1-')
        ? FIRST : SECOND;
      if (path.startsWith('/api/friends/status/')) {
        const target = path.slice('/api/friends/status/'.length);
        assert.equal(target, user === FIRST ? SECOND : FIRST);
        obj = { friends: state.friends, pendingRequest: !!state.pendingDirection };
      } else if (path.startsWith('/api/friends/add/')) {
        assert.equal(method, 'POST');
        assert.equal(user, FIRST);
        assert.equal(path, '/api/friends/add/' + SECOND);
        assert.equal(state.friends, false);
        assert.equal(state.pendingDirection, null);
        state.invites++;
        if (failFriendInvitation) throw new Error('Network dropped after request');
        state.pendingDirection = 'forward';
        if (!omitInvitation) state.notifications.push(invitation(FIRST, SECOND));
        obj = { message: 'Friend request created' };
      } else if (path === '/api/notifications/me' && method === 'GET') {
        obj = state.notifications.filter(n => n.username === user);
      } else if (/^\/api\/notifications\/friend-request\/\d+\/accept$/.test(path) && method === 'POST') {
        const id = Number(path.split('/')[4]);
        const found = state.notifications.find(n => n.id === id && n.username === user);
        assert.ok(found, 'Must only accept a notification owned by current QA user');
        assert.equal(found.message.includes('vindo de ' + (user === FIRST ? SECOND : FIRST) + '.'), true,
          'Never accept unrelated friend requests');
        state.accepts++;
        state.friends = true;
        state.pendingDirection = null;
        state.notifications = state.notifications.filter(n => n !== found);
        obj = { message: 'accepted' };
      } else if (path.endsWith('/info')) {
        assert.equal(state.friends, true);
        obj = { chatBlocked: false };
      } else if (path === '/api/messages/inbox/summaries') {
        const refs = JSON.parse(request.body).conversations;
        assert.equal(refs.length, 1);
        const m = state.messages.at(-1);
        obj = [{ kind: 'direct', id: refs[0].id, latestMessageId: m.id,
          latestText: m.text, latestSender: m.username1, latestAt: m.date,
          unreadCount: state.messages.filter(x => x.username2 === user
            && x.id > (user === SECOND ? state.cursor : 0)).length }];
      } else if (path === '/api/chat/me/jynloteste02' && method === 'POST') {
        assert.equal(state.friends, true);
        state.posts++;
        if (failSending) throw new Error('socket closed after send');
        const m = { id: 12, username1: FIRST, username2: SECOND,
          text: JSON.parse(request.body).text, date: new Date().toISOString() };
        state.messages.push(m);
        obj = m;
      } else if (path.endsWith('/page')) {
        obj = { content: state.messages, last: true };
      } else if (path === '/api/messages/inbox/read') {
        const id = JSON.parse(request.body).lastSeenMessageId;
        state.cursor = Math.max(state.cursor, id);
        const m = state.messages.at(-1);
        obj = { kind: 'direct', id: FIRST, latestMessageId: m.id,
          latestText: m.text, latestAt: m.date,
          unreadCount: state.messages.filter(x => x.username2 === user && x.id > state.cursor).length };
      } else throw new Error('Unexpected ' + method + ' ' + path);
    }
    return { ok: true, status: 200, json: async () => obj };
  }
  return { fetchImpl, state };
}

const run = (mock, opts = {}) =>
  createRunner({ fetchImpl: mock.fetchImpl, output: () => {} })
    .run({ passwords: ['p1', 'p2'], ...opts });

test('preflight verifies authorized accounts without sending invites, chat or read marks', async () => {
  const mock = fakeApi();
  assert.equal((await run(mock)).phase, 'preflight');
  assert.equal(mock.state.posts, 0);
  assert.equal(mock.state.invites, 0);
  assert.equal(mock.state.calls.some(x => x.startsWith('PUT ')), false);
});

test('one QA message advances read state and is visible after a second login', async () => {
  const mock = fakeApi();
  assert.equal((await run(mock, { sendOnce: true })).phase, 'completed');
  assert.equal(mock.state.posts, 1);
  assert.equal(mock.state.cursor, 12);
  assert.equal(mock.state.auth, 3);
  assert.equal(mock.state.calls.filter(x => x === 'PUT /api/messages/inbox/read').length, 1);
});

test('ordinary preflight fails safely when QA accounts are not friends', async () => {
  const mock = fakeApi({ areFriends: false });
  await assert.rejects(() => run(mock, { sendOnce: true }), /não são amigas/);
  assert.equal(mock.state.posts, 0);
  assert.equal(mock.state.invites, 0);
});

test('friendship setup sends exactly one invitation and accepts only the QA recipient notification', async () => {
  const mock = fakeApi({ areFriends: false, unrelatedNotification: true });
  assert.equal((await run(mock, { ensureFriends: true })).phase, 'preflight');
  assert.equal(mock.state.invites, 1);
  assert.equal(mock.state.accepts, 1);
  assert.equal(mock.state.posts, 0);
  assert.equal(mock.state.friends, true);
  assert.ok(mock.state.notifications.some(x => x.id === 122), 'Unrelated notification remains untouched');
});

test('friendship setup is a no-op when QA accounts are already friends', async () => {
  const mock = fakeApi();
  await run(mock, { ensureFriends: true });
  assert.equal(mock.state.invites, 0);
  assert.equal(mock.state.accepts, 0);
});

test('friendship setup accepts an already pending QA invitation without resending', async () => {
  for (const pendingDirection of ['forward', 'reverse']) {
    const mock = fakeApi({ areFriends: false, pendingDirection });
    await run(mock, { ensureFriends: true });
    assert.equal(mock.state.invites, 0);
    assert.equal(mock.state.accepts, 1);
    assert.equal(mock.state.friends, true);
  }
});

test('friendship setup stops if a pending invitation has no verified QA notification', async () => {
  const mock = fakeApi({ areFriends: false, pendingDirection: 'forward' });
  mock.state.notifications = [];
  await assert.rejects(() => run(mock, { ensureFriends: true }), /nenhuma notificação QA correspondente/);
  assert.equal(mock.state.invites, 0);
  assert.equal(mock.state.accepts, 0);
});

test('missing created notification fails without resending an invitation', async () => {
  const mock = fakeApi({ areFriends: false, omitInvitation: true });
  await assert.rejects(() => run(mock, { ensureFriends: true }), /nenhuma notificação QA correspondente/);
  assert.equal(mock.state.invites, 1);
  assert.equal(mock.state.accepts, 0);
});

test('ambiguous friend invitation is never retried and reveals no tokens or passwords', async () => {
  const mock = fakeApi({ areFriends: false, failFriendInvitation: true });
  await assert.rejects(() => run(mock, { ensureFriends: true }), error => {
    assert.match(error.message, /Não repetir/);
    assert.equal(error.message.includes('p1'), false);
    assert.equal(error.message.includes('qa1-'), false);
    return true;
  });
  assert.equal(mock.state.invites, 1);
  assert.equal(mock.state.accepts, 0);
});

test('combined setup + send-once creates one friendship and one QA chat message', async () => {
  const mock = fakeApi({ areFriends: false });
  assert.equal((await run(mock, { ensureFriends: true, sendOnce: true })).phase, 'completed');
  assert.equal(mock.state.invites, 1);
  assert.equal(mock.state.accepts, 1);
  assert.equal(mock.state.posts, 1);
  assert.equal(mock.state.cursor, 12);
});

test('ambiguous chat send never retries and does not expose passwords or token', async () => {
  const mock = fakeApi({ failSending: true });
  await assert.rejects(() => run(mock, { sendOnce: true }), error => {
    assert.match(error.message, /Não repetir/);
    assert.equal(error.message.includes('p1'), false);
    assert.equal(error.message.includes('qa1-'), false);
    return true;
  });
  assert.equal(mock.state.posts, 1);
});
