/** Presentation-only helper: never infer identity or replace persisted photo data. */
export function playerAvatarUrl(raw: string | null | undefined, apiUrl: string): string | null {
  const url = raw?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  // Photo paths created by the media service can be relative to the API.
  if (url.startsWith('/') && !url.startsWith('//')) return apiUrl.replace(/\/$/, '') + url;
  if (/^(?:media|uploads)\//i.test(url)) return apiUrl.replace(/\/$/, '') + '/' + url;
  return null;
}

export function playerAvatarInitials(name: string | null | undefined): string {
  // Parenthesised nicknames are annotations, not surname initials.
  // Preserve source/history names; this affects avatar presentation only.
  const sanitized = (name || '?').replace(/\([^)]*\)/g, ' ')
    .replace(/[()[\]{}]/g, ' ').trim();
  const words = sanitized.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word.charAt(0).toLocaleUpperCase()).join('') || '?';
}
