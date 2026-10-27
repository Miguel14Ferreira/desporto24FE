import { of, Subject, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityStanding } from '../model/community-group';
import { HistoricalPlayerCandidate } from '../../services/community-groups.service';

describe('Ranking historical player self-claim', () => {
  let component: CommunitiesComponent;
  let service: { historicalPlayerCandidates: jasmine.Spy; claimHistoricalPlayer: jasmine.Spy };
  let reload: jasmine.Spy;
  let reloadLinks: jasmine.Spy;

  const historic: CommunityStanding = {
    position: 8, profileId: null, username: null, fullName: 'Ferreirinha',
    profilePicUrl: null, games: 5, wins: 2, draws: 0, losses: 3,
    points: 6, goals: 0, assists: 0, mvps: 0, cleanSheets: 0,
    winRate: 40, currentStreak: '', bestWinStreak: 1
  };
  const candidate: HistoricalPlayerCandidate = {
    playerId: 77, historicalName: 'Ferreirinha', linkedUsername: null, linkStatus: 'UNLINKED'
  };

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 9, myRole: 'MEMBER' } as any;
    component.selectedSeasonId = 12;
    component.rankingHistoricalAcknowledged = false;
    component.rankingHistoricalSaving = false;
    component.rankingHistoricalLoading = false;
    component.rankingHistoricalError = '';
    component.rankingHistoricalSuccess = '';
    service = {
      historicalPlayerCandidates: jasmine.createSpy('historicalPlayerCandidates').and.returnValue(of([candidate])),
      claimHistoricalPlayer: jasmine.createSpy('claimHistoricalPlayer').and.returnValue(of({ id: 55 }))
    };
    (component as any).communityService = service;
    reload = spyOn(component, 'loadCompetition');
    reloadLinks = spyOn(component, 'loadHistoricalLinks');
  });

  it('loads current server candidates before asking to link an unlinked name', () => {
    component.openRankingHistoricalPlayer(historic);
    expect(service.historicalPlayerCandidates).toHaveBeenCalledOnceWith(9);
    expect(component.rankingHistoricalCandidate?.playerId).toBe(77);
    expect(component.rankingHistoricalLoading).toBeFalse();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
  });

  it('requires explicit ownership acknowledgement before making the authenticated claim', () => {
    component.openRankingHistoricalPlayer(historic);
    component.confirmRankingHistoricalClaim();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
    component.rankingHistoricalAcknowledged = true;
    component.confirmRankingHistoricalClaim();
    expect(service.claimHistoricalPlayer).toHaveBeenCalledOnceWith(9, 77);
    expect(component.rankingHistoricalRow).toBeUndefined();
    expect(component.rankingHistoricalSuccess).toBeTruthy();
    expect(reload).toHaveBeenCalledWith(component.selected, 12);
    expect(reloadLinks).toHaveBeenCalledWith(9);
  });

  it('never claims a name already accepted by another member', () => {
    service.historicalPlayerCandidates.and.returnValue(of([{ ...candidate, linkStatus: 'ACCEPTED' }]));
    component.openRankingHistoricalPlayer(historic);
    expect(component.rankingHistoricalCandidate).toBeUndefined();
    expect(component.rankingHistoricalError).toBeTruthy();
    component.rankingHistoricalAcknowledged = true;
    component.confirmRankingHistoricalClaim();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
  });

  it('does not guess an identity if server candidates do not match this historical name', () => {
    service.historicalPlayerCandidates.and.returnValue(of([{ ...candidate, historicalName: 'Outra pessoa' }]));
    component.openRankingHistoricalPlayer(historic);
    expect(component.rankingHistoricalCandidate).toBeUndefined();
    expect(component.rankingHistoricalError).toBeTruthy();
  });

  it('does not allow non-members to submit a self-claim', () => {
    component.selected = { id: 9, myRole: null } as any;
    component.openRankingHistoricalPlayer(historic);
    expect(service.historicalPlayerCandidates).not.toHaveBeenCalled();
    expect(component.rankingHistoricalError).toBeTruthy();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
  });

  it('ignores stale server results after closing the dialog', () => {
    const delayed = new Subject<HistoricalPlayerCandidate[]>();
    service.historicalPlayerCandidates.and.returnValue(delayed);
    component.openRankingHistoricalPlayer(historic);
    component.closeRankingHistoricalDialog();
    delayed.next([candidate]);
    delayed.complete();
    expect(component.rankingHistoricalRow).toBeUndefined();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
  });

  it('preserves the prompt and displays server conflicts without rewriting results', () => {
    service.claimHistoricalPlayer.and.returnValue(throwError(() => ({
      error: { message: 'Este perfil já tem uma participação na mesma jornada' }
    })));
    component.openRankingHistoricalPlayer(historic);
    component.rankingHistoricalAcknowledged = true;
    component.confirmRankingHistoricalClaim();
    expect(component.rankingHistoricalError).toContain('participação');
    expect(component.rankingHistoricalRow?.fullName).toBe('Ferreirinha');
    expect(reload).not.toHaveBeenCalled();
  });
});
