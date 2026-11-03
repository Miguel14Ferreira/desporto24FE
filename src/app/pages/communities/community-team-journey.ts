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
export interface TeamKnockoutPathStep extends TeamJourneyMatch {
  /** Only a unique, immediately subsequent published fixture verifies progression. */
  confirmedNextFixture: TournamentTeamMatch | null;
}
export interface TeamJourneyPhase {
  key: string;
  firstFixture: TournamentTeamMatch;
  published: number;
  recorded: number;
  wins: number;
  draws: number;
  losses: number;
}
export interface PublishedTeamJourney {
  recent: RecordedTeamJourneyMatch[];
  /** Up to five latest valid results by published round, not by a missing match date. */
  form: RecordedTeamJourneyMatch[];
  phases: TeamJourneyPhase[];
  pending: TeamJourneyMatch[];
  advancement: TeamVerifiedAdvancement | null;
  /** All loaded elimination matches, in published round order, without speculative byes. */
  knockoutPath: TeamKnockoutPathStep[];
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
  const form = recorded.slice().sort((a,b)=>order(b.fixture,a.fixture)).slice(0,5);
  const recent = form.slice(0,3);
  const phasesByKey = new Map<string, TeamJourneyPhase>();
  for (const game of fixtures.slice().sort(order)) {
    const key = format === 'GROUP_KNOCKOUT' && game.groupNumber != null
      ? `group-${game.groupNumber}` : `round-${game.roundNumber}`;
    let phase = phasesByKey.get(key);
    if (!phase) {
      phase = {key, firstFixture:game,published:0,recorded:0,wins:0,draws:0,losses:0};
      phasesByKey.set(key,phase);
    }
    phase.published++;
    const outcome = view(game).outcome;
    if (outcome) {
      phase.recorded++;
      if (outcome === 'WIN') phase.wins++;
      if (outcome === 'DRAW') phase.draws++;
      if (outcome === 'LOSS') phase.losses++;
    }
  }
  const phases = [...phasesByKey.values()];
  const pending = fixtures.filter(game=>game.status === 'SCHEDULED')
    .sort(order).slice(0,3).map(view);

  const eliminations = fixtures.filter(elimination).sort(order);
  const knockoutPath: TeamKnockoutPathStep[] = eliminations.map(game => {
    const item = view(game);
    const inSameRound = eliminations.filter(other => other.roundNumber === game.roundNumber);
    const inNextRound = eliminations.filter(other => other.roundNumber === game.roundNumber + 1);
    const confirmedNextFixture = item.outcome === 'WIN'
      && inSameRound.length === 1 && inNextRound.length === 1 ? inNextRound[0] : null;
    return { ...item, confirmedNextFixture };
  });
  const lastConfirmed = knockoutPath.slice().reverse()
    .find(item => item.confirmedNextFixture !== null);
  const advancement: TeamVerifiedAdvancement | null = lastConfirmed?.confirmedNextFixture
    ? {
      previousFixture: lastConfirmed.fixture,
      nextFixture: lastConfirmed.confirmedNextFixture,
      opponentName: lastConfirmed.confirmedNextFixture.homeTeamId === teamId
        ? lastConfirmed.confirmedNextFixture.awayTeamName
        : lastConfirmed.confirmedNextFixture.homeTeamName
    } : null;
  return { recent, form, phases, pending, advancement, knockoutPath };
}
