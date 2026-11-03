import { TournamentTeamMatch } from '../model/community-tournament';
import { summarizePublishedTeamJourney as journey } from './community-team-journey';

const fixture = (id:number,roundNumber:number,status:'SCHEDULED'|'COMPLETED',
  homeScore?:number|null,awayScore?:number|null,groupNumber?:number|null):TournamentTeamMatch=>({
    id,roundNumber,homeTeamId:10,homeTeamName:'Verdes',awayTeamId:20,
    awayTeamName:'Azuis',status,homeScore,awayScore,groupNumber
  });

describe('published team journey',()=>{
  it('shows own results, reverses away scores and ignores duplicates/unrelated matches',()=>{
    const away={...fixture(3,2,'COMPLETED',1,3),homeTeamId:20,awayTeamId:10,
      homeTeamName:'Azuis',awayTeamName:'Verdes'};
    const other={...fixture(99,1,'COMPLETED',5,0),homeTeamId:77,awayTeamId:78};
    const published=[fixture(1,1,'COMPLETED',2,1),away,other,
      fixture(4,3,'SCHEDULED'),fixture(4,3,'SCHEDULED')];
    const snapshot=JSON.stringify(published);
    const result=journey(published,10,'LEAGUE');
    expect(result.recent.map(x=>x.fixture.id)).toEqual([3,1]);
    expect(result.recent[0]).toEqual(jasmine.objectContaining({
      ownScore:3,opponentScore:1,opponentName:'Azuis',outcome:'WIN'
    }));
    expect(result.pending.map(x=>x.fixture.id)).toEqual([4]);
    expect(result.pending[0].outcome).toBeNull();
    expect(result.advancement).toBeNull();
    expect(JSON.stringify(published)).toBe(snapshot);
  });
  it('never invents completed scores or future results',()=>{
    const result=journey([
      fixture(1,1,'COMPLETED',null,2),fixture(2,2,'COMPLETED',-1,1),
      fixture(3,3,'COMPLETED',Number.NaN,1),
      fixture(4,4,'SCHEDULED',3,1),fixture(5,5,'COMPLETED',1,1)
    ],10,'KNOCKOUT');
    expect(result.recent.map(x=>x.fixture.id)).toEqual([5]);
    expect(result.recent[0].outcome).toBe('DRAW');
    expect(result.pending.map(x=>x.fixture.id)).toEqual([4]);
    expect(result.pending[0].ownScore).toBeNull();
    expect(result.advancement).toBeNull();
  });
  it('requires a unique real match in the immediately following round',()=>{
    const won=fixture(1,1,'COMPLETED',2,0);
    const next=fixture(2,2,'SCHEDULED');
    expect(journey([won],10,'KNOCKOUT').advancement).toBeNull();
    expect(journey([won,next],10,'KNOCKOUT').advancement)
      .toEqual({previousFixture:won,nextFixture:next,opponentName:'Azuis'});
    expect(journey([won,fixture(2,3,'SCHEDULED')],10,'KNOCKOUT').advancement).toBeNull();
    expect(journey([won,next,fixture(3,2,'SCHEDULED')],10,'KNOCKOUT').advancement).toBeNull();
    expect(journey([won,next,fixture(4,1,'COMPLETED',1,0)],10,'KNOCKOUT').advancement).toBeNull();
    expect(journey([fixture(6,1,'COMPLETED',1,2),next],10,'KNOCKOUT').advancement).toBeNull();
    expect(journey([fixture(7,1,'COMPLETED',1,1),next],10,'KNOCKOUT').advancement).toBeNull();
  });
  it('does not infer group qualification from group victories',()=>{
    const groupWin=fixture(1,1,'COMPLETED',3,1,1);
    const semifinal=fixture(2,1,'SCHEDULED',null,null,null);
    const final=fixture(3,2,'SCHEDULED',null,null,null);
    expect(journey([groupWin,semifinal,final],10,'GROUP_KNOCKOUT').advancement).toBeNull();
    const semifinalWin=fixture(4,1,'COMPLETED',2,0,null);
    const result=journey([groupWin,semifinalWin,final],10,'GROUP_KNOCKOUT');
    expect(result.advancement?.nextFixture.id).toBe(3);
    expect(result.recent.map(x=>x.fixture.id)).toEqual([4,1]);
  });
  it('draws a path only through real knockout fixtures in chronological rounds',()=>{
    const first=fixture(15,1,'COMPLETED',3,0);
    const semi={...fixture(16,2,'COMPLETED',1,0),homeTeamId:20,
      homeTeamName:'Azuis',awayTeamId:10,awayTeamName:'Verdes'};
    // Away side lost this semifinal, so it must not qualify for the final.
    const final=fixture(17,3,'SCHEDULED');
    const result=journey([final,semi,first],10,'KNOCKOUT');
    expect(result.knockoutPath.map(step=>step.fixture.id)).toEqual([15,16,17]);
    expect(result.knockoutPath.map(step=>step.confirmedNextFixture?.id??null))
      .toEqual([16,null,null]);
    expect(result.knockoutPath.map(step=>step.outcome)).toEqual(['WIN','LOSS',null]);
    expect(result.advancement?.nextFixture.id).toBe(16);
    expect(journey([first],10,'KNOCKOUT').knockoutPath).toHaveSize(1);
    expect(journey([first],10,'KNOCKOUT').knockoutPath[0].confirmedNextFixture).toBeNull();
    expect(journey([first,final],10,'KNOCKOUT').knockoutPath
      .map(step=>step.confirmedNextFixture)).toEqual([null,null]);
  });

  it('leaves an ambiguous round unconnected and never treats group games as knockout',()=>{
    const first=fixture(1,1,'COMPLETED',3,1,null);
    const duplicate={...fixture(2,1,'COMPLETED',2,0),homeTeamId:20,awayTeamId:10};
    const next=fixture(3,2,'SCHEDULED',null,null,null);
    const result=journey([first,duplicate,next],10,'GROUP_KNOCKOUT');
    expect(result.knockoutPath).toHaveSize(3);
    expect(result.knockoutPath.every(step=>!step.confirmedNextFixture)).toBeTrue();
    const group=fixture(6,1,'COMPLETED',4,0,1);
    const resultWithGroup=journey([group,first,next],10,'GROUP_KNOCKOUT');
    expect(resultWithGroup.knockoutPath.map(step=>step.fixture.id)).toEqual([1,3]);
    expect(resultWithGroup.knockoutPath[0].confirmedNextFixture?.id).toBe(3);
    expect(journey([group],10,'GROUP_KNOCKOUT').knockoutPath).toEqual([]);
    expect(journey([first,next],10,'LEAGUE').knockoutPath).toEqual([]);
  });

  it('summarizes recent form and each published stage without duplicate or invalid scores',()=>{
    const awayLoss={...fixture(4,2,'COMPLETED',2,0),homeTeamId:20,
      awayTeamId:10,homeTeamName:'Azuis',awayTeamName:'Verdes'};
    const input=[fixture(1,1,'COMPLETED',2,1,1),fixture(2,2,'COMPLETED',1,1,1),
      fixture(3,1,'SCHEDULED',9,0,null),awayLoss,
      fixture(5,3,'COMPLETED',null,2,null),awayLoss,
      {...fixture(99,1,'COMPLETED',7,0),homeTeamId:90,awayTeamId:91}];
    const original=JSON.stringify(input);
    const result=journey(input,10,'GROUP_KNOCKOUT');
    expect(result.form.map(row=>row.fixture.id)).toEqual([4,2,1]);
    expect(result.form.map(row=>row.outcome)).toEqual(['LOSS','DRAW','WIN']);
    expect(result.recent.map(row=>row.fixture.id)).toEqual([4,2,1]);
    expect(result.phases.map(p=>p.key)).toEqual(['group-1','round-1','round-2','round-3']);
    expect(result.phases[0]).toEqual(jasmine.objectContaining({
      published:2,recorded:2,wins:1,draws:1,losses:0
    }));
    expect(result.phases[1]).toEqual(jasmine.objectContaining({
      published:1,recorded:0,wins:0,draws:0,losses:0
    }));
    expect(result.phases[2]).toEqual(jasmine.objectContaining({
      published:1,recorded:1,wins:0,draws:0,losses:1
    }));
    expect(result.phases[3].recorded).toBe(0);
    expect(JSON.stringify(input)).toEqual(original);
  });
  it('caps form at five results but keeps every loaded league round in phase summaries',()=>{
    const fixtures=Array.from({length:8},(_,index)=>fixture(index+1,index+1,'COMPLETED',2,1));
    const result=journey(fixtures,10,'LEAGUE');
    expect(result.form.map(row=>row.fixture.id)).toEqual([8,7,6,5,4]);
    expect(result.recent.map(row=>row.fixture.id)).toEqual([8,7,6]);
    expect(result.phases).toHaveSize(8);
    expect(result.phases.every(p=>p.wins===1 && p.recorded===1)).toBeTrue();
  });
  it('shows at most three published results or pending matches in round order',()=>{
    const list=[fixture(1,1,'COMPLETED',1,0),fixture(2,2,'COMPLETED',1,0),
      fixture(3,3,'COMPLETED',1,0),fixture(4,4,'COMPLETED',1,0),
      fixture(5,5,'SCHEDULED'),fixture(6,6,'SCHEDULED'),
      fixture(7,7,'SCHEDULED'),fixture(8,8,'SCHEDULED')];
    const result=journey(list,10,'LEAGUE');
    expect(result.recent.map(x=>x.fixture.id)).toEqual([4,3,2]);
    expect(result.pending.map(x=>x.fixture.id)).toEqual([5,6,7]);
    expect(result.advancement).toBeNull();
  });
});
