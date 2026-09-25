import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginMFAComponent } from './login-mfa.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('LoginMFAComponent', () => {
  let component: LoginMFAComponent;
  let fixture: ComponentFixture<LoginMFAComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoginMFAComponent ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginMFAComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});