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

type FixtureMode = 'empty' | 'draft' | 'paged' | 'forbidden' | 'switch';

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
        return send({ participants, page: 0, hasMore: false });
      }
    }
    if (path === '/api/communities/7/tournaments/11/participants') {
      if (method === 'GET') return send({ participants: [], page: 0, hasMore: false });
    }
    if (path === '/api/communities/7/tournaments/9/participants/me') {
      if (method === 'PUT') {
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
      const top = standings().standings[0];
      const t = tournaments[0];
      t.status = 'COMPLETED';
      t.completedAt = '2026-10-16T14:00:00Z';
      t.championProfileId = top.profileId;
      t.championUsername = top.username;
      t.championDisplayName = top.displayName;
      t.championPoints = top.points;
      return send(t);
    }
    if (path === '/api/notifications/unread-count' && method === 'GET') return send(0);

    console.log('[E2E unmocked]', method, path);
    unmocked.push(method + ' ' + path);
    await send({ message: 'Unmocked browser-test endpoint' }, 404);
  });

  return {
    tournaments, participants, matches, unmocked, requestedMatchPages,
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
