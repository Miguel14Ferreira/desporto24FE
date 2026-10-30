import { appTranslate as t } from '../../i18n/i18n.service';

describe('Community value proposition copy', () => {
  const keys = [
    'communities.pitchEyebrow',
    'communities.pitchTitle',
    'communities.pitchLead',
    'communities.pitchPromise',
    'communities.pitchCreate',
    'communities.pitchExplore',
    'communities.pitchOnboarding',
    'communities.pitchBenefitsLabel',
    'communities.pitchGamesTitle',
    'communities.pitchGamesText',
    'communities.pitchSeasonsTitle',
    'communities.pitchSeasonsText',
    'communities.pitchTournamentsTitle',
    'communities.pitchTournamentsText',
    'communities.pitchRankingsTitle',
    'communities.pitchRankingsText',
    'communities.pitchGroupTitle',
    'communities.pitchGroupText'
  ];
  let previousLanguage: string | null;

  beforeEach(() => previousLanguage = localStorage.getItem('d24-language'));
  afterEach(() => {
    if (previousLanguage === null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', previousLanguage);
  });

  for (const language of ['pt', 'en']) {
    it('provides every value proposition label in ' + language, () => {
      localStorage.setItem('d24-language', language);
      for (const key of keys) {
        expect(t(key)).withContext(key).not.toBe(key);
        expect(t(key).trim().length).withContext(key).toBeGreaterThan(0);
      }
    });
  }

  it('highlights tournaments in both languages while keeping invitation guidance', () => {
    for (const language of ['pt', 'en']) {
      localStorage.setItem('d24-language', language);
      const lead = t('communities.pitchLead').toLowerCase();
      const title = t('communities.pitchTournamentsTitle').toLowerCase();
      expect(lead).toContain(language === 'pt' ? 'torneios' : 'tournaments');
      expect(title).toContain(language === 'pt' ? 'torneios' : 'tournaments');
      expect(t('communityInviteStep.tournamentNotice')).not.toBe('communityInviteStep.tournamentNotice');
    }
  });

  it('describes invitation by link without promising WhatsApp contact import', () => {
    localStorage.setItem('d24-language', 'pt');
    expect(t('communities.pitchLead')).toContain('WhatsApp');
    expect(t('communities.pitchOnboarding')).toContain('partilha a ligação');
    expect(t('communities.pitchOnboarding')).toContain('escolhe aderir');
    expect(t('communities.pitchPromise')).toContain('Menos confusão');
  });
});
