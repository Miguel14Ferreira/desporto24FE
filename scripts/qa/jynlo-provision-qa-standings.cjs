#!/usr/bin/env node
'use strict';

// Controlled one-time synthetic standings fixture ONLY for the known private
// disposable QA community. This historical QA simulation is NOT a report for
// either of the future weekly sessions; no session state is changed.
const assert = require('node:assert/strict');
const API = 'https://api.d24sports.com';
const USERS = ['jynloteste01', 'jynloteste02'];
const COMMUNITY = 'JYNLO QA - Comunidade Privada de Testes';
const SEASON = 'JYNLO QA - Época Simulada 2026';
const ROUND = 'JYNLO QA - Jornada Simulada (NÃO REAL)';
const PLAYED_AT = '2026-11-01T12:00:00Z';
const validId = n => Number.isSafeInteger(n) && n > 0;

async function main({ fetchImpl = globalThis.fetch, report = console.log } = {}) {
  const secrets = [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2];
  assert.equal(process.env.JYNLO_QA_USERNAME_1, USERS[0], 'QA_OWNER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_USERNAME_2, USERS[1], 'QA_MEMBER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_STANDINGS_CONSENT,
    'QA_CREATE_SYNTHETIC_STANDINGS_ONCE', 'QA_CONSENT_REQUIRED');
  assert.ok(secrets.every(x => typeof x === 'string' && x.length > 0),
    'QA_PASSWORDS_MISSING');

  async function api(path, { token, body } = {}) {
    const login = path === '/api/auth/login';
    const allowed = login || path === '/api/communities/mine'
      || /^\/api\/communities\/[1-9]\d*\/competition$/.test(path)
      || /^\/api\/communities\/[1-9]\d*\/competition\/settings$/.test(path)
      || /^\/api\/communities\/[1-9]\d*\/seasons$/.test(path)
      || /^\/api\/communities\/[1-9]\d*\/rounds$/.test(path);
    assert.ok(allowed, 'QA_ENDPOINT_NOT_ALLOWED');
    const method = body === undefined ? 'GET'
      : path.endsWith('/competition/settings') ? 'PUT' : 'POST';
    assert.ok(method === 'GET' || (login && method === 'POST') ||
      (/^\/api\/communities\/[1-9]\d*\/(competition\/settings|seasons|rounds)$/.test(path)
      && (method === 'POST' || method === 'PUT')), 'QA_WRITE_NOT_ALLOWED');
    assert.ok(login ? token === undefined :
      typeof token === 'string' && token.length > 30, 'QA_AUTH_REQUIRED');
    const response = await fetchImpl(API + path, {
      method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json',
        ...(body === undefined ? {} : {'Content-Type':'application/json'}),
        ...(token ? {Authorization:'Bearer ' + token} : {}) },
      ...(body === undefined ? {} : {body: JSON.stringify(body)})
    });
    assert.ok(response.ok, 'QA_HTTP_' + response.status);
    return response.json();
  }
  async function login(username, password) {
    const r = await api('/api/auth/login',{body:{username,password}});
    assert.equal(r.profile?.username?.toLowerCase(),username,'QA_WRONG_IDENTITY');
    assert.ok(!r.mfaRequired && typeof r.token === 'string' && r.token.length > 30,
      'QA_LOGIN_INVALID');
    return r.token;
  }
  const [owner, member] = await Promise.all(USERS.map((u,i)=>login(u,secrets[i])));
  const [my, their] = await Promise.all([
    api('/api/communities/mine',{token:owner}),
    api('/api/communities/mine',{token:member})
  ]);
  assert.ok(Array.isArray(my) && Array.isArray(their),'QA_GROUP_LIST_INVALID');
  const matches = my.filter(c => c.name === COMMUNITY
    && c.ownerUsername?.toLowerCase() === USERS[0] && c.visibility === 'PRIVATE'
    && c.sports?.includes('Futebol'));
  assert.equal(matches.length, 1, 'QA_UNIQUE_PRIVATE_GROUP_REQUIRED');
  const group = matches[0];
  assert.ok(validId(group.id) && their.some(c=>c.id===group.id),
    'QA_BOTH_MEMBERS_REQUIRED');
  report('[PASS] Exclusive QA community verified before writes');

  let overview = await api('/api/communities/'+group.id+'/competition',{token:owner});
  assert.ok(overview && Array.isArray(overview.seasons) &&
    Array.isArray(overview.rounds), 'QA_OVERVIEW_INVALID');
  const seasons = overview.seasons.filter(s=>s.name===SEASON);
  assert.ok(seasons.length <= 1, 'QA_DUPLICATE_SEASON_ABORT');
  const rounds = overview.rounds.filter(r=>r.name===ROUND);
  assert.ok(rounds.length <= 1, 'QA_DUPLICATE_ROUND_ABORT');
  // Never modify a season/round that another fixture already owns.
  assert.ok(overview.seasons.every(s=>s.name===SEASON),
    'QA_UNEXPECTED_SEASON_ABORT');
  assert.ok(overview.rounds.every(r=>r.name===ROUND),
    'QA_UNEXPECTED_ROUND_ABORT');
  if (!overview.settings?.rankingsEnabled) {
    const settings=await api('/api/communities/'+group.id+'/competition/settings',
      {token:owner,body:{rankingsEnabled:true,winPoints:3,drawPoints:1,lossPoints:0}});
    assert.equal(settings.rankingsEnabled,true,'QA_SETTINGS_NOT_ENABLED');
    report('[PASS] Standings enabled only in private QA community');
  }
  let season=seasons[0];
  if (!season) {
    season=await api('/api/communities/'+group.id+'/seasons',{token:owner,
      body:{name:SEASON,startsAt:'2026-01-01T00:00:00Z',sport:'Futebol'}});
    assert.ok(validId(season.id) && season.name===SEASON && season.active,
      'QA_SEASON_CREATE_INVALID');
    report('[PASS] Created synthetic Futebol QA season');
  } else {
    assert.ok(validId(season.id) && season.active && season.sport==='Futebol',
      'QA_EXISTING_SEASON_INVALID');
    report('[PASS] Reused existing synthetic QA season');
  }
  if (!rounds.length) {
    const created=await api('/api/communities/'+group.id+'/rounds',{
      token:owner,body:{
        name:ROUND,playedAt:PLAYED_AT,sport:'Futebol',seasonId:season.id,
        entries:[
          {username:USERS[0],team:'A',result:'WIN',goals:0,assists:0,
            mvp:false,cleanSheet:false},
          {username:USERS[1],team:'B',result:'LOSS',goals:0,assists:0,
            mvp:false,cleanSheet:false}
        ]
      }
    });
    assert.ok(validId(created.id) && created.name===ROUND,'QA_ROUND_CREATE_INVALID');
    report('[PASS] Created one simulated QA round, unrelated to future sessions');
  } else {
    report('[PASS] Reused existing synthetic QA round');
  }
  overview=await api('/api/communities/'+group.id+'/competition',{token:owner});
  assert.ok(overview.settings?.rankingsEnabled,'QA_RANKINGS_NOT_ENABLED');
  assert.equal(overview.seasons.filter(s=>s.name===SEASON).length,1,
    'QA_SEASON_MISSING');
  assert.equal(overview.rounds.filter(r=>r.name===ROUND).length,1,
    'QA_ROUND_MISSING');
  const positions = new Map((overview.standings||[]).map(r=>[r.username?.toLowerCase(),r]));
  const one=positions.get(USERS[0]),two=positions.get(USERS[1]);
  assert.ok(one && two,'QA_STANDINGS_PLAYERS_MISSING');
  assert.equal(one.games,1,'QA_OWNER_GAMES_MISMATCH');
  assert.equal(one.wins,1,'QA_OWNER_WINS_MISMATCH');
  assert.equal(one.points,3,'QA_OWNER_POINTS_MISMATCH');
  assert.equal(two.games,1,'QA_MEMBER_GAMES_MISMATCH');
  assert.equal(two.losses,1,'QA_MEMBER_LOSSES_MISMATCH');
  assert.equal(two.points,0,'QA_MEMBER_POINTS_MISMATCH');
  const peerOverview=await api('/api/communities/'+group.id+'/competition',{token:member});
  assert.ok(peerOverview.rounds.some(r=>r.name===ROUND),
    'QA_MEMBER_CANNOT_VIEW_ROUND');
  report('[PASS] Synthetic standings: owner 3 points, member 0 points');
  report('[PASS] Both QA accounts can view rankings; future sessions unchanged');
}
if (require.main === module) main().catch(error=>{
  const reason=typeof error?.message==='string' && /^QA_[A-Z0-9_]+$/.test(error.message)
    ? error.message:'QA_UNEXPECTED_OR_AMBIGUOUS_WRITE';
  console.error('[FAIL] '+reason+'; inspect QA season before retrying any write');
  process.exitCode=1;
});
module.exports={main};
