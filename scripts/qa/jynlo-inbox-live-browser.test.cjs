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


test('read-only non-member check accepts only 403/404 and never parses chat bodies',async()=>{
  const {requireDenied}=require('./jynlo-inbox-live-browser.cjs');
  const seen=[];
  const deny=async(url,opts)=>{
    seen.push([url,opts.method]);
    assert.equal(opts.headers.Authorization,'Bearer fixture-token');
    assert.equal(opts.redirect,'error');
    return {status:403,json:()=>{throw Error('Must never inspect private chat!')}};
  };
  assert.equal(await requireDenied('community',7,'fixture-token',deny),true);
  assert.deepEqual(seen,[['https://api.d24sports.com/api/communities/7/messages','GET']]);
  assert.equal(await requireDenied('session',41,'fixture-token',async()=>({status:404})),true);
  for (const status of [200,401,500]) {
    await assert.rejects(()=>requireDenied('session',41,'fixture-token',
      async()=>({status})),/unexpected HTTP status/);
  }
  await assert.rejects(()=>requireDenied('community',0,'fixture-token',deny),
    /Invalid chat identifier/);
  await assert.rejects(()=>requireDenied('direct',7,'fixture-token',deny),
    /Invalid chat kind/);
});

test('public discoveries pick only non-member communities and future public nonparticipant sessions',()=>{
  const {firstAccessibleOutsiderCommunity,firstPublicOutsiderSession} =
    require('./jynlo-inbox-live-browser.cjs');
  const found=firstAccessibleOutsiderCommunity(
    {communities:[{id:7},{id:8},{id:9}]},[{id:7}],[{id:8}]);
  assert.equal(found.id,9);
  assert.equal(firstAccessibleOutsiderCommunity(
    {communities:[{id:7}]},[{id:7}],[]),null);
  const now=Date.now();
  const next=new Date(now+60_000).toISOString();
  const before=new Date(now-60_000).toISOString();
  const list=[
    {id:11,privateGame:false,status:'OPEN',gameDate:before},
    {id:12,privateGame:true,status:'OPEN',gameDate:next},
    {id:13,privateGame:false,status:'OPEN',gameDate:next},
    {id:14,privateGame:false,status:'OPEN',gameDate:next}
  ];
  assert.equal(firstPublicOutsiderSession(list,{
    created:[{id:13}],joined:[],waitlisted:[]
  }).id,14);
  assert.equal(firstPublicOutsiderSession(list,{
    created:[{id:13}],joined:[{id:14}],waitlisted:[]
  }),null);
  assert.throws(()=>firstPublicOutsiderSession({}, {created:[],joined:[]}),
    /Unexpected public session discovery shape/);
});


test('failure diagnostics only expose a stable stage and HTTP code',async()=>{
  const {safeQaCause,readOnlyStage} = require('./jynlo-inbox-live-browser.cjs');
  assert.equal(safeQaCause(Error('HTTP 500 em GET /api/communities/search?page=0')),
    'HTTP_500');
  assert.equal(safeQaCause(Error('Authorization check returned an unexpected HTTP status (200)')),
    'ACCESS_NOT_DENIED_HTTP_200');
  assert.equal(safeQaCause(Error('Unexpected public community discovery shape')),
    'UNEXPECTED_COMMUNITY_DISCOVERY_FORMAT');
  assert.equal(safeQaCause(Error('Authorization: Bearer hidden-qa-token')),
    'UNCLASSIFIED_CHECK_FAILURE');
  const messages=[],failures=[];
  await readOnlyStage('COMMUNITY_PUBLIC_DISCOVERY', async() => {
    throw Error('HTTP 503 em GET /api/communities/search?secret=do-not-expose');
  }, message=>messages.push(message),failures);
  assert.deepEqual(failures,['COMMUNITY_PUBLIC_DISCOVERY']);
  assert.deepEqual(messages,['[FAIL] COMMUNITY_PUBLIC_DISCOVERY: HTTP_503']);
  await readOnlyStage('SESSION_PUBLIC_DISCOVERY', async()=>{
    throw Error('Authorization check returned an unexpected HTTP status (200)');
  }, message=>messages.push(message),failures);
  assert.deepEqual(messages[1],'[FAIL] SESSION_PUBLIC_DISCOVERY: ACCESS_NOT_DENIED_HTTP_200');
  assert.equal(messages.join('').includes('do-not-expose'),false);
});
