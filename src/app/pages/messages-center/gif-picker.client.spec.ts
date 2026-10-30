import { encodeGiphyText, findGiphy, parseGiphyResults, readGifProviderKey, readGiphyText } from './gif-picker.client';

describe('GIPHY picker security and search', () => {
  const preview = 'https://media0.giphy.com/media/123/giphy.gif';
  const sample = (id: string, url = preview, size = '1024') => ({
    id, url: 'https://giphy.com/gifs/' + id, title: 'Celebration',
    username: 'gif_creator', images: {
      fixed_width: {url, size}, downsized: {url, size}
    }
  });

  it('accepts only whitelisted HTTPS GIPHY media and valid source pages', () => {
    const parsed = parseGiphyResults({data: [
      sample('safe'), sample('safe'),
      sample('external', 'https://example.com/fake.gif'),
      sample('http', 'http://media0.giphy.com/fake.gif'),
      {...sample('fakePage'), url:'https://example.com/gifs/fakePage'}
    ]});
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('safe');
    expect(parsed[0].creator).toBe('gif_creator');
    expect(parsed[0].pageUrl).toBe('https://giphy.com/gifs/safe');
  });

  it('never queries a remote provider without a configured browser-side key', async () => {
    const network = spyOn(window, 'fetch').and.resolveTo(new Response(
      JSON.stringify({apiKey: ''}), {status:200}
    ));
    expect(await readGifProviderKey()).toBe('');
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('searches from browser with safe rating, bounded query and without credentials', async () => {
    const network = spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      data: [sample('success')], pagination: {total_count: 18}
    }), {status:200}));
    const result = await findGiphy('VALID_GIPHY_CLIENT_KEY', 'futebol & gol',
      0, new AbortController().signal, 'pt');
    expect(result.results.length).toBe(1);
    expect(result.hasMore).toBeFalse();
    const uri = new URL(network.calls.mostRecent().args[0] as string);
    expect(uri.origin).toBe('https://api.giphy.com');
    expect(uri.pathname).toBe('/v1/gifs/search');
    expect(uri.searchParams.get('q')).toBe('futebol & gol');
    expect(uri.searchParams.get('rating')).toBe('g');
    expect(uri.searchParams.get('lang')).toBe('pt');
    expect((network.calls.mostRecent().args[1] as RequestInit).credentials).toBe('omit');
  });

  it('encodes validated remote GIF references without copying media bytes', () => {
    const choice = parseGiphyResults({data:[sample('safe') ]})[0];
    const text = encodeGiphyText(choice, 'Golo!');
    expect(text.startsWith('[JYNLO:GIPHY:1]')).toBeTrue();
    expect(readGiphyText(text)).toEqual({
      id:'safe',pageUrl:'https://giphy.com/gifs/safe',
      creator:'gif_creator',caption:'Golo!'
    });
    expect(text).not.toContain('media0.giphy.com');
    expect(encodeGiphyText(choice, 'x'.repeat(1950))).toBe('');
  });

  it('does not render forged remote GIF links as images', () => {
    const choice = parseGiphyResults({data:[sample('safe')]})[0];
    const valid = encodeGiphyText(choice, '');
    expect(readGiphyText(valid.replace('giphy.com/gifs/', 'example.com/gifs/'))).toBeNull();
    expect(readGiphyText(valid.replace('"id":"safe"', '"id":"<script>"'))).toBeNull();
    expect(readGiphyText(valid.replace('https:', 'javascript:'))).toBeNull();
    expect(readGiphyText('not a GIF')).toBeNull();
  });
});
