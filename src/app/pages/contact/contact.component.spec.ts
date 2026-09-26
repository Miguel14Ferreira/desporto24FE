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
    component.city = 'Lisboa';
    component.email = 'miguel@example.com';
    component.gender = 'masculino';
    component.subject = 'Sugestão';
    component.problem = 'Gostava de ter torneios.';
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should submit feedback through the public API', () => {
    fill();

    component.submit();

    expect(service.submit).toHaveBeenCalledWith({
      name: 'Miguel Ferreira',
      city: 'Lisboa',
      email: 'miguel@example.com',
      gender: 'masculino',
      subject: 'Sugestão',
      problem: 'Gostava de ter torneios.'
    });
    expect(component.successMessage).toContain('Obrigado');
  });

  it('should reject incomplete feedback', () => {
    component.name = 'Miguel';

    component.submit();

    expect(service.submit).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('todos os campos');
  });
});
