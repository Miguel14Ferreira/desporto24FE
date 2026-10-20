import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ContactComponent } from './contact.component';
import { FeedbackService } from '../../services/feedback.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('ContactComponent', () => {
  let component: ContactComponent;
  let fixture: ComponentFixture<ContactComponent>;
  let service: jasmine.SpyObj<FeedbackService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<FeedbackService>('FeedbackService', ['submit']);
    service.submit.and.returnValue(of({ message: 'Obrigado' } as any));

    await TestBed.configureTestingModule({
      declarations: [ContactComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: FeedbackService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fill(): void {
    component.name = 'Miguel Ferreira';
    component.email = 'miguel@example.com';
    component.category = 'contact.category.tournaments';
    component.problem = 'Gostava de ter torneios.';
  }

  it('declares POST on the contact form', () => {
    const form = fixture.nativeElement.querySelector('form.contact-card') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('post');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should submit feedback through the public API', () => {
    fill();

    component.submit();

    expect(service.submit).toHaveBeenCalledWith({
      name: 'Miguel Ferreira',
      city: '',
      email: 'miguel@example.com',
      gender: '',
      subject: jasmine.any(String),
      problem: 'Gostava de ter torneios.'
    });
    expect(component.successMessage).toContain('Obrigado');
  });

  it('should show contextual email validation', () => {
    fill();
    component.email = 'invalid-email';

    component.submit();

    expect(service.submit).not.toHaveBeenCalled();
    expect(component.fieldErrors.email).toBeTruthy();
  });

  it('should reject incomplete feedback', () => {
    component.name = 'Miguel';

    component.submit();

    expect(service.submit).not.toHaveBeenCalled();
    expect(component.fieldErrors.email).toBeTruthy();
    expect(component.fieldErrors.category).toBeTruthy();
    expect(component.fieldErrors.problem).toBeTruthy();
  });
});
