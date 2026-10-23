#!/usr/bin/env node
'use strict';
// Explicit opt-in production QA. Only disposable accounts; ONE private fixture.
// No saved tokens, screenshots, traces, retries of writes, or public sessions.
const {randomUUID,randomBytes}=require('node:crypto');
const {authenticate,request,requireDenied}=require('./jynlo-inbox-live-browser.cjs');
const API='https://api.d24sports.com',SITE='https://d24sports.com';
const USERS=['jynloteste01','jynloteste02'],KICKOFF_DELAY=180000;
const ACK='PRIVATE_QA_SESSION_PERSISTS';
function must(ok,code){if(!ok)throw Error(code);}
function consent(value){must(value===ACK,'QA_EXPLICIT_CONSENT_REQUIRED');}
function fixture(now,pass){
  must(Number.isSafeInteger(now)&&now>0,'QA_INVALID_CLOCK');
  must(typeof pass==='string'&&pass.length>=24,'QA_MISSING_SESSION_PASSWORD');
  return {sport:'Futebol',gameDate:new Date(now+KICKOFF_DELAY).toISOString(),
    city:'Lisboa',address:'JYNLO QA - TESTE PRIVADO - NAO E UM EVENTO REAL',
    maxParticipants:2,priceAmount:0,privateGame:true,password:pass,
    latitude:null,longitude:null,communityId:null,venueId:null,
    recurrence:'NONE',recurrenceOccurrences:null,externalConfirmedParticipants:0};
}
function candidateId(response){
  return Number.isSafeInteger(response?.id)&&response.id>0?response.id:null;
}
function createdId(response,expected){
  must(Number.isSafeInteger(response?.id)&&response.id>0,'QA_CREATE_ID_MISSING');
  must(response.privateGame===true&&response.maxParticipants===2
    &&response.creatorUsername?.toLowerCase()===USERS[0]
    &&Math.abs(Date.parse(response.gameDate)-Date.parse(expected))<1000,
    'QA_CREATE_RESPONSE_MISMATCH');
  return response.id;
}
function joinedState(data){return data?.state==='PARTICIPANT';}
async function status(path,token,{method='GET',body,fetchImpl=fetch}={}){
  must(/^\/api\/sessions\/[1-9]\d*\/(?:messages|cancel)$/.test(path),
    'QA_UNEXPECTED_ENDPOINT');
  must(typeof token==='string'&&token.length>0,'QA_NO_AUTH');
  try{
    const response=await fetchImpl(API+path,{method,redirect:'error',
      signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer '+token,Accept:'application/json',
        ...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    return response.status;
  }catch{throw Error('QA_NETWORK_AMBIGUOUS_WRITE');}
}
async function sessionPage(context,id){
  const page=await context.newPage();
  await page.goto(SITE+'/menu/messages?kind=session&id='+id,
    {waitUntil:'domcontentloaded',timeout:35000});
  await page.locator('.inbox-entry.is-selected').waitFor({timeout:20000});
  await page.locator('.inbox-connection.is-online').waitFor({timeout:20000});
  await page.locator('#inbox-reply:enabled').waitFor({timeout:20000});
  return page;
}
async function closedPage(context,id){
  const page=await context.newPage();
  try{
    await page.goto(SITE+'/menu/messages?kind=session&id='+id,
      {waitUntil:'domcontentloaded',timeout:35000});
    await page.locator('.inbox-entries, .inbox-empty-side').first()
      .waitFor({timeout:20000});
    must(await page.locator('.inbox-entry.is-selected').count()===0,
      'QA_EXPIRED_SESSION_STILL_SELECTED');
  }finally{await page.close();}
}
async function untilKickoff(date,now=()=>Date.now(),sleep=ms=>
  new Promise(resolve=>setTimeout(resolve,ms))){
  const delay=Date.parse(date)-now()+1800;
  must(Number.isFinite(delay)&&delay<300000,'QA_KICKOFF_WINDOW_INVALID');
  if(delay>0)await sleep(delay);
}
async function run({passwords=[process.env.JYNLO_QA_PASSWORD_1,
  process.env.JYNLO_QA_PASSWORD_2],
  acknowledge=process.env.JYNLO_QA_PRIVATE_SESSION_CONSENT,
  fetchImpl=fetch,chromiumImpl,report=console.log}={}){
  consent(acknowledge);
  must(Array.isArray(passwords)&&passwords.length===2&&
    passwords.every(p=>typeof p==='string'&&p.length>0),
    'QA_ACCOUNT_PASSWORDS_REQUIRED');
  const tokens=await Promise.all(USERS.map((u,i)=>authenticate(u,passwords[i],fetchImpl)));
  report('[PASS] Identidades QA autenticadas sem expor tokens');
  let chromium=chromiumImpl;
  if(!chromium){try{chromium=require('playwright').chromium;}
    catch{throw Error('QA_PLAYWRIGHT_MISSING');}}
  const browser=await chromium.launch({headless:true});
  const contexts=[];
  let id=null,phase='CREATE',ok=false;
  try{
    for(const token of tokens){
      const ctx=await browser.newContext({locale:'pt-PT',viewport:{width:1440,height:900}});
      await ctx.addInitScript(v=>localStorage.setItem('t',v),token);
      contexts.push(ctx);
    }
    const secret=randomBytes(24).toString('hex');
    const planned=fixture(Date.now(),secret);
    // One create POST only. Never auto-retry if the response is uncertain.
    const created=await request('/api/sessions',{
      method:'POST',token:tokens[0],body:planned,fetchImpl});
    // Keep the identifier BEFORE validating other response fields, so a
    // partially unexpected response still permits cancellation in finally.
    id=candidateId(created);
    createdId(created,planned.gameDate);
    report('[PASS] Uma sessão privada QA criada: ID '+id+' (duas vagas, sem recinto)');
    phase='NON_MEMBER_DENIAL';
    await requireDenied('session',id,tokens[1],fetchImpl);
    report('[PASS] Segunda conta não lê o chat antes de aderir');
    phase='JOIN';
    const joined=await request('/api/sessions/'+id+'/join',{
      method:'POST',token:tokens[1],body:{password:secret},fetchImpl});
    must(joinedState(joined),'QA_JOIN_FAILED');
    report('[PASS] Segunda conta aderiu à sessão privada');
    phase='AUTHORIZED_HISTORY';
    const histories=await Promise.all(tokens.map(token=>
      request('/api/sessions/'+id+'/messages',{token,fetchImpl})));
    must(histories.every(Array.isArray),'QA_AUTHORIZED_READ_FAILED');
    report('[PASS] Histórico acessível a ambos os participantes');
    phase='REALTIME';
    const [sender,recipient]=await Promise.all([
      sessionPage(contexts[0],id),sessionPage(contexts[1],id)]);
    let attempts=0;
    sender.on('request',req=>{
      try{if(req.method()==='POST'&&
        new URL(req.url()).pathname==='/api/sessions/'+id+'/messages')attempts++;
      }catch{/* Never print request details. */}
    });
    const marker='[Jynlo QA session] '+randomUUID();
    await sender.locator('#inbox-reply').fill(marker);
    await sender.locator('.inbox-composer button[type="submit"]').click();
    await recipient.locator('.inbox-bubble').filter({hasText:marker})
      .waitFor({timeout:20000});
    must(attempts===1,'QA_DUPLICATE_MESSAGE_POST');
    report('[PASS] Mensagem única recebida na segunda conta em tempo real');
    phase='KICKOFF';
    report('[INFO] A validar o fecho na hora real do início da sessão');
    await untilKickoff(planned.gameDate);
    await requireDenied('session',id,tokens[0],fetchImpl);
    await requireDenied('session',id,tokens[1],fetchImpl);
    report('[PASS] Histórico fechado para ambos após o início');
    phase='LATE_POST';
    const code=await status('/api/sessions/'+id+'/messages',tokens[0],
      {method:'POST',body:{body:'[QA blocked] '+randomUUID()},fetchImpl});
    must(code===409,'QA_EXPECTED_HTTP_409');
    report('[PASS] Envio após início foi recusado com HTTP 409');
    phase='CLOSED_INBOX';
    await Promise.all(contexts.map(ctx=>closedPage(ctx,id)));
    report('[PASS] Chat iniciado não volta a abrir pelo Centro de Mensagens');
    ok=true;
  }catch(error){
    const cause=error instanceof Error&&/^QA_[A-Z0-9_]+$/.test(error.message)
      ?error.message:'QA_UNEXPECTED_FAILURE';
    report('[FAIL] '+phase+': '+cause);
  }finally{
    for(const ctx of contexts)await ctx.close().catch(()=>{});
    await browser.close().catch(()=>{});
    if(id!==null){
      // Only this fixture ID; keep database history, never retry ambiguous POST.
      try{
        const code=await status('/api/sessions/'+id+'/cancel',tokens[0],
          {method:'POST',fetchImpl});
        if(code===204||code===200){
          report('[PASS] Sessão QA cancelada; registo histórico mantido (ID '+id+')');
        }else{
          report('[WARN] Cancelamento não confirmado: HTTP '+code+' (ID '+id+')');
          ok=false;
        }
      }catch{
        report('[WARN] Cancelamento não confirmado para a sessão QA ID '+id);
        ok=false;
      }
    }else{
      report('[INFO] Criação não confirmada: verificar sessões QA antes de repetir');
    }
  }
  must(ok,'QA_LIFECYCLE_INCOMPLETE');
  report('[PASS] Ciclo completo da sessão privada QA validado');
}
if(require.main===module){
  if(process.argv.length!==2){
    console.error('Usar sem argumentos, com credenciais e consentimento no ambiente.');
    process.exitCode=2;
  }else run().catch(e=>{
    const code=e instanceof Error&&/^QA_[A-Z0-9_]+$/.test(e.message)
      ?e.message:'QA_FAILED';
    console.error('[FAIL] '+code+'; não repetir sem verificar a sessão QA');
    process.exitCode=1;
  });
}
module.exports={consent,fixture,candidateId,createdId,joinedState,status,untilKickoff,run};
