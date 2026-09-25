import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionDetail } from '../model/session-detail';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-session-details',
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SessionDetailsComponent implements OnInit {
  session?: SessionDetail;
  loading = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.errorMessage = 'Sessão inválida.';
      return;
    }

    this.loading = true;
    this.sessionService.detail(id)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: session => this.session = session,
        error: () => this.errorMessage = 'Não foi possível carregar os detalhes desta sessão.'
      });
  }

  photoUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }
}
