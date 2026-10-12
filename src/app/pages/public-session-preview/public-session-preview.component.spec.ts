import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

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
