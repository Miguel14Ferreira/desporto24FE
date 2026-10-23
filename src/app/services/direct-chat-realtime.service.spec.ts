import { DirectChatMessage } from '../pages/model/direct-chat';
import { normalizeDirectChatRealtimeMessage } from './direct-chat-realtime.service';

describe('Direct chat WebSocket timestamps', () => {
  const message: DirectChatMessage = {
    id: 42,
    username1: 'jynloteste01',
    username2: 'jynloteste02',
    text: 'Olá em tempo real',
    date: null,
    dataDisplay: null
  };
  const iso = '2026-10-23T11:52:00.000Z';

  it('converts the Java Date epoch milliseconds from the WebSocket to ISO', () => {
    const incoming = { ...message, date: Date.parse(iso) as unknown as string };
    const normalized = normalizeDirectChatRealtimeMessage(incoming);
    expect(normalized.date).toBe(iso);
    expect(normalized.id).toBe(42);
    expect(normalized.text).toBe(message.text);
    expect(Date.parse(normalized.date!)).toBe(Date.parse(iso));
  });

  it('also handles a decimal millisecond timestamp string without changing the message', () => {
    const incoming = { ...message, date: String(Date.parse(iso)) };
    expect(normalizeDirectChatRealtimeMessage(incoming).date).toBe(iso);
    expect(incoming.date).toBe(String(Date.parse(iso)));
  });

  it('preserves already ISO-serialized dates and absent dates', () => {
    const withIso = { ...message, date: iso };
    expect(normalizeDirectChatRealtimeMessage(withIso)).toBe(withIso);
    expect(normalizeDirectChatRealtimeMessage(message)).toBe(message);
  });

  it('does not invent a timestamp for invalid numeric events', () => {
    const invalid = { ...message, date: Number.NaN as unknown as string };
    expect(normalizeDirectChatRealtimeMessage(invalid).date).toBeNull();
    const infinite = { ...message, date: Number.POSITIVE_INFINITY as unknown as string };
    expect(normalizeDirectChatRealtimeMessage(infinite).date).toBeNull();
  });
});
