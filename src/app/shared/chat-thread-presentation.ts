import { appTranslate as t } from '../i18n/i18n.service';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function timeOf(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = /^\\d{13}$/.test(value.trim())
    ? Number(value.trim()) : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function localDay(time: number): string {
  const date = new Date(time);
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
}

/** A separator only appears at the start of each local calendar day. */
export function chatDaySeparator(current: unknown, previous?: unknown,
                                 now: Date = new Date()): string {
  const time = timeOf(current);
  if (time === null) return '';
  const before = timeOf(previous);
  if (before !== null && localDay(time) === localDay(before)) return '';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(new Date(time).getFullYear(), new Date(time).getMonth(),
    new Date(time).getDate());
  const dayDelta = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (dayDelta === 0) return t('chat.dayToday');
  if (dayDelta === 1) return t('chat.dayYesterday');
  const locale = typeof localStorage !== 'undefined' && localStorage.getItem('d24-language') === 'en'
    ? 'en-GB' : 'pt-PT';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(time));
}

/** Consecutive messages by the same author within five minutes form one visual group. */
export function chatContinuesGroup(currentSender: string | null | undefined,
                                   currentTime: unknown,
                                   previousSender: string | null | undefined,
                                   previousTime: unknown): boolean {
  if (!currentSender || !previousSender
      || currentSender.toLocaleLowerCase() !== previousSender.toLocaleLowerCase()) return false;
  const now = timeOf(currentTime), before = timeOf(previousTime);
  if (now === null || before === null || localDay(now) !== localDay(before)) return false;
  return now >= before && now - before <= GROUP_WINDOW_MS;
}
