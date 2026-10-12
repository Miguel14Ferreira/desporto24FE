const REGISTRATION_DESTINATION_KEY = 'jynlo-registration-destination';
const REGISTRATION_DESTINATION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_DESTINATION_PATTERN = /^\/menu\/events\/([1-9]\d*)$/;

export function registrationSessionId(returnUrl: string | null): number | null {
  const match = returnUrl?.match(SESSION_DESTINATION_PATTERN);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function registrationSessionReturnUrl(rawSessionId: string | null): string | null {
  if (!rawSessionId || !/^[1-9]\d*$/.test(rawSessionId)) {
    return null;
  }

  const returnUrl = '/menu/events/' + rawSessionId;
  return registrationSessionId(returnUrl) === null ? null : returnUrl;
}

export function rememberRegistrationDestination(value: string | null): void {
  try {
    localStorage.removeItem(REGISTRATION_DESTINATION_KEY);
    if (value && registrationSessionId(value) !== null) {
      localStorage.setItem(REGISTRATION_DESTINATION_KEY, JSON.stringify({
        url: value,
        expiresAt: Date.now() + REGISTRATION_DESTINATION_TTL_MS
      }));
    }
  } catch {
    // Storage can be disabled: registration must still work without a return URL.
  }
}

export function takeRegistrationDestination(): string | null {
  try {
    const saved = localStorage.getItem(REGISTRATION_DESTINATION_KEY);
    localStorage.removeItem(REGISTRATION_DESTINATION_KEY);
    if (!saved) {
      return null;
    }

    const destination = JSON.parse(saved);
    return typeof destination.url === 'string'
      && registrationSessionId(destination.url) !== null
      && typeof destination.expiresAt === 'number'
      && Number.isFinite(destination.expiresAt)
      && destination.expiresAt > Date.now()
      ? destination.url
      : null;
  } catch {
    return null;
  }
}
