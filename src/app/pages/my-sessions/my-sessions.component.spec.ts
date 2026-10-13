import { ComponentFixture, TestBed } from '@angular/core/testing';
import { defer, of, throwError } from 'rxjs';

import { MySessionsComponent } from './my-sessions.component';
import { ReliabilityService } from '../../services/reliability.service';
import { SessionService } from '../../services/session.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('MySessionsComponent', () => {
  let component: MySessionsComponent;
  let fixture: ComponentFixture<MySessionsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let reliabilityService: jasmine.SpyObj<ReliabilityService>;

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

  const noShow = {
    participantId: 20,
    sessionId: 12,
    sport: 'Padel',
    city: 'Lisboa',
    gameDate: '2026-09-20T19:00:00Z',
    attendanceStatus: 'NO_SHOW' as const,
    attendanceRecordedAt: '2026-09-20T20:00:00Z',
    disputeStatus: null,
    canDispute: true
  };

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>(
      'SessionService',
      ['mine', 'cancel', 'leave']
    );
    reliabilityService = jasmine.createSpyObj<ReliabilityService>(
      'ReliabilityService',
      ['attendanceHistory', 'createDispute']
    );

    sessionService.mine.and.returnValue(of({
      created: [createdSession],
      joined: [],
      waitlisted: []
    }));
    sessionService.cancel.and.returnValue(of(void 0));
    sessionService.leave.and.returnValue(of(void 0));

    reliabilityService.attendanceHistory.and.returnValue(of([noShow]));
    reliabilityService.createDispute.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      declarations: [MySessionsComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: SessionService, useValue: sessionService },
        { provide: ReliabilityService, useValue: reliabilityService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MySessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses consistent pills for empty creation and discovery states', () => {
    const find = fixture.nativeElement.querySelector('.empty-card a[href="/menu/events"]') as HTMLAnchorElement;
    expect(find).toBeTruthy();
    expect(find.classList.contains('jynlo-action')).toBeTrue();
    expect(find.classList.contains('jynlo-action--neutral')).toBeTrue();

    component.data = { ...component.data, created: [] };
    fixture.detectChanges();

    const create = fixture.nativeElement.querySelector('.empty-card a[href="/menu/createEvent"]') as HTMLAnchorElement;
    expect(create).toBeTruthy();
    expect(create.classList.contains('jynlo-action')).toBeTrue();
    expect(create.classList.contains('jynlo-action--primary')).toBeTrue();
  });

  it('aligns created session details with the destructive cancellation action', () => {
    const actions: HTMLElement = fixture.nativeElement.querySelector('.session-card .card-actions');
    const details = actions.querySelector('a[href="/menu/events/11"]') as HTMLAnchorElement;
    const cancel = actions.querySelector('button.danger-action') as HTMLButtonElement;

    expect(details).toBeTruthy();
    expect(cancel).toBeTruthy();
    expect(details.classList.contains('jynlo-action')).toBeTrue();
    expect(details.classList.contains('jynlo-action--neutral')).toBeTrue();
    expect(cancel.classList.contains('jynlo-action--danger')).toBeTrue();
  });

  it('should create and load sessions and attendance history', () => {
    expect(component).toBeTruthy();
    expect(component.data.created.length).toBe(1);
    expect(component.attendanceHistory.length).toBe(1);
    expect(sessionService.mine).toHaveBeenCalled();
    expect(reliabilityService.attendanceHistory).toHaveBeenCalled();
  });

  it('should cancel a created session and refresh the list', () => {
    component.requestCancel(createdSession);
    component.confirmCancel();

    expect(sessionService.cancel).toHaveBeenCalledWith(11);
    expect(sessionService.mine).toHaveBeenCalledTimes(1);
    expect(component.data.created[0].status).toBe('CANCELLED');
    expect(component.pendingCancelId).toBeNull();
    expect(component.actionMessage).toContain('cancelada');
  });

  it('should leave a waitlisted session without a page reload', () => {
    const waitlisted = {
      ...createdSession,
      id: 22,
      status: 'FULL'
    };
    component.data = {
      ...component.data,
      waitlisted: [waitlisted]
    };

    component.leaveWaitlist(waitlisted);

    expect(sessionService.leave).toHaveBeenCalledWith(22);
    expect(component.data.waitlisted.length).toBe(0);
    expect(component.actionMessage).toContain('lista de espera');
  });

  it('should calculate remaining vacancies', () => {
    expect(component.vacancies(createdSession)).toBe(7);
  });

  it('aligns attendance history session links with dispute actions', () => {
    const actions: HTMLElement = fixture.nativeElement.querySelector('.attendance-card .attendance-actions');
    const sessionLink = actions.querySelector('a[href="/menu/events/12"]') as HTMLAnchorElement;
    const dispute = actions.querySelector('button.dispute-action') as HTMLButtonElement;

    expect(sessionLink).toBeTruthy();
    expect(sessionLink.classList.contains('jynlo-action')).toBeTrue();
    expect(sessionLink.classList.contains('jynlo-action--neutral')).toBeTrue();
    expect(dispute).toBeTruthy();
    expect(dispute.classList.contains('jynlo-action')).toBeTrue();
  });

  it('should dispute a no-show and update its local state', () => {
    component.requestDispute(component.attendanceHistory[0]);
    component.disputeReason = 'Estive presente nesta sessão.';

    component.confirmDispute();

    expect(reliabilityService.createDispute).toHaveBeenCalledWith(
      20,
      'Estive presente nesta sessão.'
    );
    expect(component.attendanceHistory[0].disputeStatus).toBe('OPEN');
    expect(component.attendanceHistory[0].canDispute).toBeFalse();
    expect(component.actionMessage).toContain('Contestação enviada');
  });

  it('should require a reason before sending a dispute', () => {
    component.requestDispute(component.attendanceHistory[0]);
    component.disputeReason = '   ';

    component.confirmDispute();

    expect(reliabilityService.createDispute).not.toHaveBeenCalled();
    expect(component.actionError).toContain('Explica');
  });

  it('should expose a recoverable error when my sessions keep failing', () => {
    sessionService.mine.calls.reset();
    let subscriptions = 0;
    sessionService.mine.and.returnValue(defer(() => {
      subscriptions++;
      return throwError(() => new Error('service unavailable'));
    }));

    component.load();

    expect(sessionService.mine).toHaveBeenCalledTimes(1);
    expect(subscriptions).toBe(2);
    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
  });

  it('should recover my sessions after one automatic retry', () => {
    sessionService.mine.calls.reset();
    let subscriptions = 0;
    sessionService.mine.and.returnValue(defer(() => {
      subscriptions++;
      return subscriptions === 1
        ? throwError(() => new Error('temporary failure'))
        : of({
            created: [createdSession],
            joined: [],
            waitlisted: []
          });
    }));

    component.load();

    expect(sessionService.mine).toHaveBeenCalledTimes(1);
    expect(subscriptions).toBe(2);
    expect(component.errorMessage).toBe('');
    expect(component.data.created.length).toBe(1);
  });

  it('should expose a recoverable error when attendance history keeps failing', () => {
    reliabilityService.attendanceHistory.calls.reset();
    let subscriptions = 0;
    reliabilityService.attendanceHistory.and.returnValue(defer(() => {
      subscriptions++;
      return throwError(() => new Error('service unavailable'));
    }));

    component.loadAttendanceHistory();

    expect(reliabilityService.attendanceHistory).toHaveBeenCalledTimes(1);
    expect(subscriptions).toBe(2);
    expect(component.attendanceLoading).toBeFalse();
    expect(component.attendanceHistory).toEqual([]);
    expect(component.attendanceError).toBeTruthy();
  });

});
