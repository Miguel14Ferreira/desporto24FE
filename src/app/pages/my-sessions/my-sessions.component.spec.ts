import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MySessionsComponent } from './my-sessions.component';
import { SessionService } from '../../services/session.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('MySessionsComponent', () => {
  let component: MySessionsComponent;
  let fixture: ComponentFixture<MySessionsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;

  const createdSession = {
    id: 11,
    sport: 'Futebol',
    city: 'Lisboa',
    gameDate: '2026-10-10T18:00:00Z',
    distanceKm: null,
    participantCount: 3,
    maxParticipants: 10,
    priceAmount: 0,
    privateGame: false,
    status: 'OPEN'
  };

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['mine', 'cancel']);
    sessionService.mine.and.returnValue(of({
      created: [createdSession],
      joined: [],
      waitlisted: []
    }));
    sessionService.cancel.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      declarations: [MySessionsComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: SessionService, useValue: sessionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MySessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load the user sessions', () => {
    expect(component).toBeTruthy();
    expect(component.data.created.length).toBe(1);
    expect(sessionService.mine).toHaveBeenCalled();
  });

  it('should cancel a created session and refresh the list', () => {
    component.requestCancel(createdSession);
    component.confirmCancel();

    expect(sessionService.cancel).toHaveBeenCalledWith(11);
    expect(sessionService.mine).toHaveBeenCalledTimes(2);
    expect(component.actionMessage).toContain('cancelada');
  });

  it('should calculate remaining vacancies', () => {
    expect(component.vacancies(createdSession)).toBe(7);
  });
});
