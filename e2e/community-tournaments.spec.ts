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
  historicalArchiveId?: number | null;
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
    id: 30, name: 'Grande Prémio QA', sport: state.sport,
    eventType: state.sport === 'Ciclismo de Estrada' ? 'ROAD_RACE'
      : state.sport === 'Ciclismo de Pista' ? 'TRACK_SCRATCH' : null,
    playedAt: '2026-10-23T18:00:00Z',
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
  | 'teams-schedule' | 'history' | 'historical-knockout' | 'historical-import-flow' | 'historical-import-review' | 'karting' | 'inline-speed-qa' | 'visual-large-league';

async function mockCommunityApi(page: Page, role: Role, mode: FixtureMode,
  sport: string | null = 'Futebol', sports?: string[], roundRobinLegs: 1 | 2 = 1,
  format: 'LEAGUE' | 'KNOCKOUT' = 'LEAGUE', karting?: KartingFixture) {
  const username = role === 'OWNER' ? 'organizador' : 'participante';
  const token = fixtureToken(username);
  await page.addInitScript(value => localStorage.setItem('t', value), token);

  const community = {
    id: 7, name: 'Jogadores de Lisboa', description: 'Liga dos amigos',
    sport, sports: sports ?? (sport ? [sport] : []), photoUrl: null, visibility: 'PRIVATE',
    rankingsEnabled: mode !== 'modules-off' && mode !== 'teams-only'
      && mode !== 'inline-speed-qa',
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

  const tournaments: Tournament[] = mode === 'empty' || mode === 'teams' || mode === 'karting' || mode === 'historical-import-flow' || mode === 'historical-import-review' ? []
    : [tournament(mode === 'teams-view' || mode === 'teams-schedule' ? 11 : 9, 'Liga de Outono')];
  // The sport is a snapshot on the tournament, not inferred by the component.
  tournaments.forEach(item => item.sport = sport);
  if (mode === 'historical-knockout') Object.assign(tournaments[0], {
    name: 'Taça antiga QA', sport: 'Futebol', format: 'KNOCKOUT',
    historicalArchiveId: 91, entryType: 'TEAM', status: 'COMPLETED'
  });
  if (mode === 'visual-large-league') tournaments[0].status = 'IN_PROGRESS';
  if (mode === 'paged' && sport === 'Xadrez') {
    tournaments[0].scoringMode = 'CHESS_HALF_POINTS';
  }
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
  if (mode === 'schedule-roster-paged' || mode === 'schedule-roster-oversize'
    || mode === 'visual-large-league') {
    const max = mode === 'schedule-roster-oversize' ? 33
      : mode === 'visual-large-league' ? 32 : 21;
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
  if (mode === 'visual-large-league') {
    // Three synthetic rounds, 16 fixtures each; all 32 registered competitors
    // appear in standings, and fixture pagination crosses 20 + 20 + 8.
    for (let round = 1; round <= 3; round++) {
      for (let slot = 0; slot < 16; slot++) {
        const homeProfileId = slot + 1;
        const awayProfileId = 17 + ((slot + round - 1) % 16);
        matches.push({
          id: 1000 + (round - 1) * 16 + slot, roundNumber: round,
          homeProfileId, homeUsername: homeProfileId === 1 ? 'organizador'
            : homeProfileId === 2 ? 'participante' : 'player' + homeProfileId,
          awayProfileId, awayUsername: 'player' + awayProfileId,
          status: 'SCHEDULED', homeScore: null, awayScore: null
        });
      }
    }
  }
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
  let matchPreviewCalls = 0;
  let matchConfirmCalls = 0;
  let actualCsvUploaded = false;
  let confirmedContext: Record<string, unknown> | null = null;
  const historicalImportRows = [
    { sourceRow: 2, home: 'Águias', away: 'Lobos', homeScore: 3, awayScore: 0,
      sourceDate: '2023-06-01', sourceRound: 'Quartos de final', potentialDuplicate: false },
    { sourceRow: 3, home: 'CNG', away: 'Tigres', homeScore: 2, awayScore: 0,
      sourceDate: '2023-06-02', sourceRound: 'Quartos de final', potentialDuplicate: false },
    { sourceRow: 4, home: 'Leões', away: 'Dragões', homeScore: 1, awayScore: 0,
      sourceDate: '2023-06-03', sourceRound: 'Quartos de final', potentialDuplicate: false },
    { sourceRow: 5, home: 'Raios', away: 'Falcões', homeScore: 2, awayScore: 0,
      sourceDate: '2023-06-04', sourceRound: 'Quartos de final', potentialDuplicate: false },
    { sourceRow: 6, home: 'Águias', away: 'CNG', homeScore: 1, awayScore: 0,
      sourceDate: '2023-06-05', sourceRound: 'Meias-finais', potentialDuplicate: false },
    { sourceRow: 7, home: 'Leões', away: 'Raios', homeScore: 2, awayScore: 0,
      sourceDate: '2023-06-06', sourceRound: 'Meias-finais', potentialDuplicate: false },
    { sourceRow: 8, home: 'Águias', away: 'Leões', homeScore: 1, awayScore: 0,
      sourceDate: '2023-06-07', sourceRound: 'Final', potentialDuplicate: false }
  ];
  if (mode === 'historical-import-review') {
    historicalImportRows[1].potentialDuplicate = true;
    historicalImportRows[6].awayScore = 1;
  }
  let savedMatchArchive: {
    id: number; title: string; entryType: 'TEAM' | 'INDIVIDUAL';
    sourceFilename: string; createdAt: string; tournamentId: number;
    rows: typeof historicalImportRows;
  } | null = null;
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
  // In-memory fictional skaters only: never create accounts or hit production API.
  const speedNames = ['Ana Exemplo', 'Bruno Exemplo', 'Carla Exemplo', 'Diogo Exemplo',
    'Eva Exemplo', 'Filipe Exemplo', 'Gabriela Exemplo', 'Hugo Exemplo',
    'Inês Exemplo', 'João Exemplo', 'Lara Exemplo', 'Marco Exemplo'];
  const speedSkaters = speedNames.map((name, i) => ({
    playerId: i + 1, name, position: null, seconds: 30 + (i + 1) / 100,
    disqualified: false
  }));
  const speedHeat = {
    roundId: 100, name: '500 m +D — Primeira fase QA',
    eventType: 'INLINE_TRACK_500D_FIRST_ROUND', heatNumber: 1, skaters: speedSkaters
  };
  let speedLinked = false;
  let speedConfirmed = false;
  const speedWrites: string[] = [];
  const speedDecisionReason: string[] = [];
  function speedOverview() {
    return {
      tournamentId: 9, discipline: speedLinked ? 'TRACK_500D' : null,
      linkedHeats: speedLinked ? [speedHeat] : [],
      availableHeats: speedLinked ? [] : [speedHeat],
      proposals: speedLinked ? [{
        sourceStage: 'FIRST', targetStage: 'SEMI', playerIds: [1, 2, 3, 4, 5, 6, 7, 8],
        expectedCount: 8, ready: true, warning: 'Confirmação dos juízes obrigatória'
      }] : [],
      decisions: speedConfirmed ? [{
        sourceStage: 'FIRST', targetStage: 'SEMI', playerIds: [1, 2, 3, 4, 5, 6, 7, 8],
        reason: speedDecisionReason[0], confirmedBy: 'organizador',
        confirmedAt: '2026-10-25T10:00:00Z', stale: false
      }] : []
    };
  }
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
      return send(mode === 'inline-speed-qa' ? {
        settings: { rankingsEnabled: false, winPoints: 3, drawPoints: 1, lossPoints: 0 },
        seasons: [{ id: 42, name: 'Época de teste 2026', active: true,
          startsAt: '2026-10-25T09:00:00Z', endedAt: null }],
        selectedSeasonId: 42, activeSeasonId: 42,
        rounds: [], standings: [], racketStandings: [], raceStandings: []
      } : {
        settings: { rankingsEnabled: true, winPoints: 3, drawPoints: 1, lossPoints: 0 },
        seasons: [], selectedSeasonId: null, activeSeasonId: null,
        rounds: [], standings: []
      });
    }

    // Full browser upload path, but every endpoint is mocked on localhost.
    // We inspect the actual multipart payload so a bypassed file step fails QA.
    if (mode === 'historical-import-flow' || mode === 'historical-import-review') {
      const csvFileInRequest = () =>
        (req.postData() || '').includes('historico-partidas-qa.csv')
        && (req.postData() || '').includes('Águias;Lobos;3-0;2023-06-01;Quartos de final');
      if (path === '/api/communities/7/competition/import/preview' && method === 'POST') {
        actualCsvUploaded = csvFileInRequest();
        if (!actualCsvUploaded) return send({ message: 'CSV QA não recebido' }, 422);
        return send({
          fileName: 'historico-partidas-qa.csv',
          sheets: [{
            name: 'Dados', nonEmptyRows: 7, structure: 'TABULAR',
            headers: ['Casa', 'Fora', 'Resultado', 'Data',
              mode === 'historical-import-flow' ? 'Fase' : 'Jornada'],
            sampleRows: [['Águias', 'Lobos', '3-0', '2023-06-01', 'Quartos de final']],
            columnSuggestions: []
          }]
        });
      }
      if (path === '/api/communities/7/competition/import/matches/preview' && method === 'POST') {
        if (!csvFileInRequest()) return send({ message: 'Sem ficheiro CSV' }, 422);
        const body = req.postData() || '';
        for (const required of ['HOME', 'AWAY', 'SCORE', 'DATE', 'ROUND']) {
          if (!body.includes(required)) return send({ message: 'Mapeamento incompleto ' + required }, 422);
        }
        matchPreviewCalls++;
        return send({
          sheetName: 'Dados', sourceRows: historicalImportRows.length,
          acceptedRows: historicalImportRows.length, potentialDuplicates: 0,
          warnings: [], rows: historicalImportRows
        });
      }
      if (path === '/api/communities/7/competition/import/matches/confirm' && method === 'POST') {
        if (matchPreviewCalls !== 1 || !csvFileInRequest()) {
          return send({ message: 'Ficheiro não foi pré-visualizado' }, 422);
        }
        const body = req.postData() || '';
        const fragment = body.match(/\{\s*"title"\s*:\s*"[^"]+"[^}]*\}/);
        if (!fragment) return send({ message: 'Contexto não encontrado' }, 422);
        confirmedContext = JSON.parse(fragment[0]) as Record<string, unknown>;
        if (confirmedContext.createTournament !== true
          || confirmedContext.sport !== 'Futebol'
          || confirmedContext.format !== 'KNOCKOUT'
          || confirmedContext.entryType !== 'TEAM') {
          return send({ message: 'Contexto do torneio incorreto' }, 422);
        }
        matchConfirmCalls++;
        const newlySaved = {
          id: 92, title: String(confirmedContext.title),
          entryType: 'TEAM' as const,
          sourceFilename: 'historico-partidas-qa.csv',
          createdAt: '2026-10-25T00:00:00Z', tournamentId: 92,
          rows: historicalImportRows
        };
        savedMatchArchive = newlySaved;
        tournaments.unshift({
          ...tournament(92, newlySaved.title),
          historicalArchiveId: 92, format: 'KNOCKOUT',
          status: 'COMPLETED', sport: 'Futebol', entryType: 'TEAM'
        });
        return send(newlySaved);
      }
      if (path === '/api/communities/7/competition/match-archives' && method === 'GET') {
        return send(savedMatchArchive ? [{
          id: 92, title: savedMatchArchive.title, entryType: 'TEAM',
          sourceFilename: savedMatchArchive.sourceFilename,
          createdAt: savedMatchArchive.createdAt
        }] : []);
      }
      if (path === '/api/communities/7/competition/match-archives/92' && method === 'GET') {
        return savedMatchArchive
          ? send(savedMatchArchive) : send({ message: 'Ainda não criado' }, 404);
      }
    }
    if (mode === 'historical-knockout'
        && path === '/api/communities/7/competition/match-archives'
        && method === 'GET') {
      // The community page also loads the archive index independently from
      // the selected historic tournament. Keep every request in-memory.
      return send([{
        id: 91, title: 'Taça antiga QA', entryType: 'TEAM',
        sourceFilename: 'torneio-sintetico.xlsx', createdAt: '2026-10-25T00:00:00Z'
      }]);
    }
    if (mode === 'historical-knockout'
        && path === '/api/communities/7/competition/match-archives/91'
        && method === 'GET') {
      // 50 unlabelled rows on page one, then three labelled phases on page two.
      // The semifinal and final are on the same page as the quarterfinals:
      // a jump to the *page heading* alone is not a successful navigation.
      const rows = Array.from({ length: 50 }, (_, i) => ({
        sourceRow: 201 + i, home: 'Antiga ' + i, away: 'Visitante ' + i,
        homeScore: 1, awayScore: 0, sourceDate: '2023-05-01',
        sourceRound: 'Jornada antiga', potentialDuplicate: false
      }));
      rows.push(
        { sourceRow: 251, home: 'Águias', away: 'Lobos', homeScore: 3, awayScore: 0,
          sourceDate: '2023-06-01', sourceRound: 'Quartos de final', potentialDuplicate: false },
        { sourceRow: 252, home: 'CNG', away: 'Tigres', homeScore: 2, awayScore: 0,
          sourceDate: '2023-06-02', sourceRound: 'Quartos de final', potentialDuplicate: true },
        { sourceRow: 253, home: 'Leões', away: 'Dragões', homeScore: 1, awayScore: 0,
          sourceDate: '2023-06-03', sourceRound: 'Quartos de final', potentialDuplicate: false },
        { sourceRow: 254, home: 'Raios', away: 'Águias B', homeScore: 2, awayScore: 2,
          sourceDate: '2023-06-04', sourceRound: 'Quartos de final', potentialDuplicate: false },
        { sourceRow: 255, home: 'Águias', away: 'CNG', homeScore: 1, awayScore: 1,
          sourceDate: '2023-06-05', sourceRound: 'Meias-finais', potentialDuplicate: false },
        { sourceRow: 256, home: 'Leões', away: 'Raios', homeScore: 2, awayScore: 0,
          sourceDate: '2023-06-06', sourceRound: 'Meias-finais', potentialDuplicate: false },
        { sourceRow: 257, home: 'Águias', away: 'Leões', homeScore: 1, awayScore: 0,
          sourceDate: '2023-06-07', sourceRound: 'Grande Final', potentialDuplicate: false }
      );
      return send({
        id: 91, title: 'Taça antiga QA', entryType: 'TEAM',
        sourceFilename: 'torneio-sintetico.xlsx', createdAt: '2026-10-25T00:00:00Z',
        tournamentId: 9, rows
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
        warningDetails: [{ code: 'IMPORT_DUPLICATE_STANDING', params: { row: '4', name: 'ÁGUIAS' } }],
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

    // Speed-skating browser fixture: same HTTP shapes as production, local-only state.
    if (mode === 'inline-speed-qa') {
      const base = '/api/communities/7/tournaments/9/inline-speed';
      if (method === 'GET' && path === base) return send(speedOverview());
      const link = /^\/api\/communities\/7\/tournaments\/9\/inline-speed\/heats\/(\d+)$/.exec(path);
      if (method === 'PUT' && link) {
        if (role !== 'OWNER') return send({ message: 'Não autorizado' }, 403);
        if (link[1] !== '100' || speedLinked) return send({ message: 'Manga duplicada' }, 409);
        speedLinked = true;
        speedWrites.push('link:' + link[1]);
        return send(speedOverview());
      }
      const confirmed = path === base + '/qualifications/FIRST';
      if (method === 'PUT' && confirmed) {
        const body = req.postDataJSON() as { playerIds: number[]; reason: string };
        if (role !== 'OWNER') return send({ message: 'Não autorizado' }, 403);
        if (!speedLinked || body.reason.trim().length < 8 ||
            JSON.stringify(body.playerIds) !== JSON.stringify([1,2,3,4,5,6,7,8]))
          return send({ message: 'Decisão inválida' }, 422);
        speedConfirmed = true;
        speedDecisionReason.push(body.reason);
        speedWrites.push('confirm:FIRST');
        return send(speedOverview());
      }
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
        if (mode === 'schedule-roster-paged' || mode === 'schedule-roster-oversize'
          || mode === 'visual-large-league') {
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
      if (mode === 'visual-large-league') {
        const offset = pageNumber * 20;
        return send({ matches: matches.slice(offset, offset + 20),
          page: pageNumber, hasMore: offset + 20 < matches.length });
      }
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
    speedWrites, speedDecisionReason,
    requestedParticipantPages, organizerMutations,
    get completeAttempts(): number { return completeAttempts; },
    get scheduleAttempts(): number { return scheduleAttempts; },
    get createCommunityRequest(): unknown { return createCommunityRequest; },
    get updatedCommunitySports(): string[] | null { return updatedCommunitySports; },
    get listAttempts(): number { return listAttempts; },
    get joinAttempts(): number { return joinAttempts; },
    get pendingDetails(): number { return pendingDetailResponses.length; },
    get matchPreviewCalls(): number { return matchPreviewCalls; },
    get matchConfirmCalls(): number { return matchConfirmCalls; },
    get actualCsvUploaded(): boolean { return actualCsvUploaded; },
    get confirmedContext(): Record<string, unknown> | null { return confirmedContext; },
    get savedMatchArchive() { return savedMatchArchive; },
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


test('Historical knockout browser QA: phase button jumps to the exact final across 50-row pages', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'historical-knockout');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Taça antiga QA' })).toBeVisible();
  const cards = page.locator('.historical-phase-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('4 / 4');
  await expect(cards.nth(1)).toContainText('2 / 2');
  await expect(cards.nth(2)).toContainText('1 / 1');
  await expect(page.locator('[data-historical-source-row="257"]')).toHaveCount(0);

  // All three phases are on page 2; selecting the final must target its row,
  // not only the archive section or the page containing earlier quarters.
  await cards.nth(2).getByRole('button', { name: 'Ver jogos no histórico' }).click();
  const final = page.locator('[data-historical-source-row="257"]');
  await expect(final).toHaveCount(1);
  await expect(final).toContainText('Águias');
  await expect(final).toContainText('Leões');
  await expect(final).toBeInViewport({ ratio: 0.5 });
  await expect(page.locator('.historical-tournament-pages')).toContainText('51–57 / 57');

  // Jump back to the first source-labelled quarterfinal, same archive page.
  await cards.nth(0).getByRole('button', { name: 'Ver jogos no histórico' }).click();
  const quarter = page.locator('[data-historical-source-row="251"]');
  await expect(quarter).toBeInViewport({ ratio: 0.5 });
  await expect(page.locator('[data-historical-source-row="257"]')).toHaveCount(1);

  // Read-only review flags are grounded in the source, never in guessed winners.
  const repeated = page.locator('[data-historical-source-row="252"]');
  const tiedSemi = page.locator('[data-historical-source-row="255"]');
  await expect(repeated.locator('.historical-match-review-flag'))
    .toHaveText(['Possível repetição']);
  await expect(tiedSemi.locator('.historical-match-review-flag'))
    .toHaveText(['Empate na eliminatória — confirmar quem avançou']);
  await expect(page.locator('[data-historical-source-row="253"] .historical-match-review-flag'))
    .toHaveCount(0);
  await expect(repeated).toHaveClass(/historical-match-row--review/);
  await expect(tiedSemi).toHaveClass(/historical-match-row--review/);

  // Review shortcuts must use exactly the source-flagged row order, not the
  // first fixture of the stage. Repeated clicks visit every flagged case.
  const reviewQuarter = cards.nth(0);
  const nextQuarter = reviewQuarter.getByRole('button', { name: /Ver próximo jogo por rever/ });
  await expect(reviewQuarter).toContainText('2 jogos sinalizados no Excel');
  await nextQuarter.click();
  await expect(repeated).toBeInViewport({ ratio: 0.5 });
  await expect(nextQuarter).toContainText('(1/2)');
  await nextQuarter.click();
  const tiedQuarter = page.locator('[data-historical-source-row="254"]');
  await expect(tiedQuarter).toBeInViewport({ ratio: 0.5 });
  await expect(tiedQuarter.locator('.historical-match-review-flag'))
    .toHaveText(['Empate na eliminatória — confirmar quem avançou']);
  await expect(nextQuarter).toContainText('(2/2)');
  await nextQuarter.click();
  await expect(repeated).toBeInViewport({ ratio: 0.5 });
  await expect(nextQuarter).toContainText('(1/2)');

  const reviewSemi = cards.nth(1);
  await expect(reviewSemi).toContainText('1 jogo sinalizado no Excel');
  await reviewSemi.getByRole('button', { name: /Ver próximo jogo por rever/ }).click();
  await expect(tiedSemi).toBeInViewport({ ratio: 0.5 });
  await expect(nextQuarter).toContainText('(1/2)'); // Independent per-phase cursors.
  await expect(cards.nth(2).getByRole('button', { name: /Ver próximo jogo por rever/ }))
    .toHaveCount(0);
  expect(fixture.unmocked.filter(s => s.includes('match-archives'))).toEqual([]);
});


test('Historical Excel review E2E: bilingual flags before saving never mutate source rows', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'historical-import-review');
  await page.goto('/menu/communities/7?tab=ranking');
  await page.getByRole('button', { name: /Partidas de torneios antigos/ }).click();
  const csv = [
    'Casa;Fora;Resultado;Data;Jornada',
    'Águias;Lobos;3-0;2023-06-01;Quartos de final',
    'CNG;Tigres;2-0;2023-06-02;Quartos de final',
    'Leões;Dragões;1-0;2023-06-03;Quartos de final',
    'Raios;Falcões;2-0;2023-06-04;Quartos de final',
    'Águias;CNG;1-0;2023-06-05;Meias-finais',
    'Leões;Raios;2-0;2023-06-06;Meias-finais',
    'Águias;Leões;1-1;2023-06-07;Final'
  ].join('\n') + '\n';
  await page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]')
    .setInputFiles({ name: 'historico-partidas-qa.csv', mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8') });
  await page.getByRole('button', { name: 'Analisar ficheiro' }).click();
  await page.getByRole('button', { name: 'Pré-visualizar partidas' }).click();
  const preview = page.getByRole('region', { name: 'Pré-visualização de partidas históricas' }).first();
  await expect(preview).toBeVisible();
  await expect(preview.getByText('Partidas sinalizadas para revisão no ficheiro: 1', { exact: false })).toBeVisible();
  await expect(page.locator('[data-import-source-row="3"] .historical-match-review-flag'))
    .toHaveText('Possível repetição');
  await expect(page.locator('[data-import-source-row="8"] .historical-match-review-flag')).toHaveCount(0);

  await page.locator('.historical-import-choice').nth(1).click();
  await page.locator('.historical-tournament-options input').fill('Futebol');
  await page.locator('.historical-tournament-options select').selectOption('KNOCKOUT');
  await expect(preview.getByText('Partidas sinalizadas para revisão no ficheiro: 2', { exact: false })).toBeVisible();
  await expect(page.locator('[data-import-source-row="8"] .historical-match-review-flag'))
    .toHaveText('Empate na eliminatória — confirmar quem avançou');
  await expect(page.locator('[data-import-source-row="8"]')).toContainText('1–1');
  expect(fixture.matchConfirmCalls).toBe(0);

  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  // Import draft is session-local. Repeat in EN to verify translated warnings,
  // never sending a confirmation request or inventing a knockout winner.
  await page.getByRole('button', { name: 'Past tournament matches' }).click();
  await page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]')
    .setInputFiles({ name: 'historico-partidas-qa.csv', mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8') });
  await page.getByRole('button', { name: 'Analyse file' }).click();
  await page.getByRole('button', { name: 'Preview matches' }).click();
  await expect(page.getByText('Source matches flagged for review: 1.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-import-source-row="3"] .historical-match-review-flag'))
    .toHaveText('Possible repeat');
  await page.locator('.historical-import-choice').nth(1).click();
  await page.locator('.historical-tournament-options input').fill('Futebol');
  await page.locator('.historical-tournament-options select').selectOption('KNOCKOUT');
  await expect(page.getByText('Source matches flagged for review: 2.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-import-source-row="8"] .historical-match-review-flag'))
    .toHaveText('Tied knockout match — confirm who advanced');
  expect(fixture.matchConfirmCalls).toBe(0);
  expect(fixture.savedMatchArchive).toBeNull();
  expect(fixture.unmocked.filter(url => url.includes('/competition/import/'))).toEqual([]);
});

test('Historical knockout browser QA: CSV upload, preview, consent and archive', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'historical-import-flow');
  await page.goto('/menu/communities/7?tab=ranking');

  await page.getByRole('button', { name: /Partidas de torneios antigos/ }).click();
  const csv = [
    'Casa;Fora;Resultado;Data;Fase',
    'Águias;Lobos;3-0;2023-06-01;Quartos de final',
    'CNG;Tigres;2-0;2023-06-02;Quartos de final',
    'Leões;Dragões;1-0;2023-06-03;Quartos de final',
    'Raios;Falcões;2-0;2023-06-04;Quartos de final',
    'Águias;CNG;1-0;2023-06-05;Meias-finais',
    'Leões;Raios;2-0;2023-06-06;Meias-finais',
    'Águias;Leões;1-0;2023-06-07;Final'
  ].join('\n') + '\n';
  await page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]')
    .setInputFiles({ name: 'historico-partidas-qa.csv', mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8') });
  await page.getByRole('button', { name: 'Analisar ficheiro' }).click();
  await expect(page.getByText('Folha ou conjunto de dados')).toBeVisible();
  expect(fixture.actualCsvUploaded).toBe(true);
  // "Fase" must be mapped as ROUND, never silently dropped as IGNORE or DATE.
  // The mock refuses preview unless the source phase was mapped to ROUND.
  await page.getByRole('button', { name: 'Pré-visualizar partidas' }).click();
  await expect(page.getByRole('region', { name: 'Pré-visualização de partidas históricas' })
    .first()).toBeVisible();
  expect(fixture.matchPreviewCalls).toBe(1);
  expect(fixture.matchConfirmCalls).toBe(0);
  await expect(page.getByRole('region', { name: 'Pré-visualização de partidas históricas' })
    .first()).toContainText('Quartos de final');

  // Upload inspection and preview must never write to an archive by themselves.
  await page.getByLabel('Nome do histórico').fill('Taça importada QA');
  await page.locator('.import-context select').first().selectOption('TEAM');
  await page.locator('.historical-import-choice').nth(1).click();
  await page.locator('.historical-tournament-options input').fill('Futebol');
  await page.locator('.historical-tournament-options select').selectOption('KNOCKOUT');
  const confirm = page.getByRole('button', { name: 'Criar torneio histórico', exact: true });
  await expect(confirm).toBeDisabled();
  expect(fixture.matchConfirmCalls).toBe(0);
  await page.locator('.check-stat input[type="checkbox"]').check();
  await confirm.click();

  await expect(page.getByRole('status').filter({ hasText: 'Taça importada QA' })).toBeVisible();
  expect(fixture.matchConfirmCalls).toBe(1);
  expect(fixture.confirmedContext).toEqual({
    title: 'Taça importada QA', entryType: 'TEAM',
    createTournament: true, sport: 'Futebol', format: 'KNOCKOUT'
  });
  expect(fixture.savedMatchArchive?.rows).toHaveLength(7);
  expect(fixture.savedMatchArchive?.rows.map(row => row.sourceRow))
    .toEqual([2, 3, 4, 5, 6, 7, 8]);

  await page.getByRole('button', { name: 'Ver em Competições' }).click();
  await expect(page.getByRole('heading', { name: 'Taça importada QA' })).toBeVisible();
  await expect(page.locator('.historical-phase-card')).toHaveCount(3);
  await expect(page.locator('[data-historical-source-row="8"]')).toContainText('Águias');
  await expect(page.locator('[data-historical-source-row="8"]')).toContainText('Leões');
  expect(fixture.unmocked.filter(item => item.includes('/competition/import/')
      || item.includes('/competition/match-archives'))).toEqual([]);
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


test('Track cycling E2E: only Scratch races join the community position championship', async ({ page }) => {
  const state = createKartingFixture('Ciclismo de Pista');
  const mock = await mockCommunityApi(page, 'OWNER', 'karting', 'Ciclismo de Pista',
    ['Ciclismo de Pista'], 1, 'LEAGUE', state);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Taça Scratch QA');
  await expect(page.locator('.classification-fixed-points')).toContainText('Ciclismo de Pista');
  await page.getByRole('button', { name: 'Criar campeonato por corridas' }).click();
  const race = page.getByRole('region', { name: 'Campeonato por corridas' });
  await expect(race).toContainText('Ciclismo de Pista');
  await expect(race).toContainText('Apenas Jornadas Scratch');
  await race.getByRole('button', { name: 'Associar' }).click();
  const table = page.getByRole('table', { name: 'Classificação por corridas' });
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody tr').first()).toContainText('Ana');
  await expect(table.locator('tbody tr').first()).toContainText('25');
  expect(state.tournament?.sport).toBe('Ciclismo de Pista');
  expect(mock.unmocked.filter(path => path.includes('/tournaments'))).toEqual([]);
});

test('Road cycling E2E: only road-race positions feed the community championship', async ({ page }) => {
  const state = createKartingFixture('Ciclismo de Estrada');
  const mock = await mockCommunityApi(page, 'OWNER', 'karting', 'Ciclismo de Estrada',
    ['Ciclismo de Estrada'], 1, 'LEAGUE', state);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.getByRole('button', { name: 'Criar liga individual' }).click();
  await page.getByLabel('Nome do torneio').fill('Taça Estrada QA');
  await expect(page.locator('.classification-fixed-points')).toContainText('Ciclismo de Estrada');
  await page.getByRole('button', { name: 'Criar campeonato por corridas' }).click();
  const race = page.getByRole('region', { name: 'Campeonato por corridas' });
  await expect(race).toContainText('Ciclismo de Estrada');
  await expect(race).toContainText('Só podes associar Jornadas de prova em linha');
  await race.getByRole('button', { name: 'Associar' }).click();
  const standings = page.getByRole('table', { name: 'Classificação por corridas' });
  await expect(standings.locator('tbody tr')).toHaveCount(2);
  await expect(standings.locator('tbody tr').first()).toContainText('25');
  expect(state.tournament?.sport).toBe('Ciclismo de Estrada');
  expect(mock.unmocked.filter(path => path.includes('/tournaments'))).toEqual([]);
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

  await page.getByRole('button', { name: 'Generate team fixtures' }).click();
  await page.getByRole('button', { name: 'Yes, publish team fixtures' }).click();
  const standings = page.getByRole('table', { name: 'Team standings' });
  await expect(standings).toBeVisible();
  await expect(standings.getByRole('columnheader', { name: 'GF' })).toBeVisible();
  await expect(standings.getByRole('columnheader', { name: 'GA' })).toBeVisible();
  const game = page.locator('.team-fixture');
  await game.getByRole('spinbutton', { name: 'Goals for Azuis' }).fill('2');
  await game.getByRole('spinbutton', { name: 'Goals for Verdes' }).fill('1');
  await game.getByRole('button', { name: 'Save result between Azuis and Verdes' }).click();

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
  await page.getByRole('button', { name: 'Draw knockouts' }).click();
  await page.getByRole('button', { name: 'Yes, draw knockouts' }).click();
  await expect(page.getByRole('table', { name: 'Team standings' })).toHaveCount(0);
  const match = page.locator('.team-fixture');
  await match.getByRole('spinbutton', { name: 'Goals for Azuis' }).fill('2');
  await match.getByRole('spinbutton', { name: 'Goals for Verdes' }).fill('1');
  await match.getByRole('button', { name: 'Save result between Azuis and Verdes' }).click();
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

test('Competition fixtures E2E: English league publishing and result actions restore PT', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  const schedule = page.locator('.team-schedule-action');
  await expect(schedule.getByText('Ready to start the championship?')).toBeVisible();
  await expect(schedule.getByText('Generate a single-leg schedule for all teams.', { exact: false })).toBeVisible();
  await schedule.getByRole('button', { name: 'Generate team fixtures' }).click();
  await expect(schedule.getByRole('button', { name: 'Yes, publish team fixtures' })).toBeVisible();
  await schedule.getByRole('button', { name: 'Yes, publish team fixtures' }).click();

  const fixtures = page.getByRole('region', { name: 'Team fixtures' });
  await expect(fixtures.getByRole('heading', { name: 'Team rounds and fixtures' })).toBeVisible();
  await expect(fixtures.getByText('Round-robin championship. Results update the standings automatically.')).toBeVisible();
  await expect(fixtures.getByText('Not played')).toBeVisible();
  const match = fixtures.locator('.team-fixture').first();
  await match.getByRole('spinbutton', { name: 'Goals for Azuis' }).fill('2');
  await match.getByRole('spinbutton', { name: 'Goals for Verdes' }).fill('1');
  await match.getByRole('button', { name: 'Save result between Azuis and Verdes' }).click();
  await expect(match.getByRole('button', { name: 'Correct result between Azuis and Verdes' })).toBeVisible();
  await expect(page.getByText('Tiebreak: Score difference first')).toBeVisible();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  const portuguese = page.getByRole('region', { name: 'Jornadas entre equipas' });
  await expect(portuguese.getByRole('heading', { name: 'Jornadas e confrontos entre equipas' })).toBeVisible();
  await expect(portuguese.getByRole('button', { name: 'Corrigir resultado entre Azuis e Verdes' })).toBeVisible();
  await expect(page.getByText('Desempate: Diferença do marcador primeiro')).toBeVisible();
  expect(fixture.teamFixtures).toHaveLength(1);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('Competition fixtures E2E: English knockout publishing keeps winner-only scoring', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule', 'Futebol', undefined, 1, 'KNOCKOUT');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  const schedule = page.locator('.team-schedule-action');
  await expect(schedule.getByText('Ready to draw the knockout bracket?')).toBeVisible();
  await expect(schedule.getByText('Draw the opening fixtures and byes.', { exact: false })).toBeVisible();
  await schedule.getByRole('button', { name: 'Draw knockouts' }).click();
  await expect(schedule.getByRole('button', { name: 'Yes, draw knockouts' })).toBeVisible();
  await schedule.getByRole('button', { name: 'Yes, draw knockouts' }).click();

  const fixtures = page.getByRole('region', { name: 'Team fixtures' });
  await expect(fixtures.getByRole('heading', { name: 'Knockout bracket' })).toBeVisible();
  await expect(fixtures.getByText('The winner advances. Draws are not allowed in knockout matches.')).toBeVisible();
  const match = fixtures.locator('.team-fixture').first();
  await match.getByRole('spinbutton', { name: 'Goals for Azuis' }).fill('1');
  await match.getByRole('spinbutton', { name: 'Goals for Verdes' }).fill('1');
  await expect(match.getByRole('button', { name: 'Save result between Azuis and Verdes' })).toBeDisabled();
  await expect(match.getByText('A knockout match needs a winner and whole-number scores from 0 to 999.')).toBeVisible();
  expect(fixture.teamFixtures).toHaveLength(1);
  expect(fixture.teamFixtures[0].status).toBe('SCHEDULED');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('Competition stages E2E: individual match rounds follow PT/EN with no writes', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'paged');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await expect(page.locator('.match-round').first()).toHaveText('Round 1');
  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.locator('.match-round').first()).toHaveText('Jornada 1');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
  expect(fixture.organizerMutations).toEqual([]);
});

test('Competition stages E2E: team league rounds follow PT/EN after publishing', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Generate team fixtures' }).click();
  await page.getByRole('button', { name: 'Yes, publish team fixtures' }).click();
  const fixtures = page.getByRole('region', { name: 'Team fixtures' });
  await expect(fixtures.locator('.team-fixtures-list h6').first()).toHaveText('Round 1');
  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Jornadas entre equipas' })
    .locator('.team-fixtures-list h6').first()).toHaveText('Jornada 1');
  expect(fixture.teamFixtures).toHaveLength(1);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('Competition stages E2E: knockout round changes language but not winner rules', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule',
    'Futebol', undefined, 1, 'KNOCKOUT');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Draw knockouts' }).click();
  await page.getByRole('button', { name: 'Yes, draw knockouts' }).click();
  const fixtures = page.getByRole('region', { name: 'Team fixtures' });
  await expect(fixtures.locator('.team-fixtures-list h6').first()).toHaveText('Round 1');
  const match = fixtures.locator('.team-fixture').first();
  await match.getByRole('spinbutton', { name: 'Goals for Azuis' }).fill('1');
  await match.getByRole('spinbutton', { name: 'Goals for Verdes' }).fill('1');
  await expect(match.getByRole('button', { name: 'Save result between Azuis and Verdes' })).toBeDisabled();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Jornadas entre equipas' })
    .locator('.team-fixtures-list h6').first()).toHaveText('Ronda 1');
  expect(fixture.teamFixtures[0].status).toBe('SCHEDULED');
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('Competition individual E2E: registrations, standings and goal labels follow PT/EN', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'paged');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  const registrations = page.getByRole('region', { name: 'Registrations' });
  await expect(registrations.getByRole('heading', { name: 'Participants' })).toBeVisible();
  await expect(registrations.getByText('Confirmed').first()).toBeVisible();
  const fixtures = page.getByRole('region', { name: 'Fixtures' });
  await expect(fixtures.getByRole('heading', { name: 'Fixtures and results' })).toBeVisible();
  await expect(fixtures.getByRole('spinbutton', { name: 'Goals for organizador' })).toBeVisible();
  await expect(fixtures.getByRole('spinbutton', { name: 'Goals for participante' })).toBeVisible();
  await expect(fixtures.getByRole('button', { name: 'Save round 1 result between organizador and participante' })).toBeVisible();
  const table = page.getByRole('region', { name: 'Tournament standings' });
  await expect(table.getByRole('heading', { name: 'Standings' })).toBeVisible();
  await expect(table).toContainText('goal difference');
  await expect(table.getByRole('columnheader', { name: 'GF' })).toBeVisible();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Inscrições' })
    .getByRole('heading', { name: 'Participantes' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Jornadas' })
    .getByRole('spinbutton', { name: 'Golos de organizador' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Classificação do torneio' })
    .getByRole('columnheader', { name: 'GM' })).toBeVisible();
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('Competition individual E2E: chess result options and scoring remain PT/EN', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'paged', 'Xadrez', ['Xadrez']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  const fixtures = page.getByRole('region', { name: 'Fixtures' });
  const result = fixtures.getByRole('combobox', { name: 'Match result between organizador and participante' });
  await expect(result).toBeVisible();
  await expect(result.locator('option')).toHaveText([
    'Select result', 'Win for @organizador', 'Draw (½ – ½)', 'Win for @participante'
  ]);
  await result.selectOption('DRAW');
  await expect(fixtures.getByRole('button', { name: 'Save round 1 result between organizador and participante' })).toBeEnabled();
  const englishStandings = page.getByRole('region', { name: 'Tournament standings' });
  await expect(englishStandings).toContainText('Chess points: win 1, draw ½, loss 0.');

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  const portuguese = page.getByRole('region', { name: 'Jornadas' });
  const ptResult = portuguese.getByRole('combobox', { name: 'Resultado da partida entre organizador e participante' });
  await expect(ptResult.locator('option')).toHaveText([
    'Selecionar resultado', 'Vitória de @organizador', 'Empate (½ – ½)', 'Vitória de @participante'
  ]);
  await expect(page.getByRole('region', { name: 'Classificação do torneio' }))
    .toContainText('Pontos de xadrez: vitória 1, empate ½, derrota 0.');
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.matches.every(match => match.status === 'SCHEDULED')).toBeTruthy();
});

test('Competition organizer E2E: English creation success feedback matches selected language', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty', 'Futebol', ['Futebol']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  await page.getByRole('region', { name: 'How competitions work' })
    .getByRole('button', { name: 'Create individual league' }).click();
  const wizard = page.getByRole('region', { name: 'Configure competition' });
  await wizard.getByLabel('Tournament name').fill('Autumn QA League');
  await expect(wizard.getByRole('button', { name: 'Confirm individual league' })).toBeEnabled();
  await wizard.getByRole('button', { name: 'Confirm individual league' }).click();
  await expect(page.locator('.notice-success')).toHaveText('Tournament created.');
  await expect(page.locator('.tournament-heading h4')).toHaveText('Autumn QA League');
  expect(fixture.tournaments.some(item => item.name === 'Autumn QA League')).toBeTruthy();
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});

test('Competition profiles E2E: chess rules and chess team restriction are bilingual', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty', 'Xadrez', ['Xadrez']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('region', { name: 'How competitions work' })
    .getByRole('button', { name: 'Create individual league' }).click();
  const wizard = page.getByRole('region', { name: 'Configure competition' });
  const profile = wizard.locator('.classification-profile');
  await expect(profile.locator('strong')).toHaveText('Chess scoring');
  await expect(profile.locator('p').first()).toContainText('Win: 1 point · Draw: ½ point · Loss: 0.');
  await expect(profile.locator('small').first()).toHaveText('Each game result');
  await wizard.getByRole('button', { name: 'Back to options' }).click();
  await page.getByRole('region', { name: 'How competitions work' })
    .getByRole('button', { name: 'Set up a team tournament' }).click();
  await expect(page.locator('.classification-profile')).toContainText('Team chess requires board-by-board');
  await expect(page.getByRole('button', { name: 'Format not available yet' })).toBeDisabled();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await page.getByRole('region', { name: 'Como funcionam as competições' })
    .getByRole('button', { name: 'Criar liga individual' }).click();
  const portuguese = page.locator('.classification-profile');
  await expect(portuguese.locator('strong')).toHaveText('Pontuação de Xadrez');
  await expect(portuguese.locator('p').first()).toContainText('Vitória: 1 ponto · Empate: ½ ponto · Derrota: 0.');
  await expect(portuguese.locator('small').first()).toHaveText('Resultado de cada partida');
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
});

test('Competition profiles E2E: swimming race warning stays unavailable in EN and PT', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'empty', 'Natação', ['Natação']);
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('region', { name: 'How competitions work' })
    .getByRole('button', { name: 'Create individual league' }).click();
  const wizard = page.getByRole('region', { name: 'Configure competition' });
  await wizard.getByLabel('Tournament name').fill('Swimming QA');
  const profile = wizard.locator('.classification-profile');
  await expect(profile.locator('strong')).toHaveText('Race standings');
  await expect(profile.locator('p').first()).toContainText('cannot produce valid race standings');
  await expect(profile.locator('small').first()).toHaveText('Finish position · Time · Penalties / DNF');
  await expect(wizard.getByRole('button', { name: 'Format not available yet' })).toBeDisabled();

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await page.getByRole('region', { name: 'Como funcionam as competições' })
    .getByRole('button', { name: 'Criar liga individual' }).click();
  const portuguese = page.getByRole('region', { name: 'Configurar competição' });
  await portuguese.getByLabel('Nome do torneio').fill('Natação QA');
  const ptProfile = portuguese.locator('.classification-profile');
  await expect(ptProfile.locator('strong')).toHaveText('Classificação por corridas');
  await expect(ptProfile.locator('p').first()).toContainText('não pode produzir uma classificação de corrida válida');
  await expect(portuguese.getByRole('button', { name: 'Formato ainda indisponível' })).toBeDisabled();
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
});

test('Competition organizer E2E: deletion warning, cancellation and sidebar follow PT/EN without mutation', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'trial');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  const sidebar = page.getByRole('complementary', { name: 'Tournament list' });
  await expect(sidebar.getByRole('heading', { name: 'Existing competitions' })).toBeVisible();
  await expect(page.locator('.tournament-heading')).toContainText('Win 3 · Draw 1 · Loss 0 points');
  await page.getByRole('button', { name: 'Delete competition' }).click();
  const warning = page.getByRole('group', { name: 'Confirm deletion' });
  await expect(warning).toContainText('Delete “lol”?');
  await expect(warning).toContainText('Overall community statistics will not be affected.');
  await expect(warning.getByRole('button', { name: 'Yes, delete competition' })).toBeVisible();
  await warning.getByRole('button', { name: 'Cancel' }).click();
  expect(fixture.tournaments).toHaveLength(1);

  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Lista de torneios' })
    .getByRole('heading', { name: 'Competições existentes' })).toBeVisible();
  await expect(page.locator('.tournament-heading')).toContainText('Vitória 3 · Empate 1 · Derrota 0 pontos');
  await page.getByRole('button', { name: 'Eliminar competição' }).click();
  const portugueseWarning = page.getByRole('group', { name: 'Confirmar eliminação' });
  await expect(portugueseWarning).toContainText('Eliminar “lol”?');
  await portugueseWarning.getByRole('button', { name: 'Cancelar' }).click();
  expect(fixture.tournaments).toHaveLength(1);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments/'))).toEqual([]);
});


test('Competition bilingual tables E2E: individual standings use PT/EN played and result abbreviations', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'paged');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  const table = page.getByRole('table', { name: 'Tournament standings' });
  await expect(table).toBeVisible();
  for (const [label, tooltip] of [['P', 'Played'], ['W', 'Wins'], ['D', 'Draws'], ['L', 'Losses']]) {
    await expect(table.getByRole('columnheader', { name: label, exact: true })).toHaveAttribute('title', tooltip);
  }
  await expect(table.getByRole('columnheader', { name: 'Pts' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  const portuguese = page.getByRole('table', { name: 'Classificação do torneio' });
  for (const [label, tooltip] of [['J', 'Jogos'], ['V', 'Vitórias'], ['E', 'Empates'], ['D', 'Derrotas']]) {
    await expect(portuguese.getByRole('columnheader', { name: label, exact: true })).toHaveAttribute('title', tooltip);
  }
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
});

test('Competition backend error E2E: English organizer sees translated completion conflict and can retry', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'complete-rejected');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();

  await page.getByRole('button', { name: 'Generate fixtures' }).click();
  await page.getByRole('button', { name: 'Yes, publish fixtures' }).click();
  const game = page.locator('.match-card').first();
  await game.getByRole('spinbutton', { name: 'Goals for organizador' }).fill('1');
  await game.getByRole('spinbutton', { name: 'Goals for participante' }).fill('0');
  await game.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Finish tournament' }).click();
  await page.getByRole('button', { name: 'Yes, finish' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toHaveText('All league matches must be completed before closing the tournament.');
  await expect(alert).toBeFocused();
  await expect(page.getByRole('button', { name: 'Finish tournament' })).toBeEnabled();
  expect(fixture.tournaments[0].status).toBe('IN_PROGRESS');
  expect(fixture.completeAttempts).toBe(1);
  expect(fixture.unmocked.filter(url => url.includes('/tournaments'))).toEqual([]);
});


test('Community feature controls E2E: PT/EN labels, history notice and cancellation are localized', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'modules-off');
  await page.goto('/menu/communities/7?tab=tournaments');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Community features' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage features' }).click();
  const options = page.getByRole('group', { name: 'Optional features' });
  await expect(options).toBeVisible();
  await expect(options.getByLabel('Individual tournaments')).toBeVisible();
  await expect(options.getByLabel('Team tournaments')).toBeVisible();
  await expect(options.getByLabel('Standings and statistics for regular games')).toBeVisible();
  await expect(page.getByText('Disabling an option hides its section without deleting data.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('d24-language', 'pt'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Funcionalidades da comunidade' })).toBeVisible();
  await page.getByRole('button', { name: 'Gerir funcionalidades' }).click();
  await expect(page.getByRole('group', { name: 'Funcionalidades opcionais' })).toBeVisible();
  await expect(page.getByText('calendários em desenvolvimento')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(fixture.unmocked.filter(url => /^(POST|PUT|PATCH|DELETE) \/api\/communities\/7\//.test(url))).toEqual([]);
});

test('Community spreadsheet inspection E2E: Portuguese backend error is not shown in English', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'history');
  await page.route('**/api/communities/7/competition/import/preview', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({ status: 422, contentType: 'application/json',
      body: JSON.stringify({ message: 'Não foi possível analisar a folha de cálculo.' }) });
  });
  await page.goto('/menu/communities/7?tab=ranking');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Final standings' }).click();
  const file = page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]');
  await file.setInputFiles({ name: 'history.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Pos;Equipa;Pts\n1;Azuis;3\n') });
  await page.getByRole('button', { name: 'Analyse file' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'We could not analyse this file.' }))
    .toHaveCount(1);
  expect((await page.getByRole('alert').allTextContents()).join(' '))
    .not.toContain('Não foi possível analisar');
  expect(fixture.unmocked.filter(url => url.includes('/competition/import/'))).toEqual([]);
});


test('Historical spreadsheet E2E: duplicate source warning is localized in English without saving', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'history');
  await page.goto('/menu/communities/7?tab=ranking');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Final standings' }).click();
  await page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]').setInputFiles({
    name: 'original-standings.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Pos;Equipa;Pts\n1;Águias;25\n')
  });
  await page.getByRole('button', { name: 'Analyse file' }).click();
  await page.getByRole('button', { name: 'Validate and preview data' }).click();
  await expect(page.getByText('Row 4: ÁGUIAS appears more than once; only the first occurrence is kept.'))
    .toBeVisible();
  expect((await page.locator('.import-final-plan').allTextContents()).join(' '))
    .not.toContain('mantém-se apenas a primeira');
  expect(fixture.archivePreviewCalls).toBe(1);
  expect(fixture.archiveConfirmCalls).toBe(0);
  expect(fixture.unmocked.filter(item => item.includes('/competition/import/'))).toEqual([]);
});

test('fictional speed-skating QA: link timed round and ratify qualifiers with standings disabled', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'inline-speed-qa',
    'Patinagem de Velocidade');
  await page.goto('/menu/communities/7?tab=tournaments');
  const progression = page.locator('.inline-speed-progression');
  await expect(progression).toBeVisible();
  await expect(progression.locator('.race-available-row')).toContainText('500 m +D — Primeira fase QA');
  await expect(progression.locator('.inline-speed-heat')).toHaveCount(0);

  await progression.locator('.race-available-row button').first().click();
  await expect(progression.locator('.inline-speed-heat')).toHaveCount(1);
  await expect(progression.locator('.inline-speed-heat')).toContainText('Ana Exemplo');
  await expect(progression.locator('.inline-speed-proposal')).toContainText('8 / 8');

  // Nothing is approved without an explicit judge action and attestation.
  await expect(progression.locator('.inline-speed-proposal [role=status]')).toHaveCount(0);
  await progression.locator('.inline-speed-proposal textarea').fill(
    'Confirmadas todas as mangas da primeira fase com resultados oficiais.');
  await progression.locator('.inline-speed-proposal button').last().click();
  await expect(progression.locator('.inline-speed-proposal [role=status]')).toContainText('organizador');
  expect(fixture.speedWrites).toEqual(['link:100', 'confirm:FIRST']);
  expect(fixture.speedDecisionReason[0]).toContain('Confirmadas todas as mangas');
  expect(fixture.unmocked.filter(x => x.includes('/inline-speed'))).toEqual([]);
  expect(fixture.tournaments[0].sport).toBe('Patinagem de Velocidade');
});


test('Community import HTTP 400 E2E: structured error is translated and no import is saved', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'history');
  await page.route('**/api/communities/7/competition/import/preview', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      httpStatusCode: 400, message: 'O ficheiro não pode ultrapassar 10 MB',
      code: 'IMPORT_FILE_TOO_LARGE', params: {}
    }) });
  });
  await page.goto('/menu/communities/7?tab=ranking');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Final standings' }).click();
  await page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]').setInputFiles({
    name: 'old-history.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Pos;Equipa;Pts\n1;Azuis;3\n')
  });
  await page.getByRole('button', { name: 'Analyse file' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'The file cannot exceed 10 MB.' }))
    .toHaveCount(1);
  expect((await page.getByRole('alert').allTextContents()).join(' ')).not.toContain('O ficheiro não pode');
  expect(fixture.archiveConfirmCalls).toBe(0);
  expect(fixture.matchConfirmCalls).toBe(0);
  expect(fixture.unmocked.filter(url => url.includes('/competition/import/'))).toEqual([]);
});


test('Community import HTTP 400 E2E: missing structured parameters do not leak placeholders', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'history');
  let previewCalls = 0;
  await page.route('**/api/communities/7/competition/import/preview', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    previewCalls++;
    // A recognised code without its required row is deliberately malformed.
    // The English UI must display the operation-specific review message.
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
      httpStatusCode: 400,
      message: 'Linha 23: resultado inválido (exemplo: 2-1 ou 2:1)',
      code: 'IMPORT_ROW_SCORE_INVALID', params: {}
    }) });
  });
  await page.goto('/menu/communities/7?tab=ranking');
  await page.evaluate(() => localStorage.setItem('d24-language', 'en'));
  await page.reload();
  await page.getByRole('button', { name: 'Final standings' }).click();
  await page.locator('input[accept=".xlsx,.xls,.csv,.tsv"]').setInputFiles({
    name: 'fictional-standings.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Pos;Equipa;Pts\n1;Azuis;3\n')
  });
  await page.getByRole('button', { name: 'Analyse file' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'We could not analyse this file.' }))
    .toHaveCount(1);
  const alerts = (await page.getByRole('alert').allTextContents()).join(' ');
  expect(alerts).not.toContain('{{row}}');
  expect(alerts).not.toContain('Linha 23');
  expect(alerts).not.toContain('resultado inválido');
  expect(previewCalls).toBe(1);
  expect(fixture.archiveConfirmCalls).toBe(0);
  expect(fixture.matchConfirmCalls).toBe(0);
  expect(fixture.unmocked.filter(url => url.includes('/competition/import/'))).toEqual([]);
});


/*
 * Concept One Premium regression with filled tournament content, not just
 * empty states. These tests reuse the existing isolated community API fixtures:
 * no traffic to production, no real users and no tournament writes.
 */
test('Premium populated tournament QA: individual standings and fixtures fit 390px, 768px and desktop in PT/EN', async ({ page }, testInfo) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'paged');
  for (const width of [390, 768, 1366]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const language of ['pt', 'en']) {
      await page.goto('/menu/communities/7?tab=tournaments');
      await page.evaluate(value => localStorage.setItem('d24-language', value), language);
      await page.reload();
      await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
      const table = page.getByRole('table', {
        name: language === 'pt' ? 'Classificação do torneio' : 'Tournament standings'
      });
      await expect(table).toBeVisible();
      await expect(page.locator('.match-card').first()).toBeVisible();
      const geometry = await page.evaluate(() => {
        const root = document.querySelector('.tournaments')!;
        const scroll = document.querySelector('.standings-scroll')!;
        const rect = root.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          tournamentLeft: rect.left, tournamentRight: rect.right,
          availableTableScroll: scroll.scrollWidth - scroll.clientWidth
        };
      });
      expect(geometry.documentWidth, 'document overflow ' + JSON.stringify(geometry))
        .toBeLessThanOrEqual(width + 2);
      expect(geometry.tournamentLeft).toBeGreaterThanOrEqual(-2);
      expect(geometry.tournamentRight).toBeLessThanOrEqual(width + 2);
      if (width === 390) {
        expect(geometry.availableTableScroll,
          'wide standings must scroll inside their own container').toBeGreaterThan(0);
      }
      await testInfo.attach('individual-' + width + '-' + language, {
        body: await page.locator('.tournaments').screenshot(),
        contentType: 'image/png'
      });
    }
  }
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(path => /^(POST|PUT|DELETE|PATCH) /.test(path)
    && !/^(POST \/api\/pilot\/events\/access|POST \/api\/presence\/heartbeat)$/.test(path))).toEqual([]);
});

test('Premium populated tournament QA: team rosters and schedule confirmation stay readable without publishing', async ({ page }, testInfo) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'teams-schedule');
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const language of ['pt', 'en']) {
      await page.goto('/menu/communities/7?tab=tournaments');
      await page.evaluate(value => localStorage.setItem('d24-language', value), language);
      await page.reload();
      await expect(page.locator('.team-roster-card')).toHaveCount(2);
      await expect(page.locator('.team-roster-card').first()).toContainText('Azuis');
      await expect(page.locator('.team-roster-card').last()).toContainText('Verdes');
      await page.getByRole('button', {
        name: language === 'pt' ? 'Gerar jornadas entre equipas' : 'Generate team fixtures'
      }).click();
      const confirm = page.locator('.team-schedule-action .confirm-actions');
      await expect(confirm).toBeVisible();
      const geometry = await page.evaluate(() => {
        const root = document.querySelector('.tournaments')!;
        const confirmation = document.querySelector('.team-schedule-action .confirm-actions')!;
        const bounds = root.getBoundingClientRect();
        const actions = confirmation.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          componentLeft: bounds.left, componentRight: bounds.right,
          actionsLeft: actions.left, actionsRight: actions.right
        };
      });
      expect(geometry.documentWidth, 'document overflow ' + JSON.stringify(geometry))
        .toBeLessThanOrEqual(width + 2);
      expect(geometry.componentLeft).toBeGreaterThanOrEqual(-2);
      expect(geometry.componentRight).toBeLessThanOrEqual(width + 2);
      expect(geometry.actionsLeft).toBeGreaterThanOrEqual(-2);
      expect(geometry.actionsRight).toBeLessThanOrEqual(width + 2);
      await testInfo.attach('teams-confirmation-' + width + '-' + language, {
        body: await page.locator('.tournaments').screenshot(),
        contentType: 'image/png'
      });
      // Read-only interaction: close the confirmation, never publish fixtures.
      await page.locator('.team-schedule-action .confirm-actions button').last().click();
      await expect(confirm).toHaveCount(0);
    }
  }
  expect(fixture.teamFixtures).toHaveLength(0);
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(path => /^(POST|PUT|DELETE|PATCH) /.test(path)
    && !/^(POST \/api\/pilot\/events\/access|POST \/api\/presence\/heartbeat)$/.test(path))).toEqual([]);
});


/*
 * Extended Concept One Premium stress QA: never submit a tournament mutation.
 * Mocked 32-player roster and 48 matches deliberately cover real pagination,
 * internal table scrolling, form validation and source-labelled knockout history.
 */
test('Premium populated tournament QA: 32-player standings and 48 fixtures paginate without mobile clipping', async ({ page }, testInfo) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'visual-large-league');
  for (const width of [390, 768, 1366]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const language of ['pt', 'en']) {
      await page.goto('/menu/communities/7?tab=tournaments');
      await page.evaluate(value => localStorage.setItem('d24-language', value), language);
      await page.reload();
      await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

      const table = page.getByRole('table', {
        name: language === 'pt' ? 'Classificação do torneio' : 'Tournament standings'
      });
      await expect(table.locator('tbody tr')).toHaveCount(32);
      await expect(table.locator('tbody')).toContainText('Jogador 32');

      // The roster and fixtures are paginated separately. Neither should
      // require horizontal scrolling of the whole document.
      await expect(page.locator('.player-item')).toHaveCount(20);
      await page.locator('.players-list + button').click();
      await expect(page.locator('.player-item')).toHaveCount(32);
      await expect(page.locator('.match-card')).toHaveCount(20);
      await page.locator('.match-list + button').click();
      await expect(page.locator('.match-card')).toHaveCount(40);
      await page.locator('.match-list + button').click();
      await expect(page.locator('.match-card')).toHaveCount(48);
      await expect(page.locator('.match-list + button')).toHaveCount(0);

      const first = page.locator('.match-card').first();
      const home = first.getByRole('spinbutton', {
        name: language === 'pt' ? 'Golos de organizador' : 'Goals for organizador'
      });
      const away = first.getByRole('spinbutton', {
        name: language === 'pt' ? 'Golos de player17' : 'Goals for player17'
      });
      const save = first.getByRole('button', {
        name: language === 'pt' ? /Guardar/ : /Save/
      });
      await home.fill('-1');
      await away.fill('1');
      await expect(home).toHaveAttribute('aria-invalid', 'true');
      await expect(save).toBeDisabled();
      await home.fill('2');
      await expect(home).not.toHaveAttribute('aria-invalid', 'true');
      await expect(save).toBeEnabled();
      // No save click: draft score remains entirely in the browser.

      const geometry = await page.evaluate(() => {
        const root = document.querySelector('.tournaments')!;
        const tableScroll = document.querySelector('.standings-scroll')!;
        const match = document.querySelector('.match-card')!;
        const score = document.querySelector('.score-edit')!;
        const rects = [root, match, score].map(element => {
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right };
        });
        return {
          viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
          rects, tableScroll: tableScroll.scrollWidth - tableScroll.clientWidth
        };
      });
      expect(geometry.documentWidth, JSON.stringify(geometry))
        .toBeLessThanOrEqual(width + 2);
      for (const rect of geometry.rects) {
        expect(rect.left).toBeGreaterThanOrEqual(-2);
        expect(rect.right).toBeLessThanOrEqual(width + 2);
      }
      if (width === 390) {
        expect(geometry.tableScroll, 'wide standings must scroll inside table').toBeGreaterThan(0);
      }
      await testInfo.attach('large-32-roster-48-fixtures-' + width + '-' + language, {
        body: await first.screenshot(), contentType: 'image/png'
      });
    }
  }
  expect(fixture.scheduleAttempts).toBe(0);
  expect(fixture.organizerMutations).toEqual([]);
  expect(fixture.unmocked.filter(path => /^(POST|PUT|PATCH|DELETE) \/api\/communities\//.test(path)))
    .toEqual([]);
});

test('Premium populated tournament QA: historical 57-row knockout phases navigate within mobile viewport', async ({ page }, testInfo) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'historical-knockout');
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const language of ['pt', 'en']) {
      await page.goto('/menu/communities/7?tab=tournaments');
      await page.evaluate(value => localStorage.setItem('d24-language', value), language);
      await page.reload();

      const phases = page.locator('.historical-phase-card');
      await expect(phases).toHaveCount(3);
      await phases.nth(2).getByRole('button').first().click();
      const final = page.locator('[data-historical-source-row="257"]');
      await expect(final).toBeVisible();
      await expect(final).toContainText('Águias');
      await expect(final).toContainText('Leões');
      // On mobile the source-labelled table is intentionally horizontally
      // scrollable: an intersection *area* ratio counts the off-screen columns
      // and cannot establish whether the final is vertically in view.
      await expect.poll(async () => final.evaluate(row => {
        const rect = row.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
        return visible / Math.max(1, Math.min(rect.height, innerHeight));
      }), { timeout: 10000 }).toBeGreaterThan(0.5);
      if (width === 390) {
        const horizontalTableScroll = await page.locator('.historical-archive-fixtures .standings-scroll')
          .evaluate(element => element.scrollWidth - element.clientWidth);
        expect(horizontalTableScroll,
          'historical table is wider than mobile and must scroll inside its section')
          .toBeGreaterThan(0);
      }
      await expect(page.locator('.historical-tournament-pages'))
        .toContainText('51–57 / 57');

      const geometry = await page.evaluate(() => {
        const root = document.querySelector('.tournaments')!.getBoundingClientRect();
        const phases = [...document.querySelectorAll('.historical-phase-card')]
          .map(node => node.getBoundingClientRect())
          .map(r => ({ left: r.left, right: r.right }));
        return {
          viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
          root: { left: root.left, right: root.right }, phases
        };
      });
      expect(geometry.documentWidth, JSON.stringify(geometry))
        .toBeLessThanOrEqual(width + 2);
      for (const rect of [geometry.root, ...geometry.phases]) {
        expect(rect.left).toBeGreaterThanOrEqual(-2);
        expect(rect.right).toBeLessThanOrEqual(width + 2);
      }
      await testInfo.attach('history-57-final-' + width + '-' + language, {
        body: await final.screenshot(), contentType: 'image/png'
      });
    }
  }
  expect(fixture.unmocked.filter(path => /^(POST|PUT|PATCH|DELETE) \/api\/communities\//.test(path)))
    .toEqual([]);
});

test('Premium populated tournament QA: 33 participants display the 32-player safety cap at 390px', async ({ page }) => {
  const fixture = await mockCommunityApi(page, 'OWNER', 'schedule-roster-oversize');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/menu/communities/7?tab=tournaments');
  await expect(page.locator('.player-item')).toHaveCount(20);
  await page.locator('.players-list + button').click();
  await expect(page.locator('.player-item')).toHaveCount(33);
  await expect(page.getByRole('button', { name: 'Gerar jornadas' })).toBeDisabled();
  await expect(page.getByText('Esta versão permite no máximo 32 jogadores confirmados.'))
    .toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(392);
  expect(fixture.scheduleAttempts).toBe(0);
  expect(fixture.organizerMutations).toEqual([]);
});


/**
 * Premium populated tournament QA — strict role split in TWO distinct browsers.
 * Independent fake JWTs, independent mocked role-dependent API responses.
 * Deliberately does not submit enrollment, scheduling, deletion, result changes
 * or any moderation operation. Does not use LIVE accounts or backend.
 */
test('Premium populated tournament QA: organizer can draft a result while participant only reads the same round', async ({ browser }, testInfo) => {
  test.setTimeout(100_000);
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();
    const ownerApi = await mockCommunityApi(owner, 'OWNER', 'paged');
    const memberApi = await mockCommunityApi(member, 'MEMBER', 'paged');
    for (const width of [390, 1366]) {
      await Promise.all([owner.setViewportSize({ width, height: 844 }),
        member.setViewportSize({ width, height: 844 })]);
      for (const language of ['pt', 'en']) {
        await Promise.all([owner.goto('/menu/communities/7?tab=tournaments'),
          member.goto('/menu/communities/7?tab=tournaments')]);
        await Promise.all([owner.evaluate(v => localStorage.setItem('d24-language', v), language),
          member.evaluate(v => localStorage.setItem('d24-language', v), language)]);
        await Promise.all([owner.reload(), member.reload()]);
        await expect(owner.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
        await expect(member.locator('.tournament-heading h4')).toHaveText('Liga de Outono');
        await expect(owner.locator('.match-card').first()).toBeVisible();
        await expect(member.locator('.match-card').first()).toBeVisible();

        // Identical mock match, different privilege; member cannot edit even
        // when explicitly opening the same competition as an organizer.
        const ownerForm = owner.locator('.match-card').first().locator('.score-edit');
        await expect(ownerForm).toBeVisible();
        await expect(member.locator('.score-edit')).toHaveCount(0);
        await expect(member.locator('.match-card .match-score').first()).toBeVisible();
        await expect(member.locator('.create-tournament')).toHaveCount(0);
        await expect(member.locator('.competition-delete-confirm')).toHaveCount(0);
        const inputs = ownerForm.locator('input[type="number"]');
        await expect(inputs).toHaveCount(2);
        const save = ownerForm.locator('button');
        await expect(save).toBeDisabled();
        await inputs.nth(0).fill('3');
        await inputs.nth(1).fill('1');
        await expect(save).toBeEnabled();

        for (const page of [owner, member]) {
          const dims = await page.evaluate(() => ({
            viewport: innerWidth, documentWidth: document.documentElement.scrollWidth
          }));
          expect(dims.documentWidth, JSON.stringify(dims))
            .toBeLessThanOrEqual(width + 2);
        }
        await testInfo.attach('roles-result-' + width + '-' + language, {
          body: await ownerForm.screenshot(), contentType: 'image/png'
        });
        // Never click the enabled save button.
        const ownerToken = await owner.evaluate(() => localStorage.getItem('t'));
        const memberToken = await member.evaluate(() => localStorage.getItem('t'));
        expect(ownerToken).not.toEqual(memberToken);
      }
    }
    expect(ownerApi.organizerMutations).toEqual([]);
    expect(memberApi.organizerMutations).toEqual([]);
    expect(ownerApi.scheduleAttempts).toBe(0);
    expect(memberApi.scheduleAttempts).toBe(0);
    for (const fixture of [ownerApi, memberApi]) {
      expect(fixture.unmocked.filter(url =>
        /^(POST|PUT|PATCH|DELETE) \/api\/communities\//.test(url))).toEqual([]);
    }
  } finally {
    await Promise.all([ownerContext.close(), memberContext.close()]);
  }
});

test('Premium populated tournament QA: member views both team rosters but never sees organizer scheduling controls', async ({ browser }, testInfo) => {
  test.setTimeout(100_000);
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();
    const ownerApi = await mockCommunityApi(owner, 'OWNER', 'teams-schedule');
    const memberApi = await mockCommunityApi(member, 'MEMBER', 'teams-schedule');
    for (const width of [390, 1366]) {
      await Promise.all([owner.setViewportSize({ width, height: 844 }),
        member.setViewportSize({ width, height: 844 })]);
      await Promise.all([owner.goto('/menu/communities/7?tab=tournaments'),
        member.goto('/menu/communities/7?tab=tournaments')]);
      await expect(owner.locator('.team-roster-card')).toHaveCount(2);
      await expect(member.locator('.team-roster-card')).toHaveCount(2);
      for (const page of [owner, member]) {
        await expect(page.locator('.team-roster-card').first()).toContainText('Azuis');
        await expect(page.locator('.team-roster-card').last()).toContainText('Verdes');
      }
      await expect(owner.locator('.team-schedule-action')).toBeVisible();
      await expect(member.locator('.team-schedule-action')).toHaveCount(0);
      await expect(member.locator('.team-player-assign')).toHaveCount(0);
      await expect(member.getByRole('button', { name: 'Adicionar equipa' })).toHaveCount(0);
      await expect(member.getByRole('button', { name: 'Eliminar competição' })).toHaveCount(0);

      const publish = owner.locator('.team-schedule-action > button');
      await expect(publish).toBeEnabled();
      await publish.click();
      const confirm = owner.locator('.team-schedule-action .confirm-actions');
      await expect(confirm).toBeVisible();
      await expect(member.locator('.confirm-actions')).toHaveCount(0);
      await testInfo.attach('roles-team-confirmation-' + width, {
        body: await owner.locator('.team-schedule-action').screenshot(),
        contentType: 'image/png'
      });
      // Only cancel in the owner's browser. Never call schedule.
      await confirm.locator('button').last().click();
      await expect(confirm).toHaveCount(0);
      for (const page of [owner, member]) {
        const size = await page.evaluate(() => ({
          viewport: innerWidth, documentWidth: document.documentElement.scrollWidth
        }));
        expect(size.documentWidth, JSON.stringify(size))
          .toBeLessThanOrEqual(width + 2);
      }
    }
    expect(ownerApi.teamFixtures).toHaveLength(0);
    expect(memberApi.teamFixtures).toHaveLength(0);
    expect(ownerApi.organizerMutations).toEqual([]);
    expect(memberApi.organizerMutations).toEqual([]);
    for (const fixture of [ownerApi, memberApi]) {
      expect(fixture.unmocked.filter(url =>
        /^(POST|PUT|PATCH|DELETE) \/api\/communities\//.test(url))).toEqual([]);
    }
  } finally {
    await Promise.all([ownerContext.close(), memberContext.close()]);
  }
});
