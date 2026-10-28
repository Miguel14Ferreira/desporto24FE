/** Presentation-only mapping for notification summaries and inbox list cards.
 * Never parse, render or fetch remote GIF payloads in previews. */
export type ChatMediaPreviewKind = 'gif' | 'photo' | 'voice' | 'document' | 'attachment';

export function chatMediaPreviewKind(raw: string | null | undefined): ChatMediaPreviewKind | null {
  if (!raw) return null;
  if (raw.startsWith('[JYNLO:GIPHY:1]') || raw === '🎞️ GIF') return 'gif';
  if (raw === '🖼️ Fotografia') return 'photo';
  if (raw === '🎤 Mensagem de voz') return 'voice';
  if (raw === '📄 Documento') return 'document';
  if (raw === '📎 Anexo') return 'attachment';
  return null;
}

export function chatMediaPreviewForAttachment(mime: string | null | undefined): ChatMediaPreviewKind | null {
  if (!mime) return null;
  const type = mime.toLowerCase();
  if (type === 'image/gif') return 'gif';
  if (type.startsWith('image/')) return 'photo';
  if (type === 'audio/webm' || type === 'audio/ogg') return 'voice';
  if (type === 'application/pdf') return 'document';
  return 'attachment';
}

export function chatMediaPreviewKey(
  raw: string | null | undefined,
  username: string | null | undefined
): string | null {
  const kind = chatMediaPreviewKind(raw);
  if (!kind) return null;
  if (kind === 'gif') return username?.trim()
    ? 'notification.chatGifPreviewWithSender' : 'notification.chatGifPreview';
  return 'notification.chatMedia.' + kind + (username?.trim() ? '.withSender' : '');
}
