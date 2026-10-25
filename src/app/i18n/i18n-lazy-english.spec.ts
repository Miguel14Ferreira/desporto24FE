import {
  appTranslate,
  I18nService,
  preloadEnglishTranslations,
  prepareInitialTranslations
} from './i18n.service';

describe('Lazy English translations', () => {
  let originalLanguage: string | null;

  beforeEach(() => {
    originalLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
  });

  afterEach(() => {
    if (originalLanguage === null) {
      localStorage.removeItem('d24-language');
    } else {
      localStorage.setItem('d24-language', originalLanguage);
    }
  });

  it('renders Portuguese synchronously before loading the English chunk', () => {
    expect(appTranslate('session.join')).toBe('Juntar-me à sessão');
    expect(appTranslate('missing.localization.key')).toBe('missing.localization.key');
  });

  it('preloads the English dictionary before the initial English screen', async () => {
    localStorage.setItem('d24-language', 'en');
    await prepareInitialTranslations();

    expect(appTranslate('session.join')).toBe('Join session');
    expect(appTranslate('missing.localization.key')).toBe('missing.localization.key');
  });

  it('preserves synchronous English lookups and placeholder substitutions', async () => {
    await preloadEnglishTranslations();
    localStorage.setItem('d24-language', 'en');

    const service = new I18nService();
    expect(service.currentLanguage).toBe('en');
    expect(service.translate('session.join')).toBe('Join session');
    expect(appTranslate('session.join')).toBe('Join session');

    service.setLanguage('pt');
    expect(service.currentLanguage).toBe('pt');
    expect(service.translate('session.join')).toBe('Juntar-me à sessão');
  });

  it('activates English after a user changes language at runtime', async () => {
    localStorage.setItem('d24-language', 'pt');
    const service = new I18nService();

    service.setLanguage('en');
    await preloadEnglishTranslations();
    await Promise.resolve();

    expect(service.currentLanguage).toBe('en');
    expect(service.translate('session.join')).toBe('Join session');
    expect(localStorage.getItem('d24-language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('does not preload English for a Portuguese visitor', async () => {
    await prepareInitialTranslations();
    expect(localStorage.getItem('d24-language')).toBe('pt');
    expect(appTranslate('session.join')).toBe('Juntar-me à sessão');
  });
});
