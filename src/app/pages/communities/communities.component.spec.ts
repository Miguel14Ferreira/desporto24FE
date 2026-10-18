import { CommunitiesComponent } from './communities.component';
import { of, Subject, throwError } from 'rxjs';
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
    component.importSourceCompetition = 'Taça antiga';
    component.importSourceRound = 'Jornada 4';
    component.importFile = new File(['data'], 'jornadas.csv');
    component.importFileName = 'jornadas.csv';
    component.importPreview = { fileName: 'jornadas.csv', sheets: [] };
    component.onImportFileChange({
      target: { files: [], value: '' } as unknown as HTMLInputElement
    } as unknown as Event);

    expect(component.importFile).toBeUndefined();
    expect(component.importFileName).toBe('');
    expect(component.importPreview).toBeUndefined();
    expect(component.importSourceCompetition).toBe('');
    expect(component.importSourceRound).toBe('');
  });

  it('ignores a stale Excel preview after replacing the file while allowing the new inspection', () => {
    const old = new Subject<any>();
    const latest = new Subject<any>();
    const preview = jasmine.createSpy('importPreview').and.returnValues(old, latest);
    (component as any).communityService = { importPreview: preview };
    component.importRevision = 0;
    component.selected = { id: 7 } as any;
    const oldFile = new File(['first'], 'antigo.xlsx');
    const newFile = new File(['second'], 'novo.csv');
    component.onImportFileChange({ target: { files: [oldFile], value: oldFile.name } } as unknown as Event);
    component.inspectImportFile();
    expect(component.importPreviewLoading).toBeTrue();

    component.onImportFileChange({ target: { files: [newFile], value: newFile.name } } as unknown as Event);
    expect(component.importPreviewLoading).toBeFalse();
    component.inspectImportFile();
    expect(preview).toHaveBeenCalledTimes(2);

    old.next({ fileName: oldFile.name, sheets: [] });
    old.complete();
    expect(component.importPreview).toBeUndefined();
    expect(component.importPreviewLoading).toBeTrue();

    latest.next({ fileName: newFile.name, sheets: [] });
    latest.complete();
    expect(component.importPreview?.fileName).toBe(newFile.name);
    expect(component.importPreviewLoading).toBeFalse();
    expect(component.importFileError).toBe('');
  });

  it('ignores a late preview error after the user clears their Excel selection', () => {
    const old = new Subject<any>();
    (component as any).communityService = { importPreview: () => old };
    component.importRevision = 0;
    component.selected = { id: 7 } as any;
    const file = new File(['data'], 'histórico.xlsx');
    component.onImportFileChange({ target: { files: [file], value: file.name } } as unknown as Event);
    component.inspectImportFile();
    component.onImportFileChange({ target: { files: [], value: '' } } as unknown as Event);
    old.error({ error: { message: 'Erro do ficheiro anterior' } });
    expect(component.importFile).toBeUndefined();
    expect(component.importPreview).toBeUndefined();
    expect(component.importFileError).toBe('');
    expect(component.importPreviewLoading).toBeFalse();
  });

  it('does not normalize an outdated mapping validation after selecting a new file', () => {
    const oldValidation = new Subject<any>();
    const currentValidation = new Subject<any>();
    const validate = jasmine.createSpy('validateImport').and.returnValues(oldValidation, currentValidation);
    const normalize = jasmine.createSpy('normalizedImportPreview').and.returnValue(of({ acceptedRows: 1, skippedRows: 0, rows: [], skipped: [] }));
    (component as any).communityService = { validateImport: validate, normalizedImportPreview: normalize };
    // This suite bypasses the constructor with Object.create(): restore field initializers.
    component.importRevision = 0;
    component.selected = { id: 7 } as any;
    const first = new File(['a'], 'primeiro.xlsx');
    const second = new File(['b'], 'segundo.xlsx');
    const choose = (file: File) => {
      component.onImportFileChange({ target: { files: [file], value: file.name } } as unknown as Event);
      component.importSheetName = 'Dados';
      component.importMode = 'ROUNDS';
      component.importMappings = [{ columnIndex: 0, header: 'Jogador', field: 'PLAYER', confidence: 1 }];
    };
    choose(first);
    component.validateImportMapping();
    expect(component.importMappingLoading).toBeTrue();
    choose(second);
    expect(component.importMappingLoading).toBeFalse();
    component.validateImportMapping();
    oldValidation.next({ valid: true, dataRows: 5, validRows: 5, errors: [], warnings: [] });
    oldValidation.complete();
    expect(normalize).not.toHaveBeenCalled();
    expect(component.importValidation).toBeUndefined();
    expect(component.importMappingLoading).toBeTrue();
    currentValidation.next({ valid: true, dataRows: 2, validRows: 2, errors: [], warnings: [] });
    currentValidation.complete();
    expect(normalize).toHaveBeenCalledOnceWith(7, second, jasmine.anything());
    expect(component.importNormalized?.acceptedRows).toBe(1);
    expect(component.importMappingLoading).toBeFalse();
  });

  it('ignores a late normalized Excel preview after column mappings change', () => {
    const pendingNormalization = new Subject<any>();
    const normalize = jasmine.createSpy('normalizedImportPreview').and.returnValue(pendingNormalization);
    (component as any).communityService = {
      validateImport: () => of({ valid: true, dataRows: 1, validRows: 1, errors: [], warnings: [] }),
      normalizedImportPreview: normalize
    };
    component.importRevision = 0;
    component.selected = { id: 7 } as any;
    component.importFile = new File(['a'], 'jornadas.xlsx');
    component.importSheetName = 'Dados';
    component.importMode = 'ROUNDS';
    component.importMappings = [{ columnIndex: 0, header: 'Jogador', field: 'PLAYER', confidence: 1 }];
    component.validateImportMapping();
    expect(component.importMappingLoading).toBeTrue();
    component.setImportMapping(0, 'IGNORE');
    expect(component.importMappingLoading).toBeFalse();
    pendingNormalization.next({ acceptedRows: 100, skippedRows: 0, rows: [], skipped: [] });
    pendingNormalization.complete();
    expect(component.importValidation).toBeUndefined();
    expect(component.importNormalized).toBeUndefined();
    expect(component.importMappingLoading).toBeFalse();
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

  it('supports distinct history types and clears stale preview on mode change', () => {
    component.importMode = 'ROUNDS';
    component.importFile = new File(['dummy'], 'historico.csv');
    component.importPreview = { fileName: 'historico.csv', sheets: [] };
    component.importMappings = [{ columnIndex: 0, header: 'Jogador', field: 'PLAYER', confidence: 0.9 }];
    component.selectImportMode('STANDINGS');
    expect(component.importMode).toBe('STANDINGS');
    expect(component.importFields).toContain('POINTS');
    expect(component.importFields).toContain('NAME');
    expect(component.importFields).not.toContain('DATE');
    expect(component.importPreview).toEqual({ fileName: 'historico.csv', sheets: [] });
    expect(component.importMappings).toEqual([]);
    expect(component.importFile?.name).toBe('historico.csv');
    expect(component['suggestArchiveField']('Pts', 'POINTS')).toBe('POINTS');
    expect(component['suggestArchiveField']('Equipa', 'IGNORE')).toBe('NAME');
  });

  it('maps tournament match headers and clears stale previews on mapping and mode changes', () => {
    component.importMode = 'MATCHES';
    expect(component.importFields).toEqual(
      ['IGNORE', 'HOME', 'AWAY', 'SCORE', 'HOME_SCORE', 'AWAY_SCORE', 'DATE', 'ROUND']);
    expect(component['suggestMatchField']('Equipa A', 'PLAYER')).toBe('HOME');
    expect(component['suggestMatchField']('Equipa B', 'PLAYER')).toBe('AWAY');
    expect(component['suggestMatchField']('Resultado', 'RESULT')).toBe('SCORE');
    expect(component['suggestMatchField']('Golos Casa', 'IGNORE')).toBe('HOME_SCORE');
    expect(component['suggestMatchField']('Golos Fora', 'IGNORE')).toBe('AWAY_SCORE');
    expect(component['suggestMatchField']('Jornada', 'IGNORE')).toBe('ROUND');
    expect(component['suggestMatchField']('Equipa', 'PLAYER')).toBe('IGNORE');
    component.importMappings = [{ columnIndex: 0, header: 'Equipa A', field: 'HOME', confidence: 1 }];
    component.matchPreview = { sheetName: 'Dados', sourceRows: 1, acceptedRows: 1,
      potentialDuplicates: 0, warnings: [], rows: [] };
    component.setImportMapping(0, 'AWAY');
    expect(component.matchPreview).toBeUndefined();
    component.matchPreview = { sheetName: 'Dados', sourceRows: 1, acceptedRows: 1,
      potentialDuplicates: 0, warnings: [], rows: [] };
    component.selectImportMode('STANDINGS');
    expect(component.matchPreview).toBeUndefined();
    expect(component.importMode).toBe('STANDINGS');
  });

  it('only previews historical matches and never invokes any persistence endpoint', () => {
    component.selected = { id: 7 } as any;
    component.importMode = 'MATCHES';
    component.importFile = new File(['data'], 'jogos.csv');
    component.importSheetName = 'Dados';
    component.importMappings = [
      { columnIndex: 0, header: 'Casa', field: 'HOME', confidence: 1 },
      { columnIndex: 1, header: 'Fora', field: 'AWAY', confidence: 1 },
      { columnIndex: 2, header: 'Resultado', field: 'SCORE', confidence: 1 }
    ];
    const preview = { sheetName: 'Dados', sourceRows: 2, acceptedRows: 2, potentialDuplicates: 1,
      warnings: ['Linha 3: confronto potencialmente repetido'], rows: [
        { sourceRow: 2, home: 'Águias', away: 'Lobos', homeScore: 2, awayScore: 1,
          sourceDate: '2020-10-01', sourceRound: '1', potentialDuplicate: false }
      ] };
    const fetchMatches = jasmine.createSpy('previewHistoricalMatches').and.returnValue(of(preview));
    const confirmStandings = jasmine.createSpy('confirmHistoricalStandings');
    (component as any).communityService = {
      previewHistoricalMatches: fetchMatches, confirmHistoricalStandings: confirmStandings
    };
    component.previewHistoricalMatches();
    expect(fetchMatches).toHaveBeenCalledWith(7, jasmine.any(File), {
      sheetName: 'Dados',
      columns: [
        { columnIndex: 0, field: 'HOME' }, { columnIndex: 1, field: 'AWAY' },
        { columnIndex: 2, field: 'SCORE' }
      ]
    });
    expect(component.matchPreview?.rows[0].homeScore).toBe(2);
    expect(component.matchPreview?.potentialDuplicates).toBe(1);
    expect(confirmStandings).not.toHaveBeenCalled();
  });


  it('saves tournament matches only after reviewing title and explicit acknowledgement', () => {
    component.selected = { id: 7 } as any;
    component.importMode = 'MATCHES';
    component.importFile = new File(['data'], 'jogos.tsv');
    component.importSheetName = 'Dados';
    component.importMappings = [{ columnIndex: 0, header: 'Casa', field: 'HOME', confidence: 1 }];
    component.matchPreview = {
      sheetName: 'Dados', sourceRows: 2, acceptedRows: 2, potentialDuplicates: 1, warnings: [],
      rows: [{ sourceRow: 2, home: 'Águias', away: 'Lobos', homeScore: 2, awayScore: 1,
        sourceDate: '01/10/2022', sourceRound: 'Final', potentialDuplicate: true }]
    };
    const confirmed = { id: 12, title: 'Taça antiga', entryType: 'TEAM' as const,
      sourceFilename: 'jogos.tsv', createdAt: '2026-10-17T20:00:00Z', rows: component.matchPreview.rows };
    const confirm = jasmine.createSpy('confirmHistoricalMatches').and.returnValue(of(confirmed));
    const list = jasmine.createSpy('listHistoricalMatches').and.returnValue(of([confirmed]));
    (component as any).communityService = { confirmHistoricalMatches: confirm, listHistoricalMatches: list };
    component.matchArchiveTitle = 'Taça antiga';
    component.matchArchiveEntryType = 'TEAM';
    component.matchArchiveAcknowledged = false;
    component.confirmMatchArchive();
    expect(confirm).not.toHaveBeenCalled();
    component.matchArchiveAcknowledged = true;
    component.confirmMatchArchive();
    expect(confirm).toHaveBeenCalledOnceWith(7, jasmine.any(File), {
      sheetName: 'Dados', columns: [{ columnIndex: 0, field: 'HOME' }]
    }, { title: 'Taça antiga', entryType: 'TEAM' });
    expect(component.matchArchiveOpen?.rows[0].potentialDuplicate).toBeTrue();
    expect(component.matchArchiveOpen?.rows[0].sourceDate).toBe('01/10/2022');
    expect(component.matchPreview).toBeUndefined();
    expect(component.matchArchiveAcknowledged).toBeFalse();
    expect(list).toHaveBeenCalledWith(7);
  });

  it('does not confirm an empty preview or allow non-managers to save historical matches', () => {
    component.selected = { id: 7 } as any;
    component.importMode = 'MATCHES';
    component.importFile = new File(['x'], 'jogos.xlsx');
    component.importSheetName = 'Folha1';
    component.matchPreview = { sheetName: 'Folha1', sourceRows: 0, acceptedRows: 0,
      potentialDuplicates: 0, warnings: [], rows: [] };
    component.matchArchiveTitle = 'Torneio 2020';
    component.matchArchiveAcknowledged = true;
    const confirm = jasmine.createSpy('confirmHistoricalMatches');
    (component as any).communityService = { confirmHistoricalMatches: confirm };
    component.confirmMatchArchive();
    expect(confirm).not.toHaveBeenCalled();
    component.matchPreview.acceptedRows = 1;
    (component.canManage as jasmine.Spy).and.returnValue(false);
    component.confirmMatchArchive();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('accepts an invitation once and opens the correct community route', () => {
    const pending = new Subject<any>();
    const accept = jasmine.createSpy('acceptInvite').and.returnValue(pending.asObservable());
    const reject = jasmine.createSpy('rejectInvite').and.returnValue(of(undefined));
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    (component as any).communityService = { acceptInvite: accept, rejectInvite: reject };
    (component as any).router = router;
    component.inviteAction = null;
    component.invites = [
      { id: 10, communityId: 8, communityName: 'Grupo Novo' },
      { id: 11, communityId: 9, communityName: 'Outro Grupo' }
    ] as any;
    component.selected = { id: 7 } as any;
    component.communities = [];

    component.acceptInvite(component.invites[0]);
    expect(component.inviteAction).toEqual(jasmine.objectContaining({ id: 10, kind: 'accept' }));
    component.acceptInvite(component.invites[0]);
    component.rejectInvite(component.invites[0]);
    component.acceptInvite(component.invites[1]);
    expect(accept).toHaveBeenCalledOnceWith(10);
    expect(reject).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    pending.next({ id: 8, name: 'Grupo Novo', members: [] });
    pending.complete();

    expect(component.inviteAction).toBeNull();
    expect(component.invites.map(invite => invite.id)).toEqual([11]);
    expect(component.communities.map(item => item.id)).toEqual([8]);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/menu/communities', 8]);
  });

  it('rejects an invitation once, stays on the current page and keeps other invites', () => {
    const pending = new Subject<void>();
    const accept = jasmine.createSpy('acceptInvite').and.returnValue(of({ id: 8 }));
    const reject = jasmine.createSpy('rejectInvite').and.returnValue(pending.asObservable());
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    (component as any).communityService = { acceptInvite: accept, rejectInvite: reject };
    (component as any).router = router;
    component.inviteAction = null;
    component.invites = [
      { id: 10, communityId: 8 }, { id: 11, communityId: 9 }
    ] as any;

    component.rejectInvite(component.invites[0]);
    expect(component.inviteAction).toEqual(jasmine.objectContaining({ id: 10, kind: 'reject' }));
    component.rejectInvite(component.invites[0]);
    component.acceptInvite(component.invites[1]);
    expect(reject).toHaveBeenCalledOnceWith(10);
    expect(accept).not.toHaveBeenCalled();

    pending.next();
    pending.complete();
    expect(component.inviteAction).toBeNull();
    expect(component.invites.map(invite => invite.id)).toEqual([11]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('retains an invitation after a rejected action and allows retry', () => {
    const accept = jasmine.createSpy('acceptInvite')
      .and.returnValues(throwError(() => ({ status: 403 })), of({ id: 8 }));
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    (component as any).communityService = { acceptInvite: accept };
    (component as any).router = router;
    component.inviteAction = null;
    component.communities = [];
    component.invites = [{ id: 10, communityId: 8 }] as any;

    component.acceptInvite(component.invites[0]);
    expect(component.inviteAction).toBeNull();
    expect(component.invites).toHaveSize(1);
    expect(component.errorMessage).not.toBe('');
    expect(router.navigate).not.toHaveBeenCalled();

    component.acceptInvite(component.invites[0]);
    expect(accept).toHaveBeenCalledTimes(2);
    expect(component.invites).toEqual([]);
    expect(component.errorMessage).toBe('');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/menu/communities', 8]);
  });


  it('verifies an ambiguous accept via GET and navigates after confirmed membership', () => {
    const accept = jasmine.createSpy('acceptInvite')
      .and.returnValue(throwError(() => ({ status: 504 })));
    const mine = jasmine.createSpy('mine').and.returnValue(of([{ id: 8, name: 'Grupo Novo' }]));
    const invites = jasmine.createSpy('myInvites').and.returnValue(of([]));
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    (component as any).communityService = { acceptInvite: accept, mine, myInvites: invites };
    (component as any).router = router;
    component.inviteAction = null;
    component.inviteOutcomeUnknown = null;
    component.invites = [{ id: 10, communityId: 8, communityName: 'Grupo Novo' }] as any;

    component.acceptInvite(component.invites[0]);

    expect(accept).toHaveBeenCalledOnceWith(10);
    expect(invites).toHaveBeenCalledTimes(1);
    expect(mine).toHaveBeenCalledTimes(1);
    expect(component.inviteOutcomeUnknown).toBeNull();
    expect(component.invites).toEqual([]);
    expect(component.inviteVerifyLoading).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/menu/communities', 8]);
  });

  it('rechecks a failed reject and allows a new decision only after confirming pending', () => {
    const reject = jasmine.createSpy('rejectInvite')
      .and.returnValues(throwError(() => ({ status: 503 })), of(undefined));
    const pending = new Subject<any[]>();
    const invites = jasmine.createSpy('myInvites')
      .and.returnValue(pending.asObservable());
    const mine = jasmine.createSpy('mine').and.returnValue(of([]));
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    (component as any).communityService = { rejectInvite: reject, myInvites: invites, mine };
    (component as any).router = router;
    component.inviteAction = null;
    component.inviteOutcomeUnknown = null;
    component.invites = [{ id: 10, communityId: 8, communityName: 'Grupo' }] as any;

    component.rejectInvite(component.invites[0]);
    expect(component.inviteOutcomeUnknown).toEqual(jasmine.objectContaining({ id: 10, communityId: 8, kind: 'reject' }));
    expect(component.inviteVerifyLoading).toBeTrue();

    component.rejectInvite(component.invites[0]);
    expect(reject).toHaveBeenCalledTimes(1);
    pending.next([{ id: 10, communityId: 8, communityName: 'Grupo' }]);
    pending.complete();

    expect(component.inviteOutcomeUnknown).toBeNull();
    expect(component.inviteVerificationMessage).toContain('pendente');
    component.rejectInvite(component.invites[0]);
    expect(reject).toHaveBeenCalledTimes(2);
    expect(component.invites).toEqual([]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps ambiguous invitations blocked when verification fails and provides a retry', () => {
    const accept = jasmine.createSpy('acceptInvite')
      .and.returnValue(throwError(() => ({ name: 'TimeoutError' })));
    const invites = jasmine.createSpy('myInvites')
      .and.returnValues(throwError(() => ({ status: 503 })), of([]));
    const mine = jasmine.createSpy('mine').and.returnValue(of([]));
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    (component as any).communityService = { acceptInvite: accept, myInvites: invites, mine };
    (component as any).router = router;
    component.inviteAction = null;
    component.inviteOutcomeUnknown = null;
    component.invites = [{ id: 10, communityId: 8, communityName: 'Grupo' }] as any;

    component.acceptInvite(component.invites[0]);
    expect(component.inviteOutcomeUnknown).toEqual(jasmine.objectContaining({ id: 10, communityId: 8, kind: 'accept' }));
    expect(component.inviteVerificationMessage).toContain('Não foi possível confirmar');
    component.acceptInvite(component.invites[0]);
    expect(accept).toHaveBeenCalledTimes(1);

    component.verifyInviteOutcome();
    expect(invites).toHaveBeenCalledTimes(2);
    expect(component.inviteOutcomeUnknown).toBeNull();
    expect(component.invites).toEqual([]);
    expect(component.inviteVerificationMessage).toContain('já não está pendente');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('retains a pending invite after an uncertain accept and a successful verification', () => {
    const accept = jasmine.createSpy('acceptInvite')
      .and.returnValue(throwError(() => ({ status: 0 })));
    const invite = { id: 10, communityId: 8, communityName: 'Grupo' };
    (component as any).communityService = {
      acceptInvite: accept,
      myInvites: jasmine.createSpy('myInvites').and.returnValue(of([invite])),
      mine: jasmine.createSpy('mine').and.returnValue(of([]))
    };
    component.inviteAction = null;
    component.inviteOutcomeUnknown = null;
    component.invites = [invite] as any;

    component.acceptInvite(component.invites[0]);
    expect(component.inviteOutcomeUnknown).toBeNull();
    expect(component.inviteVerificationMessage).toContain('continua pendente');
    expect(component.invites.map(item => item.id)).toEqual([10]);
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it('shows only the latest match archive list and ignores stale errors and loading completion', () => {
    component.selected = { id: 7 } as any;
    const first = new Subject<any[]>();
    const second = new Subject<any[]>();
    (component as any).communityService = {
      listHistoricalMatches: jasmine.createSpy('listHistoricalMatches')
        .and.returnValues(first.asObservable(), second.asObservable())
    };
    component.loadMatchArchives(7);
    component.loadMatchArchives(7);
    const newest = [{ id: 51, title: 'Recentes' }];
    second.next(newest);
    first.error(new Error('stale'));
    expect(component.matchArchiveSummaries).toEqual(newest as any);
    expect(component.matchArchivesError).toBe('');
    expect(component.matchArchivesLoading).toBeTrue();
    second.complete();
    expect(component.matchArchivesLoading).toBeFalse();
  });

  it('shows only the latest historical standings list when requests finish out of order', () => {
    component.selected = { id: 7 } as any;
    const first = new Subject<any[]>();
    const second = new Subject<any[]>();
    (component as any).communityService = {
      listHistoricalStandings: jasmine.createSpy('listHistoricalStandings')
        .and.returnValues(first.asObservable(), second.asObservable())
    };
    component.loadArchivedStandings(7);
    component.loadArchivedStandings(7);
    second.next([{ id: 60, title: 'Época 2026' }]);
    first.next([{ id: 59, title: 'Época antiga' }]);
    first.complete();
    expect(component.archiveSummaries.map(item => item.id)).toEqual([60]);
    expect(component.archivesLoading).toBeTrue();
    second.complete();
    expect(component.archivesLoading).toBeFalse();
  });

  it('ignores old match details after navigating and unblocks the new community', () => {
    const older = new Subject<any>();
    const newer = new Subject<any>();
    const details = jasmine.createSpy('historicalMatchDetails')
      .and.returnValues(older.asObservable(), newer.asObservable());
    (component as any).communityService = { historicalMatchDetails: details };
    component.selected = { id: 7 } as any;
    component.openMatchArchive(50);
    expect(component.matchArchiveOpeningId).toBe(50);
    (component as any).invalidateArchiveRequests();
    component.selected = { id: 8 } as any;
    component.matchArchiveOpen = undefined;
    component.openMatchArchive(51);
    older.next({ id: 50, rows: [] });
    older.complete();
    expect(component.matchArchiveOpen).toBeUndefined();
    expect(component.matchArchiveOpeningId).toBe(51);
    newer.next({ id: 51, rows: [] });
    newer.complete();
    expect((component as any).matchArchiveOpen?.id).toBe(51);
    expect(component.matchArchiveOpeningId).toBeUndefined();
    expect(details).toHaveBeenCalledWith(8, 51);
  });

  it('ignores stale standings detail errors and allows opening a new archive', () => {
    const older = new Subject<any>();
    const newer = new Subject<any>();
    (component as any).communityService = {
      historicalStandingDetails: jasmine.createSpy('historicalStandingDetails')
        .and.returnValues(older.asObservable(), newer.asObservable())
    };
    component.selected = { id: 7 } as any;
    component.openArchivedStanding(50);
    (component as any).invalidateArchiveRequests();
    component.selected = { id: 8 } as any;
    component.archiveOpen = undefined;
    component.openArchivedStanding(51);
    older.error(new Error('old request'));
    expect(component.archivesError).toBe('');
    expect(component.archiveOpeningId).toBe(51);
    newer.next({ id: 51, rows: [] });
    newer.complete();
    expect((component as any).archiveOpen?.id).toBe(51);
    expect(component.archiveOpeningId).toBeUndefined();
  });

  it('only displays match archives from the selected community and keeps repeated rows', () => {
    component.selected = { id: 9 } as any;
    const archive = { id: 50, title: '2021', entryType: 'INDIVIDUAL' as const,
      sourceFilename: 'jogos.csv', createdAt: '2026-10-17T20:00:00Z',
      rows: [
        { sourceRow: 4, home: 'A', away: 'B', homeScore: 1, awayScore: 0,
          sourceDate: '1/5/2021', sourceRound: '2', potentialDuplicate: false },
        { sourceRow: 5, home: 'A', away: 'B', homeScore: 1, awayScore: 0,
          sourceDate: '1/5/2021', sourceRound: '2', potentialDuplicate: true }
      ] };
    (component as any).communityService = {
      listHistoricalMatches: () => of([archive]),
      historicalMatchDetails: jasmine.createSpy().and.returnValue(of(archive))
    };
    component.loadMatchArchives(9);
    component.openMatchArchive(50);
    expect(component.matchArchiveSummaries.length).toBe(1);
    expect(component.matchArchiveOpen?.rows.length).toBe(2);
    expect(component.matchArchiveOpen?.rows[1].potentialDuplicate).toBeTrue();
    component.selected = { id: 10 } as any;
    component.openMatchArchive(50);
    expect(component.matchArchiveOpen).toBeUndefined();
  });


  it('recognizes player results from a CNG-like sheet and suggests rounds without forcing the choice', () => {
    component.importMode = 'MATCHES';
    component.importPreview = { fileName: 'grupo.xlsx', sheets: [{
      name: 'Sheet1', structure: 'TABULAR', nonEmptyRows: 41,
      headers: ['Data', 'Cepo', 'V', 'D', 'Pontos'],
      sampleRows: [['31 Ago', 'Jogador A', '1', '', '3'], ['7 Set', 'Jogador B', '', '1', '0']],
      columnSuggestions: [
        { columnIndex: 0, header: 'Data', field: 'DATE', confidence: 0.95 },
        { columnIndex: 1, header: 'Cepo', field: 'UNKNOWN', confidence: 0 },
        { columnIndex: 2, header: 'V', field: 'WIN', confidence: 0.9 },
        { columnIndex: 3, header: 'D', field: 'UNKNOWN', confidence: 0 },
        { columnIndex: 4, header: 'Pontos', field: 'POINTS', confidence: 0.9 }
      ]
    }] };
    component.selectImportSheet('Sheet1');
    expect(component.recommendedImportMode).toBe('ROUNDS');
    expect(component.importMode).toBe('MATCHES');
    const cachedInspection = component.importPreview;
    component.selectImportMode('ROUNDS');
    expect(component.importPreview).toBe(cachedInspection);
    expect(component.importMappings.map(x => x.field)).toEqual(['DATE', 'PLAYER', 'WIN', 'LOSS', 'POINTS']);
    expect(component.sourceDatesNeedYear).toBeTrue();
    expect(component.importDefaultYear).toBeNull();
  });

  it('gives helpful errors rather than calling the API with fields meant for a different history type', () => {
    component.selected = { id: 7 } as any;
    component.importFile = new File(['dummy'], 'group.xlsx');
    component.importSheetName = 'Sheet1';
    component.importMappings = [{ columnIndex: 0, field: 'DATE', header: 'Data', confidence: 1 }];
    const matches = jasmine.createSpy('previewHistoricalMatches');
    const standings = jasmine.createSpy('previewHistoricalStandings');
    (component as any).communityService = {
      previewHistoricalMatches: matches, previewHistoricalStandings: standings
    };
    component.importMode = 'MATCHES';
    component.previewHistoricalMatches();
    expect(matches).not.toHaveBeenCalled();
    expect(component.importFileError).toContain('Casa');
    component.importMode = 'STANDINGS';
    component.previewArchiveImport();
    expect(standings).not.toHaveBeenCalled();
    expect(component.importFileError).toContain('Nome');
  });

  it('requires the organizer to provide the year for dates such as 31 Ago', () => {
    component.selected = { id: 7 } as any;
    component.importFile = new File(['dummy'], 'group.xlsx');
    component.importSheetName = 'Sheet1';
    component.selectedSeasonId = 19;
    component.importMappings = [
      { columnIndex: 0, field: 'DATE', header: 'Data', confidence: 1 },
      { columnIndex: 1, field: 'PLAYER', header: 'Cepo', confidence: 1 }
    ];
    component.sourceDatesNeedYear = true;
    component.importDefaultYear = null;
    const plan = jasmine.createSpy('finalImportPlan');
    (component as any).communityService = { finalImportPlan: plan };
    component.buildImportFinalPlan();
    expect(plan).not.toHaveBeenCalled();
    expect(component.importFileError).not.toBe('');
    component.importDefaultYear = 2025;
    plan.and.returnValue(of({ rounds: [] }));
    component.buildImportFinalPlan();
    expect(plan).toHaveBeenCalled();
  });

  it('discards an Excel import plan after its source context changes', () => {
    component.selected = { id: 7 } as any;
    component.importFile = new File(['data'], 'jornadas.xlsx');
    component.importSheetName = 'Dados';
    component.selectedSeasonId = 19;
    component.importDefaultYear = 2026;
    component.importRevision = 0;
    component.importMappings = [{ columnIndex: 0, header: 'Jogador', field: 'PLAYER', confidence: 1 }];
    component.importSourceRound = 'Jornada 2';
    const old = new Subject<any>();
    const latest = new Subject<any>();
    const request = jasmine.createSpy('finalImportPlan').and.returnValues(old, latest);
    (component as any).communityService = { finalImportPlan: request };
    component.buildImportFinalPlan();
    expect(component.importPlanLoading).toBeTrue();
    component.importSourceRound = 'Jornada 3';
    component.invalidateImportPlan();
    expect(component.importPlanLoading).toBeFalse();
    component.buildImportFinalPlan();
    expect(request).toHaveBeenCalledTimes(2);
    old.next({ invalidDates: 0, roundsNeedingYear: 0, rounds: [{ old: true }] });
    old.complete();
    expect(component.importFinalPlan).toBeUndefined();
    expect(component.importPlanLoading).toBeTrue();
    latest.next({ invalidDates: 0, roundsNeedingYear: 0, rounds: [{ current: true }] });
    latest.complete();
    expect(component.importFinalPlan?.rounds[0].current).toBeTrue();
    expect(component.importPlanLoading).toBeFalse();
  });

  it('rejects a delayed import plan after a season change without allowing confirmation', () => {
    component.selected = { id: 7 } as any;
    component.importFile = new File(['data'], 'historico.csv');
    component.importSheetName = 'Dados';
    component.selectedSeasonId = 10;
    component.importDefaultYear = 2026;
    component.importRevision = 0;
    // This suite bypasses property initializers with Object.create().
    component.importMappings = [];
    const pending = new Subject<any>();
    const request = jasmine.createSpy('finalImportPlan').and.returnValue(pending);
    const confirm = jasmine.createSpy('confirmImportRounds');
    (component as any).communityService = { finalImportPlan: request, confirmImportRounds: confirm };
    component.buildImportFinalPlan();
    component.selectedSeasonId = 11;
    pending.next({ invalidDates: 0, roundsNeedingYear: 0, rounds: [] });
    pending.complete();
    expect(component.importFinalPlan).toBeUndefined();
    expect(component.importPlanLoading).toBeFalse();
    component.confirmHistoricalImport();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('sends optional source competition and round identifiers to both plan and confirmation', () => {
    component.selected = { id: 7 } as any;
    component.importFile = new File(['data'], 'single-round.csv');
    component.importSheetName = 'Dados';
    component.selectedSeasonId = 19;
    component.importDefaultYear = 2026;
    component.importSourceCompetition = ' Liga de Verão ';
    component.importSourceRound = ' Jornada 2 ';
    component.importMappings = [
      { columnIndex: 0, field: 'PLAYER', header: 'Jogador', confidence: 1 },
      { columnIndex: 1, field: 'DATE', header: 'Data', confidence: 1 }
    ];
    const plan = jasmine.createSpy('finalImportPlan').and.returnValue(of({
      invalidDates: 0, roundsNeedingYear: 0, rounds: []
    }));
    const confirm = jasmine.createSpy('confirmImportRounds').and.returnValue(of({
      createdRounds: 1, skippedDuplicateRounds: 0, createdEntries: 2
    }));
    (component as any).communityService = { finalImportPlan: plan, confirmImportRounds: confirm };
    spyOn(component, 'loadCompetition');
    component.buildImportFinalPlan();
    expect(plan).toHaveBeenCalledWith(7, component.importFile, jasmine.anything(), {
      seasonId: 19, defaultYear: 2026,
      sourceCompetition: 'Liga de Verão', sourceRound: 'Jornada 2'
    });
    component.confirmHistoricalImport();
    expect(confirm).toHaveBeenCalledWith(7, component.importFile, jasmine.anything(), {
      seasonId: 19, defaultYear: 2026,
      sourceCompetition: 'Liga de Verão', sourceRound: 'Jornada 2'
    });
    component.importSourceRound = 'Jornada 3';
    component.invalidateImportPlan();
    expect(component.importFinalPlan).toBeUndefined();
  });

  it('requires review and a title before writing final standings', () => {
    component.selected = { id: 7 } as any;
    component.importMode = 'STANDINGS';
    component.importFile = new File(['data'], 'tabela.csv');
    component.importSheetName = 'Dados';
    component.importMappings = [
      { columnIndex: 0, header: 'Equipa', field: 'NAME', confidence: 1 },
      { columnIndex: 1, header: 'Pts', field: 'POINTS', confidence: 1 }
    ];
    component.archivePreview = {
      sheetName: 'Dados', sourceRows: 1, acceptedRows: 1, duplicateRows: 0,
      warnings: [], rows: [{ position: 1, name: 'Águias', played: null,
        wins: null, draws: null, losses: null, points: 8, goalsFor: null, goalsAgainst: null }]
    };
    component.archiveTitle = 'Época antiga';
    component.archiveAcknowledged = false;
    const confirm = jasmine.createSpy('confirmHistoricalStandings');
    (component as any).communityService = { confirmHistoricalStandings: confirm };
    component.confirmArchiveImport();
    expect(confirm).not.toHaveBeenCalled();
    expect(component.importFileError).not.toBe('');

    component.archiveAcknowledged = true;
    confirm.and.returnValue(of({ id: 15, title: 'Época antiga', entryType: 'TEAM', seasonId: null,
      sourceFilename: 'tabela.csv', createdAt: '2026-10-17T20:00:00Z', rows: component.archivePreview.rows }));
    (component as any).communityService.listHistoricalStandings = () => of([]);
    component.archiveEntryType = 'TEAM';
    component.archiveSeasonId = null;
    component.confirmArchiveImport();
    expect(confirm).toHaveBeenCalledWith(7, jasmine.any(File), {
      sheetName: 'Dados',
      columns: [{ columnIndex: 0, field: 'NAME' }, { columnIndex: 1, field: 'POINTS' }]
    }, { title: 'Época antiga', entryType: 'TEAM', seasonId: null });
    expect(component.archiveConfirmed?.rows[0].points).toBe(8);
    expect(component.archivePreview).toBeUndefined();
  });


  it('invalidates a previously prepared Excel plan when another season is selected from rankings', () => {
    component.selected = { id: 7 } as any;
    component.selectedSeasonId = 10;
    component.importPlanLoading = true;
    component.importFinalPlan = { invalidDates: 0, roundsNeedingYear: 0, rounds: [] };
    component.importPointsAcknowledged = true;
    const reload = spyOn(component, 'loadCompetition');
    component.selectSeason('11');
    expect(component.selectedSeasonId).toBe(11);
    expect(component.importFinalPlan).toBeUndefined();
    expect(component.importPlanLoading).toBeFalse();
    expect(component.importPointsAcknowledged).toBeFalse();
    expect(reload).toHaveBeenCalledWith(component.selected, 11);
  });

  it('keeps the current import plan if a season selector is set to the same season', () => {
    component.selected = { id: 7 } as any;
    component.selectedSeasonId = 10;
    const existingPlan = { invalidDates: 0, roundsNeedingYear: 0, rounds: [] };
    component.importFinalPlan = existingPlan;
    spyOn(component, 'loadCompetition');
    component.selectSeason('10');
    expect(component.importFinalPlan).toBe(existingPlan);
  });

  it('ignores older season responses and keeps the latest competition loading state', () => {
    const earlier = new Subject<any>();
    const latest = new Subject<any>();
    component.selected = { id: 7 } as any;
    (component as any).communityService = {
      competition: jasmine.createSpy('competition').and.returnValues(
        earlier.asObservable(), latest.asObservable())
    };
    const overview = (winPoints: number) => ({
      standings: [], seasons: [], selectedSeasonId: null, activeSeasonId: null,
      settings: { rankingsEnabled: true, winPoints, drawPoints: 1, lossPoints: 0 },
      rounds: []
    });
    component.loadCompetition(component.selected, 11);
    component.loadCompetition(component.selected, 12);
    earlier.next(overview(3));
    earlier.complete();
    expect(component.competition).toBeUndefined();
    expect(component.competitionLoading).toBeTrue();
    latest.next(overview(4));
    latest.complete();
    expect(component.competition?.settings.winPoints).toBe(4);
    expect(component.competitionLoading).toBeFalse();
  });

  it('never displays sessions from another community after navigation', () => {
    const earlier = new Subject<SessionSummary[]>();
    const latest = new Subject<SessionSummary[]>();
    const a = { id: 7 } as any;
    const b = { id: 8 } as any;
    (component as any).communityService = {
      sessions: jasmine.createSpy('sessions').and.returnValues(
        earlier.asObservable(), latest.asObservable())
    };
    component.selected = a;
    component.loadCommunitySessions(a);
    component.selected = b;
    component.loadCommunitySessions(b);
    latest.next([{ ...session, id: 80 }]);
    earlier.next([{ ...session, id: 70 }]);
    expect(component.communitySessions.map(item => item.id)).toEqual([80]);
    earlier.complete();
    expect(component.sessionsLoading).toBeTrue();
    latest.complete();
    expect(component.sessionsLoading).toBeFalse();
  });

  it('renders imported names without @null and displays verified handles', () => {
    const imported = { profileId: null, username: null, fullName: 'Ferreirinha' };
    expect(component.roundEntryHandle(imported)).not.toContain('@null');
    expect(component.roundEntryHandle(imported)).not.toContain('@undefined');
    expect(component.roundEntryHandle(imported)).not.toBe('');
    expect(component.roundEntryHandle({ username: 'TMF14' }))
      .toBe('@TMF14');
  });

  it('keeps non-participants out of rankings by default but allows showing every member', () => {
    component.competition = { standings: [
      { profileId: null, username: null, fullName: 'Ferreirinha', games: 3, points: 6 },
      { profileId: 17, username: 'TMF14', fullName: 'Miguel Ferreira', games: 0, points: 0 }
    ] } as any;
    expect(component.rankingParticipants.map(row => row.fullName)).toEqual(['Ferreirinha']);
    expect(component.displayedRankings).toHaveSize(1);
    component.showAllStandings = true;
    expect(component.displayedRankings).toHaveSize(2);
  });


  it('allows an ordinary member to claim their own unlinked historical name only after confirmation', () => {
    component.selected = { id: 7, myRole: 'MEMBER' } as any;
    component.historicalPlayers = [{ playerId: 5, historicalName: 'Ferreirinha',
      linkedUsername: null, linkStatus: 'UNLINKED' }];
    component.historicalPlayerId = 5;
    component.historicalClaimAcknowledged = false;
    const claim = jasmine.createSpy('claimHistoricalPlayer').and.returnValue(of({
      id: 60, playerId: 5, historicalName: 'Ferreirinha', targetUsername: 'TMF14', status: 'ACCEPTED'
    }));
    (component as any).communityService = { claimHistoricalPlayer: claim };
    component.claimHistoricalName();
    expect(claim).not.toHaveBeenCalled();
    component.historicalClaimAcknowledged = true;
    spyOn(component, 'loadHistoricalLinks');
    spyOn(component, 'loadCompetition');
    component.claimHistoricalName();
    expect(claim).toHaveBeenCalledOnceWith(7, 5);
    expect(component.historicalPlayerId).toBeNull();
    expect(component.historicalClaimAcknowledged).toBeFalse();
    expect(component.loadCompetition).toHaveBeenCalled();
  });

  it('does not allow linked or pending names to be claimed', () => {
    component.selected = { id: 7, myRole: 'MEMBER' } as any;
    component.historicalPlayers = [
      { playerId: 5, historicalName: 'Ferreirinha', linkedUsername: null, linkStatus: 'ACCEPTED' },
      { playerId: 6, historicalName: 'Outro', linkedUsername: null, linkStatus: 'PENDING' }
    ];
    component.historicalClaimAcknowledged = true;
    const claim = jasmine.createSpy('claimHistoricalPlayer');
    (component as any).communityService = { claimHistoricalPlayer: claim };
    for (const id of [5, 6]) {
      component.historicalPlayerId = id;
      component.claimHistoricalName();
    }
    expect(claim).not.toHaveBeenCalled();
  });

  it('allows an owner to unlink only a claim already loaded as their own', () => {
    component.selected = { id: 7, myRole: 'MEMBER' } as any;
    const item = { id: 60, playerId: 5, historicalName: 'Ferreirinha',
      targetUsername: 'TMF14', status: 'ACCEPTED' as const };
    const release = jasmine.createSpy('releaseHistoricalClaim').and.returnValue(of(undefined));
    (component as any).communityService = { releaseHistoricalClaim: release };
    component.historicalClaims = [];
    component.historicalReleaseId = null;
    component.releaseHistoricalName(item);
    expect(release).not.toHaveBeenCalled();
    component.historicalClaims = [item];
    spyOn(component, 'loadHistoricalLinks');
    spyOn(component, 'loadCompetition');
    component.releaseHistoricalName(item);
    expect(release).toHaveBeenCalledOnceWith(7, 60);
    expect(component.loadCompetition).toHaveBeenCalled();
  });

  it('does not show historical claims from another community after navigation', () => {
    const pending = new Subject<any[]>();
    component.selected = { id: 7, myRole: 'MEMBER' } as any;
    component.historicalClaims = [];
    (component as any).communityService = {
      myHistoricalClaims: () => pending.asObservable(),
      historicalPlayerCandidates: () => of([])
    };
    component.loadHistoricalLinks(7);
    component.selected = { id: 8, myRole: 'MEMBER' } as any;
    pending.next([{ id: 60, playerId: 5, historicalName: 'Ferreirinha',
      targetUsername: 'TMF14', status: 'ACCEPTED' }]);
    expect(component.historicalClaims).toEqual([]);
  });

  it('opens a non-member community detail if the private memberships API fails', () => {
    const presentation = {
      id: 19, name: 'Desporto da Vila', description: 'Futebol para todos',
      sport: 'Futebol', sports: ['Futebol'],
      photoUrl: null, visibility: 'PUBLIC'
    } as const;
    const service = {
      mine: jasmine.createSpy('mine').and.returnValue(throwError(() => new Error('Private API offline'))),
      myInvites: jasmine.createSpy('myInvites').and.returnValue(of([])),
      presentation: jasmine.createSpy('presentation').and.returnValue(of(presentation))
    };
    const route = {
      snapshot: {
        paramMap: { get: (key: string) => key === 'id' ? '19' : null },
        queryParamMap: { get: () => null }
      }
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any, route as any, {} as any);
    page.isDetailMode = true;
    page.reload();

    expect(service.mine).toHaveBeenCalled();
    expect(service.presentation).toHaveBeenCalledOnceWith(19);
    expect(page.loading).toBeFalse();
    expect(page.presentationLoading).toBeFalse();
    expect(page.communityPresentation?.name).toBe('Desporto da Vila');
    expect(page.errorMessage).toBe('');
  });

  it('keeps community exploration usable when the private memberships API fails', () => {
    const service = {
      mine: jasmine.createSpy('mine').and.returnValue(throwError(() => new Error('Private API offline'))),
      myInvites: jasmine.createSpy('myInvites').and.returnValue(of([])),
      search: jasmine.createSpy('search').and.returnValue(of({
        communities: [{
          id: 25, name: 'Jogos Lisboa', description: null,
          sport: 'Padel', sports: ['Padel'], photoUrl: null, visibility: 'PUBLIC'
        }], page: 0, hasMore: false
      }))
    };
    const route = {
      snapshot: {
        paramMap: { get: () => null },
        queryParamMap: { get: () => null }
      }
    };
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      route as any, router as any);
    page.reload();
    page.communitySearchName = 'Jogos';
    page.searchCommunities();

    expect(page.errorMessage).toBe('');
    expect(page.loading).toBeFalse();
    expect(page.communitySearchError).toBe('');
    expect(page.communitySearchResults.map(group => group.name)).toEqual(['Jogos Lisboa']);
    expect(service.search).toHaveBeenCalledOnceWith('Jogos', '', 0);
  });

  it('still reports failed private memberships on My communities', () => {
    const service = {
      mine: jasmine.createSpy('mine').and.returnValue(throwError(() => new Error('Private API offline'))),
      myInvites: jasmine.createSpy('myInvites').and.returnValue(of([]))
    };
    const route = {
      snapshot: {
        paramMap: { get: () => null },
        queryParamMap: { get: (key: string) => key === 'view' ? 'mine' : null }
      }
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any, route as any, {} as any);
    page.reload();

    expect(page.loading).toBeFalse();
    expect(page.errorMessage).toBeTruthy();
  });

  it('does not mistake a pending-join lookup outage for no existing request', () => {
    const service = {
      myPendingJoinRequest: jasmine.createSpy('myPendingJoinRequest')
        .and.returnValue(throwError(() => ({ status: 503 }))),
      requestJoin: jasmine.createSpy('requestJoin').and.returnValue(of({ id: 1 }))
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      {} as any, {} as any);
    page.communityPresentation = {
      id: 19, name: 'Comunidade Fechada', description: null,
      sport: 'Futebol', photoUrl: null, visibility: 'PRIVATE'
    };
    page.retryPendingJoinLookup();
    expect(page.pendingJoinLookupLoading).toBeFalse();
    expect(page.pendingJoinLookupError).toBeTrue();
    expect(page.membershipActionMessage).toContain('verificar');
    page.joinPresentedCommunity();
    expect(service.requestJoin).not.toHaveBeenCalled();

    service.myPendingJoinRequest.and.returnValue(of({
      id: 33, communityId: 19, communityName: 'Comunidade Fechada',
      requesterUsername: 'player', status: 'PENDING', createdAt: '2026-10-18'
    }));
    page.retryPendingJoinLookup();
    expect(page.pendingJoinLookupError).toBeFalse();
    expect(page.joinRequestSent).toBeTrue();
    expect(page.membershipActionMessage).toContain('enviado');
    page.joinPresentedCommunity();
    expect(service.requestJoin).not.toHaveBeenCalled();
  });

  it('interprets HTTP 404 from the pending-join endpoint as no pending request', () => {
    const service = {
      myPendingJoinRequest: jasmine.createSpy('myPendingJoinRequest')
        .and.returnValue(throwError(() => ({ status: 404 }))),
      requestJoin: jasmine.createSpy('requestJoin').and.returnValue(of({
        id: 35, communityId: 19, communityName: 'Comunidade Fechada',
        requesterUsername: 'player', status: 'PENDING', createdAt: '2026-10-18'
      }))
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      {} as any, {} as any);
    page.communityPresentation = {
      id: 19, name: 'Comunidade Fechada', description: null,
      sport: 'Futebol', photoUrl: null, visibility: 'PRIVATE'
    };
    page.retryPendingJoinLookup();
    expect(page.pendingJoinLookupError).toBeFalse();
    expect(page.joinRequestSent).toBeFalse();
    page.joinPresentedCommunity();
    expect(service.requestJoin).toHaveBeenCalledOnceWith(19);
    expect(page.joinRequestSent).toBeTrue();
    expect(page.membershipActionMessage).toContain('enviado');
  });

  it('does not let an old pending lookup error block a newer successful lookup', () => {
    const delayed = new Subject<any>();
    const service = {
      myPendingJoinRequest: jasmine.createSpy('myPendingJoinRequest')
        .and.returnValues(delayed.asObservable(), of(null)),
      requestJoin: jasmine.createSpy('requestJoin').and.returnValue(of({}))
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      {} as any, {} as any);
    page.communityPresentation = {
      id: 19, name: 'Comunidade Fechada', description: null,
      sport: 'Futebol', photoUrl: null, visibility: 'PRIVATE'
    };
    page.retryPendingJoinLookup();
    expect(page.pendingJoinLookupLoading).toBeTrue();
    // Simulate opening a different community while the old lookup is in flight.
    page.communityPresentation = {
      ...page.communityPresentation, id: 20
    };
    (page as any).loadMyPendingJoinRequest(20);
    expect(page.pendingJoinLookupLoading).toBeFalse();
    delayed.error({ status: 503 });
    expect(page.pendingJoinLookupError).toBeFalse();
    expect(page.membershipActionMessage).toBe('');
  });

  it('keeps community name, sport and result page in the URL and detail navigation', () => {
    const service = {
      search: jasmine.createSpy('search').and.returnValue(of({
        communities: [{
          id: 42, name: 'Liga de Bairro', description: null,
          sport: 'Futebol', photoUrl: null, visibility: 'PUBLIC'
        }], page: 2, hasMore: false
      }))
    };
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    const route = {
      snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      route as any, router as any);
    page.communitySearchName = ' Liga ';
    page.communitySearchSport = ' Futebol ';
    page.searchCommunities(2);

    expect(service.search).toHaveBeenCalledOnceWith('Liga', 'Futebol', 2);
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      relativeTo: route,
      queryParams: { search: '1', name: 'Liga', sport: 'Futebol', page: 2 },
      queryParamsHandling: 'merge', replaceUrl: true
    }));
    page.openCommunityPresentation(page.communitySearchResults[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42], {
      queryParams: { search: '1', name: 'Liga', sport: 'Futebol', page: 2 }
    });
  });

  it('restores the filtered results from a bookmark or browser Back without changing URL', () => {
    const service = {
      mine: jasmine.createSpy('mine').and.returnValue(of([])),
      myInvites: jasmine.createSpy('myInvites').and.returnValue(of([])),
      search: jasmine.createSpy('search').and.returnValue(of({
        communities: [{
          id: 42, name: 'Liga de Bairro', description: null,
          sport: 'Futebol', photoUrl: null, visibility: 'PUBLIC'
        }], page: 1, hasMore: false
      }))
    };
    const params: Record<string, string> = {
      search: '1', name: 'Liga', sport: 'Futebol', page: '1'
    };
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    const route = {
      snapshot: {
        paramMap: { get: () => null },
        queryParamMap: { get: (k: string) => params[k] ?? null }
      }
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      route as any, router as any);
    page.ngOnInit();

    expect(page.communitySearchName).toBe('Liga');
    expect(page.communitySearchSport).toBe('Futebol');
    expect(page.communitySearchPage).toBe(1);
    expect(page.communitySearchPerformed).toBeTrue();
    expect(page.communitySearchResults.map(c => c.name)).toEqual(['Liga de Bairro']);
    expect(service.search).toHaveBeenCalledOnceWith('Liga', 'Futebol', 1);
    // Rehydrating the URL never creates another history entry.
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('takes the detail Back button to the same search and handles direct links without context', () => {
    const params: Record<string, string> = {
      search: '1', name: 'Liga', sport: 'Futebol', page: '2'
    };
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    const route = {
      snapshot: { queryParamMap: { get: (k: string) => params[k] ?? null } }
    };
    const page = new CommunitiesComponent({} as any, {} as any, {} as any,
      route as any, router as any);
    page.backToCommunities();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities'], {
      queryParams: { search: '1', name: 'Liga', sport: 'Futebol', page: '2' }
    });

    delete params['search'];
    page.backToCommunities();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities'], {
      queryParams: undefined
    });
  });

  it('ignores invalid or negative community search page parameters', () => {
    const service = {
      mine: jasmine.createSpy('mine').and.returnValue(of([])),
      myInvites: jasmine.createSpy('myInvites').and.returnValue(of([])),
      search: jasmine.createSpy('search').and.returnValue(of({
        communities: [], page: 0, hasMore: false
      }))
    };
    const params: Record<string, string> = {
      search: '1', name: 'Liga', sport: 'Futebol', page: '-100'
    };
    const route = {
      snapshot: {
        paramMap: { get: () => null },
        queryParamMap: { get: (k: string) => params[k] ?? null }
      }
    };
    const page = new CommunitiesComponent(service as any, {} as any, {} as any,
      route as any, {} as any);
    page.ngOnInit();
    expect(service.search).toHaveBeenCalledOnceWith('Liga', 'Futebol', 0);
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
    expect(component.canBrowseHistoricalArchives).toBeTrue();
    component.setTab('ranking');
    expect(component.activeTab).toBe('ranking');
    component.setTab('stats');
    expect(component.activeTab).toBe('ranking');
    group.individualTournamentsEnabled = false;
    group.teamTournamentsEnabled = false;
    component.setTab('home');
    expect(component.canBrowseHistoricalArchives).toBeFalse();
    component.setTab('ranking');
    expect(component.activeTab).toBe('home');
    group.rankingsEnabled = true;
    component.setTab('ranking');
    expect(component.activeTab).toBe('ranking');
  });

  it('shows archived history without enabling live standings or tournament features', () => {
    component.selected = {
      id: 7, rankingsEnabled: false, individualTournamentsEnabled: false,
      teamTournamentsEnabled: false
    } as any;
    component.archiveSummaries = [];
    component.matchArchiveSummaries = [];
    component.activeTab = 'home';
    expect(component.canBrowseHistoricalArchives).toBeFalse();
    component.matchArchiveSummaries = [{
      id: 10, title: 'Taça 2020', entryType: 'TEAM',
      sourceFilename: 'games.csv', createdAt: '2026-10-17T20:00:00Z'
    }];
    expect(component.canBrowseHistoricalArchives).toBeTrue();
    component.setTab('ranking');
    expect(component.activeTab).toBe('ranking');
    expect(component.selected?.rankingsEnabled).toBeFalse();
    component.setTab('stats');
    expect(component.activeTab).toBe('ranking');
    component.matchArchiveSummaries = [];
    component.archiveSummaries = [{
      id: 11, title: 'Época 2021', entryType: 'INDIVIDUAL', seasonId: null,
      sourceFilename: 'table.xlsx', createdAt: '2026-10-17T20:00:00Z'
    }];
    expect(component.canBrowseHistoricalArchives).toBeTrue();
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
