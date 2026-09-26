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
    dateOfBirth: null,
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
    service = jasmine.createSpyObj<MyProfileService>('MyProfileService', ['get', 'update']);
    service.get.and.returnValue(of({ ...profile }));
    service.update.and.returnValue(of({ ...profile, location: 'Sintra' }));

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

  it('should update only editable profile fields', () => {
    if (!component.profile) {
      fail('Profile should be loaded');
      return;
    }

    component.profile.location = 'Sintra';
    component.save();

    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        email: 'miguel@example.com',
        location: 'Sintra',
        mfa: true
      }),
      undefined
    );
    expect(component.successMessage).toContain('sucesso');
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
