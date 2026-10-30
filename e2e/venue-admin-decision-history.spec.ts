/**
 * Admin venue edit history: isolated Chromium contract (no live data/credentials).
 * Mock every API request, use unsigned fixture JWTs only on localhost, and
 * reject all unexpected external hosts. Browser tests NEVER touch production.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

if (process.env['JYNLO_USE_SYSTEM_CHROME']) test.use({ channel: 'chrome' });

const APP = 'http://127.0.0.1:4200';
const SOURCE = 'https://example.org/qa/municipal-pool';
const AT = '2026-10-25T19:00:00Z';
const HISTORY_AT = '2026-10-25T20:00:00Z';

const pendingContact = {
  id: 701, venueId: 901, venueName: 'Piscina QA Alfa', status: 'PENDING',
  before: { contact: null }, proposed: { contact: '220000001' },
  reason: 'Contacto publicado em página fictícia de testes',
  submittedByUsername: 'jogadorqa', submittedAt: AT,
  reviewedByUsername: null, reviewedAt: null, decisionNote: null,
  sourceUrl: SOURCE, sourceReviewConfirmedAt: null
};
const pendingLegacy = {
  ...pendingContact, id: 702, venueId: 902, venueName: 'Piscina QA Beta',
  proposed: { contact: '220000002' }, sourceUrl: null
};
const approved = {
  ...pendingContact, id: 690, status: 'APPROVED', reviewedAt: HISTORY_AT,
  reviewedByUsername: 'moderadorqa', decisionNote: 'Página verificada no piloto',
  sourceReviewConfirmedAt: HISTORY_AT
};
const rejected = {
  ...pendingLegacy, id: 689, status: 'REJECTED',
  reviewedAt: AT, reviewedByUsername: 'moderadorqa',
  decisionNote: 'Fonte não comprovada', sourceReviewConfirmedAt: null
};

type Proposal = typeof pendingContact;
type State = {
  pending: Proposal[];
  writes: { path: string; body: Record<string, unknown> }[];
  queried: string[];
  unexpected: string[];
};

function token(admin: boolean): string {
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return [encode({ alg: 'none' }), encode({
    sub: admin ? 'moderadorqa' : 'jogadorqa',
    Authorities: [admin ? 'ROLE_ADMIN' : 'ROLE_USER'],
    exp: Math.floor(Date.now() / 1000) + 3600
  }), 'fixture-not-signed'].join('.');
}
async function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS' },
    body: JSON.stringify(body)
  });
}
async function mock(page: Page, admin = true): Promise<State> {
  const state: State = {
    pending: [{ ...pendingContact }, { ...pendingLegacy }],
    queried: [], writes: [], unexpected: []
  };
  await page.addInitScript(value => localStorage.setItem('t', value), token(admin));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === APP) return route.continue();
    if (!['http://localhost:8080', 'https://api.d24sports.com'].includes(url.origin)) {
      state.unexpected.push(req.method() + ' ' + url.origin);
      return route.abort('blockedbyclient');
    }
    const path = url.pathname, method = req.method();
    if (method === 'OPTIONS') return json(route, 200, {});
    if (path === '/api/admin/access') return json(route, admin ? 200 : 403, {});
    if (path === '/api/admin/venue-edit-suggestions' && method === 'GET') {
      state.queried.push('pending:' + (url.searchParams.get('page') || '0'));
      return json(route, admin ? 200 : 403, {
        suggestions: state.pending, page: 0, hasMore: false
      });
    }
    if (path === '/api/admin/venue-edit-suggestions/history' && method === 'GET') {
      const pageIndex = Number(url.searchParams.get('page') ?? '0');
      state.queried.push('history:' + pageIndex);
      if (!admin) return json(route, 403, {});
      return json(route, 200, {
        suggestions: pageIndex === 0 ? [approved] : pageIndex === 1 ? [rejected] : [],
        page: pageIndex, hasMore: pageIndex === 0
      });
    }
    if (/^\/api\/admin\/venue-edit-suggestions\/\d+\/(approve|reject)$/.test(path)
        && method === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.writes.push({ path, body });
      if (!admin) return json(route, 403, {});
      const id = Number(path.split('/')[4]);
      const item = state.pending.find(x => x.id === id);
      if (!item) return json(route, 404, {});
      if (path.endsWith('/approve') &&
          (!item.sourceUrl || body['sourceReviewed'] !== true)) {
        return json(route, 400, {message: 'Contact requires reviewed source'});
      }
      state.pending = state.pending.filter(x => x.id !== id);
      return json(route, 200, { ...item,
        status: path.endsWith('/approve') ? 'APPROVED' : 'REJECTED',
        reviewedAt: HISTORY_AT, reviewedByUsername: 'moderadorqa',
        sourceReviewConfirmedAt: path.endsWith('/approve') ? HISTORY_AT : null
      });
    }
    if (/\/api\/notifications/.test(path)) return json(route, 200, []);
    if (method === 'GET' && /\/api\/(profile|users|me)(\/|$)/.test(path))
      return json(route, 200, {});
    if (method === 'POST' && path === '/api/presence/heartbeat') return json(route, 200, {});
    if (method === 'GET' && path === '/api/auth/google/config') return json(route, 200, {clientId: ''});
    if (method === 'POST' && path === '/api/auth/refresh') return json(route, 401, {});
    // Never proxy an unmocked API route to a real backend.
    state.unexpected.push(method + ' ' + path);
    return json(route, 404, { message: 'Unmocked API request' });
  });
  return state;
}

test('admin sees an immutable, paginated audit history with real Angular DOM', async ({ page }) => {
  const state = await mock(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/menu/admin/venue-edits', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-edit-page')).toBeVisible();
  await expect(page.locator('.admin-edit-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Histórico de decisões' }).click();
  await expect(page.locator('.admin-edit-item')).toHaveCount(1);
  await expect(page.locator('.admin-edit-item')).toContainText(['Piscina QA Alfa']);
  await page.locator('.admin-edit-item').first().click();
  const dialog = page.locator('.admin-edit-dialog');
  await expect(dialog).toContainText('moderadorqa');
  await expect(dialog).toContainText('Página verificada no piloto');
  await expect(dialog).toContainText('Confirmação da fonte declarada');
  await expect(dialog.locator('.admin-edit-source a')).toHaveAttribute('href', SOURCE);
  await expect(dialog.locator('.admin-edit-source-check')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Aprovar e publicar|Rejeitar sugestão/ })).toHaveCount(0);
  await dialog.locator('.admin-edit-heading button').click();
  await page.locator('.admin-edit-pages button').last().click();
  await expect(page.locator('.admin-edit-item')).toHaveCount(1);
  await page.locator('.admin-edit-item').click();
  await expect(page.locator('.admin-edit-dialog')).toContainText('Sem confirmação de fonte registada');
  await expect(page.locator('.admin-edit-dialog')).toContainText('Fonte não comprovada');
  await expect(page.locator('.admin-edit-dialog .admin-edit-actions')).toHaveCount(0);
  expect(state.queried).toEqual(['pending:0', 'history:0', 'history:1']);
  expect(state.writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('pending contact requires reviewed source; legacy contact can only be rejected', async ({ page }) => {
  const state = await mock(page);
  await page.goto('/menu/admin/venue-edits', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-edit-item')).toHaveCount(2);
  await page.locator('.admin-edit-item').filter({hasText: 'Piscina QA Alfa'}).click();
  const dialog = page.locator('.admin-edit-dialog');
  await expect(dialog.getByRole('button', {name:'Aprovar e publicar'})).toBeEnabled();
  await dialog.getByRole('button', {name:'Aprovar e publicar'}).click();
  await expect(dialog.getByRole('button', {name:'Confirmar', exact:true})).toBeDisabled();
  await dialog.locator('.admin-edit-source-check input').check();
  await dialog.getByRole('button', {name:'Confirmar', exact:true}).click();
  await expect(page.locator('.admin-edit-item')).toHaveCount(1);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toBe('/api/admin/venue-edit-suggestions/701/approve');
  expect(state.writes[0].body['sourceReviewed']).toBe(true);
  await page.locator('.admin-edit-item').first().click();
  await expect(page.locator('.admin-edit-dialog').getByRole('button',
    {name:'Aprovar e publicar'})).toBeDisabled();
  await page.locator('.admin-edit-dialog').getByRole('button',
    {name:'Rejeitar sugestão'}).click();
  await page.locator('.admin-edit-note textarea').fill('Fonte oficial não indicada');
  await page.locator('.admin-edit-dialog').getByRole('button',
    {name:'Confirmar', exact:true}).click();
  await expect(page.locator('.admin-edit-item')).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].path).toBe('/api/admin/venue-edit-suggestions/702/reject');
  expect(state.writes[1].body['sourceReviewed']).toBeUndefined();
});

test('non-admin is redirected without reading decisions or writing anything', async ({ page }) => {
  const state = await mock(page, false);
  await page.goto('/menu/admin/venue-edits', {waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/menu(?:\/|$)/);
  await expect(page.locator('.admin-edit-page')).toHaveCount(0);
  expect(state.queried).toEqual([]);
  expect(state.writes).toEqual([]);
});
