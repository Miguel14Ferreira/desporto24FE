/*
 * Jynlo Concept One Premium: real Chromium 390 px + desktop viewport contract.
 *
 * Uses the BUILT Angular SPA, synthetic JWT + synthetic GET API responses.
 * No production credentials, requests, WebSocket traffic or remote mutations.
 * Only reads routes; failed layout snapshots are saved to CI artifacts.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:4173';
const OUT = path.resolve('artifacts/concept-one-mobile');
fs.mkdirSync(OUT, { recursive: true });

const jwt = [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    sub: 'mobile-fixture', Authorities: ['ROLE_USER'],
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url'),
  'synthetic-not-signed'
].join('.');

const profile = {
  userId: 'mobile-qa', username: 'mobile-fixture', fullName: 'Jogadora Fictícia',
  nickname: 'Teste', profilePicUrl: null, country: 'Portugal', location: 'Lisboa',
  email: 'qa@example.test', phone: null, favoriteSports: 'Futebol,Padel',
  joinDateDisplay: null, lastLoginDateDisplay: null, mfa: false
};
const publicPages = [
  ['/home', '.home-page'],
  ['/about', '.about-page'],
  ['/contact', '.contact-page'],
  ['/login', '.login-page'],
  ['/login/registerNewUser', '.register-page']
];
const authenticatedPages = [
  ['/menu/notifications', '.notifications-page'],
  ['/menu/my-sessions', '.my-sessions-page'],
  ['/menu/venues', '.venue-directory-page'],
  ['/menu/venues/new', '.venue-create-page'],
  ['/menu/dadosPerfil', '.profile-page'],
  ['/menu/alterardados', '.edit-page'],
  ['/menu/communities', '.communities-page'],
  ['/menu/discover', '.discover-page'],
  ['/menu/events', '.sessions-page'],
  ['/menu/createEvent', '.create-page'],
  ['/menu/perfis', '.community-page'],
  ['/menu/messages', '.inbox-page'],
  ['/menu/feed', '.feed-page']
];
const unexpectedWrites = [];
const browserErrors = [];

const respond = (route, status, data) => route.fulfill({
  status, contentType: 'application/json',
  headers: { 'access-control-allow-origin': SITE, 'access-control-allow-headers': '*' },
  body: JSON.stringify(data)
});

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1366]) {
      for (const language of ['pt', 'en']) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          locale: language === 'en' ? 'en-GB' : 'pt-PT',
          isMobile: width === 390,
          hasTouch: width === 390
        });
        await context.addInitScript(({ token, lang }) => {
          // Only authenticated paths receive a fake JWT. Guest routes stay guest.
          if (location.pathname.startsWith('/menu/')) localStorage.setItem('t', token);
          else localStorage.removeItem('t');
          localStorage.setItem('d24-language', lang);
        }, { token: jwt, lang: language });

        // Route API WebSockets too: HTTP routing does not intercept WS handshakes.
        await context.routeWebSocket('**/*', socket => socket.close());

        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === SITE) return route.continue();

          // Never contact LIVE API, CDN, provider OAuth, or remote services.
          if (url.origin !== 'https://api.d24sports.com') {
            if (request.resourceType() === 'stylesheet') {
              return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
            }
            return route.abort('blockedbyclient');
          }

          if (request.method() === 'OPTIONS') return route.fulfill({
            status: 204,
            headers: { 'access-control-allow-origin': SITE,
              'access-control-allow-methods': 'GET, OPTIONS',
              'access-control-allow-headers': '*' }
          });
          if (request.method() !== 'GET') {
            // The UI can attempt background telemetry/token refresh. Do not send it.
            if (url.pathname !== '/api/presence/heartbeat'
                && url.pathname !== '/api/auth/refresh'
                && url.pathname !== '/api/pilot/events/access') {
              unexpectedWrites.push(request.method() + ' ' + url.pathname);
            }
            return respond(route, 403, {});
          }

          const endpoint = url.pathname;
          if (endpoint === '/api/auth/google/config') return respond(route, 200, { clientId: '' });
          if (endpoint === '/api/profile/me') return respond(route, 200, profile);
          if (endpoint === '/api/notifications/me') return respond(route, 200, []);
          if (endpoint === '/api/notifications/me/unread-count') return respond(route, 200, 0);
          if (endpoint === '/api/notifications/me/preferences') return respond(route, 200, {
            inAppEnabled: true, emailEnabled: true,
            disabledInAppTypes: [], disabledEmailTypes: []
          });
          if (endpoint === '/api/auth/sessions') return respond(route, 200, []);
          if (endpoint === '/api/sessions/mine') {
            return respond(route, 200, { created: [], joined: [], waitlisted: [] });
          }
          if (endpoint === '/api/communities/mine') return respond(route, 200, []);
          if (endpoint === '/api/venues/suggest') {
            return respond(route, 200, { venues: [], page: 0, hasMore: false });
          }
          if (endpoint === '/api/sessions') return respond(route, 200, []);
          return respond(route, 404, { message: 'No fixture for read-only visual audit' });
        });

        const page = await context.newPage();
        page.on('pageerror', error => browserErrors.push(
          width + '/' + language + ': ' + error.message
        ));

        // Scope to READ-ONLY navigation. Never click submit, send, delete, save.
        const scenarios = language === 'pt'
          ? [...publicPages, ...authenticatedPages]
          : [['/home', '.home-page'], ['/menu/notifications', '.notifications-page']];

        for (const [route, selector] of scenarios) {
          await page.goto(SITE + route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
          await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15_000 });
          await page.evaluate(() => document.fonts && document.fonts.ready);
          const measure = await page.evaluate(() => {
            const doc = document.documentElement;
            const width = window.innerWidth;
            return {
              viewport: width, documentWidth: doc.scrollWidth,
              bodyWidth: document.body.scrollWidth,
              offenders: [...document.body.querySelectorAll('*')]
                .filter(el => {
                  const r = el.getBoundingClientRect();
                  const css = getComputedStyle(el);
                  return r.width > 0 && r.height > 0
                    && css.visibility !== 'hidden' && css.display !== 'none'
                    && r.right > width + 3 && r.left < width
                    && css.position !== 'fixed';
                })
                .slice(0, 7).map(el => ({
                  element: el.tagName.toLowerCase(),
                  className: String(el.className || '').slice(0, 75),
                  right: Math.round(el.getBoundingClientRect().right)
                }))
            };
          });
          const name = route.replace(/\W+/g, '-').replace(/^-/, '');
          await page.screenshot({
            path: path.join(OUT, width + '-' + language + '-' + name + '.png'),
            fullPage: false
          });
          const overflow = measure.documentWidth - measure.viewport;
          console.log('[responsive]', width, language, route,
            'documentWidth=' + measure.documentWidth, 'overflow=' + overflow);
          assert.ok(overflow <= 2,
            route + ' (' + width + 'px ' + language + ') horizontal overflow: '
            + JSON.stringify(measure));
          if (route === '/home') {
            assert.equal(await page.locator('.community-teaser').count(), 1,
              'Community teaser must remain in public homepage');
            assert.equal(await page.locator('.community-teaser-cta').getAttribute('href'),
              '/login/registerNewUser', 'CTA must keep registration destination');
          }
        }
        await context.close();
      }
    }
    assert.deepEqual(unexpectedWrites, [], 'Visual audit may not trigger business mutations');
    assert.deepEqual(browserErrors, [], 'Angular must not throw while rendering audited routes');
    console.log('PASS: 390px and desktop, public and synthetic authenticated screens');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
