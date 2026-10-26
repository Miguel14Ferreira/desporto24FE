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
// Four read-only authenticated session states. No fake backend mutations.
const futureGameDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
const pastGameDate = new Date(Date.now() - 3 * 86_400_000).toISOString();
const sessionDetailFixtures = {
  901: { id: 901, sport: 'Padel', city: 'Lisboa', gameDate: futureGameDate,
    participantCount: 2, maxParticipants: 4, priceAmount: 0, status: 'OPEN',
    privateGame: false, audience: 'PUBLIC', distanceKm: null,
    creatorUsername: 'qa-organizer', address: null, canSeeExactAddress: false,
    joined: false, waitlisted: false, waitlistPosition: null, gamePhoto: null },
  902: { id: 902, sport: 'Futsal', city: 'Porto', gameDate: futureGameDate,
    participantCount: 4, maxParticipants: 4, priceAmount: 0, status: 'FULL',
    privateGame: false, audience: 'PUBLIC', distanceKm: null,
    creatorUsername: 'qa-organizer', address: null, canSeeExactAddress: false,
    joined: false, waitlisted: false, waitlistPosition: null, gamePhoto: null },
  903: { id: 903, sport: 'Voleibol', city: 'Cascais', gameDate: futureGameDate,
    participantCount: 3, maxParticipants: 6, priceAmount: 0, status: 'OPEN',
    privateGame: false, audience: 'PUBLIC', distanceKm: null,
    creatorUsername: 'qa-organizer', address: null, canSeeExactAddress: false,
    joined: true, waitlisted: false, waitlistPosition: null, gamePhoto: null },
  904: { id: 904, sport: 'Basquetebol', city: 'Sintra', gameDate: pastGameDate,
    participantCount: 4, maxParticipants: 4, priceAmount: 0, status: 'COMPLETED',
    privateGame: false, audience: 'PUBLIC', distanceKm: null,
    creatorUsername: 'qa-organizer', address: null, canSeeExactAddress: false,
    joined: true, waitlisted: false, waitlistPosition: null, gamePhoto: null }
};
const fictionalVenues = [
  { id: 201, name: 'Campo Fictício 3', city: 'Lisboa', district: 'Lisboa',
    address: null, locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN',
    latitude: 38.75, longitude: -9.16, sports: 'Futebol',
    informationSource: 'OPENSTREETMAP', createdAt: '2026-10-20T12:00:00Z' },
  { id: 202, name: 'Pavilhão Fictício', city: 'Porto', district: 'Porto',
    address: 'Rua de Exemplo 12', sports: 'Futsal',
    informationSource: 'COMMUNITY', createdAt: '2026-10-20T12:00:00Z' },
  { id: 203, name: 'Campo Fictício 5', city: 'Lisboa', district: 'Lisboa',
    address: null, locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN',
    latitude: 38.755, longitude: -9.164, sports: 'Futebol',
    informationSource: 'OPENSTREETMAP', createdAt: '2026-10-20T12:00:00Z' }
];
const fictionalParticipants = [
  { id: 51, username: 'mobile-fixture', attendanceStatus: 'PENDING',
    joinedAt: futureGameDate, teamCode: null },
  { id: 52, username: 'qa-teammate', attendanceStatus: 'PENDING',
    joinedAt: futureGameDate, teamCode: null }
];

const unexpectedWrites = [];
const browserErrors = [];

const respond = (route, status, data) => route.fulfill({
  status, contentType: 'application/json',
  headers: { 'access-control-allow-origin': SITE, 'access-control-allow-headers': '*' },
  body: JSON.stringify(data)
});

async function main() {
  const browser = await chromium.launch({
    headless: true, args: ['--no-sandbox'],
    ...(process.env.JYNLO_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {})
  });
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
          // An embedded, cross-origin OSM iframe can block access to localStorage.
          // Only the audited SPA main document ever needs the synthetic identity.
          if (window.self !== window.top || location.origin !== 'http://127.0.0.1:4173') return;
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
          // Session details are read-only: each route receives an explicit fixture.
          const detailId = /^\/api\/sessions\/(901|902|903|904)$/.exec(endpoint);
          if (detailId) return respond(route, 200, sessionDetailFixtures[Number(detailId[1])]);
          const rosterId = /^\/api\/sessions\/(903|904)\/participants$/.exec(endpoint);
          if (rosterId) return respond(route, 200, fictionalParticipants);
          if (endpoint === '/api/profiles/qa-organizer/reliability') {
            return respond(route, 200, { attendanceRate: 100, completedSessions: 4,
              noShows: 0, lateCancellations: 0, penaltyScore: 0,
              warning: false, reducedPriority: false, joinRestricted: false });
          }

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
            return respond(route, 200, { venues: fictionalVenues, page: 0, hasMore: false });
          }
          if (endpoint === '/api/venues/201') return respond(route, 200, fictionalVenues[0]);
          if (endpoint === '/api/venues/201/photos'
              || endpoint === '/api/venues/201/sport-conditions') return respond(route, 200, []);
          if (endpoint === '/api/venues/201/ratings/summary') return respond(route, 200, null);
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

        // High-value authenticated detail states omitted from previous 390px QA.
        // English also gets the session detail smoke even though its general
        // route sweep is deliberately kept small to reduce CI costs.
        scenarios.push(
          ['/menu/venues', '.venue-directory-grid .venue-directory-card'],
          ['/menu/venues/201', '.venue-detail-page .venue-header'],
          ['/menu/venues/new', '.venue-create-form'],
          ['/menu/events/901', '.jynlo-session-detail-premium .detail-card'],
          ['/menu/events/902', '.jynlo-session-detail-premium .detail-card'],
          ['/menu/events/903', '.jynlo-session-detail-premium .detail-card'],
          ['/menu/events/904', '.jynlo-session-detail-premium .detail-card']
        );

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
          if (route === '/menu/venues') {
            const shell = page.locator('.venue-directory-page');
            assert.equal(await shell.locator('.venue-directory-card').count(), 3,
              'Populated synthetic catalogue shows exactly three unique venues');
            const gap = await shell.locator('.venue-directory-filters').evaluate(
              el => getComputedStyle(el).gap);
            const margin = await shell.locator('.venue-directory-result-heading').evaluate(
              el => getComputedStyle(el).marginTop);
            assert.equal(gap, width === 390 ? '14px' : '16px',
              'Catalogue filters retain readable responsive spacing');
            assert.equal(margin, width === 390 ? '20px' : '24px',
              'Catalogue results are separated from filter form');
          }
          if (route === '/menu/venues/201') {
            const shell = page.locator('.venue-detail-page');
            assert.equal(await shell.locator('.venue-hero-back').count(), 1,
              'Venue detail must offer visible return navigation');
            const back = shell.locator('.venue-hero-back');
            const backBox = await back.boundingBox();
            assert.ok(backBox && backBox.width > 80 && backBox.x >= -3
              && backBox.x + backBox.width <= width + 3,
              'Venue return control must remain visible without horizontal clipping');
            assert.equal(await shell.locator('.venue-address-map-link').count(), 1,
              'GPS-only venue has a navigation link without a fabricated street');
            assert.match(await shell.locator('.venue-address-map-link').getAttribute('href'),
              /^https:\/\/www\.google\.com\/maps\?q=38\.75,-9\.16$/,
              'Map action must use the supplied synthetic coordinates');
            const margin = await shell.locator('.venue-header').evaluate(
              el => getComputedStyle(el).marginBottom);
            assert.equal(margin, width === 390 ? '20px' : '24px',
              'Venue summary must not collide with the header');
          }
          if (route === '/menu/venues/new') {
            assert.equal(await page.locator('.venue-create-form').count(), 1,
              'New venue form must render safely');
            const form = page.locator('.venue-create-form');
            const formBox = await form.boundingBox();
            assert.ok(formBox && formBox.width > 150 && formBox.x >= -3
              && formBox.x + formBox.width <= width + 3,
              'New venue form must fit inside the viewport');
          }
          if (/^\/menu\/events\/90[1-4]$/.test(route)) {
            const caseId = Number(route.slice(-3));
            const shell = page.locator('.jynlo-session-detail-premium');
            const card = shell.locator('.detail-card');
            await card.waitFor({ state: 'visible' });
            const box = await card.boundingBox();
            assert.ok(box && box.width > 50 && box.x >= -3
              && box.x + box.width <= width + 3,
              route + ': detail card extends outside viewport ' + JSON.stringify(box));
            assert.equal(await shell.locator('a.back-link[href="/menu/events"]').count(), 1,
              'session detail preserves return navigation');
            assert.equal(await shell.locator('.detail-grid').count(), 1,
              'session facts stay available');
            if (caseId === 901 || caseId === 902) {
              assert.equal(await shell.locator('#session-participation button.primary-action').count(), 1,
                'open and full sessions must show join/waitlist CTA');
              assert.equal(await shell.locator('.membership-status').count(), 0);
              if (caseId === 902) {
                assert.match(await shell.locator('#session-participation').innerText(),
                  language === 'pt' ? /lista de espera/i : /waitlist|waiting list/i,
                  'full session must explain the waiting list');
              }
            } else {
              assert.equal(await shell.locator('#session-participation button.primary-action').count(), 0,
                'already joined or finished sessions must not prompt another join');
              assert.equal(await shell.locator('.membership-status').count(), 1);
              await shell.locator('#session-participants .session-participant-list').first().waitFor();
              assert.equal(await shell.locator('.session-participant-list').first().innerText()
                .then(text => text.includes('@mobile-fixture')), true,
                'participant names are visible for a confirmed member');
              if (caseId === 903) {
                assert.equal(await shell.locator('.session-top-actions a[href^="/menu/messages"]').count(), 1,
                  'future participant may open session chat');
              } else {
                assert.equal(await shell.locator('.session-top-actions a[href^="/menu/messages"]').count(), 0,
                  'past session cannot reopen chat');
              }
            }
          }
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
    console.log('PASS: 390px/1366px PT/EN including four synthetic authenticated session states');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
