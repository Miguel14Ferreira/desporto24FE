import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { rememberRegistrationDestination, takeRegistrationDestination } from './shared/registration-return-url';
import { AppComponent } from './app.component';
import { AuthenticationService } from './services/authethication.service';
import { PilotAnalyticsService } from './services/pilot-analytics.service';

describe('AppComponent', () => {
  let authenticationService: jasmine.SpyObj<AuthenticationService>;
  let pilotAnalyticsService: jasmine.SpyObj<PilotAnalyticsService>;
  let initialLocation: string;

  beforeEach(async () => {
    initialLocation = window.location.pathname + window.location.search + window.location.hash;
    localStorage.removeItem('jynlo-registration-destination');
    authenticationService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['confirmRegistration']
    );
    authenticationService.confirmRegistration.and.returnValue(of({ message: 'Conta confirmada' } as any));
    pilotAnalyticsService = jasmine.createSpyObj<PilotAnalyticsService>(
      'PilotAnalyticsService',
      ['recordFirstAccess']
    );

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppComponent],
      providers: [
        { provide: AuthenticationService, useValue: authenticationService },
        { provide: PilotAnalyticsService, useValue: pilotAnalyticsService }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('jynlo-registration-destination');
    window.history.replaceState({}, '', initialLocation);
  });

  it('should return to a shared session after email confirmation in the same browser', () => {
    rememberRegistrationDestination('/menu/events/42');
    window.history.pushState({}, '', '/?confirmRegistration=fixture-token');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    TestBed.createComponent(AppComponent).detectChanges();

    expect(authenticationService.confirmRegistration).toHaveBeenCalledWith('fixture-token');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/menu/events/42' } });
    expect(takeRegistrationDestination()).toBeNull();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should record the first access when the app starts', () => {
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    expect(pilotAnalyticsService.recordFirstAccess).toHaveBeenCalledTimes(1);
  });

  it('should expose the Desporto24 title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toEqual('desporto24');
  });

  it('should render the application shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).not.toBeNull();
    expect(compiled.querySelector('app-footer')).not.toBeNull();
  });
});
