import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PerfisComponent } from './perfis.component';
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

  beforeEach(async () => {
    service = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['searchProfiles', 'findProfiles', 'sendFriendRequest', 'discoverProfiles', 'friends', 'publicProfile']
    );
    service.searchProfiles.and.returnValue(of([profile]));
    service.findProfiles.and.returnValue(of([profile]));
    service.discoverProfiles.and.returnValue(of([profile]));
    service.friends.and.returnValue(of([]));
    service.publicProfile.and.returnValue(of(profile));
    service.sendFriendRequest.and.returnValue(of({}));

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
        { provide: SocialGraphService, useValue: socialGraphService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PerfisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

  it('should return to discovery when all filters are empty', () => {
    component.searchTerm = '  ';
    component.sportFilter = '';
    component.locationFilter = '';
    component.minAge = null;
    component.maxAge = null;
    component.levelFilter = '';

    const callsBefore = service.discoverProfiles.calls.count();
    component.search();

    expect(service.findProfiles).not.toHaveBeenCalled();
    expect(service.discoverProfiles.calls.count()).toBe(callsBefore + 1);
  });
});
