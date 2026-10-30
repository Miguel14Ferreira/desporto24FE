/**
 * Dual-browser inbox smoke with a deterministic in-memory API.
 *
 * NO production requests, NO production credentials, NO Render writes.
 * Checks the actual Angular UI, HTTP contracts, and persisted read behavior
 * across two browser contexts, including the legacy URL redirect to inbox.
 * This is NOT a substitute for staging E2E.
 */
import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

type Message = {
  id: number; username1: string; username2: string;
  text: string; date: string; dataDisplay: null;
};
type Conversation = { kind: 'direct' | 'community' | 'session'; id: string };

const base = 'http://127.0.0.1:4200';
// In CI, reuse the Chrome already installed for the 1000 Angular tests.
if (process.env['JYNLO_USE_SYSTEM_CHROME']) test.use({ channel: 'chrome' });
const utc = () => new Date().toISOString();
const messages: Message[] = [{
  id: 41, username1: 'bea', username2: 'ana', text: 'Primeira mensagem para testar',
  date: utc(), dataDisplay: null
}];
const readThrough = new Map<string, number>([['bea', 41]]);
const requests: string[] = [];
const capturedSends: Array<{username:string;peer:string;text:string;replyToMessageId?:number}> = [];
const unauthorized: string[] = [];
const authenticatedSockets = new Map<string, Set<(value: unknown) => void>>();
const socketRoutes = new Map<string, Array<{ close: (options?: {code?: number; reason?: string}) => void }>>();
let offlineAddedFriend = false;
let holdAnaPost = false;
let timeoutAnaAfterCommit = false;
let suppressOwnCommittedSocket = false;
let failAnaHistoryWhileOffline = false;
let holdReplyAfterCommit = false;
let releaseCommittedReply: (() => void) | null = null;
let releaseAnaPost: (() => void) | null = null;

function jwt(username: string) {
  const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url');
  return [encode({ alg: 'none', typ: 'JWT' }), encode({
    sub: username, Authorities: ['ROLE_USER'], exp: Math.floor(Date.now() / 1000) + 3600
  }), 'local-fixture'].join('.');
}
function response(route: Route, status: number, json: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers': '*'
    },
    body: JSON.stringify(json)
  });
}

async function authenticatedContext(browser: import('@playwright/test').Browser, username: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'pt-PT'
  });
  await context.addInitScript(token => localStorage.setItem('t', token), jwt(username));
  // Intercept the local development WebSocket too. Never open a live socket.
  await context.routeWebSocket('**/ws/chat', socket => {
    socket.onMessage(payload => {
      try {
        if (JSON.parse(String(payload)).type === 'AUTH') {
          const sockets = authenticatedSockets.get(username) || new Set<(value: unknown) => void>();
          sockets.add(value => socket.send(JSON.stringify(value)));
          authenticatedSockets.set(username, sockets);
          const routes = socketRoutes.get(username) || [];
          routes.push(socket);
          socketRoutes.set(username, routes);
          socket.send(JSON.stringify({ type: 'AUTHENTICATED' }));
        }
      } catch { /* ignore malformed fixture data */ }
    });
  });

  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (url.origin === base) return route.continue();
    const isApi = url.origin === 'http://localhost:8080'
      || url.origin === 'https://api.d24sports.com';
    if (!isApi) return route.abort('blockedbyclient');
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers': '*'
    } });

    requests.push(username + ':' + method + ' ' + url.pathname);
    if (method === 'GET' && url.pathname === '/api/friends/me') {
      const other = username === 'ana' ? 'bea' : 'ana';
      const friends = [{
        username: other, nickname: other === 'bea' ? 'Bea' : 'Ana',
        fullName: null, profilePicUrl: null, chatBlocked: false, blockedByMe: false
      }];
      if (username === 'ana' && offlineAddedFriend) {
        friends.push({username:'carla',nickname:'Carla',fullName:null,
          profilePicUrl:null,chatBlocked:false,blockedByMe:false});
      }
      return response(route, 200, friends);
    }
    if (method === 'GET' && url.pathname === '/api/communities/mine') return response(route, 200, []);
    if (method === 'GET' && url.pathname === '/api/sessions/mine') {
      return response(route, 200, { created: [], joined: [], waitlisted: [] });
    }
    if (method === 'POST' && url.pathname === '/api/messages/inbox/summaries') {
      const body = req.postDataJSON() as { conversations: Conversation[] };
      const result = body.conversations.filter(c => c.kind === 'direct')
        .filter(c => c.id.toLowerCase() === (username === 'ana' ? 'bea' : 'ana')
          || (username === 'ana' && offlineAddedFriend && c.id.toLowerCase() === 'carla'))
        .map(c => {
          if (c.id.toLowerCase() === 'carla') return {
            kind:'direct' as const,id:c.id,latestMessageId:51,
            latestText:'Convite recuperado',latestSender:'carla',
            latestAt:utc(),unreadCount:1
          };
          const latest = messages[messages.length - 1];
          return {
            kind: 'direct', id: c.id, latestMessageId: latest.id,
            latestText: latest.text, latestSender: latest.username1, latestAt: latest.date,
            unreadCount: messages.filter(m => m.username2 === username
              && m.id > (readThrough.get(username) || 0)).length
          };
        });
      return response(route, 200, result);
    }
    if (method === 'PUT' && url.pathname === '/api/messages/inbox/read') {
      const payload = req.postDataJSON() as { kind: string; id: string; lastSeenMessageId: number };
      const other = username === 'ana' ? 'bea' : 'ana';
      if (payload.kind !== 'direct' || payload.id.toLowerCase() !== other) {
        unauthorized.push(username + ':' + payload.kind + ':' + payload.id);
        return response(route, 403, { message: 'Not authorized' });
      }
      const allowedId = Math.min(payload.lastSeenMessageId, messages[messages.length - 1].id);
      const previous = readThrough.get(username) || 0;
      const persisted = Math.max(previous, allowedId);
      readThrough.set(username, persisted);
      if (persisted > previous) {
        // Mirrors BE AFTER_COMMIT event: only the sender, never an optimistic
        // delivery or an unauthenticated browser, receives the receipt.
        // Server-after-commit pushes to both participants' own authenticated
        // sockets. The sender receives blue ticks; the reader's other
        // devices refresh the unread count for exactly this conversation.
        for (const deliver of authenticatedSockets.get(other) || []) deliver({
          type: 'CHAT_READ_RECEIPT',
          receipt: {peerUsername: username, lastReadMessageId: persisted}
        });
        for (const deliver of authenticatedSockets.get(username) || []) deliver({
          type: 'INBOX_OWN_READ_UPDATED',
          read: {kind:'direct',conversationId:other,lastReadMessageId:persisted}
        });
      }
      const last = messages[messages.length - 1];
      return response(route, 200, {
        kind: 'direct', id: other, latestMessageId: last.id,
        latestText: last.text, latestSender: last.username1, latestAt: last.date,
        unreadCount: messages.filter(m => m.username2 === username
          && m.id > (readThrough.get(username) || 0)).length
      });
    }
    // Authenticated receipt: only the other participant's persisted cursor
    // can prove read status (not a connected WebSocket or elapsed time).
    const receipt = /^\/api\/messages\/inbox\/direct\/([^/]+)\/receipt$/.exec(url.pathname);
    if (method === 'GET' && receipt) {
      const peer = decodeURIComponent(receipt[1]).toLowerCase();
      if (peer !== (username === 'ana' ? 'bea' : 'ana')
          && !(username === 'ana' && offlineAddedFriend && peer === 'carla')) {
        unauthorized.push(username + ':receipt-peer:' + peer);
        return response(route, 403, {});
      }
      return response(route, 200, {
        peerUsername: peer, lastReadMessageId: readThrough.get(peer) || 0
      });
    }
    const chat = /^\/api\/chat\/me\/([^/]+)(\/page|\/info)?$/.exec(url.pathname);
    if (chat) {
      const peer = decodeURIComponent(chat[1]).toLowerCase();
      if (peer !== (username === 'ana' ? 'bea' : 'ana')
          && !(username === 'ana' && offlineAddedFriend && peer === 'carla')) {
        unauthorized.push(username + ':peer:' + peer);
        return response(route, 403, {});
      }
      if (method === 'GET' && chat[2] === '/info') {
        return response(route, 200, { chatBlocked: false, whoBlocked: null });
      }
      if (method === 'GET' && chat[2] === '/page') {
        if (username === 'ana' && peer === 'bea' && failAnaHistoryWhileOffline)
          return response(route, 503, {message:'offline history'});
        return response(route, 200, {
          content: peer === 'carla' ? [] : [...messages].reverse(), last: true
        });
      }
      if (method === 'POST' && !chat[2]) {
        if (username === 'ana' && peer === 'bea' && holdAnaPost) {
          await new Promise<void>(resolve => { releaseAnaPost = resolve; });
          releaseAnaPost = null;
        }
        const body = req.postDataJSON() as { text: string; replyToMessageId?:number };
        capturedSends.push({username,peer,text:body.text,replyToMessageId:body.replyToMessageId});
        const sent = {
          id: messages[messages.length - 1].id + 1, username1: username,
          username2: peer, text: body.text, date: utc(), dataDisplay: null
        };
        messages.push(sent);
        // Backend ChatMessageCreatedEvent is published AFTER_COMMIT to the
        // recipient and to all authenticated sender sessions. One server
        // message ID, no optimistic message and no second HTTP POST.
        for (const account of new Set([username, peer])) {
          if (account === username && suppressOwnCommittedSocket) continue;
          for (const deliver of authenticatedSockets.get(account) || []) {
            deliver({ type: 'CHAT_MESSAGE', message: sent });
          }
        }
        if (username === 'ana' && peer === 'bea' && holdReplyAfterCommit) {
          // The server COMMITTED the POST, but the page is reloaded before
          // the HTTP response can arrive. Aborted responses are ignored.
          await new Promise<void>(resolve => { releaseCommittedReply = resolve; });
          releaseCommittedReply = null;
          try { return await response(route, 503, {message:'Request lost on reload'}); }
          catch { return; }
        }
        if (username === 'ana' && peer === 'bea' && timeoutAnaAfterCommit) {
          // The database committed and socket event arrived, but HTTP broke.
          // Mimic that ordering without ever sending a second HTTP POST.
          await new Promise(resolve => setTimeout(resolve, 70));
          return response(route, 503, {message:'Lost response after commit'});
        }
        return response(route, 200, sent);
      }
    }
    // Shared app shell endpoints do not change the mocked conversation.
    if (method === 'GET' && url.pathname === '/api/notifications/me/unread-count') return response(route, 200, 0);
    if (method === 'GET' && url.pathname === '/api/auth/google/config') return response(route, 200, { clientId: '' });
    if (method === 'POST' && url.pathname === '/api/presence/heartbeat') return response(route, 200, {});
    if (method === 'POST' && url.pathname === '/api/pilot/events/access') return response(route, 200, {});
    if (method === 'POST' && url.pathname === '/api/auth/refresh') return response(route, 401, {});
    return response(route, 404, { message: 'Unmocked API contract' });
  });
  return context;
}

test('two isolated browsers share server read state across inbox and original direct chat', async ({ browser }) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  requests.length = 0;
  unauthorized.length = 0;

  const ana = await authenticatedContext(browser, 'ana');
  const bea = await authenticatedContext(browser, 'bea');
  const a = await ana.newPage();
  const b = await bea.newPage();
  const errors: string[] = [];
  a.on('pageerror', error => errors.push('ana: ' + error.message));
  b.on('pageerror', error => errors.push('bea: ' + error.message));

  try {
    await a.goto('/menu/messages', { waitUntil: 'domcontentloaded' });
    const anaChat = a.locator('.inbox-entry').filter({ hasText: 'Bea' });
    await expect(anaChat).toBeVisible();
    await expect(anaChat.locator('.inbox-entry-snippet')).toHaveText('Primeira mensagem para testar');
    await expect(anaChat.locator('.inbox-unread')).toHaveText('1');

    // Reading in the center persists on a different page load in the same account.
    await anaChat.click();
    await expect(a.locator('.inbox-bubble')).toContainText(['Primeira mensagem para testar']);
    await expect.poll(() => readThrough.get('ana')).toBe(41);
    await expect(anaChat.locator('.inbox-unread')).toHaveCount(0);
    await a.reload({ waitUntil: 'domcontentloaded' });
    await expect(a.locator('.inbox-entry').filter({ hasText: 'Bea' }).locator('.inbox-unread')).toHaveCount(0);

    // A second independent account sends via the inline composer.
    await b.goto('/menu/messages', { waitUntil: 'domcontentloaded' });
    const beaChat = b.locator('.inbox-entry').filter({ hasText: 'Ana' });
    await expect(beaChat).toBeVisible();
    await beaChat.click();
    await b.locator('#inbox-reply').fill('Nova mensagem da Bea');
    await b.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(() => messages.length).toBe(2);

    // The same account, in another browser page, retrieves the new unread value.
    await a.reload({ waitUntil: 'domcontentloaded' });
    const newlyUnread = a.locator('.inbox-entry').filter({ hasText: 'Bea' });
    await expect(newlyUnread.locator('.inbox-entry-snippet')).toHaveText('Nova mensagem da Bea');
    await expect(newlyUnread.locator('.inbox-unread')).toHaveText('1');

    // A saved link to the old chat must redirect to the SAME unified inbox.
    await a.goto('/menu/friendList/chat/bea', { waitUntil: 'domcontentloaded' });
    await expect(a).toHaveURL(/\/menu\/messages\?kind=direct&id=bea/);
    await expect(a.locator('.inbox-entry.is-selected')).toContainText('Bea');
    await expect(a.locator('.inbox-bubble')).toHaveCount(2);
    await expect.poll(() => readThrough.get('ana')).toBe(42);

    await a.goto('/menu/messages', { waitUntil: 'domcontentloaded' });
    await expect(a.locator('.inbox-entry').filter({ hasText: 'Bea' }).locator('.inbox-unread')).toHaveCount(0);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
    expect(requests).toContain('ana:PUT /api/messages/inbox/read');
    expect(requests).toContain('bea:POST /api/chat/me/ana');
  } finally {
    await ana.close();
    await bea.close();
  }
});

test('blue checks follow recipient read cursor, not delivery or another account', async ({ browser }) => {
  test.slow(); // Browser timers run virtually; extra room for a cold Angular dev server.
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  requests.length = 0;
  unauthorized.length = 0;

  const ana = await authenticatedContext(browser, 'ana');
  const bea = await authenticatedContext(browser, 'bea');
  const sender = await ana.newPage();
  const pageErrors: string[] = [];
  sender.on('pageerror', error => pageErrors.push('sender: ' + error.message));
  try {
    // Install a controllable page clock before navigating: no 45s waiting
    // for the existing lightweight 45s receipt poll.
    await sender.clock.install();
    await sender.goto('/menu/messages?kind=direct&id=bea', {
      waitUntil: 'domcontentloaded'
    });
    await expect(sender.locator('.inbox-entry.is-selected')).toContainText('Bea');
    await expect(sender.locator('#inbox-reply')).toBeEnabled();

    // The recipient browser must NOT open its conversation until after send.
    await sender.locator('#inbox-reply').fill('Confirmação de leitura QA simulada');
    const postsBefore = requests.filter(x => x === 'ana:POST /api/chat/me/bea').length;
    await sender.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(() => messages.length).toBe(2);
    expect(requests.filter(x => x === 'ana:POST /api/chat/me/bea')).toHaveLength(postsBefore + 1);
    const outgoing = sender.locator('.inbox-bubble[data-message-id="42"]');
    await expect(outgoing).toBeVisible();
    await expect(outgoing.locator('.inbox-read-check')).toHaveText('✓');
    await expect(outgoing.locator('.inbox-read-check')).toHaveAttribute('aria-label', 'Guardada no servidor');
    await expect(outgoing.locator('.inbox-read-check')).not.toHaveClass(/is-read/);
    // Successful sends must rely on the persisted ✓/✓✓ in the bubble.
    // The former green "Guardada no servidor" composer banner was removed.
    await expect(sender.locator('.inbox-delivery-status')).toHaveCount(0);
    expect(readThrough.get('bea')).toBe(41); // Server still says 'unread'.

    const recipient = await bea.newPage();
    recipient.on('pageerror', error => pageErrors.push('recipient: ' + error.message));
    await recipient.goto('/menu/messages?kind=direct&id=ana', {
      waitUntil: 'domcontentloaded'
    });
    await expect(recipient.locator('.inbox-bubble[data-message-id="42"]')).toBeVisible();
    await expect.poll(() => readThrough.get('bea')).toBe(42);
    await expect(recipient.locator('.inbox-bubble[data-message-id="42"] .inbox-read-check'))
      .toHaveCount(0);

    // The committed WebSocket event changes the marker immediately, even
    // while the page clock is frozen; no polling or browser refresh is needed.
    await expect(outgoing.locator('.inbox-read-check')).toHaveText('✓✓');
    await expect(outgoing.locator('.inbox-read-check')).toHaveAttribute('aria-label', 'Lida pelo destinatário');
    await expect(outgoing.locator('.inbox-read-check')).toHaveClass(/is-read/);

    // Simulate another same-origin tab replacing the sender's login.
    // Blue checks from the old authenticated session must disappear.
    await sender.evaluate(() => localStorage.setItem('t', 'other-account-fixture'));
    await sender.clock.fastForward(16_000);
    await expect(outgoing.locator('.inbox-read-check')).toHaveText('✓');
    await expect(outgoing.locator('.inbox-read-check')).not.toHaveClass(/is-read/);
    expect(unauthorized).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(requests.filter(x => x === 'ana:POST /api/chat/me/bea')).toHaveLength(postsBefore + 1);
  } finally {
    await ana.close();
    await bea.close();
  }
});

test('a background recipient tab cannot mark messages read until it becomes active', async ({ browser }) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  requests.length = 0;
  unauthorized.length = 0;

  const senderContext = await authenticatedContext(browser, 'ana');
  const recipientContext = await authenticatedContext(browser, 'bea');
  try {
    const recipient = await recipientContext.newPage();
    await recipient.goto('/menu/messages?kind=direct&id=ana', {waitUntil:'domcontentloaded'});
    await expect(recipient.locator('.inbox-bubble[data-message-id="41"]')).toBeVisible();
    // Chromium headless may report every tab as focused, even after
    // bringToFront on another page. Force the real document's visibility/focus
    // contract during reload so the Angular lifecycle is deterministic.
    await recipient.addInitScript(() => {
      let qaVisible = false;
      Object.defineProperty(document, 'visibilityState', {
        configurable: true, get: () => qaVisible ? 'visible' : 'hidden'
      });
      Object.defineProperty(document, 'hasFocus', {
        configurable: true, value: () => qaVisible
      });
      (window as any).__qaActivatePage = () => {
        qaVisible = true;
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      };
    });
    await recipient.reload({waitUntil:'domcontentloaded'});
    expect(await recipient.evaluate(() => document.visibilityState)).toBe('hidden');

    const sender = await senderContext.newPage();
    await sender.goto('/menu/messages?kind=direct&id=bea', {waitUntil:'domcontentloaded'});
    await expect(sender.locator('#inbox-reply')).toBeEnabled();
    await sender.locator('#inbox-reply').fill('Mensagem para uma aba em segundo plano');
    await sender.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(() => messages.length).toBe(2);

    // Load the unread message in an inactive tab. A background DOM render is
    // not evidence that the account holder actually read the message.
    await recipient.reload({waitUntil:'domcontentloaded'});
    await expect(recipient.locator('.inbox-bubble[data-message-id="42"]')).toBeVisible();
    expect(await recipient.evaluate(() => document.hasFocus())).toBe(false);
    expect(readThrough.get('bea')).toBe(41);
    await expect(sender.locator('.inbox-bubble[data-message-id="42"] .inbox-read-check'))
      .toHaveText('✓');

    // First foreground activation marks the now-visible history read.
    await recipient.evaluate(() => (window as any).__qaActivatePage());
    await expect.poll(() => recipient.evaluate(() => document.hasFocus())).toBe(true);
    await expect.poll(() => readThrough.get('bea')).toBe(42);
    expect(unauthorized).toEqual([]);
  } finally {
    await senderContext.close();
    await recipientContext.close();
  }
});

test('two devices of the same account update an unread badge after a committed read', async ({ browser }) => {
  // This is a synthetic dual-browser contract. Both contexts use the SAME
  // account, unlike the existing two-participant sender/recipient tests.
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  requests.length = 0;
  unauthorized.length = 0;

  const passiveContext = await authenticatedContext(browser, 'ana');
  const readerContext = await authenticatedContext(browser, 'ana');
  const passive = await passiveContext.newPage();
  try {
    // Browser B is already online with an unread message and no open chat.
    await passive.goto('/menu/messages', { waitUntil: 'domcontentloaded' });
    const conversation = passive.locator('.inbox-entry').filter({hasText:'Bea'});
    await expect(conversation.locator('.inbox-unread')).toHaveText('1');
    await expect.poll(() => authenticatedSockets.get('ana')?.size).toBe(1);
    const summariesBefore = requests.filter(x =>
      x === 'ana:POST /api/messages/inbox/summaries').length;

    // Browser A reads the conversation; server commits the cursor and pushes
    // an own-read notification to ALL currently authenticated 'ana' sockets.
    const reader = await readerContext.newPage();
    await reader.goto('/menu/messages?kind=direct&id=bea',
      {waitUntil:'domcontentloaded'});
    await expect(reader.locator('.inbox-entry.is-selected')).toContainText('Bea');
    await expect(reader.locator('.inbox-bubble[data-message-id="41"]')).toBeVisible();
    await expect.poll(() => readThrough.get('ana')).toBe(41);

    // No reload or 45-second timer advancement on passive browser.
    await expect(conversation.locator('.inbox-unread')).toHaveCount(0);
    expect(requests.filter(x =>
      x === 'ana:POST /api/messages/inbox/summaries').length).toBeGreaterThan(summariesBefore);
    expect(unauthorized).toEqual([]);
  } finally {
    await passiveContext.close();
    await readerContext.close();
  }
});

test('sent direct message mirrors to another signed-in device without duplicates', async ({ browser }) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  requests.length = 0;
  unauthorized.length = 0;

  const senderContext = await authenticatedContext(browser, 'ana');
  const mirrorContext = await authenticatedContext(browser, 'ana');
  const recipientContext = await authenticatedContext(browser, 'bea');
  try {
    const sender = await senderContext.newPage();
    const mirror = await mirrorContext.newPage();
    const recipient = await recipientContext.newPage();
    const pageErrors: string[] = [];
    for (const p of [sender, mirror, recipient]) {
      p.on('pageerror', e => pageErrors.push(e.message));
    }
    await sender.goto('/menu/messages?kind=direct&id=bea', {waitUntil:'domcontentloaded'});
    await mirror.goto('/menu/messages?kind=direct&id=bea', {waitUntil:'domcontentloaded'});
    await recipient.goto('/menu/messages?kind=direct&id=ana', {waitUntil:'domcontentloaded'});
    await expect(sender.locator('#inbox-reply')).toBeEnabled();
    await expect(mirror.locator('.inbox-entry.is-selected')).toContainText('Bea');
    await expect(recipient.locator('.inbox-entry.is-selected')).toContainText('Ana');
    await expect.poll(() => authenticatedSockets.get('ana')?.size).toBe(2);
    await expect.poll(() => authenticatedSockets.get('bea')?.size).toBe(1);

    const countPosts = () => requests.filter(v => v === 'ana:POST /api/chat/me/bea').length;
    const postsBefore = countPosts();
    await sender.locator('#inbox-reply').fill('Sincronizada nos dois dispositivos');
    await sender.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(() => messages.length).toBe(2);
    await expect.poll(countPosts).toBe(postsBefore + 1);
    const sentId = '.inbox-bubble[data-message-id="42"]';
    // Both signed-in sender windows and the recipient should see the exact
    // same committed ID without a reload or 45-second HTTP history poll.
    for (const page of [sender, mirror, recipient]) {
      await expect(page.locator(sentId)).toHaveCount(1);
      await expect(page.locator(sentId)).toContainText('Sincronizada nos dois dispositivos');
    }
    expect(countPosts()).toBe(postsBefore + 1);
    expect(unauthorized).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await senderContext.close();
    await mirrorContext.close();
    await recipientContext.close();
  }
});

test('WebSocket outage recovers missed history and newly available friends without a reload', async ({browser}) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  socketRoutes.clear();
  offlineAddedFriend = false;
  requests.length = 0;
  unauthorized.length = 0;

  const context = await authenticatedContext(browser, 'ana');
  try {
    const page = await context.newPage();
    const errors:string[]=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/menu/messages?kind=direct&id=bea', {waitUntil:'domcontentloaded'});
    await expect(page.locator('.inbox-bubble[data-message-id="41"]')).toBeVisible();
    await expect.poll(() => socketRoutes.get('ana')?.length).toBe(1);
    const firstRequests = requests.filter(x=>x==='ana:GET /api/friends/me').length;
    await page.clock.install();

    // An unplanned outage: neither this new message nor this friendship is
    // pushed to the browser while the socket is offline.
    socketRoutes.get('ana')![0].close({code:1012,reason:'test network outage'});
    messages.push({id:42,username1:'bea',username2:'ana',
      text:'Mensagem perdida durante a falha',date:utc(),dataDisplay:null});
    offlineAddedFriend = true;
    await page.clock.fastForward(3_100); // first bounded reconnect retry
    await expect.poll(() => socketRoutes.get('ana')?.length).toBe(2);
    await expect.poll(() => requests.filter(x=>
      x==='ana:GET /api/friends/me').length).toBeGreaterThan(firstRequests);

    const carla=page.locator('.inbox-entry').filter({hasText:'Carla'});
    await expect(carla).toBeVisible();
    await expect(carla.locator('.inbox-unread')).toHaveText('1');
    await expect(page.locator('.inbox-bubble[data-message-id="42"]')).toHaveCount(1);
    await expect(page.locator('.inbox-bubble[data-message-id="42"]'))
      .toContainText('Mensagem perdida durante a falha');

    // Even a late replay of the same confirmed socket message cannot
    // manufacture a second bubble or a second HTTP send.
    const newestSocket=[...(authenticatedSockets.get('ana') || [])].at(-1)!;
    newestSocket({type:'CHAT_MESSAGE',message:messages[1]});
    await expect(page.locator('.inbox-bubble[data-message-id="42"]')).toHaveCount(1);
    expect(requests.filter(x=>x==='ana:POST /api/chat/me/bea')).toHaveLength(0);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    offlineAddedFriend = false;
    await context.close();
  }
});

test('switching chats during a pending send preserves another draft and avoids a second POST', async ({browser}) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea', 41);
  authenticatedSockets.clear();
  requests.length = 0;
  unauthorized.length = 0;
  offlineAddedFriend = true;
  holdAnaPost = true;
  releaseAnaPost = null;
  const context = await authenticatedContext(browser, 'ana');
  try {
    const page = await context.newPage();
    const errors:string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/menu/messages?kind=direct&id=bea', {waitUntil:'domcontentloaded'});
    await expect(page.locator('.inbox-entry').filter({hasText:'Carla'})).toBeVisible();
    await expect(page.locator('#inbox-reply')).toBeEnabled();
    await page.locator('#inbox-reply').fill('Mensagem enviada uma vez');
    await page.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(() => releaseAnaPost !== null).toBe(true);
    await expect(page.locator('.inbox-delivery-status--sending')).toContainText('A enviar');

    // The HTTP response is held while the user opens a different conversation.
    await page.locator('.inbox-entry').filter({hasText:'Carla'}).click();
    await expect(page.locator('.inbox-entry.is-selected')).toContainText('Carla');
    await page.locator('#inbox-reply').fill('Rascunho independente');
    releaseAnaPost?.();
    await expect.poll(() => messages.length).toBe(2);
    await expect(page.locator('#inbox-reply')).toHaveValue('Rascunho independente');
    await expect(page.locator('.inbox-entry').filter({hasText:'Bea'})
      .locator('.inbox-entry-snippet')).toHaveText('Mensagem enviada uma vez');

    await page.locator('.inbox-entry').filter({hasText:'Bea'}).click();
    await expect(page.locator('#inbox-reply')).toHaveValue('');
    await expect(page.locator('.inbox-bubble[data-message-id="42"]')).toHaveCount(1);
    expect(requests.filter(v => v === 'ana:POST /api/chat/me/bea')).toHaveLength(1);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    releaseAnaPost?.();
    holdAnaPost = false;
    releaseAnaPost = null;
    offlineAddedFriend = false;
    await context.close();
  }
});

test('off-screen WebSocket confirmation clears uncertain send after lost HTTP response', async ({browser}) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea',41);
  authenticatedSockets.clear();
  requests.length=0;
  unauthorized.length=0;
  offlineAddedFriend=true;
  holdAnaPost=true;
  timeoutAnaAfterCommit=true;
  releaseAnaPost=null;
  const context=await authenticatedContext(browser,'ana');
  try {
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/menu/messages?kind=direct&id=bea',{waitUntil:'domcontentloaded'});
    await expect(page.locator('.inbox-entry').filter({hasText:'Carla'})).toBeVisible();
    await expect(page.locator('#inbox-reply')).toBeEnabled();
    await page.locator('#inbox-reply').fill('Confirmada antes do erro');
    await page.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(()=>releaseAnaPost!==null).toBe(true);
    await page.locator('.inbox-entry').filter({hasText:'Carla'}).click();
    await page.locator('#inbox-reply').fill('Rascunho de Carla');
    releaseAnaPost?.();
    await expect.poll(()=>messages.length).toBe(2);
    await expect(page.locator('#inbox-reply')).toHaveValue('Rascunho de Carla');
    await expect(page.locator('.inbox-entry').filter({hasText:'Bea'})
      .locator('.inbox-entry-snippet')).toHaveText('Confirmada antes do erro');

    await page.locator('.inbox-entry').filter({hasText:'Bea'}).click();
    await expect(page.locator('.inbox-bubble[data-message-id="42"]')).toHaveCount(1);
    await expect(page.locator('#inbox-reply')).toHaveValue('');
    await expect(page.locator('.inbox-composer')).not.toContainText('Confirmar entrega');
    expect(requests.filter(v=>v==='ana:POST /api/chat/me/bea')).toHaveLength(1);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    releaseAnaPost?.();
    holdAnaPost=false;
    timeoutAnaAfterCommit=false;
    releaseAnaPost=null;
    offlineAddedFriend=false;
    await context.close();
  }
});

test('socket reconnection reconciles an uncertain off-screen send via read-only history', async ({browser}) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea',41);
  authenticatedSockets.clear();
  socketRoutes.clear();
  requests.length=0;
  unauthorized.length=0;
  offlineAddedFriend=true;
  timeoutAnaAfterCommit=true;
  suppressOwnCommittedSocket=true;
  failAnaHistoryWhileOffline=false;
  const context=await authenticatedContext(browser,'ana');
  try {
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('/menu/messages?kind=direct&id=bea',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#inbox-reply')).toBeEnabled();
    await expect(page.locator('.inbox-entry').filter({hasText:'Carla'})).toBeVisible();
    await expect.poll(()=>socketRoutes.get('ana')?.length).toBe(1);
    await page.clock.install();
    socketRoutes.get('ana')![0].close({code:1012,reason:'simulated offline socket'});
    failAnaHistoryWhileOffline=true;

    await page.locator('#inbox-reply').fill('Foi guardada enquanto estava offline');
    await page.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(()=>messages.length).toBe(2);
    // The POST returned 503 after committing, and immediate verification
    // cannot reach GET /page. No socket event was delivered to this client.
    await expect(page.locator('.inbox-compose-alert-actions')).toBeVisible();
    await expect(page.locator('.inbox-delivery-status--pending')).toBeVisible();
    await expect(page.locator('.inbox-delivery-status--confirmed')).toHaveCount(0);
    await page.locator('.inbox-entry').filter({hasText:'Carla'}).click();
    await page.locator('#inbox-reply').fill('O rascunho continua aqui');
    const checksBefore=requests.filter(r=>r==='ana:GET /api/chat/me/bea/page').length;

    // The network recovers. AUTH after a real reconnect must recheck the
    // original thread even though another conversation is currently open.
    failAnaHistoryWhileOffline=false;
    await page.clock.fastForward(3_100);
    await expect.poll(()=>socketRoutes.get('ana')?.length).toBe(2);
    await expect.poll(()=>requests.filter(r=>
      r==='ana:GET /api/chat/me/bea/page').length).toBeGreaterThan(checksBefore);
    await expect(page.locator('#inbox-reply')).toHaveValue('O rascunho continua aqui');
    await page.locator('.inbox-entry').filter({hasText:'Bea'}).click();
    await expect(page.locator('.inbox-compose-alert-actions')).toHaveCount(0);
    await expect(page.locator('#inbox-reply')).toHaveValue('');
    await expect(page.locator('.inbox-bubble[data-message-id="42"]')).toHaveCount(1);
    expect(requests.filter(r=>r==='ana:POST /api/chat/me/bea')).toHaveLength(1);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    failAnaHistoryWhileOffline=false;
    suppressOwnCommittedSocket=false;
    timeoutAnaAfterCommit=false;
    offlineAddedFriend=false;
    await context.close();
  }
});

test('reloading mid-send recovers the committed message without a second POST', async ({browser}) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea',41);
  authenticatedSockets.clear();
  requests.length=0;
  unauthorized.length=0;
  holdReplyAfterCommit=true;
  suppressOwnCommittedSocket=true;
  releaseCommittedReply=null;
  const context=await authenticatedContext(browser,'ana');
  try {
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/menu/messages?kind=direct&id=bea',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#inbox-reply')).toBeEnabled();
    await page.locator('#inbox-reply').fill('Recuperar após atualizar o browser');
    await page.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(()=>messages.length).toBe(2);
    await expect.poll(()=>releaseCommittedReply!==null).toBe(true);

    const beforeReload=await page.evaluate(()=>
      sessionStorage.getItem('jynlo.chat.uncertain-posts.v1'));
    expect(beforeReload).toContain('Recuperar após atualizar o browser');
    expect(beforeReload).not.toContain('local-fixture');
    // A new Angular component in the SAME tab rehydrates the blocked send
    // and performs a read-only GET against the committed server history.
    await page.reload({waitUntil:'domcontentloaded'});
    releaseCommittedReply?.();
    await expect(page.locator('.inbox-bubble[data-message-id="42"]')).toHaveCount(1);
    await expect(page.locator('#inbox-reply')).toHaveValue('');
    await expect(page.locator('.inbox-compose-alert-actions')).toHaveCount(0);
    await expect.poll(async()=>page.evaluate(()=>
      sessionStorage.getItem('jynlo.chat.uncertain-posts.v1'))).toBeNull();
    expect(requests.filter(r=>r==='ana:POST /api/chat/me/bea')).toHaveLength(1);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    releaseCommittedReply?.();
    holdReplyAfterCommit=false;
    releaseCommittedReply=null;
    suppressOwnCommittedSocket=false;
    await context.close();
  }
});

test('reply quote remains bound to its original conversation after switching chats', async ({browser}) => {
  messages.splice(1);
  readThrough.clear();
  readThrough.set('bea',41);
  authenticatedSockets.clear();
  requests.length=0;
  capturedSends.length=0;
  unauthorized.length=0;
  offlineAddedFriend=true;
  const context=await authenticatedContext(browser,'ana');
  try {
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/menu/messages?kind=direct&id=bea',{waitUntil:'domcontentloaded'});
    const old=page.locator('.inbox-bubble[data-message-id="41"]');
    await expect(old).toBeVisible();
    await old.locator('.inbox-reply-action').click();
    await expect(page.locator('.inbox-reply-banner')).toContainText('Primeira mensagem para testar');
    await page.locator('#inbox-reply').fill('Combinado, Bea');

    // Another friend has a separate draft; no quote from Bea may leak there.
    await page.locator('.inbox-entry').filter({hasText:'Carla'}).click();
    await expect(page.locator('.inbox-reply-banner')).toHaveCount(0);
    await page.locator('#inbox-reply').fill('Escrever à Carla');
    await page.locator('.inbox-entry').filter({hasText:'Bea'}).click();
    await expect(page.locator('#inbox-reply')).toHaveValue('Combinado, Bea');
    await expect(page.locator('.inbox-reply-banner')).toContainText('Primeira mensagem para testar');
    await page.locator('.inbox-composer button[type="submit"]').click();
    await expect.poll(()=>capturedSends.length).toBe(1);
    expect(capturedSends[0]).toMatchObject({
      username:'ana',peer:'bea',text:'Combinado, Bea',replyToMessageId:41
    });
    await expect(page.locator('#inbox-reply')).toHaveValue('');
    await expect(page.locator('.inbox-reply-banner')).toHaveCount(0);
    await page.locator('.inbox-entry').filter({hasText:'Carla'}).click();
    await expect(page.locator('#inbox-reply')).toHaveValue('Escrever à Carla');
    await expect(page.locator('.inbox-reply-banner')).toHaveCount(0);
    expect(requests.filter(r=>r==='ana:POST /api/chat/me/bea')).toHaveLength(1);
    expect(unauthorized).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    offlineAddedFriend=false;
    await context.close();
  }
});
