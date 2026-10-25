import { CommunityRound } from '../model/community-group';
import {
  sprintQualificationTieGroups, emptySprintTieDraft, sprintOfficialTieDecisions
} from './community-track-sprint-official-ties';

function qualification(starters: number): CommunityRound {
  return {
    id: 41, name: 'Flying 200 m', playedAt: '2026-10-25T13:00:00Z',
    sport: 'Ciclismo de Pista', eventType: 'TRACK_FLYING_200',
    entries: Array.from({ length: starters }, (_, i) => ({
      username: 'r' + (i + 1),
      elapsedSeconds: 10 + (i + 1) / 1000,
      raceDisqualified: false
    }))
  } as CommunityRound;
}

describe('UCI Sprint 200m official tie resolution', () => {
  it('does not invent decisions for unambiguous official timings', () => {
    expect(sprintQualificationTieGroups(qualification(24), 24)).toEqual([]);
    expect(sprintOfficialTieDecisions([], {})).toEqual([]);
  });

  it('includes BOTH competitors tied at Olympic qualification cutoff', () => {
    const race=qualification(25);
    race.entries[24].elapsedSeconds=race.entries[23].elapsedSeconds;
    const groups=sprintQualificationTieGroups(race,24);
    expect(groups.length).toBe(1);
    expect(groups[0].riders).toEqual(['r24','r25']);
    expect(groups[0].crossesCutoff).toBeTrue();
    expect(sprintOfficialTieDecisions(groups,{})).toBeNull();
  });

  it('only accepts measured last-100m splits matching the computed official order', () => {
    const race=qualification(24);
    race.entries[1].elapsedSeconds=race.entries[0].elapsedSeconds;
    const groups=sprintQualificationTieGroups(race,24);
    const d=emptySprintTieDraft(groups[0]);
    d.reference='Official commissaires sheet #41';
    d.last100Seconds={r1:'5.210',r2:'5.203'};
    const decisions=sprintOfficialTieDecisions(groups,{[groups[0].key]:d});
    expect(decisions?.[0].orderedUsernames).toEqual(['r2','r1']);
    expect(decisions?.[0].method).toBe('LAST_100');
    d.last100Seconds['r2']='5.210';
    expect(sprintOfficialTieDecisions(groups,{[groups[0].key]:d})).toBeNull();
    d.last100Seconds['r2']='abc';
    expect(sprintOfficialTieDecisions(groups,{[groups[0].key]:d})).toBeNull();
  });

  it('requires an explicitly selected lot order, reason and official reference', () => {
    const race=qualification(24);
    race.entries[1].elapsedSeconds=race.entries[0].elapsedSeconds;
    const groups=sprintQualificationTieGroups(race,24);
    const d=emptySprintTieDraft(groups[0]);
    d.method='DRAW_LOTS';
    d.reference='Witnessed drawing of lots 2026 #41';
    expect(sprintOfficialTieDecisions(groups,{[groups[0].key]:d})).toBeNull();
    d.order=['r2','r1'];
    const good=sprintOfficialTieDecisions(groups,{[groups[0].key]:d});
    expect(good?.[0].orderedUsernames).toEqual(['r2','r1']);
    expect(good?.[0].reason).toBe('LAST_100_UNAVAILABLE');
    d.order=['r2','r2'];
    expect(sprintOfficialTieDecisions(groups,{[groups[0].key]:d})).toBeNull();
  });

  it('accepts a witnessed draw only when supplied 100m timings remain tied', () => {
    const race=qualification(16);
    race.entries[1].elapsedSeconds=race.entries[0].elapsedSeconds;
    const groups=sprintQualificationTieGroups(race,16);
    const d=emptySprintTieDraft(groups[0]);
    d.method='DRAW_LOTS';d.reason='LAST_100_STILL_TIED';
    d.reference='Official commissaires minutes 41/26';
    d.order=['r2','r1'];
    d.last100Seconds={r1:'4.999',r2:'4.999'};
    expect(sprintOfficialTieDecisions(groups,{[groups[0].key]:d})?.length).toBe(1);
    d.last100Seconds['r2']='5.000';
    expect(sprintOfficialTieDecisions(groups,{[groups[0].key]:d})).toBeNull();
  });

  it('ignores ties beyond the cutoff and disqualified non-qualifiers', () => {
    const race=qualification(28);
    race.entries[27].elapsedSeconds=race.entries[26].elapsedSeconds;
    expect(sprintQualificationTieGroups(race,24)).toEqual([]);
    race.entries[27].raceDisqualified=true;
    expect(sprintQualificationTieGroups(race,28)).toEqual([]);
  });
});
