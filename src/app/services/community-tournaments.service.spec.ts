import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { environment } from 'src/environment/environment';
import { CommunityTournamentsService } from './community-tournaments.service';

describe('CommunityTournamentsService API contract', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let service: CommunityTournamentsService;
  const base = environment.apiUrl + '/api/communities/7/tournaments/9';

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'put', 'delete']);
    http.get.and.returnValue(of({}));
    http.post.and.returnValue(of({}));
    http.put.and.returnValue(of({}));
    http.delete.and.returnValue(of(undefined));
    service = new CommunityTournamentsService(http);
  });

  it('requests tournaments with backend-supported pagination', () => {
    service.list(7, 2).subscribe();
    expect(http.get).toHaveBeenCalled();
    const [url, options] = http.get.calls.mostRecent().args;
    expect(url).toBe(environment.apiUrl + '/api/communities/7/tournaments');
    expect((options as any).params.get('page')).toBe('2');
  });

  it('sends competition points in both team and individual creation requests', () => {
    service.create(7, 'Liga Individual', 'Ténis', {
      winPoints: 2, drawPoints: 1, lossPoints: 0
    }).subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Liga Individual', sport: 'Ténis', winPoints: 2, drawPoints: 1, lossPoints: 0 });
    service.createTeamTournament(7, 'Liga Equipas', 'Futebol', 5, 2, {
      winPoints: 4, drawPoints: 2, lossPoints: 0
    }, 'WINS_FIRST').subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Liga Equipas', sport: 'Futebol', entryType: 'TEAM',
        playersPerTeam: 5, format: 'LEAGUE', roundRobinLegs: 2, teamTieBreakPriority: 'WINS_FIRST',
        winPoints: 4, drawPoints: 2, lossPoints: 0 });
  });

  it('creates group knockout with group count and independent sporting rules', () => {
    service.createTeamTournament(7, 'Taça com grupos', 'Futebol', 5, 1,
      { winPoints: 3, drawPoints: 1, lossPoints: 0 },
      'GOAL_DIFFERENCE_FIRST', 'GROUP_KNOCKOUT', 4).subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Taça com grupos', sport: 'Futebol', entryType: 'TEAM',
        playersPerTeam: 5, format: 'GROUP_KNOCKOUT', groupCount: 4,
        teamTieBreakPriority: 'GOAL_DIFFERENCE_FIRST',
        winPoints: 3, drawPoints: 1, lossPoints: 0 });
    service.teamGroups(7, 9).subscribe();
    expect(http.get).toHaveBeenCalledWith(base + '/teams/groups');
  });

  it('creates an individual Ciclocrosse series with race points, never football match rules', () => {
    service.createRaceChampionship(7, 'Taça de Ciclocrosse', 'Ciclocrosse').subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Taça de Ciclocrosse', sport: 'Ciclocrosse',
        entryType: 'INDIVIDUAL', format: 'LEAGUE', scoringMode: 'RACE_POINTS' });
  });

  it('creates road race championships with positions only, without time-trial rule mode', () => {
    service.createRaceChampionship(7, 'Taça estrada', 'Ciclismo de Estrada').subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Taça estrada', sport: 'Ciclismo de Estrada',
        entryType: 'INDIVIDUAL', format: 'LEAGUE', scoringMode: 'RACE_POINTS' });
  });

  it('creates track scratch-only position championship without time-trial scoring', () => {
    service.createRaceChampionship(7, 'Taça Scratch', 'Ciclismo de Pista').subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Taça Scratch', sport: 'Ciclismo de Pista',
        entryType: 'INDIVIDUAL', format: 'LEAGUE', scoringMode: 'RACE_POINTS' });
  });

  it('sends knockout format without league-only settings', () => {
    service.createTeamTournament(7, 'Taça', 'Futebol', 3, 2,
      { winPoints: 4, drawPoints: 1, lossPoints: 0 }, 'WINS_FIRST', 'KNOCKOUT').subscribe();
    expect(http.post).toHaveBeenCalledWith(
      environment.apiUrl + '/api/communities/7/tournaments',
      { name: 'Taça', sport: 'Futebol', entryType: 'TEAM',
        playersPerTeam: 3, format: 'KNOCKOUT' });
  });

  it('never supplies another user identity when requesting self-enrollment', () => {
    service.join(7, 9).subscribe();
    expect(http.put).toHaveBeenCalledWith(base + '/participants/me', null);
    service.leave(7, 9).subscribe();
    expect(http.delete).toHaveBeenCalledWith(base + '/participants/me');
  });

  it('uses authorized confirmation and schedule paths', () => {
    service.confirm(7, 9, 51).subscribe();
    expect(http.put).toHaveBeenCalledWith(base + '/participants/51/confirm', null);
    service.generateSchedule(7, 9).subscribe();
    expect(http.post).toHaveBeenCalledWith(base + '/schedule', null);
  });

  it('sends only scores, not mutable fixtures or player IDs', () => {
    service.recordResult(7, 9, 23, 3, 1).subscribe();
    expect(http.put).toHaveBeenCalledWith(
      base + '/matches/23/result', { homeScore: 3, awayScore: 1 });
  });

  it('reads standings and closes a tournament through exact backend routes', () => {
    service.standings(7, 9).subscribe();
    expect(http.get).toHaveBeenCalledWith(base + '/standings');
    service.complete(7, 9).subscribe();
    expect(http.post).toHaveBeenCalledWith(base + '/complete', null);
  });
  it('reads and links only real speed skating heats with an explicit heat number', () => {
    service.inlineSpeedOverview(7, 9).subscribe();
    expect(http.get).toHaveBeenCalledWith(base + '/inline-speed');
    service.linkInlineSpeedHeat(7, 9, 71, 3).subscribe();
    const [url, body, options] = http.put.calls.mostRecent().args;
    expect(url).toBe(base + '/inline-speed/heats/71');
    expect(body).toEqual({});
    expect((options as any).params.heatNumber).toBe('3');
  });

  it('unlinks only tournament linkage, without a destructive round request', () => {
    service.unlinkInlineSpeedHeat(7, 9, 71).subscribe();
    expect(http.delete).toHaveBeenCalledWith(base + '/inline-speed/heats/71');
  });

  it('submits a human judge decision with an explicit roster and reason', () => {
    service.confirmInlineSpeedQualification(7, 9, 'QUARTER', [12, 8], 'Chief judge decision').subscribe();
    expect(http.put).toHaveBeenCalledWith(
      base + '/inline-speed/qualifications/QUARTER',
      { playerIds: [12, 8], reason: 'Chief judge decision' });
  });

});
