import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PerfisComponent } from './perfis.component';
import { CommunityService } from '../../services/community.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('PerfisComponent', () => {
  let component: PerfisComponent;
  let fixture: ComponentFixture<PerfisComponent>;
  let service: jasmine.SpyObj<CommunityService>;

  const profile = {
    username: 'ana',
    fullName: 'Ana Silva',
    country: 'Portugal',
    location: 'Lisboa',
    favoriteSports: 'Padel',
    profilePicUrl: null,
    joinDateDisplay: '2026-09-01'
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['searchProfiles', 'sendFriendRequest']
    );
    service.searchProfiles.and.returnValue(of([profile]));
    service.sendFriendRequest.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      declarations: [PerfisComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: CommunityService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PerfisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should search profiles through the community API', () => {
    component.searchTerm = 'ana';

    component.search();

    expect(service.searchProfiles).toHaveBeenCalledWith('ana');
    expect(component.profiles).toEqual([profile]);
  });

  it('should send a friend request for the selected profile', () => {
    component.sendFriendRequest(profile);

    expect(service.sendFriendRequest).toHaveBeenCalledWith('ana');
    expect(component.actionSuccess).toContain('ana');
    expect(component.friendRequestPending(profile)).toBeTrue();
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

  it('should reject an empty search', () => {
    component.searchTerm = '  ';

    component.search();

    expect(service.searchProfiles).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('nome de utilizador');
  });
});
