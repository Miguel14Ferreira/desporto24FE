import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AlterardadosComponent } from './alterardados.component';
import { MyProfileService } from '../../services/my-profile.service';
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
    mfa: true,
    profilePicUrl: null,
    joinDateDisplay: null,
    lastLoginDateDisplay: null
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<MyProfileService>('MyProfileService', ['get', 'update', 'disableMfa']);
    service.get.and.returnValue(of({ ...profile }));
    service.update.and.returnValue(of({ ...profile, location: 'Sintra' }));
    service.disableMfa.and.returnValue(of({ ...profile, mfa: false }));

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

  it('should silently close an unfinished MFA setup when the toggle is turned off', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    component.profile.mfa = false;
    component.mfaSetup = {
      secret: 'secret',
      qrCodeDataUrl: 'data:image/png;base64,test',
      otpauthUri: 'otpauth://totp/desporto24'
    };
    component.mfaSetupCode = '123456';

    component.onMfaToggle({ target: { checked: false } } as unknown as Event);

    expect(service.disableMfa).not.toHaveBeenCalled();
    expect(component.mfaSetup).toBeUndefined();
    expect(component.mfaSetupCode).toBe('');
    expect(component.toastMessage).toBe('');
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
    expect(component.errorMessage).toContain('email');
  });
});
