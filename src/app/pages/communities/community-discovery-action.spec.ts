import { of } from 'rxjs';
import { CommunitiesComponent } from './communities.component';

describe('Community discovery entry point', () => {
  let component: CommunitiesComponent;
  let search: jasmine.Spy;
  let scrollIntoView: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.communitySearchName = 'antigo filtro';
    component.communitySearchSport = 'Futebol';
    component.communitySearchLoading = false;
    component.communitySearchPerformed = false;
    component.communitySearchResults = [];
    component.communitySearchPage = 0;
    component.communitySearchHasMore = false;
    component.communitySearchError = '';
    search = jasmine.createSpy('search').and.returnValue(of({
      communities: [{ id: 42, name: 'Futebol dos Amigos', visibility: 'PUBLIC' }],
      page: 0,
      hasMore: false
    }));
    scrollIntoView = jasmine.createSpy('scrollIntoView');
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
    component.communitySearchSection = {
      nativeElement: { scrollIntoView }
    } as any;
  });

  it('loads public communities immediately when exploring, without filters', () => {
    component.exploreCommunities();
    expect(search).toHaveBeenCalledWith('', '', 0);
    expect(component.communitySearchPerformed).toBeTrue();
    expect(component.communitySearchResults.length).toBe(1);
    expect(component.communitySearchResults[0].name).toBe('Futebol dos Amigos');
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('clearing filters restores discovery without filters', () => {
    component.clearCommunitySearch();
    expect(search).toHaveBeenCalledWith('', '', 0);
    expect(component.communitySearchName).toBe('');
    expect(component.communitySearchSport).toBe('');
  });

  it('keeps an explicit name search working', () => {
    component.communitySearchName = 'liga';
    component.communitySearchSport = '';
    component.searchCommunities(0);
    expect(search).toHaveBeenCalledWith('liga', '', 0);
  });
});
