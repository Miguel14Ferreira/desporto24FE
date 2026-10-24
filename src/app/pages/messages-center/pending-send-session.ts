/**
 * Tab-local recovery for HTTP POSTs whose delivery is not yet confirmed.
 *
 * This holds message text briefly in sessionStorage. Unlike localStorage it
 * normally survives reload in the same tab but not a closed browser session.
 * No bearer token, JWT, or password is written to storage.
 */
export interface RecoverableSend {
  key: string;
  text: string;
  replyToMessageId: number | null;
  knownIds: Set<number>;
  startedAt: number;
}

const STORAGE_KEY = 'jynlo.chat.uncertain-posts.v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 40;
const MAX_KNOWN_IDS = 1000;

function validKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length > 145) return false;
  const match = /^(direct|community|session):(.+)$/.exec(key);
  if (!match || match[2].length > 128) return false;
  if (match[1] === 'direct') return !/[\x00-\x1f]/.test(match[2]);
  return /^[1-9]\d*$/.test(match[2]) && Number.isSafeInteger(Number(match[2]));
}

/** Non-secret login partition key. This is an identifier, not a security MAC. */
function sessionScope(username: string, token: string): string {
  const normalized = username.trim().toLowerCase();
  let first = 2166136261, second = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ (code + i), 2246822519);
  }
  return normalized + ':' + (first >>> 0).toString(16) + ':' + (second >>> 0).toString(16);
}

function validSend(value: any, now: number): value is {
  key: string; text: string; replyToMessageId: number | null;
  knownIds: number[]; startedAt: number;
} {
  return !!value && validKey(value.key)
    && typeof value.text === 'string'
    && value.text.length > 0 && value.text.length <= 2000
    && value.text.trim() === value.text
    && Number.isSafeInteger(value.startedAt)
    && value.startedAt > now - MAX_AGE_MS && value.startedAt <= now + 5_000
    && (value.replyToMessageId === null
      || (Number.isSafeInteger(value.replyToMessageId) && value.replyToMessageId > 0))
    && Array.isArray(value.knownIds) && value.knownIds.length <= MAX_KNOWN_IDS
    && value.knownIds.every((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0);
}

/** Reject unreadable, expired, or other-session data without exposing text. */
export function restorePendingSends(username: string, token: string): RecoverableSend[] {
  if (!username || !token) return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw);
    if (!stored || stored.version !== 1
      || stored.scope !== sessionScope(username, token)
      || !Array.isArray(stored.entries) || stored.entries.length > MAX_ENTRIES) {
      sessionStorage.removeItem(STORAGE_KEY);
      return [];
    }
    const result: RecoverableSend[] = [];
    const used = new Set<string>();
    const now = Date.now();
    for (const entry of stored.entries) {
      if (!validSend(entry, now) || used.has(entry.key)) continue;
      used.add(entry.key);
      result.push({key: entry.key, text: entry.text,
        replyToMessageId: entry.replyToMessageId,
        knownIds: new Set(entry.knownIds), startedAt: entry.startedAt});
    }
    // Invalid or expired entries must not remain recoverable in this tab.
    if (result.length !== stored.entries.length) savePendingSends(username, token, result);
    return result;
  } catch {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* restricted storage */ }
    return [];
  }
}

export function savePendingSends(username: string, token: string, values: Iterable<RecoverableSend>): void {
  if (!username || !token) return;
  try {
    const now = Date.now();
    const entries = Array.from(values)
      .filter(v => validKey(v.key) && v.text.length > 0 && v.text.length <= 2000
        && v.startedAt > now - MAX_AGE_MS && v.startedAt <= now + 5_000)
      .slice(-MAX_ENTRIES)
      .map(v => ({key:v.key, text:v.text, replyToMessageId:v.replyToMessageId,
        knownIds:Array.from(v.knownIds).filter(id=>Number.isSafeInteger(id) && id > 0)
          .slice(-MAX_KNOWN_IDS), startedAt:v.startedAt}));
    if (!entries.length) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version:1, scope:sessionScope(username, token), entries
    }));
  } catch {
    // Storage may be disabled/full. Keep in-memory recovery functional.
  }
}
