#!/usr/bin/env node
'use strict';
// One synthetic Karting race and per-place championship scoring, only in the
// pre-authorized private Jynlo QA Futebol+Karting community. No real events,
// venues, sessions, or user results touched. Ambiguous writes are never retried.
const assert=require('node:assert/strict');
const API='https://api.d24sports.com';
const USERS=['jynloteste01','jynloteste02'];
const GROUP='JYNLO QA - Multidesporto Futebol e Karting';
const SEASON='JYNLO QA - Karting Simulado 2026';
const ROUND='JYNLO QA - Corrida Karting SIMULADA (NÃO REAL)';
const safeId=id=>Number.isSafeInteger(id)&&id>0;
const ok=(v,code)=>assert.ok(v,code);

async function main({fetchImpl=globalThis.fetch,report=console.log}={}) {
  const passwords=[process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2];
  assert.equal(process.env.JYNLO_QA_USERNAME_1,USERS[0],'QA_OWNER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_USERNAME_2,USERS[1],'QA_MEMBER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_KARTING_CONSENT,
    'QA_CREATE_SYNTHETIC_KARTING_RACE_ONCE','QA_CONSENT_REQUIRED');
  ok(passwords.every(x=>typeof x==='string'&&x.length>0),'QA_PASSWORDS_MISSING');

  async function api(path,{token,body}={}) {
    const login=path==='/api/auth/login';
    ok(login||path==='/api/communities/mine'
      ||/^\/api\/communities\/[1-9]\d*\/competition(?:\?seasonId=[1-9]\d*)?$/.test(path)
      ||/^\/api\/communities\/[1-9]\d*\/competition\/settings$/.test(path)
      ||/^\/api\/communities\/[1-9]\d*\/seasons$/.test(path)
      ||/^\/api\/communities\/[1-9]\d*\/seasons\/[1-9]\d*\/race-rules$/.test(path)
      ||/^\/api\/communities\/[1-9]\d*\/rounds$/.test(path),'QA_ENDPOINT_NOT_ALLOWED');
    const method=body===undefined?'GET':(path.endsWith('/competition/settings')
      ||path.endsWith('/race-rules'))?'PUT':'POST';
    ok(method==='GET'||login||/^\/api\/communities\/[1-9]\d*\/(competition\/settings|seasons|seasons\/[1-9]\d*\/race-rules|rounds)$/.test(path),
      'QA_WRITE_NOT_ALLOWED');
    ok(login?!token:typeof token==='string'&&token.length>30,'QA_AUTH_INVALID');
    const response=await fetchImpl(API+path,{method,redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(20000),headers:{Accept:'application/json',
      ...(body===undefined?{}:{'Content-Type':'application/json'}),
      ...(token?{Authorization:'Bearer '+token}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    ok(response.ok,'QA_HTTP_'+response.status);
    return response.json();
  }
  async function login(username,password){
    const r=await api('/api/auth/login',{body:{username,password}});
    assert.equal(r.profile?.username?.toLowerCase(),username,'QA_LOGIN_IDENTITY');
    ok(typeof r.token==='string'&&r.token.length>30&&!r.mfaRequired,'QA_LOGIN_FAILED');
    return r.token;
  }
  const [owner,member]=await Promise.all(USERS.map((u,i)=>login(u,passwords[i])));
  const [mine,other]=await Promise.all([
    api('/api/communities/mine',{token:owner}),
    api('/api/communities/mine',{token:member})]);
  ok(Array.isArray(mine)&&Array.isArray(other),'QA_GROUPS_INVALID');
  const matches=mine.filter(g=>g.name===GROUP&&g.visibility==='PRIVATE'
    &&g.ownerUsername?.toLowerCase()===USERS[0]
    &&g.sports?.includes('Futebol')&&g.sports?.includes('Karting'));
  assert.equal(matches.length,1,'QA_UNIQUE_MULTISPORT_GROUP_REQUIRED');
  const id=matches[0].id;
  ok(safeId(id)&&other.some(g=>g.id===id&&g.visibility==='PRIVATE'),
    'QA_BOTH_MEMBERS_REQUIRED');
  report('[PASS] Verified private Futebol and Karting QA group and two accounts');

  const endpoint='/api/communities/'+id;
  let overview=await api(endpoint+'/competition',{token:owner});
  ok(Array.isArray(overview.seasons)&&Array.isArray(overview.rounds)
    &&(overview.sportStandings===undefined || Array.isArray(overview.sportStandings)),
    'QA_COMPETITION_INVALID');
  const seasonMatches=overview.seasons.filter(s=>s.name===SEASON);
  const roundMatches=overview.rounds.filter(r=>r.name===ROUND);
  ok(seasonMatches.length<=1&&roundMatches.length<=1,'QA_DUPLICATE_FIXTURE_ABORT');
  ok(overview.seasons.every(s=>s.name===SEASON)&&overview.rounds.every(r=>r.name===ROUND),
    'QA_UNKNOWN_COMPETITION_DATA_ABORT');
  if(!overview.settings?.rankingsEnabled){
    const settings=await api(endpoint+'/competition/settings',{token:owner,
      body:{rankingsEnabled:true,winPoints:3,drawPoints:1,lossPoints:0}});
    assert.equal(settings.rankingsEnabled,true,'QA_ENABLE_RANKINGS_FAILED');
    report('[PASS] Enabled rankings exclusively in private QA group');
  }
  let season=seasonMatches[0];
  if(!season){
    season=await api(endpoint+'/seasons',{token:owner,
      body:{name:SEASON,startsAt:'2026-01-01T00:00:00Z',sport:'Karting'}});
    ok(safeId(season.id)&&season.name===SEASON&&season.active
      &&(season.sport===undefined||season.sport===null||season.sport==='Karting'),
      'QA_CREATED_SEASON_INVALID');
    report('[PASS] Created synthetic Karting-only season');
  } else {
    ok(safeId(season.id)&&season.active
      &&(season.sport===undefined||season.sport===null||season.sport==='Karting'),
      'QA_EXISTING_SEASON_INVALID');
    report('[PASS] Reused existing synthetic Karting season');
  }
  // An explicit scoring policy, not a guessed federation default.
  const selected=await api(endpoint+'/competition?seasonId='+season.id,{token:owner});
  const raceGroup=(selected.raceStandings||[]).find(r=>r.sport==='Karting');
  if(!raceGroup?.rule){
    const rule=await api(endpoint+'/seasons/'+season.id+'/race-rules',{
      token:owner,body:{sport:'Karting',pointsByPlace:'25,18,15'}});
    assert.equal(rule.sport,'Karting','QA_RACE_RULE_FAILED');
    assert.deepEqual(rule.pointsByPlace,[25,18,15],'QA_RACE_RULE_POINTS_INVALID');
    report('[PASS] Configured season-local Karting points: 25, 18, 15');
  } else {
    assert.deepEqual(raceGroup.rule.pointsByPlace,[25,18,15],
      'QA_UNEXPECTED_RACE_POINTS');
    report('[PASS] Reused existing Karting race scoring policy');
  }
  if(!roundMatches.length){
    const round=await api(endpoint+'/rounds',{token:owner,body:{
      name:ROUND,playedAt:'2026-11-01T12:00:00Z',
      sport:'Karting',seasonId:season.id,
      entries:[
        {username:USERS[0],result:'DRAW',finishPosition:2,
         elapsedSeconds:610.750,bestLapSeconds:60.125,lapsCompleted:10,
         goals:0,assists:0,mvp:false,cleanSheet:false},
        {username:USERS[1],result:'DRAW',finishPosition:1,
         elapsedSeconds:605.125,bestLapSeconds:59.950,lapsCompleted:10,
         goals:0,assists:0,mvp:false,cleanSheet:false}
      ]
    }});
    ok(safeId(round.id)&&round.name===ROUND&&round.sport==='Karting',
      'QA_CREATED_RACE_INVALID');
    report('[PASS] Created one synthetic Karting race with positions and lap times');
  } else {
    report('[PASS] Reused existing Karting synthetic race');
  }

  const [ownerOverview,memberOverview]=await Promise.all([
    api(endpoint+'/competition?seasonId='+season.id,{token:owner}),
    api(endpoint+'/competition?seasonId='+season.id,{token:member})
  ]);
  for(const overview of [ownerOverview,memberOverview]){
    assert.equal(overview.rounds.filter(r=>r.name===ROUND).length,1,
      'QA_RACE_NOT_VISIBLE');
    const kart=overview.raceStandings?.find(g=>g.sport==='Karting');
    ok(kart&&kart.rule?.pointsByPlace?.join(',')==='25,18,15',
      'QA_RACE_SCORING_MISSING');
    const ranking=new Map(kart.standings.map(x=>[x.username?.toLowerCase(),x]));
    const first=ranking.get(USERS[1]),second=ranking.get(USERS[0]);
    ok(first&&second,'QA_RACE_DRIVERS_MISSING');
    assert.equal(first.position,1,'QA_FIRST_PLACE_INVALID');
    assert.equal(first.championshipPoints,25,'QA_FIRST_POINTS_INVALID');
    assert.equal(second.position,2,'QA_SECOND_PLACE_INVALID');
    assert.equal(second.championshipPoints,18,'QA_SECOND_POINTS_INVALID');
    const matchGroups=overview.sportStandings||[];
    ok(!matchGroups.some(g=>g.sport==='Karting'),
      'QA_KARTING_HAS_FOOTBALL_STANDINGS');
  }
  report('[PASS] Both QA identities see Karting P1=25 and P2=18, not Football W/D/L');
  report('[PASS] Synthetic result is isolated; no real or future session changed');
}
if(require.main===module)main().catch(e=>{
  const msg=typeof e?.message==='string'&&/^QA_[A-Z0-9_]+$/.test(e.message)
    ?e.message:'QA_AMBIGUOUS_OR_UNEXPECTED_FAILURE';
  console.error('[FAIL] '+msg+'; inspect QA data before retrying');
  process.exitCode=1;
});
module.exports={main};
