import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from 'src/environment/environment';
import { SessionOverallRating, SessionService } from './session.service';

describe('SessionService post-game rating HTTP contract', () => {
  let service: SessionService;
  let http: HttpTestingController;

  const ratingUrl = environment.apiUrl + '/api/sessions/7/ratings/me';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns null when the player has not rated the session (HTTP 204)', () => {
    let result: SessionOverallRating | null | undefined;
    service.myOverallRating(7).subscribe(rating => result = rating);

    const request = http.expectOne(ratingUrl);
    expect(request.request.method).toBe('GET');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(result).toBeNull();
  });

  it('reads an existing personal overall score', () => {
    const rating: SessionOverallRating = {
      overallScore: 4,
      updatedAt: '2026-10-13T10:00:00Z'
    };
    let result: SessionOverallRating | null | undefined;
    service.myOverallRating(7).subscribe(value => result = value);

    const request = http.expectOne(ratingUrl);
    expect(request.request.method).toBe('GET');
    request.flush(rating);

    expect(result).toEqual(rating);
  });

  it('sends just the selected overall score when creating or editing a rating', () => {
    const saved: SessionOverallRating = {
      overallScore: 5,
      updatedAt: '2026-10-13T10:05:00Z'
    };
    let result: SessionOverallRating | undefined;
    service.rateOverall(7, 5).subscribe(value => result = value);

    const request = http.expectOne(ratingUrl);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ overallScore: 5 });
    request.flush(saved);

    expect(result).toEqual(saved);
  });

  it('propagates a forbidden response instead of treating it as no rating', () => {
    let status: number | undefined;
    service.myOverallRating(7).subscribe({
      error: (error: HttpErrorResponse) => status = error.status
    });

    const request = http.expectOne(ratingUrl);
    expect(request.request.method).toBe('GET');
    request.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
  });
});
