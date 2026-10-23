'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {upcoming,authenticate,request}=require('./jynlo-inbox-live-browser.cjs');

test('session eligibility closes precisely at kick-off',()=>{
  const now=Date.parse('2026-10-23T12:00:00Z');
  const s={id:41,status:'OPEN',gameDate:'2026-10-23T12:05:00Z'};
  assert.equal(upcoming(s,now),true);
  assert.equal(upcoming({...s,gameDate:'2026-10-23T12:00:00Z'},now),false);
  assert.equal(upcoming({...s,gameDate:null},now),false);
  for(const status of ['COMPLETED','CANCELLED','NOT_OCCURRED'])
    assert.equal(upcoming({...s,status},now),false);
});

test('only the expected QA usernames can authenticate, at the fixed origin',async()=>{
  let calls=0;
  const fake=async(url,options)=>{
    calls++;
    assert.equal(url,'https://api.d24sports.com/api/auth/login');
    assert.equal(options.method,'POST');
    assert.equal(options.redirect,'error');
    assert.deepEqual(JSON.parse(options.body),{
      username:'jynloteste01',password:'private-fixture'
    });
    return {ok:true,json:async()=>({token:'token-123456789-123456789-123456789',
      profile:{username:'jynloteste01'}})};
  };
  assert.ok(await authenticate('jynloteste01','private-fixture',fake));
  assert.equal(calls,1);
  await assert.rejects(()=>authenticate('other','private-fixture',fake),/credenciais QA/i);
  assert.equal(calls,1);
});

test('MFA is never bypassed; API errors never disclose credentials or tokens',async()=>{
  await assert.rejects(()=>authenticate('jynloteste02','top-secret',async()=>({
    ok:true,json:async()=>({mfaRequired:true})
  })),e=>{
    assert.match(e.message,/MFA/);
    assert.equal(e.message.includes('top-secret'),false);
    return true;
  });
  await assert.rejects(()=>request('/api/sessions/mine',{token:'test-token',fetchImpl:async()=>{
    return {ok:false,status:403,json:async()=>({secret:'private-data'})};
  }}),e=>{
    assert.match(e.message,/HTTP 403/);
    assert.equal(e.message.includes('test-token'),false);
    assert.equal(e.message.includes('private-data'),false);
    return true;
  });
  await assert.rejects(()=>request('https://not-our-api.test/path'),/Caminho inválido/);
});
