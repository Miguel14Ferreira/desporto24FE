import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { environment } from 'src/environment/environment';
import { AdminAuditComponent, AdminPlatformOverview, AdminGrowthTrends } from './admin-audit.component';

describe('AdminAuditComponent — platform overview in audit page', () => {
  let http: jasmine.SpyObj<HttpClient>;
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
    component = new AdminAuditComponent(http);
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
});
