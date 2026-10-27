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
const requests=[];
function token(user){
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  return [encode({alg:'none',typ:'JWT'}),encode({
    sub:user,Authorities:['ROLE_USER'],exp:Math.floor(Date.now()/1000)+3600
  }),'fixture'].join('.');
}
function reply(route,status,body){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),
    headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
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
      try{if(JSON.parse(String(message)).type==='AUTH')
        sock.send(JSON.stringify({type:'AUTHENTICATED',username}));}catch{}
    });
  });
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    if(url.origin===SITE) return route.continue();
    if(url.origin!=='https://api.d24sports.com' && url.origin!=='http://localhost:8080')
      return route.abort('blockedbyclient');
    const p=url.pathname,peer=username==='ana'?'bea':'ana';
    requests.push(username+':'+method+' '+p+(url.search||''));
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{
      'access-control-allow-origin':'*','access-control-allow-headers':'*',
      'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(method==='GET'&&p==='/api/friends/me')return reply(route,200,[{
      username:peer,nickname:peer==='bea'?'Bea':'Ana',fullName:null,chatBlocked:false,
      blockedByMe:false,profilePicUrl:null
    }]);
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
  await shelf.locator('.reaction-count').click({timeout:5000}); // real pointer; never force click
  const panel=shelf.locator('.reaction-picker');
  await panel.waitFor();
  const badge=await shelf.locator('.reaction-count').first().boundingBox();
  const tray=await panel.boundingBox();
  const emojiBoxes=await shelf.locator('.reaction-choice').evaluateAll(buttons =>
    buttons.map(b=>{const r=b.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right};}));
  assert.ok(badge && tray,'picker is visibly rendered');
  assert.ok(tray.y >= badge.y + badge.height + 3,
    'expanded picker must live UNDER the badge, not across the message');
  assert.ok(tray.y >= b.y + b.height + 3,'expanded picker overlaps message or timestamp');
  assert.ok(tray.width <= 270 && tray.height <= 105,
    `picker too large: ${tray.width}x${tray.height}`);
  assert.ok(tray.x>=0 && tray.x+tray.width<=page.viewportSize().width,
    'picker escapes viewport horizontally');
  assert.equal(emojiBoxes.length,6,'all six emojis available');
  assert.ok(emojiBoxes.every(x=>Math.abs(x.top-emojiBoxes[0].top)<2),
    'emoji row wraps instead of staying compact');
  const remove=await shelf.locator('.reaction-remove').boundingBox();
  if(remove) assert.ok(remove.y>=emojiBoxes[0].top+35,
    'remove action must be on its own secondary row');
  await page.screenshot({path:path.join(OUT,name+'-compact-picker.png')});
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
    const shelf=await assertClickable(a,'inbox','desktop-reaction-before');
    await shelf.locator('button[aria-label="👍"]').click();
    assert.deepEqual(writes,[],'re-select must not trigger DELETE');
    await shelf.locator('.reaction-count').click();
    await shelf.locator('button[aria-label="❤️"]').click();
    await a.waitForFunction(()=>document.querySelector('app-chat-reactions.inbox-reaction-under-message .reaction-count')?.textContent?.includes('❤️'));
    assert.deepEqual(writes,['ana:PUT:❤️']);
    await a.screenshot({path:path.join(OUT,'desktop-reaction-after.png')});
    const bea=await context(browser,'bea',390);
    const b=await bea.newPage();
    b.on('pageerror',e=>errors.push('bea: '+e.message));
    await b.goto(SITE+'/menu/messages?kind=direct&id=ana',{waitUntil:'domcontentloaded'});
    const mobile=await assertClickable(b,'inbox','mobile-peer-reaction');
    assert.match(await mobile.locator('.reaction-count').textContent(),/❤️/);
    await mobile.locator('button[aria-label="👍"]').click();
    await b.waitForFunction(()=>[...document.querySelectorAll('.reaction-count')].some(x=>x.textContent?.includes('👍')));
    assert.deepEqual(writes,['ana:PUT:❤️','bea:PUT:👍']);
    await a.reload({waitUntil:'domcontentloaded'});
    await a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').first().waitFor();
    assert.equal(await a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').count(),2);
    const heart=a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').filter({hasText:'❤️'});
    await heart.click();
    await a.locator('.reaction-remove').click();
    assert.deepEqual(writes,['ana:PUT:❤️','bea:PUT:👍','ana:DELETE']);
    await a.waitForFunction(() =>
      document.querySelectorAll('app-chat-reactions.inbox-reaction-under-message .reaction-count').length === 1,
      undefined, {timeout:7000});
    assert.equal(await a.locator('app-chat-reactions.inbox-reaction-under-message .reaction-count').count(),1);
    await a.screenshot({path:path.join(OUT,'desktop-after-explicit-removal.png')});
    await ana.close();await bea.close();
    assert.deepEqual(errors,[],'no Angular page errors');
    process.stdout.write('PASS: two synthetic users, desktop+390px hitboxes, reactions below date, click, replace, explicit remove, persisted counts.\\n');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
