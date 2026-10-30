import { readPastedChatImage } from './chat-clipboard-image';

describe('chat image paste from clipboard', () => {
  const clipboard = (file: File | null, type = file?.type ?? ''): DataTransfer =>
    ({items: [{kind:'file', type, getAsFile: () => file}], files: []}) as unknown as DataTransfer;

  it('reads an image file and supplies a predictable safe filename', () => {
    const screenshot = new File(['image'], 'not-reliable-name', {type:'image/png'});
    const result = readPastedChatImage(clipboard(screenshot), 123);
    expect(result?.type).toBe('image/png');
    expect(result?.name).toBe('imagem-colada-123.png');
    expect(result?.size).toBe(screenshot.size);
  });
  it('accepts JPEG/WebP/GIF and fallback clipboard files from browsers', () => {
    for (const [mime,ext] of [['image/jpeg','jpg'], ['image/webp','webp'], ['image/gif','gif']]) {
      const file = new File(['x'],'test',{type:mime});
      expect(readPastedChatImage(clipboard(file), 99)?.name).toBe('imagem-colada-99.'+ext);
    }
    const file = new File(['x'],'camera.png',{type:'image/png'});
    expect(readPastedChatImage({items:[],files:[file]} as unknown as DataTransfer)?.type).toBe('image/png');
  });
  it('never consumes copied plain text, HTML or empty clipboard data', () => {
    expect(readPastedChatImage(null)).toBeNull();
    expect(readPastedChatImage({items:[{kind:'string',type:'text/html',getAsFile:()=>null}],
      files:[]} as unknown as DataTransfer)).toBeNull();
  });
});
