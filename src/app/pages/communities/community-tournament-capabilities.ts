import { formatForSport, CommunitySportFormat } from './community-round-sport';
import { tournamentClassificationProfile } from './community-tournament-classification';
import { isRaceChampionshipSport } from '../../services/community-tournaments.service';

/**
 * Existing tournament API capabilities, distinct from the 121 sport families.
 * A visual family is not proof of official competitive result support.
 */
export type TournamentCreationModel =
  | 'NUMERIC_INDIVIDUAL' | 'NUMERIC_TEAM'
  | 'RACE_POINTS' | 'INLINE_SPEED' | 'SWIM_BEST_TIME' | 'FIELD_BEST_MARK' | 'TRACK_BEST_TIME' | 'RELAY_BEST_TIME' | 'UNAVAILABLE';

export interface TournamentSportCapabilities {
  family: CommunitySportFormat | 'unknown';
  individual: TournamentCreationModel;
  team: TournamentCreationModel;
  /** No model here claims complete federation/discipline-specific scoring. */
  fullSportRulesImplemented: false;
}

export function tournamentSportCapabilities(sport: string | null | undefined): TournamentSportCapabilities {
  const family = formatForSport(sport);
  const profile = tournamentClassificationProfile(sport);
  let individual: TournamentCreationModel = 'UNAVAILABLE';
  let team: TournamentCreationModel = 'UNAVAILABLE';

  if (sport === 'Atletismo') {
    individual = 'FIELD_BEST_MARK';
    team = 'RELAY_BEST_TIME';
  } else if (sport === 'Natação') {
    individual = 'SWIM_BEST_TIME';
  } else if (sport === 'Patinagem de Velocidade') {
    individual = 'INLINE_SPEED';
  } else if (sport && isRaceChampionshipSport(sport)) {
    // Only the seven verified race-championship sports use this API.
    individual = 'RACE_POINTS';
  } else if (profile.isRoundRobinSupported) {
    individual = 'NUMERIC_INDIVIDUAL';
    if (profile.scoringMode !== 'CHESS_HALF_POINTS') team = 'NUMERIC_TEAM';
  }

  return { family, individual, team, fullSportRulesImplemented: false };
}
