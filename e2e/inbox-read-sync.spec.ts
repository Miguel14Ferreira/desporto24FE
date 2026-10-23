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
const unauthorized: string[] = [];

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
      return response(route, 200, [{
        username: other, nickname: other === 'bea' ? 'Bea' : 'Ana',
        fullName: null, profilePicUrl: null, chatBlocked: false, blockedByMe: false
      }]);
    }
    if (method === 'GET' && url.pathname === '/api/communities/mine') return response(route, 200, []);
    if (method === 'GET' && url.pathname === '/api/sessions/mine') {
      return response(route, 200, { created: [], joined: [], waitlisted: [] });
    }
    if (method === 'POST' && url.pathname === '/api/messages/inbox/summaries') {
      const body = req.postDataJSON() as { conversations: Conversation[] };
      const result = body.conversations.filter(c => c.kind === 'direct')
        .filter(c => c.id.toLowerCase() === (username === 'ana' ? 'bea' : 'ana'))
        .map(c => {
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
      readThrough.set(username, Math.max(readThrough.get(username) || 0, allowedId));
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
      if (peer !== (username === 'ana' ? 'bea' : 'ana')) {
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
      if (peer !== (username === 'ana' ? 'bea' : 'ana')) {
        unauthorized.push(username + ':peer:' + peer);
        return response(route, 403, {});
      }
      if (method === 'GET' && chat[2] === '/info') {
        return response(route, 200, { chatBlocked: false, whoBlocked: null });
      }
      if (method === 'GET' && chat[2] === '/page') {
        return response(route, 200, {
          content: [...messages].reverse(), last: true
        });
      }
      if (method === 'POST' && !chat[2]) {
        const body = req.postDataJSON() as { text: string };
        const sent = {
          id: messages[messages.length - 1].id + 1, username1: username,
          username2: peer, text: body.text, date: utc(), dataDisplay: null
        };
        messages.push(sent);
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
    await expect(outgoing.locator('.inbox-read-check')).not.toHaveClass(/is-read/);
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

    // After returning to the sender, its foreground-only receipt GET refreshes
    // the blue check without a reload or a guessed delivery event.
    await sender.bringToFront();
    await sender.clock.fastForward(16_000);
    await expect(outgoing.locator('.inbox-read-check')).toHaveText('✓✓');
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
  requests.length = 0;
  unauthorized.length = 0;

  const senderContext = await authenticatedContext(browser, 'ana');
  const recipientContext = await authenticatedContext(browser, 'bea');
  try {
    const recipient = await recipientContext.newPage();
    await recipient.goto('/menu/messages?kind=direct&id=ana', {waitUntil:'domcontentloaded'});
    await expect(recipient.locator('.inbox-bubble[data-message-id="41"]')).toBeVisible();
    // A different tab takes the foreground in the recipient's browser.
    const otherTab = await recipientContext.newPage();
    await otherTab.goto('about:blank');
    await otherTab.bringToFront();
    await expect.poll(() => recipient.evaluate(() =>
      document.visibilityState === 'hidden' || !document.hasFocus())).toBe(true);

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

    // The first actual activation marks the now-visible history read.
    await recipient.bringToFront();
    await expect.poll(() => recipient.evaluate(() => document.hasFocus())).toBe(true);
    await expect.poll(() => readThrough.get('bea')).toBe(42);
    expect(unauthorized).toEqual([]);
  } finally {
    await senderContext.close();
    await recipientContext.close();
  }
});
