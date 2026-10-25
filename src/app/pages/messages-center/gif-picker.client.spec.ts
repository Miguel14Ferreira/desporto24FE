import { downloadGiphyChoice, findGiphy, parseGiphyResults, readGifProviderKey } from './gif-picker.client';

describe('GIPHY picker security and search', () => {
  const preview = 'https://media0.giphy.com/media/123/giphy.gif';
  const sample = (id: string, url = preview, size = '1024') => ({
    id, title: 'Celebration', images: {
      fixed_width: {url, size},
      downsized: {url, size}
    }
  });

  it('accepts only whitelisted HTTPS GIPHY media and size-limited GIFs', () => {
    const parsed = parseGiphyResults({data: [
      sample('safe'), sample('safe'),
      sample('oversize', preview, '5242881'),
      sample('external', 'https://example.com/fake.gif'),
      sample('http', 'http://media0.giphy.com/fake.gif')
    ]});
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('safe');
    expect(parsed[0].size).toBe(1024);
  });

  it('never queries remote provider without a configured browser key', async () => {
    const network = spyOn(window, 'fetch').and.resolveTo(new Response(
      JSON.stringify({apiKey: ''}), {status: 200, headers: {'Content-Type':'application/json'}}
    ));
    const key = await readGifProviderKey();
    expect(key).toBe('');
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('searches direct from browser with safe rating, bounded query and no credentials', async () => {
    const network = spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      data: [sample('success')],
      pagination: {total_count: 18}
    }), {status: 200, headers: {'Content-Type':'application/json'}}));
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

  it('converts only valid, less-than-5 MB remote GIF bytes to a local draft File', async () => {
    const network = spyOn(window, 'fetch').and.resolveTo(new Response(
      new Blob(['GIF89a','frame'], {type: 'image/gif'}), {status:200}
    ));
    const file = await downloadGiphyChoice({
      id:'test', title:'Test', previewUrl:preview, downloadUrl:preview, size:100
    }, new AbortController().signal);
    expect(file.name).toBe('giphy-test.gif');
    expect(file.type).toBe('image/gif');
    expect(file.size).toBe(11);
    expect(network).toHaveBeenCalledTimes(1);
    expect((network.calls.mostRecent().args[1] as RequestInit).credentials).toBe('omit');
  });

  it('refuses a forged remote GIF and an oversized response', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(new Blob(['not-gif'],
      {type:'image/gif'}), {status:200}));
    await expectAsync(downloadGiphyChoice({
      id:'test',title:'Fake',previewUrl:preview,downloadUrl:preview,size:150
    }, new AbortController().signal)).toBeRejected();
    await expectAsync(downloadGiphyChoice({
      id:'test',title:'Large',previewUrl:preview,downloadUrl:preview,size:6000000
    }, new AbortController().signal)).toBeRejected();
  });
});
