import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { GoogleOnboardingComponent } from './google-onboarding.component';
import { AuthenticationService } from '../../services/authethication.service';

describe('GoogleOnboardingComponent return destination', () => {
  let auth: jasmine.SpyObj<AuthenticationService>;
  let router: jasmine.SpyObj<Router>;
  let route: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };
  let component: GoogleOnboardingComponent;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService', ['googleRegister', 'saveToken']
    );
    auth.googleRegister.and.returnValue(of({ token: 'jwt-token' } as any));
    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);
    route = { snapshot: { queryParamMap: convertToParamMap({}) } };
    component = new GoogleOnboardingComponent(
      auth, router, route as unknown as ActivatedRoute
    );
    component.credential = 'google-credential';
    component.email = 'player@example.test';
    component.username = 'player';
    component.dateOfBirth = '1990-01-01';
    component.acceptedLegalTerms = true;
  });

  afterEach(() => {
    sessionStorage.removeItem('google-onboarding-credential');
    sessionStorage.removeItem('google-onboarding-email');
    sessionStorage.removeItem('google-onboarding-name');
    sessionStorage.removeItem('google-onboarding-picture');
  });

  it('continues to the shared sports session after Google registration', () => {
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '/menu/events/42' });

    component.submit();

    expect(auth.saveToken).toHaveBeenCalledWith('jwt-token');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/events/42');
  });

  it('rejects malformed destinations during Google registration', () => {
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '/menu/../login' });

    component.submit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/feed');
  });

  it('returns safely to login on cancellation', () => {
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '//example.com' });

    component.cancel();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'], { queryParams: { returnUrl: '/menu/feed' } }
    );
  });

  it('returns safely to login when onboarding data is missing', () => {
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '/menu/%2e%2e/login' });

    component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'], { queryParams: { returnUrl: '/menu/feed' } }
    );
  });
});
