import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotFoundComponent } from './not-found.component';
import { AuthenticationService } from '../../services/authethication.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('NotFoundComponent', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;
  let auth: jasmine.SpyObj<AuthenticationService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasValidToken']
    );
    auth.hasValidToken.and.returnValue(false);

    await TestBed.configureTestingModule({
      declarations: [NotFoundComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: auth }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should send anonymous users to home', () => {
    expect(component).toBeTruthy();
    expect(component.destination).toBe('/home');
  });

  it('should send authenticated users to dashboard', () => {
    auth.hasValidToken.and.returnValue(true);

    const authenticated = TestBed.createComponent(NotFoundComponent);
    authenticated.detectChanges();

    expect(authenticated.componentInstance.destination).toBe('/menu');
    expect(authenticated.nativeElement.textContent).toContain('Voltar ao painel');
  });
});
