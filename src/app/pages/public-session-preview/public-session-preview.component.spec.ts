import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { PublicSessionPreviewComponent } from './public-session-preview.component';
import { AuthenticationService } from '../../services/authethication.service';
import { I18nService } from '../../i18n/i18n.service';

describe('PublicSessionPreviewComponent', () => {
  let fixture: ComponentFixture<PublicSessionPreviewComponent>;
  let http: jasmine.SpyObj<HttpClient>;
  let authenticationService: jasmine.SpyObj<AuthenticationService>;

  beforeEach(async () => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    authenticationService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService', ['isLoggedIn', 'hasSessionCandidate']
    );
    authenticationService.isLoggedIn.and.returnValue(false);
    authenticationService.hasSessionCandidate.and.returnValue(false);
    await TestBed.configureTestingModule({
      imports: [PublicSessionPreviewComponent, RouterTestingModule],
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: AuthenticationService, useValue: authenticationService },
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: convertToParamMap({ id: '42' }) }
        } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicSessionPreviewComponent);
  });

  afterEach(() => {
    TestBed.inject(I18nService).setLanguage('pt');
    localStorage.removeItem('d24-language');
  });

  function render(overrides: Record<string, unknown> = {}): HTMLElement {
    http.get.and.returnValue(of({
      id: 42,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: new Date(Date.now() + 3600_000).toISOString(),
      maxParticipants: 4,
      priceAmount: 0,
      status: 'OPEN',
      gamePhoto: null,
      ...overrides
    }) as any);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('translates public session facts into English without changing session data', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    const page = render();

    const facts = Array.from(page.querySelectorAll('.session-facts .fact'));
    const labels = facts.map(fact => fact.querySelector('.fact-label')?.textContent?.trim());
    const values = facts.map(fact => fact.querySelector('strong')?.textContent?.trim());

    expect(labels).toEqual(['Location', 'Date', 'Time', 'Price', 'Maximum capacity']);
    expect(values[0]).toBe('Lisboa');
    expect(values[3]).toBe('Free');
    expect(values[4]).toBe('4 participants');
    expect(fixture.componentInstance.session?.priceAmount).toBe(0);

    i18n.setLanguage('pt');
    fixture.detectChanges();
    expect(facts[3].querySelector('strong')?.textContent?.trim()).toBe('Gratuito');
  });

  it('translates missing session details and omits unknown capacity', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    const page = render({
      city: null, gameDate: null, priceAmount: null, maxParticipants: null
    });
    const facts = Array.from(page.querySelectorAll('.session-facts .fact'));
    const values = () => facts.map(fact => fact.querySelector('strong')?.textContent?.trim());

    expect(facts.length).toBe(4);
    expect(values()).toEqual(['Not specified', 'Not specified', 'Not specified', 'Not specified']);

    i18n.setLanguage('pt');
    fixture.detectChanges();
    expect(values()).toEqual(['Por indicar', 'Por indicar', 'Por indicar', 'Por indicar']);
  });

  it('translates guest entry actions to English while preserving the session return URL', () => {
    TestBed.inject(I18nService).setLanguage('en');
    const page = render();

    expect(page.querySelector('.header-login')?.textContent?.trim()).toBe('Sign in');
    expect(page.querySelector('.join-panel .primary-action')?.textContent?.trim()).toBe('Create account');
    expect(page.querySelector('.join-panel .secondary-action')?.textContent?.trim())
      .toBe('I already have an account');
    const createAccount = page.querySelector('.join-panel .primary-action') as HTMLAnchorElement;
    expect(createAccount.getAttribute('href')).toContain('returnUrl=');
    expect(createAccount.getAttribute('href')).toContain('42');
  });

  it('translates available, full and closed session actions for authenticated players', () => {
    TestBed.inject(I18nService).setLanguage('en');
    authenticationService.isLoggedIn.and.returnValue(true);
    const page = render();

    const primary = () => page.querySelector('.join-panel .primary-action') as HTMLAnchorElement;
    expect(page.querySelector('.header-login')?.textContent?.trim()).toBe('Open in Jynlo');
    expect(primary().textContent?.trim()).toBe('View session and join');

    fixture.componentInstance.session!.status = 'FULL';
    fixture.detectChanges();
    expect(primary().textContent?.trim()).toBe('View session and waitlist');

    fixture.componentInstance.session!.status = 'CANCELLED';
    fixture.detectChanges();
    expect(primary().textContent?.trim()).toBe('View details');
    expect(primary().getAttribute('href')).toBe('/menu/events/42');
  });

  it('translates open, full, cancelled and completed session statuses to English', () => {
    TestBed.inject(I18nService).setLanguage('en');
    const page = render();
    const label = () => page.querySelector('.join-panel .status')?.textContent?.trim();

    expect(label()).toBe('Registration open');

    fixture.componentInstance.session!.status = 'FULL';
    fixture.detectChanges();
    expect(label()).toBe('Session full');

    fixture.componentInstance.session!.status = 'CANCELLED';
    fixture.detectChanges();
    expect(label()).toBe('Session cancelled');

    fixture.componentInstance.session!.status = 'COMPLETED';
    fixture.detectChanges();
    expect(label()).toBe('Session completed');
  });

  it('translates closed and unknown statuses without changing participation rules', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    const page = render({ gameDate: new Date(Date.now() - 3600_000).toISOString() });
    const label = () => page.querySelector('.join-panel .status')?.textContent?.trim();

    expect(label()).toBe('Registration closed');
    expect(fixture.componentInstance.canRequestParticipation).toBeFalse();

    fixture.componentInstance.session!.status = null;
    fixture.detectChanges();
    expect(label()).toBe('Sports session');

    i18n.setLanguage('pt');
    fixture.detectChanges();
    expect(label()).toBe('Sessão desportiva');
  });

  it('explains how to join an open session in English for guests and players', () => {
    TestBed.inject(I18nService).setLanguage('en');
    const page = render();
    const heading = () => page.querySelector('.join-panel h2')?.textContent?.trim();
    const description = () => page.querySelector('.join-panel p')?.textContent?.trim();

    expect(heading()).toBe('Your next game starts here.');
    expect(description()).toBe('Create a free account to see all the details and join this session.');

    authenticationService.isLoggedIn.and.returnValue(true);
    fixture.componentInstance.isAuthenticated = true;
    fixture.detectChanges();

    expect(heading()).toBe('Your next game starts here.');
    expect(description()).toBe('Open the session details to join.');
    expect(page.querySelector('.join-panel .primary-action')?.getAttribute('href'))
      .toBe('/menu/events/42');
  });

  it('translates waitlist and closed-session explanations without changing signup options', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    authenticationService.isLoggedIn.and.returnValue(true);
    const page = render({ status: 'FULL' });
    const heading = () => page.querySelector('.join-panel h2')?.textContent?.trim();
    const description = () => page.querySelector('.join-panel p')?.textContent?.trim();

    expect(heading()).toBe('You can still join the waitlist.');
    expect(description()).toContain('join the waitlist');
    expect(page.querySelector('.join-panel .primary-action')?.getAttribute('href'))
      .toBe('/menu/events/42');

    fixture.componentInstance.session!.status = 'CANCELLED';
    fixture.detectChanges();
    expect(heading()).toBe('This session is no longer accepting registrations.');
    expect(description()).toContain('cannot join this game');
    expect(page.querySelector('.join-panel .primary-action')?.textContent?.trim())
      .toBe('View details');

    i18n.setLanguage('pt');
    fixture.detectChanges();
    expect(heading()).toBe('Esta sessão já não aceita inscrições.');
  });

  it('shows a translated invalid-link error without calling the preview API', () => {
    TestBed.inject(I18nService).setLanguage('en');
    TestBed.inject(ActivatedRoute).snapshot.paramMap = convertToParamMap({ id: '1e2' });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.error-state h1')?.textContent?.trim()).toBe('Session unavailable');
    expect(page.querySelector('.error-state p')?.textContent?.trim()).toBe('This session link is invalid.');
    expect(page.querySelector('.retry-action')).toBeNull();
    expect(page.querySelector('.error-state a')?.textContent?.trim()).toBe('Back to home');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('translates temporary preview failures and the retry action', () => {
    TestBed.inject(I18nService).setLanguage('en');
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.error-state p')?.textContent?.trim())
      .toBe('Could not load the session. Check your connection and try again.');
    const retry = page.querySelector('.retry-action') as HTMLButtonElement;
    expect(retry.textContent?.trim()).toBe('Try again');

    http.get.and.returnValue(of({
      id: 42, sport: 'Padel', city: 'Lisboa',
      gameDate: new Date(Date.now() + 3600_000).toISOString(),
      maxParticipants: 4, priceAmount: 0, status: 'OPEN', gamePhoto: null
    }) as any);
    retry.click();
    fixture.detectChanges();

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(page.textContent).toContain('Padel');
    expect(page.querySelector('.retry-action')).toBeNull();
  });

  it('translates permanent preview failures without offering a retry', () => {
    TestBed.inject(I18nService).setLanguage('en');
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.error-state p')?.textContent?.trim())
      .toBe('This session is not available for public viewing.');
    expect(page.querySelector('.retry-action')).toBeNull();
  });

  it('rejects malformed session IDs without requesting a different session', () => {
    const route = TestBed.inject(ActivatedRoute);
    const invalidIds = ['1e2', '42.0', '+42', '00042', '-1', '0', 'abc', '9007199254740992'];

    for (const id of invalidIds) {
      route.snapshot.paramMap = convertToParamMap({ id });
      const invalidFixture = TestBed.createComponent(PublicSessionPreviewComponent);
      invalidFixture.detectChanges();

      const page = invalidFixture.nativeElement as HTMLElement;
      expect(page.textContent).withContext(id).toContain('Esta ligação de sessão não é válida');
      expect(http.get).withContext(id).not.toHaveBeenCalled();
      expect(invalidFixture.componentInstance.returnUrl).withContext(id).toBeNull();
      invalidFixture.destroy();
    }
  });

  it('keeps a canonical positive session ID when loading its public preview', () => {
    const page = render();

    expect(http.get).toHaveBeenCalledWith(jasmine.stringMatching(/\/api\/sessions\/42\/public-preview$/));
    expect(fixture.componentInstance.returnUrl).toBe('/menu/events/42');
    expect(page.querySelector('.join-panel .primary-action')).not.toBeNull();
  });

  it('shows a retry action when the preview API is temporarily unavailable', () => {
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('Verifica a ligação e tenta novamente');
    expect(page.querySelector('.retry-action')).not.toBeNull();
    expect(page.querySelector('.error-state a')).not.toBeNull();
  });

  it('can reload the public preview after a temporary failure', () => {
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    fixture.detectChanges();

    http.get.and.returnValue(of({
      id: 42,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: new Date(Date.now() + 3600_000).toISOString(),
      maxParticipants: 4,
      priceAmount: 0,
      status: 'OPEN',
      gamePhoto: null
    }) as any);

    const button = (fixture.nativeElement as HTMLElement).querySelector('.retry-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(http.get).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Padel');
    expect((fixture.nativeElement as HTMLElement).querySelector('.retry-action')).toBeNull();
  });

  it('does not offer retries for sessions that are not publicly available', () => {
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('Esta sessão não está disponível para consulta pública');
    expect(page.querySelector('.retry-action')).toBeNull();
    expect(page.querySelector('.error-state a')).not.toBeNull();
  });

  it('opens the protected session for a returning player whose access token can be refreshed', () => {
    authenticationService.hasSessionCandidate.and.returnValue(true);
    const page = render();

    expect(authenticationService.hasSessionCandidate).toHaveBeenCalled();
    expect(page.querySelector('.join-panel .primary-action')?.getAttribute('href'))
      .toBe('/menu/events/42');
    expect(page.textContent).not.toContain('Criar conta');
    expect(page.textContent).not.toContain('Já tenho conta');
  });

  it('keeps account creation for a visitor with no recoverable session', () => {
    const page = render();
    const action = page.querySelector('.join-panel .primary-action') as HTMLAnchorElement;

    expect(authenticationService.hasSessionCandidate).toHaveBeenCalled();
    expect(action.getAttribute('href')).toContain('/login/registerNewUser');
    expect(action.getAttribute('href')).toContain('returnUrl=');
    expect(page.textContent).toContain('Criar conta');
  });

  it('lets an authenticated player open an available shared session directly', () => {
    authenticationService.isLoggedIn.and.returnValue(true);
    const page = render();

    const action = page.querySelector('.join-panel .primary-action') as HTMLAnchorElement;
    expect(action).not.toBeNull();
    expect(action.getAttribute('href')).toBe('/menu/events/42');
    expect(page.textContent).toContain('Ver sessão e inscrever-me');
    expect(page.textContent).not.toContain('Criar conta');
    expect(page.textContent).not.toContain('Já tenho conta');
  });

  it('lets an authenticated player open the waiting list for a full session', () => {
    authenticationService.isLoggedIn.and.returnValue(true);
    const page = render({ status: 'FULL' });

    const action = page.querySelector('.join-panel .primary-action') as HTMLAnchorElement;
    expect(action.getAttribute('href')).toBe('/menu/events/42');
    expect(page.textContent).toContain('Ver sessão e lista de espera');
  });

  it('keeps closed shared session details accessible without a login prompt', () => {
    authenticationService.isLoggedIn.and.returnValue(true);
    const page = render({ status: 'CANCELLED' });

    const action = page.querySelector('.join-panel .primary-action') as HTMLAnchorElement;
    expect(action.getAttribute('href')).toBe('/menu/events/42');
    expect(page.textContent).toContain('Ver detalhes');
    expect(page.textContent).not.toContain('Já tenho conta');
  });

  it('offers account creation for a future open session', () => {
    const page = render();
    expect(page.querySelector('.join-panel .primary-action')).not.toBeNull();
    expect(page.querySelector('.join-panel .status.closed')).toBeNull();
    expect(page.textContent).toContain('Inscrições abertas');
  });

  it('offers the waitlist rather than marking a future full session as closed', () => {
    const page = render({ status: 'FULL' });
    expect(page.querySelector('.join-panel .primary-action')).not.toBeNull();
    expect(page.querySelector('.join-panel .status.closed')).toBeNull();
    expect(page.textContent).toContain('lista de espera');
  });

  it('does not invite registration for a cancelled session', () => {
    const page = render({ status: 'CANCELLED' });
    expect(page.querySelector('.join-panel .primary-action')).toBeNull();
    expect(page.querySelector('.join-panel .status.closed')).not.toBeNull();
    expect(page.textContent).toContain('Esta sessão já não aceita inscrições');
    expect(page.querySelector('.join-panel .secondary-action')).not.toBeNull();
  });

  it('does not invite registration for a completed session', () => {
    const page = render({ status: 'COMPLETED' });
    expect(page.querySelector('.join-panel .primary-action')).toBeNull();
    expect(page.textContent).toContain('Sessão concluída');
  });

  it('closes registrations when an open session has already started', () => {
    const page = render({ gameDate: new Date(Date.now() - 3600_000).toISOString() });
    expect(page.querySelector('.join-panel .primary-action')).toBeNull();
    expect(page.textContent).toContain('Inscrições encerradas');
  });
});
