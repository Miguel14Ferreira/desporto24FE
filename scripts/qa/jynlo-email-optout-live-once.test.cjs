'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {makeRunner} = require('./jynlo-email-optout-live-once.cjs');

const QA=['jynloteste01','jynloteste02'];
function fakeApi({badEmail=false,inviteFailure=false,insufficientQuota=false,
                  createFault=null,deleteFailure=false}={}) {
  const state={calls:[], prefs:{inAppEnabled:true,emailEnabled:false,
    disabledInAppTypes:['CHAT_MESSAGE'],disabledEmailTypes:['COMMUNITY_INVITE','FRIEND_REQUEST']},
    created:null,invites:[],next:1001,deleted:false,signals:[]};
  async function fetchImpl(url,options) {
    const p=new URL(url);
    assert.equal(p.origin,'https://api.d24sports.com');
    assert.equal(options.redirect,'error');
    const method=options.method,route=p.pathname;
    state.calls.push(method+' '+route);
    const owner=options.headers.Authorization?.endsWith('-0') ? 0:1;
    const body=options.body?JSON.parse(options.body):null;
    let response,status=200;
    if(route==='/api/auth/login') {
      const i=QA.indexOf(body.username);
      assert.notEqual(i,-1);
      assert.equal(body.password,'pw'+i);
      response={token:'fixture-realistic-long-enough-jwt-for-tests-'+i,
        mfaRequired:false,profile:{username:QA[i]}};
    } else if(route==='/api/profile/me') {
      response={username:QA[owner],email:owner===1?
        (badEmail?'different@example.org':'desporto24app+jynloqa02@gmail.com'):
        'owner@example.test'};
    } else if(route==='/api/communities/creation-quota') {
      response={owned:0,limit:5,canCreate:!insufficientQuota};
    } else if(route==='/api/communities/mine') {
      response=state.created&&!state.deleted?[state.created]:[];
    } else if(route==='/api/communities/invites/me') {
      response=state.invites.filter(i=>i.status==='PENDING').map(i=>
        ({id:i.id,communityId:state.created?.id}));
    } else if(route==='/api/notifications/me/preferences') {
      if(method==='PUT')state.prefs=structuredClone(body);
      response=structuredClone(state.prefs);
    } else if(route==='/api/communities' && method==='POST') {
      if(createFault==='not-created') throw Error('creation unavailable');
      state.created={id:3515,name:body.name,visibility:'PRIVATE',ownerUsername:QA[0],memberCount:1,
        members:[{username:QA[0]}]};response=state.created;
      if(createFault==='lost-response') throw Error('response lost');
      if(createFault==='malformed-response') response={id:state.created.id,name:state.created.name};
      if(createFault==='wrong-owner') response={...state.created,ownerUsername:'unexpected'};
    } else if(route==='/api/communities/3515') {
      response=state.created;
    } else if(route==='/api/communities/3515/invites' && method==='POST') {
      assert.equal(body.username,QA[1]);
      assert.equal(state.prefs.inAppEnabled,false);
      state.signals.push(state.prefs.disabledEmailTypes.includes('COMMUNITY_INVITE')?'muted':'allowed');
      if(inviteFailure&&state.signals.length===2) return {ok:false,status:503,json:async()=>({})};
      const n={id:state.next++,status:'PENDING'};state.invites.push(n);
      response={id:n.id,communityId:3515};
    } else if(route.startsWith('/api/communities/invites/') &&route.endsWith('/reject')) {
      const id=Number(route.split('/')[4]);
      const invite=state.invites.find(i=>i.id===id&&i.status==='PENDING');
      assert.ok(invite);invite.status='REJECTED';status=204;response=null;
    } else if(route==='/api/communities/3515/delete'&&method==='POST') {
      assert.equal(body.name,state.created.name);
      assert.equal(state.prefs.inAppEnabled,true);
      assert.equal(state.prefs.emailEnabled,false);
      if(deleteFailure) return {ok:false,status:503,json:async()=>({})};
      state.deleted=true;state.invites=[];status=204;response=null;
    } else throw Error('Unexpected test route '+method+' '+route);
    return {ok:status<300,status,json:async()=>response};
  }
  const logs=[];
  const run=({consent='QA_ONLY_SEND_AND_CLEAN',passwords=['pw0','pw1']}={})=>
    makeRunner({fetchImpl,output:s=>logs.push(s),marker:()=> 'known-qa-marker'})
      .run({consent,passwords});
  return {run,state,logs};
}
test('two QA-only invites: first muted, then enabled, both rejected; cleanup and original prefs',async()=>{
  const f=fakeApi();
  const x=await f.run();
  assert.equal(x.restored,true);
  assert.equal(x.deleted,true);
  assert.deepEqual(f.state.signals,['muted','allowed']);
  assert.equal(f.state.deleted,true);
  assert.deepEqual(f.state.prefs,{inAppEnabled:true,emailEnabled:false,
    disabledInAppTypes:['CHAT_MESSAGE'],disabledEmailTypes:['COMMUNITY_INVITE','FRIEND_REQUEST']});
  assert.ok(f.logs.some(l=>l.startsWith('[QA_MARKER] JYNLO QA EMAIL known-qa-marker')));
  assert.equal(f.state.calls.filter(c=>c==='POST /api/communities').length,1);
  assert.equal(f.state.calls.filter(c=>c==='POST /api/communities/3515/invites').length,2);
  assert.equal(f.state.calls.filter(c=>c.endsWith('/reject')).length,2);
});
test('no consent: no login or mutation',async()=>{
  const f=fakeApi();
  await assert.rejects(()=>f.run({consent:''}),/consent missing/);
  assert.deepEqual(f.state.calls,[]);
});
test('missing credential: no network',async()=>{
  const f=fakeApi();
  await assert.rejects(()=>f.run({passwords:['pw0','']}),/passwords absent/);
  assert.deepEqual(f.state.calls,[]);
});
test('different email: stop before any preference or community writes',async()=>{
  const f=fakeApi({badEmail:true});
  await assert.rejects(()=>f.run(),/allowlisted QA email/);
  assert.equal(f.state.calls.some(c=>c.startsWith('PUT ')),false);
  assert.equal(f.state.calls.includes('POST /api/communities'),false);
});
test('quota failure: stop without writes',async()=>{
  const f=fakeApi({insufficientQuota:true});
  await assert.rejects(()=>f.run(),/lacks room/);
  assert.equal(f.state.calls.some(c=>c.startsWith('PUT ')),false);
});
test('allowed invitation error: never retry, restore prefs and delete QA group',async()=>{
  const f=fakeApi({inviteFailure:true});
  await assert.rejects(()=>f.run(),/HTTP 503/);
  assert.deepEqual(f.state.signals,['muted','allowed']);
  assert.equal(f.state.deleted,true);
  assert.equal(f.state.prefs.emailEnabled,false);
  assert.equal(f.state.calls.filter(c=>c==='POST /api/communities/3515/invites').length,2);
});

test('creation committed but response lost: recover isolated group, delete once, restore',async()=>{
  const f=fakeApi({createFault:'lost-response'});
  await assert.rejects(()=>f.run(),/Network outcome unknown/);
  assert.equal(f.state.deleted,true);
  assert.deepEqual(f.state.signals,[]);
  assert.equal(f.state.prefs.emailEnabled,false);
  assert.equal(f.state.calls.filter(s=>s==='POST /api/communities').length,1);
  assert.equal(f.state.calls.filter(s=>s.endsWith('/invites')).length,0);
  assert.ok(f.logs.some(s=>s.includes('Recovered isolated QA community')));
});
test('malformed creation response: verify ownership from fresh detail before deleting',async()=>{
  const f=fakeApi({createFault:'malformed-response'});
  await assert.rejects(()=>f.run(),/unexpected privacy, owner or membership/);
  assert.equal(f.state.deleted,true);
  assert.deepEqual(f.state.signals,[]);
  assert.equal(f.state.prefs.emailEnabled,false);
});
test('wrong owner returned: no invitation and no unsafe deletion',async()=>{
  const f=fakeApi({createFault:'wrong-owner'});
  await assert.rejects(()=>f.run(),/unexpected privacy, owner or membership/);
  assert.equal(f.state.deleted,true);
  assert.deepEqual(f.state.signals,[]);
  assert.ok(f.state.calls.includes('GET /api/communities/3515'));
});
test('creation never committed: no blind retry, restore and report uncertain outcome',async()=>{
  const f=fakeApi({createFault:'not-created'});
  await assert.rejects(()=>f.run(),/Network outcome unknown/);
  assert.equal(f.state.deleted,false);
  assert.equal(f.state.prefs.emailEnabled,false);
  assert.deepEqual(f.state.signals,[]);
  assert.ok(f.logs.some(s=>s.includes('Community creation outcome uncertain')));
});
test('deletion failure is reported and no deletion or invitation is retried',async()=>{
  const f=fakeApi({deleteFailure:true});
  await assert.rejects(()=>f.run(),/QA cleanup failed/);
  assert.equal(f.state.deleted,false);
  assert.equal(f.state.prefs.emailEnabled,false);
  assert.equal(f.state.calls.filter(s=>s==='POST /api/communities/3515/delete').length,1);
  assert.equal(f.state.calls.filter(s=>s==='POST /api/communities/3515/invites').length,2);
});
