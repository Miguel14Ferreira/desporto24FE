import { buildCommunityGroupInviteUrl, buildWhatsAppGroupShareUrl } from './community-group-invite';
import { appTranslate, I18nService } from '../../i18n/i18n.service';

describe('Community WhatsApp group invites', () => {
  it('replaces the community name in both PT and EN before WhatsApp encoding', () => {
    const originalLanguage = localStorage.getItem('d24-language');
    try {
      const link = buildCommunityGroupInviteUrl('https://d24sports.com', 4);
      for (const language of ['pt', 'en']) {
        localStorage.setItem('d24-language', language);
        const message = [
          appTranslate('communities.whatsappShareMessage', { name: 'Futebol de Amigos' }),
          appTranslate('communities.whatsappSharePrivate'),
          link
        ].join('\n\n');
        const encoded = buildWhatsAppGroupShareUrl(message);
        const decoded = new URL(encoded).searchParams.get('text') || '';
        expect(decoded).toContain('Futebol de Amigos');
        expect(decoded).toContain('/menu/communities/4');
        expect(decoded).not.toContain('{name}');
      }
    } finally {
      if (originalLanguage == null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', originalLanguage);
    }
  });

  it('replaces both the private invite-step name and the missing-player count', () => {
    const originalLanguage = localStorage.getItem('d24-language');
    try {
      for (const language of ['pt', 'en']) {
        localStorage.setItem('d24-language', language);
        const name = appTranslate('communityInviteStep.message', { name: 'Os Verdes' });
        const spots = appTranslate('communities.spotsMissing', { count: 3 });
        expect(name).toContain('Os Verdes');
        expect(name).not.toContain('{{name}}');
        expect(spots).toContain('3');
        expect(spots).not.toContain('{count}');
      }
    } finally {
      if (originalLanguage == null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', originalLanguage);
    }
  });

  it('uses the same placeholder rules in I18nService.translate', () => {
    const service = new I18nService();
    expect(service.translate('communities.whatsappShareMessage', { name: 'CNG' })).toContain('CNG');
  });

  it('creates an absolute community link with no personal data or join bypass', () => {
    expect(buildCommunityGroupInviteUrl('https://d24sports.com', 42))
      .toBe('https://d24sports.com/menu/communities/42');
  });

  it('uses the active domain, including preview environments', () => {
    expect(buildCommunityGroupInviteUrl('https://example.test:4200', 7))
      .toBe('https://example.test:4200/menu/communities/7');
  });

  it('encodes the full invite text and link for WhatsApp share', () => {
    const message = 'Junta-te ao Futebol das Quintas!\nhttps://d24sports.com/menu/communities/42';
    const url = buildWhatsAppGroupShareUrl(message);
    expect(url).toBe('https://wa.me/?text=' + encodeURIComponent(message));
    expect(new URL(url).searchParams.get('text')).toBe(message);
  });
});
