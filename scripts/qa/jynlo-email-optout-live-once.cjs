#!/usr/bin/env node
'use strict';

/*
 * One-use LIVE QA email delivery experiment. Only QA identities and a
 * private, single-member community created by this exact process.
 *
 * SAFETY: no external recipients, mandatory opt-in, exact QA address,
 * preflight creation quota, no duplicate invite POSTs on uncertainty,
 * try/finally cleanup and verified preference restoration.
 * The only optional email is the second QA-to-QA community invitation.
 */
const { randomBytes } = require('node:crypto');
const BASE = 'https://api.d24sports.com';
const QA = ['jynloteste01', 'jynloteste02'];
const QA_EMAIL_2 = 'desporto24app+jynloqa02@gmail.com';
const CONSENT = 'QA_ONLY_SEND_AND_CLEAN';
const WAIT = 12000;
const invariant = (ok, msg) => { if (!ok) throw Error(msg); };
const sameArray = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const samePreferences = (a,b) => a.inAppEnabled === b.inAppEnabled &&
  a.emailEnabled === b.emailEnabled &&
  sameArray(a.disabledEmailTypes,b.disabledEmailTypes) &&
  sameArray(a.disabledInAppTypes,b.disabledInAppTypes);
const isolated = (c, tag) => Number.isSafeInteger(c?.id) && c.id > 0 &&
  c.name === tag && c.visibility === 'PRIVATE' &&
  c.ownerUsername?.toLowerCase() === QA[0] &&
  c.memberCount === 1 && Array.isArray(c.members) &&
  c.members.length === 1 &&
  c.members[0]?.username?.toLowerCase() === QA[0];
const cleanPrefs = p => ({
  inAppEnabled:p.inAppEnabled, emailEnabled:p.emailEnabled,
  disabledInAppTypes:[...p.disabledInAppTypes],
  disabledEmailTypes:[...p.disabledEmailTypes]
});

function makeRunner({ fetchImpl = globalThis.fetch, output = console.log,
                      marker = () => Date.now().toString(36) + '-' + randomBytes(4).toString('hex') } = {}) {
  async function request(path, token, method = 'GET', body) {
    invariant(path.startsWith('/api/') && !path.includes('?'), 'Invalid API route');
    invariant(['GET','POST','PUT'].includes(method), 'Disallowed operation');
    const auth = path === '/api/auth/login';
    invariant(auth || !!token, 'Unauthorized request forbidden');
    const headers = { Accept:'application/json',
      ...(token ? {Authorization:'Bearer ' + token} : {}),
      ...(body !== undefined ? {'Content-Type':'application/json'} : {}) };
    let response;
    try {
      response = await fetchImpl(BASE + path, {method,headers,redirect:'error',
        signal:AbortSignal.timeout(WAIT),
        ...(body !== undefined ? {body:JSON.stringify(body)} : {})});
    } catch { throw Error('Network outcome unknown for ' + method + ' ' + path); }
    if (!(response.ok || (response.status === 204))) {
      throw Error('HTTP ' + response.status + ' from ' + method + ' ' + path);
    }
    if (response.status === 204) return null;
    try { return await response.json(); }
    catch { throw Error('Invalid JSON from ' + path); }
  }
  async function login(username,password) {
    const r = await request('/api/auth/login',null,'POST',{username,password});
    invariant(!r.mfaRequired && typeof r.token === 'string' && r.token.length > 30 &&
      r.profile?.username?.toLowerCase() === username,'Unexpected QA identity or MFA');
    return r.token;
  }
  async function preferences(token) {
    const p = await request('/api/notifications/me/preferences',token);
    invariant(p && typeof p.inAppEnabled === 'boolean' &&
      typeof p.emailEnabled === 'boolean' &&
      Array.isArray(p.disabledEmailTypes) && Array.isArray(p.disabledInAppTypes),
      'Preferences response invalid');
    return cleanPrefs(p);
  }
  async function putPreferences(token,p) {
    await request('/api/notifications/me/preferences',token,'PUT',p);
    invariant(samePreferences(await preferences(token),p),'QA preferences did not persist');
  }
  async function checkInvite(token,communityId,inviteId) {
    const list=await request('/api/communities/invites/me',token);
    invariant(Array.isArray(list) && list.some(x=>x.id===inviteId && x.communityId===communityId),
      'QA-only invitation not found on recipient account');
  }
  async function run({passwords, consent} = {}) {
    invariant(consent===CONSENT,'Explicit QA-only send-and-clean consent missing');
    invariant(Array.isArray(passwords) && passwords.length===2 &&
      passwords.every(p=>typeof p==='string' && p.length>0),'Protected QA passwords absent');
    const tokens=[];
    for (let i=0;i<2;i++) tokens.push(await login(QA[i],passwords[i]));
    const recipient=await request('/api/profile/me',tokens[1]);
    invariant(recipient?.username?.toLowerCase()===QA[1] &&
      recipient.email?.toLowerCase()===QA_EMAIL_2,
      'Recipient is not the exact allowlisted QA email; nothing sent');
    const sender=await request('/api/profile/me',tokens[0]);
    invariant(sender?.username?.toLowerCase()===QA[0],'Sender is not the QA owner');
    const quota=await request('/api/communities/creation-quota',tokens[0]);
    invariant(quota?.canCreate===true,'QA owner lacks room for an isolated group');
    const existing=await request('/api/communities/mine',tokens[0]);
    invariant(Array.isArray(existing),'Cannot inspect QA communities');
    const preInvites=await request('/api/communities/invites/me',tokens[1]);
    invariant(Array.isArray(preInvites),'Cannot inspect pending QA invitations');

    const original=await preferences(tokens[1]);
    const tag='JYNLO QA EMAIL '+marker();
    invariant(tag.length<100 && /^JYNLO QA EMAIL [a-z0-9-]+$/.test(tag),'Unsafe QA test marker');
    // A unique tag lets cleanup recover a POST that succeeded server-side but
    // whose response was lost. Never target a pre-existing community.
    const baselineIds=new Set(existing.map(c=>c.id));
    let created=null, creationAttempted=false, restored=false, deleted=false, phase='preflight';
    let cleanupError=null;
    try {
      const blocked={
        ...original,
        inAppEnabled:false,
        emailEnabled:true,
        disabledEmailTypes:[...new Set([...original.disabledEmailTypes,'COMMUNITY_INVITE'])]
      };
      await putPreferences(tokens[1],blocked);
      phase='muted';
      creationAttempted=true; // Set BEFORE sending; a network failure may hide success.
      const community=await request('/api/communities',tokens[0],'POST',{
        name:tag, description:'Isolated QA-only email preference test. No real events.',
        sport:null,visibility:'PRIVATE',sports:[]
      });
      // Capture a plausible ID even if another returned field is malformed.
      if (Number.isSafeInteger(community?.id) && community.id>0 &&
          !baselineIds.has(community.id)) created={id:community.id,name:tag};
      invariant(isolated(community,tag) && created,
        'New QA group returned unexpected privacy, owner or membership');
      phase='created';
      const first=await request('/api/communities/'+created.id+'/invites',tokens[0],'POST',
        {username:QA[1]});
      invariant(Number.isSafeInteger(first?.id) && first.communityId===created.id,
        'Muted QA invitation not confirmed; no retries');
      await checkInvite(tokens[1],created.id,first.id);
      output('[PASS] QA-only invite persisted with recipient email opt-out.');
      await request('/api/communities/invites/'+first.id+'/reject',tokens[1],'POST');
      phase='blocked-invite-rejected';

      const enabled={
        ...blocked,
        emailEnabled:true,
        disabledEmailTypes:original.disabledEmailTypes.filter(x=>x!=='COMMUNITY_INVITE')
      };
      await putPreferences(tokens[1],enabled);
      phase='allowed';
      const second=await request('/api/communities/'+created.id+'/invites',tokens[0],'POST',
        {username:QA[1]});
      invariant(Number.isSafeInteger(second?.id) && second.communityId===created.id,
        'Allowed QA invitation not confirmed; no retries');
      await checkInvite(tokens[1],created.id,second.id);
      output('[PASS] Allowed QA-only invitation persisted and optional email event committed.');
      await request('/api/communities/invites/'+second.id+'/reject',tokens[1],'POST');
      phase='allowed-invite-rejected';
    } finally {
      // Restore original preference values before attempting community cleanup.
      try {
        await putPreferences(tokens[1],original);
        restored=true;
        output('[PASS] Original recipient notification preferences restored.');
      } catch (error) { cleanupError=error; output('[FAIL] Preference restoration requires attention.'); }
      if (creationAttempted && !created) {
        // Recovery is READ ONLY until exactly one fresh, private QA-only match exists.
        // Zero matches after a lost response does NOT prove the POST did not commit.
        try {
          const groups=await request('/api/communities/mine',tokens[0]);
          invariant(Array.isArray(groups),'Cannot reconcile uncertain community creation');
          const matches=groups.filter(c=>c?.name===tag && !baselineIds.has(c.id));
          invariant(matches.length===1 && isolated(matches[0],tag),
            'Uncertain community creation; manual QA review required');
          created={id:matches[0].id,name:tag};
          output('[INFO] Recovered isolated QA community after ambiguous creation response.');
        } catch (error) {
          cleanupError=cleanupError||error;
          output('[FAIL] Community creation outcome uncertain; inspect QA-only marker before rerun.');
        }
      }
      if (created) {
        try {
          // Ensure it is STILL the QA-owned private group with no other members.
          const detail=await request('/api/communities/'+created.id,tokens[0]);
          invariant(isolated(detail,created.name) && detail.id===created.id &&
            !baselineIds.has(created.id), 'Refusing unsafe community deletion');
          await request('/api/communities/'+created.id+'/delete',tokens[0],'POST',
            {name:created.name});
          const groups=await request('/api/communities/mine',tokens[0]);
          invariant(Array.isArray(groups) && !groups.some(c=>c.id===created.id),
            'QA group still listed after deletion');
          const invites=await request('/api/communities/invites/me',tokens[1]);
          invariant(Array.isArray(invites) && !invites.some(i=>i.communityId===created.id),
            'Recipient still has a QA test invitation after deletion');
          deleted=true;
          output('[PASS] Temporary private QA community and its invitations deleted.');
        } catch (error) {
          cleanupError=cleanupError||error;
          output('[FAIL] QA-only group deletion requires attention. Never retry invitation.');
        }
      }
    }
    invariant(!cleanupError && restored && deleted,
      'QA cleanup failed: check isolated group and saved preferences before any rerun');
    output('[PASS] QA email flow complete; check actual Resend delivery and suppression externally.');
    output('[QA_MARKER] '+tag);
    return {phase,restored,deleted,tag};
  }
  return {run};
}
if(require.main===module) {
  makeRunner().run({
    passwords:[process.env.JYNLO_QA_PASSWORD_1,process.env.JYNLO_QA_PASSWORD_2],
    consent:process.env.JYNLO_QA_EMAIL_SEND_CONSENT
  }).catch(e=>{console.error('[FAIL]',e.message);process.exitCode=1;});
}
module.exports={makeRunner};
