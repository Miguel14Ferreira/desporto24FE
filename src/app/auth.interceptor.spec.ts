import { TestBed } from '@angular/core/testing';

import { AuthInterceptor } from './auth.interceptor';
import { TEST_PROVIDERS } from './testing/test-providers';

describe('AuthInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [AuthInterceptor, ...TEST_PROVIDERS]
  }));

  it('should be created', () => {
    const interceptor: AuthInterceptor = TestBed.inject(AuthInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
