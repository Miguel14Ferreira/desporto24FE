import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { environment } from 'src/environment/environment';
import { AdminDashboardComponent, AdminPlatformOverview } from './admin-dashboard.component';

describe('AdminDashboardComponent — platform overview', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let component: AdminDashboardComponent;
  const summary: AdminPlatformOverview = {
    registeredUsers: 125, enabledUsers: 120, registrationsLast7Days: 8,
    loginsLast15Minutes: 14, onlineUsers: 6,
    totalSessions: 90, upcomingSessions: 16, sessionsNext7Days: 5,
    completedSessions: 50, cancelledSessions: 7,
    communities: 12, tournaments: 4, activeTournaments: 2,
    venues: 350, openUserReports: 3,
    generatedAt: '2026-10-17T15:00:00Z'
  };

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post']);
    component = new AdminDashboardComponent(http);
  });

  afterEach(() => component.ngOnDestroy());

  it('loads admin-only database counters on entering the dashboard', () => {
    http.get.and.returnValue(of(summary));
    component.ngOnInit();
    expect(http.get).toHaveBeenCalledOnceWith(
      environment.apiUrl + '/api/admin/overview');
    expect(component.overview?.registeredUsers).toBe(125);
    expect(component.overview?.upcomingSessions).toBe(16);
    expect(component.overview?.communities).toBe(12);
    expect(component.overview?.onlineUsers).toBe(6);
    expect(component.overviewLoading).toBeFalse();
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
});
