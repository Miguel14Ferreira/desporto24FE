import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { AuthenticationService } from './services/authethication.service';
import { PilotAnalyticsService } from './services/pilot-analytics.service';

describe('AppComponent', () => {
  let authenticationService: jasmine.SpyObj<AuthenticationService>;
  let pilotAnalyticsService: jasmine.SpyObj<PilotAnalyticsService>;

  beforeEach(async () => {
    authenticationService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['confirmRegistration']
    );
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
