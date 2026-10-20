import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { environment } from 'src/environment/environment';
import { AdminAuditComponent, AdminPlatformOverview, AdminGrowthTrends } from './admin-audit.component';

describe('AdminAuditComponent — platform overview in audit page', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;
  let component: AdminAuditComponent;
  const summary: AdminPlatformOverview = {
    registeredUsers: 125, enabledUsers: 120, registrationsLast7Days: 8,
    loginsLast15Minutes: 14, onlineUsers: 6,
    totalSessions: 90, upcomingSessions: 16, sessionsNext7Days: 5,
    completedSessions: 50, cancelledSessions: 7,
    communities: 12, tournaments: 4, activeTournaments: 2,
    venues: 350, openUserReports: 3,
    generatedAt: '2026-10-17T15:00:00Z'
  };

  const trends: AdminGrowthTrends = {
    generatedAt: '2026-10-17T15:00:00Z', timezone: 'UTC', metric: 'CREATED_PER_WEEK',
    weeks: [
      { weekStart: '2026-08-24', users: 0, sessions: 0, communities: 0 },
      { weekStart: '2026-08-31', users: 1, sessions: 2, communities: 0 },
      { weekStart: '2026-09-07', users: 1, sessions: 0, communities: 1 },
      { weekStart: '2026-09-14', users: 0, sessions: 3, communities: 0 },
      { weekStart: '2026-09-21', users: 2, sessions: 1, communities: 0 },
      { weekStart: '2026-09-28', users: 3, sessions: 1, communities: 1 },
      { weekStart: '2026-10-05', users: 0, sessions: 2, communities: 0 },
      { weekStart: '2026-10-12', users: 5, sessions: 4, communities: 1 }
    ]
  };

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post']);
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);
    component = new AdminAuditComponent(http, changeDetector);
  });

  afterEach(() => component.ngOnDestroy());

  it('loads admin counters and eight-week trends on entering the dashboard', () => {
    http.get.and.returnValues(of(summary), of(trends));
    component.ngOnInit();
    expect(http.get).toHaveBeenCalledWith(
      environment.apiUrl + '/api/admin/overview');
    expect(http.get).toHaveBeenCalledWith(
      environment.apiUrl + '/api/admin/overview/trends');
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.overview?.upcomingSessions).toBe(16);
    expect(component.overview?.communities).toBe(12);
    expect(component.overview?.onlineUsers).toBe(6);
    expect(component.overviewLoading).toBeFalse();
    expect(component.growth?.weeks.length).toBe(8);
    expect(component.growthCharts).toHaveSize(3);
    expect(component.growthCharts[0].total).toBe(12);
    expect(component.growthCharts[1].total).toBe(13);
    expect(component.growthCharts[2].total).toBe(3);
    expect(component.growthCharts[0].bars[0].height).toBe(0);
    expect(component.growthCharts[0].bars[7].height).toBe(100);
  });

  it('keeps stale figures marked by timestamp and displays failure on manual refresh', () => {
    http.get.and.returnValue(of(summary));
    component.loadOverview();
    http.get.and.returnValue(throwError(() => new Error('offline')));
    component.loadOverview();
    expect(component.overview?.generatedAt).toBe(summary.generatedAt);
    expect(component.overviewError).toContain('Não foi possível');
    expect(component.overviewLoading).toBeFalse();
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('refreshes the counters and charts together using separate protected endpoints', () => {
    http.get.and.returnValues(of(summary), of(trends), of(summary), of(trends));
    component.ngOnInit();
    component.refreshIndicators();
    expect(http.get).toHaveBeenCalledTimes(4);
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.growthCharts[2].bars[7].value).toBe(1);
    expect(component.growthError).toBe('');
  });

  it('shows a graph error independently from the existing counters', () => {
    http.get.and.returnValues(of(summary), throwError(() => new Error('offline')));
    component.ngOnInit();
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.growth).toBeNull();
    expect(component.growthError).toContain('Não foi possível');
  });

  it('can refresh successfully after a transient API error', () => {
    http.get.and.returnValue(throwError(() => new Error('unavailable')));
    component.ngOnInit();
    expect(component.overview).toBeNull();
    expect(component.overviewError).toBeTruthy();
    http.get.and.returnValue(of(summary));
    component.loadOverview();
    expect(component.overview?.openUserReports).toBe(3);
    expect(component.overviewError).toBe('');
  });

  it('ends permanently pending overview and trend requests after twelve seconds', fakeAsync(() => {
    http.get.and.returnValue(NEVER);
    component.ngOnInit();
    expect(component.overviewLoading).toBeTrue();
    expect(component.growthLoading).toBeTrue();
    tick(12_001);
    expect(component.overviewLoading).toBeFalse();
    expect(component.growthLoading).toBeFalse();
    expect(component.overviewError).toContain('demorou demasiado tempo');
    expect(component.growthError).toContain('demorou demasiado tempo');
    expect(http.get).toHaveBeenCalledTimes(2);
  }));

  it('keeps successful counters visible when only trend request times out', fakeAsync(() => {
    http.get.and.returnValues(of(summary), NEVER);
    component.ngOnInit();
    tick(12_001);
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.overviewError).toBe('');
    expect(component.growthLoading).toBeFalse();
    expect(component.growthError).toContain('demorou demasiado tempo');
  }));

  it('clears the timeout error and loads data on manual retry', fakeAsync(() => {
    http.get.and.returnValue(NEVER);
    component.loadOverview();
    tick(12_001);
    expect(component.overviewError).toBeTruthy();
    http.get.and.returnValue(of(summary));
    component.loadOverview();
    expect(component.overviewError).toBe('');
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.overviewLoading).toBeFalse();
  }));

  it('explains when the backend denies access to administration statistics', () => {
    http.get.and.returnValue(throwError(() =>
      new HttpErrorResponse({status: 403, statusText: 'Forbidden'})));
    component.loadOverview();
    expect(component.overviewLoading).toBeFalse();
    expect(component.overviewError).toContain('permissões de administrador');
  });

  it('does not overwrite a newer response with an obsolete pending request', () => {
    const stale = new Subject<AdminPlatformOverview>();
    http.get.and.returnValues(stale.asObservable(), of(summary));
    component.loadOverview();
    component.loadOverview();
    stale.next({...summary, registeredUsers: 999});
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.overviewLoading).toBeFalse();
    expect(component.overviewError).toBe('');
  });

  it('cancels pending network requests when leaving the statistics page', fakeAsync(() => {
    http.get.and.returnValue(NEVER);
    component.ngOnInit();
    component.ngOnDestroy();
    tick(12_001);
    expect(component.overviewError).toBe('');
    expect(component.growthError).toBe('');
  }));

  it('rerenders the actual template when overview and trends return 200 without any user click', fakeAsync(() => {
    const overviewResponse = new Subject<AdminPlatformOverview>();
    const growthResponse = new Subject<AdminGrowthTrends>();
    http.get.and.returnValues(overviewResponse.asObservable(), growthResponse.asObservable());

    TestBed.configureTestingModule({
      declarations: [AdminAuditComponent],
      providers: [{ provide: HttpClient, useValue: http }]
    });
    TestBed.overrideComponent(AdminAuditComponent, {
      set: {
        template: `
          <div id="overview">{{ overviewLoading ? 'A carregar' : (overview?.registeredUsers ?? 'Sem dados') }}</div>
          <div id="growth">{{ growthLoading ? 'A carregar' : (growth?.weeks?.length ?? 'Sem dados') }}</div>
        `
      }
    });
    const fixture = TestBed.createComponent(AdminAuditComponent);
    fixture.detectChanges();
    const overviewElement: HTMLElement = fixture.nativeElement.querySelector('#overview');
    const growthElement: HTMLElement = fixture.nativeElement.querySelector('#growth');
    expect(overviewElement.textContent).toContain('A carregar');
    expect(growthElement.textContent).toContain('A carregar');

    overviewResponse.next(summary);
    overviewResponse.complete();
    growthResponse.next(trends);
    growthResponse.complete();
    flushMicrotasks();

    // Deliberately no fixture.detectChanges(): the component must refresh itself.
    expect(overviewElement.textContent).toContain('125');
    expect(growthElement.textContent).toContain('8');
    fixture.destroy();
  }));

  it('coalesces both completed requests into a single view refresh', fakeAsync(() => {
    http.get.and.returnValues(of(summary), of(trends));
    component.ngOnInit();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    flushMicrotasks();
    expect(changeDetector.detectChanges).toHaveBeenCalledTimes(1);
  }));

  it('does not update a destroyed view when a notification is already scheduled', fakeAsync(() => {
    http.get.and.returnValues(of(summary), of(trends));
    component.ngOnInit();
    component.ngOnDestroy();
    flushMicrotasks();
    expect(changeDetector.detectChanges).not.toHaveBeenCalled();
  }));
});
