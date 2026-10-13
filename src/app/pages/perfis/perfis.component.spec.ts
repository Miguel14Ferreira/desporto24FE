import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, BehaviorSubject } from 'rxjs';

import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { PerfisComponent } from './perfis.component';
import { appTranslate as t } from '../../i18n/i18n.service';
import { CommunityService } from '../../services/community.service';
import { SocialGraphService } from '../../services/social-graph.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('PerfisComponent', () => {
  let component: PerfisComponent;
  let fixture: ComponentFixture<PerfisComponent>;
  let service: jasmine.SpyObj<CommunityService>;
  let socialGraphService: jasmine.SpyObj<SocialGraphService>;

  const profile = {
    username: 'ana',
    fullName: 'Ana Silva',
    nickname: null,
    country: 'Portugal',
    location: 'Lisboa',
    favoriteSports: 'Padel',
    bio: null,
    skillLevel: 'INTERMEDIATE',
    availability: null,
    age: 37,
    profilePicUrl: null,
    joinDateDisplay: '2026-09-01'
  };

  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({}));
    service = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['searchProfiles', 'findProfiles', 'sendFriendRequest', 'reportUser', 'userBlockStatus', 'blockUser', 'unblockUser', 'discoverProfiles', 'friends', 'publicProfile']
    );
    service.searchProfiles.and.returnValue(of([profile]));
    service.findProfiles.and.returnValue(of([profile]));
    service.discoverProfiles.and.returnValue(of([profile]));
    service.friends.and.returnValue(of([]));
    service.publicProfile.and.returnValue(of(profile));
    service.sendFriendRequest.and.returnValue(of({}));
    service.reportUser.and.returnValue(of(void 0));
    service.userBlockStatus.and.returnValue(of({ blocked: false }));
    service.blockUser.and.returnValue(of({ blocked: true }));
    service.unblockUser.and.returnValue(of({ blocked: false }));

    socialGraphService = jasmine.createSpyObj<SocialGraphService>(
      'SocialGraphService',
      ['status', 'follow', 'unfollow']
    );
    socialGraphService.status.and.returnValue(of({
      followedByMe: false,
      followsMe: false,
      followers: 3,
      following: 5
    }));
    socialGraphService.follow.and.returnValue(of({
      followedByMe: true,
      followsMe: false,
      followers: 4,
      following: 5
    }));
    socialGraphService.unfollow.and.returnValue(of({
      followedByMe: false,
      followsMe: false,
      followers: 3,
      following: 5
    }));

    await TestBed.configureTestingModule({
      declarations: [PerfisComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: CommunityService, useValue: service },
        { provide: SocialGraphService, useValue: socialGraphService },
        { provide: ActivatedRoute, useValue: { paramMap: routeParams, snapshot: { params: {}, queryParams: {}, paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PerfisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should start without requesting or showing discoverable profiles', () => {
    expect(service.discoverProfiles).not.toHaveBeenCalled();
    expect(service.findProfiles).not.toHaveBeenCalled();
    expect(service.publicProfile).not.toHaveBeenCalled();
    expect(component.profiles).toEqual([]);
    expect(component.searched).toBeFalse();
  });

  it('should clear results without loading discovery again', () => {
    component.profiles = [profile];
    component.searched = true;
    component.searchTerm = 'ana';
    component.clearSearch();
    expect(component.profiles).toEqual([]);
    expect(component.searched).toBeFalse();
    expect(service.discoverProfiles).not.toHaveBeenCalled();
  });

  it('should cancel a pending search when results are cleared', () => {
    const pending = new Subject<typeof profile[]>();
    service.findProfiles.and.returnValue(pending);
    component.searchTerm = 'ana';
    component.search();
    component.clearSearch();
    pending.next([profile]);
    pending.complete();
    expect(component.profiles).toEqual([]);
    expect(component.loading).toBeFalse();
    expect(component.searched).toBeFalse();
  });

  it('returns to the feed when a profile was opened from a feed link', () => {
    const activatedRoute = TestBed.inject(ActivatedRoute);
    Object.defineProperty(activatedRoute.snapshot, 'queryParamMap', {
      value: convertToParamMap({ from: 'feed' }),
      configurable: true
    });
    routeParams.next(convertToParamMap({ username: 'ana' }));
    fixture.detectChanges();

    expect(component.backToFeed).toBeTrue();
    const back = fixture.nativeElement.querySelector('a.back-to-search') as HTMLAnchorElement;
    expect(back).toBeTruthy();
    expect(back.getAttribute('href')).toBe('/menu/feed');
    expect(back.textContent).toContain(t('feed.backToFeed'));
  });

  it('should load a profile from its dedicated URL without searching', () => {
    routeParams.next(convertToParamMap({ username: 'ana' }));
    expect(service.publicProfile).toHaveBeenCalledWith('ana');
    expect(component.profilePage).toBeTrue();
    expect(component.selectedProfile?.username).toBe('ana');
    expect(service.findProfiles).not.toHaveBeenCalled();
    expect(service.discoverProfiles).not.toHaveBeenCalled();
  });

  it('should cancel an old profile request when the URL changes', () => {
    const pending = new Subject<typeof profile>();
    service.publicProfile.and.returnValue(pending);
    routeParams.next(convertToParamMap({ username: 'ana' }));
    service.publicProfile.and.returnValue(of({ ...profile, username: 'rui' }));
    routeParams.next(convertToParamMap({ username: 'rui' }));
    pending.next(profile);
    expect(component.selectedProfile?.username).toBe('rui');
  });

  it('should show an error if a profile URL cannot be loaded', () => {
    const pending = new Subject<typeof profile>();
    service.publicProfile.and.returnValue(pending);
    routeParams.next(convertToParamMap({ username: 'missing' }));
    pending.error({ error: {} });
    expect(component.selectedProfile).toBeUndefined();
    expect(component.errorMessage).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should search profiles using sports matching filters', () => {
    component.searchTerm = 'ana';
    component.sportFilter = 'Padel';
    component.locationFilter = 'Lisboa';
    component.minAge = 30;
    component.maxAge = 45;
    component.levelFilter = 'INTERMEDIATE';

    component.search();

    expect(service.findProfiles).toHaveBeenCalledWith({
      name: 'ana',
      sport: 'Padel',
      location: 'Lisboa',
      minAge: 30,
      maxAge: 45,
      skillLevel: 'INTERMEDIATE'
    });
    expect(component.profiles).toEqual([profile]);
  });

  it('should send a friend request for the selected profile', () => {
    component.sendFriendRequest(profile);

    expect(service.sendFriendRequest).toHaveBeenCalledWith('ana');
    expect(component.actionSuccess).toContain('ana');
    expect(component.friendRequestPending(profile)).toBeTrue();
  });

  it('should follow a selected profile', () => {
    component.selectedProfile = profile;
    component.selectedFollowStatus = {
      followedByMe: false,
      followsMe: false,
      followers: 3,
      following: 5
    };

    component.toggleFollow(profile);

    expect(socialGraphService.follow).toHaveBeenCalledWith('ana');
    expect(component.selectedFollowStatus?.followedByMe).toBeTrue();
  });

  it('should block a selected user and remove local social actions', () => {
    component.selectedProfile = profile;
    component.selectedFollowStatus = {
      followedByMe: true,
      followsMe: true,
      followers: 4,
      following: 5
    };
    component.friendUsernames.add('ana');

    component.toggleBlock(profile);

    expect(service.blockUser).toHaveBeenCalledWith('ana');
    expect(component.selectedBlocked).toBeTrue();
    expect(component.selectedFollowStatus).toBeUndefined();
    expect(component.friendUsernames.has('ana')).toBeFalse();
    expect(component.actionSuccess).toContain('ana');
  });

  it('should unblock a selected user', () => {
    component.selectedProfile = profile;
    component.selectedBlocked = true;

    component.toggleBlock(profile);

    expect(service.unblockUser).toHaveBeenCalledWith('ana');
    expect(component.selectedBlocked).toBeFalse();
    expect(component.actionSuccess).toContain('ana');
  });

  it('should not send social actions while the selected user is blocked', () => {
    component.selectedBlocked = true;

    component.toggleFollow(profile);
    component.sendFriendRequest(profile);
    component.reportReason = 'motivo';
    component.submitReport(profile);

    expect(socialGraphService.follow).not.toHaveBeenCalled();
    expect(service.sendFriendRequest).not.toHaveBeenCalled();
    expect(service.reportUser).not.toHaveBeenCalled();
  });

  it('should report a selected user with a trimmed reason', () => {
    component.selectedProfile = profile;
    component.reportOpen = true;
    component.reportReason = '  Comportamento abusivo  ';

    component.submitReport(profile);

    expect(service.reportUser).toHaveBeenCalledWith('ana', 'Comportamento abusivo');
    expect(component.reportOpen).toBeFalse();
    expect(component.reportReason).toBe('');
    expect(component.actionSuccess).toContain('ana');
  });

  it('should not report the logged-in profile', () => {
    const ownProfile = { ...profile, username: 'miguel' };
    component.reportReason = 'motivo';

    component.submitReport(ownProfile);

    expect(service.reportUser).not.toHaveBeenCalled();
  });

  it('should not allow a friend request to the logged-in profile', () => {
    const ownProfile = { ...profile, username: 'miguel' };

    component.sendFriendRequest(ownProfile);

    expect(component.isOwnProfile(ownProfile)).toBeTrue();
    expect(service.sendFriendRequest).not.toHaveBeenCalled();
  });

  it('should not resend a locally pending friend request', () => {
    component.pendingFriendRequests.add('ana');

    component.sendFriendRequest(profile);

    expect(service.sendFriendRequest).not.toHaveBeenCalled();
  });

  it('should keep results empty when all filters are empty', () => {
    component.searchTerm = '  ';
    component.sportFilter = '';
    component.locationFilter = '';
    component.minAge = null;
    component.maxAge = null;
    component.levelFilter = '';

    component.search();

    expect(service.findProfiles).not.toHaveBeenCalled();
    expect(service.discoverProfiles).not.toHaveBeenCalled();
    expect(component.profiles).toEqual([]);
    expect(component.searched).toBeFalse();
  });
});
