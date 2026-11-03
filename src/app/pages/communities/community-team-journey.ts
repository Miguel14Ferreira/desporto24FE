import { CommunityTournament, TournamentTeamMatch } from '../model/community-tournament';

type TeamFormat = CommunityTournament['format'];
export type TeamJourneyOutcome = 'WIN' | 'DRAW' | 'LOSS';

export interface TeamJourneyMatch {
  fixture: TournamentTeamMatch;
  opponentName: string;
  ownScore: number | null;
  opponentScore: number | null;
  outcome: TeamJourneyOutcome | null;
}
export interface RecordedTeamJourneyMatch extends TeamJourneyMatch {
  ownScore: number;
  opponentScore: number;
  outcome: TeamJourneyOutcome;
}
export interface TeamVerifiedAdvancement {
  previousFixture: TournamentTeamMatch;
  nextFixture: TournamentTeamMatch;
  opponentName: string;
}
export interface PublishedTeamJourney {
  recent: RecordedTeamJourneyMatch[];
  pending: TeamJourneyMatch[];
  advancement: TeamVerifiedAdvancement | null;
}

/** The match contract has no dates. Published round order never implies a start time.
 * No completed score or hypothetical bye alone can confirm knockout progression. */
export function summarizePublishedTeamJourney(
  published: readonly TournamentTeamMatch[], teamId: number, format: TeamFormat
): PublishedTeamJourney {
  const byId = new Map<number, TournamentTeamMatch>();
  for (const game of published) {
    if ((game.homeTeamId === teamId || game.awayTeamId === teamId) && !byId.has(game.id))
      byId.set(game.id, game);
  }
  const fixtures = [...byId.values()];
  const knockout = format !== 'LEAGUE';
  const elimination = (game: TournamentTeamMatch) =>
    knockout && (format === 'KNOCKOUT' || game.groupNumber == null);
  const order = (a: TournamentTeamMatch, b: TournamentTeamMatch): number => {
    const groupA = format === 'GROUP_KNOCKOUT' && a.groupNumber != null ? 0 : 1;
    const groupB = format === 'GROUP_KNOCKOUT' && b.groupNumber != null ? 0 : 1;
    return groupA - groupB || a.roundNumber - b.roundNumber || a.id - b.id;
  };
  const view = (game: TournamentTeamMatch): TeamJourneyMatch => {
    const atHome = game.homeTeamId === teamId;
    const valid = game.status === 'COMPLETED'
      && typeof game.homeScore === 'number' && typeof game.awayScore === 'number'
      && Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore)
      && game.homeScore >= 0 && game.awayScore >= 0;
    const ownScore = valid ? (atHome ? game.homeScore! : game.awayScore!) : null;
    const opponentScore = valid ? (atHome ? game.awayScore! : game.homeScore!) : null;
    const outcome: TeamJourneyOutcome | null = ownScore === null || opponentScore === null
      ? null : ownScore > opponentScore ? 'WIN'
        : ownScore < opponentScore ? 'LOSS' : 'DRAW';
    return {
      fixture: game, opponentName: atHome ? game.awayTeamName : game.homeTeamName,
      ownScore, opponentScore, outcome
    };
  };
  const recorded = fixtures.filter(game => game.status === 'COMPLETED')
    .map(view).filter((item): item is RecordedTeamJourneyMatch =>
      item.outcome !== null && item.ownScore !== null && item.opponentScore !== null);
  const recent = recorded.slice().sort((a,b)=>order(b.fixture,a.fixture)).slice(0,3);
  const pending = fixtures.filter(game=>game.status === 'SCHEDULED')
    .sort(order).slice(0,3).map(view);

  let advancement: TeamVerifiedAdvancement | null = null;
  if (knockout) {
    const won = recorded.filter(item => item.outcome === 'WIN' && elimination(item.fixture))
      .sort((a,b)=>order(b.fixture,a.fixture));
    for (const item of won) {
      const previous = item.fixture;
      // A second leg in the same round prevents claiming qualification.
      if (fixtures.filter(game => elimination(game)
        && game.roundNumber === previous.roundNumber).length !== 1) continue;
      const following = fixtures.filter(game => elimination(game)
        && game.roundNumber === previous.roundNumber + 1);
      if (following.length !== 1) continue;
      const nextFixture = following[0];
      advancement = {
        previousFixture: previous, nextFixture,
        opponentName: nextFixture.homeTeamId === teamId
          ? nextFixture.awayTeamName : nextFixture.homeTeamName
      };
      break;
    }
  }
  return { recent, pending, advancement };
}
