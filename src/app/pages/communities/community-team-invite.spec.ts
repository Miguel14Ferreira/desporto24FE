import { buildTournamentTeamInviteUrl, teamInvitationWhatsAppUrl } from './community-team-invite';

describe('Tournament team WhatsApp and link invites', () => {
  it('targets the exact community, tournament and team on the current domain', () => {
    const url = buildTournamentTeamInviteUrl('https://d24sports.com', 7, 19, 40);
    expect(url).toBe('https://d24sports.com/menu/communities/7?tab=tournaments&tournament=19&team=40');
    expect(buildTournamentTeamInviteUrl('https://preview.example:4200', 7, 19, 40))
      .toContain('https://preview.example:4200/menu/communities/7?');
  });

  it('never puts users or private profile data in the shared URL', () => {
    const url = buildTournamentTeamInviteUrl('https://d24sports.com', 7, 19, 40);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('team')).toBe('40');
    expect(parsed.searchParams.has('username')).toBeFalse();
    expect(parsed.searchParams.has('token')).toBeFalse();
  });

  it('rejects invalid or unsafe identifiers', () => {
    for (const id of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => buildTournamentTeamInviteUrl('https://d24sports.com', 7, 19, id)).toThrow();
    }
  });

  it('shares the team name and a valid link via WhatsApp with UTF-8 encoding', () => {
    const url = buildTournamentTeamInviteUrl('https://d24sports.com', 7, 19, 40);
    const share = teamInvitationWhatsAppUrl('Amigos ⚽', 'Taça de Férias', 'Os Verdes', url);
    expect(share.startsWith('https://wa.me/?text=')).toBeTrue();
    expect(new URL(share).searchParams.get('text')).toContain('Os Verdes');
    expect(new URL(share).searchParams.get('text')).toContain(url);
    expect(new URL(share).searchParams.get('text')).toContain('adere à comunidade');
  });
});
