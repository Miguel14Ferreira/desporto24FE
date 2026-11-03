import { TestBed } from '@angular/core/testing';
import { CommunityRaceStandingGroup } from '../model/community-group';
import { CommunitySpecializedStatsComponent } from './community-specialized-stats.component';

describe('Sport-specific community statistics', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunitySpecializedStatsComponent]
    }).compileComponents();
  });

  const karting: CommunityRaceStandingGroup = {
    sport: 'Karting',
    rule: {sport:'Karting',pointsByPlace:[25,18,15]},
    standings: [{
      position:1,playerId:71,profileId:null,username:null,
      fullName:'Piloto Histórico',profilePicUrl:null,
      races:5,wins:3,podiums:4,bestFinish:1,championshipPoints:93,
      penaltyPoints:2
    }]
  };

  function render(groups: CommunityRaceStandingGroup[], unsupportedSports: string[] = []) {
    const fixture=TestBed.createComponent(CommunitySpecializedStatsComponent);
    fixture.componentRef.setInput('raceGroups', groups);
    fixture.componentRef.setInput('unsupportedSports', unsupportedSports);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows API-backed race statistics without football columns or invented identities', () => {
    const root=render([karting]);
    expect(root.textContent).toContain('Karting');
    expect(root.textContent).toContain('Piloto Histórico');
    expect(root.textContent).toContain('93');
    expect(root.querySelectorAll('.specialized-stats__driver')).toHaveSize(1);
    expect(root.querySelectorAll('.specialized-stats__metrics dd').length).toBe(6);
    expect(root.textContent).not.toContain('Golos');
    expect(root.textContent).not.toContain('Assistências');
    expect(root.querySelectorAll('.specialized-stats__metrics dd')[0].textContent?.trim()).toBe('5');
    expect(root.querySelectorAll('.specialized-stats__metrics dd')[4].textContent?.trim()).toBe('2');
  });

  it('does not invent championship points or penalties without a scoring rule', () => {
    const root=render([{...karting, rule:null}]);
    expect(root.querySelectorAll('.specialized-stats__metrics dd')).toHaveSize(4);
    expect(root.textContent).not.toContain('93');
    expect(root.textContent).toContain('Piloto Histórico');
  });

  it('shows an honest empty state before the first classified race', () => {
    const root=render([{...karting,standings:[]}]);
    expect(root.textContent).toContain('Karting');
    expect(root.querySelectorAll('.specialized-stats__driver')).toHaveSize(0);
    expect(root.querySelector('.specialized-stats__empty')).toBeTruthy();
  });

  it('shows sport-specific unavailable state without a football fallback', () => {
    const root=render([],['Natação','Golfe']);
    expect(root.textContent).toContain('Natação');
    expect(root.textContent).toContain('Golfe');
    expect(root.querySelectorAll('.specialized-stats__driver')).toHaveSize(0);
    expect(root.querySelector('.specialized-stats__unavailable')).toBeTruthy();
  });
});
