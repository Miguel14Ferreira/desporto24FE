/** Only internal authenticated routes may be used as post-login destinations. */
export function safeLoginReturnUrl(value: string | null): string {
  if (!value) {
    return '/menu/feed';
  }

  const path = value.split(/[?#]/)[0];
  const validMenuPath = path === '/menu' || path.startsWith('/menu/');
  // Only strict organizer-issued guest links may return to a public page.
  const validGuestReturn = /^\\/sessions\\/[1-9]\\d*\\?guest=[A-Za-z0-9_-]{43}$/.test(value);
  const hasUnsafeSegments = path.split('/').some(segment =>
    segment === '.' || segment === '..'
  );
  if (!(validMenuPath || validGuestReturn)
      || path.includes('//')
      || hasUnsafeSegments
      || /[\\\u0000-\u001f\u007f]/.test(value)
      || /%(?:2f|5c|2e|00|0a|0d)/i.test(path)) {
    return '/menu/feed';
  }

  return value;
}
