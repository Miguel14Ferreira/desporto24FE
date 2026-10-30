import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommunitiesComponent } from './communities.component';

describe('Community Excel import without an existing season', () => {
  let component: CommunitiesComponent;
  let service: { createSeason: jasmine.Spy; finalImportPlan: jasmine.Spy };
  let reload: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 7 } as any;
    component.competition = { seasons: [] } as any;
    component.selectedSeasonId = null;
    component.importFile = new File(['excel'], 'historico.xlsx');
    component.importSheetName = 'Jornadas';
    component.importMappings = [{ columnIndex: 0, header: 'Nome', field: 'PLAYER', confidence: 1 }];
    component.importRevision = 1;
    component.importPlanLoading = false;
    component.importDefaultYear = 2026;
    component.sourceDatesNeedYear = false;
    component.importSourceCompetition = '';
    component.importSourceRound = '';
    component.importFileError = '';
    component.importSportDraft = '';
    spyOnProperty(component, 'communityRoundSports', 'get').and.returnValue(['Futebol']);
    reload = spyOn(component, 'loadCompetition');
    service = {
      createSeason: jasmine.createSpy('createSeason').and.returnValue(of({ id: 61, name: '2026/2027' })),
      finalImportPlan: jasmine.createSpy('finalImportPlan').and.returnValue(of({ distinctRounds: 2, rounds: [] }))
    };
    (component as any).communityService = service;
  });

  it('suggests July-to-June sporting season years', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 9, 27));
      expect(component.automaticImportSeasonName).toBe('2026/2027');
      jasmine.clock().mockDate(new Date(2027, 2, 10));
      expect(component.automaticImportSeasonName).toBe('2026/2027');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('creates the default season once and prepares the Excel plan in it', () => {
    component.buildImportFinalPlan();

    expect(service.createSeason).toHaveBeenCalledOnceWith(7, {
      name: component.automaticImportSeasonName, startsAt: null
    });
    expect(component.selectedSeasonId).toBe(61);
    expect(reload).toHaveBeenCalledWith(component.selected, 61);
    expect(service.finalImportPlan).toHaveBeenCalledTimes(1);
    expect(service.finalImportPlan.calls.mostRecent().args[3].seasonId).toBe(61);
    expect(component.importFinalPlan?.distinctRounds).toBe(2);
    expect(component.importPlanLoading).toBeFalse();
  });

  it('uses the selected existing season without creating another', () => {
    component.competition = { seasons: [{ id: 10 }] } as any;
    component.selectedSeasonId = 10;
    component.buildImportFinalPlan();
    expect(service.createSeason).not.toHaveBeenCalled();
    expect(service.finalImportPlan.calls.mostRecent().args[3].seasonId).toBe(10);
  });

  it('selects an existing season automatically when there is no active season', () => {
    component.competition = { seasons: [{ id: 10 }, { id: 9 }] } as any;
    expect(component.importDestinationSeasonId).toBe(10);
    component.buildImportFinalPlan();
    expect(service.createSeason).not.toHaveBeenCalled();
    expect(service.finalImportPlan.calls.mostRecent().args[3].seasonId).toBe(10);
  });

  it('prefers the active season for a new Excel even when the ranking filter is empty', () => {
    component.competition = { activeSeasonId: 42, seasons: [{ id: 12 }, { id: 42 }, { id: 9 }] } as any;
    expect(component.importDestinationSeasonId).toBe(42);
    component.buildImportFinalPlan();
    expect(service.createSeason).not.toHaveBeenCalled();
    expect(service.finalImportPlan.calls.mostRecent().args[3].seasonId).toBe(42);
  });

  it('allows choosing another season without touching the ranking season filter', () => {
    component.competition = { activeSeasonId: 42, seasons: [{ id: 42 }, { id: 12 }] } as any;
    component.selectImportSeason(12);
    expect(component.importDestinationSeasonId).toBe(12);
    expect(component.selectedSeasonId).toBeNull();
    component.buildImportFinalPlan();
    expect(service.finalImportPlan.calls.mostRecent().args[3].seasonId).toBe(12);
  });

  it('clears the previous success and picks the active season for a new Excel', () => {
    component.competition = { activeSeasonId: 42, seasons: [{ id: 42 }, { id: 12 }] } as any;
    component.importSeasonId = 12;
    component.importResult = { createdRounds: 7, createdEntries: 70, skippedDuplicateRounds: 0 };
    component.importFinalPlan = { rounds: [] };
    component.startNewHistoricalImport();

    expect(component.importFile).toBeUndefined();
    expect(component.importPreview).toBeUndefined();
    expect(component.importFinalPlan).toBeUndefined();
    expect(component.importResult).toBeUndefined();
    expect(component.importDestinationSeasonId).toBe(42);
  });

  it('collapses the wizard only on successful confirmation and refreshes the selected season', () => {
    component.competition = { activeSeasonId: 42, seasons: [{ id: 42 }] } as any;
    component.importFinalPlan = { invalidDates: 0, roundsNeedingYear: 0, rounds: [] };
    const result = { createdRounds: 7, createdEntries: 70, skippedDuplicateRounds: 0 };
    (component as any).communityService.confirmImportRounds = jasmine.createSpy('confirmImportRounds').and.returnValue(of(result));

    component.confirmHistoricalImport();
    expect(component.importResult).toEqual(result);
    expect(component.selectedSeasonId).toBe(42);
    expect(reload).toHaveBeenCalledWith(component.selected, 42);
    expect(component.importConfirming).toBeFalse();
  });

  it('does not create a season before yearless source dates are resolved', () => {
    component.sourceDatesNeedYear = true;
    component.importDefaultYear = null;
    component.buildImportFinalPlan();
    expect(service.createSeason).not.toHaveBeenCalled();
    expect(service.finalImportPlan).not.toHaveBeenCalled();
    expect(component.importFileError).toBeTruthy();
  });

  it('does not attempt an import plan if automatic season creation fails', () => {
    service.createSeason.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 500, error: { message: 'Falha ao criar época' }
    })));
    component.buildImportFinalPlan();
    expect(component.selectedSeasonId).toBeNull();
    expect(component.importPlanLoading).toBeFalse();
    expect(service.finalImportPlan).not.toHaveBeenCalled();
    expect(component.importFileError).toBeTruthy();
  });
});
