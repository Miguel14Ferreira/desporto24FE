import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { finalize, filter, Subscription } from 'rxjs';

import { environment } from '../../environment/environment';
import { AuthenticationService } from './authethication.service';

/**
 * Visible, authenticated browser presence — not login counts.
 * Each visible tab reports at most once a minute; the backend deduplicates
 * accounts and excludes signals older than 150 seconds.
 */
@Injectable({ providedIn: 'root' })
export class OnlinePresenceService {
  private readonly heartbeatUrl = environment.apiUrl + '/api/presence/heartbeat';
  private readonly refreshMs = 60_000;
  private started = false;
  private sending = false;
  private intervalId?: number;
  private routeSubscription?: Subscription;

  private readonly onVisibilityChange = (): void => this.heartbeat();
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === 't') this.heartbeat();
  };

  constructor(
    private http: HttpClient,
    private authentication: AuthenticationService,
    private router: Router,
    private zone: NgZone,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('storage', this.onStorage);
    this.routeSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.heartbeat());

    this.zone.runOutsideAngular(() => {
      this.intervalId = window.setInterval(() => this.heartbeat(), this.refreshMs);
    });
    this.heartbeat();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('storage', this.onStorage);
    this.routeSubscription?.unsubscribe();
    this.routeSubscription = undefined;
    if (this.intervalId !== undefined) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private heartbeat(): void {
    if (!this.started || this.doc.visibilityState !== 'visible'
        || !this.authentication.hasValidToken() || this.sending) {
      return;
    }
    this.sending = true;
    this.http.post<void>(this.heartbeatUrl, null).pipe(
      finalize(() => this.sending = false)
    ).subscribe({
      error: () => {
        // Presence is best-effort and must not interrupt app navigation.
      }
    });
  }
}
