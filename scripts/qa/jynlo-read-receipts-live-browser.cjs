#!/usr/bin/env node
'use strict';
// Opt-in production QA for direct-message read receipts.
// Sends exactly ONE message between existing QA users, with NO automatic retry.
// No passwords, tokens, message bodies, storage state, screenshots or traces are logged.
const { randomUUID } = require('node:crypto');
const { authenticate, request } = require('./jynlo-inbox-live-browser.cjs');

const SITE = 'https://d24sports.com';
const FROM = 'jynloteste01';
const TO = 'jynloteste02';
const TIMEOUT = 20_000;

function check(ok, label) {
  if (!ok) throw Error(label);
}

function receiptCovers(receipt, expectedPeer, messageId) {
  check(Number.isSafeInteger(messageId) && messageId > 0, 'INVALID_MESSAGE_ID');
  check(receipt && typeof receipt.peerUsername === 'string'
    && receipt.peerUsername.toLowerCase() === expectedPeer.toLowerCase()
    && Number.isSafeInteger(receipt.lastReadMessageId)
    && receipt.lastReadMessageId >= 0, 'INVALID_RECEIPT');
  return receipt.lastReadMessageId >= messageId;
}

async function receipt(token, peer, fetchImpl) {
  return request('/api/messages/inbox/direct/' + encodeURIComponent(peer) + '/receipt',
    { token, fetchImpl });
}

async function openPeer(context, peer) {
  const page = await context.newPage();
  await page.goto(SITE + '/menu/messages?kind=direct&id=' + encodeURIComponent(peer),
    { waitUntil: 'domcontentloaded', timeout: 35_000 });
  const selected = page.locator('.inbox-entry.is-selected');
  await selected.waitFor({ timeout: TIMEOUT });
  check((await selected.textContent() || '').toLowerCase().includes(peer), 'WRONG_PEER');
  await page.locator('.inbox-connection.is-online').waitFor({ timeout: TIMEOUT });
  await page.locator('#inbox-reply:enabled').waitFor({ timeout: TIMEOUT });
  return page;
}

async function run({ passwords = [process.env.JYNLO_QA_PASSWORD_1,
  process.env.JYNLO_QA_PASSWORD_2], fetchImpl = fetch,
chromiumImpl, report = console.log } = {}) {
  check(Array.isArray(passwords) && passwords.length === 2
    && passwords.every(p => typeof p === 'string' && p.length > 0), 'MISSING_QA_CREDENTIALS');
  const [senderToken, recipientToken] = await Promise.all([
    authenticate(FROM, passwords[0], fetchImpl),
    authenticate(TO, passwords[1], fetchImpl)
  ]);
  const chromium = chromiumImpl || require('playwright').chromium;
  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  let attemptedPost = false;
  try {
    for (const token of [senderToken, recipientToken]) {
      const ctx = await browser.newContext({ viewport:{ width:1440,height:900 }, locale:'pt-PT' });
      await ctx.addInitScript(t => localStorage.setItem('t',t), token);
      contexts.push(ctx);
    }
    // Do NOT open the recipient's conversation before sending. The existing
    // browser QA opens both users and therefore cannot test the unread stage.
    const sender = await openPeer(contexts[0], TO);
    const earlier = await receipt(senderToken, TO, fetchImpl);
    check(earlier && earlier.peerUsername?.toLowerCase() === TO, 'RECEIPT_ENDPOINT_UNAVAILABLE');

    const marker = '[Jynlo receipt QA] ' + randomUUID();
    let posts = 0;
    sender.on('request', req => {
      try {
        if (req.method() === 'POST'
            && new URL(req.url()).pathname === '/api/chat/me/' + TO) posts++;
      } catch { /* No request content is exposed. */ }
    });
    const responsePromise = sender.waitForResponse(res => {
      try {
        return res.request().method() === 'POST'
          && new URL(res.url()).pathname === '/api/chat/me/' + TO;
      } catch { return false; }
    }, { timeout: TIMEOUT });
    await sender.locator('#inbox-reply').fill(marker);
    attemptedPost = true;
    // Exactly one click. A timeout or ambiguous POST must NEVER trigger a retry.
    await sender.locator('.inbox-composer button[type="submit"]').click();
    const sentResponse = await responsePromise;
    check(sentResponse.ok(), 'SEND_NOT_CONFIRMED');
    const sent = await sentResponse.json();
    check(Number.isSafeInteger(sent?.id) && sent.id > 0
      && sent.username1?.toLowerCase() === FROM && sent.text === marker,
      'SEND_RESPONSE_UNEXPECTED');
    check(posts === 1, 'DUPLICATE_SEND');

    const bubble = sender.locator('.inbox-bubble[data-message-id="' + sent.id + '"]');
    await bubble.waitFor({ timeout: TIMEOUT });
    const checkMark = bubble.locator('.inbox-read-check');
    await checkMark.waitFor({ timeout: TIMEOUT });
    check((await checkMark.textContent() || '').trim() === '✓'
      && !(await checkMark.getAttribute('class') || '').split(/\s+/).includes('is-read'),
      'PREMATURE_BLUE_CHECK');
    const before = await receipt(senderToken, TO, fetchImpl);
    check(!receiptCovers(before, TO, sent.id), 'PREMATURE_SERVER_READ');
    report('[PASS] Envio único com visto simples antes de abrir a conta destinatária');

    const recipient = await openPeer(contexts[1], FROM);
    const identities = await Promise.all([sender,recipient]
      .map(page => page.evaluate(() => localStorage.getItem('t'))));
    check(identities[0] === senderToken && identities[1] === recipientToken
      && identities[0] !== identities[1], 'IDENTITY_ISOLATION_FAILED');
    await recipient.locator('.inbox-bubble[data-message-id="' + sent.id + '"]')
      .waitFor({ timeout: TIMEOUT });
    // Opening a conversation can mark its rendered history as read. Poll only
    // the new GET; never repeat message POSTs or read-marker PUTs from QA.
    let observed = false;
    for (let attempt = 0; attempt < 25 && !observed; attempt++) {
      const current = await receipt(senderToken, TO, fetchImpl);
      observed = receiptCovers(current, TO, sent.id);
      if (!observed) await new Promise(resolve => setTimeout(resolve, 800));
    }
    check(observed, 'READ_NOT_CONFIRMED_BY_SERVER');
    report('[PASS] Destinatário abriu a conversa; cursor de leitura confirmado no backend');
    // The UI polls every 45 seconds. This checks real automatic propagation
    // without a manual refresh or client-side inference of receipt state.
    await sender.locator('.inbox-bubble[data-message-id="' + sent.id
      + '"] .inbox-read-check.is-read').waitFor({ timeout: 75_000 });
    check((await checkMark.textContent() || '').trim() === '✓✓',
      'BLUE_CHECK_NOT_VISIBLE');
    check(await recipient.locator('.inbox-bubble[data-message-id="' + sent.id
      + '"] .inbox-read-check').count() === 0, 'INCOMING_CHECK_SHOULD_NOT_RENDER');
    check(posts === 1, 'DUPLICATE_SEND');
    report('[PASS] ✓✓ azul atualizado automaticamente; contas isoladas e mensagem recebida sem visto de envio');
  } catch (error) {
    // Stable error codes only: do not emit raw HTTP responses or Playwright errors.
    if (error instanceof Error
        && /^[A-Z_]+$/.test(error.message)) report('[FAIL] ' + error.message);
    else report('[FAIL] RECEIPT_QA_INTERRUPTED');
    if (attemptedPost) report('[INFO] Não repetir a execução sem consultar antes o histórico QA');
    throw Error('RECEIPT_QA_FAILED');
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== '--receipt-once') {
    console.error('Utilização: node scripts/qa/jynlo-read-receipts-live-browser.cjs --receipt-once');
    console.error('Este teste envia UMA mensagem QA. Não executar repetidamente.');
    process.exitCode = 2;
  } else run().catch(() => { process.exitCode = 1; });
}
module.exports = { receiptCovers, run };
