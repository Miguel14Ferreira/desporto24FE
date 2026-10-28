import { playerAvatarInitials, playerAvatarUrl } from './player-avatar';

describe('player avatar presentation', () => {
  it('keeps trusted URLs and resolves API media paths', () => {
    expect(playerAvatarUrl('https://cdn.example.org/a.jpg','https://api.jynlo.test')).toBe('https://cdn.example.org/a.jpg');
    expect(playerAvatarUrl('/media/profiles/1.jpg','https://api.jynlo.test/')).toBe('https://api.jynlo.test/media/profiles/1.jpg');
  });
  it('never accepts arbitrary schemes or protocol-relative URLs', () => {
    expect(playerAvatarUrl('javascript:alert(1)','https://api.jynlo.test')).toBeNull();
    expect(playerAvatarUrl('//untrusted.example/img','https://api.jynlo.test')).toBeNull();
    expect(playerAvatarUrl(null,'https://api.jynlo.test')).toBeNull();
  });
  it('falls back to compact initials for historic players and guests', () => {
    expect(playerAvatarInitials('Afonso Salvador')).toBe('AS');
    expect(playerAvatarInitials('Ferreirinha')).toBe('F');
    expect(playerAvatarInitials('')).toBe('?');
  });
});
