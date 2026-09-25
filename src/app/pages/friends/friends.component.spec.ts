import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FriendsComponent } from './friends.component';
import { CommunityService } from '../../services/community.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('FriendsComponent', () => {
  let component: FriendsComponent;
  let fixture: ComponentFixture<FriendsComponent>;
  let service: jasmine.SpyObj<CommunityService>;

  const friend = () => ({
    username: 'ana',
    fullName: 'Ana Silva',
    location: 'Lisboa',
    favoriteSports: 'Padel',
    profilePicUrl: null,
    chatBlocked: false,
    blockedByMe: false
  });

  beforeEach(async () => {
    service = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['friends', 'blockFriend', 'unblockFriend', 'removeFriend']
    );
    service.friends.and.returnValue(of([friend()]));
    service.blockFriend.and.returnValue(of({}));
    service.unblockFriend.and.returnValue(of({}));
    service.removeFriend.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      declarations: [FriendsComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: CommunityService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FriendsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load friends', () => {
    expect(component).toBeTruthy();
    expect(service.friends).toHaveBeenCalled();
    expect(component.friends.length).toBe(1);
  });

  it('should filter friends locally', () => {
    component.filter = 'lisboa';
    expect(component.filteredFriends.length).toBe(1);
  });

  it('should block a friend chat', () => {
    const target = component.friends[0];
    component.toggleBlock(target);

    expect(service.blockFriend).toHaveBeenCalledWith('ana');
    expect(target.chatBlocked).toBeTrue();
    expect(target.blockedByMe).toBeTrue();
  });

  it('should unblock a chat blocked by the current user', () => {
    const target = component.friends[0];
    target.chatBlocked = true;
    target.blockedByMe = true;

    component.toggleBlock(target);

    expect(service.unblockFriend).toHaveBeenCalledWith('ana');
    expect(target.chatBlocked).toBeFalse();
    expect(target.blockedByMe).toBeFalse();
  });

  it('should remove a friend after confirmation', () => {
    const target = component.friends[0];

    component.requestRemove(target);
    component.confirmRemove(target);

    expect(service.removeFriend).toHaveBeenCalledWith('ana');
    expect(component.friends.length).toBe(0);
  });
});
