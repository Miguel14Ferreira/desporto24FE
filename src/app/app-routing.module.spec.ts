import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AppRoutingModule } from './app-routing.module';
import { GuestOnlyGuard } from './guard/guest-only.guard';
import { AuthenticationGuard } from './guard/authentication.guard';
import { CreateaccountComponent } from './pages/createaccount/createaccount.component';
import { GoogleOnboardingComponent } from './pages/google-onboarding/google-onboarding.component';

describe('Account creation route protection', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule] });
  });

  it('protects both email and Google registration screens with the guest-only guard', () => {
    const routes = TestBed.inject(Router).config;
    const email = routes.find(route => route.path === 'login/registerNewUser');
    const google = routes.find(route => route.path === 'login/google/complete-profile');

    expect(email?.component).toBe(CreateaccountComponent);
    expect(email?.canActivate).toContain(GuestOnlyGuard);
    expect(google?.component).toBe(GoogleOnboardingComponent);
    expect(google?.canActivate).toContain(GuestOnlyGuard);
  });
  it('guards the unified message center and loads its dedicated screen lazily', () => {
    const route = TestBed.inject(Router).config.find(item => item.path === 'menu/messages');
    expect(route?.canActivate).toContain(AuthenticationGuard);
    expect(route?.loadComponent).toBeDefined();
  });
});
