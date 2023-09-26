import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmTokenRegistrationComponent } from './confirm-token-registration.component';

describe('ConfirmTokenRegistrationComponent', () => {
  let component: ConfirmTokenRegistrationComponent;
  let fixture: ComponentFixture<ConfirmTokenRegistrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConfirmTokenRegistrationComponent ]
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
