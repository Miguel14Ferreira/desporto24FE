#!/usr/bin/env node
'use strict';

/*
 * Real API-only integration test for Jynlo's persistent inbox read state.
 * NO credentials in source, commits, argv, stdout, or HTTP error messages.
 * Default: preflight only. `--ensure-friends` safely invites and accepts
 * friendship between the two QA accounts. `--send-once` sends ONE QA message.
 * Never retry an ambiguous POST. Does NOT validate browser DOM/WebSocket UI.
 * Requires Node.js >= 22 and two disposable QA accounts.
 */
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const API = 'https://api.d24sports.com';
const ACCOUNTS = ['jynloteste01', 'jynloteste02'];
const MAX_MS = 12_000;

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

function createRunner({ fetchImpl = globalThis.fetch, output = console.log } = {}) {
  verify(typeof fetchImpl === 'function', 'Node.js 22 ou superior é obrigatório.');
  async function request(path, options = {}, token = null) {
    const headers = { 'Accept': 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const abort = AbortSignal.timeout(MAX_MS);
    let resp;
    try {
      resp = await fetchImpl(API + path, { ...options, headers, signal: abort, redirect: 'error' });
    } catch {
      // A failed POST can have been committed server-side. NEVER retry it here.
      throw new Error('Pedido de rede não confirmado (' + (options.method || 'GET') + ' ' + path.split('?')[0] + '). Não repetir o envio sem consultar o histórico.');
    }
    if (!resp.ok) {
      // Never print response bodies: backend may include sensitive context.
      throw new Error('HTTP ' + resp.status + ' em ' + (options.method || 'GET') + ' ' + path.split('?')[0]);
    }
    try { return await resp.json(); }
    catch { throw new Error('Resposta JSON inválida em ' + path.split('?')[0]); }
  }
  async function login(username, password) {
    const r = await request('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    });
    verify(!r.mfaRequired, 'MFA ativo numa conta QA: interrompido sem contornar autenticação.');
    verify(typeof r.token === 'string' && r.token.length > 30, 'O login não devolveu um token válido.');
    verify(r.profile && r.profile.username && r.profile.username.toLowerCase() === username,
      'Identidade autenticada diferente da conta QA esperada.');
    return r.token;
  }
  async function summary(token, peer) {
    const all = await request('/api/messages/inbox/summaries', {
      method: 'POST', body: JSON.stringify({ conversations: [{ kind: 'direct', id: peer }] })
    }, token);
    verify(Array.isArray(all) && all.length === 1, 'Resumo da conversa inacessível ou incompleto.');
    const value = all[0];
    verify(value.kind === 'direct' && value.id.toLowerCase() === peer,
      'O backend devolveu uma conversa inesperada.');
    verify(Number.isSafeInteger(value.unreadCount) && value.unreadCount >= 0,
      'Contador de não lidas inválido.');
    return value;
  }
  async function friendshipStatus(token, other) {
    const status = await request('/api/friends/status/' + encodeURIComponent(other), {}, token);
    verify(typeof status.friends === 'boolean' && typeof status.pendingRequest === 'boolean',
      'Resposta de amizade inesperada da API.');
    return status;
  }

  async function findQaInvitation(recipient, recipientToken, sender) {
    const notifications = await request('/api/notifications/me', {}, recipientToken);
    verify(Array.isArray(notifications), 'Resposta de notificações inesperada.');
    // Legacy friend-request notifications have no structured sender field.
    // Match the backend's exact sentence and the authenticated recipient,
    // never an unrelated invitation. The token stays only in memory.
    const expected = 'vindo de ' + sender + '.';
    const matches = notifications.filter(n =>
      n && n.friendRequest === true
      && typeof n.username === 'string' && n.username.toLowerCase() === recipient
      && typeof n.message === 'string' && n.message.includes(expected)
      && typeof n.token === 'string' && n.token.length > 0
      && Number.isSafeInteger(n.id) && n.id > 0);
    verify(matches.length <= 1, 'Há vários pedidos QA indistinguíveis. Verificar nas notificações manualmente.');
    return matches[0] || null;
  }

  async function ensureFriendship(one, tokenOne, two, tokenTwo) {
    const first = await friendshipStatus(tokenOne, two);
    const second = await friendshipStatus(tokenTwo, one);
    if (first.friends && second.friends) {
      output('[PASS] As duas contas QA já são amigas; não foi criado qualquer convite.');
      return;
    }
    verify(first.friends === second.friends, 'Estados de amizade contraditórios; operação interrompida.');
    const pending = first.pendingRequest || second.pendingRequest;
    let invited = await findQaInvitation(two, tokenTwo, one);
    let acceptToken = tokenTwo;
    let acceptAccount = two;
    if (!invited) {
      invited = await findQaInvitation(one, tokenOne, two);
      acceptToken = tokenOne;
      acceptAccount = one;
    }
    if (!pending) {
      // A notification could be stale: never accept it without a pending request.
      verify(!invited, 'Notificação antiga sem pedido pendente. Verificar antes de continuar.');
      // POST exactly once, even if the network result is ambiguous.
      await request('/api/friends/add/' + encodeURIComponent(two), { method: 'POST' }, tokenOne);
      output('[PASS] Pedido de amizade QA enviado uma única vez.');
      invited = await findQaInvitation(two, tokenTwo, one);
      acceptToken = tokenTwo;
      acceptAccount = two;
    }
    verify(invited,
      'Existe um pedido pendente mas nenhuma notificação QA correspondente. Não reenviar convite; verificar notificações.');
    // Accepted only by the owner of this exact notification.
    await request('/api/notifications/friend-request/' + invited.id + '/accept',
      { method: 'POST' }, acceptToken);
    output('[PASS] Convite QA aceite pela conta ' + acceptAccount + '.');
    const after1 = await friendshipStatus(tokenOne, two);
    const after2 = await friendshipStatus(tokenTwo, one);
    verify(after1.friends && after2.friends,
      'A aceitação não produziu uma amizade confirmada em ambas as contas.');
    output('[PASS] Amizade QA confirmada nos dois perfis.');
  }

  async function preflight(username1, token1, username2, token2) {
    for (const [username, token, other] of [[username1, token1, username2], [username2, token2, username1]]) {
      const f = await request('/api/friends/status/' + encodeURIComponent(other), {}, token);
      verify(f.friends === true, 'As contas QA ainda não são amigas. Nenhuma mensagem foi enviada.');
      const info = await request('/api/chat/me/' + encodeURIComponent(other) + '/info', {}, token);
      verify(info.chatBlocked === false, 'Chat das contas QA bloqueado. Nenhuma mensagem foi enviada.');
      output('[PASS] Amizade e permissões do chat verificadas para ' + username);
    }
    const from = await summary(token1, username2);
    const to = await summary(token2, username1);
    output('[PASS] Resumos autenticados obtidos em ambas as contas (sem revelar conteúdo).');
    return { from, to };
  }
  async function run({ passwords, sendOnce = false, ensureFriends = false } = {}) {
    verify(Array.isArray(passwords) && passwords.length === 2 && passwords.every(x => typeof x === 'string' && x.length > 0),
      'Definir JYNLO_QA_PASSWORD_1 e JYNLO_QA_PASSWORD_2 sem as colocar no terminal ou repositório.');
    const started = performance.now();
    const [one, two] = ACCOUNTS;
    const a = await login(one, passwords[0]);
    const b = await login(two, passwords[1]);
    output('[PASS] Duas sessões autenticadas, sem imprimir credenciais ou tokens.');
    if (ensureFriends) await ensureFriendship(one, a, two, b);
    const before = await preflight(one, a, two, b);
    if (!sendOnce) {
      output('[PASS] Pré-validação de produção apenas-leitura (exceto autenticação). Para enviar UMA mensagem QA: --send-once');
      return { phase: 'preflight', elapsedMs: Math.round(performance.now() - started) };
    }
    const text = '[Jynlo QA - leitura persistente] ' + randomUUID();
    // This POST is deliberately ONCE. A timeout is ambiguous: do not retry.
    const sent = await request('/api/chat/me/' + encodeURIComponent(two), {
      method: 'POST', body: JSON.stringify({ text })
    }, a);
    verify(Number.isSafeInteger(sent.id) && sent.id > 0
      && sent.username1.toLowerCase() === one && sent.username2.toLowerCase() === two
      && sent.text === text, 'O servidor não confirmou a mensagem QA como esperado.');
    output('[PASS] Uma mensagem única QA enviada e confirmada pela API.');
    const afterSend = await summary(b, one);
    verify(afterSend.unreadCount >= before.to.unreadCount + 1,
      'O contador da conta destinatária não aumentou após uma nova mensagem.');
    const senderAfter = await summary(a, two);
    verify(senderAfter.unreadCount === before.from.unreadCount,
      'Mensagem enviada incorretamente contabilizada como não lida do remetente.');
    output('[PASS] Contagem aumentou apenas no destinatário.');
    const history = await request('/api/chat/me/' + encodeURIComponent(one) + '/page?page=0&size=30', {}, b);
    verify(Array.isArray(history.content) && history.content.some(x => x.id === sent.id && x.text === text),
      'Mensagem enviada não aparece no histórico autorizado do destinatário.');
    output('[PASS] Mensagem confirmada pelo GET do histórico do destinatário.');
    const read = await request('/api/messages/inbox/read', {
      method: 'PUT', body: JSON.stringify({ kind: 'direct', id: one, lastSeenMessageId: sent.id })
    }, b);
    verify(Number.isSafeInteger(read.unreadCount) && read.unreadCount < afterSend.unreadCount,
      'A API não atualizou o contador após leitura da mensagem.');
    const afterRead = await summary(b, one);
    verify(afterRead.unreadCount === read.unreadCount,
      'A consulta da mesma sessão não confirmou o cursor de leitura persistente.');
    output('[PASS] Leitura persistida e contador atualizado no servidor.');
    const secondSession = await login(two, passwords[1]);
    const fromSecondSession = await summary(secondSession, one);
    verify(fromSecondSession.unreadCount === read.unreadCount,
      'Nova sessão autenticada não herdou o estado de leitura persistente.');
    output('[PASS] Novo login do mesmo utilizador recuperou a contagem de leitura.');
    output('[PASS] Teste real da API concluído (sem testar DOM ou WebSocket).');
    return { phase: 'completed', elapsedMs: Math.round(performance.now() - started) };
  }
  return { run };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(x => !['--send-once', '--ensure-friends'].includes(x))) {
    console.error('Utilização: node scripts/qa/jynlo-inbox-live-qa.cjs [--ensure-friends] [--send-once]');
    process.exitCode = 2;
  } else {
    createRunner().run({
      passwords: [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2],
      sendOnce: args.includes('--send-once'),
      ensureFriends: args.includes('--ensure-friends')
    }).catch(err => {
      console.error('[FAIL] ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
      process.exitCode = 1;
    });
  }
}
module.exports = { createRunner };
