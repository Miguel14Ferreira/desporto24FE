/** Reads only actual clipboard file items (never untrusted HTML/data URLs).
 * A paste stages one image; callers decide when to upload via authorized APIs.
 */
export function readPastedChatImage(
  data: DataTransfer | null | undefined, timestamp = Date.now()
): File | null {
  if (!data) return null;
  const items = Array.from(data.items ?? []);
  const item = items.find(candidate => candidate.kind === 'file'
    && candidate.type.toLowerCase().startsWith('image/'));
  const file = item?.getAsFile() ?? Array.from(data.files ?? [])
    .find(candidate => candidate.type.toLowerCase().startsWith('image/')) ?? null;
  if (!file) return null;
  const extension: Record<string,string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif'
  };
  const mime = file.type.toLowerCase();
  // Unsupported image types still reach the existing validation and produce
  // a useful error instead of silently being pasted as raw browser markup.
  return new File([file], 'imagem-colada-' + timestamp + '.' + (extension[mime] ?? 'img'),
    {type: mime});
}
