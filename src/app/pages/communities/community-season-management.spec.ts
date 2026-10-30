import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommunitiesComponent } from './communities.component';
import { CommunitySeason } from '../model/community-group';

describe('Community season management', () => {
  let component: CommunitiesComponent;
  let service: { renameSeason: jasmine.Spy; deleteSeason: jasmine.Spy };
  let reload: jasmine.Spy;
  let historyReload: jasmine.Spy;
  const season: CommunitySeason = {
    id: 44, name: 'Época 2026/27', active: false,
    startsAt: '2026-09-01T00:00:00Z', endedAt: '2027-05-01T00:00:00Z',
    championUsername: 'player', championDisplayName: 'Jogador',
    championPoints: 9
  };

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 7 } as any;
    component.selectedSeasonId = season.id;
    component.seasonActionSaving = false;
    component.seasonActionError = '';
    component.seasonActionMessage = '';
    component.editingSeasonId = null;
    component.deletingSeasonId = null;
    component.seasonDeleteAcknowledged = false;
    component.editingSeasonName = '';
    spyOn(component, 'canManage').and.returnValue(true);
    reload = spyOn(component, 'loadCompetition');
    historyReload = spyOn(component, 'loadHistoricalLinks');
    service = {
      renameSeason: jasmine.createSpy('renameSeason').and.returnValue(of({ ...season })),
      deleteSeason: jasmine.createSpy('deleteSeason').and.returnValue(of(undefined))
    };
    (component as any).communityService = service;
  });

  it('renames a closed season and keeps the selected season', () => {
    component.editSeason(season);
    component.editingSeasonName = '  Liga de Inverno  ';
    component.saveSeasonName(season);

    expect(service.renameSeason).toHaveBeenCalledOnceWith(7, 44, 'Liga de Inverno');
    expect(component.selectedSeasonId).toBe(44);
    expect(component.editingSeasonId).toBeNull();
    expect(reload).toHaveBeenCalledWith(component.selected, 44);
  });

  it('rejects empty names without making a request', () => {
    component.editSeason(season);
    component.editingSeasonName = '  ';
    component.saveSeasonName(season);

    expect(service.renameSeason).not.toHaveBeenCalled();
    expect(component.seasonActionError).toBeTruthy();
  });

  it('requires a second explicit action to delete and resets the selected filter', () => {
    component.requestDeleteSeason(season);
    expect(service.deleteSeason).not.toHaveBeenCalled();

    component.confirmDeleteSeason(season);
    expect(service.deleteSeason).not.toHaveBeenCalled();
    component.seasonDeleteAcknowledged = true;
    component.confirmDeleteSeason(season);
    expect(service.deleteSeason).toHaveBeenCalledOnceWith(7, 44);
    expect(component.selectedSeasonId).toBeNull();
    expect(component.deletingSeasonId).toBeNull();
    expect(reload).toHaveBeenCalledWith(component.selected, null);
    expect(historyReload).toHaveBeenCalledOnceWith(7);
  });

  it('keeps the selection and shows a conflict if deletion fails', () => {
    service.deleteSeason.and.returnValue(throwError(() =>
      new HttpErrorResponse({ status: 409 })));
    component.requestDeleteSeason(season);
    component.seasonDeleteAcknowledged = true;
    component.confirmDeleteSeason(season);

    expect(component.seasonActionError).toBeTruthy();
    expect(component.selectedSeasonId).toBe(44);
    expect(component.deletingSeasonId).toBe(44);
    expect(reload).not.toHaveBeenCalled();
    expect(historyReload).not.toHaveBeenCalled();
  });

  it('never exposes state changes to a member', () => {
    (component.canManage as jasmine.Spy).and.returnValue(false);
    component.editSeason(season);
    component.requestDeleteSeason(season);
    component.saveSeasonName(season);
    component.confirmDeleteSeason(season);

    expect(component.editingSeasonId).toBeNull();
    expect(component.deletingSeasonId).toBeNull();
    expect(service.renameSeason).not.toHaveBeenCalled();
    expect(service.deleteSeason).not.toHaveBeenCalled();
  });
});
