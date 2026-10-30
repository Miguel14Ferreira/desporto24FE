import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MyProfileService } from './my-profile.service';

describe('MyProfileService device sessions', () => {
  let service: MyProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MyProfileService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(MyProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads only the authenticated account device sessions', () => {
    let count = -1;
    service.getDeviceSessions().subscribe(sessions => count = sessions.length);
    const req = http.expectOne(r => r.url.endsWith('/api/auth/sessions'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(count).toBe(0);
  });

  it('sends credentials on device revocation to clear the HttpOnly cookie if current', () => {
    let done = false;
    service.revokeDeviceSession('aa/bb').subscribe(() => done = true);
    const req = http.expectOne(r => r.url.endsWith('/api/auth/sessions/aa%2Fbb'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null);
    expect(done).toBeTrue();
  });
  it('ends only other devices using an authenticated credentialed DELETE', () => {
    let finished = false;
    service.revokeOtherDeviceSessions().subscribe(() => finished = true);
    const req = http.expectOne(r => r.url.endsWith('/api/auth/sessions/others'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null);
    expect(finished).toBeTrue();
  });

});
