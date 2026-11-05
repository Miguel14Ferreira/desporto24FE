#!/usr/bin/env node
'use strict';

// Read-only LIVE QA check for the previously provisioned two-member private
// community and its two weekly occurrences. Login POST only: all other API
// requests GET. Browser navigation can update QA read receipts. Never write
// messages, dump JWTs, persist screenshots, traces, videos, or browser state.
const assert = require('node:assert/strict');
const { authenticate } = require('./jynlo-inbox-live-browser.cjs');

const API = 'https://api.d24sports.com';
const SITE = 'https://d24sports.com';
const OWNER = 'jynloteste01', MEMBER = 'jynloteste02';
const GROUP = 'JYNLO QA - Comunidade Privada de Testes';
const MARKER = 'JYNLO QA - SESSAO PRIVADA - NAO E EVENTO REAL';
const safeId = n => Number.isSafeInteger(n) && n > 0;
function requireValid(value, code) { assert.ok(value, code); }

async function main({ fetchImpl = globalThis.fetch, chromiumImpl, report = console.log } = {}) {
  requireValid(process.env.JYNLO_QA_USERNAME_1 === OWNER
    && process.env.JYNLO_QA_USERNAME_2 === MEMBER, 'QA_IDENTITIES_NOT_ALLOWED');
  const passwords = [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2];
  requireValid(passwords.every(x => typeof x === 'string' && x.length > 0),
    'QA_PASSWORDS_MISSING');
  const [owner, member] = await Promise.all([
    authenticate(OWNER, passwords[0], fetchImpl),
    authenticate(MEMBER, passwords[1], fetchImpl)
  ]);

  async function api(path, token, allowDenied = false) {
    requireValid(path === '/api/communities/mine'
      || /^\/api\/communities\/[1-9]\d*\/(sessions|messages)$/.test(path)
      || /^\/api\/sessions\/[1-9]\d*(\/messages)?$/.test(path),
    'QA_ENDPOINT_NOT_ALLOWED');
    const response = await fetchImpl(API + path, {
      method: 'GET', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }
    });
    if (allowDenied && (response.status === 403 || response.status === 404))
      return { denied: true };
    requireValid(response.ok, 'QA_HTTP_' + response.status);
    return response.json();
  }

  const [myGroups, memberGroups] = await Promise.all([
    api('/api/communities/mine', owner), api('/api/communities/mine', member)
  ]);
  requireValid(Array.isArray(myGroups) && Array.isArray(memberGroups), 'QA_GROUPS_INVALID');
  const matches = myGroups.filter(g => g.name === GROUP &&
    g.ownerUsername?.toLowerCase() === OWNER && g.visibility === 'PRIVATE');
  assert.equal(matches.length, 1, 'QA_PRIVATE_GROUP_NOT_UNIQUE');
  const groupId = matches[0].id;
  requireValid(safeId(groupId) && memberGroups.some(g =>
    g.id === groupId && g.visibility === 'PRIVATE'), 'QA_MEMBER_GROUP_MISSING');
  report('[PASS] Both disposable accounts belong to the same private QA community');

  const sessions = await api('/api/communities/' + groupId + '/sessions', owner);
  requireValid(Array.isArray(sessions), 'QA_GROUP_SESSIONS_INVALID');
  const candidates = sessions.filter(s =>
    s.communityId === groupId && s.sport === 'Futebol'
    && s.privateGame === true && typeof s.recurrenceSeriesId === 'string');
  const identified = [];
  for (const s of candidates.slice(0, 30)) {
    requireValid(safeId(s.id), 'QA_SESSION_ID_INVALID');
    const d = await api('/api/sessions/' + s.id, owner);
    if (d.address === MARKER && d.creatorUsername?.toLowerCase() === OWNER)
      identified.push(d);
  }
  requireValid(identified.length === 2, 'QA_TWO_SESSIONS_REQUIRED');
  const series = new Set(identified.map(s => s.recurrenceSeriesId));
  requireValid(series.size === 1 && [...series][0], 'QA_SINGLE_WEEKLY_SERIES_REQUIRED');
  identified.sort((a, b) => Date.parse(a.gameDate) - Date.parse(b.gameDate));
  const [first, second] = identified;
  requireValid(first.communityId === groupId && second.communityId === groupId
    && first.privateGame && second.privateGame
    && first.audience === 'COMMUNITY_ONLY' && second.audience === 'COMMUNITY_ONLY',
    'QA_SESSION_PRIVACY_MISMATCH');
  requireValid(Date.parse(first.gameDate) > Date.now()
    && Date.parse(second.gameDate) > Date.parse(first.gameDate), 'QA_SESSION_NOT_FUTURE');
  const secondMember = await api('/api/sessions/' + second.id, member);
  const firstMember = await api('/api/sessions/' + first.id, member);
  requireValid(firstMember.joined === true && firstMember.participantCount === 2,
    'QA_FIRST_SESSION_MEMBER_MISSING');
  requireValid(secondMember.joined === false, 'QA_SECOND_SESSION_UNEXPECTED_JOIN');
  report('[PASS] Both weekly QA fixtures identified; only first has both participants');

  const [ownerGroupHistory, memberGroupHistory, firstOwnerChat, firstMemberChat] =
    await Promise.all([
      api('/api/communities/' + groupId + '/messages', owner),
      api('/api/communities/' + groupId + '/messages', member),
      api('/api/sessions/' + first.id + '/messages', owner),
      api('/api/sessions/' + first.id + '/messages', member)
    ]);
  requireValid([ownerGroupHistory, memberGroupHistory, firstOwnerChat, firstMemberChat]
    .every(Array.isArray), 'QA_AUTHORIZED_CHAT_INVALID');
  report('[PASS] Group and first session chats are readable for both QA accounts');

  const secondDenied = await api('/api/sessions/' + second.id + '/messages',
    member, true);
  requireValid(secondDenied.denied === true, 'QA_UNJOINED_SESSION_CHAT_EXPOSED');
  const secondOwnerChat = await api('/api/sessions/' + second.id + '/messages', owner);
  requireValid(Array.isArray(secondOwnerChat), 'QA_OWNER_SECOND_CHAT_INVALID');
  report('[PASS] Second session chat denies the unjoined account');

  let chromium = chromiumImpl;
  if (!chromium) chromium = require('playwright').chromium;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [username, token] of [[OWNER, owner], [MEMBER, member]]) {
      const context = await browser.newContext({
        locale: 'pt-PT', viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block'
      });
      try {
        await context.addInitScript(value => localStorage.setItem('t', value), token);
        for (const [kind, id] of [['community', groupId], ['session', first.id]]) {
          const page = await context.newPage();
          try {
            await page.goto(SITE + '/menu/messages?kind=' + kind + '&id=' + id,
              { waitUntil: 'domcontentloaded', timeout: 35000 });
            await page.locator('.inbox-entry.is-selected')
              .waitFor({ timeout: 25000 });
            await page.locator('#inbox-reply:enabled')
              .waitFor({ timeout: 25000 });
            requireValid(new URL(page.url()).origin === SITE,
              'QA_BROWSER_OUTSIDE_SITE');
          } finally {
            await page.close();
          }
        }
        report('[PASS] Browser opened authorized QA community and session chat for ' + username);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  report('[PASS] Read-only LIVE weekly community and session chat audit complete');
}

if (require.main === module) main().catch(error => {
  const msg = typeof error?.message === 'string' && /^QA_[A-Z0-9_]+$/.test(error.message)
    ? error.message : 'QA_BROWSER_OR_NETWORK_FAILURE';
  console.error('[FAIL] ' + msg);
  process.exitCode = 1;
});
module.exports = { main };
