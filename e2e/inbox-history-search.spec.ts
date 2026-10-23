/**
 * Browser contract for the deployed inbox's historical-search UX.
 * Two separate authenticated browser contexts; all HTTP/WebSocket calls are
 * synthetic and intercepted. No production credentials, requests, or writes.
 */
import { test, expect, type Browser, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

if (process.env['JYNLO_USE_SYSTEM_CHROME']) test.use({ channel: 'chrome' });
const APP = 'http://127.0.0.1:4200';
const ISO = '2026-10-10T14:00:00Z';
// Future/past session eligibility is relative to execution, not a brittle calendar date.
const KICKOFF = new Date(Date.now() + 6 * 60_000).toISOString();
const FINISHED = new Date(Date.now() - 60_000).toISOString();
const audited: string[] = [];
const searched: string[] = [];
const contextRequests: string[] = [];
const reads: string[] = [];

type Kind = 'direct' | 'community' | 'session';
type Ref = { kind: Kind; id: string };

function token(user: string): string {
  const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString('base64url');
  return [encode({ alg: 'none' }), encode({
    sub: user, Authorities: ['ROLE_USER'], exp: Math.floor(Date.now() / 1000) + 3600
  }), 'browser-fixture'].join('.');
}

function reply(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status, contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers': '*'
    }, body: JSON.stringify(payload)
  });
}

function model(kind: Kind, id: number, author: string, text: string) {
  if (kind === 'direct') return {
    id, username1: author, username2: author === 'ana' ? 'bea' : 'ana',
    text, date: ISO, dataDisplay: null
  };
  if (kind === 'community') return {
    id, communityId: 7, kind: 'CHAT', username: author,
    body: text, createdAt: ISO
  };
  return { id, sessionId: 41, senderUsername: author, body: text, createdAt: ISO };
}
function hit(id: number, text: string) {
  return { id, sender: 'bea', text, createdAt: ISO };
}
const newer = (kind: Kind) => [
  model(kind, 90, 'ana', 'Mensagem recente 90'),
  model(kind, 91, 'bea', 'Mensagem recente 91')
];

async function context(browser: Browser, user: 'ana' | 'bea') {
  const ctx = await browser.newContext({ locale: 'pt-PT', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(t => localStorage.setItem('t', t), token(user));
  await ctx.routeWebSocket('**/ws/chat', socket => {
    socket.onMessage(raw => {
      try {
        if (JSON.parse(String(raw)).type === 'AUTH')
          socket.send(JSON.stringify({ type: 'AUTHENTICATED' }));
      } catch { /* Ignore unexpected synthetic socket data. */ }
    });
  });
  await ctx.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url()), method = req.method(), path = url.pathname;
    if (url.origin === APP) return route.continue();
    if (url.origin !== 'http://localhost:8080' && url.origin !== 'https://api.d24sports.com') {
      return route.abort('blockedbyclient');
    }
    if (method === 'OPTIONS') return reply(route, 200, {});
    audited.push(user + ':' + method + ' ' + path);

    if (method === 'GET' && path === '/api/friends/me')
      return reply(route, 200, [{
        username: user === 'ana' ? 'bea' : 'ana', nickname: user === 'ana' ? 'Bea' : 'Ana',
        fullName: null, profilePicUrl: null, chatBlocked: false, blockedByMe: false
      }]);
    if (method === 'GET' && path === '/api/communities/mine')
      return reply(route, 200, user === 'ana' ? [{ id: 7, name: 'CNG QA', sport: 'Futsal' }] : []);
    if (method === 'GET' && path === '/api/sessions/mine')
      return reply(route, 200, user === 'ana'
        ? { created: [
          { id: 41, sport: 'Ténis', city: 'Cacém', gameDate: KICKOFF, status: 'OPEN' },
          { id: 42, sport: 'Futebol', city: 'Cacém', gameDate: FINISHED, status: 'COMPLETED' }
        ], joined: [], waitlisted: [] }
        : { created: [], joined: [], waitlisted: [] });
    if (method === 'GET' && path === '/api/sessions/41')
      return reply(route, user === 'ana' ? 200 : 403, {
        id: 41, sport: 'Ténis', gameDate: KICKOFF, joined: true,
        creatorUsername: 'ana', status: 'OPEN'
      });
    if (method === 'GET' && /^\/api\/chat\/me\/[^/]+\/info$/.test(path))
      return reply(route, 200, { chatBlocked: false, whoBlocked: null });
    if (method === 'GET' && /^\/api\/chat\/me\/[^/]+\/page$/.test(path))
      return reply(route, 200, { content: newer('direct').slice().reverse(), last: true });
    if (method === 'GET' && path === '/api/communities/7/messages')
      return reply(route, user === 'ana' ? 200 : 403, newer('community'));
    if (method === 'GET' && path === '/api/sessions/41/messages')
      return reply(route, user === 'ana' ? 200 : 403, newer('session'));
    if (method === 'POST' && path === '/api/messages/inbox/summaries')
      return reply(route, 200, []);
    if (method === 'PUT' && path === '/api/messages/inbox/read') {
      reads.push(user + ':' + JSON.stringify(req.postDataJSON()));
      const payload = req.postDataJSON() as Ref;
      return reply(route, 200, {
        ...payload, latestMessageId: 91, latestText: 'Mensagem recente 91',
        latestSender: 'bea', latestAt: ISO, unreadCount: 0
      });
    }
    if (method === 'GET' && path === '/api/messages/inbox/search') {
      const kind = url.searchParams.get('kind') as Kind;
      const id = url.searchParams.get('id') ?? '';
      const query = url.searchParams.get('q');
      searched.push(user + ':' + kind + ':' + id + ':' + query);
      const authorized = kind === 'direct'
        ? id.toLowerCase() === (user === 'ana' ? 'bea' : 'ana')
        : user === 'ana' && (kind === 'community' && id === '7'
          || kind === 'session' && id === '41');
      return authorized ? reply(route, 200, { page: 0, hasMore: false,
        results: [hit(5, 'Expressão antiga encontrada')] }) : reply(route, 403, {});
    }
    if (method === 'GET' && path === '/api/messages/inbox/context') {
      const kind = url.searchParams.get('kind') as Kind;
      const id = url.searchParams.get('id') ?? '';
      const messageId = url.searchParams.get('messageId') ?? '';
      contextRequests.push(user + ':' + kind + ':' + id + ':' + messageId);
      const authorized = messageId === '5' && (kind === 'direct'
        ? id.toLowerCase() === (user === 'ana' ? 'bea' : 'ana')
        : user === 'ana' && (kind === 'community' && id === '7'
          || kind === 'session' && id === '41'));
      return authorized ? reply(route, 200, [
        hit(4, 'Contexto anterior'), hit(5, 'Expressão antiga encontrada'),
        hit(6, 'Contexto seguinte')
      ]) : reply(route, 403, {});
    }
    // Shared shell endpoints are never allowed to contact production.
    if (method === 'GET' && path === '/api/notifications/me/unread-count') return reply(route, 200, 0);
    if (method === 'GET' && path === '/api/auth/google/config') return reply(route, 200, { clientId: '' });
    if (method === 'POST' && path === '/api/presence/heartbeat') return reply(route, 200, {});
    if (method === 'POST' && path === '/api/pilot/events/access') return reply(route, 200, {});
    if (method === 'POST' && path === '/api/auth/refresh') return reply(route, 401, {});
    return reply(route, 404, { message: 'Unmocked API request' });
  });
  return ctx;
}

test('two isolated browser identities, full-history search, and bounded context for every chat kind', async ({ browser }) => {
  audited.length = 0; searched.length = 0; contextRequests.length = 0; reads.length = 0;
  const ana = await context(browser, 'ana');
  const bea = await context(browser, 'bea');
  const first = await ana.newPage(), second = await bea.newPage();
  const errors: string[] = [];
  first.on('pageerror', e => errors.push('ana: ' + e.message));
  second.on('pageerror', e => errors.push('bea: ' + e.message));

  try {
    await first.goto('/menu/messages', { waitUntil: 'domcontentloaded' });
    await second.goto('/menu/messages', { waitUntil: 'domcontentloaded' });
    await expect(first.locator('.inbox-entry')).toHaveCount(3);
    await expect(second.locator('.inbox-entry')).toHaveCount(1);
    await expect(first.locator('.inbox-entry').filter({ hasText: 'CNG QA' })).toBeVisible();
    await expect(second.locator('.inbox-entry').filter({ hasText: 'CNG QA' })).toHaveCount(0);

    for (const [kind, label, id] of [
      ['direct', 'Bea', 'bea'],
      ['community', 'CNG QA', '7'],
      ['session', 'Ténis', '41']
    ] as const) {
      await first.locator('.inbox-entry').filter({ hasText: label }).click();
      await expect(first.locator('.inbox-bubble')).toHaveCount(2);
      await first.locator('.inbox-search-toggle').click();
      await first.locator('#inbox-message-query').fill('Expressão antiga');
      await first.locator('.inbox-history-search-form button[type="submit"]').click();
      const result = first.locator('.inbox-history-search-result');
      await expect(result).toHaveCount(1);
      await expect(result).toContainText('Expressão antiga encontrada');
      await expect(first.locator('.inbox-message-log .inbox-bubble')).toHaveCount(2);
      const readsBefore = reads.length;
      await result.locator('.inbox-search-result-open').click();
      await expect(first.locator('.inbox-history-context-banner')).toBeVisible();
      await expect(first.locator('.inbox-bubble')).toHaveCount(3);
      await expect(first.locator('.inbox-bubble[data-message-id="5"]')).toContainText('Expressão antiga');
      await expect(first.locator('.inbox-bubble[data-message-id="5"]')).toHaveClass(/inbox-bubble--search-match/);
      expect(reads.length).toBe(readsBefore);
      await first.locator('.inbox-history-context-banner button').click();
      await expect(first.locator('.inbox-history-context-banner')).toHaveCount(0);
      await expect(first.locator('.inbox-bubble')).toHaveCount(2);
      await expect(first.locator('.inbox-bubble[data-message-id="5"]')).toHaveCount(0);
      await first.locator('.inbox-search-toggle').click();
      expect(searched).toContain('ana:' + kind + ':' + id + ':Expressão antiga');
      expect(contextRequests).toContain('ana:' + kind + ':' + id + ':5');
    }

    await second.locator('.inbox-entry').filter({ hasText: 'Ana' }).click();
    await expect(second.locator('.inbox-bubble')).toHaveCount(2);
    await second.locator('.inbox-search-toggle').click();
    await second.locator('#inbox-message-query').fill('Expressão antiga');
    await second.locator('.inbox-history-search-form button[type="submit"]').click();
    await second.locator('.inbox-search-result-open').click();
    await expect(second.locator('.inbox-bubble[data-message-id="5"]')).toBeVisible();
    expect(contextRequests).toContain('bea:direct:ana:5');
    expect(searched).not.toContain('bea:community:7:Expressão antiga');
    expect(contextRequests).not.toContain('bea:session:41:5');
    expect(errors).toEqual([]);
  } finally {
    await ana.close(); await bea.close();
  }
});

test('one inbox handles deep links, legacy chat URLs and per-account membership', async ({ browser }) => {
  audited.length = 0; reads.length = 0;
  const ana = await context(browser, 'ana');
  const bea = await context(browser, 'bea');
  const first = await ana.newPage(), second = await bea.newPage();
  const errors: string[] = [];
  first.on('pageerror', error => errors.push('ana: ' + error.message));
  second.on('pageerror', error => errors.push('bea: ' + error.message));

  try {
    await first.goto('/menu/friendList/chat/bea', { waitUntil: 'domcontentloaded' });
    await expect(first).toHaveURL(/\/menu\/messages\?kind=direct&id=bea/);
    await expect(first.locator('.inbox-entry.is-selected')).toContainText('Bea');
    await expect(first.locator('.inbox-bubble')).toHaveCount(2);

    // Angular must react to query-only navigation without rebuilding this page.
    await first.evaluate(() => {
      history.pushState(null, '', '/menu/messages?kind=community&id=7');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(first.locator('.inbox-entry.is-selected')).toContainText('CNG QA');
    await expect(first.locator('.inbox-bubble')).toHaveCount(2);

    await first.evaluate(() => {
      history.pushState(null, '', '/menu/messages?kind=session&id=41');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(first.locator('.inbox-entry.is-selected')).toContainText('Ténis');
    await expect(first.locator('#inbox-reply')).toBeEnabled();
    await expect(first.locator('.inbox-bubble')).toHaveCount(2);
    await expect(first.locator('.inbox-entry').filter({ hasText: 'Futebol' })).toHaveCount(0);

    // A non-member cannot invent a community or session via a crafted link.
    await second.goto('/menu/messages?kind=community&id=7', { waitUntil: 'domcontentloaded' });
    await expect(second.locator('.inbox-entry')).toHaveCount(1);
    await expect(second.locator('.inbox-entry.is-selected')).toHaveCount(0);
    await second.goto('/menu/messages?kind=session&id=41', { waitUntil: 'domcontentloaded' });
    await expect(second.locator('.inbox-entry.is-selected')).toHaveCount(0);
    expect(audited).not.toContain('bea:GET /api/communities/7/messages');
    expect(audited).not.toContain('bea:GET /api/sessions/41/messages');

    // Time crosses kick-off WHILE the session chat remains on screen:
    // no new POST may leave the browser, even if the composer had been unlocked.
    const postsBefore = audited.filter(x => x === 'ana:POST /api/sessions/41/messages').length;
    await first.evaluate(() => {
      // Shift the clock by 20 minutes; the fixture's kickoff is +6 minutes.
      const shifted = Date.now() + 20 * 60_000;
      Date.now = () => shifted;
    });
    await first.locator('#inbox-reply').fill('Não enviar depois do início');
    await expect(first.locator('#inbox-reply')).toBeDisabled();
    await expect(first.locator('.inbox-composer button[type="submit"]')).toBeDisabled();
    expect(audited.filter(x => x === 'ana:POST /api/sessions/41/messages')).toHaveLength(postsBefore);
    expect(errors).toEqual([]);
  } finally {
    await ana.close();
    await bea.close();
  }
});
