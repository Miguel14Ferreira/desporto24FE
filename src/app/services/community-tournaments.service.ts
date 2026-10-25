import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';
import { HistoricalMatchArchive } from './community-groups.service';
import {
  CommunityTournament,
  TournamentPointRules,
  TeamTieBreakPriority,
  TournamentMatch,
  TournamentMatchPage,
  TournamentPage,
  TournamentParticipant,
  TournamentParticipantPage,
  TournamentScheduleSummary,
  TournamentStandings, TournamentTeam, TournamentTeamMatchPage, TournamentTeamMatch,
  TournamentTeamScheduleSummary, TournamentTeamStandings, TournamentTeamGroups, TournamentRaceOverview, InlineSpeedOverview, InlineSpeedTieEvidenceType, InlineSpeedTrialRequest
} from '../pages/model/community-tournament';

/** Community result-by-position formats verified end to end. */
export type RaceChampionshipSport = 'Karting' | 'BMX' | 'Ciclismo' | 'Mountain Bike' | 'Ciclocrosse' | 'Ciclismo de Estrada' | 'Ciclismo de Pista';

export const RACE_CHAMPIONSHIP_SPORTS: readonly RaceChampionshipSport[] =
  ['Karting', 'BMX', 'Ciclismo', 'Mountain Bike', 'Ciclocrosse', 'Ciclismo de Estrada', 'Ciclismo de Pista'];

export function isRaceChampionshipSport(value: string): value is RaceChampionshipSport {
  return RACE_CHAMPIONSHIP_SPORTS.some(sport => sport === value);
}

@Injectable({ providedIn: 'root' })
export class CommunityTournamentsService {
  private readonly baseUrl = environment.apiUrl + '/api/communities';

  constructor(private readonly http: HttpClient) {}

  private url(communityId: number, tournamentId?: number): string {
    const base = this.baseUrl + '/' + communityId + '/tournaments';
    return tournamentId == null ? base : base + '/' + tournamentId;
  }

  historicalArchive(communityId: number, archiveId: number): Observable<HistoricalMatchArchive> {
    return this.http.get<HistoricalMatchArchive>(
      this.baseUrl + '/' + communityId + '/competition/match-archives/' + archiveId);
  }

  list(communityId: number, page: number): Observable<TournamentPage> {
    return this.http.get<TournamentPage>(this.url(communityId), {
      params: new HttpParams().set('page', String(page))
    });
  }

  create(communityId: number, name: string, sport: string,
         rules: TournamentPointRules = { winPoints: 3, drawPoints: 1, lossPoints: 0 },
         scoringMode?: 'CHESS_HALF_POINTS'): Observable<CommunityTournament> {
    const body = scoringMode ? { name, sport, ...rules, scoringMode } : { name, sport, ...rules };
    return this.http.post<CommunityTournament>(this.url(communityId), body);
  }


  /** Uses the generic rounds-based classification; not federation rulebooks. */
  createRaceChampionship(communityId: number, name: string,
                         sport: RaceChampionshipSport): Observable<CommunityTournament> {
    return this.http.post<CommunityTournament>(this.url(communityId), {
      name, sport, entryType: 'INDIVIDUAL', format: 'LEAGUE',
      scoringMode: 'RACE_POINTS'
    });
  }

  raceOverview(communityId: number, tournamentId: number): Observable<TournamentRaceOverview> {
    return this.http.get<TournamentRaceOverview>(this.url(communityId, tournamentId) + '/races');
  }

  setRacePoints(communityId: number, tournamentId: number,
                pointsByPlace: string): Observable<TournamentRaceOverview> {
    return this.http.put<TournamentRaceOverview>(
      this.url(communityId, tournamentId) + '/races/points', { pointsByPlace });
  }

  linkRace(communityId: number, tournamentId: number, roundId: number): Observable<TournamentRaceOverview> {
    return this.http.put<TournamentRaceOverview>(
      this.url(communityId, tournamentId) + '/races/' + roundId, {});
  }

  completeRaceChampionship(communityId: number, tournamentId: number): Observable<CommunityTournament> {
    return this.http.post<CommunityTournament>(
      this.url(communityId, tournamentId) + '/races/complete', {});
  }

  unlinkRace(communityId: number, tournamentId: number, roundId: number): Observable<TournamentRaceOverview> {
    return this.http.delete<TournamentRaceOverview>(
      this.url(communityId, tournamentId) + '/races/' + roundId);
  }


  /** Only explicitly linked Patinagem de Velocidade results; never generic race points. */
  inlineSpeedOverview(communityId: number, tournamentId: number): Observable<InlineSpeedOverview> {
    return this.http.get<InlineSpeedOverview>(
      this.url(communityId, tournamentId) + '/inline-speed');
  }

  linkInlineSpeedHeat(communityId: number, tournamentId: number, roundId: number,
                      heatNumber: number): Observable<InlineSpeedOverview> {
    return this.http.put<InlineSpeedOverview>(
      this.url(communityId, tournamentId) + '/inline-speed/heats/' + roundId,
      {}, { params: { heatNumber: String(heatNumber) } });
  }

  unlinkInlineSpeedHeat(communityId: number, tournamentId: number,
                        roundId: number): Observable<InlineSpeedOverview> {
    return this.http.delete<InlineSpeedOverview>(
      this.url(communityId, tournamentId) + '/inline-speed/heats/' + roundId);
  }

  confirmInlineSpeedQualification(communityId: number, tournamentId: number,
      sourceStage: 'FIRST' | 'QUARTER' | 'SEMI', playerIds: number[],
      reason: string): Observable<InlineSpeedOverview> {
    return this.http.put<InlineSpeedOverview>(
      this.url(communityId, tournamentId) + '/inline-speed/qualifications/' + sourceStage,
      { playerIds, reason });
  }

  /** Record a real jury ruling without fabricating source race times. */
  resolveInlineSpeedTieBreak(communityId: number, tournamentId: number,
                            playerIds: number[], reason: string,
                            evidenceType: InlineSpeedTieEvidenceType,
                            evidenceReference: string,
                            trialIds: number[] = [],
                            trialOrderExceptionReason: string = ''): Observable<InlineSpeedOverview> {
    return this.http.put<InlineSpeedOverview>(
      this.url(communityId, tournamentId) + '/inline-speed/tiebreaks/FIRST',
      { playerIds, reason, evidenceType, evidenceReference, trialIds, trialOrderExceptionReason });
  }

  /** Append-only real trial results; requires separate jury qualification approval. */
  recordInlineSpeedTrial(communityId: number, tournamentId: number,
                          request: InlineSpeedTrialRequest): Observable<InlineSpeedOverview> {
    return this.http.post<InlineSpeedOverview>(
      this.url(communityId, tournamentId) + '/inline-speed/tiebreaks/FIRST/trials',
      request);
  }

  /** Team tournaments have their own draft, roster and match lifecycle. */
  createTeamTournament(communityId: number, name: string, sport: string,
                       playersPerTeam: number | null, roundRobinLegs: 1 | 2 = 1,
                       rules: TournamentPointRules = { winPoints: 3, drawPoints: 1, lossPoints: 0 },
                       teamTieBreakPriority: TeamTieBreakPriority = 'GOAL_DIFFERENCE_FIRST',
                       format: 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT' = 'LEAGUE',
                       groupCount: 2 | 4 = 2
  ): Observable<CommunityTournament> {
    const config = format === 'KNOCKOUT'
      ? { name, sport, entryType: 'TEAM', playersPerTeam, format }
      : format === 'GROUP_KNOCKOUT'
        ? { name, sport, entryType: 'TEAM', playersPerTeam, format, groupCount,
            teamTieBreakPriority, ...rules }
        : { name, sport, entryType: 'TEAM', playersPerTeam, format,
            roundRobinLegs, teamTieBreakPriority, ...rules };
    return this.http.post<CommunityTournament>(this.url(communityId), config);
  }

  details(communityId: number, tournamentId: number): Observable<CommunityTournament> {
    return this.http.get<CommunityTournament>(this.url(communityId, tournamentId));
  }

  acceptTeamInvite(communityId: number, tournamentId: number, teamId: number): Observable<TournamentTeam> {
    return this.http.put<TournamentTeam>(
      this.url(communityId, tournamentId) + '/teams/' + teamId + '/players/me', null);
  }

  teams(communityId: number, tournamentId: number): Observable<TournamentTeam[]> {
    return this.http.get<TournamentTeam[]>(this.url(communityId, tournamentId) + '/teams');
  }

  createTeam(communityId: number, tournamentId: number, name: string): Observable<TournamentTeam> {
    return this.http.post<TournamentTeam>(this.url(communityId, tournamentId) + '/teams', { name });
  }

  addTeamPlayer(communityId: number, tournamentId: number, teamId: number,
                profileId: number): Observable<TournamentTeam> {
    return this.http.post<TournamentTeam>(
      this.url(communityId, tournamentId) + '/teams/' + teamId + '/players', { profileId });
  }

  removeTeamPlayer(communityId: number, tournamentId: number, teamId: number,
                   profileId: number): Observable<void> {
    return this.http.delete<void>(
      this.url(communityId, tournamentId) + '/teams/' + teamId + '/players/' + profileId);
  }

  generateTeamSchedule(communityId: number, tournamentId: number): Observable<TournamentTeamScheduleSummary> {
    return this.http.post<TournamentTeamScheduleSummary>(
      this.url(communityId, tournamentId) + '/teams/schedule', null);
  }

  teamMatches(communityId: number, tournamentId: number, page: number): Observable<TournamentTeamMatchPage> {
    return this.http.get<TournamentTeamMatchPage>(
      this.url(communityId, tournamentId) + '/teams/matches', {
        params: new HttpParams().set('page', String(page))
      });
  }


  recordTeamResult(communityId: number, tournamentId: number, matchId: number,
                   homeScore: number, awayScore: number): Observable<TournamentTeamMatch> {
    return this.http.post<TournamentTeamMatch>(
      this.url(communityId, tournamentId) + '/teams/matches/' + matchId + '/result',
      { homeScore, awayScore });
  }

  teamStandings(communityId: number, tournamentId: number): Observable<TournamentTeamStandings> {
    return this.http.get<TournamentTeamStandings>(
      this.url(communityId, tournamentId) + '/teams/standings');
  }

  teamGroups(communityId: number, tournamentId: number): Observable<TournamentTeamGroups> {
    return this.http.get<TournamentTeamGroups>(this.url(communityId, tournamentId) + '/teams/groups');
  }

  completeTeam(communityId: number, tournamentId: number): Observable<CommunityTournament> {
    return this.http.post<CommunityTournament>(
      this.url(communityId, tournamentId) + '/teams/complete', null);
  }

  deleteTeam(communityId: number, tournamentId: number, teamId: number): Observable<void> {
    return this.http.delete<void>(this.url(communityId, tournamentId) + '/teams/' + teamId);
  }

  delete(communityId: number, tournamentId: number): Observable<void> {
    return this.http.delete<void>(this.url(communityId, tournamentId));
  }

  participants(communityId: number, tournamentId: number, page: number): Observable<TournamentParticipantPage> {
    return this.http.get<TournamentParticipantPage>(this.url(communityId, tournamentId) + '/participants', {
      params: { page: String(page) }
    });
  }

  join(communityId: number, tournamentId: number): Observable<TournamentParticipant> {
    return this.http.put<TournamentParticipant>(this.url(communityId, tournamentId) + '/participants/me', null);
  }

  leave(communityId: number, tournamentId: number): Observable<void> {
    return this.http.delete<void>(this.url(communityId, tournamentId) + '/participants/me');
  }

  confirm(communityId: number, tournamentId: number, profileId: number): Observable<TournamentParticipant> {
    return this.http.put<TournamentParticipant>(
      this.url(communityId, tournamentId) + '/participants/' + profileId + '/confirm', null
    );
  }

  removeParticipant(communityId: number, tournamentId: number, profileId: number): Observable<void> {
    return this.http.delete<void>(
      this.url(communityId, tournamentId) + '/participants/' + profileId
    );
  }

  generateSchedule(communityId: number, tournamentId: number): Observable<TournamentScheduleSummary> {
    return this.http.post<TournamentScheduleSummary>(this.url(communityId, tournamentId) + '/schedule', null);
  }

  matches(communityId: number, tournamentId: number, page: number): Observable<TournamentMatchPage> {
    return this.http.get<TournamentMatchPage>(this.url(communityId, tournamentId) + '/matches', {
      params: { page: String(page) }
    });
  }

  recordResult(communityId: number, tournamentId: number, matchId: number,
               homeScore: number, awayScore: number): Observable<TournamentMatch> {
    return this.http.put<TournamentMatch>(
      this.url(communityId, tournamentId) + '/matches/' + matchId + '/result',
      { homeScore, awayScore }
    );
  }

  standings(communityId: number, tournamentId: number): Observable<TournamentStandings> {
    return this.http.get<TournamentStandings>(this.url(communityId, tournamentId) + '/standings');
  }

  complete(communityId: number, tournamentId: number): Observable<CommunityTournament> {
    return this.http.post<CommunityTournament>(this.url(communityId, tournamentId) + '/complete', null);
  }
}
