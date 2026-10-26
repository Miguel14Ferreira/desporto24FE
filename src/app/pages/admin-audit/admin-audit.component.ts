import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, TimeoutError, finalize, timeout } from 'rxjs';
import { environment } from 'src/environment/environment';

export interface AdminPlatformOverview {
  registeredUsers: number;
  enabledUsers: number;
  registrationsLast7Days: number;
  loginsLast15Minutes: number;
  onlineUsers: number | null;
  totalSessions: number;
  upcomingSessions: number;
  sessionsNext7Days: number;
  completedSessions: number;
  cancelledSessions: number;
  communities: number;
  tournaments: number;
  activeTournaments: number;
  venues: number;
  openUserReports: number;
  generatedAt: string;
}

export interface AdminGrowthWeek {
  weekStart: string;
  users: number;
  sessions: number;
  communities: number;
}

export interface AdminGrowthTrends {
  generatedAt: string;
  timezone: 'UTC';
  metric: 'CREATED_PER_WEEK';
  weeks: AdminGrowthWeek[];
}

export interface AdminVenueQualityDistrict {
  district: string;
  venues: number;
  withoutSport: number;
  withoutCoordinates: number;
  withoutAddress: number;
  withoutAddressAndCoordinates: number;
}

export interface AdminVenueQuality {
  venues: number;
  withoutSport: number;
  withoutCoordinates: number;
  withoutAddress: number;
  withoutAddressAndCoordinates: number;
  districts: AdminVenueQualityDistrict[];
  generatedAt: string;
}

interface GrowthChart {
  key: 'users' | 'sessions' | 'communities';
  title: string;
  total: number;
  max: number;
  bars: { weekStart: string; value: number; height: number }[];
}

@Component({
  selector: 'app-admin-audit',
  templateUrl: './admin-audit.component.html',
  styleUrls: ['./admin-audit.component.css'],
  standalone: false
})
export class AdminAuditComponent implements OnInit, OnDestroy {
  overview: AdminPlatformOverview | null = null;
  overviewLoading = false;
  overviewError = '';
  private overviewRequest?: Subscription;
  private growthRequest?: Subscription;
  private qualityRequest?: Subscription;
  private overviewRequestVersion = 0;
  private growthRequestVersion = 0;
  private qualityRequestVersion = 0;
  private readonly requestTimeoutMs = 12_000;
  private destroyed = false;
  private viewUpdateScheduled = false;
  growth: AdminGrowthTrends | null = null;
  growthLoading = false;
  growthError = '';
  qualityOpen = false;
  quality: AdminVenueQuality | null = null;
  qualityLoading = false;
  qualityError = '';

  ngOnInit(): void {
    this.refreshIndicators();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    ++this.overviewRequestVersion;
    ++this.growthRequestVersion;
    ++this.qualityRequestVersion;
    this.overviewRequest?.unsubscribe();
    this.growthRequest?.unsubscribe();
    this.qualityRequest?.unsubscribe();
  }

  refreshIndicators(): void {
    this.loadOverview();
    this.loadGrowth();
    if (this.qualityOpen) this.loadVenueQuality();
  }

  toggleVenueQuality(): void {
    this.qualityOpen = !this.qualityOpen;
    if (this.qualityOpen && !this.quality && !this.qualityLoading) {
      this.loadVenueQuality();
    }
  }

  /** Data-quality numbers are opt-in to avoid extra queries on every admin visit. */
  loadVenueQuality(): void {
    const version = ++this.qualityRequestVersion;
    this.qualityRequest?.unsubscribe();
    this.qualityLoading = true;
    this.qualityError = '';
    this.qualityRequest = this.http.get<AdminVenueQuality>(
      environment.apiUrl + '/api/admin/overview/venue-quality'
    ).pipe(
      timeout(this.requestTimeoutMs),
      finalize(() => {
        if (version !== this.qualityRequestVersion) return;
        this.qualityLoading = false;
        this.refreshView();
      })
    ).subscribe({
      next: report => {
        if (version !== this.qualityRequestVersion) return;
        this.quality = report;
        this.refreshView();
      },
      error: error => {
        if (version !== this.qualityRequestVersion) return;
        this.qualityError = this.requestError(error, 'dados de recintos');
        this.refreshView();
      }
    });
  }

  get growthCharts(): GrowthChart[] {
    if (!this.growth?.weeks?.length) return [];
    const series: { key: GrowthChart['key']; title: string }[] = [
      { key: 'users', title: 'Novos utilizadores' },
      { key: 'sessions', title: 'Sessões criadas' },
      { key: 'communities', title: 'Comunidades criadas' }
    ];
    return series.map(({ key, title }) => {
      const values = this.growth!.weeks.map(week => week[key]);
      const max = Math.max(1, ...values);
      return {
        key, title, max,
        total: values.reduce((sum, value) => sum + value, 0),
        bars: this.growth!.weeks.map(week => ({
          weekStart: week.weekStart, value: week[key],
          height: Math.round(100 * week[key] / max)
        }))
      };
    });
  }

  /** A stalled network request (including token refresh) must not freeze this screen. */
  loadGrowth(): void {
    const version = ++this.growthRequestVersion;
    this.growthRequest?.unsubscribe();
    this.growthLoading = true;
    this.growthError = '';
    this.growthRequest = this.http.get<AdminGrowthTrends>(
      environment.apiUrl + '/api/admin/overview/trends'
    ).pipe(
      timeout(this.requestTimeoutMs),
      finalize(() => {
        if (version !== this.growthRequestVersion) return;
        this.growthLoading = false;
        this.refreshView();
      })
    ).subscribe({
      next: history => {
        if (version !== this.growthRequestVersion) return;
        this.growth = history;
        this.refreshView();
      },
      error: error => {
        if (version !== this.growthRequestVersion) return;
        this.growthError = this.requestError(error, 'gráficos');
        this.refreshView();
      }
    });
  }

  loadOverview(): void {
    const version = ++this.overviewRequestVersion;
    this.overviewRequest?.unsubscribe();
    this.overviewLoading = true;
    this.overviewError = '';
    this.overviewRequest = this.http.get<AdminPlatformOverview>(
      environment.apiUrl + '/api/admin/overview'
    ).pipe(
      timeout(this.requestTimeoutMs),
      finalize(() => {
        if (version !== this.overviewRequestVersion) return;
        this.overviewLoading = false;
        this.refreshView();
      })
    ).subscribe({
      next: summary => {
        if (version !== this.overviewRequestVersion) return;
        this.overview = summary;
        this.refreshView();
      },
      error: error => {
        if (version !== this.overviewRequestVersion) return;
        this.overviewError = this.requestError(error, 'indicadores');
        this.refreshView();
      }
    });
  }

  /**
   * The admin page is also reached from code paths outside Angular's CD turn.
   * markForCheck alone can leave the DOM displaying its initial loading state.
   * Coalesce notifications and render after the current HTTP callback completes.
   */
  private refreshView(): void {
    if (this.destroyed) return;
    this.changeDetector.markForCheck();
    if (this.viewUpdateScheduled) return;
    this.viewUpdateScheduled = true;
    queueMicrotask(() => {
      this.viewUpdateScheduled = false;
      if (!this.destroyed) this.changeDetector.detectChanges();
    });
  }

  private requestError(error: unknown, subject: 'indicadores' | 'gráficos' | 'dados de recintos'): string {
    if (error instanceof TimeoutError) {
      return `O pedido de ${subject} demorou demasiado tempo (12 segundos). Tenta novamente.`;
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401 || error.status === 403) {
        return 'A sessão não tem acesso às estatísticas. Verifica a autenticação e as permissões de administrador.';
      }
      if (error.status === 0) {
        return 'Não foi possível estabelecer ligação à API. Verifica a ligação e tenta novamente.';
      }
      return `Não foi possível carregar os ${subject} (HTTP ${error.status}). Tenta novamente.`;
    }
    return `Não foi possível carregar os ${subject}. Tenta novamente.`;
  }

  constructor(
    private http: HttpClient,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

}
