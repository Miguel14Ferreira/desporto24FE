#!/usr/bin/env node
'use strict';

/*
 * Read-only live notification smoke for the two pre-authorized disposable QA
 * accounts. No writes to notification preferences, invites, friendships, or
 * mail; no external provider API calls. Authentication is POST /api/auth/login
 * only. Passwords and JWTs stay in memory and are never printed or persisted.
 * Credentials must arrive via protected environment variables.
 */
const API = 'https://api.d24sports.com';
const ACCOUNTS = ['jynloteste01', 'jynloteste02'];
const TIMEOUT_MS = 12_000;

function check(ok, message) {
  if (!ok) throw new Error(message);
}

function category(alert) {
  if (typeof alert.type === 'string' && alert.type) return alert.type;
  if (alert.friendRequest === true) return 'FRIEND_REQUEST';
  if (alert.updateProfile === true) return 'PROFILE_UPDATE';
  return 'OTHER';
}

function createRunner({ fetchImpl = globalThis.fetch, output = console.log } = {}) {
  check(typeof fetchImpl === 'function', 'É necessário Node.js 22 ou superior.');

  async function request(path, token, options = {}) {
    // The only POST is the explicit QA login endpoint.
    const method = options.method || 'GET';
    check(method === 'GET' || (method === 'POST' && path === '/api/auth/login'),
      'Método não autorizado na auditoria de leitura.');
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetchImpl(API + path, {
        method, headers, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
      });
    } catch {
      throw new Error('Falha de rede na verificação ' + method + ' ' + path + '.');
    }
    return response;
  }

  async function read(response, path) {
    check(response.ok, 'HTTP ' + response.status + ' no endpoint ' + path + '.');
    try { return await response.json(); }
    catch { throw new Error('Resposta JSON inválida em ' + path + '.'); }
  }

  async function login(username, password) {
    check(typeof password === 'string' && password.length > 0,
      'Credenciais QA ausentes. Configurar secrets protegidos, sem as expor em mensagens ou logs.');
    const result = await read(await request('/api/auth/login', null, {
      method: 'POST', body: { username, password }
    }), '/api/auth/login');
    check(result.mfaRequired !== true, 'A conta QA requer MFA; teste interrompido sem contornar MFA.');
    check(typeof result.token === 'string' && result.token.length > 30
      && result.profile?.username?.toLowerCase() === username,
      'A resposta de login não corresponde à identidade QA autorizada.');
    return result.token;
  }

  async function audit(username, token) {
    const prefs = await read(await request('/api/notifications/me/preferences', token),
      '/api/notifications/me/preferences');
    check(typeof prefs.inAppEnabled === 'boolean'
      && typeof prefs.emailEnabled === 'boolean'
      && Array.isArray(prefs.disabledInAppTypes)
      && Array.isArray(prefs.disabledEmailTypes),
    'Preferências de notificações incompletas.');
    for (const types of [prefs.disabledInAppTypes, prefs.disabledEmailTypes]) {
      check(types.every(x => typeof x === 'string' && x.length > 0)
        && new Set(types).size === types.length,
      'Categorias de notificação inválidas ou repetidas.');
    }

    const items = await read(await request('/api/notifications/me', token),
      '/api/notifications/me');
    check(Array.isArray(items), 'A lista de notificações não é um array.');
    check(items.every(n => n && typeof n.username === 'string'
      && n.username.toLowerCase() === username
      && Number.isSafeInteger(n.id) && n.id > 0
      && typeof n.read === 'boolean'),
    'A resposta contém notificações incompletas ou de outra conta QA.');

    const hidden = new Set(prefs.disabledInAppTypes);
    check(prefs.inAppEnabled || items.length === 0,
      'A lista deveria estar vazia com notificações globalmente desativadas.');
    check(items.every(n => !hidden.has(category(n))),
      'A lista expôs uma categoria desativada.');
    const count = await read(await request('/api/notifications/me/unread-count', token),
      '/api/notifications/me/unread-count');
    check(Number.isSafeInteger(count) && count >= 0,
      'O contador de não lidas não é um inteiro válido.');
    check(count === items.filter(n => !n.read).length,
      'Contador e lista de notificações não coincidem; rever alterações concorrentes.');
    output('[PASS] Preferências, filtragem e contador coerentes numa conta QA.');
    return { checked: true };
  }

  async function run({ passwords } = {}) {
    check(Array.isArray(passwords) && passwords.length === 2
      && passwords.every(x => typeof x === 'string' && x.length > 0),
    'São necessárias as duas passwords QA por variáveis de ambiente protegidas.');
    const tokens = [];
    for (let i = 0; i < ACCOUNTS.length; i++) {
      tokens.push(await login(ACCOUNTS[i], passwords[i]));
    }
    for (let i = 0; i < ACCOUNTS.length; i++) {
      await audit(ACCOUNTS[i], tokens[i]);
    }

    // Test the real authenticated ownership gate without reading other users'
    // message data. A 403 is expected; do not deserialize the error response.
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const other = ACCOUNTS[1 - i];
      const response = await request('/api/notifications/' + other, tokens[i]);
      check(response.status === 403, 'O endpoint legado não bloqueou leitura entre contas QA.');
    }
    output('[PASS] Isolamento de contas: leitura cruzada recusada com HTTP 403.');
    output('[PASS] Auditoria LIVE apenas de leitura concluída. Nenhum email foi enviado.');
    return { phase: 'readonly', accountsChecked: ACCOUNTS.length };
  }

  return { run };
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error('[FAIL] Este script não aceita flags nem altera dados de produção.');
    process.exitCode = 1;
  } else {
    createRunner().run({
      passwords: [process.env.JYNLO_QA_PASSWORD_1, process.env.JYNLO_QA_PASSWORD_2]
    }).catch(e => {
      // Errors contain only controlled route names / statuses, never API bodies.
      console.error('[FAIL]', e.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { createRunner };
