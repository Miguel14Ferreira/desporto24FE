import { BehaviorSubject, Subject } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { ChatTypingTracker } from './chat-typing-tracker';
import { ChatTypingEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';

describe('Ephemeral typing tracker', () => {
  let events: Subject<ChatTypingEvent>;
  let online: BehaviorSubject<boolean>;
  let send: jasmine.Spy;
  let tracker: ChatTypingTracker;

  beforeEach(() => {
    events = new Subject<ChatTypingEvent>();
    online = new BehaviorSubject<boolean>(true);
    send = jasmine.createSpy('sendTyping');
    tracker = new ChatTypingTracker({
      typing$: events.asObservable(), connected$: online.asObservable(),
      sendTyping: send
    } as unknown as DirectChatRealtimeService);
  });

  afterEach(() => tracker.destroy());

  it('throttles keystrokes, stops on idle, and sends no message bodies', fakeAsync(() => {
    tracker.input('direct', 'bea', 'Privado 1');
    tracker.input('direct', 'bea', 'Privado 2');
    expect(send).toHaveBeenCalledOnceWith('direct', 'bea', true);
    tick(2400);
    tracker.input('direct', 'bea', 'Outro texto');
    expect(send).toHaveBeenCalledTimes(2);
    tick(3201);
    expect(send).toHaveBeenCalledWith('direct', 'bea', false);
  }));

  it('shows only authorized conversation keys and expires stale presence', fakeAsync(() => {
    events.next({ kind: 'community', conversationId: '7', username: 'bea', active: true });
    expect(tracker.label('community', 7)).toContain('bea');
    expect(tracker.label('community', 8)).toBe('');
    expect(tracker.label('session', 7)).toBe('');
    tick(5001);
    expect(tracker.label('community', 7)).toBe('');
  }));

  it('removes presence immediately on stop and disconnection', fakeAsync(() => {
    events.next({ kind: 'direct', conversationId: 'bea', username: 'bea', active: true });
    expect(tracker.label('direct', 'bea')).not.toBe('');
    events.next({ kind: 'direct', conversationId: 'bea', username: 'bea', active: false });
    expect(tracker.label('direct', 'bea')).toBe('');
    events.next({ kind: 'session', conversationId: '41', username: 'bea', active: true });
    online.next(false);
    expect(tracker.label('session', 41)).toBe('');
    tick(5100);
    expect(tracker.label('session', 41)).toBe('');
  }));

  it('resets the typing cooldown on disconnect so the first post-reconnect keystroke sends immediately', fakeAsync(() => {
    tracker.input('direct','bea','Antes da queda');
    expect(send).toHaveBeenCalledOnceWith('direct','bea',true);
    tick(300); // still inside the 2400ms throttle window
    online.next(false);
    online.next(true);
    tracker.input('direct','bea','Ligação voltou');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith('direct','bea',true);
    tick(3201);
    expect(send).toHaveBeenCalledWith('direct','bea',false);
  }));

  it('ends active conversation before switching and when input is cleared', fakeAsync(() => {
    tracker.input('session', 41, 'jogar');
    tick(1200);
    tracker.input('community', 7, 'treinar');
    expect(send).toHaveBeenCalledWith('session', '41', false);
    expect(send).toHaveBeenCalledWith('community', 7, true);
    tracker.input('community', 7, '');
    expect(send).toHaveBeenCalledWith('community', '7', false);
  }));
});
