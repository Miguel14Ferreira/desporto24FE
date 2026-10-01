import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AdminGuard } from './admin.guard';
import { AdminAccessService } from '../services/admin-access.service';
import { TEST_IMPORTS } from '../testing/test-providers';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let adminAccessService: jasmine.SpyObj<AdminAccessService>;
  let router: Router;

  beforeEach(() => {
    adminAccessService = jasmine.createSpyObj<AdminAccessService>(
      'AdminAccessService',
      ['check']
    );

    TestBed.configureTestingModule({
      imports: TEST_IMPORTS,
      providers: [
        AdminGuard,
        { provide: AdminAccessService, useValue: adminAccessService }
      ]
    });

    guard = TestBed.inject(AdminGuard);
    router = TestBed.inject(Router);
  });

  it('should allow access when the backend confirms admin access', async () => {
    adminAccessService.check.and.returnValue(of(void 0));

    const result = await firstValueFrom(guard.canActivate());

    expect(result).toBeTrue();
    expect(adminAccessService.check).toHaveBeenCalled();
  });

  it('should redirect to menu when backend admin access is rejected', async () => {
    adminAccessService.check.and.returnValue(
      throwError(() => new Error('forbidden'))
    );

    const result = await firstValueFrom(guard.canActivate());

    expect(router.serializeUrl(result as any)).toBe('/menu');
  });

  it('should not redirect directly to login based on local access token state', async () => {
    adminAccessService.check.and.returnValue(of(void 0));

    const result = await firstValueFrom(guard.canActivate());

    expect(result).toBeTrue();
    expect(router.serializeUrl(router.createUrlTree(['/menu']))).toBe('/menu');
  });
});
