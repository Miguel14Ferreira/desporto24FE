#!/usr/bin/env node
'use strict';
// One-use browser QA: only allowlisted private QA group / identities.
// All new test records are removed in finally, with no screenshots or tokens logged.
const assert=require('node:assert/strict');
const {authenticate}=require('./jynlo-inbox-live-browser.cjs');
const USERS=['jynloteste01','jynloteste02'];
const GROUP='JYNLO QA - Comunidade Privada de Testes';
const API='https://api.d24sports.com',SITE='https://d24sports.com';
const valid=x=>Number.isSafeInteger(x)&&x>0;
async function run(){
  assert.equal(process.env.JYNLO_QA_TEAM_INVITE_ONCE,'DISPOSABLE_QA_ONLY','CONSENT_GUARD');
  assert.deepEqual([process.env.JYNLO_QA_USERNAME_1,process.env.JYNLO_QA_USERNAME_2],
    USERS,'IDENTITY_ALLOWLIST');
  const passwords=[process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2];
  assert.ok(passwords.every(p=>typeof p==='string'&&p.length>0),'QA_PASSWORDS_MISSING');
  const tokens=await Promise.all(USERS.map((u,i)=>authenticate(u,passwords[i],fetch)));
  let communityId=null,tournamentId=null,teamId=null;
  async function api(method,path,token,body,allow404=false){
    assert.ok(tokens.includes(token),'TOKEN_SCOPE');
    assert.ok(['GET','POST','PUT','DELETE'].includes(method),'METHOD_SCOPE');
    const base=valid(communityId)?'/api/communities/'+communityId+'/tournaments':null;
    const scope=base&&valid(tournamentId)?base+'/'+tournamentId:null;
    const mine=method==='GET'&&path==='/api/communities/mine';
    const allowed=mine||(base&&(
      (method==='GET'&&path===base+'?page=0')||
      (method==='POST'&&path===base&&token===tokens[0])||
      (scope&&((method==='DELETE'&&path===scope&&token===tokens[0])||
        (method==='GET'&&path===scope)||
        (method==='GET'&&path===scope+'/teams')||
        (method==='POST'&&path===scope+'/teams'&&token===tokens[0])))
    ));
    assert.ok(allowed,'ENDPOINT_NOT_ALLOWLISTED');
    const resp=await fetch(API+path,{method,redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(25000),
      headers:{Accept:'application/json',Authorization:'Bearer '+token,
        ...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    if(allow404&&resp.status===404)return null;
    assert.ok(resp.ok,'HTTP_'+resp.status);
    return resp.status===204?null:resp.json();
  }
  const [mine1,mine2]=await Promise.all(tokens.map(t=>
    api('GET','/api/communities/mine',t)));
  const matches=mine1.filter(g=>g.name===GROUP&&g.ownerUsername?.toLowerCase()===USERS[0]
    &&g.visibility==='PRIVATE'&&valid(g.id)&&
    (g.sports?.includes('Futebol')||g.sport==='Futebol')&&
    g.teamTournamentsEnabled!==false);
  assert.equal(matches.length,1,'PRIVATE_QA_GROUP_SCOPE');
  communityId=matches[0].id;
  assert.ok(mine2.some(g=>g.id===communityId),'SECOND_QA_NOT_MEMBER');
  console.log('[PASS] Both allowlisted QA accounts belong to the intended private group.');
  const runId=process.env.GITHUB_RUN_ID;
  assert.match(runId||'',/^[0-9]+$/,'RUN_ID_REQUIRED');
  const name='JYNLO QA - Convite E2E '+runId;
  const list=await api('GET','/api/communities/'+communityId+'/tournaments?page=0',tokens[0]);
  assert.ok(Array.isArray(list.tournaments),'TOURNAMENTS_INVALID');
  assert.ok(!list.tournaments.some(t=>t.name===name),'QA_FIXTURE_ALREADY_EXISTS');
  let browser=null,verified=false;
  try {
    const path='/api/communities/'+communityId+'/tournaments';
    const created=await api('POST',path,tokens[0],{
      name,sport:'Futebol',entryType:'TEAM',format:'LEAGUE',
      playersPerTeam:null,roundRobinLegs:1,winPoints:3,drawPoints:1,lossPoints:0,
      teamTieBreakPriority:'GOAL_DIFFERENCE_FIRST'});
    assert.ok(valid(created.id)&&created.name===name
      &&created.entryType==='TEAM'&&created.status==='DRAFT','CREATED_TOURNAMENT_INVALID');
    tournamentId=created.id;
    const team=await api('POST',path+'/'+tournamentId+'/teams',tokens[0],
      {name:'JYNLO QA - Equipa Temporaria'});
    assert.ok(valid(team.id),'TEAM_CREATE_FAILED');
    teamId=team.id;
    const before=await api('GET',path+'/'+tournamentId+'/teams',tokens[0]);
    assert.equal(before.length,1,'TEAM_COUNT');
    assert.equal(before[0].players.length,0,'TEAM_NOT_EMPTY');
    console.log('[PASS] Temporary draft tournament and empty team created in QA scope.');
    const {chromium}=require('playwright');
    browser=await chromium.launch({headless:true,timeout:20000,
      args:['--no-sandbox','--disable-dev-shm-usage']});
    const ctx=await browser.newContext({locale:'pt-PT',viewport:{width:1440,height:900},
      serviceWorkers:'block'});
    try {
      await ctx.addInitScript(token=>{
        localStorage.setItem('t',token);
        localStorage.setItem('d24-language','pt');
      },tokens[1]);
      const page=await ctx.newPage();
      const invite='/menu/communities/'+communityId+'?tab=tournaments&tournament='+
        tournamentId+'&team='+teamId+'&teamPage='+teamId;
      await page.goto(SITE+invite,{waitUntil:'domcontentloaded',timeout:45000});
      const region=page.locator('.team-invite-accept');
      const accept=region.getByRole('button',{name:'Aceitar convite e entrar na equipa'});
      await accept.waitFor({state:'visible',timeout:40000});
      console.log('[PASS] QA account 2 opened the dedicated team invitation page.');
      const endpoint=path+'/'+tournamentId+'/teams/'+teamId+'/players/me';
      const [response]=await Promise.all([
        page.waitForResponse(r=>r.url().endsWith(endpoint)
          &&r.request().method()==='PUT',{timeout:25000}),
        accept.click()
      ]);
      assert.ok(response.ok(),'ACCEPT_HTTP_'+response.status());
      await region.getByText('Já fazes parte desta equipa. Boa sorte!')
        .waitFor({state:'visible',timeout:20000});
      const [ownerView,memberView]=await Promise.all(tokens.map(t=>
        api('GET',path+'/'+tournamentId+'/teams',t)));
      for(const roster of [ownerView,memberView]){
        assert.equal(roster.length,1,'ROSTER_SCOPE');
        assert.equal(roster[0].id,teamId,'ROSTER_TEAM');
        assert.equal(roster[0].players.filter(p=>p.username?.toLowerCase()===USERS[1]).length,1,
          'JOINER_MISSING_OR_DUPLICATE');
      }
      console.log('[PASS] Browser acceptance and exact roster membership confirmed in both accounts.');
      verified=true;
    }finally{await ctx.close();}
  }finally{
    if(browser)await browser.close();
    if(valid(tournamentId)){
      const path='/api/communities/'+communityId+'/tournaments/'+tournamentId;
      await api('DELETE',path,tokens[0]);
      const missing=await api('GET',path,tokens[0],undefined,true);
      assert.equal(missing,null,'QA_CLEANUP_NOT_VERIFIED');
      console.log('[PASS] Isolated QA tournament and its roster deleted and absence verified.');
    }
  }
  assert.ok(verified,'QA_E2E_NOT_COMPLETED');
  console.log('[PASS] LIVE two-account team invitation E2E completed without residual QA records.');
}
run().catch(e=>{
  const msg=String(e?.message||e).replace(/https?:\/\/\S+/g,'[redacted]').slice(0,160);
  console.error('[FAIL] '+msg);
  process.exitCode=1;
});
