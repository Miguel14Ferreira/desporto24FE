import { of, Subject, throwError } from 'rxjs';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { AuthenticationService } from '../../services/authethication.service';
import { CommunityTournamentsService } from '../../services/community-tournaments.service';
import { CommunityGroup } from '../model/community-group';
import { CommunityTournament, TournamentMatch, TournamentPage, TournamentParticipant, TournamentParticipantPage, TournamentTeam, InlineSpeedOverview } from '../model/community-tournament';
import { CommunityTournamentsComponent } from './community-tournaments.component';
import { tournamentScoreTerminology } from './community-tournament-scoring';
import { appTranslate as t } from '../../i18n/i18n.service';
import { HistoricalMatchArchive } from '../../services/community-groups.service';

describe('Community tournaments management', () => {
  let api: jasmine.SpyObj<CommunityTournamentsService>;
  let component: CommunityTournamentsComponent;
  const community: CommunityGroup = {
    id: 7, name: 'Liga de amigos', description: null, sport: 'Futebol', photoUrl: null,
    visibility: 'PRIVATE', rankingsEnabled: true, ownerUsername: 'owner',
    myRole: 'OWNER', memberCount: 2, createdAt: '2026-10-16T12:00:00Z', members: []
  };
  const draft: CommunityTournament = {
    id: 9, name: 'Liga', format: 'LEAGUE', status: 'DRAFT',
    winPoints: 3, drawPoints: 1, lossPoints: 0, createdAt: '2026-10-16T12:00:00Z',
    startedAt: null, completedAt: null, championProfileId: null,
    championUsername: null, championDisplayName: null, championPoints: null,
    championTied: false
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<CommunityTournamentsService>('CommunityTournamentsService', [
      'list', 'create', 'participants', 'join', 'leave', 'confirm', 'removeParticipant',
      'generateSchedule', 'matches', 'recordResult', 'standings', 'complete', 'delete',
      'createTeamTournament', 'details', 'teams', 'createTeam', 'addTeamPlayer', 'acceptTeamInvite', 'removeTeamPlayer', 'deleteTeam',
      'generateTeamSchedule', 'teamMatches', 'recordTeamResult', 'teamStandings', 'teamGroups', 'completeTeam',
      'createRaceChampionship', 'raceOverview', 'linkRace', 'unlinkRace', 'setRacePoints',
      'completeRaceChampionship', 'inlineSpeedOverview', 'resolveInlineSpeedTieBreak', 'recordInlineSpeedTrial'
    ]);
    api.list.and.returnValue(of({ tournaments: [draft], page: 0, hasMore: false }));
    api.participants.and.returnValue(of({ participants: [], page: 0, hasMore: false }));
    api.matches.and.returnValue(of({ matches: [], page: 0, hasMore: false }));
    api.teams.and.returnValue(of([]));
    api.raceOverview.and.returnValue(of({
      tournamentId: 19, pointsByPlace: [25, 18, 15], linkedRaces: [], availableRaces: [],
      standings: []
    }));
    api.inlineSpeedOverview.and.returnValue(of({
      tournamentId: 19, discipline: null, linkedHeats: [], availableHeats: [],
      proposals: [], decisions: []
    }));
    api.teamMatches.and.returnValue(of({ matches: [], page: 0, hasMore: false }));
    api.teamGroups.and.returnValue(of({
      tournamentId: 19, knockoutStarted: false, groups: []
    }));
    api.teamStandings.and.returnValue(of({
      tournamentId: 19, status: 'IN_PROGRESS', totalMatches: 0, completedMatches: 0,
      winPoints: 3, drawPoints: 1, lossPoints: 0, standings: []
    }));
    api.standings.and.returnValue(of({
      tournamentId: 9, status: 'DRAFT', totalMatches: 0, completedMatches: 0,
      winPoints: 3, drawPoints: 1, lossPoints: 0, standings: []
    }));
    const auth = {
      loggedInPerfilname: 'owner', isLoggedIn: () => true
    } as unknown as AuthenticationService;
    const cdr = {
      markForCheck: jasmine.createSpy('markForCheck'),
      detectChanges: jasmine.createSpy('detectChanges')
    } as unknown as ChangeDetectorRef;
    component = new CommunityTournamentsComponent(api, auth, cdr);
    component.community = { ...community };
    component.ngOnChanges({ community: new SimpleChange(undefined, community, true) });
  });


  it('keeps tournament and fixtures semantics unchanged by the layout update', () => {
    expect(component.community.id).toBe(7);
    expect(component.tournaments.length).toBeGreaterThan(0);
    expect(component.tournaments[0].id).toBe(9);
  });

  it('translates organizer validation feedback without submitting invalid team tournaments', async () => {
    const previous = localStorage.getItem('d24-language');
    try {
      component.startTeamCreation();
      component.nameDraft = 'A';
      localStorage.setItem('d24-language', 'en');
      await component.createTeamCompetition();
      expect(component.error).toBe('Enter a name between 2 and 120 characters.');
      expect(api.createTeamTournament).not.toHaveBeenCalled();

      localStorage.setItem('d24-language', 'pt');
      await component.createTeamCompetition();
      expect(component.error).toBe('Indica um nome entre 2 e 120 caracteres.');
      expect(api.createTeamTournament).not.toHaveBeenCalled();

      localStorage.setItem('d24-language', 'en');
      component.nameDraft = 'A valid tournament';
      component.sportDraft = 'Modalidade inexistente';
      await component.createTeamCompetition();
      expect(component.error).toBe('Choose a valid sport for the tournament.');
      expect(api.createTeamTournament).not.toHaveBeenCalled();
    } finally {
      if (previous === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', previous);
    }
  });

  it('shows localized individual creation success after the selected tournament changes', async () => {
    const previous = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'en');
      component.startIndividualCreation();
      component.nameDraft = 'Autumn QA League';
      component.sportDraft = 'Futebol';
      api.create.and.returnValue(of({ ...draft, sport: 'Futebol', name: 'Autumn QA League' }));
      await component.create();
      expect(api.create).toHaveBeenCalled();
      expect(component.feedback).toBe('Tournament created.');
      expect(component.selected?.name).toBe('Autumn QA League');
    } finally {
      if (previous === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', previous);
    }
  });

  it('shows a single selected sport and preserves it until the replacement is picked', () => {
    expect(component.sportDraft).toBe('Futebol');
    expect(component.editingSport).toBeFalse();
    expect(component.showCommunitySportShortcuts).toBeFalse();

    component.startTeamCreation();
    component.toggleSportEditor();
    expect(component.editingSport).toBeTrue();
    expect(component.sportDraft).toBe('Futebol');

    component.sportSearch = 'kar';
    component.toggleSportEditor(); // Cancel keeps the current selection.
    expect(component.editingSport).toBeFalse();
    expect(component.sportSearch).toBe('');
    expect(component.sportDraft).toBe('Futebol');

    component.toggleSportEditor();
    component.chooseSport('Karting');
    expect(component.sportDraft).toBe('Karting');
    expect(component.editingSport).toBeFalse();
    expect(component.sportSearch).toBe('');

    component.startIndividualCreation();
    expect(component.sportDraft).toBe('Karting');
    expect(component.editingSport).toBeFalse();

    // After selecting Karting, Futebol must not appear again as an
    // unlabelled quick suggestion when the editor is opened.
    component.toggleSportEditor();
    expect(component.showCommunitySportShortcuts).toBeFalse();
    expect(component.suggestedSports).toEqual([]);
    component.toggleSportEditor();
    expect(component.sportDraft).toBe('Karting');

    // Before any sport is chosen, community sports remain helpful shortcuts.
    component.sportDraft = '';
    expect(component.showCommunitySportShortcuts).toBeTrue();
  });

  it('explains when sport-specific race or combat results need community rounds', () => {
    component.sportDraft = 'Futebol';
    expect(component.creationSportNoticeKey).toBeNull();

    component.chooseSport('Karting');
    expect(component.creationSportNoticeKey).toBe('communities.tournaments.creationRaceNotice');

    component.chooseSport('Judo');
    expect(component.creationSportNoticeKey).toBe('communities.tournaments.creationDuelNotice');

    component.chooseSport('Golfe');
    expect(component.creationSportNoticeKey).toBe('communities.tournaments.creationPerformanceNotice');

    component.sportDraft = '';
    expect(component.creationSportNoticeKey).toBeNull();
  });

  it('shows classification family guidance in the selected language without changing supported formats', () => {
    const previous = localStorage.getItem('d24-language');
    const cases: Array<[string, string, string, boolean]> = [
      ['Xadrez', 'Chess scoring', 'Pontuação de Xadrez', true],
      ['Karting', 'Race standings', 'Classificação por corridas', false],
      ['Atletismo', 'Time and measurement standings', 'Classificação por marcas e tempos', false],
      ['Surf', 'Judged-event standings', 'Classificação por notas de júri', false],
      ['Golfe', 'Event-score standings', 'Classificação por resultado de prova', false],
      ['Yoga', 'Activity without defined competitive standings', 'Atividade sem classificação competitiva definida', false],
      ['Modalidade inexistente', 'Sport without verified tournament rules', 'Modalidade sem regras de torneio verificadas', false],
      ['Judo', 'Individual head-to-head standings', 'Classificação por confrontos individuais', true],
      ['Futebol', 'Win, draw and loss standings', 'Classificação por vitórias, empates e derrotas', true]
    ];
    try {
      component.startIndividualCreation();
      for (const [sport, english, portuguese, supported] of cases) {
        component.sportDraft = sport;
        localStorage.setItem('d24-language', 'en');
        const en = component.classificationProfile;
        expect(en.heading).withContext(sport).toBe(english);
        expect(en.detail).withContext(sport).not.toContain('Classificação');
        expect(en.fields).withContext(sport).toBeTruthy();
        expect(en.isRoundRobinSupported).withContext(sport).toBe(supported);
        expect(en.pointRules).withContext(sport).toEqual(sport === 'Xadrez'
          ? { winPoints: 2, drawPoints: 1, lossPoints: 0 }
          : { winPoints: 3, drawPoints: 1, lossPoints: 0 });
        localStorage.setItem('d24-language', 'pt');
        const pt = component.classificationProfile;
        expect(pt.heading).withContext(sport).toBe(portuguese);
        expect(pt.isRoundRobinSupported).withContext(sport).toBe(supported);
        expect(pt.pointRules).withContext(sport).toEqual(en.pointRules);
      }
      component.startTeamCreation();
      component.chooseSport('Xadrez');
      expect(component.isSportFormatSupported).toBeFalse();
      localStorage.setItem('d24-language', 'en');
      expect(component.sportFormatWarning).toContain('chess');
      localStorage.setItem('d24-language', 'pt');
      expect(component.sportFormatWarning).toContain('tabuleiro');
      expect(component.raceSportLabel(null)).toBe('Corridas');
      localStorage.setItem('d24-language', 'en');
      expect(component.raceSportLabel(null)).toBe('Races');
    } finally {
      if (previous === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', previous);
    }
    expect(api.create).not.toHaveBeenCalled();
    expect(api.createTeamTournament).not.toHaveBeenCalled();
  });

  it('creates a Karting championship instead of fake head-to-head fixtures', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Campeonato Karting';
    component.chooseSport('Karting');
    expect(component.classificationProfile.heading).toContain('corridas');
    expect(component.classificationProfile.isRoundRobinSupported).toBeFalse();
    expect(component.isSportFormatSupported).toBeTrue();
    api.createRaceChampionship.and.returnValue(of({
      ...draft, id: 19, name: 'Campeonato Karting', sport: 'Karting', scoringMode: 'RACE_POINTS'
    }));
    await component.create();
    expect(api.createRaceChampionship).toHaveBeenCalledOnceWith(7, 'Campeonato Karting', 'Karting');
    expect(api.create).not.toHaveBeenCalled();
    expect(api.matches).not.toHaveBeenCalledWith(7, 19, 0);
    expect(api.raceOverview).toHaveBeenCalledWith(7, 19);
    expect(component.isRaceCompetition).toBeTrue();

    component.startIndividualCreation();
    component.chooseSport('Xadrez');
    expect(component.classificationProfile.scoringMode).toBe('CHESS_HALF_POINTS');
    expect(component.pointRulesDraft).toEqual({
      winPoints: 2, drawPoints: 1, lossPoints: 0
    });
    component.chooseSport('Futebol');
    expect(component.pointRulesDraft).toEqual({
      winPoints: 3, drawPoints: 1, lossPoints: 0
    });
  });

  it('creates BMX Racing as a proper race championship, not a fictional duel', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Taça BMX Racing';
    component.chooseSport('BMX');
    expect(component.isRaceChampionshipDraft).toBeTrue();
    expect(component.raceSportLabel('BMX')).toBe('BMX Racing');
    expect(component.classificationProfile.isRoundRobinSupported).toBeFalse();
    api.createRaceChampionship.and.returnValue(of({
      ...draft, id: 40, name: 'Taça BMX Racing', sport: 'BMX', scoringMode: 'RACE_POINTS'
    }));
    await component.create();
    expect(api.createRaceChampionship).toHaveBeenCalledOnceWith(7, 'Taça BMX Racing', 'BMX');
    expect(api.create).not.toHaveBeenCalled();
    expect(api.raceOverview).toHaveBeenCalledWith(7, 40);
    expect(component.selected?.sport).toBe('BMX');

    component.startTeamCreation();
    component.chooseSport('BMX');
    expect(component.isRaceChampionshipDraft).toBeFalse();
    expect(component.isSportFormatSupported).toBeFalse();
  });

  it('creates Ciclismo, Mountain Bike and Ciclocrosse championships using recorded race positions', async () => {
    for (const [index, sport] of (['Ciclismo', 'Mountain Bike', 'Ciclocrosse', 'Ciclismo de Estrada', 'Ciclismo de Pista'] as const).entries()) {
      component.startIndividualCreation();
      component.nameDraft = 'Campeonato ' + sport;
      component.chooseSport(sport);
      expect(component.classificationProfile.format).toBe('race');
      expect(component.isRaceChampionshipDraft).toBeTrue();
      expect(component.raceSportLabel(sport)).toBe(sport);
      const id = 42 + index;
      api.createRaceChampionship.and.returnValue(of({
        ...draft, id, name: 'Campeonato ' + sport, sport, scoringMode: 'RACE_POINTS'
      }));
      await component.create();
      expect(api.createRaceChampionship).toHaveBeenCalledWith(7, 'Campeonato ' + sport, sport);
      expect(api.raceOverview).toHaveBeenCalledWith(7, id);
      expect(component.selected?.sport).toBe(sport);
    }
    expect(api.create).not.toHaveBeenCalled();
    expect(api.createRaceChampionship).toHaveBeenCalledTimes(5);
  });

  it('shows lap columns only for races that really have lap metrics', () => {
    const entry = {
      communityPlayerId: 11, fullName: 'Ana', finishPosition: 1,
      elapsedSeconds: 120.5, bestLapSeconds: null, lapsCompleted: null,
      racePenaltyPoints: 0, raceDisqualified: false
    };
    expect(component.hasRaceLaps([entry])).toBeFalse();
    expect(component.hasRaceBestLap([entry])).toBeFalse();
    expect(component.hasRaceLaps([{ ...entry, lapsCompleted: 3 }])).toBeTrue();
    expect(component.hasRaceBestLap([{ ...entry, bestLapSeconds: 45.55 }])).toBeTrue();
    expect(component.hasRaceLaps([])).toBeFalse();
    expect(component.hasRaceBestLap([])).toBeFalse();
  });

  it('does not offer cycling race championships as team or specialised event formats', () => {
    for (const sport of ['Ciclismo', 'Mountain Bike', 'Ciclocrosse', 'Ciclismo de Estrada', 'Ciclismo de Pista']) {
      component.startTeamCreation();
      component.chooseSport(sport);
      expect(component.isRaceChampionshipDraft).toBeFalse();
      expect(component.isSportFormatSupported).toBeFalse();
    }
    component.startIndividualCreation();
    for (const sport of ['Corrida de obstáculos', 'Triatlo']) {
      component.chooseSport(sport);
      expect(component.isRaceChampionshipDraft).toBeFalse();
      expect(component.isSportFormatSupported).toBeFalse();
    }
  });

  it('does not enable race championships for unsupported event rules', () => {
    component.startIndividualCreation();
    for (const sport of ['Natação', 'Snowboard', 'Atletismo', 'Futebol']) {
      component.chooseSport(sport);
      expect(component.isRaceChampionshipDraft).toBeFalse();
    }
  });

  it('links a Karting race and reads race standings without duel endpoints', async () => {
    component.selected = { ...draft, id: 19, sport: 'Karting', scoringMode: 'RACE_POINTS' };
    const data = {
      tournamentId: 19, pointsByPlace: [25, 18, 15],
      linkedRaces: [{ id: 30, name: 'Corrida 1', sport: 'Karting',
        playedAt: '2026-10-24T10:00:00Z', entries: [] }],
      availableRaces: [],
      standings: [{ position: 1, playerId: 11, fullName: 'Ana', races: 1,
        wins: 1, podiums: 1, bestFinish: 1, championshipPoints: 25, penaltyPoints: 0 }]
    };
    api.linkRace.and.returnValue(of(data));
    await component.linkTournamentRace(30);
    expect(api.linkRace).toHaveBeenCalledWith(7, 19, 30);
    expect(component.raceOverview?.standings[0].championshipPoints).toBe(25);
    expect(component.selected.status).toBe('IN_PROGRESS');
    expect(api.generateSchedule).not.toHaveBeenCalled();
  });

  it('accepts valid Karting points, including spaces around descending positions', async () => {
    const original = {
      tournamentId: 19, pointsByPlace: [25, 18, 15],
      linkedRaces: [], availableRaces: [], standings: []
    };
    component.selected = { ...draft, id: 19, sport: 'Karting', scoringMode: 'RACE_POINTS' };
    component.raceOverview = original;
    component.racePointsDraft = '25, 18, 15, 12, 10';
    api.setRacePoints.and.returnValue(of({
      ...original, pointsByPlace: [25, 18, 15, 12, 10]
    }));

    await component.saveRacePoints();

    expect(api.setRacePoints).toHaveBeenCalledOnceWith(7, 19, '25, 18, 15, 12, 10');
    expect(component.racePointsDraft).toBe('25,18,15,12,10');
    expect(component.raceOverview?.pointsByPlace).toEqual([25, 18, 15, 12, 10]);
  });

  it('rejects invalid Karting positions locally without calling the API', async () => {
    const current = {
      tournamentId: 19, pointsByPlace: [25, 18, 15],
      linkedRaces: [], availableRaces: [], standings: []
    };
    component.selected = { ...draft, id: 19, sport: 'Karting', scoringMode: 'RACE_POINTS' };
    component.raceOverview = current;
    const invalid = ['25,18.5,15', '25,abc,15', '25,-1', '18,25',
      '1001,25', '25,,15', '25,18,', '', Array(21).fill('1').join(',')];

    for (const input of invalid) {
      component.racePointsDraft = input;
      await component.saveRacePoints();
      expect(api.setRacePoints).not.toHaveBeenCalled();
      expect(component.error).toContain('pontos inteiros decrescentes');
    }
  });

  it('locks Karting points after associating the first race or starting the competition', async () => {
    const linked = {
      tournamentId: 19, pointsByPlace: [25, 18, 15], availableRaces: [],
      linkedRaces: [{
        id: 30, name: 'Corrida 1', sport: 'Karting',
        playedAt: '2026-10-24T10:00:00Z', entries: []
      }], standings: []
    };
    component.selected = { ...draft, id: 19, sport: 'Karting', scoringMode: 'RACE_POINTS' };
    component.raceOverview = linked;
    component.racePointsDraft = '30,20,10';
    await component.saveRacePoints();
    expect(api.setRacePoints).not.toHaveBeenCalled();

    component.raceOverview = { ...linked, linkedRaces: [] };
    component.selected = { ...component.selected, status: 'IN_PROGRESS' };
    await component.saveRacePoints();
    expect(api.setRacePoints).not.toHaveBeenCalled();
  });

  it('only allows closing Karting with recorded races and classified drivers', async () => {
    component.selected = { ...draft, id: 19, sport: 'Karting',
      status: 'IN_PROGRESS', scoringMode: 'RACE_POINTS' };
    component.raceOverview = {
      tournamentId: 19, pointsByPlace: [25, 18],
      linkedRaces: [], availableRaces: [], standings: []
    };
    expect(component.canCompleteRace).toBeFalse();
    component.confirmAction = 'completeRace';
    await component.completeRace();
    expect(api.completeRaceChampionship).not.toHaveBeenCalled();
    component.raceOverview.linkedRaces = [{
      id: 30, name: 'Karting 1', sport: 'Karting',
      playedAt: '2026-10-24T12:00:00Z', entries: []
    }];
    component.raceOverview.standings = [
      { position: 1, playerId: 10, fullName: 'Ana', races: 1,
        wins: 1, podiums: 1, bestFinish: 1, championshipPoints: 25, penaltyPoints: 0 },
      { position: 2, playerId: 11, fullName: 'Rui', races: 1,
        wins: 0, podiums: 1, bestFinish: 2, championshipPoints: 18, penaltyPoints: 0 }
    ];
    expect(component.canCompleteRace).toBeTrue();
    api.completeRaceChampionship.and.returnValue(of({ ...component.selected,
      status: 'COMPLETED', championProfileId: 10, championDisplayName: 'Ana',
      championPoints: 25, completedAt: '2026-10-24T13:00:00Z' }));
    component.confirmAction = 'completeRace';
    await component.completeRace();
    expect(api.completeRaceChampionship).toHaveBeenCalledOnceWith(7, 19);
    expect(component.selected?.championDisplayName).toBe('Ana');
    expect(component.selected?.status).toBe('COMPLETED');
    expect(component.confirmAction).toBeNull();
    expect(component.canCompleteRace).toBeFalse();
    expect(api.raceOverview).toHaveBeenCalledWith(7, 19);
  });

  it('never closes a duel tournament via the Karting endpoint', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS', sport: 'Xadrez',
      scoringMode: 'CHESS_HALF_POINTS' };
    component.confirmAction = 'completeRace';
    await component.completeRace();
    expect(api.completeRaceChampionship).not.toHaveBeenCalled();
  });

  it('shows a frozen Karting podium using official finishing ranks, including shared first place', () => {
    component.selected = { ...draft, id: 19, sport: 'Karting', scoringMode: 'RACE_POINTS',
      status: 'COMPLETED', championTied: true, completedAt: '2026-10-24T13:00:00Z' };
    component.raceOverview = {
      tournamentId: 19, pointsByPlace: [25, 18], linkedRaces: [], availableRaces: [],
      standings: [
        { position: 3, playerId: 15, fullName: 'João', races: 2, wins: 0,
          podiums: 1, bestFinish: 3, championshipPoints: 21, penaltyPoints: 0 },
        { position: 1, playerId: 11, fullName: 'Rui', races: 2, wins: 1,
          podiums: 2, bestFinish: 1, championshipPoints: 43, penaltyPoints: 0 },
        { position: 1, playerId: 10, fullName: 'Ana', races: 2, wins: 1,
          podiums: 2, bestFinish: 1, championshipPoints: 43, penaltyPoints: 0 },
        { position: 4, playerId: 12, fullName: 'Beatriz', races: 2, wins: 0,
          podiums: 1, bestFinish: 3, championshipPoints: 12, penaltyPoints: 0 }
      ]
    };
    expect(component.finalKartingPodium.map(driver => driver.position)).toEqual([1, 1, 3]);
    expect(component.finalKartingPodium.map(driver => driver.fullName))
      .toEqual(['Ana', 'Rui', 'João']);
    component.selected = { ...component.selected, status: 'IN_PROGRESS' };
    expect(component.finalKartingPodium).toEqual([]);
    component.selected = { ...draft, status: 'COMPLETED', scoringMode: 'CHESS_HALF_POINTS' };
    expect(component.finalKartingPodium).toEqual([]);
  });

  it('lists only finished Karting championships in reverse date order, preserving historical ties', () => {
    const older = { ...draft, id: 30, name: 'Taça primavera',
      sport: 'Karting', scoringMode: 'RACE_POINTS' as const,
      status: 'COMPLETED' as const, completedAt: '2026-04-10T12:00:00Z',
      championDisplayName: 'Ana', championTied: false };
    const newer = { ...older, id: 31, name: 'Taça outono',
      completedAt: '2026-10-12T12:00:00Z', championDisplayName: null, championTied: true };
    component.tournaments = [
      older, { ...draft, id: 32, sport: 'Karting', scoringMode: 'RACE_POINTS' },
      { ...draft, id: 33, sport: 'Futebol', status: 'COMPLETED' },
      newer,
      { ...older, id: 34, name: 'BMX Summer Racing', sport: 'BMX',
        completedAt: '2026-08-10T12:00:00Z', championDisplayName: 'Rui' }
    ];
    expect(component.hasKartingCompetitions).toBeTrue();
    expect(component.kartingPalmares.map(tournament => tournament.id)).toEqual([31, 34, 30]);
    expect(component.kartingPalmares[0].championTied).toBeTrue();
    expect(component.kartingPalmares[1].championDisplayName).toBe('Rui');
    expect(component.kartingPalmares[2].championDisplayName).toBe('Ana');

    component.tournaments = [];
    expect(component.hasKartingCompetitions).toBeFalse();
    expect(component.kartingPalmares).toEqual([]);
  });

  it('does not present individual chess rules as a team-board tournament', async () => {
    component.chooseSport('Xadrez');
    component.startTeamCreation();
    component.nameDraft = 'Torneio por equipas';
    expect(component.isSportFormatSupported).toBeFalse();
    expect(component.sportFormatWarning).toContain('tabuleiro');
    await component.createTeamCompetition();
    expect(api.createTeamTournament).not.toHaveBeenCalled();
  });

  it('creates a chess competition with a saved half-point scoring mode', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Liga de Xadrez';
    component.chooseSport('Xadrez');
    api.create.and.returnValue(of({ ...draft, sport: 'Xadrez',
      scoringMode: 'CHESS_HALF_POINTS', winPoints: 2, drawPoints: 1 }));
    await component.create();
    expect(api.create).toHaveBeenCalledOnceWith(
      7, 'Liga de Xadrez', 'Xadrez', { winPoints: 2, drawPoints: 1, lossPoints: 0 },
      'CHESS_HALF_POINTS'
    );
    expect(component.isChessTournament).toBeTrue();
    expect(component.formatTournamentPoints(3)).toBe('1,5');
  });

  it('accepts only proper chess match outcomes for new chess tournaments', () => {
    const game: TournamentMatch = { id: 81, roundNumber: 1, homeProfileId: 1,
      homeUsername: 'ana', awayProfileId: 2, awayUsername: 'bruno',
      status: 'SCHEDULED', homeScore: null, awayScore: null };
    component.selected = { ...draft, sport: 'Xadrez', scoringMode: 'CHESS_HALF_POINTS',
      status: 'IN_PROGRESS', winPoints: 2, drawPoints: 1 };
    expect(component.validTournamentScore(game)).toBeFalse();
    component.setChessOutcome(game, 'DRAW');
    expect(component.validTournamentScore(game)).toBeTrue();
    expect(component.chessOutcome(game)).toBe('DRAW');
    expect(component.displayTournamentResult({ ...game, homeScore: 0, awayScore: 0 })).toBe('½ – ½');
    component.setScore(game, 'home', 7);
    expect(component.validTournamentScore(game)).toBeFalse();
    component.setChessOutcome(game, 'BLACK');
    expect(component.validTournamentScore(game)).toBeTrue();
  });

  describe('real team competitions', () => {
    const teamDraft: CommunityTournament = {
      ...draft, id: 19, name: 'Torneio CNG 5x5', sport: 'Futebol',
      entryType: 'TEAM', playersPerTeam: 5
    };
    const team: TournamentTeam = {
      id: 40, name: 'Verdes', playersPerTeam: 5, createdAt: '2026-10-17T12:00:00Z', players: []
    };
    const members = [
      { profileId: 1, username: 'owner', fullName: 'Organizador', profilePicUrl: null, role: 'OWNER' as const },
      { profileId: 2, username: 'ana', fullName: 'Ana', profilePicUrl: null, role: 'MEMBER' as const },
      { profileId: 3, username: 'bruno', fullName: 'Bruno', profilePicUrl: null, role: 'MEMBER' as const }
    ];

    it('shows the invited team using an exact tournament deep link rather than the first result', () => {
      const other = { ...teamDraft, id: 99, name: 'Outro torneio' };
      api.list.and.returnValue(of({ tournaments: [other], page: 0, hasMore: false }));
      api.details.and.returnValue(of(teamDraft));
      api.teams.and.returnValue(of([team]));
      component.invitedTournamentId = 19;
      component.invitedTeamId = 40;
      component.ngOnChanges({ community: new SimpleChange(undefined, community, true) });

      expect(api.details).toHaveBeenCalledWith(7, 19);
      expect(component.selected?.id).toBe(19);
      expect(component.invitedTeam?.id).toBe(40);
      expect(component.teamInviteUrl(team))
        .toContain('/menu/communities/7?tab=tournaments&tournament=19&team=40');
    });

    it('allows a member to accept only their own invited team spot', async () => {
      api.list.and.returnValue(of({ tournaments: [teamDraft], page: 0, hasMore: false }));
      api.teams.and.returnValue(of([team]));
      api.acceptTeamInvite.and.returnValue(of({ ...team, players: [{
        profileId: 1, username: 'owner', displayName: 'Organizador'
      }]}));
      component.invitedTournamentId = 19;
      component.invitedTeamId = 40;
      component.ngOnChanges({ community: new SimpleChange(undefined, community, true) });

      await component.acceptInvitedTeam();
      expect(api.acceptTeamInvite).toHaveBeenCalledOnceWith(7, 19, 40);
      expect(component.feedback).toContain('Convite aceite');
    });

    it('never submits self-registration if the team is full or player is elsewhere', async () => {
      api.list.and.returnValue(of({ tournaments: [teamDraft], page: 0, hasMore: false }));
      api.teams.and.returnValue(of([{ ...team, players: [
        { profileId: 1, username: 'owner', displayName: 'Organizador' },
        { profileId: 2, username: 'ana', displayName: 'Ana' },
        { profileId: 3, username: 'bruno', displayName: 'Bruno' },
        { profileId: 4, username: 'x', displayName: 'X' },
        { profileId: 5, username: 'y', displayName: 'Y' }
      ] }]));
      component.invitedTournamentId = 19;
      component.invitedTeamId = 40;
      component.ngOnChanges({ community: new SimpleChange(undefined, community, true) });

      await component.acceptInvitedTeam();
      expect(api.acceptTeamInvite).not.toHaveBeenCalled();
    });

    it('creates group knockout with four groups and resets the draft', async () => {
      api.createTeamTournament.and.returnValue(of({ ...teamDraft,
        format: 'GROUP_KNOCKOUT', groupCount: 4 }));
      component.startTeamCreation();
      component.nameDraft = 'Taça de amigos';
      component.teamFormatDraft = 'GROUP_KNOCKOUT';
      component.teamGroupCountDraft = 4;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(7, 'Taça de amigos', 'Futebol',
        null, 1, { winPoints: 3, drawPoints: 1, lossPoints: 0 },
        'GOAL_DIFFERENCE_FIRST', 'GROUP_KNOCKOUT', 4);
      expect(component.teamFormatDraft).toBe('LEAGUE');
      expect(Number(component.teamGroupCountDraft)).toBe(2);
      expect(component.isGroupKnockout).toBeTrue();
    });

    it('labels group fixtures, quarterfinals, semifinals and final without changing league labels', () => {
      component.selected = { ...teamDraft, status: 'IN_PROGRESS',
        format: 'GROUP_KNOCKOUT', groupCount: 4 };
      const game = { id: 91, groupNumber: 1, roundNumber: 2,
        homeTeamId: 11, homeTeamName: 'A', awayTeamId: 12, awayTeamName: 'B',
        status: 'SCHEDULED' as const, homeScore: null, awayScore: null };
      expect(component.teamMatchStageLabel(game)).toBe('Grupo A · Jornada 2');
      expect(component.teamMatchStageLabel({ ...game, groupNumber: null, roundNumber: 1 }))
        .toBe('Quartos de final');
      expect(component.teamMatchStageLabel({ ...game, groupNumber: null, roundNumber: 2 }))
        .toBe('Meias-finais');
      expect(component.teamMatchStageLabel({ ...game, groupNumber: null, roundNumber: 3 }))
        .toBe('Final');

      component.selected = { ...component.selected, groupCount: 2 };
      expect(component.teamMatchStageLabel({ ...game, groupNumber: null, roundNumber: 1 }))
        .toBe('Meias-finais');
      expect(component.teamMatchStageLabel({ ...game, groupNumber: null, roundNumber: 2 }))
        .toBe('Final');
      component.selected = { ...component.selected, format: 'LEAGUE' };
      expect(component.teamMatchStageLabel(game)).toBe('Jornada 2');
    });

    it('translates league, cup and group stage labels PT/EN without changing competition phases', () => {
      const previousLanguage = localStorage.getItem('d24-language');
      const match = { id: 91, groupNumber: 1, roundNumber: 2,
        homeTeamId: 11, homeTeamName: 'A', awayTeamId: 12, awayTeamName: 'B',
        status: 'SCHEDULED' as const, homeScore: null, awayScore: null };
      try {
        component.selected = { ...teamDraft, status: 'IN_PROGRESS',
          format: 'GROUP_KNOCKOUT', groupCount: 4 };
        localStorage.setItem('d24-language', 'en');
        expect(component.teamMatchStageLabel(match)).toBe('Group A · Round 2');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 1 }))
          .toBe('Quarter-finals');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 2 }))
          .toBe('Semi-finals');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 3 }))
          .toBe('Final');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 4 }))
          .toBe('Knockout round 4');
        component.selected = { ...component.selected, groupCount: 2 };
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 1 }))
          .toBe('Semi-finals');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 2 }))
          .toBe('Final');
        component.selected = { ...component.selected, format: 'KNOCKOUT' };
        expect(component.teamMatchStageLabel(match)).toBe('Round 2');
        component.selected = { ...component.selected, format: 'LEAGUE' };
        expect(component.teamMatchStageLabel(match)).toBe('Round 2');

        localStorage.setItem('d24-language', 'pt');
        expect(component.teamMatchStageLabel(match)).toBe('Jornada 2');
        component.selected = { ...component.selected, format: 'GROUP_KNOCKOUT', groupCount: 4 };
        expect(component.teamMatchStageLabel(match)).toBe('Grupo A · Jornada 2');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 1 }))
          .toBe('Quartos de final');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 2 }))
          .toBe('Meias-finais');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 3 }))
          .toBe('Final');
        expect(component.teamMatchStageLabel({ ...match, groupNumber: null, roundNumber: 4 }))
          .toBe('Ronda eliminatória 4');
        component.selected = { ...component.selected, format: 'KNOCKOUT' };
        expect(component.teamMatchStageLabel(match)).toBe('Ronda 2');
      } finally {
        if (previousLanguage === null) localStorage.removeItem('d24-language');
        else localStorage.setItem('d24-language', previousLanguage);
      }
      expect(api.recordTeamResult).not.toHaveBeenCalled();
      expect(api.generateTeamSchedule).not.toHaveBeenCalled();
    });

    it('creates a team draft without requiring a roster size', async () => {
      api.createTeamTournament.and.returnValue(of(teamDraft));
      component.startTeamCreation();
      component.nameDraft = ' Torneio CNG 5x5 ';
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(7, 'Torneio CNG 5x5', 'Futebol', null, 1, { winPoints: 3, drawPoints: 1, lossPoints: 0 }, 'GOAL_DIFFERENCE_FIRST', 'LEAGUE');
      expect(api.create).not.toHaveBeenCalled();
      expect(component.selected?.entryType).toBe('TEAM');
      expect(api.teams).toHaveBeenCalledWith(7, 19);
      expect(api.participants).toHaveBeenCalledTimes(1); // initial legacy league only
      expect(api.matches).toHaveBeenCalledTimes(1);
      expect(api.standings).toHaveBeenCalledTimes(1);
    });

    it('passes home-and-away rule at creation and resets the selection afterward', async () => {
      api.createTeamTournament.and.returnValue(of({ ...teamDraft, roundRobinLegs: 2 }));
      component.startTeamCreation();
      component.nameDraft = 'Liga casa e fora';
      component.roundRobinLegsDraft = 2;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(7, 'Liga casa e fora', 'Futebol', null, 2, { winPoints: 3, drawPoints: 1, lossPoints: 0 }, 'GOAL_DIFFERENCE_FIRST', 'LEAGUE');
      expect(component.selected?.roundRobinLegs).toBe(2);
      expect(Number(component.roundRobinLegsDraft)).toBe(1);
      expect(api.create).not.toHaveBeenCalled();
    });

    it('stores custom team points without changing the community rankings', async () => {
      api.createTeamTournament.and.returnValue(of({
        ...teamDraft, winPoints: 2, drawPoints: 0, lossPoints: 0
      }));
      component.startTeamCreation();
      component.nameDraft = 'Torneio pontos';
      component.winPointsDraft = 2;
      component.drawPointsDraft = 0;
      component.lossPointsDraft = 0;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(
        7, 'Torneio pontos', 'Futebol', null, 1,
        { winPoints: 2, drawPoints: 0, lossPoints: 0 }, 'GOAL_DIFFERENCE_FIRST', 'LEAGUE');
      expect(component.selected?.winPoints).toBe(2);
      expect(component.winPointsDraft).toBe(3);
      expect(component.drawPointsDraft).toBe(1);
      expect(component.lossPointsDraft).toBe(0);
      expect(api.create).not.toHaveBeenCalled();
      expect(api.standings).toHaveBeenCalledTimes(1);
    });

    it('sends the chosen team tiebreak and restores defaults after creation', async () => {
      api.createTeamTournament.and.returnValue(of({
        ...teamDraft, teamTieBreakPriority: 'WINS_FIRST'
      }));
      component.startTeamCreation();
      component.nameDraft = 'Liga de vitórias';
      component.teamTieBreakPriorityDraft = 'WINS_FIRST';
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(
        7, 'Liga de vitórias', 'Futebol', null, 1,
        { winPoints: 3, drawPoints: 1, lossPoints: 0 }, 'WINS_FIRST', 'LEAGUE');
      expect(component.selected?.teamTieBreakPriority).toBe('WINS_FIRST');
      expect(component.teamTieBreakLabel(component.selected?.teamTieBreakPriority)).toBe('Mais vitórias');
      expect(component.teamTieBreakPriorityDraft).toBe('GOAL_DIFFERENCE_FIRST');
      expect(api.create).not.toHaveBeenCalled();
    });

    it('rejects an unsupported team tiebreak before creating anything', async () => {
      component.startTeamCreation();
      component.nameDraft = 'Liga por equipas';
      component.teamTieBreakPriorityDraft = 'INVALID' as any;
      await component.createTeamCompetition();
      expect(component.error).toContain('desempate');
      expect(api.createTeamTournament).not.toHaveBeenCalled();
    });

    it('creates knockout cup without league rules or standings', async () => {
      api.createTeamTournament.and.returnValue(of({ ...teamDraft, format: 'KNOCKOUT' }));
      component.startTeamCreation();
      component.nameDraft = 'Taça entre amigos';
      component.teamFormatDraft = 'KNOCKOUT';
      component.roundRobinLegsDraft = 2;
      component.teamTieBreakPriorityDraft = 'WINS_FIRST';
      component.winPointsDraft = -1;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(
        7, 'Taça entre amigos', 'Futebol', null, 2,
        { winPoints: -1, drawPoints: 1, lossPoints: 0 }, 'WINS_FIRST', 'KNOCKOUT');
      expect(component.selected?.format).toBe('KNOCKOUT');
      expect(component.teamFormatDraft).toBe('LEAGUE');
      expect(api.teamStandings).not.toHaveBeenCalled();
    });

    it('rejects cup draws and snapshots final winner', async () => {
      const cup = { ...teamDraft, format: 'KNOCKOUT' as const, status: 'IN_PROGRESS' as const };
      const match = { id: 65, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Verdes',
        awayTeamId: 41, awayTeamName: 'Azuis', status: 'SCHEDULED' as const };
      api.teams.and.returnValue(of([team, { ...team, id: 41, name: 'Azuis' }]));
      api.teamMatches.and.returnValue(of({ matches: [match], page: 0, hasMore: false }));
      component.selectTournament(cup);
      expect(component.knockoutTotalRounds).toBe(1);
      expect(api.teamStandings).not.toHaveBeenCalled();
      component.setTeamScore(match, 'home', 1);
      component.setTeamScore(match, 'away', 1);
      await component.saveTeamScore(match);
      expect(api.recordTeamResult).not.toHaveBeenCalled();
      component.setTeamScore(match, 'away', 0);
      api.recordTeamResult.and.returnValue(of({ ...match,
        homeScore: 1, awayScore: 0, status: 'COMPLETED' as const }));
      await component.saveTeamScore(match);
      expect(component.selected?.status).toBe('COMPLETED');
      expect(component.selected?.championTeamName).toBe('Verdes');
      expect(api.teamStandings).not.toHaveBeenCalled();
    });

    it('requires the return leg before enabling team completion', () => {
      const twoLegs = { ...teamDraft, status: 'IN_PROGRESS' as const, roundRobinLegs: 2 as const };
      api.teamStandings.and.returnValue(of({
        tournamentId: 19, status: 'IN_PROGRESS', totalMatches: 2, completedMatches: 1,
        winPoints: 3, drawPoints: 1, lossPoints: 0,
        standings: [
          { position: 1, teamId: 40, teamName: 'Verdes', played: 1, won: 1,
            drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1, points: 3 },
          { position: 2, teamId: 41, teamName: 'Azuis', played: 1, won: 0,
            drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDifference: -1, points: 0 }
        ]
      }));
      component.selectTournament(twoLegs);
      expect(component.canCompleteTeam).toBeFalse();
      component.teamStandings!.completedMatches = 2;
      component.teamStandings!.standings.forEach(row => row.played = 2);
      expect(component.canCompleteTeam).toBeTrue();
    });

    it('supports flexible rosters and preserves legacy fixed sizes', () => {
      const flexible = { ...teamDraft, playersPerTeam: null };
      component.selectTournament(flexible);
      const playerOne = { profileId: 2, username: 'ana', displayName: 'Ana' };
      const playerTwo = { profileId: 3, username: 'bruno', displayName: 'Bruno' };
      component.teams = [
        { ...team, playersPerTeam: null, players: [playerOne] },
        { ...team, id: 41, playersPerTeam: null, players: [playerOne, playerTwo] }
      ];
      expect(component.readyTeamCount).toBe(2);
      expect(component.canPublishTeamSchedule).toBeTrue();
      expect(component.isTeamRosterFull(component.teams[0])).toBeFalse();
      component.teams[1].players = [];
      expect(component.readyTeamCount).toBe(1);
      expect(component.canPublishTeamSchedule).toBeFalse();
      // Existing fixed-size tournaments retain the exact squad requirement.
      component.teams = [{ ...team, players: [playerOne] }, { ...team, id: 41, players: [playerTwo] }];
      expect(component.canPublishTeamSchedule).toBeFalse();
    });

    it('loads only teams for team tournaments, without individual standings or fixtures', () => {
      const oldParticipantCalls = api.participants.calls.count();
      const oldMatchCalls = api.matches.calls.count();
      const oldStandingCalls = api.standings.calls.count();
      api.teams.and.returnValue(of([team]));
      component.selectTournament(teamDraft);
      expect(component.teams).toEqual([team]);
      expect(api.teams).toHaveBeenCalledWith(7, 19);
      expect(api.participants.calls.count()).toBe(oldParticipantCalls);
      expect(api.matches.calls.count()).toBe(oldMatchCalls);
      expect(api.standings.calls.count()).toBe(oldStandingCalls);
      expect(component.canPublishSchedule).toBeFalse();
    });

    it('creates teams and assigns only free community members', async () => {
      component.community = { ...community, members, memberCount: 3 };
      component.selectTournament(teamDraft);
      api.createTeam.and.returnValue(of(team));
      api.teams.and.returnValue(of([team]));
      component.teamNameDraft = '  Verdes  ';
      await component.createTournamentTeam();
      expect(api.createTeam).toHaveBeenCalledWith(7, 19, 'Verdes');
      expect(component.teams[0].name).toBe('Verdes');

      const updated = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      api.addTeamPlayer.and.returnValue(of(updated));
      api.teams.and.returnValue(of([updated]));
      component.teamPlayerDraft[40] = 2;
      await component.assignTeamPlayer(team);
      expect(api.addTeamPlayer).toHaveBeenCalledWith(7, 19, 40, 2);
      expect(component.availableTeamMembers.map(x => x.profileId)).toEqual([1, 3]);

      component.teamPlayerDraft[40] = 2;
      await component.assignTeamPlayer(updated);
      expect(api.addTeamPlayer).toHaveBeenCalledTimes(1);
    });

    it('can remove players, then delete only an empty team', async () => {
      const occupied = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      component.community = { ...community, members, memberCount: 3 };
      api.teams.and.returnValue(of([occupied]));
      component.selectTournament(teamDraft);
      await component.deleteTournamentTeam(occupied);
      expect(api.deleteTeam).not.toHaveBeenCalled();
      api.removeTeamPlayer.and.returnValue(of(void 0));
      api.teams.and.returnValue(of([team]));
      await component.removeTeamPlayer(occupied, 2);
      expect(api.removeTeamPlayer).toHaveBeenCalledWith(7, 19, 40, 2);
      api.deleteTeam.and.returnValue(of(void 0));
      api.teams.and.returnValue(of([]));
      await component.deleteTournamentTeam(team);
      expect(api.deleteTeam).toHaveBeenCalledWith(7, 19, 40);
    });

    it('prevents members from editing any squad', async () => {
      component.community = { ...community, myRole: 'MEMBER', members };
      component.selectTournament(teamDraft);
      component.teamNameDraft = 'Tentativa';
      component.teamPlayerDraft[40] = 2;
      await component.createTournamentTeam();
      await component.assignTeamPlayer(team);
      await component.deleteTournamentTeam(team);
      expect(api.createTeam).not.toHaveBeenCalled();
      expect(api.addTeamPlayer).not.toHaveBeenCalled();
      expect(api.deleteTeam).not.toHaveBeenCalled();
      expect(component.teams).toEqual([]);
    });

    it('ignores delayed team responses when a different competition is selected', () => {
      const delayed = new Subject<TournamentTeam[]>();
      api.teams.and.returnValue(delayed.asObservable());
      component.selectTournament(teamDraft);
      component.selectTournament(draft);
      delayed.next([team]);
      delayed.complete();
      expect(component.selected?.id).toBe(9);
      expect(component.teams).toEqual([]);
    });


    it('only enables publication when at least two teams have complete squads', () => {
      component.selectTournament(teamDraft);
      expect(component.canPublishTeamSchedule).toBeFalse();
      const complete = (id: number, name: string) => ({
        ...team, id, name, players: Array.from({ length: 5 }, (_, i) => ({
          profileId: id * 10 + i, username: 'player' + (id * 10 + i),
          displayName: 'Jogador ' + (i + 1)
        }))
      });
      component.teams = [complete(40, 'Verdes'), complete(41, 'Azuis')];
      expect(component.canPublishTeamSchedule).toBeTrue();
      component.teams[1].players.pop();
      expect(component.canPublishTeamSchedule).toBeFalse();
      component.teams[1].players.push({
        profileId: 999, username: 'extra', displayName: 'Extra'
      });
      component.community = { ...community, myRole: 'MEMBER' };
      expect(component.canPublishTeamSchedule).toBeFalse();
    });

    it('publishes real team fixtures without using the individual match endpoint', async () => {
      const competition = { ...teamDraft };
      const teamA: TournamentTeam = {
        ...team, players: Array.from({ length: 5 }, (_, i) => ({
          profileId: i + 1, username: 'green-' + i, displayName: 'Verde ' + i
        }))
      };
      const teamB: TournamentTeam = {
        ...teamA, id: 41, name: 'Azuis',
        players: teamA.players.map((p, i) => ({
          ...p, profileId: i + 20, username: 'blue-' + i
        }))
      };
      api.teams.and.returnValue(of([teamA, teamB]));
      api.generateTeamSchedule.and.returnValue(of({
        tournamentId: 19, status: 'IN_PROGRESS', teamCount: 2, roundCount: 1, matchCount: 1
      }));
      api.teamMatches.and.returnValue(of({ matches: [{
        id: 65, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Verdes',
        awayTeamId: 41, awayTeamName: 'Azuis', status: 'SCHEDULED'
      }], page: 0, hasMore: false }));
      component.selectTournament(competition);
      expect(component.canPublishTeamSchedule).toBeTrue();
      component.confirmAction = 'schedule';
      await component.publishTeamSchedule();
      expect(api.generateTeamSchedule).toHaveBeenCalledWith(7, 19);
      expect(api.generateSchedule).not.toHaveBeenCalled();
      expect(component.selected?.status).toBe('IN_PROGRESS');
      expect(component.teamMatches.length).toBe(1);
      expect(component.teamMatches[0].homeTeamName).toBe('Verdes');
      expect(component.canManageTeamRoster).toBeFalse();
    });

    it('does not publish team fixtures before explicit confirmation', async () => {
      component.selectTournament(teamDraft);
      await component.publishTeamSchedule();
      expect(api.generateTeamSchedule).not.toHaveBeenCalled();
    });

    it('ignores stale fixture pages when another tournament is selected', () => {
      const loading = new Subject<any>();
      api.teams.and.returnValue(of([team]));
      api.teamMatches.and.returnValue(loading.asObservable());
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      expect(api.teamMatches).toHaveBeenCalledWith(7, 19, 0);
      component.selectTournament(draft);
      loading.next({ matches: [{
        id: 77, roundNumber: 1, homeTeamId: 40, homeTeamName: 'A',
        awayTeamId: 41, awayTeamName: 'B', status: 'SCHEDULED'
      }], page: 0, hasMore: false });
      loading.complete();
      expect(component.teamMatches).toEqual([]);
    });

    it('allows pagination of real team fixtures', () => {
      api.teams.and.returnValue(of([team]));
      api.teamMatches.and.returnValues(
        of({ matches: [{
          id: 70, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Verdes',
          awayTeamId: 41, awayTeamName: 'Azuis', status: 'SCHEDULED' as const
        }], page: 0, hasMore: true }),
        of({ matches: [{
          id: 71, roundNumber: 2, homeTeamId: 41, homeTeamName: 'Azuis',
          awayTeamId: 42, awayTeamName: 'Brancos', status: 'SCHEDULED' as const
        }], page: 1, hasMore: false })
      );
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      expect(component.teamMatchesHasMore).toBeTrue();
      component.loadTeamMatches();
      expect(api.teamMatches).toHaveBeenCalledWith(7, 19, 1);
      expect(component.teamMatches.length).toBe(2);
      expect(component.teamMatchesHasMore).toBeFalse();
    });

    it('saves real team results and refreshes only team standings', async () => {
      const fixture = { id: 75, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Azuis',
        awayTeamId: 41, awayTeamName: 'Verdes', status: 'SCHEDULED' as const,
        homeScore: null, awayScore: null };
      api.teams.and.returnValue(of([team]));
      api.teamMatches.and.returnValue(of({ matches: [fixture], page: 0, hasMore: false }));
      api.recordTeamResult.and.returnValue(of({ ...fixture, status: 'COMPLETED',
        homeScore: 2, awayScore: 1 }));
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      component.setTeamScore(fixture, 'home', 2);
      component.setTeamScore(fixture, 'away', 1);
      const previousIndividualStandingsCalls = api.standings.calls.count();
      await component.saveTeamScore(fixture);
      expect(api.recordTeamResult).toHaveBeenCalledWith(7, 19, 75, 2, 1);
      expect(component.teamMatches[0].status).toBe('COMPLETED');
      expect(component.teamMatches[0].homeScore).toBe(2);
      expect(api.teamStandings).toHaveBeenCalledWith(7, 19);
      expect(api.standings.calls.count()).toBe(previousIndividualStandingsCalls);
      expect(api.recordResult).not.toHaveBeenCalled();
    });

    it('only enables team closing once every real fixture is scored', async () => {
      api.teams.and.returnValue(of([team, { ...team, id: 41, name: 'Azuis' }]));
      api.teamStandings.and.returnValue(of({
        tournamentId: 19, status: 'IN_PROGRESS', totalMatches: 1, completedMatches: 0,
        winPoints: 3, drawPoints: 1, lossPoints: 0,
        standings: [
          { position: 1, teamId: 40, teamName: 'Verdes', played: 0, won: 0,
            drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
          { position: 2, teamId: 41, teamName: 'Azuis', played: 0, won: 0,
            drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
        ]
      }));
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      expect(component.canCompleteTeam).toBeFalse();
      const table = component.teamStandings!;
      table.completedMatches = 1;
      table.standings.forEach(row => row.played = 1);
      expect(component.canCompleteTeam).toBeTrue();
      component.confirmAction = 'completeTeam';
      api.completeTeam.and.returnValue(of({ ...teamDraft, status: 'COMPLETED',
        championTeamId: 40, championTeamName: 'Verdes', championPoints: 3,
        completedAt: '2026-10-17T12:00:00Z' }));
      await component.completeTeam();
      expect(api.completeTeam).toHaveBeenCalledWith(7, 19);
      expect(api.complete).not.toHaveBeenCalled();
      expect(component.selected?.championTeamName).toBe('Verdes');
      expect(component.selected?.status).toBe('COMPLETED');
      expect(component.canCompleteTeam).toBeFalse();
    });

    it('respects the module switch for team competition creation', () => {
      component.community = { ...community, teamTournamentsEnabled: false };
      component.startTeamCreation();
      expect(component.showTeamCreate).toBeFalse();
      expect(api.createTeamTournament).not.toHaveBeenCalled();
    });
  });

  it('loads tournament list, roster, fixtures and standings for the selected community', () => {
    expect(api.list).toHaveBeenCalledWith(7, 0);
    expect(api.participants).toHaveBeenCalledWith(7, 9, 0);
    expect(api.matches).toHaveBeenCalledWith(7, 9, 0);
    expect(api.standings).toHaveBeenCalledWith(7, 9);
    expect(component.selected?.id).toBe(9);
  });

  it('only shows organizer actions to owner/admin', () => {
    expect(component.canManage).toBeTrue();
    component.community = { ...community, myRole: 'MEMBER' };
    expect(component.canManage).toBeFalse();
  });

  it('creates a tournament, chooses it and reloads its details', async () => {
    const created = { ...draft, id: 12, name: 'Liga de Inverno' };
    api.create.and.returnValue(of(created));
    component.startIndividualCreation();
    component.nameDraft = ' Liga de Inverno ';
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de Inverno', 'Futebol', { winPoints: 3, drawPoints: 1, lossPoints: 0 });
    expect(component.selected?.id).toBe(12);
    expect(component.tournaments[0].id).toBe(12);
  });


  it('sends custom points on individual creation and resets after success', async () => {
    api.create.and.returnValue(of({ ...draft, id: 14,
      winPoints: 5, drawPoints: 2, lossPoints: 0 }));
    component.startIndividualCreation();
    component.nameDraft = 'Liga personalizada';
    component.winPointsDraft = 5;
    component.drawPointsDraft = 2;
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga personalizada', 'Futebol',
      { winPoints: 5, drawPoints: 2, lossPoints: 0 });
    expect(component.selected?.winPoints).toBe(5);
    expect(component.winPointsDraft).toBe(3);
    expect(component.drawPointsDraft).toBe(1);
  });

  it('rejects negative, fractional and excessive points without sending a request', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Liga incompleta';
    component.winPointsDraft = -1;
    expect(component.validPointRules).toBeFalse();
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('pontos inteiros');
    component.winPointsDraft = 2.5;
    expect(component.validPointRules).toBeFalse();
    component.winPointsDraft = 101;
    expect(component.validPointRules).toBeFalse();
    component.winPointsDraft = 0;
    component.drawPointsDraft = 0;
    component.lossPointsDraft = 0;
    expect(component.validPointRules).toBeTrue();
  });

  it('requires a sport when a community has several before a tournament can be created', async () => {
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.community = { ...community, sports: ['Futebol', 'Padel'] };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    expect(component.sportDraft).toBe('');
    component.startIndividualCreation();
    component.nameDraft = 'Liga de outono';
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('modalidade');

    component.chooseSport('Padel');
    api.create.and.returnValue(of({ ...draft, id: 14, sport: 'Padel' }));
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de outono', 'Padel', { winPoints: 3, drawPoints: 1, lossPoints: 0 });
  });

  it('recognizes a different sport but avoids a false 1v1 swimming competition', async () => {
    component.community = { ...community, sports: ['Futebol', 'Padel'] };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    component.sportSearch = 'natação';
    expect(component.suggestedSports).toContain('Natação');
    component.chooseSport('Natação');
    component.startIndividualCreation();
    component.nameDraft = 'Liga de natação';
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('jornadas');
    expect(component.classificationProfile.format).toBe('race');
    expect(component.community.sport).toBe('Futebol');
  });

  it('keeps legacy community modalities selectable without inventing their scoring', async () => {
    component.community = { ...community, sports: ['Desporto local tradicional', 'Futebol'] };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    component.sportSearch = 'tradicional';
    expect(component.suggestedSports).toContain('Desporto local tradicional');
    component.chooseSport('Desporto local tradicional');
    component.startIndividualCreation();
    component.nameDraft = 'Torneio local';
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.classificationProfile.format).toBe('unknown');
    expect(component.error).toContain('jornadas');
  });

  it('uses the selected tournament sport for scoring rather than the community primary sport', () => {
    component.selected = { ...draft, sport: 'Padel' };
    expect(component.scoring.scoreInput).toContain('Sets');
    component.selected = { ...draft, sport: 'Basquetebol' };
    expect(component.scoring.scoreInput).toContain('Pontos');
    component.selected = { ...draft, sport: null };
    expect(component.scoring.scoreInput).toContain('Marcador');
  });


  it('shows onboarding for an empty community and leaves team creation unavailable', () => {
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.ngOnChanges({ community: new SimpleChange(community, community, false) });
    expect(component.showGuide).toBeTrue();
    expect(component.showIndividualCreate).toBeFalse();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('removes the selected trial only after explicit confirmation and resets the view', async () => {
    api.delete.and.returnValue(of(void 0));
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.confirmAction = 'delete';
    await component.deleteSelected();
    expect(api.delete).toHaveBeenCalledWith(7, 9);
    expect(component.selected).toBeUndefined();
    expect(component.tournaments).toEqual([]);
    expect(component.feedback).toBe('Competição eliminada.');
  });

  it('does not delete without confirmation or management rights', async () => {
    await component.deleteSelected();
    expect(api.delete).not.toHaveBeenCalled();
    component.confirmAction = 'delete';
    component.community = { ...community, myRole: 'MEMBER' };
    await component.deleteSelected();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('enrolls only the current player and requests updated roster', async () => {
    const entry = {
      profileId: 4, username: 'owner', displayName: 'Owner',
      status: 'PENDING' as const, joinedAt: '2026-10-16T12:01:00Z'
    };
    api.join.and.returnValue(of(entry));
    api.participants.and.returnValue(of({ participants: [entry], page: 0, hasMore: false }));
    await component.join();
    expect(api.join).toHaveBeenCalledWith(7, 9);
    expect(component.myEnrollment?.status).toBe('PENDING');
  });

  it('does not publish a schedule without explicit confirmation', async () => {
    api.generateSchedule.and.returnValue(of({
      tournamentId: 9, participantCount: 2, matchCount: 1, roundCount: 1, status: 'IN_PROGRESS'
    }));
    component.rosterReady = true;
    component.participants = [1, 2].map(id => ({
      profileId: id, username: 'p' + id, displayName: 'Jogador ' + id,
      status: 'CONFIRMED' as const, joinedAt: '2026-10-16T12:00:00Z'
    }));
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();
    component.confirmAction = 'schedule';
    await component.publishSchedule();
    expect(api.generateSchedule).toHaveBeenCalledWith(7, 9);
    expect(component.selected?.status).toBe('IN_PROGRESS');
  });

  it('rejects invalid results before issuing an HTTP request', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    const game: TournamentMatch = {
      id: 22, roundNumber: 1, homeProfileId: 1, homeUsername: 'ana',
      awayProfileId: 2, awayUsername: 'rui', status: 'SCHEDULED',
      homeScore: null, awayScore: null
    };
    component.setScore(game, 'home', -1);
    component.setScore(game, 'away', 1);
    await component.saveScore(game);
    expect(api.recordResult).not.toHaveBeenCalled();
    expect(component.error).toContain('0 e 999');
  });

  it('does not close an unfinished tournament', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    component.confirmAction = 'complete';
    await component.complete();
    expect(api.complete).not.toHaveBeenCalled();
  });

  it('resets data when navigating between communities', () => {
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.community = { ...community, id: 10, name: 'Outra equipa' };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    expect(api.list).toHaveBeenCalledWith(10, 0);
    expect(component.selected).toBeUndefined();
    expect(component.participants.length).toBe(0);
  });
  it('allows public tournament previews without requesting private rosters or standings', () => {
    api.participants.calls.reset();
    api.matches.calls.reset();
    api.standings.calls.reset();
    component.community = { ...community, id: 8, myRole: null, visibility: 'PUBLIC' };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });

    expect(component.selected?.id).toBe(9);
    expect(component.isMember).toBeFalse();
    expect(component.canManage).toBeFalse();
    expect(api.list).toHaveBeenCalledWith(8, 0);
    expect(api.participants).not.toHaveBeenCalled();
    expect(api.matches).not.toHaveBeenCalled();
    expect(api.standings).not.toHaveBeenCalled();
    expect(component.error).toBe('');
  });

  it('requires a full round-robin calendar and one game per player before enabling completion', () => {
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    component.standings = {
      tournamentId: 9, status: 'IN_PROGRESS', totalMatches: 2, completedMatches: 2,
      winPoints: 3, drawPoints: 1, lossPoints: 0,
      standings: [1, 2, 3].map(id => ({
        position: id, profileId: id, username: 'p' + id, displayName: 'Player ' + id,
        played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 1,
        goalDifference: 0, points: 3
      }))
    };
    expect(component.canComplete).toBeFalse();
    component.standings.totalMatches = 3;
    component.standings.completedMatches = 3;
    expect(component.canComplete).toBeTrue();
    component.standings.standings[0].played = 1;
    expect(component.canComplete).toBeFalse();
  });

  it('does not suggest another registration when the roster is not fully loaded', async () => {
    component.participantsHasMore = true;
    expect(component.myEnrollment).toBeUndefined();
    await component.join();
    expect(api.join).not.toHaveBeenCalled();
  });

  it('ignores a previous community list response after switching communities', () => {
    const oldResponse = new Subject<TournamentPage>();
    api.list.and.returnValue(oldResponse);
    component.community = { ...community, id: 11 };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.community = { ...community, id: 12 };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });

    oldResponse.next({ tournaments: [draft], page: 0, hasMore: false });
    oldResponse.complete();

    expect(component.selected).toBeUndefined();
    expect(component.tournaments).toEqual([]);
    expect(component.loading).toBeFalse();
    expect(api.list).toHaveBeenCalledWith(12, 0);
  });

  it('keeps previously loaded fixture pages after saving a result and refreshes standings', async () => {
    const match: TournamentMatch = {
      id: 84, roundNumber: 9, homeProfileId: 1, homeUsername: 'ana',
      awayProfileId: 2, awayUsername: 'rui', status: 'SCHEDULED',
      homeScore: null, awayScore: null
    };
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    component.matches = [match];
    component.matchesPage = 3;
    component.matchesHasMore = true;
    component.setScore(match, 'home', 2);
    component.setScore(match, 'away', 1);
    api.recordResult.and.returnValue(of({
      ...match, status: 'COMPLETED', homeScore: 2, awayScore: 1
    }));
    api.participants.calls.reset();
    api.matches.calls.reset();
    api.standings.calls.reset();

    await component.saveScore(match);

    expect(api.recordResult).toHaveBeenCalledWith(7, 9, 84, 2, 1);
    expect(component.matchesPage).toBe(3);
    expect(component.matchesHasMore).toBeTrue();
    expect(component.matches.length).toBe(1);
    expect(component.matches[0].status).toBe('COMPLETED');
    expect(component.scoreDraft(match)).toEqual({ home: 2, away: 1 });
    expect(api.matches).not.toHaveBeenCalled();
    expect(api.participants).not.toHaveBeenCalled();
    expect(api.standings).toHaveBeenCalledWith(7, 9);
  });

  it('releases the busy state on tournament switch while an old participants page is loading', () => {
    const pendingPage = new Subject<TournamentParticipantPage>();
    api.participants.and.returnValue(pendingPage);
    component.participantsHasMore = true;
    component.loadMoreParticipants();
    expect(component.busy).toBeTrue();

    api.participants.and.returnValue(of({ participants: [], page: 0, hasMore: false }));
    component.selectTournament({ ...draft, id: 21, name: 'Outra liga' });
    expect(component.busy).toBeFalse();
    expect(component.selected?.id).toBe(21);

    pendingPage.next({
      participants: [{ profileId: 100, username: 'stale', displayName: 'Antigo',
        joinedAt: '2026-10-16T12:00:00Z', status: 'CONFIRMED' }],
      page: 1, hasMore: false
    });
    pendingPage.complete();
    expect(component.participants).toEqual([]);
    expect(component.busy).toBeFalse();
    expect(component.error).toBe('');
  });

  it('discards a previous tournament mutation error after selecting a different tournament', async () => {
    const pendingJoin = new Subject<TournamentParticipant>();
    api.join.and.returnValue(pendingJoin);
    const joining = component.join();
    expect(component.busy).toBeTrue();

    component.selectTournament({ ...draft, id: 22, name: 'Liga nova' });
    expect(component.busy).toBeFalse();
    pendingJoin.error(new Error('A operação anterior falhou'));
    await joining;

    expect(component.selected?.id).toBe(22);
    expect(component.error).toBe('');
    expect(component.feedback).toBe('');
    expect(component.busy).toBeFalse();
  });

  it('ignores a stale success even if the user returns to the same tournament', async () => {
    const pendingJoin = new Subject<TournamentParticipant>();
    api.join.and.returnValue(pendingJoin);
    const joining = component.join();

    component.selectTournament({ ...draft, id: 25 });
    component.selectTournament({ ...draft });
    pendingJoin.next({
      profileId: 1, username: 'owner', displayName: 'Owner',
      joinedAt: '2026-10-16T12:00:00Z', status: 'PENDING'
    });
    pendingJoin.complete();
    await joining;

    expect(component.selected?.id).toBe(9);
    expect(component.feedback).toBe('');
    expect(component.error).toBe('');
    expect(component.busy).toBeFalse();
  });

  it('rejects one-character tournament names before calling the API', async () => {
    component.nameDraft = ' A ';
    expect(component.nameTooShort).toBeTrue();
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('2 e 120');
    component.nameDraft = 'Liga';
    expect(component.nameTooShort).toBeFalse();
  });

  it('shows marker validation only after the match inputs are touched', () => {
    const game: TournamentMatch = {
      id: 50, roundNumber: 1, homeProfileId: 1, homeUsername: 'owner',
      awayProfileId: 2, awayUsername: 'rui', status: 'SCHEDULED',
      homeScore: null, awayScore: null
    };
    expect(component.isScoreInvalid(game)).toBeFalse();
    component.setScore(game, 'home', -1);
    expect(component.isScoreInvalid(game)).toBeTrue();
    component.setScore(game, 'home', 2);
    component.setScore(game, 'away', 1);
    expect(component.isScoreInvalid(game)).toBeFalse();
  });

  it('blocks scheduling while the roster has more pages or detail did not load', async () => {
    component.participants = [1, 2].map(id => ({
      profileId: id, username: 'p' + id, displayName: 'Jogador ' + id,
      status: 'CONFIRMED' as const, joinedAt: '2026-10-16T12:00:00Z'
    }));
    component.confirmAction = 'schedule';
    component.rosterReady = false;
    expect(component.canPublishSchedule).toBeFalse();
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();

    component.rosterReady = true;
    component.participantsHasMore = true;
    expect(component.canPublishSchedule).toBeFalse();
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();

    component.participantsHasMore = false;
    expect(component.canPublishSchedule).toBeTrue();
  });

  it('refuses scheduling with more than 32 confirmed players', async () => {
    component.rosterReady = true;
    component.participants = Array.from({ length: 33 }, (_, i) => ({
      profileId: i + 1, username: 'p' + (i + 1), displayName: 'Jogador ' + (i + 1),
      status: 'CONFIRMED' as const, joinedAt: '2026-10-16T12:00:00Z'
    }));
    component.confirmAction = 'schedule';
    expect(component.confirmedCount).toBe(33);
    expect(component.canPublishSchedule).toBeFalse();
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();
  });

  it('shows goal terminology only for goal-based sports', () => {
    expect(tournamentScoreTerminology('Futebol').scoreInput).toBe('Golos de');
    expect(tournamentScoreTerminology('Andebol').forAbbrev).toBe('GM');
    expect(tournamentScoreTerminology('Futsal').differenceTitle).toBe('Diferença de golos');
  });

  it('uses points for basketball, rugby and American football instead of goals', () => {
    expect(tournamentScoreTerminology('Basquetebol').scoreInput).toBe('Pontos de');
    expect(tournamentScoreTerminology('Basquetebol 3x3').forAbbrev).toBe('PM');
    expect(tournamentScoreTerminology('Rugby').againstTitle).toBe('Pontos sofridos');
    expect(tournamentScoreTerminology('Futebol Americano').forAbbrev).toBe('PM');
    component.community = { ...community, sport: 'Futebol' };
    component.selected = { ...draft, sport: 'Basquetebol' };
    expect(component.scoring.scoreInput).toBe('Pontos de');
  });

  it('uses sets terminology without implying full per-set scoring or pairs', () => {
    for (const sport of ['Pádel', 'Ténis', 'Voleibol', 'Badminton', 'Ténis de mesa']) {
      const terms = tournamentScoreTerminology(sport);
      expect(terms.scoreInput).toBe('Sets ganhos de');
      expect(terms.differenceAbbrev).toBe('DS');
      expect(terms.note).toContain('Não regista o resultado de cada set');
    }
  });

  it('localizes individual sport scoring terms and registration statuses without changing the sport profile', () => {
    const original = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'en');
      component.selected = { ...draft, sport: 'Futebol' };
      expect(component.scoring.scoreInput).toBe('Goals for');
      expect(component.scoring.forAbbrev).toBe('GF');
      expect(component.scoring.againstAbbrev).toBe('GA');
      expect(component.scoring.differenceTitle).toBe('Goal difference');
      expect(component.formatStatus('PENDING')).toBe('Awaiting approval');
      expect(component.formatStatus('CONFIRMED')).toBe('Confirmed');
      component.selected = { ...draft, sport: 'Basquetebol' };
      expect(component.scoring.scoreInput).toBe('Points for');
      expect(component.scoring.forAbbrev).toBe('PF');
      component.selected = { ...draft, sport: 'Ténis' };
      expect(component.scoring.scoreInput).toBe('Sets won by');
      expect(component.scoring.forAbbrev).toBe('SW');
      component.selected = { ...draft, sport: 'Xadrez' };
      expect(component.scoring.scoreInput).toBe('Score for');
      expect(component.scoring.forAbbrev).toBe('SF');

      localStorage.setItem('d24-language', 'pt');
      component.selected = { ...draft, sport: 'Futebol' };
      expect(component.scoring.forAbbrev).toBe('GM');
      expect(component.scoring.scoreInput).toBe('Golos de');
      expect(component.formatStatus('PENDING')).toBe('A aguardar aprovação');
      expect(component.formatStatus('CONFIRMED')).toBe('Confirmado');
    } finally {
      if (original === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', original);
    }
  });

  it('does not call unknown sports football by default', () => {
    for (const sport of [null, 'Ciclismo', 'Natação', 'Atletismo']) {
      const terms = tournamentScoreTerminology(sport);
      expect(terms.scoreInput).toBe('Marcador de');
      expect(terms.forAbbrev).toBe('MF');
      expect(terms.note).toContain('não suporta pares');
    }
  });

  it('navigates to the exact original row in a multi-phase historical archive', () => {
    const rows: HistoricalMatchArchive['rows'] = Array.from({ length: 61 }, (_, index) => ({
      sourceRow: index + 100,
      home: 'Casa ' + index, away: 'Fora ' + index,
      homeScore: 2, awayScore: 1,
      sourceRound: index < 52 ? 'Jornada 1' : index < 56 ? 'Quartos de final'
        : index < 58 ? 'Meias-finais' : 'Final',
      sourceDate: '', potentialDuplicate: false
    }));
    component.historicalArchive = {
      id: 7, title: 'Arquivo QA', entryType: 'TEAM',
      sourceFilename: 'historico.xlsx', createdAt: '2026-10-25T00:00:00Z', rows
    };
    const target = jasmine.createSpyObj<HTMLElement>('row', ['scrollIntoView']);
    const section = jasmine.createSpyObj<HTMLElement>('section', ['querySelector', 'scrollIntoView']);
    section.querySelector.and.returnValue(target);
    (component as any).historicalArchiveFixtures = { nativeElement: section };

    component.showHistoricalKnockoutPhase(58);
    expect(component.historicalArchivePage).toBe(1);
    expect(section.querySelector).toHaveBeenCalledWith('[data-historical-source-row="158"]');
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(section.scrollIntoView).not.toHaveBeenCalled();
  });

  it('cycles only flagged quarterfinal rows in source order across pages and wraps', () => {
    const rows: HistoricalMatchArchive['rows'] = Array.from({ length: 53 }, (_, index) => ({
      sourceRow: 500 + index,
      home: 'Casa', away: 'Fora', homeScore: index === 49 ? 1 : 2,
      awayScore: index === 49 ? 1 : 0,
      sourceRound: index === 49 || index === 50 || index === 51
        ? 'Quartos de final' : 'Jornada 1',
      sourceDate: '', potentialDuplicate: index === 51
    }));
    component.historicalArchive = {
      id: 90, title: 'Copa QA', entryType: 'TEAM',
      sourceFilename: 'copa.xlsx', createdAt: '2026-10-25T00:00:00Z', rows
    };
    const target = jasmine.createSpyObj<HTMLElement>('row', ['scrollIntoView']);
    const section = jasmine.createSpyObj<HTMLElement>('section', ['querySelector', 'scrollIntoView']);
    section.querySelector.and.returnValue(target);
    (component as any).historicalArchiveFixtures = { nativeElement: section };

    const quarter = component.historicalKnockoutPhases[0];
    expect(quarter.reviewArchiveIndices).toEqual([49, 51]);
    component.showNextHistoricalReview(quarter);
    expect(component.historicalArchivePage).toBe(0);
    expect(section.querySelector).toHaveBeenCalledWith('[data-historical-source-row="549"]');
    expect(component.historicalReviewCursor.quarterfinal).toBe(0);

    component.showNextHistoricalReview(quarter);
    expect(component.historicalArchivePage).toBe(1);
    expect(section.querySelector).toHaveBeenCalledWith('[data-historical-source-row="551"]');
    expect(component.historicalReviewCursor.quarterfinal).toBe(1);

    component.showNextHistoricalReview(quarter);
    expect(component.historicalArchivePage).toBe(0);
    expect(component.historicalReviewCursor.quarterfinal).toBe(0);
    expect(target.scrollIntoView).toHaveBeenCalledTimes(3);
    expect(rows[49].homeScore).toBe(1);
    expect(rows[51].potentialDuplicate).toBeTrue();
  });

  it('does not navigate to an inferred review fixture on mere stage count mismatch', () => {
    const rows: HistoricalMatchArchive['rows'] = [{
      sourceRow: 17, home: 'Casa', away: 'Fora', homeScore: 3, awayScore: 0,
      sourceRound: 'Quartos de final', sourceDate: '', potentialDuplicate: false
    }];
    component.historicalArchive = {
      id: 99, title: 'Copa QA', entryType: 'TEAM',
      sourceFilename: 'copa.xlsx', createdAt: '2026-10-25T00:00:00Z', rows
    };
    const quarter = component.historicalKnockoutPhases[0];
    expect(quarter.requiresReview).toBeTrue();
    expect(quarter.reviewArchiveIndices).toEqual([]);
    component.showNextHistoricalReview(quarter);
    expect(component.historicalArchivePage).toBe(0);
    expect(component.historicalReviewCursor.quarterfinal).toBe(-1);
  });

  it('falls back to the archived section when the target row is not rendered', () => {
    const rows: HistoricalMatchArchive['rows'] = [{
      sourceRow: 404, home: 'A', away: 'B', homeScore: 1, awayScore: 0,
      sourceRound: 'Final', sourceDate: '', potentialDuplicate: false
    }];
    component.historicalArchive = {
      id: 8, title: 'Arquivo QA', entryType: 'TEAM',
      sourceFilename: 'historico.xlsx', createdAt: '2026-10-25T00:00:00Z', rows
    };
    const section = jasmine.createSpyObj<HTMLElement>('section', ['querySelector', 'scrollIntoView']);
    section.querySelector.and.returnValue(null);
    (component as any).historicalArchiveFixtures = { nativeElement: section };

    component.showHistoricalKnockoutPhase(0);
    expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    component.showHistoricalKnockoutPhase(9);
    expect(section.querySelector).toHaveBeenCalledTimes(1);
  });

  it('translates tournament detail notices and irreversible delete confirmation in PT/EN', () => {
    const previous = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'en');
      expect(t('communities.tournaments.detailUi.pointsSummary', { win: 3, draw: 1, loss: 0 }))
        .toBe('Win 3 · Draw 1 · Loss 0 points');
      expect(t('communities.tournaments.detailUi.deleteWarning', { name: 'Autumn Cup' }))
        .toContain('Delete “Autumn Cup”?');
      expect(t('communities.tournaments.detailUi.groupQualification')).toContain('draw order');
      expect(t('communities.tournaments.detailUi.chessPoints')).toBe('Chess · Win 1 · Draw ½ · Loss 0');
      localStorage.setItem('d24-language', 'pt');
      expect(t('communities.tournaments.detailUi.pointsSummary', { win: 3, draw: 1, loss: 0 }))
        .toBe('Vitória 3 · Empate 1 · Derrota 0 pontos');
      expect(t('communities.tournaments.detailUi.deleteWarning', { name: 'Taça de Outono' }))
        .toContain('Eliminar “Taça de Outono”?');
      expect(t('communities.tournaments.detailUi.chessPoints')).toBe('Xadrez · Vitória 1 · Empate ½ · Derrota 0');
      expect(api.delete).not.toHaveBeenCalled();
    } finally {
      if (previous === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', previous);
    }
  });

  it('localizes backend completion conflicts and never leaks unknown Portuguese API errors in English', async () => {
    const original = localStorage.getItem('d24-language');
    try {
      component.startIndividualCreation();
      component.nameDraft = 'Liga QA';
      component.sportDraft = 'Futebol';
      api.create.and.returnValue(throwError(() => ({
        error: { detail: 'Todos os confrontos da liga precisam de estar concluídos' }, status: 409
      })));
      localStorage.setItem('d24-language', 'en');
      await component.create();
      expect(component.error).toBe('All league matches must be completed before closing the tournament.');
      expect(component.selected?.id).toBe(9);
      expect(component.feedback).toBe('');
      expect(component.busy).toBeFalse();

      localStorage.setItem('d24-language', 'pt');
      await component.create();
      expect(component.error).toBe('Todos os confrontos da liga precisam de estar concluídos');

      api.create.and.returnValue(throwError(() => ({
        error: { detail: 'Erro inesperado do servidor' }, status: 422
      })));
      localStorage.setItem('d24-language', 'en');
      await component.create();
      expect(component.error).toBe('Could not complete the operation. Check the information and try again.');
      localStorage.setItem('d24-language', 'pt');
      await component.create();
      expect(component.error).toBe('Erro inesperado do servidor');

      api.create.and.returnValue(throwError(() => ({ error: { detail: '   ' }, status: 500 })));
      await component.create();
      expect(component.error).toBe('Não foi possível concluir a operação. Verifica os dados e tenta novamente.');
      expect(api.create).toHaveBeenCalledTimes(5);
    } finally {
      if (original === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', original);
    }
  });

  it('uses the existing PT/EN standings abbreviations consistently without touching match totals', () => {
    const original = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'en');
      expect(['playedCol', 'winsCol', 'drawsCol', 'lossesCol', 'pointsCol'].map(col =>
        t('communities.tournaments.finalUi.' + col))).toEqual(['P', 'W', 'D', 'L', 'Pts']);
      localStorage.setItem('d24-language', 'pt');
      expect(['playedCol', 'winsCol', 'drawsCol', 'lossesCol', 'pointsCol'].map(col =>
        t('communities.tournaments.finalUi.' + col))).toEqual(['J', 'V', 'E', 'D', 'Pts']);
    } finally {
      if (original === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', original);
    }
  });

  it('uses skating-only copy and status instead of generic WDL point labels', () => {
    component.startIndividualCreation();
    component.sportDraft = 'Patinagem de Velocidade';
    expect(component.isInlineSpeedDraft).toBeTrue();
    expect(component.isSportFormatSupported).toBeTrue();
    expect(component.speedTournamentStatus('DRAFT')).toBe(
      t('communities.inlineSpeed.status.DRAFT'));
    expect(component.speedTournamentStatus('IN_PROGRESS')).toBe(
      t('communities.inlineSpeed.status.IN_PROGRESS'));
    expect(component.isInlineSpeedTournament({ ...draft, sport: 'Patinagem de Velocidade' })).toBeTrue();
    expect(component.isInlineSpeedTournament({ ...draft, sport: 'Futebol' })).toBeFalse();
    expect(component.isInlineSpeedTournament({ ...draft, sport: 'Patinagem de Velocidade',
      historicalArchiveId: 32 })).toBeFalse();
  });

  it('explains three-way cutoff ties before offering any arbitrary selection, PT/EN', () => {
    const p = { sourceStage: 'FIRST', targetStage: 'QUARTER', playerIds: [],
      expectedCount: 16, ready: false, warning: 'Empate múltiplo no limite do 16.º' } as any;
    const previous = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'pt');
      expect(component.speedProposalWarning(p)).toContain('Empate de três');
      localStorage.setItem('d24-language', 'en');
      expect(component.speedProposalWarning(p)).toContain('Three or more');
    } finally {
      if (previous === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', previous);
    }
  });

  it('never lets the jury select a disqualified skater until source result correction', () => {
    component.speedOverview = {
      tournamentId: 9, discipline: 'TRACK_500D', availableHeats: [], decisions: [],
      proposals: [], linkedHeats: [{
        roundId: 101, heatNumber: 1, name: 'QA fictícia',
        eventType: 'INLINE_TRACK_500D_FIRST_ROUND',
        skaters: [
          { playerId: 1, name: 'Ana', disqualified: false, position: null, seconds: 30 },
          { playerId: 2, name: 'Bruno', disqualified: true, position: null, seconds: 31 }
        ]
      }]
    };
    component.speedSelections = { FIRST: [1] };
    component.toggleSpeedChosen('FIRST', 2);
    expect(component.speedSelections['FIRST']).toEqual([1]);
    component.toggleSpeedChosen('FIRST', 1);
    expect(component.speedSelections['FIRST']).toEqual([]);
  });

  it('requires a detailed explanation for an exceptional 17th qualifier without a time tie', async () => {
    component.selected = { ...draft, sport: 'Patinagem de Velocidade' };
    component.speedOverview = {
      tournamentId: 9, discipline: 'TRACK_500D', availableHeats: [], decisions: [],
      proposals: [], linkedHeats: [{
        roundId: 102, heatNumber: 1, name: '20 fictional skaters',
        eventType: 'INLINE_TRACK_500D_FIRST_ROUND',
        skaters: Array.from({ length: 20 }, (_, index) => ({
          playerId: index + 1, name: 'QA ' + (index + 1),
          disqualified: false, position: null, seconds: index + 30
        }))
      }]
    };
    component.speedSelections = { FIRST: Array.from({ length: 17 }, (_, i) => i + 1) };
    component.speedReasons = { FIRST: 'Júri confirma' };
    const p = { sourceStage: 'FIRST', targetStage: 'QUARTER',
      expectedCount: 16, ready: true, warning: '',
      playerIds: Array.from({ length: 16 }, (_, i) => i + 1) } as any;
    await component.confirmSpeedStage(p);
    expect(component.error).toBe(t('communities.inlineSpeed.exceptionReasonRequired'));
    expect(api.inlineSpeedOverview).not.toHaveBeenCalled();
  });

  it('creates speed skating with zero generic football points and loads heat progression', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Campeonato de Patinagem 2026';
    component.sportDraft = 'Patinagem de Velocidade';
    api.create.and.returnValue(of({
      ...draft, name: component.nameDraft, sport: 'Patinagem de Velocidade',
      winPoints: 0, drawPoints: 0, lossPoints: 0
    }));
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Campeonato de Patinagem 2026',
      'Patinagem de Velocidade', { winPoints: 0, drawPoints: 0, lossPoints: 0 });
    expect(component.selected?.sport).toBe('Patinagem de Velocidade');
    expect(api.inlineSpeedOverview).toHaveBeenCalled();
    expect(api.generateSchedule).not.toHaveBeenCalled();
  });

  it('requires a separate recorded jury tie-break to resolve a fictional three-way cutoff', async () => {
    component.selected = { ...draft, sport: 'Patinagem de Velocidade' };
    const skaters = Array.from({ length: 20 }, (_, i) => ({
      playerId: i + 1, name: 'Fictício ' + (i + 1),
      seconds: i >= 15 && i <= 17 ? 30.16 : 30 + (i + 1) / 100,
      position: null, disqualified: false
    }));
    const proposal = {
      sourceStage: 'FIRST' as const, targetStage: 'QUARTER' as const,
      playerIds: [], expectedCount: 16, ready: false,
      warning: 'Empate múltiplo no limite do 16.º'
    };
    const overview = {
      tournamentId: 9, discipline: 'TRACK_500D' as const,
      linkedHeats: [{
        roundId: 100, name: 'Manga fictícia', eventType: 'INLINE_TRACK_500D_FIRST_ROUND',
        heatNumber: 1, skaters
      }], availableHeats: [], proposals: [proposal], decisions: [],
      tieBreaks: []
    };
    component.speedOverview = overview;
    expect(component.isSpeedMultiwayTie(proposal)).toBeTrue();
    const candidates = component.speedTieCandidates();
    expect(candidates.length).toBe(18);
    expect(candidates.filter(s => component.speedTieGuaranteed(s)).length).toBe(15);
    component.speedSelections = { FIRST: Array.from({ length: 15 }, (_, i) => i + 1) };
    component.toggleSpeedChosen('FIRST', 1);
    expect(component.speedSelections['FIRST']).toContain(1);
    component.toggleSpeedChosen('FIRST', 18);
    expect(component.speedSelections['FIRST']?.length).toBe(16);
    component.speedReasons = { FIRST: 'Curto' };
    await component.resolveSpeedTie(proposal);
    expect(api.resolveInlineSpeedTieBreak).not.toHaveBeenCalled();
    component.speedReasons = { FIRST: 'O júri reviu a prova de desempate com vídeo oficial' };
    component.speedEvidenceType = 'OFFICIAL_MINUTES';
    component.speedEvidenceReference = 'Ata oficial 2026-011';
    api.resolveInlineSpeedTieBreak.and.returnValue(of({
      ...overview, proposals: [{ ...proposal, ready: true,
        playerIds: component.speedSelections['FIRST'] ?? [] }],
      tieBreaks: [{ sourceStage: 'FIRST', selectedPlayerIds: component.speedSelections['FIRST'] ?? [],
        reason: component.speedReasons['FIRST'] ?? '', confirmedBy: 'owner',
        confirmedAt: '2026-10-25T15:00:00Z', stale: false }]
    }));
    await component.resolveSpeedTie(proposal);
    expect(api.resolveInlineSpeedTieBreak).toHaveBeenCalledWith(7, 9,
      Array.from({ length: 15 }, (_, i) => i + 1).concat(18),
      'O júri reviu a prova de desempate com vídeo oficial',
      'OFFICIAL_MINUTES', 'Ata oficial 2026-011', [], '');
  });

  it('preserves tie-break revision history and blocks edits after ratification', () => {
    component.selected = { ...draft, status: 'IN_PROGRESS', sport: 'Patinagem de Velocidade' };
    const proposal = { sourceStage: 'FIRST' as const,
      targetStage: 'QUARTER' as const, playerIds: Array.from({ length: 16 }, (_, i) => i + 1),
      expectedCount: 16, ready: true, warning: '' };
    const ruling = { sourceStage: 'FIRST' as const,
      selectedPlayerIds: [...proposal.playerIds],
      reason: 'A prova de desempate foi analisada pelo júri',
      confirmedBy: 'owner', confirmedAt: '2026-10-25T16:00:00Z', stale: false,
      evidenceType: 'VIDEO_REVIEW' as const,
      evidenceReference: 'Vídeo oficial #011',
      revisions: [{ revision: 1, selectedPlayerIds: [...proposal.playerIds],
        reason: 'A prova de desempate foi analisada pelo júri',
        confirmedBy: 'owner', confirmedAt: '2026-10-25T16:00:00Z', stale: false,
        evidenceType: 'VIDEO_REVIEW' as const,
        evidenceReference: 'Vídeo oficial #011' }] };
    component.speedOverview = { tournamentId: 9, discipline: 'TRACK_500D',
      linkedHeats: [], availableHeats: [], proposals: [proposal], decisions: [],
      tieBreaks: [ruling] };
    expect(component.speedCanAmendTie(proposal)).toBeTrue();
    component.startSpeedTieCorrection(proposal);
    expect(component.speedTieCorrectionOpen).toBeTrue();
    expect(component.speedSelections['FIRST']).toEqual(ruling.selectedPlayerIds);
    expect(component.speedReasons['FIRST']).toBe(ruling.reason);
    expect(component.speedEvidenceType).toBe('VIDEO_REVIEW');
    expect(component.speedEvidenceReference).toBe('Vídeo oficial #011');
    component.speedOverview.decisions = [{ sourceStage: 'FIRST', targetStage: 'QUARTER',
      playerIds: proposal.playerIds, reason: 'Ratificado', confirmedBy: 'owner',
      confirmedAt: '2026-10-25T16:15:00Z', stale: false }];
    expect(component.speedCanAmendTie(proposal)).toBeFalse();
  });

  it('links the real trial to one jury revision and never ratifies automatically', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS', sport: 'Patinagem de Velocidade' };
    const skaters = Array.from({ length: 20 }, (_, i) => ({
      playerId: i + 1, name: 'Patinador QA ' + (i + 1),
      seconds: i >= 15 && i <= 17 ? 30.16 : 30 + (i + 1) / 100,
      position: null, disqualified: false
    }));
    const proposal = {
      sourceStage: 'FIRST' as const, targetStage: 'QUARTER' as const,
      expectedCount: 16, playerIds: [], ready: false,
      warning: 'Empate múltiplo no limite do 16.º'
    };
    const trial = {
      id: 101, sourceStage: 'FIRST' as const,
      heldAt: '2026-10-25T10:00:00Z', officialReference: 'Ata QA #101',
      reason: 'Prova adicional realmente realizada', recordedBy: 'owner',
      recordedAt: '2026-10-25T11:00:00Z', stale: false, results: []
    };
    const overview = {
      tournamentId: 9, discipline: 'TRACK_500D' as const,
      linkedHeats: [{ roundId: 100, name: 'Manga QA',
        eventType: 'INLINE_TRACK_500D_FIRST_ROUND', heatNumber: 1, skaters }],
      availableHeats: [], proposals: [proposal], decisions: [], tieBreaks: [],
      trials: [trial, { ...trial, id: 102, stale: true }]
    };
    component.speedOverview = overview;
    component.speedSelections = {
      FIRST: Array.from({ length: 15 }, (_, i) => i + 1).concat(18)
    };
    component.speedReasons = {
      FIRST: 'A prova de desempate real foi analisada e registada pelo júri'
    };
    component.speedEvidenceType = 'TIEBREAK_TRIAL';
    component.speedEvidenceReference = 'Ata oficial da prova de desempate #101';
    expect(component.speedAvailableTieTrials().map(t => t.id)).toEqual([101]);
    component.toggleSpeedTrialLink(102, true);
    expect(component.speedTieTrialIds).toEqual([]);
    await component.resolveSpeedTie(proposal);
    expect(api.resolveInlineSpeedTieBreak).not.toHaveBeenCalled();
    component.toggleSpeedTrialLink(101, true);
    const chosen = component.speedSelections['FIRST'];
    const reason = component.speedReasons['FIRST'];
    const savedOverview: InlineSpeedOverview = {
      ...overview, tieBreaks: [{
        sourceStage: 'FIRST', selectedPlayerIds: chosen, reason, confirmedBy: 'owner',
        confirmedAt: '2026-10-25T12:00:00Z', stale: false, trialIds: [101],
        revisions: [{
          revision: 1, selectedPlayerIds: chosen, reason, confirmedBy: 'owner',
          confirmedAt: '2026-10-25T12:00:00Z', stale: false, trialIds: [101]
        }]
      }]
    };
    api.resolveInlineSpeedTieBreak.and.returnValue(of(savedOverview));
    api.inlineSpeedOverview.and.returnValue(of(savedOverview));
    await component.resolveSpeedTie(proposal);
    expect(api.resolveInlineSpeedTieBreak).toHaveBeenCalledWith(
      7, 9, chosen, reason, 'TIEBREAK_TRIAL',
      'Ata oficial da prova de desempate #101', [101], '');
    expect(component.speedOverview?.decisions.length).toBe(0);
    expect(component.speedTrialUsedRevisions(101)).toEqual([1]);
    const ruling = component.speedTieBreak('FIRST')!;
    component.speedOverview!.proposals = [{ ...proposal, ready: true }];
    component.startSpeedTieCorrection({ ...proposal, ready: true });
    expect(component.speedTieTrialIds).toEqual(ruling.trialIds ?? []);
  });

  it('requires an explicit jury reason when selected skater placed behind an excluded one', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS', sport: 'Patinagem de Velocidade' };
    const proposal = { sourceStage: 'FIRST' as const, targetStage: 'QUARTER' as const,
      expectedCount: 16, playerIds: [], ready: false,
      warning: 'Empate múltiplo no limite do 16.º' };
    const chosen = Array.from({ length: 16 }, (_, i) => i + 1);
    const trial = {
      id: 301, sourceStage: 'FIRST' as const,
      heldAt: '2026-10-25T10:00:00Z', officialReference: 'Ata de QA 301',
      reason: 'Prova realizada perante júri', recordedBy: 'owner',
      recordedAt: '2026-10-25T11:00:00Z', stale: false,
      results: [{ playerId: 18, place: 1, seconds: 31.001 },
        { playerId: 17, place: 2, seconds: 31.002 },
        { playerId: 16, place: 3, seconds: 31.003 }]
    };
    const overview: InlineSpeedOverview = { tournamentId: 9, discipline: 'TRACK_500D',
      linkedHeats: [], availableHeats: [], proposals: [proposal], decisions: [],
      tieBreaks: [], trials: [trial] };
    component.speedOverview = overview;
    component.speedSelections = { FIRST: chosen };
    component.speedTieTrialIds = [301];
    component.speedReasons = { FIRST: 'O júri reviu a decisão de desempate com toda a documentação' };
    component.speedEvidenceType = 'TIEBREAK_TRIAL';
    component.speedEvidenceReference = 'Ata oficial da prova de desempate QA 301';
    expect(component.speedTrialOrderConflicts().length).toBe(2);
    await component.resolveSpeedTie(proposal);
    expect(api.resolveInlineSpeedTieBreak).not.toHaveBeenCalled();
    const override = 'A ordem da prova foi reavaliada perante irregularidade registada na ata oficial';
    component.speedTrialOrderExceptionReason = override;
    api.resolveInlineSpeedTieBreak.and.returnValue(of(overview));
    api.inlineSpeedOverview.and.returnValue(of(overview));
    await component.resolveSpeedTie(proposal);
    expect(api.resolveInlineSpeedTieBreak).toHaveBeenCalledWith(
      7, 9, chosen, component.speedReasons['FIRST'], 'TIEBREAK_TRIAL',
      'Ata oficial da prova de desempate QA 301', [301], override);
    expect(component.speedOverview?.decisions.length).toBe(0);
  });

  it('records only an actual fictional cutoff trial and never confirms qualifiers', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS', sport: 'Patinagem de Velocidade' };
    const skaters = Array.from({ length: 20 }, (_, i) => ({
      playerId: i + 1, name: 'Patinador QA ' + (i + 1),
      seconds: i >= 15 && i <= 17 ? 30.16 : 30 + (i + 1) / 100,
      position: null, disqualified: false
    }));
    const proposal = { sourceStage: 'FIRST' as const,
      targetStage: 'QUARTER' as const, playerIds: [], expectedCount: 16,
      ready: false, warning: 'Empate múltiplo no limite do 16.º' };
    const overview = {
      tournamentId: 9, discipline: 'TRACK_500D' as const,
      linkedHeats: [{ roundId: 202, name: 'Manga QA', eventType: 'INLINE_TRACK_500D_FIRST_ROUND',
        heatNumber: 1, skaters }], availableHeats: [], proposals: [proposal],
      decisions: [], tieBreaks: [], trials: []
    };
    component.speedOverview = overview;
    expect(component.speedTrialCandidates().map(s => s.playerId)).toEqual([16, 17, 18]);
    component.openSpeedTrial();
    expect(component.speedTrialOpen).toBeTrue();
    component.speedTrialHeldAt = '2026-10-25T10:00';
    component.speedTrialReference = 'Ata oficial de QA 101';
    component.speedTrialReason = 'Uma prova adicional foi efetivamente realizada perante o júri.';
    component.speedTrialPlaces = { 16: 3, 17: 2, 18: 1 };
    component.speedTrialTimes = { 16: 31.003, 17: 31.002, 18: 31.001 };
    api.recordInlineSpeedTrial.and.returnValue(of({ ...overview, trials: [{
      id: 101, sourceStage: 'FIRST', heldAt: '2026-10-25T10:00:00Z',
      officialReference: 'Ata oficial de QA 101', reason: component.speedTrialReason,
      recordedBy: 'owner', recordedAt: '2026-10-25T11:00:00Z', stale: false,
      results: [{ playerId: 18, place: 1, seconds: 31.001 },
        { playerId: 17, place: 2, seconds: 31.002 },
        { playerId: 16, place: 3, seconds: 31.003 }]
    }] }));
    await component.recordSpeedTrial();
    expect(api.recordInlineSpeedTrial).toHaveBeenCalledTimes(1);
    const [cId, tId, payload] = api.recordInlineSpeedTrial.calls.mostRecent().args;
    expect([cId, tId]).toEqual([7, 9]);
    expect(payload.actuallyHeld).toBeTrue();
    expect(payload.results).toEqual([
      { playerId: 16, place: 3, seconds: 31.003 },
      { playerId: 17, place: 2, seconds: 31.002 },
      { playerId: 18, place: 1, seconds: 31.001 }
    ]);
    expect(component.speedTrialOpen).toBeFalse();
    expect(component.speedOverview?.decisions.length).toBe(0);
    component.speedOverview = overview; // reset mocked GET so the fictional tie is still visible
    component.openSpeedTrial();
    component.speedTrialPlaces = { 16: 1, 17: 1, 18: 3 };
    await component.recordSpeedTrial();
    expect(api.recordInlineSpeedTrial).toHaveBeenCalledTimes(1);
    component.speedOverview!.decisions = [{
      sourceStage: 'FIRST', targetStage: 'QUARTER', playerIds: Array.from({ length: 16 }, (_, i) => i + 1),
      reason: 'Ratificação oficial', confirmedBy: 'owner',
      confirmedAt: '2026-10-25T12:00:00Z', stale: false
    }];
    component.speedTrialOpen = false;
    component.openSpeedTrial();
    expect(component.speedTrialOpen).toBeFalse();
    await component.recordSpeedTrial();
    expect(api.recordInlineSpeedTrial).toHaveBeenCalledTimes(1);
  });

  it('keeps regular individual league points intact for other sports', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Liga de Futebol';
    component.sportDraft = 'Futebol';
    expect(component.isInlineSpeedDraft).toBeFalse();
    api.create.and.returnValue(of({ ...draft, name: component.nameDraft, sport: 'Futebol' }));
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de Futebol', 'Futebol',
      { winPoints: 3, drawPoints: 1, lossPoints: 0 });
  });

});
