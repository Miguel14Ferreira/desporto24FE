import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, Optional } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subscription, timeout } from 'rxjs';
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

interface GrowthChart {
  key: 'users' | 'sessions' | 'communities';
  title: string;
  total: number;
  max: number;
  bars: { weekStart: string; value: number; height: number }[];
}

interface VenuePreviewResult {
  sourceReference: string;
  name: string;
  status: string;
  candidates: { id: number; name: string; city: string }[];
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  standalone: false
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  overview: AdminPlatformOverview | null = null;
  overviewLoading = false;
  overviewError = '';
  private overviewRequest?: Subscription;
  private overviewRequestVersion = 0;
  private growthRequestVersion = 0;

  get isStatisticsPage(): boolean {
    return this.route?.snapshot?.data?.['statisticsPage'] === true;
  }
  private growthRequest?: Subscription;
  growth: AdminGrowthTrends | null = null;
  growthLoading = false;
  growthError = '';

  ngOnInit(): void {
    this.refreshIndicators();
  }

  ngOnDestroy(): void {
    ++this.overviewRequestVersion;
    ++this.growthRequestVersion;
    this.overviewRequest?.unsubscribe();
    this.growthRequest?.unsubscribe();
  }

  refreshIndicators(): void {
    this.loadOverview();
    // Avoid an unnecessary chart query on the administration home screen.
    if (this.isStatisticsPage) this.loadGrowth();
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

  loadGrowth(): void {
    this.growthRequest?.unsubscribe();
    const version = ++this.growthRequestVersion;
    this.growthLoading = true;
    this.growthError = '';
    this.growthRequest = this.http.get<AdminGrowthTrends>(
      environment.apiUrl + '/api/admin/overview/trends'
    ).pipe(
      timeout(12_000),
      finalize(() => {
        if (version === this.growthRequestVersion) this.growthLoading = false;
      })
    ).subscribe({
      next: history => {
        if (version === this.growthRequestVersion) this.growth = history;
      },
      error: () => {
        if (version === this.growthRequestVersion) {
          this.growthError = 'Não foi possível atualizar os gráficos. O servidor pode estar indisponível ou demorar demasiado tempo.';
        }
      }
    });
  }

  loadOverview(): void {
    this.overviewRequest?.unsubscribe();
    const version = ++this.overviewRequestVersion;
    this.overviewLoading = true;
    this.overviewError = '';
    this.overviewRequest = this.http.get<AdminPlatformOverview>(
      environment.apiUrl + '/api/admin/overview'
    ).pipe(
      timeout(12_000),
      finalize(() => {
        if (version === this.overviewRequestVersion) this.overviewLoading = false;
      })
    ).subscribe({
      next: summary => {
        if (version === this.overviewRequestVersion) this.overview = summary;
      },
      error: error => {
        if (version !== this.overviewRequestVersion) return;
        this.overviewError = error?.status === 401 || error?.status === 403
          ? 'A tua sessão não tem acesso aos indicadores. Confirma as permissões de administrador.'
          : 'Não foi possível obter os indicadores. O servidor pode estar indisponível ou demorar demasiado tempo.';
      }
    });
  }


  venuePayload = '[\n  {\n    "sourceReference": "OSM:WAY:305711614",\n    "name": "Piscina Municipal da Constituição",\n    "city": "Porto",\n    "address": "Rua do Almirante Leote do Rêgo, 4200-260 Porto",\n    "sports": "Natação",\n    "venueType": "Piscina",\n    "environmentType": "INDOOR",\n    "latitude": 41.16518,\n    "longitude": -8.61414\n  },\n  {\n    "sourceReference": "OSM:WAY:58257179",\n    "name": "Pavilhão Municipal Multidesportos Mário Mexia",\n    "city": "Coimbra",\n    "address": "Praça Heróis do Ultramar, 3030-327 Coimbra",\n    "sports": "Andebol;Basquetebol;Voleibol;Futsal;Patinagem;Ginástica",\n    "venueType": "Pavilhão Desportivo",\n    "environmentType": "INDOOR",\n    "latitude": 40.20540,\n    "longitude": -8.40816\n  }\n]';
  previewResults: VenuePreviewResult[] = [];
  previewError = '';
  previewLoading = false;

  constructor(private http: HttpClient, @Optional() private route?: ActivatedRoute) {}

  previewVenues(): void {
    let payload: unknown;
    try {
      payload = JSON.parse(this.venuePayload);
      if (!Array.isArray(payload) || payload.length < 1 || payload.length > 25) {
        throw new Error('Fornece entre 1 e 25 recintos.');
      }
    } catch {
      this.previewError = 'JSON inválido ou lista fora do limite de 1 a 25 recintos.';
      this.previewResults = [];
      return;
    }
    this.previewLoading = true;
    this.previewError = '';
    this.previewResults = [];
    this.http.post<VenuePreviewResult[]>(
      environment.apiUrl + '/api/admin/venues/imports/openstreetmap/preview',
      payload
    ).subscribe({
      next: results => {
        this.previewResults = results;
        this.previewLoading = false;
      },
      error: () => {
        this.previewError = 'Não foi possível consultar a API. Confirma a sessão de administrador.';
        this.previewLoading = false;
      }
    });
  }
}
