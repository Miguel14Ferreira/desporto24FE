import { DirectChatMessage } from '../pages/model/direct-chat';
import { chatReconnectDelayMs, DirectChatRealtimeService, normalizeDirectChatRealtimeMessage } from './direct-chat-realtime.service';
import { fakeAsync, tick } from '@angular/core/testing';

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


/** Browser-only fake socket: no real network and no persisted credentials. */
class RealtimeFakeSocket {
  static sockets: RealtimeFakeSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = RealtimeFakeSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: string[] = [];
  closeCalls = 0;
  constructor(readonly url: string) { RealtimeFakeSocket.sockets.push(this); }
  send(payload: string): void { this.sent.push(payload); }
  close(): void {
    this.closeCalls++;
    this.readyState = RealtimeFakeSocket.CLOSED;
  }
  open(): void {
    this.readyState = RealtimeFakeSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  receive(envelope: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(envelope) }));
  }
  closed(code = 1006): void {
    this.readyState = RealtimeFakeSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

describe('Chat WebSocket identity and reconnection', () => {
  let oldSocket: typeof WebSocket;
  let oldToken: string | null;
  let service: DirectChatRealtimeService;

  function qaToken(username: string): string {
    const payload = btoa(JSON.stringify({ sub: username, exp: 4102444800 }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.synthetic';
  }

  beforeEach(() => {
    oldSocket = window.WebSocket;
    oldToken = localStorage.getItem('t');
    (window as any).WebSocket = RealtimeFakeSocket;
    RealtimeFakeSocket.sockets = [];
    localStorage.setItem('t', qaToken('jynloteste01'));
    service = new DirectChatRealtimeService();
  });

  afterEach(() => {
    service.disconnect();
    (window as any).WebSocket = oldSocket;
    if (oldToken === null) localStorage.removeItem('t');
    else localStorage.setItem('t', oldToken);
    RealtimeFakeSocket.sockets = [];
  });

  it('requires successful AUTH before releasing any private chat event', () => {
    const received = jasmine.createSpy('received');
    let connected = false;
    service.messages$.subscribe(received);
    service.connected$.subscribe(value => connected = value);

    service.connect();
    const socket = RealtimeFakeSocket.sockets[0];
    expect(socket.url).toContain('/ws/chat');
    socket.open();
    expect(JSON.parse(socket.sent[0]).type).toBe('AUTH');
    expect(connected).toBeFalse();

    const message = { id: 42, username1: 'jynloteste01',
      username2: 'jynloteste02', text: 'QA', date: null, dataDisplay: null };
    socket.receive({ type: 'CHAT_MESSAGE', message });
    expect(received).not.toHaveBeenCalled();
    socket.receive({ type: 'AUTHENTICATED' });
    expect(connected).toBeTrue();
    socket.receive({ type: 'CHAT_MESSAGE', message });
    expect(received).toHaveBeenCalledTimes(1);
  });

  it('replaces a socket when the account token changes and ignores late old events', fakeAsync(() => {
    const old = localStorage.getItem('t');
    const received = jasmine.createSpy('received');
    let connected = false;
    service.messages$.subscribe(received);
    service.connected$.subscribe(value => connected = value);

    service.connect();
    const first = RealtimeFakeSocket.sockets[0];
    first.open();
    first.receive({ type: 'AUTHENTICATED' });
    expect(connected).toBeTrue();

    const tokenB = qaToken('jynloteste02');
    localStorage.setItem('t', tokenB);
    service.connect();
    expect(first.closeCalls).toBe(1);
    const second = RealtimeFakeSocket.sockets[1];
    expect(second).toBeDefined();
    expect(connected).toBeFalse();
    second.open();
    expect(JSON.parse(second.sent[0]).token).toBe(tokenB);
    second.receive({ type: 'AUTHENTICATED' });
    expect(connected).toBeTrue();

    // Chrome may deliver first.onclose after the new socket authenticated.
    first.closed();
    first.receive({ type: 'CHAT_MESSAGE', message: {
      id: 88, username1: 'jynloteste01', username2: 'jynloteste02',
      text: 'stale', date: null, dataDisplay: null
    } });
    expect(connected).toBeTrue();
    expect(received).not.toHaveBeenCalled();
    tick(6000);
    expect(RealtimeFakeSocket.sockets.length).toBe(2);
    expect(localStorage.getItem('t')).toBe(tokenB);
    expect(old).not.toBe(tokenB);
  }));

  it('backs off repeated failures, resets after AUTH, and cancels pending reconnect on logout', fakeAsync(() => {
    expect([0, 1, 2, 3, 4, 9].map(chatReconnectDelayMs))
      .toEqual([3000, 6000, 12000, 24000, 30000, 30000]);

    service.connect();
    RealtimeFakeSocket.sockets[0].closed();
    tick(2999);
    expect(RealtimeFakeSocket.sockets.length).toBe(1);
    tick(1);
    expect(RealtimeFakeSocket.sockets.length).toBe(2);
    RealtimeFakeSocket.sockets[1].closed();
    tick(5999);
    expect(RealtimeFakeSocket.sockets.length).toBe(2);
    tick(1);
    expect(RealtimeFakeSocket.sockets.length).toBe(3);
    const third = RealtimeFakeSocket.sockets[2];
    third.open();
    third.receive({ type: 'AUTHENTICATED' });
    third.closed();
    tick(3000);
    expect(RealtimeFakeSocket.sockets.length).toBe(4);

    RealtimeFakeSocket.sockets[3].closed();
    service.disconnect();
    tick(60000);
    expect(RealtimeFakeSocket.sockets.length).toBe(4);
  }));

  it('does not retry an explicit invalid-token close (gateway 1003)', fakeAsync(() => {
    service.connect();
    RealtimeFakeSocket.sockets[0].closed(1003);
    tick(60000);
    expect(RealtimeFakeSocket.sockets.length).toBe(1);
    service.connect();
    expect(RealtimeFakeSocket.sockets.length).toBe(2);
  }));
});
