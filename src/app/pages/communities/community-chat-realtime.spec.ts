import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommunitiesComponent } from './communities.component';
import { CommunityTimelineEntry, CommunityTimelineService } from '../../services/community-timeline.service';

describe('Community chat realtime and sending', () => {
  let component: CommunitiesComponent;
  let api: jasmine.SpyObj<CommunityTimelineService>;
  const entry = (id: number, communityId = 7, username = 'ana', body = 'Olá'): CommunityTimelineEntry => ({
    id, communityId, kind: 'CHAT', username, body, createdAt: new Date().toISOString()
  });

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    api = jasmine.createSpyObj<CommunityTimelineService>('CommunityTimelineService', ['list', 'olderMessages', 'send', 'delete']);
    (component as any).timelineService = api;
    component.selected = { id: 7, name: 'CNG', members: [], myRole: 'MEMBER' } as any;
    component.activeTab = 'chat';
    component.timelineEntries = [];
    component.chatDeliveryUncertain = false;
    (component as any).timelineRequestVersion = 0;
    (component as any).chatEventsDuringLoad = new Map();
    spyOn(component as any, 'currentChatUsername').and.returnValue('ana');
    api.list.and.returnValue(of([]));
  });

  it('marks only visible CHAT entries as read, never community feed posts', () => {
    const mark = jasmine.createSpy('markVisible');
    (component as any).readSync = { markVisible: mark };
    const log = document.createElement('div');
    component.communityChatLog = { nativeElement: log } as any;
    component.timelineLoading = false;
    component.timelineError = '';
    component.timelineEntries = [entry(16), entry(17)];

    component.onCommunityChatScroll();
    expect(mark).toHaveBeenCalledOnceWith('community', 7, 17, log);

    mark.calls.reset();
    component.activeTab = 'feed';
    component.onCommunityChatScroll();
    expect(mark).not.toHaveBeenCalled();

    component.activeTab = 'chat';
    component.timelineError = 'Não autorizado';
    component.onCommunityChatScroll();
    expect(mark).not.toHaveBeenCalled();
  });

  it('ignores messages from other communities or non-chat channels', () => {
    component.onCommunityChatRealtime(entry(1, 8));
    component.onCommunityChatRealtime({ ...entry(2), kind: 'POST' });
    expect(component.timelineEntries).toEqual([]);
    component.onCommunityChatRealtime(entry(3));
    expect(component.timelineEntries.map(x => x.id)).toEqual([3]);
    component.setTab('home');
    component.onCommunityChatRealtime(entry(4));
    expect(component.timelineEntries).toEqual([]);
  });

  it('reconciles socket messages with an older HTTP response without duplicates', () => {
    // Explicit timestamps avoid relying on the runner clock or millisecond ties.
    const timed = (id: number) => ({ ...entry(id),
      createdAt: new Date(Date.UTC(2026, 9, 23, 12, 0, id)).toISOString() });
    const pending = new Subject<CommunityTimelineEntry[]>();
    api.list.and.returnValue(pending.asObservable());
    component.loadTimeline();
    component.onCommunityChatRealtime(timed(14));
    component.onCommunityChatRealtime(timed(14));
    pending.next([timed(12), timed(13)]);
    pending.complete();
    expect(component.timelineEntries.map(x => x.id)).toEqual([12, 13, 14]);
  });

  it('honors deleted messages on HTTP reload but retains socket messages arriving during it', () => {
    const timed = (id: number) => ({ ...entry(id),
      createdAt: new Date(Date.UTC(2026, 9, 23, 12, 0, id)).toISOString() });
    component.timelineEntries = [timed(1), timed(2)];
    const pending = new Subject<CommunityTimelineEntry[]>();
    api.list.and.returnValue(pending.asObservable());
    component.loadTimeline();
    component.onCommunityChatRealtime(timed(3));
    pending.next([timed(2)]);
    pending.complete();
    expect(component.timelineEntries.map(x => x.id)).toEqual([2, 3]);

    api.list.and.returnValue(of([timed(2), timed(3)]));
    component.loadTimeline();
    expect(component.timelineEntries.map(x => x.id)).toEqual([2, 3]);
  });

  it('retains history and respects ordering', () => {
    const many = Array.from({ length: 75 }, (_, i) =>
      ({ ...entry(i + 1), createdAt: new Date(2026, 9, 23, 12, i).toISOString() }));
    for (const item of [...many].reverse()) component.onCommunityChatRealtime(item);
    expect(component.timelineEntries.length).toBe(75);
    expect(component.timelineEntries[0].id).toBe(1);
    expect(component.timelineEntries[74].id).toBe(75);
  });

  it('loads earlier messages with the oldest cursor, without duplication', () => {
    component.timelineEntries = Array.from({ length: 60 }, (_, i) => entry(i + 61));
    component.chatHasOlder = true;
    api.olderMessages.and.returnValue(of([ { ...entry(59), createdAt: '2026-10-21T09:00:00Z' }, { ...entry(60), createdAt: '2026-10-21T09:01:00Z' } ]));
    component.loadOlderCommunityMessages();
    expect(api.olderMessages).toHaveBeenCalledOnceWith(7, 61);
    expect(component.timelineEntries.map(x => x.id)[0]).toBe(59);
    expect(component.timelineEntries.length).toBe(62);
    expect(component.chatHasOlder).toBeFalse();
  });

  it('never requests earlier messages for feed or without history', () => {
    component.timelineEntries = [entry(1)];
    component.chatHasOlder = true;
    component.activeTab = 'feed';
    component.loadOlderCommunityMessages();
    component.activeTab = 'chat';
    component.chatHasOlder = false;
    component.loadOlderCommunityMessages();
    expect(api.olderMessages).not.toHaveBeenCalled();
  });

  it('keeps a draft and prevents second POST when the first result is uncertain', () => {
    component.chatDraft = '  Vamos jogar?  ';
    api.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    api.list.and.returnValue(of([]));
    component.sendTimeline();
    expect(api.send).toHaveBeenCalledOnceWith(7, 'CHAT', 'Vamos jogar?');
    expect(component.chatDeliveryUncertain).toBeTrue();
    expect(component.chatDraft).toBe('  Vamos jogar?  ');
    component.sendTimeline();
    expect(api.send).toHaveBeenCalledTimes(1);
    component.resumeCommunityChatAfterUncertainSend();
    expect(component.chatDeliveryUncertain).toBeFalse();
    expect(component.chatDraft).toBe('  Vamos jogar?  ');
  });

  it('confirms a message found after a dropped response without another POST', () => {
    component.chatDraft = 'Até amanhã';
    api.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    api.list.and.returnValue(of([entry(91, 7, 'ana', 'Até amanhã')]));
    component.sendTimeline();
    expect(component.chatDeliveryUncertain).toBeFalse();
    expect(component.chatDraft).toBe('');
    expect(component.timelineEntries.map(x => x.id)).toEqual([91]);
    expect(api.send).toHaveBeenCalledTimes(1);
  });

  it('does not treat a known old identical message as new delivery', () => {
    component.timelineEntries = [entry(22, 7, 'ana', 'Bora')];
    component.chatDraft = 'Bora';
    api.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 408 })));
    api.list.and.returnValue(of([entry(22, 7, 'ana', 'Bora')]));
    component.sendTimeline();
    expect(component.chatDeliveryUncertain).toBeTrue();
    expect(component.chatDraft).toBe('Bora');
  });

  it('keeps the feed separate from the group conversation', () => {
    component.activeTab = 'feed';
    component.feedDraft = 'Novo treino';
    api.send.and.returnValue(of({ ...entry(3), kind: 'POST' }));
    component.sendTimeline();
    expect(api.send).toHaveBeenCalledOnceWith(7, 'POST', 'Novo treino');
    expect(component.feedDraft).toBe('');
    expect(component.timelineEntries).toEqual([]);
    expect(component.chatDeliveryUncertain).toBeFalse();
  });

  it('does not submit while composing characters via IME', () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
    component.onCommunityChatEnter(event);
    expect(event.defaultPrevented).toBeFalse();
    expect(api.send).not.toHaveBeenCalled();
  });
});
