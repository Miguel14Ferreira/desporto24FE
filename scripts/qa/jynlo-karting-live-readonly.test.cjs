'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { run, readOnlyPath, commonCommunities, ownCommunities,
  tournamentPages, validateArchived, safeError } =
  require('./jynlo-karting-live-readonly.cjs');

test('allowlist accepts only bounded, read-only Karting discovery paths', () => {
  assert.equal(readOnlyPath('/api/communities/mine'), '/api/communities/mine');
  assert.equal(readOnlyPath('/api/communities/7/tournaments?page=0'),
    '/api/communities/7/tournaments?page=0');
  assert.equal(readOnlyPath('/api/communities/7/tournaments?page=2'),
    '/api/communities/7/tournaments?page=2');
  assert.equal(readOnlyPath('/api/communities/7/tournaments/11/races'),
    '/api/communities/7/tournaments/11/races');
  for (const bad of [
    '/api/communities/7/tournaments/11/races/complete',
    '/api/communities/7/seasons',
    '/api/communities/7/tournaments?page=999',
    '/api/communities/7/tournaments?page=3',
    'https://evil.example/api/communities/mine',
    '/api/communities/0/tournaments?page=0'
  ]) assert.throws(() => readOnlyPath(bad));
});
test('intersects community memberships and excludes unverified IDs', () => {
  assert.deepEqual(commonCommunities(
    [{id:1},{id:5},{id:9},{id:13}],
    [{id:5},{id:9},{id:13},{id:17}]), [5,9,13]);
  assert.deepEqual(commonCommunities([{id:3}], [{id:4}]), []);
  assert.deepEqual(ownCommunities([{id:3},{id:4},{id:4},{id:0}]), [3,4]);
});
test('only validates immutable archives with proper sporting ties', () => {
  const base = {
    status:'COMPLETED',scoringMode:'RACE_POINTS',
    championTied: false,championProfileId: 2
  };
  const data = {
    pointsByPlace: [25,18], linkedRaces: [{id:10}],
    availableRaces: [],
    standings: [{position:1,profileId:2},{position:2,profileId:3}]
  };
  assert.doesNotThrow(() => validateArchived(base, data));
  assert.throws(() => validateArchived(base, {...data,availableRaces:[{id:11}]}));
  assert.throws(() => validateArchived({...base,championTied:true},data));
  assert.doesNotThrow(() => validateArchived({...base,championTied:true,
    championProfileId:null}, {...data,standings:[
      {position:1,profileId:2},{position:1,profileId:3}
    ]}));
  assert.equal(safeError(new Error('token: private')), 'LIVE_QA_CHECK_FAILED');
});
test('two authenticated browser identities use only login POST and approved GET', async () => {
  const requests = [], report = [], contextTokens = [];
  const snapshot = {
    pointsByPlace:[25,18], linkedRaces:[{id:10}], availableRaces:[],
    standings:[{position:1,profileId:2},{position:2,profileId:3}]
  };
  const fixture = {tournaments:[{
    id:11,status:'COMPLETED',scoringMode:'RACE_POINTS',
    championTied:false,championProfileId:2
  }],page:0,hasMore:false};
  async function fakeFetch(url, init) {
    const u = new URL(url);
    requests.push({path:u.pathname,query:u.search,method:init.method});
    if (u.pathname === '/api/auth/login' && init.method==='POST') {
      const body = JSON.parse(init.body);
      return Response.json({token:'synthetic-test-token-abcdefghijklmnopqrstuvwxyz',
        profile:{username:body.username}});
    }
    assert.equal(init.method, 'GET', 'unexpected non-read API call');
    const body = u.pathname==='/api/communities/mine' ? [{id:7}]
      : u.pathname==='/api/communities/7/tournaments' ? fixture
      : u.pathname==='/api/communities/7/tournaments/11/races' ? snapshot
      : (()=>{throw Error('Unexpected request');})();
    return Response.json(body);
  }
  const fakeChromium = { async launch() {
    return {
      async newContext() {
        return {
          async addInitScript(_script, token){contextTokens.push(token);},
          async route(){},
          async newPage(){return {
            async goto(){return {status(){return 200}};},
            locator(){const loc={waitFor:async()=>{},first(){return loc;}};return loc;},
            url(){return 'https://d24sports.com/menu/communities/7?tab=tournaments';},
            async close(){}
          };},
          async close(){}
        };
      },
      async close(){}
    };
  }};
  const result = await run({
    passwords:['only-unit-test-password-1','only-unit-test-password-2'],
    fetchImpl: fakeFetch, browserEngine: fakeChromium,
    report: line => report.push(line)
  });
  assert.deepEqual({shared:result.shared,archived:result.archived,
    active:result.active,crossChecked:result.crossChecked},
    {shared:1,archived:2,active:0,crossChecked:1});
  assert.equal(contextTokens.length, 2);
  assert.equal(requests.filter(r=>r.method==='POST').length, 2);
  assert.ok(requests.filter(r=>r.method==='POST')
    .every(r=>r.path==='/api/auth/login'));
  assert.equal(requests.filter(r=>r.method==='GET').length, 6);
  assert.ok(report.some(line=>line.includes('Archived Karting classification')));
  assert.ok(report.every(line=>!line.includes('synthetic-test-token')));
});

test('tournament discovery paginates no further than 3 approved GET pages', async () => {
  const seen = [];
  async function mockFetch(url, options) {
    assert.equal(options.method, 'GET');
    const u = new URL(url);
    seen.push(u.searchParams.get('page'));
    const n = Number(u.searchParams.get('page'));
    return Response.json({
      page: n,
      tournaments: [{id:n+1,status:'DRAFT'}],
      hasMore: true
    });
  }
  const tournaments = await tournamentPages(7, 'test-token', mockFetch);
  assert.deepEqual(tournaments.map(t=>t.id), [1,2,3]);
  assert.deepEqual(seen, ['0','1','2']);
});

test('own memberships do not require shared communities to validate Karting', async () => {
  const requests = [], logs = [];
  async function mockFetch(url, options) {
    const u = new URL(url);
    if (u.pathname === '/api/auth/login') {
      const user = JSON.parse(options.body).username;
      return Response.json({token:'synthetic-token-abcdefghijklmnopqrstuvwxyz',
        profile:{username:user}});
    }
    assert.equal(options.method, 'GET');
    const account = options.headers.Authorization;
    // Different community lists for the two tokens, modelled by a predictable
    // request counter. Never inspect or print any real user data.
    const path = u.pathname;
    const count = requests.filter(x=>x===path).length;
    requests.push(path);
    if (path === '/api/communities/mine') {
      return Response.json([{id:count===0?7:8}]);
    }
    if (path.endsWith('/tournaments')) {
      return Response.json({page:0,hasMore:false,tournaments:[
        {id:11,scoringMode:'RACE_POINTS',status:'COMPLETED',
          championTied:false,championProfileId:2}
      ]});
    }
    if (path.endsWith('/races')) {
      return Response.json({pointsByPlace:[25,18],linkedRaces:[{id:30}],
        availableRaces:[],standings:[{position:1,profileId:2},
          {position:2,profileId:3}]});
    }
    throw Error('UNEXPECTED_ENDPOINT');
  }
  const chromium = {async launch(){return {
    async newContext(){return {
      async addInitScript(){},async route(){},
      async newPage(){return {
        async goto(){return {status:()=>200}},
        locator(){const loc={waitFor:async()=>{},first(){return loc;}};return loc;},
        url(){return 'https://d24sports.com/menu/communities/7?tab=tournaments';},
        async close(){}
      }},async close(){}
    }},async close(){}
  }}};
  const result = await run({
    passwords:['synthetic-test-pass-1','synthetic-test-pass-2'],
    fetchImpl:mockFetch,browserEngine:chromium,report:log=>logs.push(log)
  });
  assert.equal(result.shared,0);
  assert.equal(result.archived,2);
  assert.equal(result.crossChecked,0);
  assert.ok(logs.some(l=>l.includes('No shared completed')));
  assert.ok(logs.some(l=>l.includes('snapshots validated')));
  assert.ok(requests.every(x=>x.startsWith('/api/communities')));
});
