'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner, allowedPath, summaries, sharedMemberships,
  nonmemberProbe, safeError } = require('./jynlo-community-roles-live-readonly.cjs');

const VALID_PASSWORDS = ['synthetic-qa-password-1', 'synthetic-qa-password-2'];
const T1 = 'synthetic-authorized-token-user-one-abcdefghijklmnopqrstuvwxyz';
const T2 = 'synthetic-authorized-token-user-two-abcdefghijklmnopqrstuvwxyz';
const own1 = [
  { id: 7, myRole: 'OWNER', visibility: 'PRIVATE' },
  { id: 9, myRole: 'MEMBER', visibility: 'PRIVATE' }
];
const own2 = [{ id: 7, myRole: 'MEMBER', visibility: 'PRIVATE' }];

function syntheticApi({ memberships = [own1, own2], allowUnauthorized = false } = {}) {
  const calls = [];
  let forbiddenBodyRead = false;
  async function fetchImpl(href, options) {
    const url = new URL(href);
    const path = url.pathname + url.search;
    const method = options.method;
    calls.push({ host: url.origin, path, method });
    assert.equal(url.origin, 'https://api.d24sports.com');
    const token = options.headers.Authorization?.replace(/^Bearer /, '');
    const index = token === T1 ? 0 : token === T2 ? 1 : -1;
    if (path === '/api/auth/login') {
      assert.equal(method, 'POST');
      const body = JSON.parse(options.body);
      const i = body.username === 'jynloteste01' ? 0 : body.username === 'jynloteste02' ? 1 : -1;
      assert.ok(i >= 0);
      assert.equal(body.password, VALID_PASSWORDS[i]);
      return Response.json({ token: i === 0 ? T1 : T2,
        profile: { username: body.username }, mfaRequired: false });
    }
    assert.equal(method, 'GET');
    assert.ok(index >= 0);
    if (path === '/api/communities/mine') return Response.json(memberships[index]);
    const communityDetail = /^\/api\/communities\/([1-9]\d*)$/.exec(path);
    if (communityDetail) {
      const id = Number(communityDetail[1]);
      const own = memberships[index].find(x => x.id === id);
      if (!own) {
        if (allowUnauthorized) return {
          status: 200, headers: new Headers({ 'content-type': 'application/json' }),
          async arrayBuffer() { forbiddenBodyRead = true; throw Error('DO_NOT_READ'); }
        };
        return Response.json({ sensitive: 'MUST_NOT_BE_READ' }, { status: 403 });
      }
      return Response.json(own);
    }
    const tournaments = /^\/api\/communities\/([1-9]\d*)\/tournaments\?page=0$/.exec(path);
    if (tournaments) {
      assert.ok(memberships[index].some(x => x.id === Number(tournaments[1])));
      return Response.json({ page: 0, hasMore: false,
        tournaments: [{ id: 11, status: 'DRAFT' }] });
    }
    const tournamentDetail = /^\/api\/communities\/([1-9]\d*)\/tournaments\/11$/.exec(path);
    if (tournamentDetail) {
      assert.ok(memberships[index].some(x => x.id === Number(tournamentDetail[1])));
      return Response.json({ id: 11, status: 'DRAFT' });
    }
    throw Error('UNEXPECTED_TEST_ENDPOINT');
  }
  return { fetchImpl, calls, get forbiddenBodyRead() { return forbiddenBodyRead; } };
}

test('endpoint allowlist permits only exact bounded GET locations', () => {
  for (const path of [
    '/api/communities/mine',
    '/api/communities/7',
    '/api/communities/7/tournaments?page=0',
    '/api/communities/7/tournaments/11'
  ]) assert.equal(allowedPath(path), path);
  for (const bad of [
    '/api/auth/login', '/api/communities',
    '/api/communities/7/tournaments?page=1',
    '/api/communities/7/tournaments/11/schedule',
    '/api/communities/7/tournaments/11/matches',
    '/api/communities/7/tournaments/11/teams',
    '/api/communities/7/join-requests',
    '/api/communities/7/delete',
    '/api/communities/7/tournaments/11/matches/5/result',
    'https://api.d24sports.com/api/communities/mine',
    '/api/communities/0',
    '/api/communities/07'
  ]) assert.throws(() => allowedPath(bad));
  assert.equal(safeError(new Error('private user details')), 'ROLE_QA_CHECK_FAILED');
});

test('membership normalization validates distinct roles and bounded overlap', () => {
  assert.deepEqual(summaries(own1), [
    { id: 7, role: 'OWNER', visibility: 'PRIVATE' },
    { id: 9, role: 'MEMBER', visibility: 'PRIVATE' }
  ]);
  assert.deepEqual(sharedMemberships(summaries(own1), summaries(own2)), [
    { id: 7, role: 'OWNER', visibility: 'PRIVATE' }
  ]);
  assert.equal(nonmemberProbe(summaries(own1), summaries(own2)).id, 9);
  assert.throws(() => summaries([{ id: 7, myRole: 'ADMIN', visibility: 'PUBLIC' },
    { id: 7, myRole: 'MEMBER', visibility: 'PRIVATE' }]), /COMMUNITY_DUPLICATE/);
  assert.throws(() => summaries([{ id: 7, myRole: 'GUEST', visibility: 'PRIVATE' }]),
    /COMMUNITY_ROLE_FORMAT/);
});

test('only two allowed login POSTs; read roles, shared tournament, and a denied non-member GET', async () => {
  const api = syntheticApi();
  const lines = [];
  const result = await createRunner({
    fetchImpl: api.fetchImpl, output: line => lines.push(line)
  }).run({ passwords: VALID_PASSWORDS });
  assert.deepEqual(result, {
    accounts: 2, ownDetails: 3, shared: 1,
    managerMemberPairs: 1, tournamentDetails: 2, ownTournamentFallbacks: 0,
    deniedChecks: 1
  });
  assert.equal(api.calls.filter(x => x.method === 'POST').length, 2);
  assert.ok(api.calls.filter(x => x.method === 'POST')
    .every(x => x.path === '/api/auth/login'));
  assert.ok(api.calls.every(x => x.host === 'https://api.d24sports.com'));
  assert.ok(lines.some(x => x.includes('manager/member role pair')));
  assert.ok(lines.some(x => x.includes('Private non-member')));
  const visible = lines.join(' ');
  for (const forbidden of ['jynloteste01', 'jynloteste02', T1, T2, '/api/communities/7', 'MUST_NOT_BE_READ']) {
    assert.equal(visible.includes(forbidden), false, 'private content reached logs');
  }
});

test('unauthorized GET returning 200 fails BEFORE its response body can be read', async () => {
  const api = syntheticApi({ allowUnauthorized: true });
  await assert.rejects(
    createRunner({ fetchImpl: api.fetchImpl, output() {} }).run({ passwords: VALID_PASSWORDS }),
    /NONMEMBER_READ_NOT_DENIED/
  );
  assert.equal(api.forbiddenBodyRead, false);
  assert.ok(api.calls.every(x => x.method === 'GET'
    || x.method === 'POST' && x.path === '/api/auth/login'));
});

test('missing role-split samples report SKIP instead of pretending permissions verified', async () => {
  const api = syntheticApi({ memberships: [[{
    id: 7, myRole: 'MEMBER', visibility: 'PRIVATE'
  }], [{ id: 7, myRole: 'MEMBER', visibility: 'PRIVATE' }]] });
  const output = [];
  const result = await createRunner({ fetchImpl: api.fetchImpl,
    output: line => output.push(line) }).run({ passwords: VALID_PASSWORDS });
  assert.equal(result.managerMemberPairs, 0);
  assert.equal(result.deniedChecks, 0);
  assert.ok(output.filter(x => x.startsWith('[SKIP]')).length >= 2);
});

test('missing credentials reject before any outbound request', async () => {
  let invoked = 0;
  await assert.rejects(createRunner({ fetchImpl() {
    invoked++;
    throw Error('SHOULD_NOT_HAPPEN');
  }}).run({ passwords: [] }), /QA_SECRETS_NOT_CONFIGURED/);
  assert.equal(invoked, 0);
});

test('no shared community: bounded own-community fallback reads tournaments without changing data', async () => {
  const own = [
    [{ id: 9, myRole: 'OWNER', visibility: 'PRIVATE' }],
    [{ id: 8, myRole: 'MEMBER', visibility: 'PRIVATE' }]
  ];
  const api = syntheticApi({ memberships: own });
  const lines = [];
  const result = await createRunner({
    fetchImpl: api.fetchImpl, output: msg => lines.push(msg)
  }).run({ passwords: VALID_PASSWORDS });
  assert.deepEqual(result, {
    accounts: 2, ownDetails: 2, shared: 0,
    managerMemberPairs: 0, tournamentDetails: 2, ownTournamentFallbacks: 2,
    deniedChecks: 1
  });
  assert.equal(api.calls.filter(c => c.method !== 'GET').length, 2);
  assert.ok(api.calls.filter(c => c.path.includes('/tournaments')).every(c => c.method === 'GET'));
  assert.ok(lines.some(x => x.includes('tournament detail reads agree')));
  assert.ok(lines.some(x => x.includes('No shared QA community')));
  assert.ok(lines.every(x => !x.includes('jynloteste') && !x.includes('/api/communities/9')));
});

test('empty community memberships: report SKIP, never claim role or tournament coverage', async () => {
  const api = syntheticApi({ memberships: [[], []] });
  const lines = [];
  const result = await createRunner({
    fetchImpl: api.fetchImpl, output: msg => lines.push(msg)
  }).run({ passwords: VALID_PASSWORDS });
  assert.equal(result.ownDetails, 0);
  assert.equal(result.tournamentDetails, 0);
  assert.equal(result.ownTournamentFallbacks, 0);
  assert.equal(result.deniedChecks, 0);
  assert.ok(lines.some(x => x.startsWith('[SKIP]') && x.includes('role details untested')));
  assert.ok(lines.some(x => x.startsWith('[SKIP]') && x.includes('No authorized tournament')));
  assert.ok(lines.every(x => !x.includes('roles verified')));
  assert.equal(api.calls.length, 4, 'two logins and two authorized membership GETs only');
});
