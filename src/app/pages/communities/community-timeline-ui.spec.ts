import { of, Subject } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityTimelineEntry } from '../../services/community-timeline.service';

describe('Community feed/chat UI state isolation', () => {
  let component: CommunitiesComponent;
  let list: jasmine.Spy;
  let send: jasmine.Spy;
  let remove: jasmine.Spy;

  const message = (kind: 'POST' | 'CHAT'): CommunityTimelineEntry => ({
    id: 18, communityId: 7, kind, username: 'ana', body: 'Olá!',
    createdAt: '2026-10-22T10:00:00Z'
  });

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 7, myRole: 'OWNER' } as any;
    component.activeTab = 'home';
    component.timelineEntries = [];
    component.timelineLoading = false;
    component.timelineSending = false;
    component.timelineDeletingId = null;
    component.timelineError = '';
    component.feedDraft = '';
    component.chatDraft = '';
    (component as any).timelineRequestVersion = 0;
    (component as any).chatEventsDuringLoad = new Map();
    list = jasmine.createSpy('list').and.returnValue(of([]));
    send = jasmine.createSpy('send').and.returnValue(of(message('POST')));
    remove = jasmine.createSpy('delete').and.returnValue(of(undefined));
    (component as any).timelineService = { list, send, delete: remove };
    spyOn(component, 'canManage').and.returnValue(true);
  });

  it('does not request content until feed or chat is selected', () => {
    component.setTab('home');
    expect(list).not.toHaveBeenCalled();
    component.setTab('feed');
    expect(list).toHaveBeenCalledOnceWith(7, 'POST');
    component.setTab('chat');
    expect(list.calls.mostRecent().args).toEqual([7, 'CHAT']);
  });

  it('ignores a stale feed response after switching to chat', () => {
    const earlier = new Subject<CommunityTimelineEntry[]>();
    list.and.returnValues(earlier.asObservable(), of([message('CHAT')]));
    component.setTab('feed');
    component.setTab('chat');
    earlier.next([message('POST')]);
    earlier.complete();
    expect(component.timelineEntries.map(item => item.kind)).toEqual(['CHAT']);
    expect(component.timelineLoading).toBeFalse();
  });

  it('sends chat text to chat only and clears draft on success', () => {
    component.activeTab = 'chat';
    component.chatDraft = '  Até já!  ';
    send.and.returnValue(of(message('CHAT')));
    spyOn(component, 'loadTimeline');
    component.sendTimeline();
    expect(send).toHaveBeenCalledWith(7, 'CHAT', 'Até já!');
    expect(component.chatDraft).toBe('');
    expect(component.feedDraft).toBe('');
    expect(component.loadTimeline).toHaveBeenCalled();
  });

  it('never submits empty or oversized messages', () => {
    component.activeTab = 'feed';
    component.feedDraft = '  ';
    component.sendTimeline();
    component.feedDraft = 'x'.repeat(1001);
    component.sendTimeline();
    component.activeTab = 'chat';
    component.chatDraft = 'x'.repeat(2001);
    component.sendTimeline();
    expect(send).not.toHaveBeenCalled();
  });

  it('allows a manager to remove an item from this community and tab', () => {
    component.activeTab = 'feed';
    spyOn(component, 'loadTimeline');
    component.deleteTimeline(message('POST'));
    expect(remove).toHaveBeenCalledWith(7, 'POST', 18);
    expect(component.loadTimeline).toHaveBeenCalled();

    remove.calls.reset();
    component.deleteTimeline({ ...message('POST'), communityId: 8 });
    expect(remove).not.toHaveBeenCalled();
    (component.canManage as jasmine.Spy).and.returnValue(false);
    component.deleteTimeline(message('POST'));
    expect(remove).not.toHaveBeenCalled();
  });
});
