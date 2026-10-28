/* Jynlo reaction browser regression: real built Angular UI, mocked private API.
 * Two independent fictitious accounts, zero production requests or credentials.
 * Verify click hitbox, timestamp separation, replacement and explicit removal.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { chromium }=require('playwright');
const SITE='http://127.0.0.1:4173';
const OUT=path.resolve('artifacts/chat-reactions');
fs.mkdirSync(OUT,{recursive:true});
const saved=new Map([['ana','👍']]);
const writes=[];
const errors=[];
const CHECK_CALLS=process.env.JYNLO_VERIFY_CALLS === '1';
const CHECK_GROUPS=process.env.JYNLO_VERIFY_GROUPS === '1';
const CHECK_CONTACT=process.env.JYNLO_VERIFY_CONTACT === '1';
const CHECK_PROFILE_INVITES=process.env.JYNLO_VERIFY_PROFILE_INVITES === '1';
const profileInvitePosts=[];
let group=null;
const groupTexts=[];
const groupWrites=[];
const callActions=[];
const callSockets=new Map();
const requests=[];
function token(user){
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  return [encode({alg:'none',typ:'JWT'}),encode({
    sub:user,Authorities:['ROLE_USER'],exp:Math.floor(Date.now()/1000)+3600
  }),'fixture'].join('.');
}
function reply(route,status,body){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),
    headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers':'*'}});
}
function record(id,actor){
  const counts={};
  if(id===41)for(const emoji of saved.values()) counts[emoji]=(counts[emoji]||0)+1;
  return {messageId:id,counts,myEmoji:id===41?(saved.get(actor)||null):null};
}
async function context(browser,username,width){
  const ctx=await browser.newContext({viewport:{width,height:850},locale:'pt-PT'});
  await ctx.addInitScript(t=>localStorage.setItem('t',t),token(username));
  await ctx.routeWebSocket('**/ws/chat',sock=>{
    sock.onMessage(message=>{
      try {
        if(JSON.parse(String(message)).type==='AUTH'){
          callSockets.set(username,sock);
          sock.send(JSON.stringify({type:'AUTHENTICATED',username}));
        }
      }catch{}
    });
  });
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    if(url.origin===SITE) return route.continue();
    if(url.origin!=='https://api.d24sports.com' && url.origin!=='http://localhost:8080')
      return route.abort('blockedbyclient');
    const p=url.pathname,peer=username==='ana'?'bea':'ana';
    if(CHECK_CALLS && method==='GET' && p==='/api/calls/direct/availability')
      return reply(route,200,{enabled:true});
    if(CHECK_CALLS && method==='POST' && p===`/api/calls/direct/${peer}`){
      callActions.push(username+':start:'+req.postDataJSON().media);
      return reply(route,409,{message:'Synthetic busy call'});
    }
    if(CHECK_CALLS && method==='POST' && /^\/api\/calls\/direct\/[\w-]+\/decline$/.test(p)){
      callActions.push(username+':decline');
      return reply(route,200,{});
    }
    requests.push(username+':'+method+' '+p+(url.search||''));
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{
      'access-control-allow-origin':'*','access-control-allow-headers':'*',
      'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(CHECK_CONTACT && method==='GET' && p.startsWith('/api/profile/')) {
      const who=decodeURIComponent(p.slice('/api/profile/'.length));
      return reply(route,200,{username:who,nickname:who==='bea'?'Bea':'Ana',
        fullName:null,profilePicUrl:null,location:'Lisboa',
        favoriteSports:'Futebol',bio:'Jogar com amigos',country:'Portugal'});
    }
    if(CHECK_PROFILE_INVITES && method==='GET' && p.startsWith('/api/profile/')) {
      const who=decodeURIComponent(p.slice('/api/profile/'.length));
      return reply(route,200,{username:who,nickname:who==='bea'?'Bea':'Ana',
        fullName:who==='bea'?'Bea Silva':'Ana Silva',profilePicUrl:null,
        location:'Lisboa',favoriteSports:null,bio:'Jogar com amigos',
        skillLevel:null,availability:null,age:28,country:'Portugal',
        joinDateDisplay:'22/10/2026'});
    }
    if(CHECK_PROFILE_INVITES && method==='GET') {
      if(/^\/api\/friends\/status\//.test(p))return reply(route,200,{friends:true,pendingRequest:false});
      if(/^\/api\/blocks\/users\/[^/]+\/status$/.test(p))return reply(route,200,{blocked:false});
      if(/^\/api\/follows\/[^/]+\/status$/.test(p))
        return reply(route,200,{followedByMe:false,followsMe:false,followers:1,following:2});
      if(/^\/api\/profiles\/[^/]+\/activity$/.test(p))
        return reply(route,200,{activitiesCompleted:3,peoplePlayedWith:8,
          sportsPractised:2,eventsCreated:1,participantsMobilized:12,
          communitiesJoined:1,achievements:[]});
    }
    if(method==='GET'&&p==='/api/friends/me')return reply(route,200,[
      {username:peer,nickname:peer==='bea'?'Bea':'Ana',fullName:null,
       chatBlocked:false,blockedByMe:false,profilePicUrl:null},
      ...(CHECK_GROUPS&&username==='ana'?[{username:'carla',nickname:'Carla',
        fullName:'Carla',chatBlocked:false,blockedByMe:false,profilePicUrl:null}]:[])
    ]);
    if(CHECK_GROUPS && p==='/api/private-groups' && method==='GET')
      return reply(route,200,group&&group.members.some(m=>m.username===username)?[group]:[]);
    if(CHECK_GROUPS && p==='/api/private-groups' && method==='POST'){
      const data=req.postDataJSON();
      assert.deepEqual(data,{title:'Equipa de sábado',usernames:['bea']});
      group={id:77,title:data.title,creatorUsername:'ana',createdAt:'2026-10-27T11:00:00Z',
        members:[{username:'ana',displayName:'Ana',profilePicUrl:null,admin:true},
        {username:'bea',displayName:'Bea',profilePicUrl:null,admin:false}]};
      groupWrites.push('created');return reply(route,200,group);
    }
    if(CHECK_GROUPS && p==='/api/test-group-photo.png' && method==='GET'){
      return route.fulfill({status:200,contentType:'image/png',headers:{
        'access-control-allow-origin':'*'},body:Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Xlnci0AAAAASUVORK5CYII=','base64')});
    }
    if(CHECK_GROUPS && p==='/api/private-groups/77/photo' && method==='POST'){
      if(username!=='ana')return reply(route,403,{message:'Only creator can update photo'});
      assert.match((await req.headerValue('content-type'))||'',/multipart\/form-data/);
      group.photoUrl='https://api.d24sports.com/api/test-group-photo.png';
      groupWrites.push('photo');
      return reply(route,200,group);
    }
    if(CHECK_GROUPS && p==='/api/private-groups/77/members' && method==='POST'){
      assert.deepEqual(req.postDataJSON(),{usernames:['carla']});
      group.members.push({username:'carla',displayName:'Carla',profilePicUrl:null,admin:false});
      groupWrites.push('invited');return reply(route,200,group);
    }

    if(CHECK_GROUPS && p==='/api/private-groups/77' && method==='PATCH'){
      if(username!=='ana')return reply(route,403,{message:'Only creator can rename'});
      const title=req.postDataJSON().title;
      assert.equal(title,'Futebol de sábado');
      group.title=title;groupWrites.push('renamed');
      return reply(route,200,group);
    }
    if(CHECK_GROUPS && p.startsWith('/api/private-groups/77/members/') && method==='DELETE'){
      const target=decodeURIComponent(p.split('/').pop());
      if(username!=='ana'&&username!==target)return reply(route,403,{message:'Forbidden'});
      if(target==='ana')return reply(route,409,{message:'Creator must transfer ownership'});
      group.members=group.members.filter(m=>m.username!==target);
      groupWrites.push('removed:'+target);
      return reply(route,200,group);
    }
    if(CHECK_GROUPS && p==='/api/private-groups/77/messages' && method==='GET')
      return reply(route,200,groupTexts);
    if(CHECK_GROUPS && p==='/api/private-groups/77/messages' && method==='POST'){
      const body=req.postDataJSON().text;assert.ok(body&&body.length<=2000);
      const msg={id:groupTexts.length+1,groupId:77,sender:username,text:body,
        createdAt:'2026-10-27T11:05:00Z'};
      groupTexts.push(msg);groupWrites.push(username+':message');
      return reply(route,200,msg);
    }
    if(CHECK_PROFILE_INVITES && method==='GET' && p==='/api/communities/mine') {
      if(username!=='ana')return reply(route,200,[]);
      const base={name:'Futebol sábado',sport:'Futebol',members:[]};
      return reply(route,200,[{...base,id:41,myRole:'OWNER'},
        {...base,id:42,myRole:'MEMBER'},
        {...base,id:43,myRole:'ADMIN',members:[{username:'bea'}]}]);
    }
    if(CHECK_PROFILE_INVITES && method==='GET' && p==='/api/sessions/mine') {
      if(username!=='ana')return reply(route,200,{created:[],joined:[],waitlisted:[]});
      const base={sport:'Futsal',city:'Lisboa',gameDate:new Date(Date.now()+86400_000).toISOString(),
        status:'OPEN',audience:'PUBLIC',privateGame:false};
      return reply(route,200,{created:[{...base,id:7},{...base,id:8,privateGame:true}],
        joined:[],waitlisted:[]});
    }
    if(CHECK_PROFILE_INVITES && method==='POST' && p==='/api/communities/41/invites') {
      assert.equal(username,'ana');
      assert.deepEqual(req.postDataJSON(),{username:'bea'});
      profileInvitePosts.push('community:41:bea');
      return reply(route,200,{id:400,communityId:41});
    }
    if(CHECK_PROFILE_INVITES && method==='POST' && p==='/api/sessions/7/invites') {
      assert.equal(username,'ana');
      assert.deepEqual(req.postDataJSON(),{username:'bea'});
      profileInvitePosts.push('session:7:bea');
      return reply(route,201,{id:500});
    }
    if(method==='GET'&&p==='/api/communities/mine')return reply(route,200,[]);
    if(method==='GET'&&p==='/api/sessions/mine')return reply(route,200,{created:[],joined:[],waitlisted:[]});
    if(method==='POST'&&p==='/api/messages/inbox/summaries')return reply(route,200,[{
      kind:'direct',id:peer,latestMessageId:41,latestText:'oi',latestSender:'bea',
      latestAt:'2026-10-26T20:15:00Z',unreadCount:0
    }]);
    if(method==='PUT'&&p==='/api/messages/inbox/read')return reply(route,200,{
      kind:'direct',id:peer,latestMessageId:41,latestText:'oi',latestSender:'bea',
      latestAt:'2026-10-26T20:15:00Z',unreadCount:0
    });
    if(method==='GET'&&p===`/api/messages/inbox/direct/${peer}/receipt`)return reply(route,200,{
      peerUsername:peer,lastReadMessageId:0
    });
    if(method==='GET'&&p===`/api/chat/me/${peer}/info`)return reply(route,200,{
      chatBlocked:false,whoBlocked:null
    });
    if(method==='GET'&&p===`/api/chat/me/${peer}/page`)return reply(route,200,{
      content:[{id:41,username1:'bea',username2:'ana',text:'oi',
        date:'2026-10-26T20:15:00Z',dataDisplay:null}],last:true
    });
    if(p===`/api/messages/reactions/direct/${peer}`&&method==='GET'){
      const ids=(url.searchParams.get('ids')||'').split(',').map(Number).filter(Number.isFinite);
      return reply(route,200,ids.map(id=>record(id,username)));
    }
    if(method==='GET'&&p===`/api/messages/reactions/direct/${peer}/41/participants`) {
      return reply(route,200,[...saved.entries()].map(([person,emoji])=>({
        username:person,displayName:person==='ana'?'Ana':'Bea',
        profilePicUrl:null,emoji,mine:person===username
      })));
    }
    const mutation=new RegExp('^/api/messages/reactions/direct/'+peer+'/([0-9]+)$').exec(p);
    if(mutation&&method==='PUT'){
      const emoji=req.postDataJSON().emoji;
      assert.ok(['👍','❤️','😂','🎉','👏','🔥'].includes(emoji),'supported emoji');
      saved.set(username,emoji);
      writes.push(username+':PUT:'+emoji);
      return reply(route,200,record(Number(mutation[1]),username));
    }
    if(mutation&&method==='DELETE'){
      saved.delete(username);writes.push(username+':DELETE');
      return reply(route,200,record(Number(mutation[1]),username));
    }
    if(method==='GET'&&p==='/api/notifications/me/unread-count')return reply(route,200,0);
    if(method==='GET'&&p==='/api/auth/google/config')return reply(route,200,{clientId:''});
    if(method==='POST'&&['/api/presence/heartbeat','/api/pilot/events/access'].includes(p))
      return reply(route,200,{});
    if(method==='POST'&&p==='/api/auth/refresh')return reply(route,401,{});
    // Optional peripheral requests cannot access production.
    return reply(route,404,{message:'synthetic fixture only'});
  });
  return ctx;
}
async function assertClickable(page,kind,name){
  const bubble=page.locator(kind==='inbox'?'.inbox-bubble[data-message-id="41"]':'.message').first();
  const shelf=page.locator(kind==='inbox'?'app-chat-reactions.inbox-reaction-under-message':'app-chat-reactions.direct-reaction-under-message').first();
  await bubble.waitFor();
  try {
    await shelf.locator('.reaction-count').waitFor({timeout:7000});
  } catch(e) {
    console.error('DIAGNOSTIC',JSON.stringify({
      kind,name,requests:requests.slice(-32),errors,
      bubbles:await page.locator('.inbox-bubble').count(),
      shelves:await page.locator('app-chat-reactions').count(),
      shelfHtml:await shelf.evaluate(el=>el.outerHTML).catch(()=>null),
      body:((await page.locator('body').innerText().catch(()=>''))||'').slice(-700)
    }));
    await page.screenshot({path:path.join(OUT,name+'-diagnostic.png')});
    throw e;
  }
  const b=await bubble.boundingBox(), c=await shelf.locator('.reaction-count').boundingBox();
  assert.ok(b&&c,'reaction and message are visible');
  // THE EXACT REPORTED REGRESSION: the badge must be below, not across the timestamp.
  assert.ok(c.y>=b.y+b.height+2,
    `reaction overlays message/date: bubbleBottom=${b.y+b.height}, badgeTop=${c.y}`);
  const target=await shelf.locator('.reaction-count').evaluate(btn=>{
    const r=btn.getBoundingClientRect(), el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return Boolean(el&&(el===btn||btn.contains(el)));
  });
  assert.ok(target,'reaction badge center is not hit-testable');
  assert.equal(await shelf.locator('.reaction-open').count(),0,'no duplicate permanent smiley');
  await page.screenshot({path:path.join(OUT,name+'.png')});
  const chip=shelf.locator('.reaction-count').first();
  if(await chip.count()===1) {
    const emojis=await shelf.locator('.reaction-count').allTextContents();
    if(emojis.length===1 && saved.size===1) {
      assert.equal(emojis[0].trim(),[...saved.values()][0],
        'single reaction must have no numeric count');
    }
  }
  // The user's own emoji now removes on click. Use its dedicated info icon
  // to open details; an emoji from another person still opens names directly.
  const detailsAction=(await shelf.locator('.reaction-details-trigger').count())
    ? shelf.locator('.reaction-details-trigger') : chip;
  await detailsAction.click({timeout:5000}); // real pointer, no force
  const dialog=shelf.locator('.reaction-details-dialog');
  await dialog.waitFor();
  await shelf.locator('.reaction-person').first().waitFor();
  const detailBox=await dialog.boundingBox();
  assert.ok(detailBox && detailBox.width<=425 && detailBox.height<=550,
    'compact modal must not overflow expected bounds');
  assert.ok(detailBox.x>=0 && detailBox.x+detailBox.width<=page.viewportSize().width,
    'reaction details must stay inside viewport');
  assert.equal(await shelf.locator('.reaction-details-add').count(),1);
  await page.screenshot({path:path.join(OUT,name+'-details-dialog.png')});
  return shelf;
}
async function main(){
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],
    ...(process.env.JYNLO_USE_SYSTEM_CHROME==='1'?{channel:'chrome'}:{})});
  try{
    const ana=await context(browser,'ana',1440);
    const a=await ana.newPage();
    a.on('pageerror',e=>errors.push('ana: '+e.message));
    await a.goto(SITE+'/menu/messages?kind=direct&id=bea',{waitUntil:'domcontentloaded'});
    if(CHECK_CONTACT){
      const label=await a.locator('.inbox-contact-caption').innerText();
      assert.equal(label.trim(),'Ver perfil','chat header must show translated PT label, not i18n key');
      await a.locator('.inbox-contact-opener').click();
      const panel=a.locator('.contact-panel');
      await panel.waitFor();
      const close=a.locator('.contact-close');
      assert.equal(await close.locator('svg path').count(),1,
        'close control must use a centered SVG, not a font glyph');
      const buttonBox=await close.boundingBox();
      assert.ok(buttonBox && buttonBox.width===36 && buttonBox.height===36,
        'close button should have a consistent 36px hit target');
      const titleBox=await panel.locator('#contact-title').boundingBox();
      assert.ok(titleBox && buttonBox.x>titleBox.x+titleBox.width,
        'standard close button should be at the top right');
      await panel.locator('.contact-identity h2').filter({hasText:'Bea'}).waitFor();
      assert.match(await panel.innerText(),/Lisboa/);
      assert.equal(await panel.locator('a[href*="/menu/perfis/bea"]').count(),1);
      const group=panel.locator('a[href*="/menu/groups"]');
      assert.equal(await group.count(),1);
      assert.match(await group.getAttribute('href'),/from=bea/);
      assert.equal(await panel.locator('a[href*="/menu/messages"]').count(),1);
      await a.screenshot({path:path.join(OUT,'contact-preview-desktop.png')});
      await panel.locator('.contact-close').click();
      await panel.waitFor({state:'detached'});
      const sender=a.locator('.inbox-bubble-meta button.inbox-sender-profile').first();
      await sender.waitFor();
      await sender.click();
      await panel.waitFor();
      await panel.locator('.contact-identity h2').filter({hasText:'Bea'}).waitFor();
      await a.screenshot({path:path.join(OUT,'contact-preview-sender.png')});
      await panel.locator('.contact-close').click();
      await panel.waitFor({state:'detached'});
    }

    const shelf=await assertClickable(a,'inbox','desktop-reaction-before');
    assert.equal(await shelf.locator('.reaction-details-remove').count(),1,
      'your own reaction is always removable');
    await shelf.locator('.reaction-details-add').click();
    await shelf.locator('.reaction-details-chooser').waitFor();
    assert.deepEqual(writes,[],'opening participants and emoji chooser must not change reaction');
    await shelf.locator('.reaction-details-chooser button[aria-label="❤️"]').click();
    await a.waitForFunction(()=>document.querySelector('app-chat-reactions.inbox-reaction-under-message .reaction-count')?.textContent?.includes('❤️'));
    assert.deepEqual(writes,['ana:PUT:❤️']);
    assert.equal((await shelf.locator('.reaction-count').textContent()).trim(),'❤️',
      'a single heart must not display 1');
    await a.screenshot({path:path.join(OUT,'desktop-one-heart.png')});

    const bea=await context(browser,'bea',390);
    const b=await bea.newPage();
    b.on('pageerror',e=>errors.push('bea: '+e.message));
    await b.goto(SITE+'/menu/messages?kind=direct&id=ana',{waitUntil:'domcontentloaded'});
    const mobile=await assertClickable(b,'inbox','mobile-peer-reaction');
    assert.match(await mobile.locator('.reaction-person-name').first().textContent(),/Ana/);
    assert.equal(await mobile.locator('.reaction-details-remove').count(),0,
      'you cannot delete someone else\'s reaction');
    await mobile.locator('.reaction-details-add').click();
    await mobile.locator('.reaction-details-chooser button[aria-label="❤️"]').click();
    await b.waitForFunction(()=>document.querySelector('.reaction-count')?.textContent?.includes('2'));
    assert.deepEqual(writes,['ana:PUT:❤️','bea:PUT:❤️']);
    assert.equal((await mobile.locator('.reaction-count').textContent()).replace(/\s/g,''),'❤️2',
      'a reaction count appears only when there are two or more');
    await mobile.locator('.reaction-details-trigger').click();
    await mobile.locator('.reaction-person').first().waitFor();
    assert.equal(await mobile.locator('.reaction-person').count(),2);
    await b.screenshot({path:path.join(OUT,'mobile-two-hearts-details.png')});
    // THIS IS THE USER-REPORTED BUG: tapping Bea's OWN displayed ❤️ 2
    // must DELETE immediately and never open the people dialog. Ana keeps ❤️.
    await mobile.locator('.reaction-details-close').click();
    const selectedBadge=mobile.locator('.reaction-count').first();
    assert.match(await selectedBadge.getAttribute('aria-label'),/Remover/);
    await selectedBadge.click({timeout:5000});
    assert.deepEqual(writes,['ana:PUT:❤️','bea:PUT:❤️','bea:DELETE']);
    assert.equal(await mobile.locator('.reaction-details-dialog').count(),0);
    await b.waitForFunction(()=>document.querySelectorAll('.reaction-count').length===1
      && document.querySelector('.reaction-count')?.textContent?.trim()==='❤️');
    await b.screenshot({path:path.join(OUT,'mobile-after-direct-badge-removal.png')});
    // Another person's reaction is untouched; clicking it opens details.
    await mobile.locator('.reaction-count').click();
    await mobile.locator('.reaction-details-add').click();
    await mobile.locator('.reaction-details-chooser button[aria-label="👍"]').click();
    await b.waitForFunction(()=>[...document.querySelectorAll('.reaction-count')].some(x=>x.textContent?.includes('👍')));
    assert.deepEqual(writes,['ana:PUT:❤️','bea:PUT:❤️','bea:DELETE','bea:PUT:👍']);

    await a.reload({waitUntil:'domcontentloaded'});
    await a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').first().waitFor();
    assert.equal(await a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').count(),2);
    const heart=a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').filter({hasText:'❤️'});
    // Ana can still see all participant details through the separate ⓘ icon.
    await a.locator('.reaction-details-trigger').click();
    await a.locator('.reaction-person').first().waitFor({timeout:7000});
    const personCount=await a.locator('.reaction-person').count();
    assert.equal(personCount,2,'participant detail shows both actors for different emojis');
    await a.locator('.reaction-details-remove').click();
    assert.deepEqual(writes,['ana:PUT:❤️','bea:PUT:❤️','bea:DELETE','bea:PUT:👍','ana:DELETE']);
    await a.waitForFunction(() =>
      document.querySelectorAll('app-chat-reactions.inbox-reaction-under-message .reaction-count').length === 1,
      undefined, {timeout:7000});
    assert.equal((await a.locator('.reaction-count').first().textContent()).trim(),'👍');
    await a.screenshot({path:path.join(OUT,'desktop-after-explicit-removal.png')});
    if(CHECK_CALLS){
      // An incoming call is rendered in the global overlay even when user
      // is already in a different chat; no LiveKit credentials or microphones.
      const incoming={type:'DIRECT_CALL_EVENT',call:{
        callId:'139c55a0-6b16-4de2-b055-d9940fddce5a',
        caller:'ana',peer:'bea',actor:'ana',media:'video',status:'RINGING',
        expiresAt:new Date(Date.now()+60000).toISOString()
      }};
      assert.ok(callSockets.get('bea'),'Bea authenticated websocket');
      callSockets.get('bea').send(JSON.stringify(incoming));
      await b.locator('.call-panel').waitFor({timeout:7000});
      assert.match(await b.locator('.call-panel').innerText(),/Videochamada/);
      await b.screenshot({path:path.join(OUT,'incoming-video-call-mock.png')});
      await b.locator('.call-panel .call-decline').click();
      assert.deepEqual(callActions,['bea:decline']);
      await b.locator('.call-panel').waitFor({state:'detached'});
      await a.locator('.inbox-call-trigger').first().waitFor({timeout:7000});
      await a.locator('.inbox-call-trigger').first().click();
      await a.locator('.call-panel').waitFor();
      assert.match(await a.locator('.call-panel').innerText(),/Não foi possível iniciar/);
      assert.deepEqual(callActions,['bea:decline','ana:start:voice']);
      await a.locator('.call-panel .call-decline').click();
      await a.locator('.call-panel').waitFor({state:'detached'});
    }
    if(CHECK_GROUPS){
      await a.goto(SITE+'/menu/messages?kind=direct&id=bea',{waitUntil:'domcontentloaded'});
      await a.locator('.inbox-group-create').waitFor({timeout:7000});
      await a.locator('.inbox-group-create').click();
      await a.locator('.group-modal').waitFor();
      await a.locator('.group-modal input[type="text"]').fill('Equipa de sábado');
      const checks=a.locator('.group-friend input[type="checkbox"]');
      assert.equal(await checks.count(),2);
      assert.equal(await checks.first().isChecked(),true,'initial DM peer must be preselected');
      await a.locator('.group-submit').click();
      await a.locator('.group-chat-header').waitFor({timeout:7000});
      assert.deepEqual(groupWrites,['created']);
      await a.screenshot({path:path.join(OUT,'group-created-desktop.png')});
      await a.locator('.group-header-button').filter({hasText:'Alterar nome'}).click();
      await a.locator('.group-modal input[name="renameTitle"]').fill('Futebol de sábado');
      await a.locator('.group-modal .group-submit').click();
      await a.locator('.group-chat-header h2').filter({hasText:'Futebol de sábado'}).waitFor();
      assert.deepEqual(groupWrites,['created','renamed']);
      await a.locator('.group-photo-input').setInputFiles({name:'team.png',mimeType:'image/png',
        buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Xlnci0AAAAASUVORK5CYII=','base64')});
      await a.locator('.group-header-avatar img').waitFor();
      await a.locator('.group-entry.current .group-circle img').waitFor();
      assert.equal(groupWrites.at(-1),'photo');
      await a.screenshot({path:path.join(OUT,'group-photo-updated.png')});
      await a.locator('.group-compose textarea').fill('Olá equipa!');
      await a.locator('.group-compose button').click();
      await a.locator('.group-bubble').first().waitFor();
      assert.match(await a.locator('.group-bubble').first().innerText(),/Olá equipa/);
      await a.locator('.group-header-button').filter({hasText:'Adicionar membros'}).click();
      await a.locator('.group-modal').waitFor();
      const carla=a.locator('.group-friend').filter({hasText:'Carla'});
      await carla.locator('input[type=checkbox]').check();
      await a.locator('.group-submit').click();
      await a.locator('.group-member-links a').filter({hasText:'Carla'}).waitFor();
      assert.deepEqual(groupWrites,['created','renamed','photo','ana:message','invited']);
      await a.screenshot({path:path.join(OUT,'group-added-third-person.png')});
      await b.goto(SITE+'/menu/groups?id=77',{waitUntil:'domcontentloaded'});
      await b.locator('.group-chat-header').waitFor();
      assert.equal(await b.locator('.group-bubble').count(),1);
      assert.equal(await b.locator('.group-header-button').count(),1,
        'non-creator can leave but must not manage other members');
      assert.match(await b.locator('.group-header-button').innerText(),/Sair do grupo/);
      assert.equal(await b.locator('.group-member-remove').count(),0,
        'non-creator must not see remove-member controls');
      assert.equal(await b.locator('.group-member-links a[href*="/menu/perfis/ana"]').count(),1);
      await b.screenshot({path:path.join(OUT,'group-member-mobile.png')});
      await a.locator('.group-member-chip').filter({hasText:'Carla'}).locator('button').click();
      await a.locator('[role="alertdialog"] .group-submit').click();
      await a.locator('.group-member-chip').filter({hasText:'Carla'}).waitFor({state:'detached'});
      assert.ok(!group.members.some(m=>m.username==='carla'));
      await b.locator('.group-header-button').click();
      await b.locator('[role="alertdialog"] .group-submit').click();
      await b.locator('.group-welcome').waitFor();
      assert.ok(!group.members.some(m=>m.username==='bea'));
      assert.deepEqual(groupWrites,['created','renamed','photo','ana:message','invited','removed:carla','removed:bea']);
    }
    if(CHECK_PROFILE_INVITES){
      await a.setViewportSize({width:1440,height:900});
      await a.goto(SITE+'/menu/perfis/bea',{waitUntil:'domcontentloaded'});
      await a.locator('.profile-detail .profile-identity h1').filter({hasText:'bea'}).waitFor({timeout:8000});
      assert.equal(await a.locator('.profile-meta > div').count(),3,
        'only supplied country, age and member-since fields should render');
      const hero=a.locator('.profile-hero');
      const header=await a.locator('.profile-hero .detail-heading').boundingBox();
      const actions=await a.locator('.profile-hero .detail-actions').boundingBox();
      assert.ok(header&&actions&&actions.x>header.x+header.width-5,
        'approved desktop hero places social actions to the right of the identity');
      assert.equal(await a.locator('.profile-meta .profile-stat-icon svg').count(),3,
        'each populated public detail has its own icon');
      await a.locator('.public-activity-grid .profile-activity-card').first().waitFor();
      assert.equal(await a.locator('.public-activity-grid .profile-activity-card').count(),4);
      const top=await a.locator('.profile-meta').boundingBox();
      const activity=await a.locator('.public-activity').boundingBox();
      assert.ok(top&&activity&&activity.y>=top.y+top.height,
        'activities must be visually separated from profile details');
      assert.ok(await hero.isVisible());
      await a.locator('.profile-invite-trigger').click();
      const panel=a.locator('.profile-invite-panel');
      await panel.waitFor();
      await panel.locator('.profile-invite-option').first().waitFor({timeout:8000});
      assert.equal(await panel.locator('.profile-invite-option').count(),1,
        'only one eligible managed community may be invited');
      assert.match(await panel.innerText(),/Futebol sábado/);
      assert.ok(!(await panel.innerText()).includes('Membro'), 'do not expose unmanaged groups');
      await a.screenshot({path:path.join(OUT,'premium-profile-invite-community-desktop.png')});
      await panel.locator('.profile-invite-option button').click();
      await panel.locator('.profile-invite-option button:disabled').first().waitFor({timeout:8000});
      assert.equal(await panel.locator('.profile-invite-option button:disabled').count(),1);
      await panel.locator('.profile-invite-tabs button').nth(1).click();
      assert.equal(await panel.locator('.profile-invite-option').count(),1,
        'private sessions must not appear in invitation chooser');
      await a.screenshot({path:path.join(OUT,'premium-profile-invite-session-desktop.png')});
      await panel.locator('.profile-invite-option button').click();
      await panel.locator('.profile-invite-option button:disabled').first().waitFor();
      assert.deepEqual(profileInvitePosts,['community:41:bea','session:7:bea']);
      await a.locator('.profile-invite-trigger').click();
      await panel.waitFor({state:'detached'});
      await b.goto(SITE+'/menu/perfis/ana',{waitUntil:'domcontentloaded'});
      await b.locator('.profile-detail').waitFor();
      await b.locator('.profile-invite-trigger').click();
      await b.locator('.profile-invite-panel').waitFor();
      const box=await b.locator('.profile-detail').boundingBox();
      assert.ok(box && box.x>=0 && box.x+box.width<=391, 'profile must fit 390px mobile');
      const mobileClipping=await b.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      assert.equal(mobileClipping,false,'responsive premium profile cannot overflow mobile viewport');
      assert.equal(await b.locator('.profile-meta .profile-stat-icon svg').count(),3);
      assert.equal(await b.locator('.public-activity-grid .profile-activity-card').count(),4);
      await b.screenshot({path:path.join(OUT,'premium-profile-invite-mobile.png')});
      assert.deepEqual(profileInvitePosts,['community:41:bea','session:7:bea'],
        'no sends should happen without explicit inviter action');
    }
    await ana.close();await bea.close();
    assert.deepEqual(errors,[],'no Angular page errors');
    process.stdout.write('PASS: tapping own DISPLAYED emoji directly removes only own reaction, without modal; independent people details remain, replacement, counts, desktop/mobile.\\n');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
