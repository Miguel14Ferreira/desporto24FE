/** GIPHY media is displayed directly from its CDN; never copied to Jynlo R2. */
export interface GifChoice {
  id: string;
  title: string;
  previewUrl: string;
  downloadUrl: string;
  size: number;
  pageUrl: string;
  creator: string;
}

export interface GifTextMessage {
  id: string;
  pageUrl: string;
  creator: string;
  caption: string;
}

const PAGE_SIZE = 18;
const MARKER = '[JYNLO:GIPHY:1]';

function safeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const uri = new URL(value);
    return uri.protocol === 'https:' && !uri.username && !uri.password && !uri.port
      && (/^media\d*\.giphy\.com$/.test(uri.hostname) || uri.hostname === 'i.giphy.com')
      ? value : '';
  } catch { return ''; }
}
function safePageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const uri = new URL(value);
    return uri.protocol === 'https:' && !uri.username && !uri.password && !uri.port
      && (uri.hostname === 'giphy.com' || uri.hostname === 'www.giphy.com')
      && uri.pathname.startsWith('/gifs/') ? value : '';
  } catch { return ''; }
}

export function parseGiphyResults(raw: unknown): GifChoice[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).data)) return [];
  const seen = new Set<string>();
  return (raw as any).data.flatMap((item: any): GifChoice[] => {
    if (typeof item?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)
        || seen.has(item.id)) return [];
    const images = item.images || {};
    const mediaUrl = safeMediaUrl(images.downsized?.url)
      || safeMediaUrl(images.fixed_width?.url)
      || safeMediaUrl(images.original?.url);
    const previewUrl = safeMediaUrl(images.fixed_width?.url) || mediaUrl;
    const pageUrl = safePageUrl(item.url);
    if (!mediaUrl || !previewUrl || !pageUrl) return [];
    seen.add(item.id);
    return [{
      id: item.id, title: String(item.title || 'GIF').slice(0, 110),
      previewUrl, downloadUrl: mediaUrl, pageUrl,
      creator: String(item.username || 'GIPHY').slice(0, 60),
      size: Number(images.downsized?.size) || 0
    }];
  });
}

/** A text message with a strict typed payload; only GIPHY-hosted URLs are rendered. */
export function encodeGiphyText(choice: GifChoice, caption: string): string {
  if (!safeMediaUrl(choice.downloadUrl) || !safePageUrl(choice.pageUrl)
      || !/^[a-zA-Z0-9_-]{1,80}$/.test(choice.id)) return '';
  const text = MARKER + JSON.stringify({
    id: choice.id, p: choice.pageUrl,
    a: choice.creator.slice(0, 60), c: caption
  });
  return text.length <= 2000 ? text : '';
}

export function readGiphyText(raw: string | null | undefined): GifTextMessage | null {
  if (!raw || !raw.startsWith(MARKER) || raw.length > 2000) return null;
  try {
    const data = JSON.parse(raw.slice(MARKER.length));
    if (!data || typeof data !== 'object' || typeof data.id !== 'string'
        || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.id)
        || typeof data.a !== 'string' || data.a.length > 60
        || typeof data.c !== 'string' || data.c.length > 1900
        || !safePageUrl(data.p)) return null;
    return { id: data.id, pageUrl: data.p, creator: data.a, caption: data.c };
  } catch { return null; }
}

export async function readGifProviderKey(signal?: AbortSignal): Promise<string> {
  const response = await fetch('/assets/giphy-config.json', {signal, cache: 'no-store'});
  if (!response.ok) return '';
  const config = await response.json();
  const key = typeof config?.apiKey === 'string' ? config.apiKey.trim() : '';
  return /^[a-zA-Z0-9_-]{12,128}$/.test(key) ? key : '';
}

export async function findGiphy(
  apiKey: string, phrase: string, offset: number, signal: AbortSignal,
  language: 'pt' | 'en'
): Promise<{results: GifChoice[]; hasMore: boolean}> {
  if (!/^[a-zA-Z0-9_-]{12,128}$/.test(apiKey)) throw new Error('GIPHY key unavailable');
  const query = phrase.trim().slice(0, 50);
  const endpoint = query ? 'search' : 'trending';
  const params = new URLSearchParams({
    api_key: apiKey, limit: String(PAGE_SIZE), offset: String(Math.max(0, offset)),
    rating: 'g', lang: language
  });
  if (query) params.set('q', query);
  // GIPHY requires direct browser API requests; do not proxy via Jynlo backend.
  const response = await fetch('https://api.giphy.com/v1/gifs/' + endpoint
    + '?' + params.toString(), {signal, credentials: 'omit'});
  if (!response.ok) throw new Error('GIPHY search failed');
  const json = await response.json();
  const results = parseGiphyResults(json);
  const total = Number(json?.pagination?.total_count);
  return {results, hasMore: results.length > 0 && Number.isFinite(total)
    && offset + PAGE_SIZE < total && offset + PAGE_SIZE < 90};
}
