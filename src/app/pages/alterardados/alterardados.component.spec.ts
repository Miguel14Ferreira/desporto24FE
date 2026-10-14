import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AlterardadosComponent } from './alterardados.component';
import { MyProfileService } from '../../services/my-profile.service';
import { AuthenticationService } from '../../services/authethication.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('AlterardadosComponent', () => {
  let component: AlterardadosComponent;
  let fixture: ComponentFixture<AlterardadosComponent>;
  let service: jasmine.SpyObj<MyProfileService>;

  const profile = {
    userId: 'u1',
    username: 'miguel',
    fullName: 'Miguel Ferreira',
    nickname: 'Miguel',
    dateOfBirth: '1995-06-14',
    address: null,
    country: 'Portugal',
    location: 'Lisboa',
    postalCode: null,
    indicativePhone: '351',
    phone: '912345678',
    gender: null,
    email: 'miguel@example.com',
    favoriteSports: 'Padel',
    bio: null,
    skillLevel: null,
    availability: null,
    mfa: true,
    profilePicUrl: null,
    joinDateDisplay: null,
    lastLoginDateDisplay: null
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<MyProfileService>('MyProfileService', ['get', 'update', 'disableMfa', 'deleteAccount']);
    service.get.and.returnValue(of({ ...profile }));
    service.update.and.returnValue(of({ ...profile, location: 'Sintra' }));
    service.disableMfa.and.returnValue(of({ ...profile, mfa: false }));
    service.deleteAccount.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      declarations: [AlterardadosComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: MyProfileService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AlterardadosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps photo upload controls visually disabled while the photo is saving', () => {
    component.photoEditing = true;
    component.photoSaving = true;
    fixture.detectChanges();

    const picker: HTMLLabelElement = fixture.nativeElement.querySelector('.photo-edit-actions .upload-action');
    const input: HTMLInputElement = picker.querySelector('input[type="file"]')!;
    const save: HTMLButtonElement = fixture.nativeElement.querySelector('.photo-edit-actions .photo-save-action');
    const cancel: HTMLButtonElement = fixture.nativeElement.querySelector('.photo-edit-actions .photo-cancel-action');

    expect(picker.classList.contains('jynlo-action')).toBeTrue();
    expect(picker.classList.contains('disabled')).toBeTrue();
    expect(input.disabled).toBeTrue();
    expect(save.disabled).toBeTrue();
    expect(cancel.disabled).toBeTrue();

    component.photoSaving = false;
    fixture.detectChanges();

    expect(picker.classList.contains('disabled')).toBeFalse();
    expect(input.disabled).toBeFalse();
  });

  it('should create and load the authenticated profile', () => {
    expect(component).toBeTruthy();
    expect(service.get).toHaveBeenCalled();
    expect(component.profile?.username).toBe('miguel');
  });

  it('should update the fields from the current account form and preserve legacy data', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    component.profile.nickname = 'Migas';
    component.save();

    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        nickname: 'Migas',
        email: 'miguel@example.com',
        dateOfBirth: '1995-06-14',
        country: 'Portugal',
        location: 'Lisboa',
        fullName: 'Miguel Ferreira',
        mfa: true
      })
    );
    expect(component.toastMessage).toContain('sucesso');
  });

  it('allows editing the optional locality and sends it to the profile API', () => {
    const locationInput = fixture.nativeElement.querySelector('input[name="location"]') as HTMLInputElement;
    expect(locationInput).not.toBeNull();
    expect(locationInput.value).toBe('Lisboa');
    expect(locationInput.required).toBeFalse();
    expect(locationInput.maxLength).toBe(120);
    expect(locationInput.autocomplete).toBe('address-level2');

    locationInput.value = '  Sintra  ';
    locationInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    component.save();

    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({ location: 'Sintra' })
    );
  });

  it('allows removing the locality without sending a blank string', () => {
    const locationInput = fixture.nativeElement.querySelector('input[name="location"]') as HTMLInputElement;
    locationInput.value = '   ';
    locationInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    component.save();

    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({ location: null })
    );
  });

  it('disables locality editing while profile changes are being saved', () => {
    component.saving = true;
    fixture.detectChanges();

    const locationInput = fixture.nativeElement.querySelector('input[name="location"]') as HTMLInputElement;
    expect(locationInput.disabled).toBeTrue();
  });

  it('should treat the phone as optional and clear its calling code when empty', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    component.profile.phone = '';
    component.profile.indicativePhone = '351';
    component.save();

    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        phone: null,
        indicativePhone: null
      })
    );
  });

  it('should normalize the phone exactly like registration', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    component.profile.phone = '912 345 678';
    component.profile.indicativePhone = '351';
    component.save();

    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        phone: '912345678',
        indicativePhone: '351'
      })
    );
  });

  it('should require verification before disabling active MFA', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    expect(component.profile.mfa).toBeTrue();
    component.mfaDisableCode = '123456';
    const checkbox = { checked: false };

    component.onMfaToggle({ target: checkbox } as unknown as Event);

    expect(checkbox.checked).toBeTrue();
    expect(component.mfaDisablePending).toBeTrue();
    expect(component.mfaDisableCode).toBe('');
    expect(component.profile.mfa).toBeTrue();
    expect(service.disableMfa).not.toHaveBeenCalled();
    expect(component.toastMessage).toBe('');
  });

  it('should calculate sports profile completion', () => {
    expect(component.profileCompletion.percentage).toBeGreaterThan(0);
    expect(component.profileCompletion.missing.length).toBeGreaterThan(0);
  });

  it('should expose an icon for sports', () => {
    expect(component.iconForSport('Futebol')).toBe('⚽');
    expect(component.iconForSport('Padel')).toBe('🎾');
  });

  it('should require an email before saving', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    component.profile.email = '   ';
    component.save();

    expect(service.update).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Existem campos que precisam da tua atenção.');
    expect(component.fieldErrors.email).toBe('Indica o teu email.');
  });

  it('should not delete the account when the confirmation username is wrong', () => {
    component.openAccountDeletion();
    component.accountDeletionConfirmation = 'another-user';

    component.deleteAccount();

    expect(service.deleteAccount).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('utilizador');
  });

  it('should delete the authenticated account and clear the local session', () => {
    const authenticationService = TestBed.inject(AuthenticationService);
    const logoutSpy = spyOn(authenticationService, 'logOut').and.callThrough();

    component.openAccountDeletion();
    component.accountDeletionConfirmation = 'miguel';
    component.deleteAccount();

    expect(service.deleteAccount).toHaveBeenCalled();
    expect(logoutSpy).toHaveBeenCalled();
  });
});
