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

  it('opens a discovery card in its community details without joining automatically', () => {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    (component as any).router = router;
    component.openCommunityPresentation({ id: 42, name: 'Futebol dos Amigos', visibility: 'PUBLIC' } as any);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/menu/communities', 42]);
  });

});
