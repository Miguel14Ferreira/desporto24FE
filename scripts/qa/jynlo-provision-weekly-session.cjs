#!/usr/bin/env node
'use strict';
// One-time live QA fixture; only two disposable users and one known private group.
// The only writes are creating a private two-occurrence series and joining the
// first occurrence. Unknown/ambiguous writes are NEVER retried automatically.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const API = 'https://api.d24sports.com';
const OWNER = 'jynloteste01', MEMBER = 'jynloteste02';
const GROUP = 'JYNLO QA - Comunidade Privada de Testes';
const MARKER = 'JYNLO QA - SESSAO PRIVADA - NAO E EVENTO REAL';
const safeId = id => Number.isSafeInteger(id) && id > 0;
const ok = (v, code) => assert.ok(v, code);

async function main({fetchImpl=globalThis.fetch, report=console.log}={}) {
  const [p1,p2]=[process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2];
  ok(p1 && p2 && p1.length && p2.length,'QA_CREDENTIALS_MISSING');
  assert.equal(process.env.JYNLO_QA_USERNAME_1, OWNER, 'QA_OWNER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_USERNAME_2, MEMBER, 'QA_MEMBER_NOT_ALLOWED');
  assert.equal(process.env.JYNLO_QA_WEEKLY_SESSION_CONSENT,
    'QA_CREATE_PRIVATE_WEEKLY_SERIES_ONCE', 'QA_EXPLICIT_CONSENT_MISSING');
  async function api(path,{token,body}={}) {
    const login=path==='/api/auth/login';
    ok(login || path==='/api/communities/mine' ||
      /^\/api\/communities\/[1-9]\d*\/sessions$/.test(path) ||
      path==='/api/sessions' ||
      /^\/api\/sessions\/[1-9]\d*$/.test(path) ||
      /^\/api\/sessions\/[1-9]\d*\/series$/.test(path) ||
      /^\/api\/sessions\/[1-9]\d*\/join$/.test(path),'QA_ENDPOINT_NOT_ALLOWED');
    const method=body===undefined?'GET':'POST';
    ok(method==='GET' || login || path==='/api/sessions'
      || /^\/api\/sessions\/[1-9]\d*\/join$/.test(path), 'QA_WRITE_NOT_ALLOWED');
    ok(login ? !token : typeof token==='string'&&token.length>30,'QA_AUTH_REQUIRED');
    const response=await fetchImpl(API+path,{
      method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),
      headers:{Accept:'application/json',
        ...(body===undefined?{}:{'Content-Type':'application/json'}),
        ...(token?{Authorization:'Bearer '+token}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    ok(response.ok,'QA_HTTP_'+response.status);
    return response.status===204?{}:response.json();
  }
  async function login(user,pass){
    const x=await api('/api/auth/login',{body:{username:user,password:pass}});
    assert.equal(x.profile?.username?.toLowerCase(),user,'QA_LOGIN_IDENTITY_MISMATCH');
    ok(!x.mfaRequired&&typeof x.token==='string'&&x.token.length>30,'QA_LOGIN_INVALID');
    return x.token;
  }
  const [owner,member]=await Promise.all([login(OWNER,p1),login(MEMBER,p2)]);
  const mine=await api('/api/communities/mine',{token:owner});
  ok(Array.isArray(mine),'QA_COMMUNITIES_INVALID');
  const matches=mine.filter(c=>c.name===GROUP&&c.ownerUsername?.toLowerCase()===OWNER);
  assert.equal(matches.length,1,'QA_UNIQUE_GROUP_REQUIRED');
  const group=matches[0];
  ok(safeId(group.id)&&group.visibility==='PRIVATE'&&group.sports?.includes('Futebol'),
    'QA_PRIVATE_FOOTBALL_GROUP_REQUIRED');
  const peerGroups=await api('/api/communities/mine',{token:member});
  ok(Array.isArray(peerGroups)&&peerGroups.some(c=>c.id===group.id&&c.visibility==='PRIVATE'),
    'QA_MEMBER_NOT_IN_GROUP');
  report('[PASS] Private QA Futebol group belongs to both disposable accounts');

  const existing=await api('/api/communities/'+group.id+'/sessions',{token:owner});
  ok(Array.isArray(existing)&&existing.length<250,'QA_SESSIONS_LIST_INVALID');
  // A uniquely identifiable QA fixture can be safely reused after interruption.
  const candidates=existing.filter(s=>s.communityId===group.id&&
    s.sport==='Futebol'&&s.privateGame===true&&s.recurrenceSeriesId);
  const verified=[];
  for(const s of candidates.slice(0,30)){
    ok(safeId(s.id),'QA_SESSION_ID_INVALID');
    const detail=await api('/api/sessions/'+s.id,{token:owner});
    if(detail.address===MARKER&&detail.creatorUsername?.toLowerCase()===OWNER
      &&detail.communityId===group.id) verified.push(detail);
  }
  const seriesIds=new Set(verified.map(x=>x.recurrenceSeriesId));
  ok(seriesIds.size<=1,'QA_MULTIPLE_SERIES_ABORT');
  let first;
  // Stable password generated from existing protected QA secrets; never persisted or logged.
  const password=createHash('sha256').update('JYNLO_QA_WEEKLY_SESSION_v1\0'+p1+'\0'+p2)
    .digest('hex');
  if(verified.length){
    first=verified.sort((a,b)=>Date.parse(a.gameDate)-Date.parse(b.gameDate))[0];
    report('[PASS] Previously created QA recurring series reused');
  }else{
    // Do not create a new series when another unknown QA session already exists.
    ok(existing.length===0,'QA_EXISTING_SESSIONS_REQUIRE_REVIEW');
    const kickoff=new Date(Date.now()+14*24*60*60*1000);
    kickoff.setUTCHours(18,0,0,0);
    const created=await api('/api/sessions',{token:owner,body:{
      sport:'Futebol',city:'Lisboa',address:MARKER,
      gameDate:kickoff.toISOString(),maxParticipants:2,minParticipants:2,
      priceAmount:0,privateGame:true,password,
      latitude:null,longitude:null,communityId:group.id,venueId:null,
      recurrence:'WEEKLY',recurrenceOccurrences:2,
      recurrenceTimeZone:'Europe/Lisbon',additionalWeeklyGameDates:[],
      externalConfirmedParticipants:0,registrationOpeningMode:'IMMEDIATE',
      communityShareIds:[],seasonCompetitionCommunityId:null,
      confirmActivateRankings:false
    }});
    ok(safeId(created.id),'QA_CREATE_SESSION_ID_INVALID');
    ok(created.privateGame===true&&created.communityId===group.id
      &&created.creatorUsername?.toLowerCase()===OWNER
      &&created.recurrenceSeriesId,'QA_CREATED_SESSION_CONTRACT_MISMATCH');
    first=created;
    report('[PASS] Created two future weekly private QA sessions (one series)');
  }
  ok(safeId(first.id)&&first.recurrenceSeriesId,'QA_FIRST_SESSION_INVALID');
  const series=await api('/api/sessions/'+first.id+'/series',{token:owner});
  ok(Array.isArray(series),'QA_SERIES_INVALID');
  const own=series.filter(s=>s.recurrenceSeriesId===first.recurrenceSeriesId
    &&s.communityId===group.id);
  assert.equal(own.length,2,'QA_WEEKLY_TWO_OCCURRENCES_REQUIRED');
  ok(own.every(s=>s.privateGame&&s.audience==='COMMUNITY_ONLY'),
    'QA_SERIES_NOT_PRIVATE');
  const d=own.map(x=>Date.parse(x.gameDate)).sort((a,b)=>a-b);
  ok(d.every(Number.isFinite)&&d[1]-d[0]>6*86400000&&d[1]-d[0]<8*86400000,
    'QA_SERIES_NOT_WEEKLY');
  report('[PASS] Two private weekly QA occurrences verified');
  const firstDetail=await api('/api/sessions/'+first.id,{token:member});
  assert.equal(firstDetail.communityId,group.id,'QA_MEMBER_VIEW_WRONG_GROUP');
  if(firstDetail.joined){
    report('[PASS] Second QA account already joined the first session');
  }else{
    // One join POST at most, no retries after any ambiguous response.
    const result=await api('/api/sessions/'+first.id+'/join',{token:member,body:{password}});
    assert.equal(result.state,'PARTICIPANT','QA_JOIN_FAILED');
    report('[PASS] Second QA account joined the first private occurrence');
  }
  const after=await api('/api/sessions/'+first.id,{token:member});
  ok(after.joined===true&&after.participantCount===2,'QA_JOIN_NOT_CONFIRMED');
  report('[PASS] First QA game has two confirmed participant places');
  report('[PASS] Weekly QA group fixture ready; no results or rankings modified');
}
if(require.main===module){
  main().catch(e=>{
    const msg=typeof e?.message==='string'&&/^QA_[A-Z0-9_]+$/.test(e.message)?
      e.message:'QA_AMBIGUOUS_ERROR';
    console.error('[FAIL] '+msg+'; inspect group before any further write');
    process.exitCode=1;
  });
}
module.exports={main};
