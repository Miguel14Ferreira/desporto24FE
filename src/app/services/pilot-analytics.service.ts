import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from '../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class PilotAnalyticsService {
  private readonly accessUrl = environment.apiUrl + '/api/pilot/events/access';
  private readonly deviceIdKey = 'd24_pilot_device_id';
  private readonly accessRecordedKey = 'd24_pilot_access_recorded';
  private readonly cohortKey = 'd24_pilot_cohort';

  constructor(private http: HttpClient) {}

  recordFirstAccess(cohort?: string | null): void {
    if (this.readStorage(this.accessRecordedKey) === '1') {
      return;
    }

    const normalizedCohort = this.normalizeCohort(cohort)
      ?? this.normalizeCohort(this.readStorage(this.cohortKey));
    if (normalizedCohort) {
      this.writeStorage(this.cohortKey, normalizedCohort);
    }

    const deviceId = this.getOrCreateDeviceId();

    this.http.post<void>(this.accessUrl, {
      deviceId,
      cohort: normalizedCohort
    }).subscribe({
      next: () => this.writeStorage(this.accessRecordedKey, '1'),
      error: () => {
        // Analytics must never interrupt the user journey.
        // A failed request is retried on a future app start.
      }
    });
  }

  private normalizeCohort(cohort?: string | null): string | null {
    const normalized = cohort?.trim();
    return normalized ? normalized : null;
  }

  private getOrCreateDeviceId(): string {
    const existing = this.readStorage(this.deviceIdKey);
    if (existing) {
      return existing;
    }

    const generated = this.generateDeviceId();
    this.writeStorage(this.deviceIdKey, generated);
    return generated;
  }

  private generateDeviceId(): string {
    if (
      typeof crypto !== 'undefined'
      && typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }

    return 'd24-'
      + Date.now().toString(36)
      + '-'
      + Math.random().toString(36).slice(2);
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }
}
