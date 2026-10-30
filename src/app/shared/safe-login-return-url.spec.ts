import { safeLoginReturnUrl } from './safe-login-return-url';

describe('safeLoginReturnUrl', () => {
  it('preserves valid internal session links and query parameters', () => {
    expect(safeLoginReturnUrl('/menu/events/42')).toBe('/menu/events/42');
    expect(safeLoginReturnUrl('/menu/communities/42')).toBe('/menu/communities/42');
    expect(safeLoginReturnUrl('/menu/notifications?view=requests'))
      .toBe('/menu/notifications?view=requests');
  });

  it('permits only a strict same-app guest link after login', () => {
    const link='/sessions/42?guest='+'A'.repeat(43);
    expect(safeLoginReturnUrl(link)).toBe(link);
    expect(safeLoginReturnUrl(link+'&next=https://evil.test')).toBe('/menu/feed');
    expect(safeLoginReturnUrl('/sessions/42?guest=bad')).toBe('/menu/feed');
  });

  it('defaults to the feed when the link is absent', () => {
    expect(safeLoginReturnUrl(null)).toBe('/menu/feed');
  });

  it('rejects external and malformed routes', () => {
    for (const target of [
      'https://example.com',
      '//example.com',
      '/login',
      '/menu/../login',
      '/menu//events/42',
      '/menu/%2e%2e/login',
      '/menu/events%2f42',
      '/menu/events\\42'
    ]) {
      expect(safeLoginReturnUrl(target)).toBe('/menu/feed');
    }
  });
});
