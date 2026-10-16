import { buildCommunityGroupInviteUrl, buildWhatsAppGroupShareUrl } from './community-group-invite';

describe('Community WhatsApp group invites', () => {
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
