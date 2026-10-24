import { of, Subject, throwError } from 'rxjs';
import { ChatReadSyncService } from './chat-read-sync.service';
import { InboxApiService, InboxSummary } from './inbox-api.service';

describe('ChatReadSyncService', () => {
  let api: jasmine.SpyObj<InboxApiService>;
  let service: ChatReadSyncService;
  let log: HTMLElement;

  const acknowledged = (id: number): InboxSummary => ({
    kind: 'direct', id: 'bea', latestMessageId: id,
    latestText: 'Olá', latestSender: 'bea', latestAt: '2026-10-23T09:00:00Z',
    unreadCount: 0
  });

  beforeEach(() => {
    api = jasmine.createSpyObj<InboxApiService>('InboxApiService', ['markRead', 'summaries']);
    api.markRead.and.returnValue(of(acknowledged(9)));
    service = new ChatReadSyncService(api);
    // Chrome Headless runs tests without a foreground browser tab.
    // Test visible and hidden UI states explicitly, not the runner's focus.
    spyOn<any>(service, 'isTabVisible').and.returnValue(true);
    log = document.createElement('div');
    spyOn(log, 'getBoundingClientRect').and.returnValue({
      top: 10, bottom: 130, height: 120, left: 0, right: 100, width: 100,
      x: 0, y: 10, toJSON: () => ({})
    } as DOMRect);
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 100 });
    // Detached DOM nodes do not retain native scrollTop in Headless Chrome.
    // Make the virtual scroll geometry explicit and writable for this unit test.
    Object.defineProperty(log, 'scrollTop', { configurable: true, writable: true, value: 300 });
  });

  it('persists a visible conversation once even after repeated view checks', () => {
    service.markVisible('direct', 'bea', 9, log);
    service.markVisible('direct', 'bea', 9, log);
    service.markVisible('direct', 'bea', 7, log);
    expect(api.markRead).toHaveBeenCalledOnceWith({ kind: 'direct', id: 'bea' }, 9);
  });

  it('never marks a chat hidden down the page or scrolled away from the newest message', () => {
    (log.getBoundingClientRect as jasmine.Spy).and.returnValue({
      top: window.innerHeight + 10, bottom: window.innerHeight + 110, height: 100
    } as DOMRect);
    service.markVisible('session', 42, 12, log);
    (log.getBoundingClientRect as jasmine.Spy).and.returnValue({
      top: 10, bottom: 110, height: 100
    } as DOMRect);
    log.scrollTop = 0;
    service.markVisible('session', 42, 12, log);
    service.markVisible('session', 42, null, log);
    service.markVisible('session', 42, 0, log);
    service.markVisible('session', 42, -1, log);
    service.markVisible('session', 42, 12);
    expect(api.markRead).not.toHaveBeenCalled();
  });

  it('does not mark messages as read while the browser window is unfocused', () => {
    // Do not use the default test stub: exercise the real foreground check.
    (service as any).isTabVisible.and.callThrough();
    const focus = spyOn(document, 'hasFocus').and.returnValue(false);
    const visibility = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
    service.markVisible('direct', 'bea', 10, log);
    expect(api.markRead).not.toHaveBeenCalled();

    focus.and.returnValue(true);
    visibility.and.returnValue('hidden');
    service.markVisible('direct', 'bea', 10, log);
    expect(api.markRead).not.toHaveBeenCalled();

    visibility.and.returnValue('visible');
    service.markVisible('direct', 'bea', 10, log);
    expect(api.markRead).toHaveBeenCalledOnceWith({ kind: 'direct', id: 'bea' }, 10);
  });

  it('holds a queued read while unfocused and only flushes after a new focused view', () => {
    let focused = true;
    (service as any).isTabVisible.and.callFake(() => focused);
    const first = new Subject<InboxSummary>();
    api.markRead.and.returnValues(first.asObservable(), of(acknowledged(20)));

    service.markVisible('community', 7, 12, log);
    service.markVisible('community', 7, 20, log);
    expect(api.markRead).toHaveBeenCalledTimes(1);

    focused = false;
    first.next(acknowledged(12));
    first.complete();
    expect(api.markRead).toHaveBeenCalledTimes(1);

    focused = true;
    service.markVisible('community', 7, 20, log);
    expect(api.markRead).toHaveBeenCalledTimes(2);
    expect(api.markRead.calls.argsFor(1)).toEqual([{ kind: 'community', id: '7' }, 20]);
  });

  it('serializes newer receipts received during an earlier in-flight request', () => {
    const delayed = new Subject<InboxSummary>();
    api.markRead.and.returnValues(delayed.asObservable(), of(acknowledged(20)));
    service.markVisible('community', 7, 12, log);
    service.markVisible('community', 7, 20, log);
    expect(api.markRead).toHaveBeenCalledTimes(1);
    delayed.next(acknowledged(12));
    delayed.complete();
    expect(api.markRead).toHaveBeenCalledTimes(2);
    expect(api.markRead.calls.argsFor(1)).toEqual([{ kind: 'community', id: '7' }, 20]);
    service.markVisible('community', 7, 20, log);
    expect(api.markRead).toHaveBeenCalledTimes(2);
  });

  it('does not claim read success or immediately retry on a failed response', () => {
    api.markRead.and.returnValue(throwError(() => new Error('offline')));
    service.markVisible('direct', 'bea', 4, log);
    service.markVisible('direct', 'bea', 4, log);
    expect(api.markRead).toHaveBeenCalledTimes(1);
  });
});
