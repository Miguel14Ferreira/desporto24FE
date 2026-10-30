/**
 * Olympic track sprint browser contract — real Chromium / synthetic backend.
 * Never sends data to production, does not use passwords or real member details.
 * An authenticated Spring/Postgres production E2E remains a separate test.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

if (process.env['JYNLO_USE_SYSTEM_CHROME']) test.use({ channel: 'chrome' });

const APP = 'http://127.0.0.1:4200';
type Role = 'OWNER' | 'MEMBER';
type View = 'ready' | 'finished';
type Match = {
  slot: string; phase: string; seriesKey: string; riderA: string | null;
  riderB: string | null; riderC: string | null; riderD: string | null;
  winsA: number; winsB: number; winner: string | null;
  status: 'READY' | 'FINISHED' | 'WAITING_PREVIOUS';
  rankings: { position: number; username: string }[];
};

function token(username: string): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return [b64({ alg:'none', typ:'JWT' }), b64({
    sub: username, Authorities:['ROLE_USER'], exp:Math.floor(Date.now()/1000)+3600
  }), 'synthetic-fixture-only'].join('.');
}

function match(slot: string, phase: string, members: string[], view: View): Match {
  return {
    slot, phase, seriesKey: 'SP41-' + slot,
    riderA: members[0] || null, riderB: members[1] || null,
    riderC: members[2] || null, riderD: members[3] || null,
    winsA:0, winsB:0, winner: view === 'finished' && slot !== 'F58' ? members[0] : null,
    status: view === 'finished' ? 'FINISHED' : 'READY',
    rankings: view === 'finished' && slot === 'F58'
      ? members.map((username, n)=>({ username, position:n+5 })) : []
  };
}
function olympicBracket(view: View) {
  return {
    id:41, seasonId:4, name:'Sprint Olímpico QA 2026',
    format:'OLYMPIC_TWENTY_FOUR_REPECHAGE', qualifyingRoundId:42,
    qualifyingSeeds:Array.from({length:24},(_,i)=>'r'+(i+1)),
    matches:[
      match('U1','SPRINT_REPECHAGE_1_32',['r13','r14','r15'],'finished'),
      match('V1','SPRINT_REPECHAGE_1_16',['r16','r17'],'finished'),
      match('W1','SPRINT_REPECHAGE_1_8',['r18','r19','r20'],'finished'),
      match('F58','SPRINT_PLACES_5_8',['r5','r6','r7','r8'],view)
    ]
  };
}
function qualifier() {
  return {
    id:42,name:'Qualificação 200 m QA',sport:'Ciclismo de Pista',
    eventType:'TRACK_FLYING_200',playedAt:'2026-10-24T13:00:00Z',
    entries:Array.from({length:24},(_,i)=>({
      username:'r'+(i+1),fullName:'r'+(i+1),result:'DRAW',
      finishPosition:i+1,elapsedSeconds:10+(i+1)/100,
      raceDisqualified:false,goals:0,assists:0,mvp:false,cleanSheet:false
    }))
  };
}

async function mockedCommunity(page: Page, role: Role, view: View = 'ready') {
  const username=role==='OWNER'?'organizador':'participante';
  await page.addInitScript(value=>localStorage.setItem('t',value),token(username));
  const writes: string[]=[];
  const unexpected: string[]=[];
  const creations: Array<Record<string,unknown>>=[];
  const seasonReads: number[]=[];
  const community={
    id:7,name:'Sprint Pista QA',description:'Dados sintéticos de teste',
    sport:'Ciclismo de Pista',sports:['Ciclismo de Pista'],photoUrl:null,
    visibility:'PRIVATE',ownerUsername:'organizador',myRole:role,memberCount:24,
    rankingsEnabled:true,individualTournamentsEnabled:true,teamTournamentsEnabled:true,
    createdAt:'2026-10-24T10:00:00Z',
    members:Array.from({length:24},(_,i)=>({
      profileId:i+1,username:'r'+(i+1),fullName:'r'+(i+1),
      role:'MEMBER',profilePicUrl:null
    })).concat([{profileId:25,username:'organizador',fullName:'Organizador',role:'OWNER',profilePicUrl:null}])
  };
  const seasons=[
    {id:4,name:'Época 2026',startsAt:'2026-10-20T00:00:00Z',endedAt:null,active:true,
      championUsername:null,championDisplayName:null,championPoints:null},
    {id:3,name:'Época 2025',startsAt:'2025-10-20T00:00:00Z',
      endedAt:'2025-12-20T00:00:00Z',active:false,
      championUsername:null,championDisplayName:null,championPoints:null}
  ];
  await page.route('**/*',async (route:Route)=>{
    const request=route.request(), url=new URL(request.url()), path=url.pathname;
    const method=request.method();
    if(url.origin===APP&&!path.startsWith('/api/'))return route.continue();
    if(!path.startsWith('/api/'))return route.abort('blockedbyclient');
    // Never permit any real external request; each API request is fulfilled locally.
    const headers={
      'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS',
      'access-control-allow-headers':'*'
    };
    const send=(data:unknown,status=200)=>route.fulfill({
      status,contentType:'application/json',headers,body:JSON.stringify(data)
    });
    if(method==='OPTIONS')return route.fulfill({status:204,headers});
    const seasonMatch=/^\/api\/communities\/7\/seasons\/(\d+)\/track-sprint-brackets$/.exec(path);
    if(seasonMatch) {
      const seasonId=Number(seasonMatch[1]);
      seasonReads.push(seasonId);
      if(method==='GET')return send(seasonId===4
        ? [olympicBracket(view), ...creations.map((c,i)=>({
            id:42+i,seasonId:4,format:c.format,name:c.name,
            qualifyingRoundId:c.qualifyingRoundId,qualifyingSeeds:Array.from({length:24},(_,n)=>'r'+(n+1)),
            matches:[]
          }))] : []);
      if(method==='POST') {
        writes.push(role + ':' + method + ' ' + path);
        if(role!=='OWNER'||seasonId!==4)return send({message:'Sem permissão'},403);
        const requestBody=request.postDataJSON() as Record<string,unknown>;
        if(requestBody.format!=='OLYMPIC_TWENTY_FOUR_REPECHAGE'
           ||requestBody.qualifyingRoundId!==42)return send({message:'Qualificação inválida'},422);
        creations.push(requestBody);
        return send({id:42+creations.length-1,seasonId:4,...requestBody,matches:[]},201);
      }
    }
    // Normal bootstrap telemetry is not a competition mutation. Mock only
    // these two known endpoints locally; still reject/record every other write.
    // This keeps the assertion scoped to Sprint changes without hiding new
    // unapproved write calls that might be introduced by the UI.
    if(method==='POST' && (path==='/api/pilot/events/access'
        || path==='/api/presence/heartbeat'))return send({});
    if(method!=='GET') {
      writes.push(role + ':' + method + ' ' + path);
      return send({message:'Operação não permitida em QA'},403);
    }
    if(path==='/api/communities/mine')return send([community]);
    if(path==='/api/communities/7')return send(community);
    if(path==='/api/communities/invites/me')return send([]);
    if(path==='/api/communities/7/sessions')return send([]);
    if(path==='/api/communities/7/competition') {
      const selected=Number(url.searchParams.get('seasonId')||4);
      return send({
        settings:{rankingsEnabled:true,winPoints:3,drawPoints:1,lossPoints:0},
        seasons,activeSeasonId:4,selectedSeasonId:selected,
        rounds:selected===4?[qualifier()]:[],standings:[]
      });
    }
    if(path==='/api/communities/7/competition/standings-archives')return send([]);
    if(path==='/api/communities/7/competition/match-archives')return send([]);
    if(path==='/api/notifications/me/unread-count')return send(0);
    if(path==='/api/communities/7/tournaments')return send({tournaments:[],page:0,hasMore:false});
    if(path==='/api/notifications/unread-count')return send(0);
    unexpected.push(method+' '+path);
    return send({message:'Unmocked synthetic endpoint'},404);
  });
  return {writes,unexpected,creations,seasonReads};
}

async function locateSprintBracket(page: Page, qa: {unexpected:string[]}) {
  const section=page.locator('section.round-editor[aria-label="Quadros de Sprint"]');
  try { await expect(section).toBeVisible(); }
  catch (error) {
    console.log('[SPRINT-QA] URL',page.url());
    console.log('[SPRINT-QA] DOM/Angular state',await page.evaluate(()=>{
      const el=document.querySelector('.season-filter select') as HTMLSelectElement | null;
      const host=document.querySelector('app-communities');
      const component=(window as any).ng?.getComponent?.(host);
      return {
        seasonSelect:{value:el?.value,index:el?.selectedIndex},
        seasonId:component?.selectedSeasonId,activeTab:component?.activeTab,
        sports:component?.communityRoundSports,
        selectedSeason:component?.competition?.selectedSeasonId,
        activeSeason:component?.competition?.activeSeasonId,
        bracketLoading:component?.sprintBracketLoading,bracketError:component?.sprintBracketError,
        loadedBracketCount:component?.sprintBrackets?.length,
        sprintNodes:document.querySelectorAll('[aria-label="Quadros de Sprint"]').length
      };
    }));
    console.log('[SPRINT-QA] visible body',(await page.locator('body').innerText().catch(()=>'')).slice(0,3500));
    console.log('[SPRINT-QA] seasons visited',(qa as any).seasonReads);
    console.log('[SPRINT-QA] unhandled HTTP',qa.unexpected.slice(0,30));
    throw error;
  }
  return section;
}

test('Olympic sprint browser QA: member sees recorded three-up heats and 5–8 places, with no admin tools',async ({page})=>{
  const qa=await mockedCommunity(page,'MEMBER','finished');
  await page.goto('/menu/communities/7?tab=sessions');
  // Sprint brackets currently live in the Sessions tab. Select an active season.
  await page.locator('.season-filter select').selectOption({index:1});
  const section=await locateSprintBracket(page,qa);
  await expect(section).toContainText('Sprint Olímpico QA 2026');
  await expect(section).toContainText('r15');
  await expect(section).toContainText('r8');
  await expect(section).toContainText('5.º');
  await expect(section).toContainText('8.º');
  await expect(section.locator('input')).toHaveCount(0);
  expect(qa.writes).toEqual([]);
  expect(qa.seasonReads).toContain(4);
});

test('Olympic sprint browser QA: owner can select 24 valid times; older season does not leak active bracket',async ({page})=>{
  const qa=await mockedCommunity(page,'OWNER','ready');
  await page.goto('/menu/communities/7?tab=sessions');
  // The ranking page opens with "Todo o histórico". Explicitly choose a season.
  await page.locator('.season-filter select').selectOption({index:1});
  const section=await locateSprintBracket(page,qa);
  await expect(section).toContainText('Sprint Olímpico QA 2026');
  await expect(section).toContainText('SP41-F58');
  await expect(section).toContainText('r8');

  const editor=section.locator('.round-meta-form').first();
  await editor.locator('input').first().fill('Novo Sprint QA');
  await editor.locator('select').first().selectOption('OLYMPIC_TWENTY_FOUR_REPECHAGE');
  const qual=editor.locator('select').nth(1);
  await expect(qual.locator('option')).toHaveCount(2);
  await qual.selectOption({index:1});
  await editor.locator('button.btn-primary').click();
  await expect(section).toContainText('Novo Sprint QA');
  expect(qa.creations).toHaveLength(1);
  expect(qa.creations[0].qualifyingRoundId).toBe(42);
  expect(qa.writes).toHaveLength(1);

  // Switching seasons must replace bracket data, not keep stale choices/results.
  await page.locator('.season-filter select').selectOption({index:2});
  await expect(section).not.toContainText('Sprint Olímpico QA 2026');
  await expect(section).not.toContainText('Novo Sprint QA');
  expect(qa.seasonReads).toContain(3);
  expect(qa.writes).toHaveLength(1);
});
