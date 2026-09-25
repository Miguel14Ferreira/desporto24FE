import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ChangepasswordComponent } from './changepassword.component';
import { MyProfileService } from '../../services/my-profile.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('ChangepasswordComponent', () => {
  let component: ChangepasswordComponent;
  let fixture: ComponentFixture<ChangepasswordComponent>;
  let service: jasmine.SpyObj<MyProfileService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<MyProfileService>('MyProfileService', ['changePassword']);
    service.changePassword.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      declarations: [ChangepasswordComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: MyProfileService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChangepasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should change password with current and new password', () => {
    component.currentPassword = 'current-password';
    component.newPassword = 'new-password-123';
    component.confirmPassword = 'new-password-123';

    component.changePassword();

    expect(service.changePassword).toHaveBeenCalledWith(
      'current-password',
      'new-password-123'
    );
    expect(component.successMessage).toContain('sucesso');
  });

  it('should reject mismatching confirmation', () => {
    component.currentPassword = 'current-password';
    component.newPassword = 'new-password-123';
    component.confirmPassword = 'different-password';

    component.changePassword();

    expect(service.changePassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('não coincidem');
  });

  it('should reject a password shorter than eight characters', () => {
    component.currentPassword = 'current-password';
    component.newPassword = 'short';
    component.confirmPassword = 'short';

    component.changePassword();

    expect(service.changePassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('8 caracteres');
  });
});
