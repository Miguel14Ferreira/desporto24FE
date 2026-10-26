import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { ChatReactionStoreService } from './chat-reaction-store.service';
import { ChatReactionEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';

describe('Chat reaction batch store', () => {
  let store: ChatReactionStoreService;
  let http: HttpTestingController;
  let reactionEvents: Subject<ChatReactionEvent>;
  let connected: BehaviorSubject<boolean>;

  beforeEach(() => {
    // Each spec owns its own stream; no old store continues receiving sockets.
    reactionEvents = new Subject<ChatReactionEvent>();
    connected = new BehaviorSubject<boolean>(false);
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

  it('ignores an old GET after a newer socket event and fresher GET', fakeAsync(() => {
    store.watch('community', 5, 100);
    flushMicrotasks();
    const old = http.expectOne(r => r.url.endsWith('/api/messages/reactions/community/5'));
    reactionEvents.next({kind:'community',conversationId:'5',messageId:100,
      counts:{'👍':6},actorUsername:'bea',emoji:'👍'});
    flushMicrotasks();
    const fresh = http.expectOne(r => r.url.endsWith('/api/messages/reactions/community/5'));
    fresh.flush([{messageId:100,counts:{'👍':6},myEmoji:null}]);
    old.flush([{messageId:100,counts:{'👍':1},myEmoji:null}]);
    expect(store.get('community',5,100)?.counts['👍']).toBe(6);
    store.unwatch('community',5,100);
  }));

  it('invalidates previous-connection responses and does not refresh twice on repeated AUTH', fakeAsync(() => {
    store.watch('direct','bea',12);
    flushMicrotasks();
    http.expectOne(r => r.url.endsWith('/api/messages/reactions/direct/bea'))
      .flush([{messageId:12,counts:{'🔥':1},myEmoji:null}]);
    connected.next(true); // first AUTH: no reconnect
    http.expectNone(r => r.url.endsWith('/api/messages/reactions/direct/bea'));
    connected.next(false);
    connected.next(true);
    flushMicrotasks();
    const firstReconnect = http.expectOne(r => r.url.endsWith('/api/messages/reactions/direct/bea'));
    connected.next(true); // duplicate AUTH signal: no extra GET
    flushMicrotasks();
    http.expectNone(r => r.url.endsWith('/api/messages/reactions/direct/bea'));
    reactionEvents.next({kind:'direct',conversationId:'bea',messageId:12,
      counts:{'🔥':4},actorUsername:'carla',emoji:'🔥'});
    flushMicrotasks();
    const afterSocket = http.expectOne(r => r.url.endsWith('/api/messages/reactions/direct/bea'));
    afterSocket.flush([{messageId:12,counts:{'🔥':4},myEmoji:null}]);
    firstReconnect.flush([{messageId:12,counts:{'🔥':1},myEmoji:null}]);
    expect(store.get('direct','bea',12)?.counts['🔥']).toBe(4);
    store.unwatch('direct','bea',12);
  }));

  it('does not let a delayed PUT acknowledgement overwrite newer WebSocket aggregates', fakeAsync(() => {
    store.watch('session',7,22);
    flushMicrotasks();
    http.expectOne(r => r.url.endsWith('/api/messages/reactions/session/7'))
      .flush([{messageId:22,counts:{'❤️':1},myEmoji:null}]);
    store.toggle('session',7,22,'❤️',()=>fail('Unexpected toggle error'));
    const put=http.expectOne(r=>r.url.endsWith('/api/messages/reactions/session/7/22'));
    reactionEvents.next({kind:'session',conversationId:'7',messageId:22,
      counts:{'❤️':3,'👍':2},actorUsername:'other',emoji:'👍'});
    expect(store.get('session',7,22)?.counts['❤️']).toBe(3);
    put.flush({messageId:22,counts:{'❤️':2},myEmoji:'❤️'});
    // A stale POST result cannot revert aggregate counts; GET reconciles.
    expect(store.get('session',7,22)?.counts['❤️']).toBe(3);
    flushMicrotasks();
    http.expectOne(r=>r.url.endsWith('/api/messages/reactions/session/7'))
      .flush([{messageId:22,counts:{'❤️':3,'👍':2},myEmoji:'❤️'}]);
    expect(store.get('session',7,22)?.counts['❤️']).toBe(3);
    expect(store.get('session',7,22)?.myEmoji).toBe('❤️');
    store.unwatch('session',7,22);
  }));

  it('does not report a failed PUT when the own reaction is confirmed by a socket event', fakeAsync(() => {
    const jwt='eyJhbGciOiJub25lIn0.' +
      btoa(JSON.stringify({sub:'ana',exp:4102444800})).replace(/=+$/,'') + '.fixture';
    spyOn(localStorage,'getItem').and.callFake(key=>key==='t'?jwt:null);
    store.watch('direct','bea',33);
    flushMicrotasks();
    http.expectOne(r=>r.url.endsWith('/api/messages/reactions/direct/bea'))
      .flush([{messageId:33,counts:{},myEmoji:null}]);
    const failed=jasmine.createSpy('reactionError');
    store.toggle('direct','bea',33,'👍',failed);
    const put=http.expectOne(r=>r.url.endsWith('/api/messages/reactions/direct/bea/33'));
    reactionEvents.next({kind:'direct',conversationId:'bea',messageId:33,
      counts:{'👍':1},actorUsername:'ana',emoji:'👍'});
    put.flush({message:'Response lost'}, {status:503,statusText:'Service Unavailable'});
    expect(failed).not.toHaveBeenCalled();
    expect(store.get('direct','bea',33)?.myEmoji).toBe('👍');
    flushMicrotasks();
    http.expectOne(r=>r.url.endsWith('/api/messages/reactions/direct/bea'))
      .flush([{messageId:33,counts:{'👍':1},myEmoji:'👍'}]);
    expect(store.get('direct','bea',33)?.counts['👍']).toBe(1);
    store.unwatch('direct','bea',33);
  }));

  it('does not write an in-flight GET over a local reaction mutation', fakeAsync(() => {
    store.watch('community',9,24);
    flushMicrotasks();
    http.expectOne(r=>r.url.endsWith('/api/messages/reactions/community/9'))
      .flush([{messageId:24,counts:{},myEmoji:null}]);
    connected.next(true);
    connected.next(false);
    connected.next(true);
    flushMicrotasks();
    const stale=http.expectOne(r=>r.url.endsWith('/api/messages/reactions/community/9'));
    // A socket event during recovery causes a newer authorized GET, which
    // restores the cache before the user can click a reaction again.
    reactionEvents.next({kind:'community',conversationId:'9',messageId:24,
      counts:{},actorUsername:'bea',emoji:'👏'});
    flushMicrotasks();
    http.expectOne(r=>r.url.endsWith('/api/messages/reactions/community/9'))
      .flush([{messageId:24,counts:{},myEmoji:null}]);
    store.toggle('community',9,24,'🎉',()=>fail('Unexpected failure'));
    const put=http.expectOne(r=>r.url.endsWith('/api/messages/reactions/community/9/24'));
    stale.flush([{messageId:24,counts:{},myEmoji:null}]);
    put.flush({messageId:24,counts:{'🎉':1},myEmoji:'🎉'});
    expect(store.get('community',9,24)?.myEmoji).toBe('🎉');
    store.unwatch('community',9,24);
  }));

  it('makes a failed batch retryable without pretending the empty reaction count was loaded', fakeAsync(() => {
    store.watch('direct','bea',44);
    flushMicrotasks();
    http.expectOne(r => r.url.endsWith('/api/messages/reactions/direct/bea'))
      .flush({message:'Forbidden'},{status:403,statusText:'Forbidden'});
    expect(store.get('direct','bea',44)).toBeUndefined();
    expect(store.hasFailed('direct','bea',44)).toBeTrue();

    store.retry('direct','bea',44);
    flushMicrotasks();
    const retry=http.expectOne(r => r.url.endsWith('/api/messages/reactions/direct/bea'));
    expect(store.hasFailed('direct','bea',44)).toBeFalse();
    retry.flush([{messageId:44,counts:{},myEmoji:null}]);
    expect(store.get('direct','bea',44)).toEqual({messageId:44,counts:{},myEmoji:null});
    expect(store.hasFailed('direct','bea',44)).toBeFalse();
    store.unwatch('direct','bea',44);
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
