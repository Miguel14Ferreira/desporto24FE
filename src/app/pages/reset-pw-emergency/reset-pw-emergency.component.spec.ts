import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetPwEmergencyComponent } from './reset-pw-emergency.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('ResetPwEmergencyComponent', () => {
  let component: ResetPwEmergencyComponent;
  let fixture: ComponentFixture<ResetPwEmergencyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResetPwEmergencyComponent ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResetPwEmergencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});