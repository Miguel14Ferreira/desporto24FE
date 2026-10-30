#!/usr/bin/env node
'use strict';
// Real site/API/WebSocket smoke. Two disposable QA identities, two isolated contexts.
// No token, password, storageState, trace, video or screenshot is ever persisted.
// Default creates no message. --send-once sends ONE message and NEVER retries.
const { randomUUID } = require('node:crypto');
const SITE = 'https://d24sports.com';
const API = 'https://api.d24sports.com';
const ACCOUNTS = ['jynloteste01','jynloteste02'];
const TIMEOUT = 20_000;
function check(value, message) { if (!value) throw Error(message); }

// Only predefined stage labels and HTTP codes are emitted. Never display
// raw browser/fetch errors, token values, message text or private resource IDs.
function safeQaCause(error) {
  const message = error instanceof Error ? error.message : '';
  const http = /^HTTP (\d{3}) em /.exec(message);
  if (http) return 'HTTP_' + http[1];
  const denial = /^Authorization check returned an unexpected HTTP status \((\d{3})\)$/.exec(message);
  if (denial) return 'ACCESS_NOT_DENIED_HTTP_' + denial[1];
  if (message.includes('Unexpected public community discovery shape'))
    return 'UNEXPECTED_COMMUNITY_DISCOVERY_FORMAT';
  if (message.includes('Unexpected public session discovery shape'))
    return 'UNEXPECTED_SESSION_DISCOVERY_FORMAT';
  if (message.includes('Owner community history is not readable'))
    return 'COMMUNITY_HISTORY_FORMAT';
  if (message.includes('Sessão futura autorizada não devolve histórico'))
    return 'SESSION_HISTORY_FORMAT';
  if (message.includes('Read-only authorization check could not connect'))
    return 'AUTHORIZATION_PROBE_NETWORK';
  if (message.includes('A comunidade abriu para a conta não membro'))
    return 'OUTSIDER_COMMUNITY_SELECTED';
  if (message.includes('Sessão expirada ainda abre chat'))
    return 'EXPIRED_SESSION_SELECTED';
  return 'UNCLASSIFIED_CHECK_FAILURE';
}

async function readOnlyStage(label, work, report, failures) {
  try { await work(); }
  catch (error) {
    report('[FAIL] ' + label + ': ' + safeQaCause(error));
    failures.push(label);
  }
}
function upcoming(s, now = Date.now()) {
  const kickoff = typeof s?.gameDate === 'string' ? Date.parse(s.gameDate) : NaN;
  return Number.isSafeInteger(s?.id) && s.id > 0 && Number.isFinite(kickoff)
    && kickoff > now && !['CANCELLED','COMPLETED','NOT_OCCURRED'].includes(s.status);
}
async function request(path, { method = 'GET', token, body, fetchImpl = fetch } = {}) {
  check(path.startsWith('/api/') && !path.includes('://'), 'Caminho inválido');
  let response;
  try {
    response = await fetchImpl(API + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept:'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization:'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch { throw Error('Falha da API (' + method + ' ' + path.split('?')[0] + '). Não repetir envio incerto.'); }
  check(response.ok, 'HTTP ' + response.status + ' em ' + method + ' ' + path.split('?')[0]);
  try { return await response.json(); }
  catch { throw Error('JSON inválido em ' + path.split('?')[0]); }
}
async function authenticate(username, password, fetchImpl = fetch) {
  check(ACCOUNTS.includes(username) && typeof password === 'string' && password.length > 0,
    'Definir credenciais QA válidas');
  const data = await request('/api/auth/login', {
    method:'POST', body:{ username,password }, fetchImpl
  });
  check(!data.mfaRequired, 'MFA da conta QA exige confirmação manual');
  check(typeof data.token === 'string' && data.token.length > 30
    && data.profile?.username?.toLowerCase() === username, 'Identidade QA não confirmada');
  return data.token;
}
async function openPrivate(context, peer) {
  const page = await context.newPage();
  await page.goto(SITE + '/menu/messages?kind=direct&id=' + peer,
    { waitUntil:'domcontentloaded', timeout:35_000 });
  const selected = page.locator('.inbox-entry.is-selected');
  await selected.waitFor({ timeout:TIMEOUT });
  check((await selected.textContent() || '').toLowerCase().includes(peer),
    'Conversa aberta não corresponde à conta QA');
  await page.locator('.inbox-connection.is-online').waitFor({ timeout:TIMEOUT });
  await page.locator('#inbox-reply:enabled').waitFor({ timeout:TIMEOUT });
  check(await page.getByText('Abrir chat completo',{exact:true}).count()===0,
    'Botão antigo de chat reapareceu');
  return page;
}
// Read-only authorization probes: never POST, PUT or consume response bodies.
// 404 may deliberately conceal the existence of an unauthorized conversation.
async function requireDenied(kind, id, token, fetchImpl = fetch) {
  check(kind === 'community' || kind === 'session', 'Invalid chat kind');
  check(Number.isSafeInteger(id) && id > 0, 'Invalid chat identifier');
  check(typeof token === 'string' && token.length > 0, 'Missing QA identity');
  const path = kind === 'community'
    ? '/api/communities/' + id + '/messages'
    : '/api/sessions/' + id + '/messages';
  let res;
  try {
    res = await fetchImpl(API + path, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }
    });
  } catch {
    throw Error('Read-only authorization check could not connect');
  }
  check(res.status === 403 || res.status === 404,
    'Authorization check returned an unexpected HTTP status (' + res.status + ')');
  return true;
}

function firstAccessibleOutsiderCommunity(discovery, mineOne, mineTwo) {
  check(Array.isArray(discovery?.communities), 'Unexpected public community discovery shape');
  const own = new Set([...mineOne, ...mineTwo].map(x => Number(x.id)));
  return discovery.communities.find(item => Number.isSafeInteger(item?.id)
    && item.id > 0 && !own.has(item.id)) || null;
}

function firstPublicOutsiderSession(discovered, mySessions) {
  check(Array.isArray(discovered), 'Unexpected public session discovery shape');
  const own = new Set([...(mySessions.created || []),
    ...(mySessions.joined || []), ...(mySessions.waitlisted || [])]
    .map(x => Number(x.id)));
  return discovered.find(item => upcoming(item)
    && item.privateGame === false && !own.has(item.id)) || null;
}

async function optionalAccess(one, two, tokenOne, tokenTwo, report, fetchImpl) {
  const [mine, theirs, sessions] = await Promise.all([
    request('/api/communities/mine',{token:tokenOne,fetchImpl}),
    request('/api/communities/mine',{token:tokenTwo,fetchImpl}),
    request('/api/sessions/mine',{token:tokenOne,fetchImpl})
  ]);
  check(Array.isArray(mine) && Array.isArray(theirs)
    && Array.isArray(sessions.created) && Array.isArray(sessions.joined),
    'Respostas de comunidades/sessões inesperadas');
  const failures = [];
  const otherIds = new Set(theirs.map(g=>Number(g.id)));
  const exclusive = mine.find(g=>Number.isSafeInteger(g?.id) && g.id>0
    && !otherIds.has(g.id));
  if (exclusive) {
    // Verify the server before checking navigation. An unauthorized browser
    // selection alone is not sufficient proof that the API protects history.
    const ownerMessages = await request('/api/communities/' + exclusive.id + '/messages',
      { token: tokenOne, fetchImpl });
    check(Array.isArray(ownerMessages), 'Owner community history is not readable');
    await requireDenied('community', exclusive.id, tokenTwo, fetchImpl);
    const owner = await one.newPage(), outsider = await two.newPage();
    try {
      const path='/menu/messages?kind=community&id='+exclusive.id;
      await owner.goto(SITE+path,{waitUntil:'domcontentloaded'});
      await owner.locator('.inbox-entry.is-selected').waitFor({timeout:TIMEOUT});
      await outsider.goto(SITE+path,{waitUntil:'domcontentloaded'});
      await outsider.locator('.inbox-entry').first().waitFor({timeout:TIMEOUT});
      check(await outsider.locator('.inbox-entry.is-selected').count()===0,
        'A comunidade abriu para a conta não membro');
      report('[PASS] Acesso a comunidade isolado por identidade');
    } finally { await owner.close(); await outsider.close(); }
  } else report('[SKIP] Sem comunidade exclusiva das contas QA');
  // Even if neither QA account owns a community, a public discovery record
  // should not give a non-member access to its member-only chat.
  if (!exclusive) await readOnlyStage('COMMUNITY_PUBLIC_DISCOVERY', async () => {
    const discovery = await request('/api/communities/search?page=0',
      { token: tokenOne, fetchImpl });
    const publicOnly = firstAccessibleOutsiderCommunity(discovery, mine, theirs);
    if (publicOnly) {
      await requireDenied('community', publicOnly.id, tokenOne, fetchImpl);
      report('[PASS] Comunidade pública descoberta não revela o chat a não membros');
    } else report('[SKIP] Sem comunidade pública de terceiros para testar não membros');
  }, report, failures);

  const future = [...sessions.created, ...sessions.joined].find(upcoming);
  if (future) await readOnlyStage('SESSION_FUTURE_MEMBER', async () => {
    const ownHistory = await request('/api/sessions/' + future.id + '/messages',
      { token: tokenOne, fetchImpl });
    check(Array.isArray(ownHistory), 'Sessão futura autorizada não devolve histórico');
    report('[PASS] Sessão futura da conta QA mantém o chat autorizado');
  }, report, failures);
  else report('[SKIP] Sem sessão futura da conta QA para testar chat aberto');

  const past = [...sessions.created,...sessions.joined]
    .find(s=>Number.isSafeInteger(s?.id)&&!upcoming(s));
  if (past) await readOnlyStage('SESSION_EXPIRED_OWNER', async () => {
    await requireDenied('session', past.id, tokenOne, fetchImpl);
    const page=await one.newPage();
    try {
      await page.goto(SITE+'/menu/messages?kind=session&id='+past.id,
        {waitUntil:'domcontentloaded'});
      await page.locator('.inbox-entries, .inbox-empty-side').first()
        .waitFor({timeout:TIMEOUT});
      check(await page.locator('.inbox-entry.is-selected').count()===0,
        'Sessão expirada ainda abre chat');
      report('[PASS] Sessão passada não permite abrir chat');
    } finally { await page.close(); }
  }, report, failures);
  else report('[SKIP] Sem sessão passada nas contas QA');

  // The outsider check does not create any session, change membership or
  // write messages. It remains valid when QA accounts own no sessions.
  await readOnlyStage('SESSION_PUBLIC_DISCOVERY', async () => {
    const publicSessions = await request('/api/sessions?privateGame=false',
      { token: tokenOne, fetchImpl });
    const outsiderSession = firstPublicOutsiderSession(publicSessions, sessions);
    if (outsiderSession) {
      await requireDenied('session', outsiderSession.id, tokenOne, fetchImpl);
      report('[PASS] Sessão pública de terceiros não concede acesso ao chat');
    } else report('[SKIP] Sem sessão pública futura de terceiros para teste de não participante');
  }, report, failures);
  if (failures.length) throw Error('READ_ONLY_PROBES_FAILED');
}
async function run({ sendOnce=false, passwords=[
  process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2
], fetchImpl=fetch, chromiumImpl, report=console.log }={}) {
  check(Array.isArray(passwords) && passwords.length===2
    && passwords.every(p=>typeof p==='string'&&p.length>0),
    'Definir passwords QA como variáveis de ambiente, nunca como argumentos');
  const [tokenOne,tokenTwo]=await Promise.all(ACCOUNTS.map((u,i)=>
    authenticate(u,passwords[i],fetchImpl)));
  let chromium=chromiumImpl;
  if (!chromium) {
    try { chromium=require('playwright').chromium; }
    catch { throw Error('Falta instalar Playwright/Chromium (consultar README)'); }
  }
  const browser=await chromium.launch({headless:true});
  const contexts=[];
  try {
    for (const token of [tokenOne,tokenTwo]) {
      const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-PT'});
      await ctx.addInitScript(t=>localStorage.setItem('t',t),token);
      contexts.push(ctx);
    }
    const [ana,bea]=await Promise.all([
      openPrivate(contexts[0],ACCOUNTS[1]),
      openPrivate(contexts[1],ACCOUNTS[0])
    ]);
    const storageIds=await Promise.all([ana.evaluate(()=>localStorage.getItem('t')),
      bea.evaluate(()=>localStorage.getItem('t'))]);
    check(storageIds[0]!==storageIds[1], 'As janelas partilham a identidade');
    report('[PASS] Dois browsers isolados, chats corretos e WebSockets autenticados');
    await optionalAccess(contexts[0],contexts[1],tokenOne,tokenTwo,report,fetchImpl);
    if (sendOnce) {
      const id='[Jynlo QA browser] '+randomUUID();
      let sends=0;
      ana.on('request',req=>{
        try {
          if (req.method()==='POST'
            && new URL(req.url()).pathname==='/api/chat/me/'+ACCOUNTS[1]) sends++;
        } catch { /* no request data printed */ }
      });
      await ana.locator('#inbox-reply').fill(id);
      // Exactly one click; never retry after timeout or partial acknowledgement.
      await ana.locator('.inbox-composer button[type="submit"]').click();
      await bea.locator('.inbox-bubble').filter({hasText:id})
        .waitFor({timeout:TIMEOUT});
      check(sends===1,'Mais de uma tentativa de POST no envio QA');
      report('[PASS] Única mensagem QA recebida em tempo real sem atualizar a página');
    } else report('[PASS] Nenhum envio criado; abrir chats pode atualizar recibos de leitura QA');
  } finally {
    for(const ctx of contexts)await ctx.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
}
if(require.main===module) {
  if(process.argv.slice(2).some(x=>x!=='--send-once')) {
    console.error('Utilização: node scripts/qa/jynlo-inbox-live-browser.cjs [--send-once]');
    process.exitCode=2;
  } else run({sendOnce:process.argv.includes('--send-once')}).catch(error=>{
    if (error instanceof Error && error.message === 'READ_ONLY_PROBES_FAILED') {
      console.error('[FAIL] Verificações de acesso incompletas. Consultar os códigos acima; nenhuma repetição de mensagens é necessária.');
    } else {
      console.error('[FAIL] Teste interrompido: ' + safeQaCause(error));
    }
    if (process.argv.includes('--send-once')) {
      console.error('Não repetir --send-once sem consultar primeiro o histórico de ambas as contas.');
    }
    process.exitCode=1;
  });
}
module.exports={upcoming,authenticate,request,run,requireDenied,
  firstAccessibleOutsiderCommunity,firstPublicOutsiderSession,
  safeQaCause,readOnlyStage};
