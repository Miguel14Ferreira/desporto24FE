import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetPwEmergencyComponent } from './reset-pw-emergency.component';

describe('ResetPwEmergencyComponent', () => {
  let component: ResetPwEmergencyComponent;
  let fixture: ComponentFixture<ResetPwEmergencyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResetPwEmergencyComponent ]
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
