export function buildCommunityGroupInviteUrl(origin: string, communityId: number): string {
  return new URL('/menu/communities/' + communityId, origin).toString();
}

export function buildWhatsAppGroupShareUrl(message: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(message);
}
