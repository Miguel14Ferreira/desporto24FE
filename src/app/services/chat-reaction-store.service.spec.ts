import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { ChatReactionStoreService } from './chat-reaction-store.service';
import { ChatReactionEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';

describe('Chat reaction batch store', () => {
  let store: ChatReactionStoreService;
  let http: HttpTestingController;
  const reactionEvents = new Subject<ChatReactionEvent>();
  const connected = new BehaviorSubject<boolean>(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: DirectChatRealtimeService, useValue: {
          reactions$: reactionEvents.asObservable(), connected$: connected.asObservable()
        } }
      ]
    });
    store = TestBed.inject(ChatReactionStoreService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('batches two visible messages from the same direct chat into one authorized GET', fakeAsync(() => {
    store.watch('direct', 'bea', 12);
    store.watch('direct', 'bea', 13);
    flushMicrotasks();
    const req = http.expectOne(request =>
      request.url.endsWith('/api/messages/reactions/direct/bea')
      && request.params.get('ids') === '12,13');
    expect(req.request.method).toBe('GET');
    req.flush([
      { messageId: 12, counts: { '👍': 2 }, myEmoji: null },
      { messageId: 13, counts: {}, myEmoji: null }
    ]);
    expect(store.get('direct', 'bea', 12)?.counts['👍']).toBe(2);
    expect(store.get('direct', 'bea', 13)?.myEmoji).toBeNull();
    store.unwatch('direct', 'bea', 12);
    store.unwatch('direct', 'bea', 13);
  }));

  it('upserts a new emoji then deletes the same emoji without duplicate POSTs', fakeAsync(() => {
    store.watch('session', 7, 22);
    flushMicrotasks();
    http.expectOne(r => r.url.endsWith('/api/messages/reactions/session/7'))
      .flush([{ messageId: 22, counts: {}, myEmoji: null }]);
    let failed = false;
    store.toggle('session', 7, 22, '❤️', () => { failed = true; });
    const put = http.expectOne(r => r.url.endsWith('/api/messages/reactions/session/7/22'));
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ emoji: '❤️' });
    // A second click while the PUT is pending must not create another request.
    store.toggle('session', 7, 22, '❤️', () => { failed = true; });
    http.expectNone(r => r.url.endsWith('/api/messages/reactions/session/7/22') && r !== put.request);
    put.flush({ messageId: 22, counts: { '❤️': 1 }, myEmoji: '❤️' });
    store.toggle('session', 7, 22, '❤️', () => { failed = true; });
    const del = http.expectOne(r => r.url.endsWith('/api/messages/reactions/session/7/22'));
    expect(del.request.method).toBe('DELETE');
    del.flush({ messageId: 22, counts: {}, myEmoji: null });
    expect(store.get('session', 7, 22)?.myEmoji).toBeNull();
    expect(failed).toBeFalse();
    store.unwatch('session', 7, 22);
  }));

  it('applies aggregate updates from community WebSocket without making per-message requests', fakeAsync(() => {
    store.watch('community', 5, 100);
    flushMicrotasks();
    http.expectOne(r => r.url.endsWith('/api/messages/reactions/community/5'))
      .flush([{ messageId: 100, counts: { '🎉': 1 }, myEmoji: null }]);
    reactionEvents.next({ kind: 'community', conversationId: '5',
      messageId: 100, counts: { '🎉': 3, '👍': 1 }, actorUsername: 'other',
      emoji: '🎉' });
    expect(store.get('community', 5, 100)?.counts['🎉']).toBe(3);
    expect(store.get('community', 5, 100)?.myEmoji).toBeNull();
    store.unwatch('community', 5, 100);
  }));

  it('does not fabricate empty counts if the authorized batch fails', fakeAsync(() => {
    store.watch('community', 9, 22);
    flushMicrotasks();
    http.expectOne(r => r.url.endsWith('/api/messages/reactions/community/9'))
      .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(store.get('community', 9, 22)).toBeUndefined();
    store.unwatch('community', 9, 22);
  }));
});
