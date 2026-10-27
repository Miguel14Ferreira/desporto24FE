import { of, Subject, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityStanding } from '../model/community-group';
import { HistoricalPlayerCandidate } from '../../services/community-groups.service';
import { appTranslate } from '../../i18n/i18n.service';
import { EN } from '../../i18n/translations-en';

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

  it('does not fetch obsolete historical identity options when members open their tab', () => {
    const requests = spyOn(component as any, 'loadPendingJoinRequests');
    component.setTab('members');
    expect(component.activeTab).toBe('members');
    expect(reloadLinks).not.toHaveBeenCalled();
    expect(service.historicalPlayerCandidates).not.toHaveBeenCalled();
    expect(requests).not.toHaveBeenCalled();
  });

  it('keeps join-request management when an administrator opens the members tab', () => {
    component.selected = { id: 9, myRole: 'ADMIN' } as any;
    const requests = spyOn(component as any, 'loadPendingJoinRequests');
    component.setTab('members');
    expect(requests).toHaveBeenCalledOnceWith(9);
    expect(reloadLinks).not.toHaveBeenCalled();
  });

  it('renders translated close actions for Portuguese and English instead of a raw key', () => {
    const language=localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language','pt');
      expect(appTranslate('common.close')).toBe('Fechar');
      expect(EN['common.close']).toBe('Close');
    } finally {
      if(language===null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language',language);
    }
  });

  it('opens a read-only historical profile without requesting identity data', () => {
    component.openRankingHistoricalPlayer(historic);
    expect(component.rankingHistoricalRow).toBe(historic);
    expect(component.rankingHistoricalRow?.games).toBe(5);
    expect(component.rankingHistoricalRow?.points).toBe(6);
    expect(component.rankingHistoricalRow?.wins).toBe(2);
    expect(component.rankingHistoricalClaimExpanded).toBeFalse();
    expect(service.historicalPlayerCandidates).not.toHaveBeenCalled();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
  });

  it('shows historical player results even to someone without membership', () => {
    component.selected = { id: 9, myRole: null } as any;
    component.openRankingHistoricalPlayer(historic);
    expect(component.rankingHistoricalRow).toBe(historic);
    expect(component.rankingHistoricalError).toBe('');
    expect(service.historicalPlayerCandidates).not.toHaveBeenCalled();
  });

  it('checks current server eligibility only when an eligible member explicitly requests linking', () => {
    component.openRankingHistoricalPlayer(historic);
    expect(service.historicalPlayerCandidates).not.toHaveBeenCalled();
    component.startRankingHistoricalClaim();
    expect(component.rankingHistoricalClaimExpanded).toBeTrue();
    expect(service.historicalPlayerCandidates).toHaveBeenCalledOnceWith(9);
    expect(component.rankingHistoricalCandidate?.playerId).toBe(77);
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
  });

  it('requires ownership acknowledgement before linking a historical name', () => {
    component.openRankingHistoricalPlayer(historic);
    component.confirmRankingHistoricalClaim();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
    component.startRankingHistoricalClaim();
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

  it('does not claim a name already accepted by another member but keeps its statistics viewable', () => {
    service.historicalPlayerCandidates.and.returnValue(of([{ ...candidate, linkStatus: 'ACCEPTED' }]));
    component.openRankingHistoricalPlayer(historic);
    component.startRankingHistoricalClaim();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
    expect(component.rankingHistoricalError).toBeTruthy();
    expect(component.rankingHistoricalRow?.points).toBe(6);
    component.rankingHistoricalAcknowledged = true;
    component.confirmRankingHistoricalClaim();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
  });

  it('never guesses an identity from an unrelated imported historical player', () => {
    service.historicalPlayerCandidates.and.returnValue(of([{ ...candidate, historicalName: 'Outra pessoa' }]));
    component.openRankingHistoricalPlayer(historic);
    component.startRankingHistoricalClaim();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
    expect(component.rankingHistoricalError).toBeTruthy();
    expect(component.rankingHistoricalRow?.fullName).toBe('Ferreirinha');
  });

  it('does not allow non-members to submit a claim even though they may view stats', () => {
    component.selected = { id: 9, myRole: null } as any;
    component.openRankingHistoricalPlayer(historic);
    component.startRankingHistoricalClaim();
    expect(component.rankingHistoricalRow).toBe(historic);
    expect(service.historicalPlayerCandidates).not.toHaveBeenCalled();
    expect(component.rankingHistoricalError).toBeTruthy();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
    component.rankingHistoricalAcknowledged = true;
    component.confirmRankingHistoricalClaim();
    expect(service.claimHistoricalPlayer).not.toHaveBeenCalled();
  });

  it('ignores stale identity lookups after closing the read-only statistics view', () => {
    const delayed = new Subject<HistoricalPlayerCandidate[]>();
    service.historicalPlayerCandidates.and.returnValue(delayed);
    component.openRankingHistoricalPlayer(historic);
    component.startRankingHistoricalClaim();
    component.closeRankingHistoricalDialog();
    delayed.next([candidate]);
    delayed.complete();
    expect(component.rankingHistoricalRow).toBeUndefined();
    expect(component.rankingHistoricalClaimExpanded).toBeFalse();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
  });

  it('keeps historical results intact when a link fails and displays the server conflict', () => {
    service.claimHistoricalPlayer.and.returnValue(throwError(() => ({
      error: { message: 'Este perfil já tem uma participação na mesma jornada' }
    })));
    component.openRankingHistoricalPlayer(historic);
    component.startRankingHistoricalClaim();
    component.rankingHistoricalAcknowledged = true;
    component.confirmRankingHistoricalClaim();
    expect(component.rankingHistoricalError).toContain('participação');
    expect(component.rankingHistoricalRow?.fullName).toBe('Ferreirinha');
    expect(component.rankingHistoricalRow?.games).toBe(5);
    expect(reload).not.toHaveBeenCalled();
  });

  it('switches cleanly between historical rows and never carries an old claim forward', () => {
    component.openRankingHistoricalPlayer(historic);
    component.startRankingHistoricalClaim();
    expect(component.rankingHistoricalCandidate).toBeTruthy();
    const other = { ...historic, fullName:'Afonso Salvador',points:18,games:10 };
    component.openRankingHistoricalPlayer(other);
    expect(component.rankingHistoricalRow?.fullName).toBe('Afonso Salvador');
    expect(component.rankingHistoricalRow?.points).toBe(18);
    expect(component.rankingHistoricalClaimExpanded).toBeFalse();
    expect(component.rankingHistoricalCandidate).toBeUndefined();
    expect(service.historicalPlayerCandidates).toHaveBeenCalledTimes(1);
  });

});
