import { chatContinuesGroup, chatDaySeparator } from './chat-thread-presentation';

describe('Chat thread presentation', () => {
  const now = new Date('2026-10-23T12:00:00');
  const local = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m - 1, d, h, min).toISOString();

  it('uses local calendar-day boundaries, including a changing month', () => {
    const prev = local(2026, 10, 22, 23, 59);
    const next = local(2026, 10, 23, 0, 1);
    expect(chatDaySeparator(next, prev, now)).toBe('Hoje');
    expect(chatDaySeparator(prev, local(2026, 10, 22, 9, 0), now)).toBe('');
    expect(chatDaySeparator(prev, undefined, now)).toBe('Ontem');
    expect(chatDaySeparator(local(2026, 9, 21, 9, 0), undefined, now)).toContain('2026');
  });

  it('never invents dates when older messages have missing or malformed timestamps', () => {
    expect(chatDaySeparator(null)).toBe('');
    expect(chatDaySeparator('broken')).toBe('');
    expect(chatDaySeparator('')).toBe('');
    expect(chatContinuesGroup('ana', null, 'ana', null)).toBeFalse();
  });

  it('groups only the same author within five minutes and on the same day', () => {
    const start = local(2026, 10, 22, 15, 0);
    expect(chatContinuesGroup('Ana', local(2026, 10, 22, 15, 4), 'ana', start)).toBeTrue();
    expect(chatContinuesGroup('ana', local(2026, 10, 22, 15, 6), 'ana', start)).toBeFalse();
    expect(chatContinuesGroup('bea', local(2026, 10, 22, 15, 1), 'ana', start)).toBeFalse();
    expect(chatContinuesGroup('ana', local(2026, 10, 23, 0, 1), 'ana',
      local(2026, 10, 22, 23, 59))).toBeFalse();
    expect(chatContinuesGroup('ana', start, 'ana', local(2026, 10, 22, 15, 1))).toBeFalse();
  });

  it('preserves date separators when a page of older messages is prepended', () => {
    const dates = [local(2026, 10, 21, 9, 0), local(2026, 10, 22, 12, 0),
      local(2026, 10, 22, 12, 1)];
    const labels = dates.map((day, i) => chatDaySeparator(day, dates[i - 1], now));
    expect(labels[0]).toBeTruthy();
    expect(labels[1]).toBe('Ontem');
    expect(labels[2]).toBe('');
  });
});
