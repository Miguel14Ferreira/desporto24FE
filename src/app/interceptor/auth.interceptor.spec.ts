import { AuthInterceptor } from './auth.interceptor';

describe('AuthInterceptor', () => {
  it('should be created', () => {
    const loginPerfil = { host: 'http://test' };
    const authService = {
      loadToken: () => undefined,
      getToken: () => 'test-token'
    };

    const interceptor = new AuthInterceptor(loginPerfil as any, authService as any);

    expect(interceptor).toBeTruthy();
  });
});
