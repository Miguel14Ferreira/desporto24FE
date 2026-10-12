import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { PublicSessionPreviewComponent } from './public-session-preview.component';

describe('PublicSessionPreviewComponent', () => {
  let fixture: ComponentFixture<PublicSessionPreviewComponent>;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(async () => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    await TestBed.configureTestingModule({
      imports: [PublicSessionPreviewComponent, RouterTestingModule],
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: convertToParamMap({ id: '42' }) }
        } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicSessionPreviewComponent);
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
