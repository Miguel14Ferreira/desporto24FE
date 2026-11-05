#!/usr/bin/env node
'use strict';

// Explicitly authorized one-time production QA setup.
// Only disposable QA identities; one private Futebol + Karting community.
// Do not retry any ambiguous POST. Never print passwords, JWTs or member data.
const assert = require('node:assert/strict');
const API = 'https://api.d24sports.com';
const USERS = ['jynloteste01', 'jynloteste02'];
const NAME = 'JYNLO QA - Multidesporto Futebol e Karting';
const DESCRIPTION = 'Comunidade PRIVADA QA multidesporto para testar classificações independentes de Futebol e Karting. Não corresponde a competições reais.';
const NAME_LOWER = NAME.toLocaleLowerCase('pt-PT');

async function main({ fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const passwords = [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2];
  assert.ok(passwords.every(p => typeof p === 'string' && p.length > 0), 'QA_PASSWORDS_MISSING');
  assert.equal(process.env.JYNLO_QA_USERNAME_1, USERS[0], 'QA_OWNER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_USERNAME_2, USERS[1], 'QA_INVITEE_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_PROVISION_CONSENT, 'QA_MULTISPORT_COMMUNITY_CREATE_ONCE',
    'QA_EXPLICIT_CONSENT_MISSING');
  const validId = id => Number.isSafeInteger(id) && id > 0;

  async function api(path, { token, body, login = false } = {}) {
    assert.ok(
      path === '/api/auth/login'
      || path === '/api/communities'
      || path === '/api/communities/mine'
      || path === '/api/communities/invites/me'
      || /^\/api\/communities\/[1-9]\d*\/invites$/.test(path)
      || /^\/api\/communities\/invites\/[1-9]\d*\/accept$/.test(path),
      'QA_ENDPOINT_NOT_ALLOWED');
    assert.ok(login ? path === '/api/auth/login' && !token :
      typeof token === 'string' && token.length > 30, 'QA_INVALID_AUTH');
    const method = body === undefined ? 'GET' : 'POST';
    assert.ok(method === 'GET' || (
      (path === '/api/communities' && !login)
      || path === '/api/auth/login'
      || path.endsWith('/invites')
      || path.endsWith('/accept')), 'QA_WRITE_NOT_ALLOWED');
    const response = await fetchImpl(API + path, {
      method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) throw Error('QA_HTTP_' + response.status);
    if (response.status === 204) return {};
    return response.json();
  }

  async function login(username, password) {
    const answer = await api('/api/auth/login',
      { login: true, body: { username, password } });
    assert.equal(answer.profile?.username?.toLowerCase(), username, 'QA_LOGIN_IDENTITY');
    assert.ok(!answer.mfaRequired && typeof answer.token === 'string'
      && answer.token.length > 30, 'QA_LOGIN_FAILED');
    return answer.token;
  }

  const owner = await login(USERS[0], passwords[0]);
  const invited = await login(USERS[1], passwords[1]);
  log('[PASS] Both disposable QA accounts authenticated');
  async function findOwn(token) {
    const all = await api('/api/communities/mine', { token });
    assert.ok(Array.isArray(all), 'QA_COMMUNITY_LIST_INVALID');
    return all.filter(c => typeof c.name === 'string'
      && c.name.toLocaleLowerCase('pt-PT') === NAME_LOWER);
  }

  let matches = await findOwn(owner);
  assert.ok(matches.length <= 1, 'QA_DUPLICATE_GROUP_NAME_ABORT');
  let community;
  if (matches.length === 1) {
    community = matches[0];
    assert.equal(community.ownerUsername?.toLowerCase(), USERS[0], 'QA_COMMUNITY_NOT_OWNED');
    assert.equal(community.visibility, 'PRIVATE', 'QA_COMMUNITY_NOT_PRIVATE');
    assert.ok(Array.isArray(community.sports) && community.sports.includes('Futebol') && community.sports.includes('Karting'),
      'QA_COMMUNITY_SPORT_MISMATCH');
    log('[PASS] Existing private QA community reused; no duplicate created');
  } else {
    // Exactly one create POST, never retry a network-ambiguous failure.
    const answer = await api('/api/communities', { token: owner, body: {
      name: NAME, description: DESCRIPTION, sport: 'Futebol',
      sports: ['Futebol', 'Karting'], visibility: 'PRIVATE'
    } });
    assert.ok(validId(answer.id), 'QA_CREATE_RESPONSE_INVALID');
    assert.equal(answer.name, NAME, 'QA_CREATED_NAME_MISMATCH');
    assert.equal(answer.visibility, 'PRIVATE', 'QA_CREATED_VISIBILITY_MISMATCH');
    assert.equal(answer.ownerUsername?.toLowerCase(), USERS[0], 'QA_CREATED_OWNER_MISMATCH');
    community = answer;
    assert.ok(Array.isArray(answer.sports) && answer.sports.includes('Futebol') && answer.sports.includes('Karting'), 'QA_CREATED_SPORTS_INVALID');
    log('[PASS] Created one private multidesporto QA community');
  }

  const communityId = community.id;
  assert.ok(validId(communityId), 'QA_GROUP_ID_INVALID');
  const joined = await findOwn(invited);
  const joinedTarget = joined.some(c => c.id === communityId);
  if (!joinedTarget) {
    const pending = await api('/api/communities/invites/me', { token: invited });
    assert.ok(Array.isArray(pending), 'QA_INVITES_LIST_INVALID');
    const pendingMine = pending.filter(c => c.communityId === communityId
      && c.invitedByUsername?.toLowerCase() === USERS[0]);
    assert.ok(pendingMine.length <= 1, 'QA_DUPLICATE_INVITES_ABORT');
    let invite = pendingMine[0];
    if (!invite) {
      invite = await api('/api/communities/' + communityId + '/invites', {
        token: owner, body: { username: USERS[1] }
      });
      assert.equal(invite.communityId, communityId, 'QA_INVITE_RESPONSE_MISMATCH');
      assert.equal(invite.invitedByUsername?.toLowerCase(), USERS[0],
        'QA_INVITE_OWNER_MISMATCH');
      log('[PASS] One invitation sent to disposable QA account');
    } else {
      log('[PASS] Existing pending invitation reused');
    }
    assert.ok(validId(invite.id), 'QA_INVITE_ID_INVALID');
    const accepted = await api('/api/communities/invites/' + invite.id + '/accept', {
      token: invited, body: {}
    });
    assert.equal(accepted.id, communityId, 'QA_ACCEPT_GROUP_MISMATCH');
    log('[PASS] Second QA identity accepted invitation');
  } else {
    log('[PASS] Second QA identity was already a member');
  }

  const [ownerAfter, invitedAfter] = await Promise.all([findOwn(owner), findOwn(invited)]);
  const x = ownerAfter.find(c => c.id === communityId);
  const y = invitedAfter.find(c => c.id === communityId);
  assert.ok(x && y, 'QA_MEMBERSHIP_NOT_CONFIRMED');
  assert.equal(x.visibility, 'PRIVATE', 'QA_VISIBILITY_CHANGED');
  assert.equal(y.visibility, 'PRIVATE', 'QA_INVITEE_VISIBILITY_MISMATCH');
  assert.ok(x.memberCount >= 2 && y.memberCount >= 2, 'QA_MEMBER_COUNT_INVALID');
  assert.ok(Array.isArray(x.sports) && x.sports.includes('Futebol') && x.sports.includes('Karting'), 'QA_OWNER_SPORTS_MISMATCH');
  assert.ok(Array.isArray(y.sports) && y.sports.includes('Futebol') && y.sports.includes('Karting'), 'QA_MEMBER_SPORTS_MISMATCH');
  log('[PASS] Both QA accounts confirm Futebol and Karting in the same private community');
  log('[PASS] QA community provisioning complete; no sessions were created');
}
if (require.main === module) {
  main().catch(e => {
    const message = typeof e?.message === 'string' && /^QA_[A-Z0-9_]+$/.test(e.message)
      ? e.message : 'QA_UNEXPECTED_OR_AMBIGUOUS_ERROR';
    console.error('[FAIL] ' + message + '; inspect QA communities before rerunning');
    process.exitCode = 1;
  });
}
module.exports = { main };
