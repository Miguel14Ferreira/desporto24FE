import { expect, test, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

type Role = 'OWNER' | 'MEMBER';
type TournamentStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
type ParticipantStatus = 'PENDING' | 'CONFIRMED';

interface Tournament {
  id: number;
  name: string;
  sport?: string | null;
  format: 'LEAGUE' | 'KNOCKOUT';
  status: TournamentStatus;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  championProfileId: number | null;
  championUsername: string | null;
  championDisplayName: string | null;
  championPoints: number | null;
  championTied: boolean;
  entryType?: 'INDIVIDUAL' | 'TEAM';
  playersPerTeam?: number | null;
  roundRobinLegs?: 1 | 2;
  teamTieBreakPriority?: 'GOAL_DIFFERENCE_FIRST' | 'GOALS_SCORED_FIRST' | 'WINS_FIRST';
  scoringMode?: 'RACE_POINTS' | 'CHESS_HALF_POINTS';
}

interface Participant {
  profileId: number;
  username: string;
  displayName: string;
  joinedAt: string;
  status: ParticipantStatus;
}

interface Match {
  id: number;
  roundNumber: number;
  homeProfileId: number;
  homeUsername: string;
  awayProfileId: number;
  awayUsername: string;
  status: 'SCHEDULED' | 'COMPLETED';
  homeScore: number | null;
  awayScore: number | null;
}

function tournament(id: number, name: string): Tournament {
  return {
    id, name, format: 'LEAGUE', status: 'DRAFT',
    winPoints: 3, drawPoints: 1, lossPoints: 0,
    createdAt: '2026-10-16T12:00:00Z', startedAt: null, completedAt: null,
    championProfileId: null, championUsername: null, championDisplayName: null,
    championPoints: null, championTied: false
  };
}

// Valid-looking but deliberately unsigned token for the isolated Angular test
// origin only. Never sends requests to the production backend.
function fixtureToken(username: string): string {
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return [encode({ alg: 'none', typ: 'JWT' }),
    encode({ sub: username, exp: Math.floor(Date.now() / 1000) + 3600 }), 'fixture'].join('.');
}


interface KartingFixture {
  sport: string;
  tournament: Tournament | null;
  points: number[];
  linked: boolean;
  tied: boolean;
  snapshot: ReturnType<typeof raceData> | null;
  writes: Array<{ role: Role; path: string }>;
}
function createKartingFixture(sport = 'Karting'): KartingFixture {
  return { sport, tournament: null, points: [25,18,15], linked: false, tied: false, snapshot: null, writes: [] };
}
function raceData(state: KartingFixture) {
  const race = {
    id: 30, name: 'Grande Prémio QA', sport: state.sport, playedAt: '2026-10-23T18:00:00Z',
    entries: [
      { communityPlayerId: 2, fullName: 'Ana', finishPosition: 1, elapsedSeconds: 612,
        bestLapSeconds: 58, racePenaltyPoints: 0, raceDisqualified: false },
      { communityPlayerId: 3, fullName: 'Bruno', finishPosition: 2, elapsedSeconds: 624,
        bestLapSeconds: 59, racePenaltyPoints: 0, raceDisqualified: false },
      { communityPlayerId: 4, fullName: 'Carla', finishPosition: null, elapsedSeconds: null,
        bestLapSeconds: null, racePenaltyPoints: 0, raceDisqualified: false }
    ]
  };
  const archiveStandings = state.tied ? [
    { position: 1, playerId: 2, fullName: 'Ana', races: 1, wins: 1, podiums: 1,
      bestFinish: 1, championshipPoints: 25, penaltyPoints: 0 },
    { position: 1, playerId: 3, fullName: 'Bruno', races: 1, wins: 1, podiums: 1,
      bestFinish: 1, championshipPoints: 25, penaltyPoints: 0 }
  ] : null;
  // Match CommunityRaceStandings.calculate: an unplaced DNF is visible in
  // the race result card but is omitted from the championship standings.
  return {
    tournamentId: 11, pointsByPlace: state.points,
    linkedRaces: state.linked ? [race] : [],
    availableRaces: state.linked ? [] : [race],
    standings: state.linked ? (archiveStandings ?? [
      { position: 1, playerId: 2, fullName: 'Ana', races: 1, wins: 1, podiums: 1,
        bestFinish: 1, championshipPoints: state.points[0], penaltyPoints: 0 },
      { position: 2, playerId: 3, fullName: 'Bruno', races: 1, wins: 0, podiums: 1,
        bestFinish: 2, championshipPoints: state.points[1], penaltyPoints: 0 }
    ]) : []
  };
}

type FixtureMode = 'empty' | 'draft' | 'paged' | 'forbidden' | 'switch'
  | 'management' | 'complete-rejected' | 'list-network-error'
  | 'paged-enrollment' | 'draw-tie' | 'schedule-roster-paged' | 'schedule-roster-oversize'
  | 'discovery' | 'trial' | 'modules-off' | 'teams-only' | 'teams' | 'teams-view'
  | 'teams-schedule' | 'history' | 'karting';

async function mockCommunityApi(page: Page, role: Role, mode: FixtureMode,
  sport: string | null = 'Futebol', sports?: string[], roundRobinLegs: 1 | 2 = 1,
  format: 'LEAGUE' | 'KNOCKOUT' = 'LEAGUE', karting?: KartingFixture) {
  const username = role === 'OWNER' ? 'organizador' : 'participante';
  const token = fixtureToken(username);
  await page.addInitScript(value => localStorage.setItem('t', value), token);

  const community = {
    id: 7, name: 'Jogadores de Lisboa', description: 'Liga dos amigos',
    sport, sports: sports ?? (sport ? [sport] : []), photoUrl: null, visibility: 'PRIVATE',
    rankingsEnabled: mode !== 'modules-off' && mode !== 'teams-only',
    individualTournamentsEnabled: mode !== 'modules-off' && mode !== 'teams-only',
    teamTournamentsEnabled: mode !== 'modules-off',
    ownerUsername: 'organizador',
    myRole: role, memberCount: 3, createdAt: '2026-10-16T12:00:00Z',
    members: [
      { profileId: 1, username: 'organizador', fullName: 'Organizador',
        role: 'OWNER', profilePicUrl: null },
      { profileId: 2, username: 'participante', fullName: 'Participante',
        role: 'MEMBER', profilePicUrl: null },
      { profileId: 3, username: 'mariana', fullName: 'Mariana',
        role: 'MEMBER', profilePicUrl: null },
      { profileId: 4, username: 'joao', fullName: 'João',
        role: 'MEMBER', profilePicUrl: null }
    ]
  };

  const tournaments: Tournament[] = mode === 'empty' || mode === 'teams' || mode === 'karting' ? []
    : [tournament(mode === 'teams-view' || mode === 'teams-schedule' ? 11 : 9, 'Liga de Outono')];
  // The sport is a snapshot on the tournament, not inferred by the component.
  tournaments.forEach(item => item.sport = sport);
  if (mode === 'teams-view' || mode === 'teams-schedule') Object.assign(tournaments[0], {
    entryType: 'TEAM', playersPerTeam: 2, name: 'Torneio da comunidade',
    roundRobinLegs, format
  });
  type MockTeam = { id: number; name: string; playersPerTeam: number | null; createdAt: string;
    players: { profileId: number; username: string; displayName: string }[] };
  const teams: MockTeam[] = mode === 'teams-view' || mode === 'teams-schedule' ? [{
    id: 40, name: 'Azuis', playersPerTeam: 2, createdAt: '2026-10-17T12:00:00Z',
    players: [{ profileId: 2, username: 'participante', displayName: 'Participante' }]
  }] : [];
  if (mode === 'teams-schedule') {
    teams[0].players.push({ profileId: 1, username: 'organizador', displayName: 'Organizador' });
    teams.push({ id: 41, name: 'Verdes', playersPerTeam: 2,
      createdAt: '2026-10-17T12:00:00Z', players: [
        { profileId: 3, username: 'mariana', displayName: 'Mariana' },
        { profileId: 4, username: 'joao', displayName: 'João' }
      ] });
  }
  let publishedTeamSchedule = false;
  const teamFixtures: Array<{ id: number; roundNumber: number;
    homeTeamId: number; homeTeamName: string; awayTeamId: number;
    awayTeamName: string; status: 'SCHEDULED' | 'COMPLETED';
    homeScore: number | null; awayScore: number | null }> = [];
  if (mode === 'switch') tournaments.push(tournament(11, 'Liga alternativa'));
  if (mode === 'paged') tournaments[0].status = 'IN_PROGRESS';
  if (mode === 'trial') {
    tournaments[0].status = 'IN_PROGRESS';
    tournaments[0].name = 'lol';
  }
  const participants: Participant[] = role === 'OWNER' && mode !== 'empty' ? [
    { profileId: 1, username: 'organizador', displayName: 'Organizador',
      joinedAt: '2026-10-16T12:01:00Z', status: 'CONFIRMED' },
    { profileId: 2, username: 'participante', displayName: 'Participante',
      joinedAt: '2026-10-16T12:02:00Z', status: 'CONFIRMED' }
  ] : [];
  if (mode === 'paged-enrollment') {
    participants.push(
      { profileId: 1, username: 'organizador', displayName: 'Organizador',
        joinedAt: '2026-10-16T12:01:00Z', status: 'CONFIRMED' },
      { profileId: 2, username: 'participante', displayName: 'Participante',
        joinedAt: '2026-10-16T12:02:00Z', status: 'PENDING' }
    );
  }
  if (mode === 'schedule-roster-paged' || mode === 'schedule-roster-oversize') {
    const max = mode === 'schedule-roster-oversize' ? 33 : 21;
    for (let id = 3; id <= max; id++) {
      participants.push({
        profileId: id, username: 'player' + id, displayName: 'Jogador ' + id,
        joinedAt: '2026-10-16T12:03:00Z', status: 'CONFIRMED'
      });
    }
  }
  if (mode === 'management') {
    participants.push(
      { profileId: 3, username: 'mariana', displayName: 'Mariana',
        joinedAt: '2026-10-16T12:03:00Z', status: 'PENDING' },
      { profileId: 4, username: 'pedro', displayName: 'Pedro',
        joinedAt: '2026-10-16T12:04:00Z', status: 'PENDING' }
    );
  }
  const matches: Match[] = mode === 'paged' ? [
    { id: 30, roundNumber: 1, homeProfileId: 1, homeUsername: 'organizador',
      awayProfileId: 2, awayUsername: 'participante', status: 'SCHEDULED',
      homeScore: null, awayScore: null },
    { id: 31, roundNumber: 2, homeProfileId: 1, homeUsername: 'organizador',
      awayProfileId: 2, awayUsername: 'participante', status: 'SCHEDULED',
      homeScore: null, awayScore: null }
  ] : [];
  if (mode === 'trial') {
    matches.push({ id: 40, roundNumber: 1, homeProfileId: 1, homeUsername: 'organizador',
      awayProfileId: 2, awayUsername: 'participante', status: 'SCHEDULED',
      homeScore: null, awayScore: null });
  }
  const requestedMatchPages: number[] = [];
  const pendingDetailResponses: Array<() => void> = [];
  let completeAttempts = 0;
  let scheduleAttempts = 0;
  let listAttempts = 0;
  let joinAttempts = 0;
  let archivePreviewCalls = 0;
  let archiveConfirmCalls = 0;
  const historicalRows = [
    { position: 1, name: 'Águias', played: 10, wins: 8, draws: 1, losses: 1, points: 25, goalsFor: 21, goalsAgainst: 9 },
    { position: 2, name: 'Lobos', played: 10, wins: 6, draws: 2, losses: 2, points: 20, goalsFor: 16, goalsAgainst: 12 }
  ];
  const historicalArchives = mode === 'history'
    ? [{ id: 71, title: 'Liga de 2022', entryType: 'TEAM', seasonId: null,
        sourceFilename: '2022.csv', createdAt: '2026-10-16T12:00:00Z', rows: historicalRows }]
    : [];
  let createCommunityRequest: unknown = null;
  let updatedCommunitySports: string[] | null = null;
  const requestedParticipantPages: number[] = [];
  const organizerMutations: string[] = [];
  const unmocked: string[] = [];
  page.on('pageerror', error => console.log('[E2E PAGE ERROR]', error.stack || error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.log('[E2E BROWSER CONSOLE]', message.text());
  });
  page.on('requestfailed', request => {
    console.log('[E2E request failed]', request.method(), request.url(), request.failure()?.errorText);
  });

  function standings() {
    const confirmed = participants.filter(p => p.status === 'CONFIRMED');
    const rows = confirmed.map(p => ({
      position: 0, profileId: p.profileId, username: p.username,
      displayName: p.displayName, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
    }));
    const byId = new Map(rows.map(r => [r.profileId, r]));
    for (const match of matches.filter(m => m.status === 'COMPLETED')) {
      const home = byId.get(match.homeProfileId)!;
      const away = byId.get(match.awayProfileId)!;
      const a = match.homeScore!;
      const b = match.awayScore!;
      home.played++;
      away.played++;
      home.goalsFor += a; home.goalsAgainst += b;
      away.goalsFor += b; away.goalsAgainst += a;
      home.goalDifference = home.goalsFor - home.goalsAgainst;
      away.goalDifference = away.goalsFor - away.goalsAgainst;
      if (a > b) { home.won++; away.lost++; home.points += 3; }
      else if (a < b) { away.won++; home.lost++; away.points += 3; }
      else { home.drawn++; away.drawn++; home.points++; away.points++; }
    }
    rows.sort((a,b) => b.points - a.points || b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor || b.won - a.won || a.profileId - b.profileId);
    rows.forEach((r,i) => r.position = i + 1);
    return {
      tournamentId: tournaments[0]?.id, status: tournaments[0]?.status || 'DRAFT',
      totalMatches: matches.length,
      completedMatches: matches.filter(m => m.status === 'COMPLETED').length,
      winPoints: 3, drawPoints: 1, lossPoints: 0, standings: rows
    };
  }

  // All backend responses are mocked; an unknown endpoint is rejected, never
  // forwarded to a real account, remote server or production database.
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization,content-type'
    };
    async function send(body: unknown, status = 200) {
      await route.fulfill({
        status, contentType: 'application/json', headers,
        body: JSON.stringify(body)
      });
    }
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (method === 'POST' && path === '/api/communities') {
      createCommunityRequest = req.postDataJSON();
      return send({ ...community, ...(createCommunityRequest as object), id: 7 }, 201);
    }
    if (method === 'PUT' && path === '/api/communities/7/sports') {
      const body = req.postDataJSON() as { sports: string[] };
      updatedCommunitySports = body.sports;
      community.sports = body.sports;
      community.sport = body.sports[0] || '';
      return send(community);
    }
    if (method === 'GET' && path === '/api/communities/mine') {
      return send(mode === 'discovery' ? [] : [community]);
    }
    if (method === 'GET' && path === '/api/communities/search' && mode === 'discovery') {
      return send({
        communities: [
          { ...community, visibility: 'PUBLIC',
            sports: ['Futebol', 'Padel', 'Ténis', 'Natação'] },
          { id: 8, name: 'Padel clássico', description: null, sport: 'Padel',
            visibility: 'PUBLIC', photoUrl: null },
          { id: 9, name: 'Comunidade aberta', description: null, sport: null,
            sports: [], visibility: 'PUBLIC', photoUrl: null }
        ], page: 0, hasMore: false
      });
    }
    if (method === 'GET' && path === '/api/communities/7/presentation' && mode === 'discovery') {
      return send({ ...community, visibility: 'PUBLIC',
        sports: ['Futebol', 'Padel', 'Ténis', 'Natação'] });
    }
    if (method === 'GET' && path === '/api/communities/invites/me') return send([]);
    if (method === 'GET' && path === '/api/communities/7') return send(community);
    if (method === 'GET' && path === '/api/communities/7/sessions') return send([]);
    if (method === 'GET' && path === '/api/communities/7/competition') {
      return send({
        settings: { rankingsEnabled: true, winPoints: 3, drawPoints: 1, lossPoints: 0 },
        seasons: [], selectedSeasonId: null, activeSeasonId: null,
        rounds: [], standings: []
      });
    }

    if (path === '/api/communities/7/competition/standings-archives' && method === 'GET') {
      return send(historicalArchives.map(({ rows: _rows, ...summary }) => summary));
    }
    const archiveId = /^\/api\/communities\/7\/competition\/standings-archives\/(\d+)$/.exec(path);
    if (archiveId && method === 'GET') {
      const item = historicalArchives.find(value => value.id === Number(archiveId[1]));
      return item ? send(item) : send({ message: 'Arquivo não encontrado' }, 404);
    }
    if (path === '/api/communities/7/competition/import/preview' && method === 'POST') {
      if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
      return send({
        fileName: 'tabela.csv',
        sheets: [{ name: 'Dados', nonEmptyRows: 3, structure: 'TABULAR',
          headers: ['Pos', 'Equipa', 'J', 'V', 'E', 'D', 'Pts', 'GM', 'GS'],
          sampleRows: [['1', 'Águias', '10', '8', '1', '1', '25', '21', '9']],
          columnSuggestions: [] }]
      });
    }
    if (path === '/api/communities/7/competition/import/standings/preview' && method === 'POST') {
      if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
      archivePreviewCalls++;
      return send({ sheetName: 'Dados', sourceRows: 3, acceptedRows: 2,
        duplicateRows: 1, warnings: ['Linha 4: ÁGUIAS repetido; mantém-se apenas a primeira ocorrência'],
        rows: historicalRows });
    }
    if (path === '/api/communities/7/competition/import/standings/confirm' && method === 'POST') {
      if (role !== 'OWNER' || archivePreviewCalls === 0)
        return send({ message: 'Confirmação inválida' }, 403);
      archiveConfirmCalls++;
      const item = { id: 72, title: 'Liga de 2020', entryType: 'TEAM', seasonId: null,
        sourceFilename: 'tabela.csv', createdAt: '2026-10-17T20:00:00Z', rows: historicalRows };
      historicalArchives.unshift(item);
      return send(item);
    }

    // Karting-only API fixture. Shared across independently authenticated
    // browser contexts, never forwarding requests outside the local test app.
    if (mode === 'karting' && karting) {
      const base = '/api/communities/7/tournaments/11/races';
      if (path === '/api/communities/7/tournaments' && method === 'GET') {
        return send({ tournaments: karting.tournament ? [karting.tournament] : [],
          page: 0, hasMore: false });
      }
      if (path === '/api/communities/7/tournaments' && method === 'POST') {
        karting.writes.push({ role, path });
        const body = req.postDataJSON() as { name: string; sport: string; scoringMode: string };
        if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
        if (body.sport !== karting.sport || body.scoringMode !== 'RACE_POINTS')
          return send({ message: 'Formato incorreto' }, 422);
        karting.tournament = { ...tournament(11, body.name),
          sport: karting.sport, entryType: 'INDIVIDUAL', scoringMode: 'RACE_POINTS' };
        return send(karting.tournament, 201);
      }
      if (path === base && method === 'GET') {
        return karting.tournament
          ? send(karting.snapshot ?? raceData(karting))
          : send({ message: 'Não existe' }, 404);
      }
      if (path === base + '/complete' && method === 'POST') {
        karting.writes.push({ role, path });
        if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
        if (!karting.tournament) return send({ message: 'Não existe' }, 404);
        if (karting.tournament.status === 'COMPLETED') return send(karting.tournament);
        const current = raceData(karting);
        if (karting.tournament.status !== 'IN_PROGRESS' || !karting.linked
            || current.standings.length < 2)
          return send({ message: 'Faltam resultados válidos' }, 409);
        // Match the backend contract: snapshot before completion. Unlike the
        // mutable community round, the archive remains fixed for every reader.
        karting.snapshot = JSON.parse(JSON.stringify(current)) as ReturnType<typeof raceData>;
        const leader = current.standings[0];
        const tied = current.standings[1]?.position === 1;
        Object.assign(karting.tournament, {
          status: 'COMPLETED', completedAt: '2026-10-24T13:00:00Z',
          championTied: tied,
          championProfileId: tied ? null : leader.playerId,
          championUsername: tied ? null : 'ana',
          championDisplayName: tied ? null : leader.fullName,
          championPoints: tied ? null : leader.championshipPoints
        });
        return send(karting.tournament);
      }
      if (path === base + '/points' && method === 'PUT') {
        karting.writes.push({ role, path });
        if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
        if (!karting.tournament || karting.linked || karting.tournament.status !== 'DRAFT')
          return send({ message: 'Pontuação fechada' }, 409);
        const body = req.postDataJSON() as { pointsByPlace: string };
        const parts = body.pointsByPlace.split(',').map(v => v.trim());
        const values = parts.map(Number);
        if (!parts.length || parts.length > 20 || parts.some(v => !/^\d{1,4}$/.test(v))
            || values.some((v, i) => v > 1000 || (i > 0 && v > values[i-1])))
          return send({ message: 'Pontuação inválida' }, 422);
        karting.points = values;
        return send(raceData(karting));
      }
      if (path === base + '/30' && method === 'PUT') {
        karting.writes.push({ role, path });
        if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
        if (!karting.tournament || karting.linked || karting.tournament.status === 'COMPLETED')
          return send({ message: 'Corrida indisponível' }, 409);
        karting.linked = true;
        karting.tournament.status = 'IN_PROGRESS';
        return send(raceData(karting));
      }
      if (path === base + '/30' && method === 'DELETE') {
        karting.writes.push({ role, path });
        if (role !== 'OWNER') return send({ message: 'Sem permissão' }, 403);
        if (!karting.tournament || !karting.linked || karting.tournament.status === 'COMPLETED')
          return send({ message: 'Corrida indisponível' }, 409);
        karting.linked = false;
        karting.tournament.status = 'DRAFT';
        return send(raceData(karting));
      }
    }

    if (path === '/api/communities/7/tournaments') {
      if (method === 'GET') {
        listAttempts++;
        if (mode === 'list-network-error' && listAttempts === 1) {
          return route.abort('failed');
        }
        return send({ tournaments, page: Number(url.searchParams.get('page') || 0), hasMore: false });
      }
      if (method === 'POST') {
        const body = req.postDataJSON() as {
          name: string; sport: string; entryType?: 'TEAM'; playersPerTeam?: number | null;
          roundRobinLegs?: 1 | 2; winPoints?: number; drawPoints?: number; lossPoints?: number;
          teamTieBreakPriority?: 'GOAL_DIFFERENCE_FIRST' | 'GOALS_SCORED_FIRST' | 'WINS_FIRST';
          format?: 'LEAGUE' | 'KNOCKOUT';
        };
        const next = {
          ...tournament(11, body.name), sport: body.sport,
          format: body.format || 'LEAGUE',
          entryType: body.entryType || 'INDIVIDUAL',
          playersPerTeam: body.playersPerTeam || null, roundRobinLegs: body.roundRobinLegs || 1,
          winPoints: body.winPoints ?? 3, drawPoints: body.drawPoints ?? 1,
          lossPoints: body.lossPoints ?? 0,
          teamTieBreakPriority: body.teamTieBreakPriority || 'GOAL_DIFFERENCE_FIRST'
        };
        tournaments.unshift(next);
        return send(next, 201);
      }
    }

    if (path === '/api/communities/7/tournaments/11/teams/schedule' && method === 'POST') {
      if (publishedTeamSchedule || teams.length < 2
          || teams.some(t => t.playersPerTeam == null
            ? t.players.length < 1 || t.players.length > 30
            : t.players.length !== t.playersPerTeam)) {
        return send({ message: 'Plantéis incompletos ou calendário existente' }, 409);
      }
      publishedTeamSchedule = true;
      tournaments[0].status = 'IN_PROGRESS';
      teamFixtures.push({ id: 75, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Azuis',
        awayTeamId: 41, awayTeamName: 'Verdes', status: 'SCHEDULED',
        homeScore: null, awayScore: null });
      if (tournaments[0].roundRobinLegs === 2) {
        teamFixtures.push({ id: 76, roundNumber: 2, homeTeamId: 41, homeTeamName: 'Verdes',
          awayTeamId: 40, awayTeamName: 'Azuis', status: 'SCHEDULED',
          homeScore: null, awayScore: null });
      }
      return send({ tournamentId: 11, status: 'IN_PROGRESS',
        teamCount: teams.length,
        roundCount: tournaments[0].roundRobinLegs === 2 ? 2 : 1,
        matchCount: teamFixtures.length });
    }
    if (path === '/api/communities/7/tournaments/11/teams/matches' && method === 'GET') {
      const page = Number(url.searchParams.get('page') || 0);
      return send({ matches: page === 0 ? teamFixtures : [], page, hasMore: false });
    }
    if (path === '/api/communities/7/tournaments/11/teams/standings' && method === 'GET') {
      if (tournaments[0].format === 'KNOCKOUT') return send({ message: 'Só liga' }, 409);
      const rows = teams.map(t => ({ teamId: t.id, teamName: t.name,
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
        goalDifference: 0, points: 0, position: 0 }));
      for (const match of teamFixtures.filter(m => m.status === 'COMPLETED')) {
        const home = rows.find(t => t.teamId === match.homeTeamId)!;
        const away = rows.find(t => t.teamId === match.awayTeamId)!;
        const h = match.homeScore!, a = match.awayScore!;
        home.played++; away.played++;
        home.goalsFor += h; home.goalsAgainst += a;
        away.goalsFor += a; away.goalsAgainst += h;
        if (h > a) { home.won++; away.lost++; home.points += 3; }
        else if (h < a) { away.won++; home.lost++; away.points += 3; }
        else { home.drawn++; away.drawn++; home.points++; away.points++; }
      }
      rows.forEach(t => t.goalDifference = t.goalsFor - t.goalsAgainst);
      rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference
        || b.goalsFor - a.goalsFor || b.won - a.won || a.teamId - b.teamId);
      rows.forEach((row, i) => row.position = i + 1);
      return send({ tournamentId: 11, status: tournaments[0].status,
        totalMatches: teamFixtures.length,
        completedMatches: teamFixtures.filter(m => m.status === 'COMPLETED').length,
        winPoints: 3, drawPoints: 1, lossPoints: 0, standings: rows });
    }
    if (/^\/api\/communities\/7\/tournaments\/11\/teams\/matches\/\d+\/result$/.test(path)
        && method === 'POST') {
      if (role !== 'OWNER' && role !== 'ADMIN') return send({ message: 'Sem permissão' }, 403);
      const match = teamFixtures.find(m => path.endsWith('/' + m.id + '/result'));
      const body = req.postDataJSON() as { homeScore: number; awayScore: number };
      if (!match || !Number.isInteger(body.homeScore) || !Number.isInteger(body.awayScore)
          || body.homeScore < 0 || body.awayScore < 0 || body.homeScore > 999 || body.awayScore > 999) {
        return send({ message: 'Resultado inválido' }, 400);
      }
      match.homeScore = body.homeScore;
      match.awayScore = body.awayScore;
      match.status = 'COMPLETED';
      if (tournaments[0].format === 'KNOCKOUT') {
        if (body.homeScore === body.awayScore) return send({ message: 'Necessário vencedor' }, 422);
        const winnerId = body.homeScore > body.awayScore ? match.homeTeamId : match.awayTeamId;
        Object.assign(tournaments[0], {
          status: 'COMPLETED', completedAt: '2026-10-17T14:00:00Z',
          championTeamId: winnerId,
          championTeamName: teams.find(t => t.id === winnerId)?.name,
          championTied: false, championPoints: null
        });
      }
      return send(match);
    }
    if (path === '/api/communities/7/tournaments/11/teams/complete' && method === 'POST') {
      if (role !== 'OWNER' && role !== 'ADMIN') return send({ message: 'Sem permissão' }, 403);
      if (tournaments[0].status !== 'IN_PROGRESS'
          || !teamFixtures.length || teamFixtures.some(game => game.status !== 'COMPLETED')) {
        return send({ message: 'Ainda existem confrontos por concluir' }, 409);
      }
      const game = teamFixtures[0];
      const tied = game.homeScore === game.awayScore;
      const winnerId = tied ? null : game.homeScore! > game.awayScore!
        ? game.homeTeamId : game.awayTeamId;
      Object.assign(tournaments[0], {
        status: 'COMPLETED', completedAt: '2026-10-17T13:00:00Z',
        championTeamId: winnerId,
        championTeamName: winnerId == null ? null : teams.find(t => t.id === winnerId)?.name,
        championTied: tied, championPoints: tied ? null : 3
      });
      return send(tournaments[0]);
    }
    if (path === '/api/communities/7/tournaments/11/teams') {
      if (method === 'GET') return send(teams);
      if (method === 'POST') {
        const body = req.postDataJSON() as { name: string };
        const trimmed = body.name.trim();
        if (!trimmed || teams.some(t => t.name.toLowerCase() === trimmed.toLowerCase()))
          return send({ message: 'Equipa duplicada' }, 409);
        const created: MockTeam = {
          id: 40 + teams.length, name: trimmed,
          playersPerTeam: tournaments[0]?.playersPerTeam ?? null,
          createdAt: '2026-10-17T12:00:00Z', players: []
        };
        teams.push(created);
        return send(created, 201);
      }
    }
    const teamDelete = /^\/api\/communities\/7\/tournaments\/11\/teams\/(\d+)$/.exec(path);
    if (teamDelete && method === 'DELETE') {
      const t = teams.find(x => x.id === Number(teamDelete[1]));
      if (!t) return send({ message: 'Equipa não encontrada' }, 404);
      if (t.players.length) return send({ message: 'Retira os jogadores primeiro' }, 409);
      teams.splice(teams.indexOf(t), 1);
      return send(null, 204);
    }
    const teamPlayer = /^\/api\/communities\/7\/tournaments\/11\/teams\/(\d+)\/players(?:\/(\d+))?$/.exec(path);
    if (teamPlayer) {
      const t = teams.find(x => x.id === Number(teamPlayer[1]));
      if (!t) return send({ message: 'Equipa não encontrada' }, 404);
      if (method === 'POST' && !teamPlayer[2]) {
        const body = req.postDataJSON() as { profileId: number };
        const member = community.members.find(m => m.profileId === body.profileId);
        if (!member || teams.some(x => x.players.some(p => p.profileId === body.profileId))
            || t.players.length >= (t.playersPerTeam ?? 30))
          return send({ message: 'Jogador indisponível' }, 409);
        t.players.push({ profileId: member.profileId, username: member.username,
          displayName: member.fullName });
        return send(t, 201);
      }
      if (method === 'DELETE' && teamPlayer[2]) {
        t.players = t.players.filter(p => p.profileId !== Number(teamPlayer[2]));
        return send(null, 204);
      }
    }

    if (method === 'DELETE' && path === '/api/communities/7/tournaments/9') {
      const target = tournaments.find(t => t.id === 9);
      if (!target) return send({ message: 'Não encontrado' }, 404);
      if (target.status === 'COMPLETED' || matches.some(m => m.status === 'COMPLETED')) {
        return send({ message: 'Resultados já registados' }, 409);
      }
      tournaments.splice(tournaments.indexOf(target), 1);
      participants.splice(0, participants.length);
      matches.splice(0, matches.length);
      return send(null, 204);
    }
    if (path === '/api/communities/7/tournaments/9/participants') {
      if (method === 'GET') {
        if (mode === 'switch') {
          await new Promise<void>(resolve => pendingDetailResponses.push(resolve));
        }
        const requestedPage = Number(url.searchParams.get('page') || 0);
        requestedParticipantPages.push(requestedPage);
        if (mode === 'paged-enrollment') {
          return send({
            participants: participants.slice(requestedPage, requestedPage + 1),
            page: requestedPage, hasMore: requestedPage < participants.length - 1
          });
        }
        if (mode === 'schedule-roster-paged' || mode === 'schedule-roster-oversize') {
          const offset = requestedPage * 20;
          return send({
            participants: participants.slice(offset, offset + 20),
            page: requestedPage, hasMore: offset + 20 < participants.length
          });
        }
        return send({ participants, page: 0, hasMore: false });
      }
    }
    if (path === '/api/communities/7/tournaments/11/participants') {
      if (method === 'GET') return send({ participants: [], page: 0, hasMore: false });
    }
    const manageParticipant = /^\/api\/communities\/7\/tournaments\/9\/participants\/(\d+)(\/confirm)?$/.exec(path);
    if (manageParticipant && method === 'PUT' && manageParticipant[2] === '/confirm') {
      const participant = participants.find(p => p.profileId === Number(manageParticipant[1]));
      if (!participant) return send({ message: 'Participante não encontrado' }, 404);
      organizerMutations.push('confirm:' + participant.profileId);
      participant.status = 'CONFIRMED';
      return send(participant);
    }
    if (manageParticipant && method === 'DELETE' && !manageParticipant[2]) {
      const profileId = Number(manageParticipant[1]);
      organizerMutations.push('remove:' + profileId);
      const position = participants.findIndex(p => p.profileId === profileId);
      if (position < 0) return send({ message: 'Participante não encontrado' }, 404);
      participants.splice(position, 1);
      return send(null, 204);
    }
    if (path === '/api/communities/7/tournaments/9/participants/me') {
      if (method === 'PUT') {
        joinAttempts++;
        const entry: Participant = {
          profileId: 2, username: 'participante', displayName: 'Participante',
          joinedAt: '2026-10-16T13:00:00Z', status: 'PENDING'
        };
        participants.push(entry);
        return send(entry);
      }
      if (method === 'DELETE') {
        participants.splice(0, participants.length, ...participants.filter(p => p.username !== username));
        return send(null, 204);
      }
    }
    if (path === '/api/communities/7/tournaments/9/schedule' && method === 'POST') {
      scheduleAttempts++;
      if (participants.filter(p => p.status === 'CONFIRMED').length > 32) {
        return send({ message: 'Esta versão suporta no máximo 32 jogadores confirmados' }, 422);
      }
      tournaments[0].status = 'IN_PROGRESS';
      tournaments[0].startedAt = '2026-10-16T13:00:00Z';
      matches.push({
        id: 30, roundNumber: 1, homeProfileId: 1, homeUsername: 'organizador',
        awayProfileId: 2, awayUsername: 'participante', status: 'SCHEDULED',
        homeScore: null, awayScore: null
      });
      return send({
        tournamentId: 9, status: 'IN_PROGRESS',
        participantCount: 2, roundCount: 1, matchCount: 1
      });
    }
    const scoreId = /^\/api\/communities\/7\/tournaments\/9\/matches\/(\d+)\/result$/.exec(path);
    if (scoreId && method === 'PUT') {
      const game = matches.find(match => match.id === Number(scoreId[1]));
      if (!game) return send({ message: 'Confronto não encontrado' }, 404);
      const body = req.postDataJSON() as { homeScore: number; awayScore: number };
      Object.assign(game, {
        status: 'COMPLETED', homeScore: body.homeScore, awayScore: body.awayScore
      });
      return send(game);
    }
    if (/^\/api\/communities\/7\/tournaments\/(9|11)\/matches$/.test(path) && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('page') || 0);
      requestedMatchPages.push(pageNumber);
      if (mode === 'paged') {
        return send({ matches: matches.slice(pageNumber, pageNumber + 1),
          page: pageNumber, hasMore: pageNumber < matches.length - 1 });
      }
      return send({ matches, page: pageNumber, hasMore: false });
    }
    if (/^\/api\/communities\/7\/tournaments\/(9|11)\/standings$/.test(path) && method === 'GET') {
      if (mode === 'forbidden') return send({ message: 'Acesso negado' }, 403);
      return send(standings());
    }
    if (path === '/api/communities/7/tournaments/9/complete' && method === 'POST') {
      completeAttempts++;
      if (mode === 'complete-rejected' && completeAttempts === 1) {
        return send({ detail: 'Todos os confrontos da liga precisam de estar concluídos' }, 409);
      }
      const top = standings().standings[0];
      const t = tournaments[0];
      t.status = 'COMPLETED';
      t.completedAt = '2026-10-16T14:00:00Z';
      const second = standings().standings[1];
      const isTie = Boolean(second &&
        top.points === second.points && top.goalDifference === second.goalDifference &&
        top.goalsFor === second.goalsFor && top.won === second.won);
      t.championTied = isTie;
      t.championProfileId = isTie ? null : top.profileId;
      t.championUsername = isTie ? null : top.username;
      t.championDisplayName = isTie ? null : top.displayName;
      t.championPoints = isTie ? null : top.points;
      return send(t);
    }
    if (path === '/api/notifications/unread-count' && method === 'GET') return send(0);

    console.log('[E2E unmocked]', method, path);
    unmocked.push(method + ' ' + path);
    await send({ message: 'Unmocked browser-test endpoint' }, 404);
  });

  return {
    tournaments, teams, teamFixtures, participants, matches, unmocked, requestedMatchPages,
    requestedParticipantPages, organizerMutations,
    get completeAttempts(): number { return completeAttempts; },
    get scheduleAttempts(): number { return scheduleAttempts; },
    get createCommunityRequest(): unknown { return createCommunityRequest; },
    get updatedCommunitySports(): string[] | null { return updatedCommunitySports; },
    get listAttempts(): number { return listAttempts; },
    get joinAttempts(): number { return joinAttempts; },
    get pendingDetails(): number { return pendingDetailResponses.length; },
    get archivePreviewCalls(): number { return archivePreviewCalls; },
    get archiveConfirmCalls(): number { return archiveConfirmCalls; },
    historicalArchives,
    releaseDetails(): void {
      pendingDetailResponses.splice(0).forEach(resolve => resolve());
    }
  };
}


test('organizador importa classificação histórica sem criar partidas e vê estatísticas completas', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'history');
  await page.goto('/menu/communities/7?tab=ranking');
  await expect(page.getByRole('heading', { name: 'Classificações arquivadas' })).toBeVisible();

  const original = page.getByRole('button', { name: /Liga de 2022/ });
  await original.click();
  const historyTable = page.locator('.archive-standings-table').first();
  await expect(historyTable.getByRole('columnheader', { name: 'Golos marcados' })).toBeVisible();
  await expect(historyTable.getByRole('columnheader', { name: 'Vitórias' })).toBeVisible();
  await expect(historyTable.locator('tbody tr')).toHaveCount(2);
  await expect(historyTable.locator('tbody tr').first()).toContainText('Águias');
  await expect(historyTable.locator('tbody tr').first()).toContainText('21');
  await expect(historyTable.locator('tbody tr').first()).toContainText('25');

  await page.getByRole('button', { name: 'Classificação final' }).click();
  const input = page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]');
  await input.setInputFiles({ name: 'tabela.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Pos;Equipa;J;V;E;D;Pts;GM;GS\n1;Águias;10;8;1;1;25;21;9\n') });
  await page.getByRole('button', { name: 'Analisar ficheiro' }).click();
  await expect(page.getByText('Folha ou conjunto de dados')).toBeVisible();
  await page.getByRole('button', { name: 'Validar e ver dados' }).click();
  await expect(page.getByText('Pré-visualização da classificação final')).toBeVisible();
  await expect(page.getByText(/Linha 4: ÁGUIAS repetido/)).toBeVisible();
  expect(fixture.archivePreviewCalls).toBe(1);
  expect(fixture.archiveConfirmCalls).toBe(0);

  await page.getByLabel('Nome do histórico').fill('Liga de 2020');
  await page.getByLabel('Classificação de').selectOption('TEAM');
  const confirm = page.getByRole('button', { name: 'Guardar classificação histórica' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /Confirmo que esta tabela corresponde/ }).check();
  await confirm.click();
  await expect(page.getByText('Classificação histórica guardada')).toBeVisible();
  await expect(page.getByRole('button', { name: /Liga de 2020/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Liga de 2022/ })).toBeVisible();
  expect(fixture.archiveConfirmCalls).toBe(1);
  expect(fixture.historicalArchives).toHaveLength(2);
  expect(fixture.unmocked.filter(x => x.includes('/competition/standings-archives') ||
    x.includes('/competition/import/standings'))).toEqual([]);
});

test('membro consulta classificação arquivada mas não pode importar outra', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'MEMBER', 'history');
  await page.goto('/menu/communities/7?tab=ranking');
  await expect(page.getByRole('heading', { name: 'Classificações arquivadas' })).toBeVisible();
  await page.getByRole('button', { name: /Liga de 2022/ }).click();
  const table = page.locator('.archive-standings-table');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.locator('tbody tr').first()).toContainText('Águias');
  await expect(page.getByRole('button', { name: 'Classificação final' })).toHaveCount(0);
  expect(fixture.archiveConfirmCalls).toBe(0);
  expect(fixture.unmocked.filter(x => x.includes('/competition/standings-archives'))).toEqual([]);
});

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  console.log('[E2E diagnostics] url:', page.url());
  console.log('[E2E component state]', await page.evaluate(() => {
    try {
      const ng = (window as any).ng;
      const element = document.querySelector('app-community-tournaments');
      const instance = ng?.getComponent?.(element);
      return element && instance ? {
        loading: instance.loading,
        detailsLoading: instance.detailsLoading,
        tournamentsLength: instance.tournaments?.length,
        selected: instance.selected?.id,
        error: instance.error
      } : { ngAvailable: !!ng, elementFound: !!element };
    } catch(e) { return { error: String(e) }; }
  }));
  console.log('[E2E diagnostics] page:', (await page.locator('body').innerText().catch(() => '')).slice(0, 3200));
});

test('organizador abre Torneios e cria uma liga no navegador', async ({ page }) => {
  const state = await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Competições da comunidade' })).toBeVisible();
  await expect(page.getByText('Esta comunidade ainda não tem competições.')).toBeVisible();
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Liga de Inverno');
  await page.getByRole('button', { name: 'Confirmar liga individual' }).click();
  await expect(page.getByRole('heading', { name: 'Liga de Inverno' })).toBeVisible();
  await expect(page.getByText('Torneio criado.')).toBeVisible();
  expect(state.tournaments).toHaveLength(1);
  expect(state.tournaments[0].status).toBe('DRAFT');
});

test('membro pede inscrição sem conseguir gerir torneios', async ({ page }) => {
  const state = await mockCommunityApi(page, 'MEMBER', 'draft');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Liga de Outono' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar liga individual' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gerar jornadas' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pedir inscrição' }).click();
  await expect(page.getByRole('button', { name: 'Cancelar a minha inscrição' })).toBeVisible();
  await expect(page.getByText('A aguardar aprovação')).toBeVisible();
  expect(state.participants).toHaveLength(1);
  expect(state.participants[0].status).toBe('PENDING');
});

test('organizador publica jornada, regista resultado e encerra a liga', async ({ page }) => {
  const state = await mockCommunityApi(page, 'OWNER', 'draft');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Liga de Outono' })).toBeVisible();
  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();
  await expect(page.getByText('Confrontos e resultados')).toBeVisible();

  await page.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Golos de participante' }).fill('1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('1 / 1 confrontos concluídos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corrigir' })).toBeVisible();

  await page.getByRole('button', { name: 'Encerrar torneio' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar' }).click();
  await expect(page.getByText('Campeão: Organizador')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0);
  expect(state.tournaments[0].status).toBe('COMPLETED');
  expect(state.tournaments[0].championUsername).toBe('organizador');
});

test('carrega outra página de jogos e preserva ambas ao registar um resultado', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'paged');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await expect(page.locator('.match-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Carregar mais jogos' }).click();
  await expect(page.locator('.match-card')).toHaveCount(2);

  const secondRound = page.locator('.match-card').filter({ hasText: 'Jornada 2' });
  await secondRound.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('4');
  await secondRound.getByRole('spinbutton', { name: 'Golos de participante' }).fill('2');
  await secondRound.getByRole('button', { name: 'Guardar' }).click();

  await expect(secondRound.getByRole('button', { name: 'Corrigir' })).toBeVisible();
  await expect(page.locator('.match-card')).toHaveCount(2);
  expect(fixture.requestedMatchPages).toEqual([0, 1]);
  expect(fixture.matches[1].homeScore).toBe(4);
  expect(fixture.matches[1].awayScore).toBe(2);
});

test('rejeição de acesso ao detalhe apresenta erro e permite tentar novamente', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'forbidden');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os dados do torneio.');
  await expect(page.getByRole('button', { name: 'Atualizar' })).toBeEnabled();
});

test('ignora resposta antiga após selecionar outro torneio', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'switch');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await expect.poll(() => fixture.pendingDetails).toBe(1);
  await page.getByRole('button', { name: /Liga alternativa/ }).click();
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga alternativa');
  await expect(page.getByText('Ainda não existem inscrições neste torneio.')).toBeVisible();

  fixture.releaseDetails();
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga alternativa');
  await expect(page.getByText('Ainda não existem inscrições neste torneio.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('organizador aprova uma inscrição e remove outra sem perder os jogadores confirmados', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'management');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await expect(page.getByText('2 confirmados nesta lista')).toBeVisible();

  const mariana = page.locator('.player-item').filter({ hasText: '@mariana' });
  await expect(mariana.getByText('A aguardar aprovação')).toBeVisible();
  await mariana.getByRole('button', { name: 'Confirmar' }).click();
  await expect(mariana.getByText('Confirmado')).toBeVisible();
  await expect(page.getByText('3 confirmados nesta lista')).toBeVisible();

  const pedro = page.locator('.player-item').filter({ hasText: '@pedro' });
  await expect(pedro).toBeVisible();
  await pedro.getByRole('button', { name: 'Remover' }).click();
  await expect(pedro).toHaveCount(0);
  await expect(page.getByText('3 confirmados nesta lista')).toBeVisible();

  expect(fixture.organizerMutations).toEqual(['confirm:3', 'remove:4']);
  expect(fixture.participants.map(p => p.username)).toEqual(
    ['organizador', 'participante', 'mariana']
  );
  await expect(page.locator('.standings-table tbody tr')).toHaveCount(3);
});

test('correção de resultado altera os pontos e a ordem da classificação', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'draft');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();

  const match = page.locator('.match-card').first();
  await expect(match).toBeVisible();
  await match.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('2');
  await match.getByRole('spinbutton', { name: 'Golos de participante' }).fill('1');
  await match.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.standings-table tbody tr').first()).toContainText('Organizador');

  await match.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('0');
  await match.getByRole('spinbutton', { name: 'Golos de participante' }).fill('3');
  await match.getByRole('button', { name: 'Corrigir' }).click();
  await expect(page.locator('.standings-table tbody tr').first()).toContainText('Participante');
  await expect(page.locator('.standings-table tbody tr').first()).toContainText('3');
  await expect(page.getByText('1 / 1 confrontos concluídos')).toBeVisible();
  expect(fixture.matches[0].homeScore).toBe(0);
  expect(fixture.matches[0].awayScore).toBe(3);
});

test('erro HTTP 409 ao encerrar não bloqueia a liga e permite tentar de novo', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'complete-rejected');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();
  const game = page.locator('.match-card').first();
  await game.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('1');
  await game.getByRole('spinbutton', { name: 'Golos de participante' }).fill('0');
  await game.getByRole('button', { name: 'Guardar' }).click();

  await page.getByRole('button', { name: 'Encerrar torneio' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Todos os confrontos da liga precisam de estar concluídos'
  );
  await expect(page.getByRole('button', { name: 'Encerrar torneio' })).toBeEnabled();
  expect(fixture.tournaments[0].status).toBe('IN_PROGRESS');
  expect(fixture.completeAttempts).toBe(1);

  await page.getByRole('button', { name: 'Encerrar torneio' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar' }).click();
  await expect(page.getByText('Campeão: Organizador')).toBeVisible();
  expect(fixture.completeAttempts).toBe(2);
  expect(fixture.tournaments[0].status).toBe('COMPLETED');
});

test('falha de rede ao listar torneios informa o utilizador e recupera sem falsos estados vazios', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'list-network-error');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar os torneios.');
  await expect(page.getByText('Esta comunidade ainda não tem competições.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(fixture.listAttempts).toBe(2);
  expect(fixture.tournaments).toHaveLength(1);
});

test('inscrição na segunda página impede pedidos duplicados antes de carregar a lista inteira', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'MEMBER', 'paged-enrollment');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await expect(page.getByText('Consulta as restantes inscrições para verificar se já estás inscrito.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedir inscrição' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver mais jogadores' }).click();

  const mine = page.locator('.player-item').filter({ hasText: '@participante' });
  await expect(mine.getByText('A aguardar aprovação')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar a minha inscrição' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedir inscrição' })).toHaveCount(0);
  expect(fixture.requestedParticipantPages).toEqual([0, 1]);
  expect(fixture.joinAttempts).toBe(0);
});

test('empate desportivo no primeiro lugar não atribui campeão arbitrário', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'draw-tie');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();
  const game = page.locator('.match-card').first();
  await game.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('1');
  await game.getByRole('spinbutton', { name: 'Golos de participante' }).fill('1');
  await game.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('1 / 1 confrontos concluídos')).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar torneio' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar' }).click();

  await expect(page.getByText('Empate no primeiro lugar')).toBeVisible();
  await expect(page.getByText('O torneio terminou com igualdade nos critérios de desempate.')).toBeVisible();
  await expect(page.getByText(/Campeão:/)).toHaveCount(0);
  await expect(page.locator('.standings-table tbody tr')).toHaveCount(2);
  expect(fixture.tournaments[0].status).toBe('COMPLETED');
  expect(fixture.tournaments[0].championTied).toBe(true);
  expect(fixture.tournaments[0].championProfileId).toBeNull();
});

test('separadores têm indicação acessível e funcionam por teclado', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft');
  await page.goto('/menu/communities/7');

  const nav = page.locator('.community-tabs');
  const tournamentsTab = nav.getByRole('button', { name: 'Competições' });
  const sessionsTab = nav.getByRole('button', { name: /Sessões|Sessions/ });

  await expect(tournamentsTab).toBeVisible();
  await expect(tournamentsTab).not.toHaveAttribute('aria-current', 'true');
  await tournamentsTab.focus();
  await expect(tournamentsTab).toBeFocused();
  await tournamentsTab.press('Enter');

  await expect(tournamentsTab).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'Competições da comunidade' })).toBeVisible();
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  await sessionsTab.focus();
  await sessionsTab.press('Space');
  await expect(sessionsTab).toHaveAttribute('aria-current', 'true');
  await expect(tournamentsTab).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'Competições da comunidade' })).toHaveCount(0);

  await tournamentsTab.focus();
  await tournamentsTab.press('Enter');
  await expect(tournamentsTab).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
});

test('ações repetidas de participantes têm nomes únicos para tecnologias de apoio', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'management');
  await page.goto('/menu/communities/7?tab=tournaments');

  const confirmMariana = page.getByRole('button', { name: 'Confirmar inscrição de Mariana' });
  const removePedro = page.getByRole('button', { name: 'Remover Pedro do torneio' });
  const removeMariana = page.getByRole('button', { name: 'Remover Mariana do torneio' });

  await expect(confirmMariana).toBeVisible();
  await expect(removePedro).toBeVisible();
  await expect(removeMariana).toBeVisible();
  await confirmMariana.focus();
  await confirmMariana.press('Enter');
  await expect(page.locator('.player-item').filter({ hasText: '@mariana' }))
    .toContainText('Confirmado');

  await removePedro.focus();
  await removePedro.press('Space');
  await expect(removePedro).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Classificação do torneio' })).toBeVisible();
  expect(fixture.organizerMutations).toEqual(['confirm:3', 'remove:4']);
});

test('torneios mantêm-se dentro do ecrã e classificação permite scroll horizontal', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft');

  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/menu/communities/7?tab=tournaments');
    await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

    const geometry = await page.locator('.tournaments').evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, viewport: window.innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);

    const table = page.getByRole('table', { name: 'Classificação do torneio' });
    await expect(table).toBeVisible();
    const scroll = page.locator('.standings-scroll');
    await expect(scroll).toBeVisible();
    if (width === 360) {
      const distances = await scroll.evaluate(element => {
        const available = element.scrollWidth - element.clientWidth;
        element.scrollLeft = element.scrollWidth;
        return { available, actual: element.scrollLeft };
      });
      expect(distances.available).toBeGreaterThan(0);
      expect(distances.actual).toBeGreaterThan(0);
    }
  }
});

test('nome inválido mostra ajuda acessível e impede criar torneio', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/7?tab=tournaments');

  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  const name = page.getByRole('textbox', { name: 'Nome do torneio' });
  const submit = page.getByRole('button', { name: 'Confirmar liga individual' });
  await name.fill('L');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAttribute('aria-describedby', 'tournament-name-hint');
  await expect(page.getByText('O nome deve ter pelo menos 2 caracteres.')).toBeVisible();
  await expect(submit).toBeDisabled();
  expect(fixture.tournaments).toHaveLength(0);

  await name.fill('Liga de Inverno');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('O nome deve ter pelo menos 2 caracteres.')).toHaveCount(0);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('Torneio criado.')).toBeVisible();
  expect(fixture.tournaments).toHaveLength(1);
});

test('marcador inválido explica erro junto ao confronto e impede guardar', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'draft');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();

  const game = page.locator('.match-card').first();
  const home = game.getByRole('spinbutton', { name: 'Golos de organizador' });
  const away = game.getByRole('spinbutton', { name: 'Golos de participante' });
  const submit = game.getByRole('button', { name: 'Guardar' });
  await home.fill('-1');
  await expect(home).toHaveAttribute('aria-invalid', 'true');
  await expect(game.getByText('Indica dois marcadores inteiros entre 0 e 999.')).toBeVisible();
  await expect(submit).toBeDisabled();
  await home.fill('2');
  await away.fill('1');
  await expect(home).not.toHaveAttribute('aria-invalid', 'true');
  await expect(game.getByText('Indica dois marcadores inteiros entre 0 e 999.')).toHaveCount(0);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(game.getByRole('button', { name: 'Corrigir' })).toBeVisible();
  expect(fixture.matches[0].homeScore).toBe(2);
});

test('falha do backend foca o alerta para navegação só com teclado', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'complete-rejected');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();
  const game = page.locator('.match-card').first();
  await game.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('1');
  await game.getByRole('spinbutton', { name: 'Golos de participante' }).fill('0');
  await game.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Encerrar torneio' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar' }).click();

  const error = page.getByRole('alert');
  await expect(error).toContainText('Todos os confrontos da liga precisam de estar concluídos');
  await expect(error).toBeFocused();
  await expect(page.getByRole('button', { name: 'Encerrar torneio' })).toBeEnabled();
});

test('após aprovação ou remoção o foco regressa à secção Jogadores', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'management');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
  const heading = page.getByRole('heading', { name: 'Participantes', exact: true });
  await page.getByRole('button', { name: 'Confirmar inscrição de Mariana' }).click();
  await expect(page.locator('.player-item').filter({ hasText: '@mariana' })).toContainText('Confirmado');
  await expect(heading).toBeFocused();

  await page.getByRole('button', { name: 'Remover Pedro do torneio' }).click();
  await expect(page.locator('.player-item').filter({ hasText: '@pedro' })).toHaveCount(0);
  await expect(heading).toBeFocused();
});

test('não permite publicar calendário sem consultar todas as páginas de inscrições', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'schedule-roster-paged');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  const generate = page.getByRole('button', { name: 'Gerar jornadas' });
  await expect(page.getByText('20 confirmados nesta lista')).toBeVisible();
  await expect(generate).toBeDisabled();
  await expect(page.getByText('Carrega todas as inscrições antes de publicar o calendário.')).toBeVisible();
  expect(fixture.scheduleAttempts).toBe(0);

  await page.getByRole('button', { name: 'Ver mais jogadores' }).click();
  await expect(page.getByText('21 confirmados nesta lista')).toBeVisible();
  await expect(page.getByText('Carrega todas as inscrições antes de publicar o calendário.')).toHaveCount(0);
  await expect(generate).toBeEnabled();
  expect(fixture.requestedParticipantPages).toEqual([0, 1]);
  expect(fixture.scheduleAttempts).toBe(0);
});

test('não permite gerar jornadas com mais de 32 jogadores confirmados', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'schedule-roster-oversize');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  const generate = page.getByRole('button', { name: 'Gerar jornadas' });
  await expect(generate).toBeDisabled();
  await page.getByRole('button', { name: 'Ver mais jogadores' }).click();
  await expect(page.getByText('33 confirmados nesta lista')).toBeVisible();
  await expect(generate).toBeDisabled();
  await expect(page.getByText('Esta versão permite no máximo 32 jogadores confirmados.')).toBeVisible();
  expect(fixture.requestedParticipantPages).toEqual([0, 1]);
  expect(fixture.scheduleAttempts).toBe(0);
});

test('basquetebol apresenta pontos no marcador e na classificação, sem golos', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft', 'Basquetebol');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.getByText('Basquetebol · Liga individual')).toBeVisible();
  await expect(page.getByText(/Formato atual: confrontos entre participantes individuais/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'PM' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'PS' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'DP' })).toBeVisible();
  await expect(page.getByText('Classificação apenas desta competição: pontos, diferença de pontos, pontos marcados e vitórias.')).toBeVisible();

  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Pontos de organizador' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Pontos de participante' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Golos de organizador' })).toHaveCount(0);
});

test('padel mostra sets e esclarece que ainda não regista resultados set a set', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft', 'Pádel');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.getByText('Pádel · Liga individual')).toBeVisible();
  await expect(page.getByText(/Não regista o resultado de cada set nem organiza pares/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'SG' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'SP' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'DS' })).toBeVisible();

  await page.getByRole('button', { name: 'Gerar jornadas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar calendário' }).click();
  await page.getByRole('spinbutton', { name: 'Sets ganhos de organizador' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Sets ganhos de participante' }).fill('1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('1 / 1 confrontos concluídos')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'SG' })).toBeVisible();
});

test('modalidade sem perfil de pontuação não é apresentada como futebol', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft', 'Ciclismo');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.getByText('Ciclismo · Liga individual')).toBeVisible();
  await expect(page.getByText(/Ainda não suporta pares, equipas nem provas por tempos ou distâncias/)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'MF' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'MC' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'DM' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'GM' })).toHaveCount(0);
});

test('cria comunidade com várias modalidades e abre convites após guardar', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/create');

  await page.locator('input[name="name"]').fill('Amigos de Lisboa');
  await page.locator('input[name="sportSearch"]').fill('pad');
  await page.getByRole('button', { name: /Padel/ }).click();
  await page.locator('input[name="sportSearch"]').fill('basquet');
  await page.getByRole('button', { name: /Basquetebol$/ }).click();
  await expect(page.getByRole('button', { name: 'Remover Padel' })).toBeVisible();
  await page.locator('button[type="submit"]').click();

  await expect.poll(() => fixture.createCommunityRequest).toMatchObject({
    name: 'Amigos de Lisboa', sport: 'Padel', sports: ['Padel', 'Basquetebol']
  });
  await expect(page).toHaveURL(/\/menu\/communities\/7\/invite/);
});

test('gestores editam várias modalidades e atualizam a comunidade sem afetar a navegação', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'draft');
  await page.goto('/menu/communities/7?tab=home');
  await expect(page.getByRole('heading', { name: 'Desportos desta comunidade' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar modalidades' }).click();

  await page.locator('input[name="editCommunitySports"]').fill('pad');
  await page.getByRole('button', { name: 'Padel +' }).click();
  await page.getByRole('button', { name: 'Remover Futebol' }).click();
  await page.getByRole('button', { name: 'Guardar modalidades' }).click();

  await expect(page.getByText('Modalidades atualizadas.')).toBeVisible();
  expect(fixture.updatedCommunitySports).toEqual(['Padel']);
  await expect(page.getByRole('heading', { name: 'Desportos desta comunidade' })).toBeVisible();
});

test('comunidade multidesporto leva à criação da sessão e permite escolher a modalidade', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft', 'Futebol', ['Futebol', 'Padel']);
  await page.goto('/menu/communities/7?tab=sessions');
  await expect(page.locator('.community-tab-panel')).toBeVisible();
  const createLink = page.locator('.community-tab-panel')
    .getByRole('link', { name: /Criar sessão/ });
  await expect(createLink).toHaveAttribute('href', '/menu/createEvent?community=7');
  await createLink.click();

  await expect(page).toHaveURL(/\/menu\/createEvent\?community=7/);
  await expect(page.getByText('Modalidades do grupo')).toBeVisible();
  const futbol = page.getByRole('button', { name: 'Futebol', exact: true });
  const padel = page.getByRole('button', { name: 'Padel', exact: true });
  await expect(futbol).toHaveAttribute('aria-pressed', 'false');
  await expect(padel).toHaveAttribute('aria-pressed', 'false');
  await padel.click();
  await expect(padel).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[name="sport"]')).toHaveValue('Padel');
  await expect(page.getByRole('link', { name: /Voltar.*comunidade/i })).toHaveAttribute(
    'href', '/menu/communities/7'
  );
});

test('comunidade com modalidade única preenche a modalidade automaticamente', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'draft', 'Futebol', ['Futebol']);
  await page.goto('/menu/createEvent?community=7');

  await expect(page.getByText('Modalidades do grupo')).toBeVisible();
  await expect(page.locator('input[name="sport"]')).toHaveValue('Futebol');
  await expect(page.getByRole('button', { name: 'Futebol', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
});

test('descoberta mostra modalidades de comunidades múltiplas, legadas e sem desporto', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'MEMBER', 'discovery');
  await page.goto('/menu/communities');
  await page.locator('.community-pitch-actions button').click();

  const cards = page.locator('#community-search .community-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.first().locator('.sport-tag')).toHaveText([
    'Futebol', 'Padel', 'Ténis', '+1'
  ]);
  await expect(cards.nth(1).locator('.sport-tag')).toHaveText(['Padel']);
  await expect(cards.nth(2).locator('.sport-blank'))
    .toHaveText('Ainda sem modalidades definidas');
  await cards.first().click();
  await expect(page).toHaveURL(/communities.*7/);
  await expect(page.locator('.community-detail-copy .community-discovery-sports .sport-tag'))
    .toHaveText(['Futebol', 'Padel', 'Ténis', 'Natação']);
  expect(fixture.unmocked.filter(request => request.includes('/api/communities/'))).toEqual([]);
});

test('torneio multidesporto bloqueia natação sem perfil competitivo e aceita basquetebol', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty', 'Futebol', ['Futebol', 'Padel']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Liga de amigos');
  await expect(page.locator('.create-actions .t-btn-primary')).toBeDisabled();

  await page.locator('#new-tournament-sport-search').fill('natacao');
  await page.getByRole('button', { name: 'Natação', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Formato ainda indisponível' })).toBeDisabled();
  await expect(page.locator('.classification-notice')).toContainText('jornadas da comunidade');
  expect(fixture.tournaments).toHaveLength(0);

  await page.getByRole('button', { name: 'Alterar' }).click();
  await page.locator('#new-tournament-sport-search').fill('basquet');
  await page.getByRole('button', { name: 'Basquetebol', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirmar liga individual' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirmar liga individual' }).click();

  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de amigos');
  await expect(page.locator('.t-tournament-sport')).toHaveText('Basquetebol');
  expect(fixture.tournaments[0].sport).toBe('Basquetebol');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('comunidade apenas com sessões oculta módulos e pode reativá-los no início', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'modules-off');
  await page.goto('/menu/communities/7?tab=tournaments');
  const nav = page.locator('.community-tabs');
  await expect(nav.getByRole('button', { name: 'Competições' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: /Classificação/ })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: /Estatísticas/ })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: /Sessões/ })).toBeVisible();
  await page.getByRole('button', { name: 'Gerir funcionalidades' }).click();
  await expect(page.getByRole('group', { name: 'Funcionalidades opcionais' })).toBeVisible();
});

test('grupo que optou só por equipas não oferece criação individual', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'teams-only');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Como funciona?' }).click();
  await expect(page.getByRole('button', { name: 'Criar liga individual' })).toHaveCount(0);
  await expect(page.getByText(/Para permitir ligas individuais/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparar torneio por equipas' })).toBeVisible();
  await expect(page.getByText('Ligas e taças disponíveis')).toBeVisible();
});

test('guia distingue competições das estatísticas habituais e explica o torneio por equipas', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Como querem competir?' })).toBeVisible();
  await expect(page.getByText('Por equipas', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparar torneio por equipas' })).toBeVisible();
  await expect(page.getByText('Ligas e taças disponíveis')).toBeVisible();
  await expect(page.getByText(/histórico importado de Excel, CSV ou TSV/)).toBeVisible();
  await expect(page.getByText(/taças por eliminatórias, com plantéis e resultados registados/)).toBeVisible();
  await expect(page.getByText(/Também podem combinar fases de grupos e eliminatórias/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar liga individual' })).toBeVisible();
  await expect(page.getByLabel('Nome do torneio')).toHaveCount(0);
});

test('organizador remove torneio experimental sem resultados depois de confirmar o nome', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'trial');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.locator('.tournament-heading h4')).toHaveText('lol');
  await expect(page.getByRole('button', { name: 'Eliminar competição' })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar competição' }).click();
  await expect(page.getByText('Eliminar “lol”?', { exact: false })).toBeVisible();
  expect(fixture.tournaments).toHaveLength(1);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(fixture.tournaments).toHaveLength(1);

  await page.getByRole('button', { name: 'Eliminar competição' }).click();
  await page.getByRole('button', { name: 'Sim, eliminar competição' }).click();
  await expect(page.getByText('Competição eliminada.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como querem competir?' })).toBeVisible();
  expect(fixture.tournaments).toHaveLength(0);
});

test('organizador define a pontuação inicial de um torneio por equipas', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  const advanced = page.locator('.create-advanced-rules');
  await expect(advanced).not.toHaveAttribute('open', '');
  await expect(advanced.locator('summary')).toContainText('3 vitória');
  await advanced.locator('summary').click();
  const rules = page.getByRole('group', { name: 'Regras de pontuação' });
  await expect(rules.getByRole('spinbutton', { name: 'Vitória' })).toHaveValue('3');
  await expect(rules.getByRole('spinbutton', { name: 'Empate' })).toHaveValue('1');
  await expect(rules.getByRole('spinbutton', { name: 'Derrota' })).toHaveValue('0');
  await rules.getByRole('spinbutton', { name: 'Vitória' }).fill('-1');
  await page.getByLabel('Nome do torneio').fill('Liga pontos');
  await expect(page.getByRole('button', { name: 'Criar e preparar equipas' })).toBeDisabled();
  await rules.getByRole('spinbutton', { name: 'Vitória' }).fill('2');
  await rules.getByRole('spinbutton', { name: 'Empate' }).fill('0');
  await rules.getByRole('spinbutton', { name: 'Derrota' }).fill('0');
  await page.getByRole('button', { name: 'Criar e preparar equipas' }).click();
  await expect(page.locator('.tournament-heading')).toContainText('Vitória 2');
  expect(fixture.tournaments[0].winPoints).toBe(2);
  expect(fixture.tournaments[0].drawPoints).toBe(0);
  expect(fixture.tournaments[0].lossPoints).toBe(0);
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('regras de pontos personalizadas também se aplicam à liga individual', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Liga dos amigos');
  await page.locator('.create-advanced-rules summary').click();
  const rules = page.getByRole('group', { name: 'Regras de pontuação' });
  await rules.getByRole('spinbutton', { name: 'Vitória' }).fill('5');
  await rules.getByRole('spinbutton', { name: 'Empate' }).fill('2');
  await page.getByRole('button', { name: 'Confirmar liga individual' }).click();
  expect(fixture.tournaments[0].entryType).toBe('INDIVIDUAL');
  expect(fixture.tournaments[0].winPoints).toBe(5);
  expect(fixture.tournaments[0].drawPoints).toBe(2);
  await expect(page.locator('.tournament-heading')).toContainText('Vitória 5');
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('critério de desempate fica guardado na configuração inicial por equipas', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  await page.locator('.create-advanced-rules summary').click();
  const priorities = page.getByRole('group', { name: 'Critério de desempate' });
  const difference = priorities.getByRole('button', { name: /Diferença do marcador/ });
  const wins = priorities.getByRole('button', { name: /Mais vitórias/ });
  await expect(difference).toHaveAttribute('aria-pressed', 'true');
  await wins.click();
  await expect(wins).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Nome do torneio').fill('Liga personalizada');
  await page.getByRole('button', { name: 'Criar e preparar equipas' }).click();
  await expect(page.locator('.tournament-heading'))
    .toContainText('Desempate prioritário: Mais vitórias');
  expect(fixture.tournaments[0].teamTieBreakPriority).toBe('WINS_FIRST');
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('organizador prepara equipas reais e distribui membros sem criar jornadas individuais', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Como querem competir?' })).toBeVisible();
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  await page.getByLabel('Nome do torneio').fill('Torneio CNG');
  await page.getByRole('button', { name: 'Criar e preparar equipas' }).click();

  await expect(page.getByRole('heading', { name: 'Equipas e plantéis' })).toBeVisible();
  await expect(page.locator('.tournament-heading h4')).toHaveText('Torneio CNG');
  await expect(page.getByRole('table', { name: 'Classificação do torneio' })).toHaveCount(0);
  expect(fixture.tournaments[0].entryType).toBe('TEAM');
  expect(fixture.tournaments[0].playersPerTeam).toBeNull();

  await page.getByLabel('Nome da nova equipa').fill('Azuis');
  await page.getByRole('button', { name: 'Adicionar equipa' }).click();
  await expect(page.locator('.team-roster-card')).toHaveCount(1);

  await page.getByLabel('Nome da nova equipa').fill('Verdes');
  await page.getByRole('button', { name: 'Adicionar equipa' }).click();
  await expect(page.locator('.team-roster-card')).toHaveCount(2);

  const azuis = page.locator('.team-roster-card').filter({ hasText: 'Azuis' });
  const verdes = page.locator('.team-roster-card').filter({ hasText: 'Verdes' });
  await azuis.locator('.team-manual-assign summary').click();
  await azuis.getByRole('combobox', { name: 'Membro da comunidade' })
    .selectOption({ label: 'Participante (@participante)' });
  await azuis.getByRole('button', { name: 'Adicionar jogador' }).click();
  await expect(azuis).toContainText('@participante');
  await expect(verdes.locator('.team-manual-assign select option')
    .filter({ hasText: '@participante' })).toHaveCount(0);
  expect(fixture.teams[0].players.map(p => p.profileId)).toEqual([2]);

  await azuis.getByRole('button', { name: 'Remover participante da equipa Azuis' }).click();
  await expect(azuis.locator('.player-item').filter({ hasText: '@participante' })).toHaveCount(0);
  await azuis.getByRole('button', { name: 'Eliminar equipa Azuis' }).click();
  await expect(page.locator('.team-roster-card')).toHaveCount(1);
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('membro da comunidade pode ver plantéis mas não editar equipas', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'MEMBER', 'teams-view');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Equipas e plantéis' })).toBeVisible();
  await expect(page.locator('.team-roster-card')).toContainText(['Azuis']);
  await expect(page.locator('.team-roster-card')).toContainText(['@participante']);
  await expect(page.getByRole('button', { name: 'Adicionar equipa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar jogador' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Classificação do torneio' })).toHaveCount(0);
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('organizador publica jornadas apenas com duas equipas completas e vê confrontos reais', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.getByRole('heading', { name: 'Equipas e plantéis' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gerar jornadas entre equipas' })).toBeEnabled();
  await page.getByRole('button', { name: 'Gerar jornadas entre equipas' }).click();
  await expect(page.getByRole('button', { name: 'Sim, publicar jornadas por equipas' })).toBeVisible();
  expect(fixture.teamFixtures).toHaveLength(0);
  await page.getByRole('button', { name: 'Sim, publicar jornadas por equipas' }).click();
  await expect(page.getByRole('heading', { name: 'Jornadas e confrontos entre equipas' })).toBeVisible();
  await expect(page.getByText('Jornada 1', { exact: true })).toBeVisible();
  await expect(page.locator('.team-fixture')).toHaveCount(1);
  await expect(page.locator('.team-fixture')).toContainText('Azuis');
  await expect(page.locator('.team-fixture')).toContainText('Verdes');
  await expect(page.locator('.team-fixture')).toContainText('Por disputar');
  await expect(page.getByRole('button', { name: 'Gerar jornadas entre equipas' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar equipa' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Classificação do torneio' })).toHaveCount(0);
  expect(fixture.teamFixtures).toHaveLength(1);
  expect(fixture.matches).toHaveLength(0); // no fake participant fixture
  expect(fixture.unmocked.filter(p => p.includes('/tournaments/'))).toEqual([]);
});

test('duas voltas criam jornadas com casa e fora e obrigam ambos os resultados', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule', 'Futebol', undefined, 2);
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.getByText('Duas voltas (casa e fora)')).toBeVisible();
  await page.getByRole('button', { name: 'Gerar jornadas entre equipas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar jornadas por equipas' }).click();
  const matches = page.locator('.team-fixture');
  await expect(matches).toHaveCount(2);
  await expect(page.getByText('Jornada 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toBeDisabled();
  await matches.first().getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('2');
  await matches.first().getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('0');
  await matches.first().getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' }).click();
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toBeDisabled();
  await matches.nth(1).getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('1');
  await matches.nth(1).getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('1');
  await matches.nth(1).getByRole('button', { name: 'Guardar resultado entre Verdes e Azuis' }).click();
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toBeEnabled();
  await page.getByRole('button', { name: 'Encerrar campeonato por equipas' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar campeonato' }).click();
  await expect(page.getByText('Equipa campeã: Azuis')).toBeVisible();
  expect(fixture.teamFixtures.map(m => [m.homeTeamId, m.awayTeamId])).toEqual([[40, 41], [41, 40]]);
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('organizador escolhe taça no início sem regras de liga', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  const knockout = page.locator('.create-format-option').nth(1);
  await knockout.click();
  await expect(knockout).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'Número de voltas' })).toHaveCount(0);
  await page.getByLabel('Nome do torneio').fill('Taça da comunidade');
  await page.getByRole('button', { name: 'Criar e preparar equipas' }).click();
  await expect(page.locator('.tournament-heading')).toContainText('Eliminatórias');
  expect(fixture.tournaments[0].format).toBe('KNOCKOUT');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('sorteio e final de taça não usam tabela da liga nem permitem empate', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule',
    'Futebol', undefined, 1, 'KNOCKOUT');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Sortear eliminatórias' }).click();
  await page.getByRole('button', { name: 'Sim, sortear eliminatórias' }).click();
  await expect(page.getByRole('heading', { name: 'Quadro de eliminatórias' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Classificação por equipas' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toHaveCount(0);
  const game = page.locator('.team-fixture');
  await game.getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('1');
  await game.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('1');
  await expect(game.getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' })).toBeDisabled();
  await game.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('0');
  await game.getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' }).click();
  await expect(page.getByText('Equipa campeã: Azuis')).toBeVisible();
  await expect(page.getByText('Taça concluída', { exact: false })).toBeVisible();
  await expect(game.getByRole('spinbutton')).toHaveCount(0);
  expect(fixture.tournaments[0].status).toBe('COMPLETED');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('o organizador escolhe duas voltas na criação do torneio', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  const choice = page.getByRole('group', { name: 'Número de voltas' });
  await expect(choice.getByRole('button', { name: 'Uma volta' })).toHaveAttribute('aria-pressed', 'true');
  await choice.getByRole('button', { name: 'Duas voltas (casa e fora)' }).click();
  await expect(choice.getByRole('button', { name: 'Duas voltas (casa e fora)' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Nome do torneio').fill('Liga de Outono');
  await page.getByRole('button', { name: 'Criar e preparar equipas' }).click();
  expect(fixture.tournaments[0].roundRobinLegs).toBe(2);
  await expect(page.locator('.tournament-heading')).toContainText('Duas voltas (casa e fora)');
});

test('torneio com plantéis incompletos não permite gerar jornadas entre equipas', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-view');
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.getByRole('button', { name: 'Gerar jornadas entre equipas' })).toBeDisabled();
  await expect(page.getByText('Cria pelo menos 2 equipas.')).toBeVisible();
  expect(fixture.teamFixtures).toHaveLength(0);
});

test('resultados e classificação por equipas mudam após corrigir um confronto', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Gerar jornadas entre equipas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar jornadas por equipas' }).click();
  const game = page.locator('.team-fixture');
  await expect(game).toHaveCount(1);
  await game.getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('2');
  await game.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('1');
  await game.getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' }).click();
  await expect(game).toContainText('2 : 1');
  const table = page.getByRole('table', { name: 'Classificação por equipas' });
  await expect(table.locator('tbody tr').first()).toContainText('Azuis');
  await expect(table.locator('tbody tr').first()).toContainText('3');
  await game.getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('0');
  await game.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('3');
  await game.getByRole('button', { name: 'Corrigir resultado entre Azuis e Verdes' }).click();
  await expect(game).toContainText('0 : 3');
  await expect(table.locator('tbody tr').first()).toContainText('Verdes');
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toBeEnabled();
  await page.getByRole('button', { name: 'Encerrar campeonato por equipas' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar campeonato' }).click();
  await expect(page.getByText('Equipa campeã: Verdes')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Golos de Azuis' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toHaveCount(0);
  expect(fixture.teamFixtures[0].status).toBe('COMPLETED');
  expect(fixture.matches).toHaveLength(0);
  expect(fixture.unmocked.filter(path => path.includes('/tournaments/'))).toEqual([]);
});

test('empate real fecha o campeonato sem inventar equipa vencedora', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Gerar jornadas entre equipas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar jornadas por equipas' }).click();
  const game = page.locator('.team-fixture');
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toBeDisabled();
  await game.getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('0');
  await game.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('0');
  await game.getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' }).click();
  await expect(page.getByRole('button', { name: 'Encerrar campeonato por equipas' })).toBeEnabled();
  await page.getByRole('button', { name: 'Encerrar campeonato por equipas' }).click();
  await page.getByRole('button', { name: 'Sim, encerrar campeonato' }).click();
  await expect(page.getByText('Empate no primeiro lugar entre equipas')).toBeVisible();
  await expect(page.getByText('Equipa campeã:', { exact: false })).toHaveCount(0);
});


test('criação por equipas apresenta formatos comparáveis e mantém regras opcionais', async ({ page }, testInfo) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();

  const options = page.locator('.create-format-option');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(options.nth(1)).toContainText('Quem perde sai');
  await expect(options.nth(2)).toContainText('Fase de grupos');

  const advanced = page.locator('.create-advanced-rules');
  await expect(advanced).not.toHaveAttribute('open', '');
  await expect(advanced.locator('summary')).toContainText('3 vitória');
  await testInfo.attach('team-tournament-desktop', {
    body: await page.locator('.create-tournament').screenshot(),
    contentType: 'image/png'
  });

  await options.nth(1).click();
  await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(advanced).toHaveCount(0);

  await options.nth(2).click();
  await expect(options.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(advanced).toHaveCount(1);
  await expect(advanced).not.toHaveAttribute('open', '');
  await page.getByLabel('Nome do torneio').fill('Liga de verão');
  await page.getByRole('button', { name: 'Criar e preparar equipas' }).click();
  expect(fixture.tournaments[0].entryType).toBe('TEAM');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('a criação em ecrã estreito não provoca overflow horizontal', async ({ page }, testInfo) => {
  await mockCommunityApi(page, 'OWNER', 'teams');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();

  const grid = page.locator('.create-format-grid');
  await expect(grid.locator('.create-format-option')).toHaveCount(3);
  const geometry = await page.locator('.create-tournament').evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, viewport: window.innerWidth };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
  await testInfo.attach('team-tournament-narrow-viewport', {
    body: await page.locator('.create-tournament').screenshot(),
    contentType: 'image/png'
  });
});

test('os avisos diferenciam futebol, karting e judo sem inventar resultados', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'empty', 'Futebol', ['Futebol', 'Karting', 'Judo']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();

  await expect(page.locator('.create-sport-notice')).toHaveCount(0);
  await page.locator('#new-tournament-sport-search').fill('kart');
  await page.getByLabel('Sugestões de modalidades').getByRole('button', { name: 'Karting', exact: true }).click();
  await expect(page.locator('.create-sport-notice')).toContainText('tempos, posições ou voltas');
  await page.getByRole('button', { name: 'Alterar' }).click();
  await page.locator('#new-tournament-sport-search').fill('judo');
  await page.getByLabel('Sugestões de modalidades').getByRole('button', { name: 'Judo', exact: true }).click();
  await expect(page.locator('.create-sport-notice')).toContainText('Sets, golpes e decisões');
});

test('organizador e participante mantêm permissões independentes em dois browsers', async ({ browser }) => {
  const organizer = await browser.newContext();
  const participant = await browser.newContext();
  try {
    const ownerPage = await organizer.newPage();
    const memberPage = await participant.newPage();
    const ownerApi = await mockCommunityApi(ownerPage, 'OWNER', 'teams');
    const memberApi = await mockCommunityApi(memberPage, 'MEMBER', 'teams-view');

    await Promise.all([
      ownerPage.goto('/menu/communities/7?tab=tournaments'),
      memberPage.goto('/menu/communities/7?tab=tournaments')
    ]);
    await expect(ownerPage.getByRole('button', { name: 'Preparar torneio por equipas' })).toBeVisible();
    await expect(memberPage.getByRole('heading', { name: 'Equipas e plantéis' })).toBeVisible();
    await expect(memberPage.getByRole('button', { name: 'Adicionar equipa' })).toHaveCount(0);
    await expect(memberPage.getByRole('button', { name: 'Eliminar competição' })).toHaveCount(0);

    await ownerPage.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
    await expect(ownerPage.locator('.create-format-option')).toHaveCount(3);
    await expect(memberPage.locator('.create-tournament')).toHaveCount(0);

    expect(ownerApi.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
    expect(memberApi.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
  } finally {
    await Promise.all([organizer.close(), participant.close()]);
  }
});



test('xadrez apresenta 1/½/0 sem parâmetros genéricos e é limitado a ligas individuais', async ({ page }) => {
  await mockCommunityApi(page, 'OWNER', 'empty', 'Xadrez', ['Xadrez']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();

  await expect(page.locator('.classification-fixed-points')).not.toBeVisible();
  await page.locator('.create-advanced-rules summary').click();
  await expect(page.locator('.classification-fixed-points')).toBeVisible();
  await expect(page.locator('.classification-fixed-points').getByText('Empate: ½', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Regras de pontuação' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Voltar às opções' }).click();
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  await expect(page.getByRole('button', { name: 'Formato ainda indisponível' })).toBeDisabled();
  await expect(page.getByText(/Xadrez por equipas precisa de partidas e resultados por tabuleiro/)).toBeVisible();
});


test('Ciclocrosse E2E: só as provas da modalidade alimentam a classificação por posições', async ({ page }) => {
  const state = createKartingFixture('Ciclocrosse');
  const mock = await mockCommunityApi(page, 'OWNER', 'karting', 'Ciclocrosse',
    ['Ciclocrosse'], 1, 'LEAGUE', state);
  await page.goto('/menu/communities/7?tab=tournaments');

  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Taça Ciclocrosse QA');
  await expect(page.locator('.classification-fixed-points')).toContainText('Ciclocrosse');
  await page.getByRole('button', { name: 'Criar campeonato por corridas' }).click();

  const race = page.getByRole('region', { name: 'Campeonato por corridas' });
  await expect(race).toBeVisible();
  await expect(race).toContainText('Ciclocrosse');
  expect(state.tournament?.sport).toBe('Ciclocrosse');
  await race.getByRole('button', { name: 'Associar' }).click();
  const standings = page.getByRole('table', { name: 'Classificação por corridas' });
  await expect(standings.locator('tbody tr')).toHaveCount(2);
  await expect(standings.locator('tbody tr').first()).toContainText('Ana');
  await expect(standings.locator('tbody tr').first()).toContainText('25');
  await expect(race.getByText('Piloto', { exact: true })).toHaveCount(0);
  expect(mock.unmocked.filter(path => path.includes('/tournaments'))).toEqual([]);
});

test('Karting E2E: criador configura pontos, associa corrida e participante consulta', async ({ browser }, testInfo) => {
  const state = createKartingFixture();
  const owner = await browser.newContext();
  const member = await browser.newContext();
  try {
    const a = await owner.newPage();
    const b = await member.newPage();
    const organizer = await mockCommunityApi(a, 'OWNER', 'karting', 'Karting',
      ['Karting'], 1, 'LEAGUE', state);
    const participant = await mockCommunityApi(b, 'MEMBER', 'karting', 'Karting',
      ['Karting'], 1, 'LEAGUE', state);
    await Promise.all([
      a.goto('/menu/communities/7?tab=tournaments'),
      b.goto('/menu/communities/7?tab=tournaments')
    ]);

    await a.getByRole('button', { name: 'Criar liga individual' }).click();
    await a.getByLabel('Nome do torneio').fill('Taça Karting QA');
    await a.getByRole('button', { name: 'Criar campeonato por corridas' }).click();
    const race = a.getByRole('region', { name: 'Campeonato por corridas' });
    await expect(race).toBeVisible();
    await race.locator('#karting-race-points').fill('30, 20, 10');
    await race.getByRole('button', { name: 'Guardar pontuação' }).click();
    await expect(race.locator('#karting-race-points')).toHaveValue('30,20,10');
    expect(state.points).toEqual([30,20,10]);

    await race.getByRole('button', { name: 'Associar' }).click();
    await expect(race.getByText('Grande Prémio QA')).toBeVisible();
    await expect(race.getByText(/DNF.*Carla/)).toBeVisible();
    const table = a.getByRole('table', { name: 'Classificação por corridas' });
    await expect(table.locator('tbody tr')).toHaveCount(2);
    // DNF stays in the race detail but has no championship standing without a finish.
    await expect(table.locator('tbody')).not.toContainText('Carla');
    await expect(table.locator('tbody tr').first()).toContainText('Ana');
    await expect(table.locator('tbody tr').first()).toContainText('30');
    await expect(race.locator('.race-points-editor')).toHaveCount(0);

    await b.reload();
    await expect(b.getByRole('heading', { name: 'Taça Karting QA' })).toBeVisible();
    const memberRace = b.getByRole('region', { name: 'Campeonato por corridas' });
    await expect(memberRace).toContainText('Grande Prémio QA');
    await expect(b.getByRole('table', { name: 'Classificação por corridas' })
      .locator('tbody tr').first()).toContainText('Ana');
    await expect(memberRace.getByRole('button', { name: 'Associar' })).toHaveCount(0);
    await expect(memberRace.getByRole('button', { name: 'Retirar' })).toHaveCount(0);
    await expect(memberRace.getByRole('button', { name: 'Guardar pontuação' })).toHaveCount(0);
    expect(state.writes.filter(x => x.role === 'MEMBER')).toEqual([]);
    expect(organizer.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
    expect(participant.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
    await testInfo.attach('karting-championship', {
      body: await race.screenshot(), contentType: 'image/png'
    });
  } finally {
    await Promise.all([owner.close(), member.close()]);
  }
});

test('Karting E2E: pontuação crescente falha e deixa de ser editável após associar corrida', async ({ page }) => {
  const state = createKartingFixture();
  const fixture = await mockCommunityApi(page, 'OWNER', 'karting', 'Karting',
    ['Karting'], 1, 'LEAGUE', state);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Karting QA');
  await page.getByRole('button', { name: 'Criar campeonato por corridas' }).click();
  const race = page.getByRole('region', { name: 'Campeonato por corridas' });
  await race.locator('#karting-race-points').fill('18,25,10');
  await race.getByRole('button', { name: 'Guardar pontuação' }).click();
  await expect(page.getByText(/pontos inteiros decrescentes/)).toBeVisible();
  expect(state.points).toEqual([25,18,15]);
  expect(state.writes.filter(x => x.path.endsWith('/races/points'))).toHaveLength(0);
  await race.locator('#karting-race-points').fill('25,18,15');
  await race.getByRole('button', { name: 'Guardar pontuação' }).click();
  expect(state.writes.filter(x => x.path.endsWith('/races/points'))).toHaveLength(1);
  await race.getByRole('button', { name: 'Associar' }).click();
  await expect(race.locator('.race-points-editor')).toHaveCount(0);
  await expect(race.getByText('25 · 18 · 15 pontos')).toBeVisible();
  expect(state.linked).toBe(true);
  expect(fixture.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
});


test('Karting E2E: encerra com campeão e mantém arquivo imutável em dois browsers', async ({ browser }, testInfo) => {
  const state = createKartingFixture();
  const owner = await browser.newContext();
  const member = await browser.newContext();
  try {
    const a = await owner.newPage();
    const b = await member.newPage();
    const ownerApi = await mockCommunityApi(a, 'OWNER', 'karting', 'Karting',
      ['Karting'], 1, 'LEAGUE', state);
    const memberApi = await mockCommunityApi(b, 'MEMBER', 'karting', 'Karting',
      ['Karting'], 1, 'LEAGUE', state);
    await Promise.all([
      a.goto('/menu/communities/7?tab=tournaments'),
      b.goto('/menu/communities/7?tab=tournaments')
    ]);
    await a.getByRole('button', { name: 'Criar liga individual' }).click();
    await a.getByLabel('Nome do torneio').fill('Campeonato arquivado QA');
    await a.getByRole('button', { name: 'Criar campeonato por corridas' }).click();
    const section = a.getByRole('region', { name: 'Campeonato por corridas' });
    const close = section.getByRole('button', { name: 'Encerrar campeonato por corridas' });
    await expect(close).toBeDisabled();
    await section.getByRole('button', { name: 'Associar' }).click();
    await expect(close).toBeEnabled();
    await close.click();
    await expect(section.getByRole('button', { name: 'Sim, encerrar e guardar classificação' }))
      .toBeVisible();
    await section.getByRole('button', { name: 'Cancelar' }).click();
    expect(state.tournament?.status).toBe('IN_PROGRESS');
    expect(state.writes.filter(x => x.path.endsWith('/races/complete'))).toHaveLength(0);

    await close.click();
    await section.getByRole('button', { name: 'Sim, encerrar e guardar classificação' }).click();
    const podium = a.getByRole('region', { name: 'Pódio final' });
    await expect(podium.locator('.karting-podium-place').first()).toContainText('Ana');
    await expect(section.getByText('Classificação final arquivada')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Retirar' })).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Associar' })).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Encerrar campeonato por corridas' }))
      .toHaveCount(0);
    expect(state.tournament?.status).toBe('COMPLETED');
    expect(state.tournament?.championProfileId).toBe(2);
    expect(state.writes.filter(x => x.path.endsWith('/races/complete'))).toHaveLength(1);

    // Community rounds may be edited later. The completed snapshot must never
    // be recalculated from the mutated mutable source.
    state.points = [99, 77];
    state.linked = false;
    state.tied = true;
    await Promise.all([a.reload(), b.reload()]);
    const archived = b.getByRole('region', { name: 'Campeonato por corridas' });
    const memberPodium = b.getByRole('region', { name: 'Pódio final' });
    await expect(memberPodium.locator('.karting-podium-place').first()).toContainText('Ana');
    await expect(archived.getByText('Classificação final arquivada')).toBeVisible();
    await expect(archived.getByText('Grande Prémio QA')).toBeVisible();
    await expect(archived.getByText('25 · 18 · 15 pontos')).toBeVisible();
    const standings = b.getByRole('table', { name: 'Classificação por corridas' });
    await expect(standings.locator('tbody tr')).toHaveCount(2);
    await expect(archived.getByText(/DNF.*Carla/)).toBeVisible();
    await expect(standings.locator('tbody')).not.toContainText('Carla');
    await expect(standings.locator('tbody tr').first()).toContainText('Ana');
    await expect(standings.locator('tbody tr').first()).toContainText('25');
    await expect(archived.getByRole('button', { name: 'Retirar' })).toHaveCount(0);
    await expect(archived.getByRole('button', { name: 'Guardar pontuação' })).toHaveCount(0);
    await expect(archived.getByRole('button', { name: 'Encerrar campeonato por corridas' }))
      .toHaveCount(0);
    expect(state.writes.filter(x => x.role === 'MEMBER')).toEqual([]);
    expect(ownerApi.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
    expect(memberApi.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
    await testInfo.attach('karting-archive-member-desktop', {
      body: await archived.screenshot(), contentType: 'image/png'
    });
  } finally {
    await Promise.all([owner.close(), member.close()]);
  }
});

test('Karting E2E: empate no primeiro lugar não inventa campeão', async ({ page }) => {
  const state = createKartingFixture();
  state.tied = true;
  const fixture = await mockCommunityApi(page, 'OWNER', 'karting', 'Karting',
    ['Karting'], 1, 'LEAGUE', state);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Karting empatado QA');
  await page.getByRole('button', { name: 'Criar campeonato por corridas' }).click();
  const race = page.getByRole('region', { name: 'Campeonato por corridas' });
  await race.getByRole('button', { name: 'Associar' }).click();
  const table = page.getByRole('table', { name: 'Classificação por corridas' });
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await race.getByRole('button', { name: 'Encerrar campeonato por corridas' }).click();
  await race.getByRole('button', { name: 'Sim, encerrar e guardar classificação' }).click();
  await expect(page.getByText('Empate no primeiro lugar', { exact: true })).toBeVisible();
  await expect(page.getByText('Campeão:', { exact: false })).toHaveCount(0);
  expect(state.tournament?.championTied).toBe(true);
  expect(state.tournament?.championProfileId).toBeNull();
  expect(state.tournament?.championPoints).toBeNull();
  await page.reload();
  await expect(page.getByText('Empate no primeiro lugar', { exact: true })).toBeVisible();
  await expect(race.getByText('Classificação final arquivada')).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  expect(fixture.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
});

test('Karting E2E: PT/EN acompanha idioma da Jynlo em pontuação e arquivo', async ({ page }) => {
  const state = createKartingFixture();
  const fixture = await mockCommunityApi(page, 'OWNER', 'karting', 'Karting',
    ['Karting'], 1, 'LEAGUE', state);

  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Karting languages QA');
  await page.getByRole('button', { name: 'Criar campeonato por corridas' }).click();

  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  const race = page.getByRole('region', { name: 'Racing championship' });
  await expect(race.getByText('Championship races')).toBeVisible();
  await expect(race.getByText('Points by position')).toBeVisible();
  await expect(race.getByLabel('Points from first place onward, separated by commas')).toBeVisible();

  await race.locator('#karting-race-points').fill('10,20,5');
  await race.getByRole('button', { name: 'Save points' }).click();
  await expect(page.getByText(/Enter up to 20 descending whole-number/)).toBeVisible();
  expect(state.writes.filter(x => x.path.endsWith('/races/points'))).toHaveLength(0);
  await race.locator('#karting-race-points').fill('25,18,15');
  await race.getByRole('button', { name: 'Save points' }).click();
  await race.getByRole('button', { name: 'Link' }).click();
  await expect(race.getByRole('table', { name: 'Race championship standings' })
    .locator('tbody tr')).toHaveCount(2);
  await expect(race.getByText(/DNF.*Carla/)).toBeVisible();

  await race.getByRole('button', { name: 'Finish racing championship' }).click();
  await race.getByRole('button', { name: 'Yes, finish and archive standings' }).click();
  const finalPodium = page.getByRole('region', { name: 'Final podium' });
  await expect(finalPodium.locator('.karting-podium-place').first()).toContainText('Ana');
  await expect(race.getByText('Final standings archived')).toBeVisible();
  await expect(race.getByText(/Community round results may be corrected/)).toBeVisible();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  const portuguese = page.getByRole('region', { name: 'Campeonato por corridas' });
  await expect(page.getByRole('region', { name: 'Pódio final' })
    .locator('.karting-podium-place').first()).toContainText('Ana');
  await expect(portuguese.getByText('Classificação final arquivada')).toBeVisible();
  expect(fixture.unmocked.filter(x => x.includes('/tournaments'))).toEqual([]);
});


test('Team E2E: PT/EN shows real league standings and translated champion', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  await page.getByRole('button', { name: 'Gerar jornadas entre equipas' }).click();
  await page.getByRole('button', { name: 'Sim, publicar jornadas por equipas' }).click();
  const standings = page.getByRole('table', { name: 'Team standings' });
  await expect(standings).toBeVisible();
  await expect(standings.getByRole('columnheader', { name: 'GF' })).toBeVisible();
  await expect(standings.getByRole('columnheader', { name: 'GA' })).toBeVisible();
  const game = page.locator('.team-fixture');
  await game.getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('2');
  await game.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('1');
  await game.getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' }).click();

  await page.getByRole('button', { name: 'Finish team championship' }).click();
  await page.getByRole('button', { name: 'Yes, finish championship' }).click();
  await expect(page.getByText('Champion team: Azuis')).toBeVisible();
  await expect(page.getByText('3 points · Championship completed')).toBeVisible();
  await expect(standings.locator('tbody tr')).toHaveCount(2);

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByText('Equipa campeã: Azuis')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Classificação por equipas' })).toBeVisible();
  expect(fixture.unmocked.filter(x => x.includes('/tournaments/'))).toEqual([]);
});

test('Team E2E: English cup winner is translated without league standings', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule',
    'Futebol', undefined, 1, 'KNOCKOUT');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Sortear eliminatórias' }).click();
  await page.getByRole('button', { name: 'Sim, sortear eliminatórias' }).click();
  await expect(page.getByRole('table', { name: 'Team standings' })).toHaveCount(0);
  const match = page.locator('.team-fixture');
  await match.getByRole('spinbutton', { name: 'Golos de Azuis' }).fill('2');
  await match.getByRole('spinbutton', { name: 'Golos de Verdes' }).fill('1');
  await match.getByRole('button', { name: 'Guardar resultado entre Azuis e Verdes' }).click();
  await expect(page.getByText('Champion team: Azuis')).toBeVisible();
  await expect(page.getByText('Cup completed · Knockout champion')).toBeVisible();
  expect(fixture.unmocked.filter(x => x.includes('/tournaments/'))).toEqual([]);
});

test('Competition guide E2E: PT/EN localizes introduction and available actions', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Community competitions' })).toBeVisible();
  const englishGuide = page.getByRole('region', { name: 'How competitions work' });
  await expect(englishGuide.getByRole('heading', { name: 'How would you like to compete?' })).toBeVisible();
  await expect(englishGuide.getByRole('button', { name: 'Create individual league' })).toBeVisible();
  await expect(englishGuide.getByRole('button', { name: 'Set up a team tournament' })).toBeVisible();
  await expect(englishGuide.getByText('Leagues and cups available')).toBeVisible();

  await englishGuide.getByRole('button', { name: 'Close guide' }).click();
  await expect(englishGuide).toHaveCount(0);
  await page.getByRole('button', { name: 'How does it work?' }).click();
  await expect(page.getByRole('region', { name: 'How competitions work' })).toBeVisible();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Competições da comunidade' })).toBeVisible();
  const portugueseGuide = page.getByRole('region', { name: 'Como funcionam as competições' });
  await expect(portugueseGuide.getByRole('heading', { name: 'Como querem competir?' })).toBeVisible();
  await expect(portugueseGuide.getByRole('button', { name: 'Criar liga individual' })).toBeVisible();
  await expect(portugueseGuide.getByRole('button', { name: 'Preparar torneio por equipas' })).toBeVisible();
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
});

test('Competition creation E2E: format and scoring form switch between EN and PT', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  await page.getByRole('region', { name: 'How competitions work' })
    .getByRole('button', { name: 'Set up a team tournament' }).click();
  const wizard = page.getByRole('region', { name: 'Configure competition' });
  await expect(wizard.getByRole('heading', { name: 'Set up a team tournament' })).toBeVisible();
  await expect(wizard.getByRole('region', { name: 'Competition details' })).toBeVisible();
  await expect(wizard.getByLabel('Tournament name')).toHaveAttribute('placeholder', 'E.g. Autumn League');
  await wizard.getByLabel('Tournament name').fill('A');
  await expect(wizard.getByText('The name must contain at least 2 characters.')).toBeVisible();
  await expect(wizard.getByRole('region', { name: 'Format and participants' })).toBeVisible();
  await expect(wizard.getByRole('button', { name: 'Two legs (home and away)' })).toBeVisible();
  await wizard.getByRole('button', { name: 'Two legs (home and away)' }).click();
  await expect(wizard.getByText(/One leg: each pair of teams meets once/)).toBeVisible();
  await wizard.locator('.create-format-option').nth(2).click();
  await expect(wizard.getByRole('button', { name: '2 groups · minimum 4 teams' })).toBeVisible();
  await expect(wizard.getByRole('button', { name: '4 groups · minimum 8 teams' })).toBeVisible();
  await expect(wizard.getByRole('region', { name: 'Standings rules' })).toBeVisible();
  await wizard.getByRole('button', { name: 'Back to options' }).click();

  await page.getByRole('region', { name: 'How competitions work' })
    .getByRole('button', { name: 'Create individual league' }).click();
  const individual = page.getByRole('region', { name: 'Configure competition' });
  await expect(individual.getByRole('heading', { name: 'Create individual league' })).toBeVisible();
  await expect(individual.getByRole('region', { name: 'Standings rules' })).toBeVisible();
  await expect(individual.getByRole('button', { name: 'Confirm individual league' })).toBeDisabled();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await page.getByRole('region', { name: 'Como funcionam as competições' })
    .getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  const portuguese = page.getByRole('region', { name: 'Configurar competição' });
  await expect(portuguese.getByRole('heading', { name: 'Preparar torneio por equipas' })).toBeVisible();
  await expect(portuguese.getByLabel('Nome do torneio')).toHaveAttribute('placeholder', 'Ex.: Liga de Outono');
  await expect(portuguese.getByRole('button', { name: 'Duas voltas (casa e fora)' })).toBeVisible();
  await expect(portuguese.getByRole('button', { name: 'Voltar às opções' })).toBeVisible();

  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
  expect(fixture.organizerMutations).toEqual([]);
});

test('Competition teams E2E: rosters and invitation controls switch PT/EN', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-view');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  const teams = page.getByRole('region', { name: 'Competition teams' });
  await expect(teams.getByRole('heading', { name: 'Teams and rosters' })).toBeVisible();
  await expect(teams.getByText('1 teams created · 0 ready to compete')).toBeVisible();
  await expect(teams.getByLabel('New team name')).toHaveAttribute('placeholder', 'E.g. Green Team');
  await expect(teams.getByRole('button', { name: 'Add team' })).toBeDisabled();
  const azuis = teams.locator('.team-roster-card').filter({ hasText: 'Azuis' });
  await expect(azuis.getByRole('link', { name: 'Invite to team Azuis via WhatsApp' })).toBeVisible();
  await expect(azuis.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect(azuis.getByLabel('Team link')).toHaveAttribute('readonly');
  await expect(azuis.getByRole('button', { name: 'Remove participante from team Azuis' })).toBeVisible();
  await expect(azuis.locator('.team-manual-assign summary')).toHaveText('Add a member manually (organiser)');

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  const portuguese = page.getByRole('region', { name: 'Equipas da competição' });
  await expect(portuguese.getByRole('heading', { name: 'Equipas e plantéis' })).toBeVisible();
  await expect(portuguese.getByRole('button', { name: 'Copiar link' })).toBeVisible();
  await expect(portuguese.getByRole('button', { name: 'Remover participante da equipa Azuis' })).toBeVisible();
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
  expect(fixture.organizerMutations).toEqual([]);
});

test('Competition teams E2E: tiebreak explanations follow EN and PT without changing values', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Set up a team tournament' }).click();
  await page.locator('.create-advanced-rules summary').click();
  const english = page.getByRole('group', { name: 'Tiebreak criterion' });
  await expect(english.getByRole('button', { name: /Score difference/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(english.getByText('Rank first by the difference between scores for and against.')).toBeVisible();
  await english.getByRole('button', { name: /Most wins/ }).click();
  await expect(english.getByRole('button', { name: /Most wins/ })).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await page.getByRole('button', { name: 'Preparar torneio por equipas' }).click();
  await page.locator('.create-advanced-rules summary').click();
  const portuguese = page.getByRole('group', { name: 'Critério de desempate' });
  await expect(portuguese.getByRole('button', { name: /Diferença do marcador/ })).toBeVisible();
  await expect(portuguese.getByText('Primeiro a diferença entre o que cada equipa marcou e sofreu.')).toBeVisible();
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
});
