import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmEmergencyTokenComponent } from './confirm-emergency-token.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('ConfirmEmergencyTokenComponent', () => {
  let component: ConfirmEmergencyTokenComponent;
  let fixture: ComponentFixture<ConfirmEmergencyTokenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConfirmEmergencyTokenComponent ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmEmergencyTokenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});