#!/usr/bin/env node
'use strict';
// Strictly read-only discovery for disposable Jynlo QA accounts.
// Login is the only POST. No credentials, IDs, names, or player data in logs.
const assert=require('node:assert/strict');
const {authenticate}=require('./jynlo-inbox-live-browser.cjs');
const API='https://api.d24sports.com';
const users=['jynloteste01','jynloteste02'];
const names=['JYNLO QA - Multidesporto Futebol e Karting','JYNLO QA - Comunidade Privada de Testes'];
const id=x=>Number.isSafeInteger(x)&&x>0;
async function get(path,token){
  assert.match(path,/^\/api\/communities\/(?:mine|[1-9]\d*\/tournaments(?:\?page=[0-9]+|\/[1-9]\d+\/teams)?)$/);
  const res=await fetch(API+path,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.ok(res.ok,'QA_GET_FAILED_'+res.status);
  return res.json();
}
async function run(){
  assert.deepEqual([process.env.JYNLO_QA_USERNAME_1,process.env.JYNLO_QA_USERNAME_2],users,
    'QA_ACCOUNT_ALLOWLIST_MISMATCH');
  const ps=[process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2];
  assert.ok(ps.every(v=>typeof v==='string'&&v.length>0),'QA_PASSWORD_MISSING');
  const tokens=await Promise.all(users.map((u,i)=>authenticate(u,ps[i],fetch)));
  const lists=await Promise.all(tokens.map(t=>get('/api/communities/mine',t)));
  let candidates=0, safe=0, inspected=0;
  for(const name of names){
    const match=lists[0].filter(c=>c.name===name&&
      c.ownerUsername?.toLowerCase()===users[0]&&c.visibility==='PRIVATE'&&id(c.id));
    assert.equal(match.length,1,'QA_COMMUNITY_SCOPE_NOT_UNIQUE');
    const group=match[0];
    assert.ok(lists[1].some(c=>c.id===group.id),'QA_SECOND_ACCOUNT_NOT_MEMBER');
    for(let page=0;page<3;page++){
      const result=await get('/api/communities/'+group.id+'/tournaments?page='+page,tokens[0]);
      assert.ok(Array.isArray(result.tournaments),'QA_TOURNAMENT_PAGE_INVALID');
      for(const tour of result.tournaments){
        if(tour.entryType!=='TEAM'||!id(tour.id))continue;
        inspected++;
        const teams=await get('/api/communities/'+group.id+'/tournaments/'+tour.id+'/teams',tokens[0]);
        assert.ok(Array.isArray(teams)&&teams.length<=32,'QA_TEAMS_INVALID');
        if(tour.status!=='DRAFT')continue;
        candidates++;
        if(teams.some(team=>id(team.id)&&Array.isArray(team.players)&&
          !team.players.some(p=>p.username?.toLowerCase()===users[1])&&
          teams.every(t=>!t.players.some(p=>p.username?.toLowerCase()===users[1]))&&
          team.players.length<(team.playersPerTeam??30)))safe++;
      }
      if(!result.hasMore)break;
    }
  }
  console.log('[PASS] Verified two named private QA communities with both test identities.');
  console.log('[INFO] Existing team tournaments='+inspected+', draft='+candidates+
    ', eligible empty places='+safe+'.');
  console.log(safe?'[READY] Existing draft QA fixture found; no changes made.':
    '[SKIP] No existing safe draft QA team invite fixture; no changes made.');
}
run().catch(e=>{console.error('[FAIL] '+e.message);process.exitCode=1;});
