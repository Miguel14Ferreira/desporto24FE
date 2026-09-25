import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmTokenRegistrationComponent } from './confirm-token-registration.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('ConfirmTokenRegistrationComponent', () => {
  let component: ConfirmTokenRegistrationComponent;
  let fixture: ComponentFixture<ConfirmTokenRegistrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConfirmTokenRegistrationComponent ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmTokenRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});