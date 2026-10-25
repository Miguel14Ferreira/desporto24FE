#!/usr/bin/env node
'use strict';

/**
 * Read-only qualification for a REAL optional-email opt-out test.
 * Never creates a community, invitation, friendship, email or preference change.
 * Uses two *existing* disposable QA accounts and a private community with no
 * real members. Outputs only READY/SKIP, no usernames other than the fixed QA
 * pair, no IDs, notifications, secrets, tokens or email addresses.
 */
const BASE = 'https://api.d24sports.com';
const QA = ['jynloteste01', 'jynloteste02'];
function ensure(ok, message) { if (!ok) throw new Error(message); }

function createPreflight({ fetchImpl = globalThis.fetch, output = console.log } = {}) {
  async function get(path, token, requestBody) {
    ensure(/^\/api\/(auth\/login|communities(\/mine|\/invites\/me|\/\d+)?|notifications\/me\/preferences)$/.test(path),
      'Unexpected endpoint in email QA preflight.');
    const auth = path === '/api/auth/login';
    ensure(auth === (requestBody !== undefined), 'Only QA login can be POST.');
    const options = {
      method: auth ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(auth ? { 'Content-Type': 'application/json' } : {}) },
      redirect: 'error', signal: AbortSignal.timeout(12_000),
      ...(auth ? { body: JSON.stringify(requestBody) } : {})
    };
    let response;
    try { response = await fetchImpl(BASE + path, options); }
    catch { throw new Error('Network error contacting QA API endpoint: ' + path); }
    ensure(response.ok, 'HTTP ' + response.status + ' in QA API endpoint: ' + path);
    try { return await response.json(); }
    catch { throw new Error('Invalid JSON from QA API endpoint: ' + path); }
  }
  async function login(name, password) {
    const r = await get('/api/auth/login', null, { username: name, password });
    ensure(!r.mfaRequired && typeof r.token === 'string' && r.token.length > 30
      && r.profile?.username?.toLowerCase() === name, 'QA login or identity could not be confirmed.');
    return r.token;
  }
  async function run({ passwords } = {}) {
    ensure(Array.isArray(passwords) && passwords.length === 2
      && passwords.every(s => typeof s === 'string' && s.length > 0),
      'QA passwords missing from protected workflow secrets.');
    const tokens = [];
    for (let i = 0; i < QA.length; i++) tokens[i] = await login(QA[i], passwords[i]);
    const own = [];
    const pending = [];
    for (let i = 0; i < QA.length; i++) {
      const [communities, invites, preferences] = await Promise.all([
        get('/api/communities/mine', tokens[i]),
        get('/api/communities/invites/me', tokens[i]),
        get('/api/notifications/me/preferences', tokens[i])
      ]);
      ensure(Array.isArray(communities) && Array.isArray(invites) &&
        typeof preferences.inAppEnabled === 'boolean' &&
        typeof preferences.emailEnabled === 'boolean' &&
        Array.isArray(preferences.disabledInAppTypes) &&
        Array.isArray(preferences.disabledEmailTypes), 'Unexpected authenticated QA response.');
      own.push(communities);
      pending.push(invites);
    }
    let candidate = false;
    for (let sender = 0; sender < 2; sender++) {
      const target = 1 - sender;
      for (const c of own[sender]) {
        if (!Number.isSafeInteger(c.id) || c.id < 1 ||
          c.ownerUsername?.toLowerCase() !== QA[sender] ||
          c.memberCount !== 1 || !Array.isArray(c.members) ||
          c.members.length !== 1 ||
          c.members[0]?.username?.toLowerCase() !== QA[sender] ||
          pending[target].some(inv => inv.communityId === c.id) ||
          own[target].some(t => t.id === c.id)) continue;
        const detail = await get('/api/communities/' + c.id, tokens[sender]);
        if (detail.id !== c.id || detail.ownerUsername?.toLowerCase() !== QA[sender] ||
          detail.memberCount !== 1 || !Array.isArray(detail.members) ||
          detail.members.length !== 1 ||
          detail.members[0]?.username?.toLowerCase() !== QA[sender]) continue;
        candidate = true;
        break;
      }
      if (candidate) break;
    }
    if (candidate) {
      output('[READY] An existing single-member QA-owned community can support a controlled invitation email test.');
    } else {
      output('[SKIP] No isolated QA-only community is available for sending; no data was changed.');
    }
    return { safeCandidate: candidate, modifiedProduction: false };
  }
  return { run };
}
if (require.main === module) {
  if (process.argv.length > 2) {
    console.error('[FAIL] Preflight accepts no command arguments.');
    process.exitCode = 1;
  } else {
    createPreflight().run({passwords:[
      process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2
    ]}).catch(e => { console.error('[FAIL]', e.message); process.exitCode = 1; });
  }
}
module.exports = { createPreflight };
