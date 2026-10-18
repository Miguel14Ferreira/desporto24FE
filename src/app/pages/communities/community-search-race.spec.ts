import { of, Subject } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunitySearchResponse } from '../../services/community-groups.service';

describe('Community search responses out of order', () => {
  let component: CommunitiesComponent;
  let search: jasmine.Spy;

  const result = (name: string, page = 0, hasMore = false): CommunitySearchResponse => ({
    communities: [{ id: page + 40, name, visibility: 'PUBLIC', description: null, sport: null, photoUrl: null }],
    page, hasMore
  });

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.communitySearchName = '';
    component.communitySearchSport = '';
    component.communitySearchResults = [];
    component.communitySearchPage = 0;
    component.communitySearchHasMore = false;
    component.communitySearchLoading = false;
    component.communitySearchPerformed = false;
    component.communitySearchError = '';
    search = jasmine.createSpy('search');
    (component as any).communityService = { search };
    // Search updates the current URL; these prototype-only tests need a
    // router fixture even though they exercise search results, not routing.
    (component as any).route = {
      snapshot: {
        paramMap: { get: () => null },
        queryParamMap: { get: () => null }
      }
    };
    (component as any).router = {
      navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true))
    };
  });

  it('only shows the newest results when a previous search completes later', () => {
    const old = new Subject<CommunitySearchResponse>();
    const current = new Subject<CommunitySearchResponse>();
    search.and.returnValues(old.asObservable(), current.asObservable());

    component.communitySearchName = 'futsal';
    component.searchCommunities();
    component.communitySearchName = 'padel';
    component.searchCommunities();

    current.next(result('Padel Cascais', 0, true));
    current.complete();
    old.next(result('Futsal antigo'));
    old.complete();

    expect(search.calls.argsFor(0)).toEqual(['futsal', '', 0]);
    expect(search.calls.argsFor(1)).toEqual(['padel', '', 0]);
    expect(component.communitySearchResults.map(item => item.name)).toEqual(['Padel Cascais']);
    expect(component.communitySearchHasMore).toBeTrue();
    expect(component.communitySearchLoading).toBeFalse();
  });

  it('keeps the loading state while the newest request is still pending', () => {
    const old = new Subject<CommunitySearchResponse>();
    const current = new Subject<CommunitySearchResponse>();
    search.and.returnValues(old.asObservable(), current.asObservable());
    component.searchCommunities(0);
    component.communitySearchName = 'tenis';
    component.searchCommunities(0);

    old.next(result('Antigo'));
    old.complete();
    expect(component.communitySearchLoading).toBeTrue();
    expect(component.communitySearchResults).toEqual([]);

    current.next(result('Tenis'));
    current.complete();
    expect(component.communitySearchLoading).toBeFalse();
    expect(component.communitySearchResults.map(item => item.name)).toEqual(['Tenis']);
  });

  it('ignores an older request error after a newer search succeeds', () => {
    const old = new Subject<CommunitySearchResponse>();
    search.and.returnValues(old.asObservable(), of(result('Final')));
    component.communitySearchName = 'primeira';
    component.searchCommunities();
    component.communitySearchName = 'segunda';
    component.searchCommunities();
    old.error(new Error('old network failure'));

    expect(component.communitySearchError).toBe('');
    expect(component.communitySearchResults.map(x => x.name)).toEqual(['Final']);
  });

  it('clearing filters supersedes an in-flight filtered request', () => {
    const old = new Subject<CommunitySearchResponse>();
    search.and.returnValues(old.asObservable(), of(result('Comunidade pública')));
    component.communitySearchName = 'futebol';
    component.searchCommunities();
    component.clearCommunitySearch();
    old.next(result('Resultado antigo'));
    old.complete();

    expect(component.communitySearchName).toBe('');
    expect(component.communitySearchResults.map(x => x.name)).toEqual(['Comunidade pública']);
    expect(search.calls.mostRecent().args).toEqual(['', '', 0]);
  });

  it('does not reset pagination with a stale first-page response', () => {
    const old = new Subject<CommunitySearchResponse>();
    search.and.returnValues(old.asObservable(), of(result('Página seguinte', 1)));
    component.searchCommunities(0);
    component.searchCommunities(1);
    old.next(result('Página antiga', 0, true));
    old.complete();

    expect(component.communitySearchPage).toBe(1);
    expect(component.communitySearchHasMore).toBeFalse();
    expect(component.communitySearchResults.map(x => x.name)).toEqual(['Página seguinte']);
  });
});
