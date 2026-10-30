/*
 * Concept One Premium: populated moderator screens at 390px and desktop.
 *
 * Built frontend, fake ROLE_ADMIN token and fully mocked API. No calls to
 * production, no real user data and no moderation writes. Only open/close
 * synthetic details and inspect layout, actions, accessibility and PT/EN.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:4173';
const OUT = path.resolve('artifacts/concept-one-admin-populated');
fs.mkdirSync(OUT, { recursive: true });
const token = [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: 'synthetic-moderator', Authorities: ['ROLE_USER', 'ROLE_ADMIN'],
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url'), 'fake-signature'
].join('.');

const ideas = [
  { id: 801, name: 'Jogadora de teste', city: 'Lisboa', gender: '',
    email: 'fixture@example.test',
    subject: 'Melhoria de competições entre equipas e resultados',
    problem: 'Precisamos de consultar épocas, jornadas e classificações com clareza em dispositivos pequenos.',
    status: 'NEW', createdAt: '2026-10-24T18:40:00Z' },
  { id: 802, name: 'Organizador de teste', city: 'Porto', gender: '',
    email: 'fixture-two@example.test',
    subject: 'Melhorar a descoberta dos recintos',
    problem: 'A pesquisa de recintos deve manter o acesso às modalidades.',
    status: 'IN_REVIEW', createdAt: '2026-10-23T11:30:00Z' }
];
const reports = [
  { id: 901, reporterUsername: 'reporter-fixture',
    reportedUsername: 'moderated-fixture',
    status: 'OPEN', reason: 'Descrição de ocorrência fictícia para rever em ecrã de telemóvel, sem qualquer utilizador real.',
    createdAt: '2026-10-24T20:10:00Z' },
  { id: 902, reporterUsername: 'second-fixture',
    reportedUsername: 'another-fixture',
    status: 'OPEN', reason: 'Outra ocorrência fictícia para validar a disposição de múltiplos cartões.',
    createdAt: '2026-10-25T09:35:00Z' }
];

const blockedWrites = [];
const unexpectedErrors = [];
const reply = (route, status, body) => route.fulfill({
  status, contentType: 'application/json',
  headers: {
    'access-control-allow-origin': SITE,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, OPTIONS'
  },
  body: JSON.stringify(body)
});

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1366]) {
      for (const lang of ['pt', 'en']) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          isMobile: width === 390,
          hasTouch: width === 390,
          locale: lang === 'en' ? 'en-GB' : 'pt-PT'
        });
        await context.addInitScript(({ jwt, language }) => {
          localStorage.setItem('t', jwt);
          localStorage.setItem('d24-language', language);
        }, { jwt: token, language: lang });
        await context.routeWebSocket('**/*', socket => socket.close());
        await context.route('**/*', route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === SITE) return route.continue();
          if (url.origin !== 'https://api.d24sports.com') {
            if (request.resourceType() === 'stylesheet') {
              return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
            }
            return route.abort('blockedbyclient');
          }
          if (request.method() === 'OPTIONS') return route.fulfill({
            status: 204, headers: {
              'access-control-allow-origin': SITE,
              'access-control-allow-methods': 'GET, OPTIONS',
              'access-control-allow-headers': '*'
            }
          });
          if (request.method() !== 'GET') {
            // All writes, including background requests, are denied locally.
            if (!['/api/auth/refresh', '/api/pilot/events/access',
              '/api/presence/heartbeat'].includes(url.pathname)) {
              blockedWrites.push(request.method() + ' ' + url.pathname);
            }
            return reply(route, 403, { message: 'Read-only moderator audit' });
          }
          if (url.pathname === '/api/admin/access') return reply(route, 200, {});
          if (url.pathname === '/api/admin/ideas') return reply(route, 200, ideas);
          if (url.pathname === '/api/admin/reports/users') return reply(route, 200, reports);
          if (url.pathname === '/api/auth/google/config') return reply(route, 200, { clientId: '' });
          if (url.pathname === '/api/notifications/me/unread-count') return reply(route, 200, 0);
          if (url.pathname === '/api/profile/me') return reply(route, 200, {
            username: 'synthetic-moderator', fullName: 'Moderador Fictício',
            profilePicUrl: null, email: 'moderator@example.test'
          });
          return reply(route, 404, { message: 'Fixture read route missing' });
        });

        const page = await context.newPage();
        page.on('pageerror', error => unexpectedErrors.push(
          width + '/' + lang + ': ' + error.message
        ));
        const scenarios = [
          ['/menu/admin', '.admin-page', 'home'],
          ['/menu/admin/ideas', '.admin-ideas-page', 'ideas'],
          ['/menu/admin/reports', '.admin-reports-page', 'reports']
        ];
        for (const [route, selector, name] of scenarios) {
          await page.goto(SITE + route, { waitUntil: 'domcontentloaded' });
          await page.locator(selector).waitFor({ state: 'visible', timeout: 15000 });
          if (name === 'ideas') {
            await page.locator('.idea-card').first().waitFor();
            assert.equal(await page.locator('.idea-card').count(), 2);
            assert.match(await page.locator('.idea-card').first().innerText(),
              /competições|competitions|melhoria/i);
            await page.locator('.idea-card').first().click();
            await page.locator('.idea-detail .detail-content').waitFor();
            const close = page.locator('.idea-detail button.close-detail');
            assert.equal(await close.getAttribute('aria-label'),
              lang === 'pt' ? 'Fechar detalhes' : 'Close details',
              'Details close button must have a translated accessible name');
            const email = await page.locator('.email-action').getAttribute('href');
            assert.ok(email.startsWith('mailto:fixture@example.test?subject=Jynlo - '),
              'Reply must preserve synthetic recipient and Jynlo brand');
            assert.equal(await page.locator('.status-buttons button').count(), 5);
          }
          if (name === 'reports') {
            await page.locator('.report-card').first().waitFor();
            assert.equal(await page.locator('.report-card').count(), 2);
            assert.equal(await page.locator('.report-card .report-actions button').count(), 4);
            assert.match(await page.locator('.report-card').first().innerText(), /fixture/i);
          }

          await page.evaluate(() => document.fonts && document.fonts.ready);
          const m = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
            cards: [...document.querySelectorAll(
              '.idea-detail, .ideas-layout, .report-card, .admin-grid'
            )].filter(x => getComputedStyle(x).display !== 'none').map(x => ({
              className: x.className,
              width: Math.round(x.getBoundingClientRect().width),
              scrollWidth: x.scrollWidth, clientWidth: x.clientWidth
            }))
          }));
          console.log('[populated-admin]', width, lang, route,
            'overflow=' + (m.document - m.viewport));
          assert.ok(m.document <= width + 2,
            route + ' overall horizontal overflow: ' + JSON.stringify(m));
          // Internal clipping can go unnoticed when the root hides overflow.
          for (const card of m.cards) {
            assert.ok(card.scrollWidth <= card.clientWidth + 2,
              route + ' internally clipped: ' + JSON.stringify(card));
          }
          await page.screenshot({
            path: path.join(OUT, width + '-' + lang + '-' + name + '.png'),
            fullPage: false
          });
          if (name === 'ideas') {
            await page.locator('button.close-detail').click();
            assert.equal(await page.locator('.idea-detail .detail-placeholder').count(), 1,
              'Close details must restore the empty placeholder');
          }
        }
        await context.close();
      }
    }
    assert.deepEqual(blockedWrites, [], 'No business mutations during read-only QA');
    assert.deepEqual(unexpectedErrors, [], 'No Angular runtime exceptions');
    console.log('PASS: 12 populated moderator page checks in PT/EN, 390px/desktop');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
