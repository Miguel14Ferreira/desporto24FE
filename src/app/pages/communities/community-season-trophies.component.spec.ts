import { hasRecordedSeasonChampion } from './community-season-trophies.component';

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
