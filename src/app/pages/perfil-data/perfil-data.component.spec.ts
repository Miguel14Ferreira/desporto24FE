import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PerfilDataComponent } from './perfil-data.component';
import { MyProfileService } from '../../services/my-profile.service';
import { ReliabilityService } from '../../services/reliability.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('PerfilDataComponent', () => {
  let component: PerfilDataComponent;
  let fixture: ComponentFixture<PerfilDataComponent>;
  let profileService: jasmine.SpyObj<MyProfileService>;
  let reliabilityService: jasmine.SpyObj<ReliabilityService>;

  beforeEach(async () => {
    profileService = jasmine.createSpyObj<MyProfileService>('MyProfileService', ['get']);
    reliabilityService = jasmine.createSpyObj<ReliabilityService>('ReliabilityService', ['summary']);

    profileService.get.and.returnValue(of({
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
    }));

    reliabilityService.summary.and.returnValue(of({
      attendanceRate: 90,
      completedSessions: 10,
      noShows: 1,
      lateCancellations: 0,
      penaltyScore: 1,
      warning: false,
      reducedPriority: false,
      joinRestricted: false
    }));

    await TestBed.configureTestingModule({
      declarations: [PerfilDataComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: MyProfileService, useValue: profileService },
        { provide: ReliabilityService, useValue: reliabilityService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load the authenticated profile', () => {
    expect(component).toBeTruthy();
    expect(profileService.get).toHaveBeenCalled();
    expect(component.profile?.username).toBe('miguel');
  });

  it('should load reliability after the profile', () => {
    expect(reliabilityService.summary).toHaveBeenCalledWith('miguel');
    expect(component.reliability?.attendanceRate).toBe(90);
  });
});
