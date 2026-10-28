import {
  chatMediaPreviewKind, chatMediaPreviewForAttachment, chatMediaPreviewKey
} from './chat-media-preview';

describe('Safe chat media previews', () => {
  it('classifies GIF envelopes without exposing IDs or JSON', () => {
    const raw = '[JYNLO:GIPHY:1]{"id":"XdUMQuuiaAEkOUtezd","p":"https://giphy.com/gifs/demo"}';
    expect(chatMediaPreviewKind(raw)).toBe('gif');
    expect(chatMediaPreviewKind('[JYNLO:GIPHY:1]{broken-json}')).toBe('gif');
    expect(chatMediaPreviewKey(raw, 'ana')).toBe('notification.chatGifPreviewWithSender');
    expect(chatMediaPreviewKey('🎞️ GIF', null)).toBe('notification.chatGifPreview');
  });

  it('maps media summaries in notifications, keeping normal messages unchanged', () => {
    expect(chatMediaPreviewKey('🖼️ Fotografia', 'ana'))
      .toBe('notification.chatMedia.photo.withSender');
    expect(chatMediaPreviewKey('🎤 Mensagem de voz', undefined))
      .toBe('notification.chatMedia.voice');
    expect(chatMediaPreviewKey('📄 Documento', 'ana'))
      .toBe('notification.chatMedia.document.withSender');
    expect(chatMediaPreviewKey('📎 Anexo', 'ana'))
      .toBe('notification.chatMedia.attachment.withSender');
    expect(chatMediaPreviewKind('Vamos jogar amanhã?')).toBeNull();
    expect(chatMediaPreviewKind('Olá! 😀')).toBeNull();
    expect(chatMediaPreviewKind('📎 um-anexo.pdf')).toBeNull();
  });

  it('classifies only verified MIME media types for real-time matching', () => {
    expect(chatMediaPreviewForAttachment('image/gif')).toBe('gif');
    expect(chatMediaPreviewForAttachment('image/jpeg')).toBe('photo');
    expect(chatMediaPreviewForAttachment('audio/webm')).toBe('voice');
    expect(chatMediaPreviewForAttachment('audio/ogg')).toBe('voice');
    expect(chatMediaPreviewForAttachment('application/pdf')).toBe('document');
    expect(chatMediaPreviewForAttachment('application/octet-stream')).toBe('attachment');
    expect(chatMediaPreviewForAttachment(null)).toBeNull();
  });
});
