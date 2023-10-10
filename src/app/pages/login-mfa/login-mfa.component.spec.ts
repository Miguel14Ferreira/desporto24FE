import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginMFAComponent } from './login-mfa.component';

describe('LoginMFAComponent', () => {
  let component: LoginMFAComponent;
  let fixture: ComponentFixture<LoginMFAComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoginMFAComponent ]
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
