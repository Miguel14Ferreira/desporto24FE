import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';

import { NavbarComponent } from './navbar.component';
import { AuthenticationService } from '../../services/authethication.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let authService: jasmine.SpyObj<AuthenticationService>;
  let realtimeService: jasmine.SpyObj<DirectChatRealtimeService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasSessionCandidate', 'hasAnyRole']
    );
    authService.hasSessionCandidate.and.returnValue(false);

    realtimeService = jasmine.createSpyObj<DirectChatRealtimeService>(
      'DirectChatRealtimeService',
      ['connect', 'disconnect'],
      { messages$: EMPTY }
    );

    await TestBed.configureTestingModule({
      declarations: [NavbarComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: authService },
        { provide: DirectChatRealtimeService, useValue: realtimeService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create without opening a chat connection when unauthenticated', () => {
    expect(component).toBeTruthy();
    expect(authService.hasSessionCandidate).toHaveBeenCalled();
    expect(component.authenticated).toBeFalse();
    expect(realtimeService.connect).not.toHaveBeenCalled();
    expect(realtimeService.disconnect).toHaveBeenCalled();
  });
});
