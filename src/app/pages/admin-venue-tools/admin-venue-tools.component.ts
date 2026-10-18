import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { finalize, Subscription, timeout } from 'rxjs';
import { environment } from 'src/environment/environment';

export interface VenueCoverage {
  totalVenues: number;
  withoutDistrict: number;
  withoutCoordinates: number;
  withoutSports: number;
  districts: Array<{
    district: string;
    venues: number;
    missingCoordinates: number;
    missingSports: number;
    openStreetMapVenues: number;
  }>;
}

interface VenuePreviewResult {
  sourceReference: string;
  name: string;
  status: string;
  candidates: { id: number; name: string; city: string }[];
}

@Component({
  selector: 'app-admin-venue-tools',
  templateUrl: './admin-venue-tools.component.html',
  styleUrls: ['../admin-dashboard/admin-dashboard.component.css', './admin-venue-tools.component.css'],
  standalone: false
})
export class AdminVenueToolsComponent implements OnInit, OnDestroy {
  venuePayload = '[\n  {\n    "sourceReference": "OSM:WAY:305711614",\n    "name": "Piscina Municipal da Constituição",\n    "city": "Porto",\n    "address": "Rua do Almirante Leote do Rêgo, 4200-260 Porto",\n    "sports": "Natação",\n    "venueType": "Piscina",\n    "environmentType": "INDOOR",\n    "latitude": 41.16518,\n    "longitude": -8.61414\n  },\n  {\n    "sourceReference": "OSM:WAY:58257179",\n    "name": "Pavilhão Municipal Multidesportos Mário Mexia",\n    "city": "Coimbra",\n    "address": "Praça Heróis do Ultramar, 3030-327 Coimbra",\n    "sports": "Andebol;Basquetebol;Voleibol;Futsal;Patinagem;Ginástica",\n    "venueType": "Pavilhão Desportivo",\n    "environmentType": "INDOOR",\n    "latitude": 40.20540,\n    "longitude": -8.40816\n  }\n]';
  previewResults: VenuePreviewResult[] = [];
  previewError = '';
  previewLoading = false;
  previewDone = false;
  coverage: VenueCoverage | null = null;
  coverageLoading = false;
  coverageError = '';
  private coverageRequestVersion = 0;
  private coverageRequest?: Subscription;
  private request?: Subscription;

  constructor(private http: HttpClient, private changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCoverage();
  }

  loadCoverage(): void {
    const version = ++this.coverageRequestVersion;
    this.coverageRequest?.unsubscribe();
    this.coverageLoading = true;
    this.coverageError = '';
    this.coverageRequest = this.http.get<VenueCoverage>(
      environment.apiUrl + '/api/admin/venues/coverage'
    ).pipe(
      timeout(12_000),
      finalize(() => {
        if (version === this.coverageRequestVersion) {
          this.coverageLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: result => {
        if (version !== this.coverageRequestVersion) return;
        this.coverage = result;
        this.changeDetector.markForCheck();
      },
      error: err => {
        if (version !== this.coverageRequestVersion) return;
        this.coverageError = err?.status === 404
          ? 'O relatório por distrito ainda não está disponível nesta versão da API.'
          : 'Não foi possível carregar os dados dos recintos. Tenta novamente.';
        this.changeDetector.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    ++this.coverageRequestVersion;
    this.coverageRequest?.unsubscribe();
    this.request?.unsubscribe();
  }

  previewVenues(): void {
    if (this.previewLoading) return;
    let payload: unknown;
    try {
      payload = JSON.parse(this.venuePayload);
      if (!Array.isArray(payload) || payload.length < 1 || payload.length > 25) {
        throw new Error('Fornece entre 1 e 25 recintos.');
      }
    } catch {
      this.previewError = 'JSON inválido ou lista fora do limite de 1 a 25 recintos.';
      this.previewResults = [];
      this.previewDone = false;
      return;
    }
    this.previewLoading = true;
    this.previewError = '';
    this.previewResults = [];
    this.previewDone = false;
    this.request = this.http.post<VenuePreviewResult[]>(
      environment.apiUrl + '/api/admin/venues/imports/openstreetmap/preview',
      payload
    ).pipe(
      timeout(12_000),
      finalize(() => {
        this.previewLoading = false;
        this.changeDetector.markForCheck();
      })
    ).subscribe({
      next: results => {
        this.previewResults = results;
        this.previewDone = true;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.previewError = 'Não foi possível verificar os recintos. Tenta novamente.';
        this.changeDetector.markForCheck();
      }
    });
  }
}
