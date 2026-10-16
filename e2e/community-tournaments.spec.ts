import { expect, test, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

type Role = 'OWNER' | 'MEMBER';
type TournamentStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
type ParticipantStatus = 'PENDING' | 'CONFIRMED';

interface Tournament {
  id: number;
  name: string;
  format: 'LEAGUE';
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

type FixtureMode = 'empty' | 'draft' | 'paged' | 'forbidden' | 'switch'
  | 'management' | 'complete-rejected' | 'list-network-error'
  | 'paged-enrollment' | 'draw-tie';

async function mockCommunityApi(page: Page, role: Role, mode: FixtureMode) {
  const username = role === 'OWNER' ? 'organizador' : 'participante';
  const token = fixtureToken(username);
  await page.addInitScript(value => localStorage.setItem('t', value), token);

  const community = {
    id: 7, name: 'Jogadores de Lisboa', description: 'Liga dos amigos',
    sport: 'Futebol', photoUrl: null, visibility: 'PRIVATE',
    rankingsEnabled: true, ownerUsername: 'organizador',
    myRole: role, memberCount: 3, createdAt: '2026-10-16T12:00:00Z',
    members: [
      { profileId: 1, username: 'organizador', fullName: 'Organizador',
        role: 'OWNER', profilePicUrl: null },
      { profileId: 2, username: 'participante', fullName: 'Participante',
        role: 'MEMBER', profilePicUrl: null }
    ]
  };

  const tournaments: Tournament[] = mode === 'empty' ? [] : [tournament(9, 'Liga de Outono')];
  if (mode === 'switch') tournaments.push(tournament(11, 'Liga alternativa'));
  if (mode === 'paged') tournaments[0].status = 'IN_PROGRESS';
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
  const requestedMatchPages: number[] = [];
  const pendingDetailResponses: Array<() => void> = [];
  let completeAttempts = 0;
  let listAttempts = 0;
  let joinAttempts = 0;
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

    if (method === 'GET' && path === '/api/communities/mine') return send([community]);
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

    if (path === '/api/communities/7/tournaments') {
      if (method === 'GET') {
        listAttempts++;
        if (mode === 'list-network-error' && listAttempts === 1) {
          return route.abort('failed');
        }
        return send({ tournaments, page: Number(url.searchParams.get('page') || 0), hasMore: false });
      }
      if (method === 'POST') {
        const body = req.postDataJSON() as { name: string };
        const next = tournament(11, body.name);
        tournaments.unshift(next);
        return send(next, 201);
      }
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
    tournaments, participants, matches, unmocked, requestedMatchPages,
    requestedParticipantPages, organizerMutations,
    get completeAttempts(): number { return completeAttempts; },
    get listAttempts(): number { return listAttempts; },
    get joinAttempts(): number { return joinAttempts; },
    get pendingDetails(): number { return pendingDetailResponses.length; },
    releaseDetails(): void {
      pendingDetailResponses.splice(0).forEach(resolve => resolve());
    }
  };
}

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

  await expect(page.getByRole('heading', { name: 'Torneios da comunidade' })).toBeVisible();
  await expect(page.getByText('Esta comunidade ainda não tem torneios.')).toBeVisible();
  await page.getByLabel('Nome do torneio').fill('Liga de Inverno');
  await page.getByRole('button', { name: 'Criar torneio' }).click();
  await expect(page.getByRole('heading', { name: 'Liga de Inverno' })).toBeVisible();
  await expect(page.getByText('Torneio criado.')).toBeVisible();
  expect(state.tournaments).toHaveLength(1);
  expect(state.tournaments[0].status).toBe('DRAFT');
});

test('membro pede inscrição sem conseguir gerir torneios', async ({ page }) => {
  const state = await mockCommunityApi(page, 'MEMBER', 'draft');
  await page.goto('/menu/communities/7?tab=tournaments');

  await expect(page.getByRole('heading', { name: 'Liga de Outono' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar torneio' })).toHaveCount(0);
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
  await expect(page.getByText('Jornadas e resultados')).toBeVisible();

  await page.getByRole('spinbutton', { name: 'Golos de organizador' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Golos de participante' }).fill('1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('1 / 1 jogos')).toBeVisible();
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
  await expect(page.getByText('1 / 1 jogos')).toBeVisible();
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
  await expect(page.getByText('Esta comunidade ainda não tem torneios.')).toHaveCount(0);
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

  await expect(page.getByText('1 / 1 jogos')).toBeVisible();
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
  const tournamentsTab = nav.getByRole('button', { name: 'Torneios' });
  const sessionsTab = nav.getByRole('button', { name: /Sessões|Sessions/ });

  await expect(tournamentsTab).toBeVisible();
  await expect(tournamentsTab).not.toHaveAttribute('aria-current', 'true');
  await tournamentsTab.focus();
  await expect(tournamentsTab).toBeFocused();
  await tournamentsTab.press('Enter');

  await expect(tournamentsTab).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'Torneios da comunidade' })).toBeVisible();
  await expect(page.locator('.tournament-heading h4')).toHaveText('Liga de Outono');

  await sessionsTab.focus();
  await sessionsTab.press('Space');
  await expect(sessionsTab).toHaveAttribute('aria-current', 'true');
  await expect(tournamentsTab).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'Torneios da comunidade' })).toHaveCount(0);

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
