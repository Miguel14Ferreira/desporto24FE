import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { SessionSummary } from '../model/session-summary';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class EventsComponent implements OnInit {
  sessions: SessionSummary[] = [];
  loading = false;
  errorMessage = '';

  sport = '';
  city = '';
  availableOnly = true;
  freeOnly = false;

  constructor(private sessionService: SessionService) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';

    this.sessionService.discover({
      sport: this.sport,
      city: this.city,
      availability: this.availableOnly ? 'available' : undefined,
      freeOnly: this.freeOnly ? true : undefined
    })
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: sessions => this.sessions = sessions,
      error: () => {
        this.sessions = [];
        this.errorMessage = 'Não foi possível carregar as sessões. Tenta novamente.';
      }
    });
  }

  clearFilters(): void {
    this.sport = '';
    this.city = '';
    this.availableOnly = true;
    this.freeOnly = false;
    this.loadSessions();
  }
}
