import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FriendsComponent } from './friends.component';
import { CommunityService } from '../../services/community.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('FriendsComponent', () => {
  let component: FriendsComponent;
  let fixture: ComponentFixture<FriendsComponent>;
  let service: jasmine.SpyObj<CommunityService>;

  const friend = {
    username: 'ana',
    fullName: 'Ana Silva',
    location: 'Lisboa',
    favoriteSports: 'Padel',
    profilePicUrl: null,
    chatBlocked: false,
    blockedByMe: false
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['friends']
    );
    service.friends.and.returnValue(of([friend]));

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
    expect(component.friends).toEqual([friend]);
  });

  it('should filter friends locally', () => {
    component.filter = 'lisboa';

    expect(component.filteredFriends).toEqual([friend]);
  });
});
