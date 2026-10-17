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
});
