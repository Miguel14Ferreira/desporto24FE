import { groupSeasonTrophies, hasRecordedSeasonChampion } from './community-season-trophies.component';

describe('Closed season trophy visibility', () => {
  it('includes a recorded Karting champion even without an account', () => {
    expect(hasRecordedSeasonChampion({
      active:false, championUsername:null, championDisplayName:'Piloto convidado'
    })).toBeTrue();
  });
  it('excludes open seasons and closed seasons with no confirmed winner', () => {
    expect(hasRecordedSeasonChampion({
      active:true, championUsername:'driver', championDisplayName:'Piloto'
    })).toBeFalse();
    expect(hasRecordedSeasonChampion({
      active:false, championUsername:null, championDisplayName:null
    })).toBeFalse();
  });
});

describe('Historical champions grouped by sport', () => {
  const season = (id: number, sport: string | null, champion: string | null, active = false) => ({
    id, sport, name: '2025/26', startsAt: '2025-07-01',
    endedAt: active ? null : '2026-06-30', active,
    championUsername: null, championDisplayName: champion, championPoints: 25
  });

  it('keeps distinct sports separate and consolidates accent variants', () => {
    const groups = groupSeasonTrophies([
      season(1, 'Ténis', 'Jogador A'),
      season(2, 'Karting', 'Piloto B'),
      season(3, 'tenis', 'Jogador C'),
      season(4, null, 'Jogador D'),
      season(5, 'Ténis', null),
      season(6, 'Karting', 'Ainda não', true)
    ]);
    expect(groups.map(group => group.sport)).toEqual(['Ténis', 'Karting', null]);
    expect(groups.map(group => group.seasons.map(item => item.id)))
      .toEqual([[1, 3], [2], [4]]);
  });

  it('does not manufacture trophies for active or championless seasons', () => {
    expect(groupSeasonTrophies([
      season(1, 'Karting', null),
      season(2, 'Futebol', 'Por decidir', true)
    ])).toEqual([]);
  });
});
