const REGISTRATION_DESTINATION_KEY = 'jynlo-registration-destination';
const REGISTRATION_DESTINATION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_DESTINATION_PATTERN = /^\/menu\/events\/[1-9]\d*$/;

export function rememberRegistrationDestination(value: string | null): void {
  try {
    localStorage.removeItem(REGISTRATION_DESTINATION_KEY);
    if (value && SESSION_DESTINATION_PATTERN.test(value)) {
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
      && SESSION_DESTINATION_PATTERN.test(destination.url)
      && typeof destination.expiresAt === 'number'
      && Number.isFinite(destination.expiresAt)
      && destination.expiresAt > Date.now()
      ? destination.url
      : null;
  } catch {
    return null;
  }
}
