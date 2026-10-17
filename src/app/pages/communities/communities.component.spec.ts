import { CommunitiesComponent } from './communities.component';
import { of } from 'rxjs';
import { SessionSummary } from '../model/session-summary';

describe('CommunitiesComponent public session eligibility', () => {
  let component: CommunitiesComponent;
  let session: SessionSummary;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    spyOn(component, 'canManage').and.returnValue(true);
    session = {
      id: 42,
      sport: 'Futebol',
      city: 'Lisboa',
      gameDate: new Date(Date.now() + 3_600_000).toISOString(),
      distanceKm: null,
      participantCount: 2,
      maxParticipants: 10,
      priceAmount: 0,
      privateGame: false,
      audience: 'COMMUNITY_ONLY',
      status: 'OPEN'
    };
  });

  it('accepts Excel, CSV and TSV history files regardless of extension casing', () => {
    for (const name of ['histórico.xlsx', 'antigo.XLS', 'jornadas.csv', 'resultados.TSV']) {
      const file = new File(['Jogador;Golos\\nAna;2'], name, { type: 'application/octet-stream' });
      const input = { files: [file], value: name } as unknown as HTMLInputElement;
      component.onImportFileChange({ target: input } as unknown as Event);
      expect(component.importFile).toBe(file);
      expect(component.importFileName).toBe(name);
      expect(component.importFileError).toBe('');
    }
  });

  it('rejects unsupported formats and oversized imports without keeping old previews', () => {
    const previous = new File(['data'], 'jornadas.xlsx');
    const select = (file: File) => {
      const input = { files: [file], value: file.name } as unknown as HTMLInputElement;
      component.onImportFileChange({ target: input } as unknown as Event);
      return input;
    };
    select(previous);
    component.importPreview = { fileName: previous.name, sheets: [] };
    component.importFinalPlan = { rounds: [] };
    component.importResult = { createdRounds: 1, skippedDuplicateRounds: 0, createdEntries: 2 };

    const invalid = select(new File(['content'], 'historico.pdf'));
    expect(invalid.value).toBe('');
    expect(component.importFile).toBeUndefined();
    expect(component.importFileName).toBe('');
    expect(component.importFileError).toContain('.csv');
    expect(component.importPreview).toBeUndefined();
    expect(component.importFinalPlan).toBeUndefined();
    expect(component.importResult).toBeUndefined();

    const large = select(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.csv'));
    expect(large.value).toBe('');
    expect(component.importFile).toBeUndefined();
    expect(component.importFileError).toContain('10 MB');
  });

  it('clears stale import data when file selection is cancelled', () => {
    component.importFile = new File(['data'], 'jornadas.csv');
    component.importFileName = 'jornadas.csv';
    component.importPreview = { fileName: 'jornadas.csv', sheets: [] };
    component.onImportFileChange({
      target: { files: [], value: '' } as unknown as HTMLInputElement
    } as unknown as Event);

    expect(component.importFile).toBeUndefined();
    expect(component.importFileName).toBe('');
    expect(component.importPreview).toBeUndefined();
  });

  it('requires explicit confirmation when mapped spreadsheet points will not be persisted', () => {
    component.importMappings = [{ columnIndex: 2, header: 'Pontos', field: 'POINTS', confidence: 0.9 }];
    component.importPointsAcknowledged = false;
    expect(component.importIncludesPoints).toBeTrue();

    component.selected = { id: 9 } as any;
    component.importFile = new File(['history'], 'historico.csv');
    component.importSheetName = 'Dados';
    component.selectedSeasonId = 21;
    component.importFinalPlan = { invalidDates: 0, roundsNeedingYear: 0, rounds: [] };
    component.confirmHistoricalImport();

    expect(component.importFileError).not.toBe('');
    expect(component.importConfirming).toBeFalsy();

    component.importPointsAcknowledged = true;
    component.setImportMapping(2, 'IGNORE');
    expect(component.importIncludesPoints).toBeFalse();
    expect(component.importPointsAcknowledged).toBeFalse();
  });

  it('resets points acknowledgement when import planning context changes', () => {
    component.importMappings = [{ columnIndex: 1, header: 'Points', field: 'POINTS', confidence: 0.9 }];
    component.importPointsAcknowledged = true;
    component.invalidateImportPlan();
    expect(component.importPointsAcknowledged).toBeFalse();
    component.importPointsAcknowledged = true;
    component.onImportFileChange({ target: {
      files: [new File(['x'], 'season.xlsx')], value: 'season.xlsx'
    } as unknown as HTMLInputElement } as unknown as Event);
    expect(component.importPointsAcknowledged).toBeFalse();
  });

  it('allows joining an upcoming open community session', () => {
    expect(component.canJoinCommunitySession(session)).toBeTrue();
  });

  it('hides joining when a community session has started or ended', () => {
    session.gameDate = new Date(Date.now() - 60_000).toISOString();
    expect(component.canJoinCommunitySession(session)).toBeFalse();
    session.gameDate = new Date(Date.now() + 3_600_000).toISOString();
    for (const status of ['CANCELLED', 'COMPLETED']) {
      session.status = status;
      expect(component.canJoinCommunitySession(session)).toBeFalse();
    }
  });

  it('hides joining for private games or existing participation', () => {
    session.privateGame = true;
    expect(component.canJoinCommunitySession(session)).toBeFalse();
    session.privateGame = false;
    session.joinedByViewer = true;
    expect(component.canJoinCommunitySession(session)).toBeFalse();
    session.joinedByViewer = false;
    session.waitlistedByViewer = true;
    expect(component.canJoinCommunitySession(session)).toBeFalse();
  });

  it('allows opening an upcoming community-only session', () => {
    expect(component.canOpenSessionToPublic(session)).toBeTrue();
  });

  it('hides the action for sessions that already started', () => {
    session.gameDate = new Date(Date.now() - 60_000).toISOString();
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
  });

  it('hides the action for cancelled and completed sessions', () => {
    for (const status of ['CANCELLED', 'COMPLETED']) {
      session.status = status;
      expect(component.canOpenSessionToPublic(session)).toBeFalse();
    }
  });

  it('hides the action for full and already public sessions', () => {
    session.participantCount = session.maxParticipants;
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
    session.participantCount = 2;
    session.audience = 'PUBLIC';
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
  });

  it('hides the action for non-managers', () => {
    (component.canManage as jasmine.Spy).and.returnValue(false);
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
  });
  it('shows discovery sports with legacy and no-sport fallback', () => {
    expect(component.communitySports({
      sport: 'Futebol', sports: ['Futebol', 'Padel', 'Natação']
    })).toEqual(['Futebol', 'Padel', 'Natação']);
    expect(component.communitySports({ sport: 'Ténis' })).toEqual(['Ténis']);
    expect(component.communitySports({ sport: null, sports: [] })).toEqual([]);
  });

  it('reads both legacy single-sport groups and the new sports array', () => {
    const group = {
      id: 7, name: 'CNG', description: null, sport: 'Futebol',
      visibility: 'PRIVATE', myRole: 'OWNER', memberCount: 2
    } as any;
    expect(component.communitySports(group)).toEqual(['Futebol']);
    group.sports = ['Futebol', 'Padel'];
    expect(component.communitySports(group)).toEqual(['Futebol', 'Padel']);
    group.sport = null;
    group.sports = [];
    expect(component.communitySports(group)).toEqual([]);
  });


  it('preserves all optional modules for legacy responses but hides disabled ones', () => {
    const group = { id: 7, rankingsEnabled: false } as any;
    expect(component.hasCompetitions(group)).toBeTrue();
    group.individualTournamentsEnabled = false;
    group.teamTournamentsEnabled = false;
    expect(component.hasCompetitions(group)).toBeFalse();
    group.teamTournamentsEnabled = true;
    expect(component.hasCompetitions(group)).toBeTrue();
    component.selected = group;
    component.setTab('ranking');
    expect(component.activeTab).not.toBe('ranking');
    group.rankingsEnabled = true;
    component.setTab('ranking');
    expect(component.activeTab).toBe('ranking');
  });

  it('allows manager to configure independent modules and saves without clearing history', () => {
    const original = { id: 7, rankingsEnabled: true,
      individualTournamentsEnabled: true, teamTournamentsEnabled: false } as any;
    component.selected = original;
    (component.canManage as jasmine.Spy).and.returnValue(true);
    const update = jasmine.createSpy('updateFeatures').and.returnValue(
      of({ ...original, rankingsEnabled: false,
        individualTournamentsEnabled: false, teamTournamentsEnabled: true }));
    const groups = { updateFeatures: update } as any;
    (component as any).communityService = groups;
    component.communities = [original];
    spyOn(component as any, 'loadCompetition');
    component.editFeatures();
    expect(component.featuresEditing).toBeTrue();
    component.featuresDraft.rankingsEnabled = false;
    component.featuresDraft.individualTournamentsEnabled = false;
    component.featuresDraft.teamTournamentsEnabled = true;
    component.saveFeatures();
    expect(update).toHaveBeenCalledWith(7, {
      rankingsEnabled: false, individualTournamentsEnabled: false,
      teamTournamentsEnabled: true
    });
    expect(component.selected?.teamTournamentsEnabled).toBeTrue();
    expect(component.featuresEditing).toBeFalse();
  });

  it('lets organizers edit sport lists but prevents members changing them', () => {
    const group = {
      id: 7, name: 'CNG', sport: 'Futebol', sports: ['Futebol'],
      myRole: 'OWNER'
    } as any;
    component.selected = group;
    (component.canManage as jasmine.Spy).and.returnValue(true);
    component.editSports();
    expect(component.editingSports).toBeTrue();
    component.sportsSearch = 'pad';
    expect(component.availableSportSuggestions).toContain('Padel');
    component.addCommunitySport('Padel');
    component.addCommunitySport('Padel');
    expect(component.sportsDraft).toEqual(['Futebol', 'Padel']);
    component.removeCommunitySport('Futebol');
    expect(component.sportsDraft).toEqual(['Padel']);
    component.cancelSportsEdit();
    expect(component.editingSports).toBeFalse();
    (component.canManage as jasmine.Spy).and.returnValue(false);
    component.editSports();
    expect(component.editingSports).toBeFalse();
  });

});
