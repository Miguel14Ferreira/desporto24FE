import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';

interface SessionPublicPreview {
  id: number;
  sport: string | null;
  city: string | null;
  gameDate: string | null;
  maxParticipants: number | null;
  priceAmount: number | null;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' | null;
  gamePhoto: string | null;
}

@Component({
  selector: 'app-public-session-preview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-session-preview.component.html',
  styleUrls: ['./public-session-preview.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class PublicSessionPreviewComponent implements OnInit {
  session: SessionPublicPreview | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.loading = false;
      this.errorMessage = 'Esta ligação de sessão não é válida.';
      return;
    }

    this.http.get<SessionPublicPreview>(
      environment.apiUrl + '/api/sessions/' + id + '/public-preview'
    ).pipe(
      timeout(10000),
      finalize(() => this.loading = false)
    ).subscribe({
      next: session => this.session = session,
      error: () => {
        this.errorMessage = 'Esta sessão não está disponível para consulta pública.';
      }
    });
  }

  get photoUrl(): string | null {
    const photo = this.session?.gamePhoto;
    if (!photo) {
      return null;
    }
    if (photo.startsWith('https://') || photo.startsWith('http://')) {
      return photo;
    }
    return environment.apiUrl + (photo.startsWith('/') ? photo : '/' + photo);
  }

  get statusLabel(): string {
    switch (this.session?.status) {
      case 'OPEN': return 'Inscrições abertas';
      case 'FULL': return 'Sessão completa';
      case 'CANCELLED': return 'Sessão cancelada';
      case 'COMPLETED': return 'Sessão concluída';
      default: return 'Sessão desportiva';
    }
  }
}
