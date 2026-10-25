/** GIPHY browser integration. No authentication tokens or private chat data are sent. */
export interface GifChoice {
  id: string;
  title: string;
  previewUrl: string;
  downloadUrl: string;
  size: number;
}

const MAX_GIF_BYTES = 5 * 1024 * 1024;
const PAGE_SIZE = 18;

function safeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const uri = new URL(value);
    return uri.protocol === 'https:' && !uri.username && !uri.password && !uri.port
      && (/^media\d*\.giphy\.com$/.test(uri.hostname) || uri.hostname === 'i.giphy.com')
      ? uri.toString() : '';
  } catch { return ''; }
}

export function parseGiphyResults(raw: unknown): GifChoice[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).data)) return [];
  const seen = new Set<string>();
  return (raw as any).data.flatMap((item: any): GifChoice[] => {
    if (typeof item?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)
        || seen.has(item.id)) return [];
    const images = item.images || {};
    const variants = [images.downsized, images.downsized_medium, images.fixed_width, images.original];
    const download = variants.find(variant => {
      const size = Number(variant?.size);
      return safeMediaUrl(variant?.url) && size > 0 && size <= MAX_GIF_BYTES;
    });
    const preview = safeMediaUrl(images.fixed_width?.url)
      || safeMediaUrl(images.downsized?.url);
    if (!download || !preview) return [];
    seen.add(item.id);
    return [{ id: item.id, title: String(item.title || 'GIF').slice(0, 110),
      previewUrl: preview, downloadUrl: safeMediaUrl(download.url),
      size: Number(download.size) }];
  });
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
  // GIPHY documents client-side Search requests, not a backend proxy.
  const response = await fetch('https://api.giphy.com/v1/gifs/' + endpoint
    + '?' + params.toString(), {signal, credentials: 'omit'});
  if (!response.ok) throw new Error('GIPHY search failed');
  const json = await response.json();
  const results = parseGiphyResults(json);
  const total = Number(json?.pagination?.total_count);
  return {results, hasMore: results.length > 0 && Number.isFinite(total)
    && offset + PAGE_SIZE < total && offset + PAGE_SIZE < 90};
}

export async function downloadGiphyChoice(choice: GifChoice, signal: AbortSignal): Promise<File> {
  const safeUrl = safeMediaUrl(choice.downloadUrl);
  if (!safeUrl || !(choice.size > 0 && choice.size <= MAX_GIF_BYTES))
    throw new Error('GIF URL or size not allowed');
  const response = await fetch(safeUrl, {
    signal, credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer'
  });
  const declared = Number(response.headers.get('content-length'));
  if (!response.ok || (declared > MAX_GIF_BYTES)) throw new Error('GIF too large');
  const blob = await response.blob();
  if (blob.size === 0 || blob.size > MAX_GIF_BYTES) throw new Error('GIF too large');
  // Verify GIF magic bytes, not just Content-Type from the remote CDN.
  const header = await blob.slice(0, 6).text();
  if (header !== 'GIF87a' && header !== 'GIF89a') throw new Error('Invalid GIF');
  return new File([blob], 'giphy-' + choice.id + '.gif', {type: 'image/gif'});
}
