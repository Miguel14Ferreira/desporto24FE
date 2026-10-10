import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { environment } from 'src/environment/environment';

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
export class AdminDashboardComponent {
  venuePayload = '[\n  {\n    "sourceReference": "OSM:WAY:305711614",\n    "name": "Piscina Municipal da Constituição",\n    "city": "Porto",\n    "address": "Rua do Almirante Leote do Rêgo, 4200-260 Porto",\n    "sports": "Natação",\n    "venueType": "Piscina",\n    "environmentType": "INDOOR",\n    "latitude": 41.16518,\n    "longitude": -8.61414\n  },\n  {\n    "sourceReference": "OSM:WAY:58257179",\n    "name": "Pavilhão Municipal Multidesportos Mário Mexia",\n    "city": "Coimbra",\n    "address": "Praça Heróis do Ultramar, 3030-327 Coimbra",\n    "sports": "Andebol;Basquetebol;Voleibol;Futsal;Patinagem;Ginástica",\n    "venueType": "Pavilhão Desportivo",\n    "environmentType": "INDOOR",\n    "latitude": 40.20540,\n    "longitude": -8.40816\n  }\n]';
  previewResults: VenuePreviewResult[] = [];
  previewError = '';
  previewLoading = false;

  constructor(private http: HttpClient) {}

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
