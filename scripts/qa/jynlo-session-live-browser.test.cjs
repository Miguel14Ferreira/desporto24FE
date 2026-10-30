'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {consent,fixture,candidateId,createdId,joinedState,status,untilKickoff}=
  require('./jynlo-session-live-browser.cjs');

test('explicit opt-in and private isolated non-recurring fixture',()=>{
  assert.throws(()=>consent('yes'),/QA_EXPLICIT_CONSENT_REQUIRED/);
  consent('PRIVATE_QA_SESSION_PERSISTS');
  const f=fixture(Date.parse('2026-10-23T19:00:00Z'),
    'synthetic-private-session-password');
  assert.equal(f.gameDate,'2026-10-23T19:03:00.000Z');
  assert.equal(f.privateGame,true);assert.equal(f.maxParticipants,2);
  assert.equal(f.venueId,null);assert.equal(f.communityId,null);
  assert.equal(f.recurrence,'NONE');assert.equal(f.externalConfirmedParticipants,0);
  assert.match(f.address,/TESTE PRIVADO/);
});
test('rejects fixture not owned by QA and unexpected join state',()=>{
  const f={id:7,privateGame:true,maxParticipants:2,
    creatorUsername:'jynloteste01',gameDate:'2026-10-23T19:03:00Z'};
  assert.equal(createdId(f,'2026-10-23T19:03:00.000Z'),7);
  assert.throws(()=>createdId({...f,privateGame:false},f.gameDate),
    /QA_CREATE_RESPONSE_MISMATCH/);
  assert.throws(()=>createdId({...f,id:null},f.gameDate),
    /QA_CREATE_ID_MISSING/);
  assert.throws(()=>createdId({...f,creatorUsername:'stranger'},f.gameDate),
    /QA_CREATE_RESPONSE_MISMATCH/);
  assert.equal(joinedState({state:'PARTICIPANT'}),true);
  assert.equal(joinedState({state:'WAITLISTED'}),false);
});
test('late send status-only API and cancel never retry on error',async()=>{
  let calls=0;
  const fake=async(url,options)=>{
    calls++;
    assert.match(url,/^https:\/\/api\.d24sports\.com\/api\/sessions\/7\/messages$/);
    assert.equal(options.method,'POST');
    assert.equal(options.headers.Authorization,'Bearer qa-token');
    assert.equal(JSON.parse(options.body).body,'fixture-marker');
    return {status:409};
  };
  assert.equal(await status('/api/sessions/7/messages','qa-token',
    {method:'POST',body:{body:'fixture-marker'},fetchImpl:fake}),409);
  assert.equal(calls,1);
  await assert.rejects(()=>status('/api/communities/7/messages','qa-token',
    {fetchImpl:fake}),/QA_UNEXPECTED_ENDPOINT/);
  assert.equal(calls,1);
  await assert.rejects(()=>status('/api/sessions/7/cancel','qa-token',
    {method:'POST',fetchImpl:async()=>{calls++;throw Error('hidden-token');}}),
    /QA_NETWORK_AMBIGUOUS_WRITE/);
  assert.equal(calls,2);
});
test('kickoff check uses one bounded clock wait',async()=>{
  let wait=0;
  await untilKickoff('2026-10-23T19:00:02Z',
    ()=>Date.parse('2026-10-23T19:00:00Z'),async n=>{wait=n;});
  assert.equal(wait,3800);
  await assert.rejects(()=>untilKickoff('2030-10-23T19:00:00Z',
    ()=>Date.parse('2026-10-23T19:00:00Z')),/QA_KICKOFF_WINDOW_INVALID/);
});

test('capture created session id before validating fields for targeted cleanup',()=>{
  const incomplete={id:991,privateGame:false,maxParticipants:2,creatorUsername:'jynloteste01',
    gameDate:'2026-10-23T19:03:00Z'};
  assert.equal(candidateId(incomplete),991);
  assert.throws(()=>createdId(incomplete,'2026-10-23T19:03:00Z'),
    /QA_CREATE_RESPONSE_MISMATCH/);
  assert.equal(candidateId({id:null}),null);
  assert.equal(candidateId({id:-3}),null);
  assert.equal(candidateId({id:1.2}),null);
});
