import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthenticationService } from './authethication.service';
import { GoogleRegistrationRequest } from '../pages/model/google-auth-response';
import { RegistrationRequest } from '../pages/model/registration-request';

describe('AuthenticationService pilot cohort attribution', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let router: jasmine.SpyObj<Router>;
  let service: AuthenticationService;

  beforeEach(() => {
    localStorage.removeItem('d24_pilot_cohort');
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    service = new AuthenticationService(http, router);
  });

  afterEach(() => {
    localStorage.removeItem('d24_pilot_cohort');
  });

  it('adds stored cohort to normal registration multipart', () => {
    localStorage.setItem('d24_pilot_cohort', '  pilot-lisbon-2026  ');
    http.post.and.returnValue(of({ message: 'ok' } as any));

    const request = {
      username: 'miguel',
      password: 'password-123',
      nickname: 'Miguel',
      dateOfBirth: '1990-01-01',
      country: 'Portugal',
      indicativePhone: '351',
      phone: '912345678',
      gender: 'masculino',
      email: 'miguel@example.com'
    } as RegistrationRequest;

    service.register(request).subscribe();

    const formData = http.post.calls.mostRecent().args[1] as FormData;
    expect(formData.get('cohort')).toBe('pilot-lisbon-2026');
  });

  it('adds stored cohort to google registration query params', () => {
    localStorage.setItem('d24_pilot_cohort', 'pilot-lisbon-2026');
    http.post.and.returnValue(of({ token: 'jwt' } as any));

    const request = {
      credential: 'google-credential',
      username: 'miguel',
      nickname: null,
      dateOfBirth: '1990-01-01',
      country: 'Portugal',
      indicativePhone: null,
      phone: null,
      gender: null
    } as GoogleRegistrationRequest;

    service.googleRegister(request).subscribe();

    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/api\/auth\/google\/register$/),
      request,
      {
        withCredentials: true,
        params: { cohort: 'pilot-lisbon-2026' }
      }
    );
  });

  it('keeps registration payload unchanged when no cohort is stored', () => {
    http.post.and.returnValue(of({ message: 'ok' } as any));

    const request = {
      username: 'miguel',
      password: 'password-123',
      nickname: 'Miguel',
      dateOfBirth: '1990-01-01',
      country: 'Portugal',
      indicativePhone: '351',
      phone: '912345678',
      gender: 'masculino',
      email: 'miguel@example.com'
    } as RegistrationRequest;

    service.register(request).subscribe();

    const formData = http.post.calls.mostRecent().args[1] as FormData;
    expect(formData.has('cohort')).toBeFalse();
  });
});
