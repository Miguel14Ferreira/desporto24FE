import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmEmergencyTokenComponent } from './confirm-emergency-token.component';

describe('ConfirmEmergencyTokenComponent', () => {
  let component: ConfirmEmergencyTokenComponent;
  let fixture: ComponentFixture<ConfirmEmergencyTokenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConfirmEmergencyTokenComponent ]
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
