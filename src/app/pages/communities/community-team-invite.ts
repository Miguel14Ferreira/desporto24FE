import { buildWhatsAppGroupShareUrl } from './community-group-invite';

/**
 * A shareable deep link, not an authorization token.
 * Only authenticated community members can accept a place, subject to roster limits.
 */
export function buildTournamentTeamInviteUrl(
  origin: string, communityId: number, tournamentId: number, teamId: number
): string {
  for (const id of [communityId, tournamentId, teamId]) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Invalid team invitation link');
    }
  }
  const url = new URL('/menu/communities/' + communityId, origin);
  url.searchParams.set('tab', 'tournaments');
  url.searchParams.set('tournament', String(tournamentId));
  url.searchParams.set('team', String(teamId));
  return url.toString();
}

export function teamInvitationWhatsAppUrl(
  communityName: string, tournamentName: string, teamName: string, url: string
): string {
  return buildWhatsAppGroupShareUrl(
    ['🏆 Convido-te para a equipa "' + teamName + '"',
      'Torneio: ' + tournamentName,
      'Comunidade: ' + communityName,
      'Abre o link para aceitares o convite. Se ainda não és membro, adere à comunidade primeiro.',
      url].join('\n')
  );
}
