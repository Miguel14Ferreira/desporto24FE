#!/usr/bin/env node
'use strict';
// Read-only LIVE ranking UI smoke for two existing PRIVATE disposable QA
// communities. The only POST is login. No screenshots, traces, message sends,
// results writes, storageState exports or browser token logging.
const assert=require('node:assert/strict');
const {authenticate}=require('./jynlo-inbox-live-browser.cjs');
const SITE='https://d24sports.com',API='https://api.d24sports.com';
const QA=['jynloteste01','jynloteste02'];
const MIX='JYNLO QA - Multidesporto Futebol e Karting';
const FOOT='JYNLO QA - Comunidade Privada de Testes';
const KART_SEASON='JYNLO QA - Karting Simulado 2026';
const FOOT_SEASON='JYNLO QA - Época Simulada 2026';
const must=(v,label)=>assert.ok(v,'QA_'+label);

let qaStage='START';
async function run({fetchImpl=globalThis.fetch,chromiumImpl,report=console.log}={}) {
  must(process.env.JYNLO_QA_USERNAME_1===QA[0] &&
    process.env.JYNLO_QA_USERNAME_2===QA[1],'UNAUTHORIZED_IDENTITIES');
  const passwords=[process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2];
  must(passwords.every(p=>typeof p==='string'&&p.length>0),'PASSWORDS_MISSING');
  const tokens=await Promise.all(QA.map((name,i)=>authenticate(name,passwords[i],fetchImpl)));

  async function api(path,token) {
    must(path==='/api/communities/mine'
      ||/^\/api\/communities\/[1-9]\d*\/competition(?:\?seasonId=[1-9]\d*)?$/.test(path),
      'ENDPOINT_NOT_ALLOWLISTED');
    const r=await fetchImpl(API+path,{method:'GET',redirect:'error',
      signal:AbortSignal.timeout(25000),
      headers:{Accept:'application/json',Authorization:'Bearer '+token}});
    must(r.ok,'API_HTTP_'+r.status);
    return r.json();
  }
  const groupLists=await Promise.all(tokens.map(token=>api('/api/communities/mine',token)));
  const groups=[FOOT,MIX].map(name=>{
    const matches=groupLists[0].filter(g=>g.name===name
      &&g.ownerUsername?.toLowerCase()===QA[0]&&g.visibility==='PRIVATE');
    assert.equal(matches.length,1,'QA_GROUP_NOT_UNIQUE');
    const g=matches[0];
    must(Number.isSafeInteger(g.id)&&g.id>0
      &&groupLists[1].some(other=>other.id===g.id),'GROUP_MEMBER_MISMATCH');
    return g;
  });
  must(groups[1].sports?.includes('Karting')&&groups[1].sports.includes('Futebol'),
    'MULTISPORT_MISSING');
  report('[PASS] Two private QA communities verified for both identities');

  const fixture=[];
  for(const [index,seasonName] of [[0,FOOT_SEASON],[1,KART_SEASON]]) {
    const initial=await api('/api/communities/'+groups[index].id+'/competition',tokens[0]);
    must(Array.isArray(initial.seasons),'SEASONS_MISSING');
    const matches=initial.seasons.filter(s=>s.name===seasonName);
    assert.equal(matches.length,1,'QA_SEASON_NOT_UNIQUE');
    const season=matches[0];
    must(Number.isSafeInteger(season.id)&&season.id>0,'SEASON_ID_INVALID');
    const checked=await api('/api/communities/'+groups[index].id
      +'/competition?seasonId='+season.id,tokens[0]);
    if(index===0){
      must(checked.standings?.some(row=>row.username?.toLowerCase()===QA[0]
        &&row.points===3),'FOOTBALL_POINTS_MISSING');
    }else{
      const race=checked.raceStandings?.find(r=>r.sport==='Karting');
      must(race&&race.standings?.some(row=>row.username?.toLowerCase()===QA[1]
        &&row.championshipPoints===25),'KARTING_POINTS_MISSING');
      must(!checked.sportStandings?.some(g=>g.sport==='Karting'),
        'KARTING_WRONG_SPORT_STANDINGS');
    }
    const karting= index===1 ? checked.raceStandings?.find(g=>g.sport==='Karting') : null;
    fixture.push({id:groups[index].id,seasonName,
      kind:index?'karting':'football',
      kartingRows: karting?.standings?.map(row=>({
        displayed:row.fullName || row.username || '',
        points:row.championshipPoints,
        place:row.position
      }))||[]});
  }
  report('[PASS] Read-only API: Football 3-point result and Karting 25-point result');

  let chromium=chromiumImpl;
  if(!chromium) chromium=require('playwright').chromium;
  const browser=await chromium.launch({headless:true});
  try{
    for(let i=0;i<tokens.length;i++){
      const ctx=await browser.newContext({locale:'pt-PT',
        viewport:{width:1440,height:900},serviceWorkers:'block'});
      try{
        await ctx.addInitScript(token=>localStorage.setItem('t',token),tokens[i]);
        for(const group of fixture){
          qaStage='OPEN_'+group.kind.toUpperCase();
          const page=await ctx.newPage();
          try{
            await page.goto(SITE+'/menu/communities/'+group.id+'?tab=ranking',
              {waitUntil:'domcontentloaded',timeout:45000});
            const heading=page.locator('.community-detail h2').filter({hasText:group.kind==='karting'?MIX:FOOT});
            await heading.first().waitFor({state:'visible',timeout:30000});
            qaStage='HEADING_'+group.kind.toUpperCase();
            // The tab is loaded asynchronously from the protected API.
            const race=page.locator('#community-race-ranking-summary-title');
            const table=page.locator('app-community-ranking-table');
            if(group.kind==='karting'){
              qaStage='RACE_SUMMARY';
              await race.waitFor({state:'visible',timeout:30000});
              qaStage='RACE_HEADING';
              const region=page.locator('.community-race-ranking-summary');
              await region.getByRole('heading',{name:'Karting'}).waitFor({state:'visible',timeout:15000});
              qaStage='RACE_TABLE';
              const karting=region.locator('table').first();
              await karting.waitFor({state:'visible',timeout:15000});
              qaStage='RACE_ROWS';
              const rows=karting.locator('tbody tr');
              must(await rows.count()===2,'KARTING_ROWS_COUNT');
              const first=await rows.nth(0).innerText();
              const second=await rows.nth(1).innerText();
              const expected=group.kartingRows;
              must(expected.length===2&&expected[0].points===25&&expected[1].points===18,
                'KARTING_API_EXPECTED_RANKS_INVALID');
              must(first.includes(expected[0].displayed)&&/25/.test(first),
                'KARTING_FIRST_VISUAL');
              must(second.includes(expected[1].displayed)&&/18/.test(second),
                'KARTING_SECOND_VISUAL');
              // No W/D/L table rendered for a Karting-only selected season.
              qaStage='RACE_WDL_GUARD';
              must(await table.count()===0,'KARTING_FOOTBALL_TABLE_RENDERED');
              report('[PASS] QA browser '+(i+1)+' Karting ranking: P1=25, P2=18; no WDL table');
            }else{
              qaStage='FOOTBALL_TABLE';
              await table.first().waitFor({state:'visible',timeout:30000});
              const text=(await table.first().innerText()).toLowerCase();
              must(text.includes(QA[0])&&text.includes(QA[1]),'FOOTBALL_DRIVERS_MISSING');
              report('[PASS] QA browser '+(i+1)+' Football ranking visible');
            }
            must(new URL(page.url()).origin===SITE,'BROWSER_WRONG_ORIGIN');
          }finally{await page.close();}
        }
      }finally{await ctx.close();}
    }
  }finally{await browser.close();}
  report('[PASS] LIVE browser ranking audit completed without any writes');
}
if(require.main===module)run().catch(e=>{
  const message=typeof e?.message==='string'&&/^QA_[A-Z0-9_]+$/.test(e.message)
    ?e.message:'QA_BROWSER_OR_NETWORK_FAILURE';
  console.error('[FAIL] '+qaStage+': '+message);
  process.exitCode=1;
});
module.exports={run};
