import { Buffer } from 'node:buffer';
import { expect, test, type Page } from '@playwright/test';

// Use a deliberately unsigned fixture token against a local Angular server only.
// Every backend call is intercepted; no production user or database is accessed.
function isolatedToken(admin = false): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({ sub: 'auditor-ficticio', exp: Math.floor(Date.now() / 1000) + 3600,
      Authorities: admin ? ['ROLE_ADMIN'] : [] }),
    'fixture-only'
  ].join('.');
}

async function isolateBackend(page: Page, admin = false): Promise<void> {
  await page.addInitScript(token => localStorage.setItem('t', token), isolatedToken(admin));
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'The audit is testing an unavailable API, not production.' })
  }));
  if (admin) {
    // Only the authorization probe succeeds; all admin page data remains mocked
    // as temporarily unavailable, so no real user information is accessed.
    await page.route('**/api/admin/access', route => route.fulfill({ status: 204 }));
  }
  // The authenticated navbar normally connects to realtime chat. Never connect
  // a fixture token to a real production WebSocket endpoint.
  await page.routeWebSocket('**/ws/chat', socket => socket.close());
}

test.describe('Jynlo protected-screen offline resilience', () => {
  test.beforeEach(async ({ page }) => {
    await isolateBackend(page);
  });

  const screens = [
    { path: '/menu/feed', name: 'feed' },
    { path: '/menu/discover', name: 'discover' },
    { path: '/menu/events', name: 'find-sessions' },
    { path: '/menu/createEvent', name: 'create-session' },
    { path: '/menu/my-sessions', name: 'my-sessions' },
    { path: '/menu/communities', name: 'communities' },
    { path: '/menu/perfis', name: 'find-people' },
    { path: '/menu/friendList', name: 'messages' },
    { path: '/menu/notifications', name: 'notifications' },
    { path: '/menu/dadosPerfil', name: 'my-profile' },
    { path: '/menu/alterardados', name: 'edit-profile' },
    { path: '/menu/alterarPassword', name: 'change-password' },
    { path: '/menu/venues/new', name: 'suggest-venue' }
  ] as const;

  for (const screen of screens) {
    test(`${screen.name} keeps usable navigation when the API is unavailable`,
      async ({ page }, testInfo) => {
        await page.goto(screen.path);
        await expect(page).toHaveURL(new RegExp(screen.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
        // The navbar host has zero height because its inner <nav> is fixed.
        await expect(page.locator('app-navbar .site-nav')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.screenshot({
          path: `test-results/screen-audit/${testInfo.project.name}-offline-${screen.name}.png`,
          fullPage: true
        });
      });
  }
});

test('desktop administration keeps all operational metrics on a separate statistics page', async ({ page }) => {
  await isolateBackend(page, true);
  let overviewCalls = 0;
  await page.route('**/api/admin/overview', route => {
    overviewCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      registeredUsers: 5, enabledUsers: 5, registrationsLast7Days: 1,
      loginsLast15Minutes: 1, onlineUsers: 1, totalSessions: 3,
      upcomingSessions: 1, sessionsNext7Days: 1, completedSessions: 2,
      cancelledSessions: 0, communities: 2, tournaments: 0, activeTournaments: 0,
      venues: 228, openUserReports: 0, generatedAt: '2026-10-18T20:09:19Z'
    }) });
  });
  await page.route('**/api/admin/overview/trends', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      generatedAt: '2026-10-18T20:09:19Z', timezone: 'UTC',
      metric: 'CREATED_PER_WEEK', weeks: [
        {weekStart:'2026-09-28',users:2,sessions:0,communities:1},
        {weekStart:'2026-10-05',users:0,sessions:0,communities:0},
        {weekStart:'2026-10-12',users:1,sessions:3,communities:1}
      ]
    }) }));
  await page.goto('/menu/admin');
  await expect(page.getByRole('heading', { name: 'Centro de administração' })).toBeVisible();
  await expect(page.locator('.platform-overview')).toHaveCount(0);
  expect(overviewCalls).toBe(0);
  await page.locator('.admin-grid a[href="/menu/admin/statistics"]').click();
  await expect(page).toHaveURL(/\/menu\/admin\/statistics$/);
  await expect(page.getByRole('heading', { name: 'Estatísticas da Jynlo' })).toBeVisible();
  await expect(page.getByText('228', { exact: true })).toBeVisible();
  await expect(page.getByText('Evolução nas últimas 8 semanas')).toBeVisible();
  expect(overviewCalls).toBe(1);
});

test.describe('Jynlo administrator offline-screen audit', () => {
  test.beforeEach(async ({ page }) => {
    await isolateBackend(page, true);
  });

  const screens = [
    { path: '/menu/admin', name: 'dashboard' },
    { path: '/menu/admin/players', name: 'players' },
    { path: '/menu/admin/attendance-disputes', name: 'attendance-disputes' },
    { path: '/menu/admin/ideas', name: 'ideas' },
    { path: '/menu/admin/reports', name: 'reports' }
  ] as const;

  for (const screen of screens) {
    test(`admin ${screen.name} remains readable on API failure`,
      async ({ page }, testInfo) => {
        await page.goto(screen.path);
        await expect(page).toHaveURL(new RegExp(screen.path + '$'));
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.screenshot({
          path: `test-results/screen-audit/${testInfo.project.name}-admin-${screen.name}.png`,
          fullPage: true
        });
      });
  }
});

test('mobile signed-in navigation keeps Feed, Discover and the secondary Menu accessible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only navigation');
  await isolateBackend(page);
  await page.goto('/menu/feed');
  const nav = page.locator('app-navbar .site-nav');
  await expect(nav.locator('a.compact-feed-link')).toBeVisible();
  await expect(nav.locator('a[href="/menu/discover"].compact-primary')).toBeVisible();
  const menu = nav.locator('details.account-menu');
  await expect(menu.locator('summary')).toBeVisible();
  const right = await menu.locator('summary').evaluate(el => el.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);

  await menu.locator('summary').click();
  await expect(menu.locator('a[href="/menu/communities"]')).toBeVisible();
  await expect(menu.locator('a[href="/menu/friendList"]')).toBeVisible();
  await expect(menu.locator('a[href="/menu/notifications"]')).toBeVisible();
  await expect(menu.locator('a[href="/menu/createEvent"]')).toBeVisible();
});

test('desktop opens an explored community despite failure loading private memberships',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop discovery audit');
    await isolateBackend(page);
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 19, name: 'Desporto da Vila', description: 'Jogos abertos',
        sport: 'Futebol', sports: ['Futebol'], photoUrl: null, visibility: 'PUBLIC'
      })
    }));

    await page.goto('/menu/communities/19');
    await expect(page).toHaveURL(/\/menu\/communities\/19$/);
    await expect(page.locator('.community-detail-identity h2')).toHaveText('Desporto da Vila');
    await expect(page.locator('.community-detail-identity')).toContainText('Jogos abertos');
    await expect(page.getByRole('button', { name: /Aderir|Entrar/i }).first()).toBeVisible();
    await expect(page.locator('app-navbar .site-nav')).toBeVisible();
  });

test('desktop private-community join blocks duplicate requests until membership status is verified',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop community audit');
    await isolateBackend(page);
    let lookupRecovered = false;
    let requestsSubmitted = 0;
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 19, name: 'Grupo do Bairro', description: 'Comunidade privada',
        sport: 'Futebol', sports: ['Futebol'], photoUrl: null, visibility: 'PRIVATE'
      })
    }));
    await page.route('**/api/communities/19/join-requests/me', route => route.fulfill({
      status: lookupRecovered ? 200 : 503, contentType: 'application/json',
      body: JSON.stringify(lookupRecovered ? {
        id: 55, communityId: 19, communityName: 'Grupo do Bairro',
        requesterUsername: 'auditor-ficticio', status: 'PENDING',
        createdAt: '2026-10-18T12:00:00Z'
      } : { message: 'Temporary outage' })
    }));
    await page.route('**/api/communities/19/join-requests', route => {
      requestsSubmitted++;
      return route.fulfill({ status: 503, body: 'No real action executed' });
    });

    await page.goto('/menu/communities/19');
    await expect(page.locator('.community-detail-identity h2')).toHaveText('Grupo do Bairro');
    await expect(page.getByText('Não foi possível verificar se já tens um pedido pendente.')).toBeVisible();
    const requestButton = page.getByRole('button', { name: 'Pedir para aderir' });
    await expect(requestButton).toBeDisabled();
    expect(requestsSubmitted).toBe(0);

    lookupRecovered = true;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('button', { name: 'Pedido enviado' })).toBeDisabled();
    await expect(page.getByText('Pedido de adesão enviado.', { exact: false })).toBeVisible();
    expect(requestsSubmitted).toBe(0);
  });

test('desktop allows requesting a private-community join after 404 confirms no pending request',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop community audit');
    await isolateBackend(page);
    let submitted = 0;
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 19, name: 'Grupo do Bairro', description: null,
        sport: 'Futebol', sports: ['Futebol'], photoUrl: null, visibility: 'PRIVATE'
      })
    }));
    await page.route('**/api/communities/19/join-requests/me', route =>
      route.fulfill({ status: 404, body: '' }));
    await page.route('**/api/communities/19/join-requests', route => {
      submitted++;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 56, communityId: 19, communityName: 'Grupo do Bairro',
          requesterUsername: 'auditor-ficticio', status: 'PENDING',
          createdAt: '2026-10-18T12:00:00Z'
        })
      });
    });

    await page.goto('/menu/communities/19');
    const requestButton = page.getByRole('button', { name: 'Pedir para aderir' });
    await expect(requestButton).toBeEnabled();
    expect(submitted).toBe(0);
    await requestButton.click();
    await expect(page.getByRole('button', { name: 'Pedido enviado' })).toBeDisabled();
    expect(submitted).toBe(1);
  });

test('desktop restores community search filters and page after detail and browser Back',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop community discovery');
    await isolateBackend(page);
    const observed: Array<{ name: string; sport: string; page: string }> = [];
    await page.route('**/api/communities/mine', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/communities/search**', route => {
      const params = new URL(route.request().url()).searchParams;
      observed.push({
        name: params.get('name') ?? '',
        sport: params.get('sport') ?? '',
        page: params.get('page') ?? ''
      });
      const resultPage = Number(params.get('page') ?? 0);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          page: resultPage, hasMore: resultPage === 0,
          communities: [{
            id: 19, name: resultPage === 0 ? 'Liga Inicial' : 'Liga Final',
            description: 'Jogos da comunidade', sport: 'Futebol',
            sports: ['Futebol'], visibility: 'PUBLIC', photoUrl: null
          }]
        })
      });
    });
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 19, name: 'Liga Final', description: 'Jogos da comunidade',
        sport: 'Futebol', sports: ['Futebol'], visibility: 'PUBLIC', photoUrl: null
      })
    }));

    await page.goto('/menu/communities');
    await page.locator('#community-search input[name="communitySearchName"]').fill('Liga');
    await page.locator('#community-search input[name="communitySearchSport"]').fill('Futebol');
    await page.locator('#community-search button[type="submit"]').click();
    await expect(page.locator('#community-search .community-card')).toContainText('Liga Inicial');
    await page.locator('#community-search nav button').last().click();
    await expect(page.locator('#community-search .community-card')).toContainText('Liga Final');
    await expect(page).toHaveURL(/search=1.*page=1/);

    await page.locator('#community-search .community-card').click();
    await expect(page.locator('.community-detail-identity h2')).toHaveText('Liga Final');
    await page.locator('.detail-page-toolbar button').click();
    await expect(page.locator('#community-search input[name="communitySearchName"]')).toHaveValue('Liga');
    await expect(page.locator('#community-search input[name="communitySearchSport"]')).toHaveValue('Futebol');
    await expect(page.locator('#community-search .community-card')).toContainText('Liga Final');
    await expect(page).toHaveURL(/search=1.*page=1/);

    await page.locator('#community-search .community-card').click();
    await expect(page.locator('.community-detail-identity h2')).toHaveText('Liga Final');
    await page.goBack();
    await expect(page.locator('#community-search .community-card')).toContainText('Liga Final');
    await expect(page.locator('#community-search input[name="communitySearchName"]')).toHaveValue('Liga');
    await expect(page.locator('#community-search input[name="communitySearchSport"]')).toHaveValue('Futebol');
    expect(observed.filter(x => x.name === 'Liga' && x.sport === 'Futebol' && x.page === '1').length)
      .toBeGreaterThanOrEqual(3);
  });

test('desktop accepts an invitation and opens the accepted community, not the previous one',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop invitation audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Desporto da Vila', description: 'Jogos do bairro',
      sport: 'Futebol', sports: ['Futebol'], photoUrl: null, visibility: 'PUBLIC',
      myRole: 'MEMBER', members: [], memberCount: 1, rankingsEnabled: false,
      individualTournamentsEnabled: false, teamTournamentsEnabled: false
    };
    let accepted = 0;
    await page.route('**/api/communities/mine', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/communities/invites/me', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 10, communityId: 19, communityName: group.name,
        invitedByUsername: 'organizador', createdAt: '2026-10-18T12:00:00Z' }])
    }));
    await page.route('**/api/communities/invites/10/accept', async route => {
      accepted++;
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(group) });
    });
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(group)
    }));

    await page.goto('/menu/communities?view=mine');
    await expect(page.locator('.invites-card .invite-row')).toHaveCount(1);
    await page.locator('.invites-card .invite-row')
      .getByRole('button', { name: 'Aceitar' }).click();
    await expect(page).toHaveURL(/\/menu\/communities\/19$/);
    await expect(page.locator('.community-detail-identity h2')).toHaveText(group.name);
    expect(accepted).toBe(1);
  });

test('desktop rejects an invitation without switching communities',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop invitation audit');
    await isolateBackend(page);
    let rejected = 0;
    await page.route('**/api/communities/mine', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/communities/invites/me', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 10, communityId: 19, communityName: 'Desporto da Vila',
        invitedByUsername: 'organizador', createdAt: '2026-10-18T12:00:00Z' }])
    }));
    await page.route('**/api/communities/invites/10/reject', route => {
      rejected++;
      return route.fulfill({ status: 204 });
    });

    await page.goto('/menu/communities?view=mine');
    await expect(page.locator('.invites-card .invite-row')).toHaveCount(1);
    await page.locator('.invites-card .invite-row')
      .getByRole('button', { name: 'Rejeitar' }).click();
    await expect(page.locator('.invites-card .invite-row')).toHaveCount(0);
    await expect(page).toHaveURL(/\/menu\/communities\?view=mine$/);
    expect(rejected).toBe(1);
  });

test('desktop resolves an ambiguous accepted invite via membership verification without another POST',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop invitation audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Comunidade Confirmada', description: 'Jogos abertos',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PUBLIC', photoUrl: null,
      myRole: 'MEMBER', members: [], memberCount: 1, rankingsEnabled: false
    };
    let invitesRead = 0;
    let membershipRead = 0;
    let submitted = 0;
    await page.route('**/api/communities/invites/me', route => {
      invitesRead++;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(invitesRead === 1 ? [{
          id: 10, communityId: 19, communityName: group.name,
          invitedByUsername: 'organizador', createdAt: '2026-10-18T12:00:00Z'
        }] : [])
      });
    });
    await page.route('**/api/communities/mine', route => {
      membershipRead++;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(membershipRead === 1 ? [] : [group])
      });
    });
    await page.route('**/api/communities/invites/10/accept', route => {
      submitted++;
      return route.fulfill({ status: 504, contentType: 'application/json',
        body: '{"message":"Gateway timeout"}' });
    });
    await page.route('**/api/communities/19/presentation', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(group)
    }));
    // Confirmed members load their full community through GET /19, not the
    // public presentation endpoint. Mock both to test the actual route switch.
    await page.route('**/api/communities/19', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(group)
    }));

    await page.goto('/menu/communities?view=mine');
    await expect(page.locator('.invites-card .invite-row')).toHaveCount(1);
    await page.locator('.invites-card .invite-row').getByRole('button', { name: 'Aceitar' }).click();
    await expect(page).toHaveURL(/\/menu\/communities\/19$/);
    await expect(page.locator('.community-detail-identity h2')).toHaveText(group.name);
    expect(submitted).toBe(1);
    expect(invitesRead).toBeGreaterThanOrEqual(2);
    expect(membershipRead).toBeGreaterThanOrEqual(2);
  });

test('desktop blocks a repeated reject until pending invitations can be verified',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop invitation audit');
    await isolateBackend(page);
    const invite = {
      id: 10, communityId: 19, communityName: 'Grupo Pendente',
      invitedByUsername: 'organizador', createdAt: '2026-10-18T12:00:00Z'
    };
    let inviteReads = 0;
    let verificationRecovered = false;
    let submitted = 0;
    await page.route('**/api/communities/invites/me', route => {
      inviteReads++;
      return route.fulfill({
        status: inviteReads === 1 || verificationRecovered ? 200 : 503,
        contentType: 'application/json',
        body: JSON.stringify(inviteReads === 1 || verificationRecovered ? [invite] : {
          message: 'Membership check unavailable'
        })
      });
    });
    await page.route('**/api/communities/mine', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/communities/invites/10/reject', route => {
      submitted++;
      return route.fulfill({ status: 503, body: 'Unknown outcome' });
    });

    await page.goto('/menu/communities?view=mine');
    await expect(page.locator('.invites-card .invite-row')).toHaveCount(1);
    await page.locator('.invites-card .invite-row').getByRole('button', { name: 'Rejeitar' }).click();
    await expect(page.getByText('Não foi possível confirmar o resultado.', { exact: false })).toBeVisible();
    await expect(page.locator('.invites-card .invite-row').getByRole('button', { name: 'Rejeitar' }))
      .toBeDisabled();
    expect(submitted).toBe(1);

    verificationRecovered = true;
    await page.locator('.invites-card').getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByText('O convite continua pendente.', { exact: false })).toBeVisible();
    await expect(page.locator('.invites-card .invite-row').getByRole('button', { name: 'Rejeitar' }))
      .toBeEnabled();
    expect(submitted).toBe(1);
  });

test('desktop member removal requires confirmation and cannot be dispatched twice',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop member-management audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Grupo da Vila', description: 'Jogos de futebol',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PRIVATE', photoUrl: null,
      myRole: 'OWNER', ownerUsername: 'dona', rankingsEnabled: false,
      memberCount: 2, createdAt: '2026-10-18T12:00:00Z',
      members: [
        { profileId: 1, username: 'dona', fullName: 'Dona',
          profilePicUrl: null, role: 'OWNER' },
        { profileId: 2, username: 'joao', fullName: 'João',
          profilePicUrl: null, role: 'MEMBER' }
      ]
    };
    let removals = 0;
    await page.route('**/api/communities/mine', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([group])
    }));
    await page.route('**/api/communities/19', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(group)
    }));
    await page.route('**/api/communities/19/members/joao', route => {
      if (route.request().method() === 'DELETE') {
        removals++;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ status: 405 });
    });

    await page.goto('/menu/communities/19');
    await page.locator('.community-tabs').getByRole('button', { name: 'Membros' }).click();
    const row = page.locator('.member-row').filter({ hasText: '@joao' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Remover', exact: true }).click();
    await expect(row.getByText('Remover este membro da comunidade?')).toBeVisible();
    expect(removals).toBe(0);

    await row.getByRole('button', { name: 'Cancelar' }).click();
    await expect(row.getByRole('button', { name: 'Remover', exact: true })).toBeVisible();
    expect(removals).toBe(0);

    await row.getByRole('button', { name: 'Remover', exact: true }).click();
    await row.getByRole('button', { name: 'Confirmar remoção' }).click();
    await expect(row).toHaveCount(0);
    expect(removals).toBe(1);
    await expect(page.locator('.members-block .count-pill')).toContainText('1');
  });

test('desktop administrator cannot change member roles or expel another administrator',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop member-management audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Grupo da Vila', description: 'Jogos',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PRIVATE', photoUrl: null,
      myRole: 'ADMIN', ownerUsername: 'dona', rankingsEnabled: false,
      memberCount: 3, createdAt: '2026-10-18T12:00:00Z',
      members: [
        { profileId: 1, username: 'dona', fullName: 'Dona',
          profilePicUrl: null, role: 'OWNER' },
        { profileId: 2, username: 'ana', fullName: 'Ana',
          profilePicUrl: null, role: 'ADMIN' },
        { profileId: 3, username: 'joao', fullName: 'João',
          profilePicUrl: null, role: 'MEMBER' }
      ]
    };
    let mutations = 0;
    await page.route('**/api/communities/mine', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([group])
    }));
    await page.route('**/api/communities/19', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(group)
    }));
    await page.route('**/api/communities/19/members/**', route => {
      mutations++;
      return route.fulfill({ status: 403 });
    });

    await page.goto('/menu/communities/19');
    await page.locator('.community-tabs').getByRole('button', { name: 'Membros' }).click();
    const adminRow = page.locator('.member-row').filter({ hasText: '@ana' });
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByRole('button')).toHaveCount(0);
    const ownerRow = page.locator('.member-row').filter({ hasText: '@dona' });
    await expect(ownerRow.getByRole('button')).toHaveCount(0);
    const memberRow = page.locator('.member-row').filter({ hasText: '@joao' });
    await expect(memberRow.getByRole('button', { name: 'Remover', exact: true })).toBeVisible();
    await expect(memberRow.getByRole('button', { name: 'Tornar admin' })).toHaveCount(0);
    expect(mutations).toBe(0);
  });

test('desktop confirms a timed-out removal through GET without repeating DELETE',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop member-management audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Grupo da Vila', description: 'Jogos',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PRIVATE', photoUrl: null,
      myRole: 'OWNER', ownerUsername: 'dona', rankingsEnabled: false,
      memberCount: 2, createdAt: '2026-10-18T12:00:00Z',
      members: [
        { profileId: 1, username: 'dona', fullName: 'Dona',
          profilePicUrl: null, role: 'OWNER' },
        { profileId: 2, username: 'joao', fullName: 'João',
          profilePicUrl: null, role: 'MEMBER' }
      ]
    };
    let reads = 0;
    let deletions = 0;
    await page.route('**/api/communities/mine', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([group])
    }));
    await page.route('**/api/communities/19', route => {
      reads++;
      const current = reads === 1 ? group : {
        ...group, memberCount: 1,
        members: group.members.filter(member => member.username !== 'joao')
      };
      return route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(current)
      });
    });
    await page.route('**/api/communities/19/members/joao', route => {
      deletions++;
      return route.fulfill({ status: 504, contentType: 'application/json',
        body: '{"message":"Gateway timeout after removal"}' });
    });

    await page.goto('/menu/communities/19');
    await page.locator('.community-tabs').getByRole('button', { name: 'Membros' }).click();
    const memberRow = page.locator('.member-row').filter({ hasText: '@joao' });
    await memberRow.getByRole('button', { name: 'Remover', exact: true }).click();
    await memberRow.getByRole('button', { name: 'Confirmar remoção' }).click();

    await expect(memberRow).toHaveCount(0);
    await expect(page.locator('.members-block .count-pill')).toContainText('1');
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(deletions).toBe(1);
  });

test('desktop blocks another removal when the verification GET fails, then offers GET retry',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop member-management audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Grupo da Vila', description: 'Jogos',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PRIVATE', photoUrl: null,
      myRole: 'OWNER', ownerUsername: 'dona', rankingsEnabled: false,
      memberCount: 2, createdAt: '2026-10-18T12:00:00Z',
      members: [
        { profileId: 1, username: 'dona', fullName: 'Dona',
          profilePicUrl: null, role: 'OWNER' },
        { profileId: 2, username: 'joao', fullName: 'João',
          profilePicUrl: null, role: 'MEMBER' }
      ]
    };
    let reads = 0;
    let deletions = 0;
    await page.route('**/api/communities/mine', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([group])
    }));
    await page.route('**/api/communities/19', route => {
      reads++;
      return route.fulfill({
        status: reads === 2 ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(reads === 2 ? { message: 'Unavailable' } : group)
      });
    });
    await page.route('**/api/communities/19/members/joao', route => {
      deletions++;
      return route.fulfill({ status: 503, body: 'Unknown outcome' });
    });

    await page.goto('/menu/communities/19');
    await page.locator('.community-tabs').getByRole('button', { name: 'Membros' }).click();
    const memberRow = page.locator('.member-row').filter({ hasText: '@joao' });
    await memberRow.getByRole('button', { name: 'Remover', exact: true }).click();
    await memberRow.getByRole('button', { name: 'Confirmar remoção' }).click();

    await expect(memberRow.getByText('Não foi possível confirmar a remoção.', { exact: false }))
      .toBeVisible();
    await expect(memberRow.getByRole('button', { name: 'Confirmar remoção' })).toBeDisabled();
    expect(deletions).toBe(1);

    await memberRow.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(memberRow.getByText('O membro continua na comunidade.', { exact: false }))
      .toBeVisible();
    await expect(memberRow.getByRole('button', { name: 'Confirmar remoção' })).toBeEnabled();
    expect(deletions).toBe(1);
    expect(reads).toBeGreaterThanOrEqual(3);
  });

test('desktop ownership transfer requires a member selection and explicit confirmation',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop ownership audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Grupo da Vila', description: 'Jogos',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PRIVATE', photoUrl: null,
      myRole: 'OWNER', ownerUsername: 'dona', rankingsEnabled: false,
      memberCount: 2, createdAt: '2026-10-18T12:00:00Z',
      members: [
        { profileId: 1, username: 'dona', fullName: 'Dona', profilePicUrl: null, role: 'OWNER' },
        { profileId: 2, username: 'ana', fullName: 'Ana', profilePicUrl: null, role: 'MEMBER' }
      ]
    };
    const updated = {
      ...group, ownerUsername: 'ana', myRole: 'ADMIN',
      members: [
        { ...group.members[0], role: 'ADMIN' },
        { ...group.members[1], role: 'OWNER' }
      ]
    };
    let transfers = 0;
    await page.route('**/api/communities/mine', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([group])
    }));
    await page.route('**/api/communities/19', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(group)
    }));
    await page.route('**/api/communities/19/owner', route => {
      transfers++;
      return route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(updated)
      });
    });
    await page.goto('/menu/communities/19');
    await page.locator('.community-tabs').getByRole('button', { name: 'Membros' }).click();

    const transfer = page.locator('.management-block').filter({ hasText: 'Transferir propriedade' });
    await expect(transfer).toBeVisible();
    await expect(transfer.locator('select')).toHaveValue('');
    await expect(transfer.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await transfer.locator('select').selectOption('ana');
    await transfer.getByRole('button', { name: 'Continuar' }).click();
    await expect(transfer.getByText('Confirmar transferência de propriedade')).toBeVisible();
    await expect(transfer.locator('.ownership-transfer-confirmation'))
      .toContainText('Passarás a administrador.');
    expect(transfers).toBe(0);

    await transfer.getByRole('button', { name: 'Cancelar' }).click();
    expect(transfers).toBe(0);
    await transfer.getByRole('button', { name: 'Continuar' }).click();
    await transfer.getByRole('button', { name: 'Confirmar transferência' }).click();

    await expect(transfer).toHaveCount(0);
    await expect(page.getByText('A propriedade foi transferida com sucesso.')).toBeVisible();
    expect(transfers).toBe(1);
  });

test('desktop ownership transfer checks the current owner after timeout before allowing another action',
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop ownership audit');
    await isolateBackend(page);
    const group = {
      id: 19, name: 'Grupo da Vila', description: 'Jogos',
      sport: 'Futebol', sports: ['Futebol'], visibility: 'PRIVATE', photoUrl: null,
      myRole: 'OWNER', ownerUsername: 'dona', rankingsEnabled: false,
      memberCount: 2, createdAt: '2026-10-18T12:00:00Z',
      members: [
        { profileId: 1, username: 'dona', fullName: 'Dona', profilePicUrl: null, role: 'OWNER' },
        { profileId: 2, username: 'ana', fullName: 'Ana', profilePicUrl: null, role: 'MEMBER' }
      ]
    };
    const updated = {
      ...group, myRole: 'ADMIN', ownerUsername: 'ana',
      members: [
        { ...group.members[0], role: 'ADMIN' },
        { ...group.members[1], role: 'OWNER' }
      ]
    };
    let reads = 0;
    let transfers = 0;
    await page.route('**/api/communities/mine', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([group])
    }));
    await page.route('**/api/communities/19', route => {
      reads++;
      return route.fulfill({
        status: reads === 2 ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(reads >= 3 ? updated : group)
      });
    });
    await page.route('**/api/communities/19/owner', route => {
      transfers++;
      return route.fulfill({ status: 504, contentType: 'application/json',
        body: '{"message":"Gateway timeout after transfer"}' });
    });
    await page.goto('/menu/communities/19');
    await page.locator('.community-tabs').getByRole('button', { name: 'Membros' }).click();
    const transfer = page.locator('.management-block').filter({ hasText: 'Transferir propriedade' });
    await transfer.locator('select').selectOption('ana');
    await transfer.getByRole('button', { name: 'Continuar' }).click();
    await transfer.getByRole('button', { name: 'Confirmar transferência' }).click();

    await expect(transfer.getByText('Não foi possível confirmar a transferência.', { exact: false }))
      .toBeVisible();
    await expect(transfer.getByRole('button', { name: 'Confirmar transferência' })).toBeDisabled();
    expect(transfers).toBe(1);

    await transfer.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(transfer).toHaveCount(0);
    await expect(page.getByText('A propriedade foi transferida com sucesso.')).toBeVisible();
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(transfers).toBe(1);
  });
